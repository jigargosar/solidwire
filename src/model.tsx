import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

// --- Types ---
export type Point = { x: number; y: number };

export type Widget =
    | { id: number; type: "rect"; x: number; y: number; w: number; h: number }
    | { id: number; type: "button"; x: number; y: number; w: number; h: number };

export type Interaction =
    | { kind: "idle" }
    | { kind: "drawing"; start: Point; current: Point }
    | { kind: "dragging"; id: number }
    | { kind: "placing" };

// --- Store ---
const [activeTool, setActiveTool] = createSignal<string | null>(null);
const [widgets, setWidgets] = createStore<Widget[]>([
    { id: 1, type: "rect", x: 300, y: 100, w: 200, h: 150 },
    { id: 2, type: "button", x: 600, y: 300, w: 240, h: 80 }
]);
const [interaction, setInteraction] = createSignal<Interaction>({ kind: "idle" });

// --- Getters ---
export const getActiveTool = () => activeTool();
export const getWidgets = () => widgets;
export const getInteraction = () => interaction();

// --- Actions ---
export function toggleTool(tool: string) {
    setActiveTool((cur) => (cur === tool ? null : tool));
}

export function startDrawing(p: Point) {
    setInteraction({ kind: "drawing", start: p, current: p });
}

export function updateDrawing(p: Point) {
    const i = interaction();
    if (i.kind === "drawing") {
        setInteraction({ kind: "drawing", start: i.start, current: p });
    }
}

export function finishDrawing() {
    const i = interaction();
    if (i.kind === "drawing") {
        const x = Math.min(i.start.x, i.current.x);
        const y = Math.min(i.start.y, i.current.y);
        const w = Math.abs(i.start.x - i.current.x);
        const h = Math.abs(i.start.y - i.current.y);
        if (w > 5 && h > 5) {
            setWidgets([...widgets, { id: Date.now(), type: "rect", x, y, w, h }]);
        }
    }
    setInteraction({ kind: "idle" });
}

export function stampButton(p: Point) {
    setWidgets([
        ...widgets,
        { id: Date.now(), type: "button", x: p.x - 120, y: p.y - 40, w: 240, h: 80 }
    ]);
}

export function startDrag(id: number) {
    setInteraction({ kind: "dragging", id });
}

export function updateDrag(p: Point) {
    const i = interaction();
    if (i.kind === "dragging") {
        const w = widgets.find((w) => w.id === i.id);
        if (w && w.type === "rect") {
            setWidgets(
                (w2) => w2.id === i.id,
                { x: p.x - w.w / 2, y: p.y - w.h / 2 }
            );
        }
    }
}

export function stopInteraction() {
    setInteraction({ kind: "idle" });
}
