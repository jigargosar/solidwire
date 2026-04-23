// tools.ts
import { toPath } from "./rough-utils";
import { startDrawing, stampButton, Point, ToolKind } from "./model";
import rough from "roughjs";

const generator = rough.generator();
const strokeColor = "#374151";

// Mini shapes for sidebar previews
const miniRect = generator.rectangle(10, 5, 60, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 });
const miniButton = generator.rectangle(5, 5, 70, 30, { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 });

// Path helpers
const getRectPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }));

const getButtonPath = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.5, stroke: strokeColor, strokeWidth: 2 }));

// Tool definition type
export interface ToolDef {
    type: ToolKind;
    label: string;
    mini: any;
    path: (w: number, h: number) => string;
    stamp: (cursor: Point) => void;
}

// Tool registry
export const tools: ToolDef[] = [
    {
        type: "rect",
        label: "Rect",
        mini: miniRect,
        path: (w, h) => getRectPath(w, h),
        stamp: (cursor) => startDrawing(cursor)
    },
    {
        type: "button",
        label: "Button",
        mini: miniButton,
        path: (w, h) => getButtonPath(w, h),
        stamp: (cursor) => stampButton(cursor)
    }
];
