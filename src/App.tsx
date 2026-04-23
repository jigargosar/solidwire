import { For, onCleanup } from "solid-js";
import rough from "roughjs";
import { toPath } from "./utils";
import {
    getActiveTool,
    getWidgets,
    getInteraction,
    toggleTool,
    startDrawing,
    updateDrawing,
    finishDrawing,
    stampButton,
    startDrag,
    updateDrag,
    stopInteraction
} from "./model";

const generator = rough.generator();
const strokeColor = "#374151";
let canvasRef: SVGSVGElement | undefined;

// --- Helpers ---
const getCursor = (e: MouseEvent | PointerEvent, svg: SVGSVGElement) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()?.inverse());
};

const getRectPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }));

const getButtonPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.5, stroke: strokeColor, strokeWidth: 2 }));

// Precomputed mini shapes (no reactivity needed)
const miniRect = generator.rectangle(10, 5, 60, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 });
const miniButton = generator.rectangle(5, 5, 70, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 });

// --- Handlers ---
const onPointerDown = (e: PointerEvent) => {
    if (!canvasRef) return;
    const cursor = getCursor(e, canvasRef);
    const tool = getActiveTool();

    if (tool === "rect") startDrawing(cursor);
    else if (tool === "button") stampButton(cursor);
};

const onPointerMove = (e: PointerEvent) => {
    if (!canvasRef) return;
    const cursor = getCursor(e, canvasRef);
    const i = getInteraction();

    if (i.kind === "dragging") updateDrag(cursor);
    if (i.kind === "drawing") updateDrawing(cursor);
};

const onPointerUp = () => {
    const i = getInteraction();
    if (i.kind === "drawing") finishDrawing();
    stopInteraction();
};

// --- Component ---
export default function App() {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") toggleTool("");
    };
    window.addEventListener("keydown", handleKey);
    onCleanup(() => window.removeEventListener("keydown", handleKey));

    return (
        <main
            class="relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            {/* Sidebar */}
            <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    <div
                        onClick={() => toggleTool("rect")}
                        class={`group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${
                            getActiveTool() === "rect"
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-300 bg-gray-50 hover:border-blue-500"
                        }`}
                    >
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniRect)} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Rect</text>
                        </svg>
                    </div>

                    <div
                        onClick={() => toggleTool("button")}
                        class={`group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${
                            getActiveTool() === "button"
                                ? "border-blue-600 bg-blue-50"
                                : "border-gray-300 bg-gray-50 hover:border-blue-500"
                        }`}
                    >
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniButton)} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Button</text>
                        </svg>
                    </div>
                </div>
            </aside>

            {/* Canvas */}
            <svg
                ref={canvasRef}
                class={`h-full w-full block bg-gray-100 ${getActiveTool() ? "cursor-crosshair" : ""}`}
                onPointerDown={onPointerDown}
            >
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                <For each={getWidgets()}>
                    {(w) => (
                        <g
                            transform={`translate(${w.x}, ${w.y})`}
                            class={w.type === "rect" ? "cursor-move" : ""}
                            onPointerDown={(e) => {
                                if (w.type === "rect" && !getActiveTool()) {
                                    e.stopPropagation();
                                    startDrag(w.id);
                                }
                            }}
                        >
                            <path
                                d={w.type === "rect" ? getRectPath(w.w, w.h) : getButtonPath(w.w, w.h)}
                                fill={w.type === "rect" ? "white" : "none"}
                                fill-opacity={w.type === "rect" ? 0.5 : 1}
                                stroke={strokeColor}
                                stroke-width="2.5"
                            />
                            {w.type === "button" && (
                                <text
                                    x={w.w / 2}
                                    y={w.h / 2 + 10}
                                    text-anchor="middle"
                                    style={{ "font-family": "'Kalam', cursive" }}
                                    class="select-none text-2xl fill-gray-800 font-bold"
                                >
                                    Button
                                </text>
                            )}
                        </g>
                    )}
                </For>

                {/* Preview rect while drawing */}
                {(() => {
                    const i = getInteraction();
                    if (i.kind === "drawing") {
                        const w = Math.abs(i.start.x - i.current.x);
                        const h = Math.abs(i.start.y - i.current.y);
                        return (
                            <path
                                d={getRectPath(w, h)}
                                transform={`translate(${Math.min(i.start.x, i.current.x)}, ${Math.min(i.start.y, i.current.y)})`}
                                fill="none"
                                stroke={strokeColor}
                                stroke-dasharray="5,5"
                            />
                        );
                    }
                })()}
            </svg>
        </main>
    );
}
