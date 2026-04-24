import {createMemo, createSignal} from "solid-js";
import {createStore} from "solid-js/store";

export function assertNever(_: never): never {
    throw new Error('unreachable');
}

// --- TYPES ---
export type Point = { x: number; y: number };

export type Widget =
    | { tag: 'rect'; id: number; x: number; y: number; w: number; h: number }
    | { tag: 'button'; id: number; x: number; y: number; w: number; h: number }
    | { tag: 'text'; id: number; x: number; y: number; content: string }
    | { tag: 'annotation'; id: number; x: number; y: number; w: number; h: number; text: string };

export type Tool = 'rect' | 'button' | 'text' | 'annotation';
export type DrawKind = 'rect' | 'annotation';

export type Mode =
    | { tag: 'idle' }
    | { tag: 'armed'; tool: Tool }
    | { tag: 'drawing'; kind: DrawKind; start: Point; current: Point }
    | { tag: 'dragging'; id: number; offset: Point };

// --- MODEL ---
export function createModel() {
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
                return m.kind;
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
                setMode({tag: 'drawing', kind: 'rect', start: p, current: p});
                return;
            case 'annotation':
                setMode({tag: 'drawing', kind: 'annotation', start: p, current: p});
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
                setMode({tag: 'drawing', kind: m.kind, start: m.start, current: p});
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
                    const id = Date.now();
                    if (m.kind === 'rect') {
                        setWidgets(ws => [...ws, {tag: 'rect', id, ...r}]);
                    } else {
                        setWidgets(ws => [...ws, {tag: 'annotation', id, ...r, text: 'Note. Type more to see wrap.'}]);
                    }
                }
                setMode({tag: 'armed', tool: m.kind});
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
