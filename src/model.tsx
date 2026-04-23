// model.ts
import { createSignal } from "solid-js";

// --- Types ---
export type ToolKind = "rect" | "button";

export type Interaction =
    | { kind: "idle" }
    | { kind: "drawing"; start: Point; current: Point }
    | { kind: "dragging"; id: string; current: Point };

export type Point = { x: number; y: number };

export type Widget =
    | { type: "rect"; id: string; x: number; y: number; w: number; h: number }
    | { type: "button"; id: string; x: number; y: number; w: number; h: number };

// --- Signals ---
const [activeTool, setActiveTool] = createSignal<ToolKind | "">("");
const [widgets, setWidgets] = createSignal<Widget[]>([]);
const [interaction, setInteraction] = createSignal<Interaction>({ kind: "idle" });

// --- Accessors ---
export const getActiveTool = activeTool;
export const getWidgets = widgets;
export const getInteraction = interaction;

// --- Actions ---
export function toggleTool(tool: ToolKind | "") {
    setActiveTool(tool);
}

export function startDrawing(start: Point) {
    setInteraction({ kind: "drawing", start, current: start });
}

export function updateDrawing(current: Point) {
    const i = interaction();
    if (i.kind === "drawing") {
        setInteraction({ ...i, current });
    }
}

export function finishDrawing() {
    const i = interaction();
    if (i.kind === "drawing") {
        const w = Math.abs(i.current.x - i.start.x);
        const h = Math.abs(i.current.y - i.start.y);
        const x = Math.min(i.start.x, i.current.x);
        const y = Math.min(i.start.y, i.current.y);
        setWidgets([...widgets(), { type: "rect", id: crypto.randomUUID(), x, y, w, h }]);
    }
}

export function stampButton(cursor: Point) {
    setWidgets([...widgets(), { type: "button", id: crypto.randomUUID(), x: cursor.x, y: cursor.y, w: 80, h: 40 }]);
}

export function startDrag(id: string) {
    setInteraction({ kind: "dragging", id, current: { x: 0, y: 0 } });
}

export function updateDrag(cursor: Point) {
    const i = interaction();
    if (i.kind === "dragging") {
        setInteraction({ ...i, current: cursor });
        // TODO: update widget position here
    }
}

export function stopInteraction() {
    setInteraction({ kind: "idle" });
}
