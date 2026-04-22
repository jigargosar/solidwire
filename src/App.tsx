import { createMemo, createSignal, For } from "solid-js";
import { createStore } from "solid-js/store";
import rough from "roughjs";
import { toPath } from "./utils";

export default function App() {
    const generator = rough.generator();
    const strokeColor = '#374151';

    const [activeTool, setActiveTool] = createSignal<string | null>(null);
    const [widgets, setWidgets] = createStore([
        { id: 1, type: 'rect', x: 300, y: 100 },
        { id: 2, type: 'button', x: 600, y: 300 }
    ]);

    const [draggingId, setDraggingId] = createSignal<number | null>(null);

    // --- DRAWABLES (Local to 0,0) ---
    const rectPath = createMemo(() =>
        toPath(generator.rectangle(0, 0, 200, 150, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }))
    );

    const buttonPath = createMemo(() =>
        toPath(generator.rectangle(0, 0, 240, 80, { roughness: 1.5, stroke: strokeColor, strokeWidth: 2 }))
    );

    const miniRect = createMemo(() =>
        generator.rectangle(10, 5, 60, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 })
    );

    const miniButton = createMemo(() =>
        generator.rectangle(5, 5, 70, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 })
    );

    // --- HANDLERS ---
    const onCanvasClick = (e: MouseEvent) => {
        const tool = activeTool();
        if (tool === 'button') {
            const svg = e.currentTarget as SVGSVGElement;
            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            const cursor = pt.matrixTransform(svg.getScreenCTM()?.inverse());
            
            setWidgets([...widgets, { id: Date.now(), type: 'button', x: cursor.x - 120, y: cursor.y - 40 }]);
        }
    };

    const toggleTool = (tool: string) => {
        setActiveTool(current => current === tool ? null : tool);
    };

    // Keyboard cancel
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setActiveTool(null);
    });

    const onPointerMove = (e: PointerEvent) => {
        const id = draggingId();
        if (id !== null) {
            const widget = widgets.find(w => w.id === id);
            if (widget && widget.type === 'rect') {
                const svg = (e.currentTarget as HTMLElement).closest('svg') as SVGSVGElement;
                const pt = svg.createSVGPoint();
                pt.x = e.clientX;
                pt.y = e.clientY;
                const cursor = pt.matrixTransform(svg.getScreenCTM()?.inverse());
                
                setWidgets(w => w.id === id, { x: cursor.x - 100, y: cursor.y - 75 });
            }
        }
    };

    return (
        <main 
            class="relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDraggingId(null)}
        >

            {/* SIDEBAR */}
            <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    {/* Rectangle Mini */}
                    <div class="group aspect-square w-full rounded-lg border border-gray-300 bg-gray-50 p-2 flex flex-col items-center justify-center shadow-sm">
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
                class={`h-full w-full block bg-gray-100 ${activeTool() ? 'cursor-crosshair' : ''}`}
                onClick={onCanvasClick}
            >
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                <For each={widgets}>{(w) => (
                    <g 
                        transform={`translate(${w.x}, ${w.y})`} 
                        class={w.type === 'rect' ? 'cursor-move' : ''}
                        onPointerDown={(e) => {
                            if (w.type === 'rect') {
                                e.stopPropagation();
                                setDraggingId(w.id);
                            }
                        }}
                    >
                        <path 
                            d={w.type === 'rect' ? rectPath() : buttonPath()} 
                            fill={w.type === 'rect' ? 'white' : 'none'} 
                            fill-opacity={w.type === 'rect' ? 0.5 : 1}
                            stroke={strokeColor} 
                            stroke-width="2.5" 
                        />
                        {w.type === 'button' && (
                            <text x="120" y="50" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="select-none text-2xl fill-gray-800 font-bold">Button</text>
                        )}
                    </g>
                )}</For>
            </svg>
        </main>
    );
}
