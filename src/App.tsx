import { createMemo, createSignal, For, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import rough from "roughjs";
import { toPath } from "./utils";

export default function App() {
    const generator = rough.generator();
    const strokeColor = '#374151';

    let canvasRef: SVGSVGElement | undefined;

    const [activeTool, setActiveTool] = createSignal<string | null>(null);
    const [widgets, setWidgets] = createStore([
        { id: 1, type: 'rect', x: 300, y: 100, w: 200, h: 150 },
        { id: 2, type: 'button', x: 600, y: 300, w: 240, h: 80 }
    ]);

    const [draggingId, setDraggingId] = createSignal<number | null>(null);
    const [drawingStart, setDrawingStart] = createSignal<{ x: number, y: number } | null>(null);
    const [currentMouse, setCurrentMouse] = createSignal<{ x: number, y: number } | null>(null);

    // --- DRAWABLES ---
    const getRectPath = (w: number, h: number) =>
        toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }));

    const getButtonPath = (w: number, h: number) =>
        toPath(generator.rectangle(0, 0, w, h, { roughness: 1.5, stroke: strokeColor, strokeWidth: 2 }));

    const miniRect = createMemo(() =>
        generator.rectangle(10, 5, 60, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 })
    );

    const miniButton = createMemo(() =>
        generator.rectangle(5, 5, 70, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 })
    );

    // --- UTILS ---
    const getCursor = (e: MouseEvent | PointerEvent, svg: SVGSVGElement) => {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(svg.getScreenCTM()?.inverse());
    };

    // --- HANDLERS ---
    const onPointerDown = (e: PointerEvent) => {
        const tool = activeTool();
        if (!canvasRef) return;
        const cursor = getCursor(e, canvasRef);

        if (tool === 'rect') {
            setDrawingStart({ x: cursor.x, y: cursor.y });
            setCurrentMouse({ x: cursor.x, y: cursor.y });
        } else if (tool === 'button') {
            setWidgets([...widgets, { id: Date.now(), type: 'button', x: cursor.x - 120, y: cursor.y - 40, w: 240, h: 80 }]);
        }
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!canvasRef) return;
        const cursor = getCursor(e, canvasRef);
        
        // Handle Dragging
        const dId = draggingId();
        if (dId !== null) {
            const widget = widgets.find(w => w.id === dId);
            if (widget && widget.type === 'rect') {
                setWidgets(w => w.id === dId, { x: cursor.x - widget.w / 2, y: cursor.y - widget.h / 2 });
            }
        }

        // Handle Drawing
        if (drawingStart()) {
            setCurrentMouse({ x: cursor.x, y: cursor.y });
        }
    };

    const onPointerUp = () => {
        const start = drawingStart();
        const end = currentMouse();
        
        if (start && end && activeTool() === 'rect') {
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(start.x - end.x);
            const h = Math.abs(start.y - end.y);
            
            if (w > 5 && h > 5) {
                setWidgets([...widgets, { id: Date.now(), type: 'rect', x, y, w, h }]);
            }
        }

        setDrawingStart(null);
        setCurrentMouse(null);
        setDraggingId(null);
    };

    const toggleTool = (tool: string) => {
        setActiveTool(current => current === tool ? null : tool);
    };

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setActiveTool(null);
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => window.removeEventListener('keydown', handleKey));

    return (
        <main 
            class="relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* SIDEBAR */}
            <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    {/* Rect Drawing Tool */}
                    <div 
                        onClick={() => toggleTool('rect')}
                        class={`group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${activeTool() === 'rect' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-500'}`}
                    >
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniRect())} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Rect</text>
                        </svg>
                    </div>

                    {/* Button Stamping Tool */}
                    <div 
                        onClick={() => toggleTool('button')}
                        class={`group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${activeTool() === 'button' ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-500'}`}
                    >
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniButton())} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Button</text>
                        </svg>
                    </div>
                </div>
            </aside>

            {/* CANVAS */}
            <svg 
                ref={canvasRef}
                class={`h-full w-full block bg-gray-100 ${activeTool() ? 'cursor-crosshair' : ''}`}
                onPointerDown={onPointerDown}
            >
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                {/* Drawn Widgets */}
                <For each={widgets}>{(w) => (
                    <g 
                        transform={`translate(${w.x}, ${w.y})`} 
                        class={w.type === 'rect' ? 'cursor-move' : ''}
                        onPointerDown={(e) => {
                            if (w.type === 'rect' && !activeTool()) {
                                e.stopPropagation();
                                setDraggingId(w.id);
                            }
                        }}
                    >
                        <path 
                            d={w.type === 'rect' ? getRectPath(w.w, w.h) : getButtonPath(w.w, w.h)} 
                            fill={w.type === 'rect' ? 'white' : 'none'} 
                            fill-opacity={w.type === 'rect' ? 0.5 : 1}
                            stroke={strokeColor} 
                            stroke-width="2.5" 
                        />
                        {w.type === 'button' && (
                            <text x={w.w / 2} y={w.h / 2 + 10} text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="select-none text-2xl fill-gray-800 font-bold">Button</text>
                        )}
                    </g>
                )}</For>

                {/* Drawing Preview */}
                {drawingStart() && currentMouse() && (
                    <path 
                        d={getRectPath(
                            Math.abs(drawingStart()!.x - currentMouse()!.x),
                            Math.abs(drawingStart()!.y - currentMouse()!.y)
                        )}
                        transform={`translate(${Math.min(drawingStart()!.x, currentMouse()!.x)}, ${Math.min(drawingStart()!.y, currentMouse()!.y)})`}
                        fill="none"
                        stroke={strokeColor}
                        stroke-dasharray="5,5"
                    />
                )}
            </svg>
        </main>
    );
}
