// Geometry primitives
export type Point = { x: number; y: number };
export type Dimension = { w: number; h: number };
export type Box = { pos: Point; size: Dimension };

// Internal base
type WidgetId = string; // UUID only
type WidgetBase = { id: WidgetId; kind: string };

// Internal specifics
type RectWidget = WidgetBase & { kind: "rect"; box: Box };
type ButtonWidget = WidgetBase & { kind: "button"; box: Box };

// Union (internal)
type Widget = RectWidget | ButtonWidget;

// --- VM types (exposed) ---
export type RectVM = { kind: "rect"; id: WidgetId; box: Box };
export type ButtonVM = { kind: "button"; id: WidgetId; box: Box };
export type WidgetVM = RectVM | ButtonVM;

// --- VM constructors ---
function rectToVM(w: RectWidget): RectVM {
    return { kind: "rect", id: w.id, box: w.box };
}

function buttonToVM(w: ButtonWidget): ButtonVM {
    return { kind: "button", id: w.id, box: w.box };
}

// --- Delegating projection ---
export function toVM(ws: Widget[]): WidgetVM[] {
    return ws.map(w => {
        switch (w.kind) {
            case "rect": return rectToVM(w);
            case "button": return buttonToVM(w);
        }
    });
}
