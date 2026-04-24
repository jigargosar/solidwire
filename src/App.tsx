import {createMemo, createSignal, For, onCleanup, type Accessor} from "solid-js";
import {createStore} from "solid-js/store";
import rough from "roughjs";
import type {Drawable} from "roughjs/bin/core";

// --- CONFIG ---
const generator = rough.generator();
const strokeColor = '#374151';

const toPath = (drawable: Drawable) =>
    generator.toPaths(drawable).map(p => p.d).join(' ');

function assertNever(_: never): never {
    throw new Error('unreachable');
}

// --- TYPES ---
type Point = { x: number; y: number };

type Widget =
    | { tag: 'rect'; id: number; x: number; y: number; w: number; h: number }
    | { tag: 'button'; id: number; x: number; y: number; w: number; h: number }
    | { tag: 'text'; id: number; x: number; y: number; content: string };

type Tool = 'rect' | 'button' | 'text';

type Mode =
    | { tag: 'idle' }
    | { tag: 'armed'; tool: Tool }
    | { tag: 'drawing'; start: Point; current: Point }
    | { tag: 'dragging'; id: number; offset: Point };

// --- MODEL ---
function createModel() {
    const [widgets, setWidgets] = createStore<Widget[]>([
        {tag: 'rect', id: 1, x: 300, y: 100, w: 200, h: 150},
        {tag: 'button', id: 2, x: 600, y: 300, w: 240, h: 80},
    ]);
    const [mode, setMode] = createSignal<Mode>({tag: 'idle'});

    type Rect = { x: number; y: number; w: number; h: number };
    const previewRect = createMemo<Rect | null>(() => {
        const m = mode();
        if (m.tag !== 'drawing') return null;
        return {
            x: Math.min(m.start.x, m.current.x),
            y: Math.min(m.start.y, m.current.y),
            w: Math.abs(m.start.x - m.current.x),
            h: Math.abs(m.start.y - m.current.y),
        };
    });

    const activeTool = (): Tool | null => {
        const m = mode();
        switch (m.tag) {
            case 'armed':
                return m.tool;
            case 'drawing':
                return 'rect';
            case 'idle':
            case 'dragging':
                return null;
            default:
                return assertNever(m);
        }
    };

    const toggleTool = (tool: Tool) => {
        const m = mode();
        if (m.tag === 'armed' && m.tool === tool) setMode({tag: 'idle'});
        else setMode({tag: 'armed', tool});
    };

    const cancel = () => setMode({tag: 'idle'});

    const canvasPointerDown = (p: Point) => {
        const m = mode();
        if (m.tag !== 'armed') return;
        switch (m.tool) {
            case 'rect':
                setMode({tag: 'drawing', start: p, current: p});
                return;
            case 'button':
                setWidgets(ws => [...ws, {tag: 'button', id: Date.now(), x: p.x - 120, y: p.y - 40, w: 240, h: 80}]);
                return;
            case 'text':
                setWidgets(ws => [...ws, {tag: 'text', id: Date.now(), x: p.x, y: p.y, content: 'Text'}]);
                return;
            default:
                return assertNever(m.tool);
        }
    };

    const widgetPointerDown = (id: number, cursor: Point) => {
        if (mode().tag !== 'idle') return;
        const widget = widgets.find(w => w.id === id);
        if (!widget) return;
        setMode({tag: 'dragging', id, offset: {x: cursor.x - widget.x, y: cursor.y - widget.y}});
    };

    const pointerMove = (p: Point) => {
        const m = mode();
        switch (m.tag) {
            case 'dragging':
                setWidgets(w => w.id === m.id, {x: p.x - m.offset.x, y: p.y - m.offset.y});
                return;
            case 'drawing':
                setMode({tag: 'drawing', start: m.start, current: p});
                return;
            case 'idle':
            case 'armed':
                return;
            default:
                return assertNever(m);
        }
    };

    const pointerUp = () => {
        const m = mode();
        switch (m.tag) {
            case 'drawing': {
                const r = previewRect();
                if (r && r.w > 5 && r.h > 5) {
                    setWidgets(ws => [...ws, {tag: 'rect', id: Date.now(), ...r}]);
                }
                setMode({tag: 'armed', tool: 'rect'});
                return;
            }
            case 'dragging':
                setMode({tag: 'idle'});
                return;
            case 'idle':
            case 'armed':
                return;
            default:
                return assertNever(m);
        }
    };

    return {
        widgets,
        mode,
        previewRect,
        activeTool,
        toggleTool,
        cancel,
        canvasPointerDown,
        widgetPointerDown,
        pointerMove,
        pointerUp,
    };
}

// --- DRAWABLES ---
const getRectPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, {roughness: 1.2, stroke: strokeColor, strokeWidth: 2}));

const getButtonPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, {roughness: 1.5, stroke: strokeColor, strokeWidth: 2}));

// --- WIDGET COMPONENTS ---
type RectW = Extract<Widget, { tag: 'rect' }>;
type ButtonW = Extract<Widget, { tag: 'button' }>;
type TextW = Extract<Widget, { tag: 'text' }>;

type WidgetProps<T> = {
    w: T;
    mode: Accessor<Mode>;
    onDragStart: (id: number, e: PointerEvent) => void;
};

const cursorClass = (mode: Accessor<Mode>) => mode().tag === 'idle' ? 'cursor-move' : '';

