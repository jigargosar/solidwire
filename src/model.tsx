// Geometry primitives
export type Point = { x: number; y: number };
export type Dimension = { w: number; h: number };
export type Box = { pos: Point; size: Dimension };

// Internal base
type WidgetId = string; // UUID only
type WidgetBase = { id: WidgetId; kind: string };

// Rect
type RectWidget = WidgetBase & { kind: "rect"; box: Box };
export type RectVM = { kind: "rect"; id: WidgetId; box: Box };

function rectToVM(w: RectWidget): RectVM {
    return {kind: "rect", id: w.id, box: w.box};
}

// Btn
type ButtonWidget = WidgetBase & { kind: "button"; box: Box };
export type ButtonVM = { kind: "button"; id: WidgetId; box: Box };

function buttonToVM(w: ButtonWidget): ButtonVM {
    return {kind: "button", id: w.id, box: w.box};
}

// Union Types

type Widget = RectWidget | ButtonWidget;

export type WidgetVM = RectVM | ButtonVM;


// state

type Model = { widgets: Widget[] }

const state: Model = {widgets: []}


export const widgetVMs: WidgetVM[] = toVM(state.widgets)

function toVM(ws: Widget[]): WidgetVM[] {
    return ws.map(w => {
        switch (w.kind) {
            case "rect":
                return rectToVM(w);
            case "button":
                return buttonToVM(w);
        }
    });
}
