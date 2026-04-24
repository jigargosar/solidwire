import { createMemo, createSignal, For, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import rough from "roughjs";
import { toPath } from "./utils";

// --- CONFIG ---
const generator = rough.generator();
const strokeColor = '#374151';

function assertNever(_: never): never {
    throw new Error('unreachable');
}

// --- TYPES ---
type Point = { x: number; y: number };

type Widget =
    | { tag: 'rect'; id: number; x: number; y: number; w: number; h: number }
    | { tag: 'button'; id: number; x: number; y: number; w: number; h: number };

type Tool = 'rect' | 'button';

type Mode =
    | { tag: 'idle' }
    | { tag: 'armed'; tool: Tool }
    | { tag: 'drawing'; start: Point; current: Point }
    | { tag: 'dragging'; id: number };

// --- MODEL ---
function createModel() {
    const [widgets, setWidgets] = createStore<Widget[]>([
        { tag: 'rect', id: 1, x: 300, y: 100, w: 200, h: 150 },
        { tag: 'button', id: 2, x: 600, y: 300, w: 240, h: 80 },
    ]);
    const [mode, setMode] = createSignal<Mode>({ tag: 'idle' });

    const activeTool = (): Tool | null => {
        const m = mode();
        switch (m.tag) {
            case 'armed': return m.tool;
            case 'drawing': return 'rect';
            case 'idle':
            case 'dragging': return null;
            default: return assertNever(m);
        }
    };

    const toggleTool = (tool: Tool) => {
        const m = mode();
        if (m.tag === 'armed' && m.tool === tool) setMode({ tag: 'idle' });
        else setMode({ tag: 'armed', tool });
    };

    const cancel = () => setMode({ tag: 'idle' });

    const canvasPointerDown = (p: Point) => {
        const m = mode();
        if (m.tag !== 'armed') return;
        switch (m.tool) {
            case 'rect':
                setMode({ tag: 'drawing', start: p, current: p });
                return;
            case 'button':
                setWidgets(ws => [...ws, { tag: 'button', id: Date.now(), x: p.x - 120, y: p.y - 40, w: 240, h: 80 }]);
                return;
            default: return assertNever(m.tool);
        }
    };

    const widgetPointerDown = (id: number) => {
        if (mode().tag === 'idle') setMode({ tag: 'dragging', id });
    };

    const pointerMove = (p: Point) => {
        const m = mode();
        switch (m.tag) {
            case 'dragging': {
                const widget = widgets.find(w => w.id === m.id);
                if (widget && widget.tag === 'rect') {
                    setWidgets(w => w.id === m.id, { x: p.x - widget.w / 2, y: p.y - widget.h / 2 });
                }
                return;
            }
            case 'drawing':
                setMode({ tag: 'drawing', start: m.start, current: p });
                return;
            case 'idle':
            case 'armed': return;
            default: return assertNever(m);
        }
    };

    const pointerUp = () => {
        const m = mode();
        switch (m.tag) {
            case 'drawing': {
                const x = Math.min(m.start.x, m.current.x);
                const y = Math.min(m.start.y, m.current.y);
                const w = Math.abs(m.start.x - m.current.x);
                const h = Math.abs(m.start.y - m.current.y);
                if (w > 5 && h > 5) {
                    setWidgets(ws => [...ws, { tag: 'rect', id: Date.now(), x, y, w, h }]);
                }
                setMode({ tag: 'armed', tool: 'rect' });
                return;
            }
            case 'dragging':
                setMode({ tag: 'idle' });
                return;
            case 'idle':
            case 'armed': return;
            default: return assertNever(m);
        }
    };

    return {
        widgets,
        mode,
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
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }));

const getButtonPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.5, stroke: strokeColor, strokeWidth: 2 }));

// --- VIEW ---
export default function App() {
    const m = createModel();
    let canvasRef: SVGSVGElement | undefined;

    const miniRect = createMemo(() =>
        generator.rectangle(10, 5, 60, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 }));
    const miniButton = createMemo(() =>
        generator.rectangle(5, 5, 70, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 }));

    const toLocal = (e: PointerEvent): Point | null => {
        if (!canvasRef) return null;
        const ctm = canvasRef.getScreenCTM();
        if (!ctm) return null;
        const pt = canvasRef.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const r = pt.matrixTransform(ctm.inverse());
        return { x: r.x, y: r.y };
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
            onPointerMove={(e) => { const p = toLocal(e); if (p) m.pointerMove(p); }}
            onPointerUp={() => m.pointerUp()}
        >
            <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    <div onClick={() => m.toggleTool('rect')} class={tileClass(m.activeTool() === 'rect')}>
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniRect())} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Rect</text>
                        </svg>
                    </div>
                    <div onClick={() => m.toggleTool('button')} class={tileClass(m.activeTool() === 'button')}>
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniButton())} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Button</text>
                        </svg>
                    </div>
                </div>
            </aside>

            <svg
                ref={canvasRef}
                class={`h-full w-full block bg-gray-100 ${m.activeTool() ? 'cursor-crosshair' : ''}`}
                onPointerDown={(e) => { const p = toLocal(e); if (p) m.canvasPointerDown(p); }}
            >
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                <For each={m.widgets}>{(w) => {
                    switch (w.tag) {
                        case 'rect':
                            return (
                                <g
                                    transform={`translate(${w.x}, ${w.y})`}
                                    class="cursor-move"
                                    onPointerDown={(e) => {
                                        if (m.mode().tag === 'idle') {
                                            e.stopPropagation();
                                            m.widgetPointerDown(w.id);
                                        }
                                    }}
                                >
                                    <path d={getRectPath(w.w, w.h)} fill="white" fill-opacity={0.5} stroke={strokeColor} stroke-width="2.5" />
                                </g>
                            );
                        case 'button':
                            return (
                                <g transform={`translate(${w.x}, ${w.y})`}>
                                    <path d={getButtonPath(w.w, w.h)} fill="none" stroke={strokeColor} stroke-width="2.5" />
                                    <text x={w.w / 2} y={w.h / 2 + 10} text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="select-none text-2xl fill-gray-800 font-bold">Button</text>
                                </g>
                            );
                        default: return assertNever(w);
                    }
                }}</For>

                {(() => {
                    const mm = m.mode();
                    if (mm.tag !== 'drawing') return null;
                    const x = Math.min(mm.start.x, mm.current.x);
                    const y = Math.min(mm.start.y, mm.current.y);
                    const w = Math.abs(mm.start.x - mm.current.x);
                    const h = Math.abs(mm.start.y - mm.current.y);
                    return (
                        <path
                            d={getRectPath(w, h)}
                            transform={`translate(${x}, ${y})`}
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