function RectWidget(props: WidgetProps<RectW>) {
    const d = createMemo(() => getRectPath(props.w.w, props.w.h));
    return (
        <g transform={`translate(${props.w.x}, ${props.w.y})`}
           class={cursorClass(props.mode)}
           onPointerDown={(e) => props.onDragStart(props.w.id, e)}>
            <rect width={props.w.w} height={props.w.h} fill="transparent"/>
            <path d={d()} fill="white" fill-opacity={0.5} stroke={strokeColor} stroke-width="2.5" pointer-events="none"/>
        </g>
    );
}

function ButtonWidget(props: WidgetProps<ButtonW>) {
    const d = createMemo(() => getButtonPath(props.w.w, props.w.h));
    return (
        <g transform={`translate(${props.w.x}, ${props.w.y})`}
           class={cursorClass(props.mode)}
           onPointerDown={(e) => props.onDragStart(props.w.id, e)}>
            <rect width={props.w.w} height={props.w.h} fill="transparent"/>
            <path d={d()} fill="none" stroke={strokeColor} stroke-width="2.5" pointer-events="none"/>
            <text x={props.w.w / 2} y={props.w.h / 2 + 10} text-anchor="middle"
                  style={{"font-family": "'Kalam', cursive"}}
                  class="select-none text-2xl fill-gray-800 font-bold" pointer-events="none">Button</text>
        </g>
    );
}

function TextWidget(props: WidgetProps<TextW>) {
    return (
        <g transform={`translate(${props.w.x}, ${props.w.y})`}
           class={cursorClass(props.mode)}
           onPointerDown={(e) => props.onDragStart(props.w.id, e)}>
            <rect x={-4} y={-24} width={props.w.content.length * 14 + 8} height={32} fill="transparent"/>
            <text style={{"font-family": "'Kalam', cursive"}}
                  class="select-none text-2xl fill-gray-800 font-bold" pointer-events="none">{props.w.content}</text>
        </g>
    );
}

// --- VIEW ---
export default function App() {
    const m = createModel();
    let canvasRef: SVGSVGElement | undefined;

    const miniRect = createMemo(() =>
        generator.rectangle(10, 5, 60, 30, {roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5}));
    const miniButton = createMemo(() =>
        generator.rectangle(5, 5, 70, 30, {roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5}));

    const toLocal = (e: PointerEvent): Point | null => {
        if (!canvasRef) return null;
        const ctm = canvasRef.getScreenCTM();
        if (!ctm) return null;
        const pt = canvasRef.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const r = pt.matrixTransform(ctm.inverse());
        return {x: r.x, y: r.y};
    };

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') m.cancel();
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => window.removeEventListener('keydown', handleKey));

    const tileClass = (selected: boolean) =>
        `group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${
            selected ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-500'
        }`;

    return (
        <main
            class="relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900"
            onPointerMove={(e) => {
                const p = toLocal(e);
                if (p) m.pointerMove(p);
            }}
            onPointerUp={() => m.pointerUp()}
        >
            <aside
                class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    <div onClick={() => m.toggleTool('rect')} class={tileClass(m.activeTool() === 'rect')}>
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniRect())} fill="none" stroke={strokeColor} stroke-width="1.5"/>
                            <text x="40" y="26" text-anchor="middle" style={{"font-family": "'Kalam', cursive"}}
                                  class="text-[10px] fill-gray-600 select-none font-bold">Rect
                            </text>
                        </svg>
                    </div>
                    <div onClick={() => m.toggleTool('button')} class={tileClass(m.activeTool() === 'button')}>
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniButton())} fill="none" stroke={strokeColor} stroke-width="1.5"/>
                            <text x="40" y="26" text-anchor="middle" style={{"font-family": "'Kalam', cursive"}}
                                  class="text-[10px] fill-gray-600 select-none font-bold">Button
                            </text>
                        </svg>
                    </div>
                    <div onClick={() => m.toggleTool('text')} class={tileClass(m.activeTool() === 'text')}>
                        <svg viewBox="0 0 80 40" class="w-full">
                            <text x="40" y="26" text-anchor="middle" style={{"font-family": "'Kalam', cursive"}}
                                  class="text-[14px] fill-gray-700 select-none font-bold">Text
                            </text>
                        </svg>
                    </div>
                </div>
            </aside>

            <svg
                ref={canvasRef}
                class={`h-full w-full block bg-gray-100 ${m.activeTool() ? 'cursor-crosshair' : ''}`}
                onPointerDown={(e) => {
                    const p = toLocal(e);
                    if (p) m.canvasPointerDown(p);
                }}
            >
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)"/>

                <For each={m.widgets}>{(w) => {
                    const onDragStart = (id: number, e: PointerEvent) => {
                        if (m.mode().tag !== 'idle') return;
                        const p = toLocal(e);
                        if (!p) return;
                        e.stopPropagation();
                        m.widgetPointerDown(id, p);
                    };
                    switch (w.tag) {
                        case 'rect': return <RectWidget w={w} mode={m.mode} onDragStart={onDragStart}/>;
                        case 'button': return <ButtonWidget w={w} mode={m.mode} onDragStart={onDragStart}/>;
                        case 'text': return <TextWidget w={w} mode={m.mode} onDragStart={onDragStart}/>;
                        default: return assertNever(w);
                    }
                }}</For>

                {(() => {
                    const r = m.previewRect();
                    if (!r) return null;
                    return (
                        <path
                            d={getRectPath(r.w, r.h)}
                            transform={`translate(${r.x}, ${r.y})`}
                            fill="none"
                            stroke={strokeColor}
                            stroke-dasharray="5,5"
                        />
                    );
                })()}
            </svg>
        </main>
    );
}
