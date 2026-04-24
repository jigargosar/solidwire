import {describe, expect, test} from "vitest";
import {createRoot} from "solid-js";
import {createModel, widgetBounds, type Widget} from "./model";

function withModel<T>(fn: (m: ReturnType<typeof createModel>) => T): T {
    return createRoot((dispose) => {
        const m = createModel();
        try {
            return fn(m);
        } finally {
            dispose();
        }
    });
}

function invariant(m: ReturnType<typeof createModel>) {
    const sel = m.selectedWidget();
    if (sel === null) return;
    const exists = m.widgets.some((w: Widget) => w.id === sel.id);
    expect(exists, 'selectedWidget must reference an existing widget').toBe(true);
}

describe('initial state', () => {
    test('starts idle with two seed widgets, no selection', () => {
        withModel((m) => {
            expect(m.mode().tag).toBe('idle');
            expect(m.widgets.length).toBe(2);
            expect(m.selectedWidget()).toBe(null);
            expect(m.activeTool()).toBe(null);
            invariant(m);
        });
    });
});

describe('tool arming', () => {
    test('toggleTool arms and disarms', () => {
        withModel((m) => {
            m.toggleTool('rect');
            expect(m.activeTool()).toBe('rect');
            m.toggleTool('rect');
            expect(m.activeTool()).toBe(null);
        });
    });

    test('toggleTool switches to different tool', () => {
        withModel((m) => {
            m.toggleTool('rect');
            m.toggleTool('button');
            expect(m.activeTool()).toBe('button');
        });
    });
});

describe('stamping', () => {
    test('button tool + canvasPointerDown stamps a button widget', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.toggleTool('button');
            m.canvasPointerDown({x: 100, y: 100});
            expect(m.widgets.length).toBe(n + 1);
            expect(m.widgets[n].tag).toBe('button');
            expect(m.mode().tag).toBe('armed');
            invariant(m);
        });
    });

    test('text tool + canvasPointerDown stamps a text widget', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.toggleTool('text');
            m.canvasPointerDown({x: 50, y: 50});
            expect(m.widgets.length).toBe(n + 1);
            expect(m.widgets[n].tag).toBe('text');
            invariant(m);
        });
    });
});

describe('drawing', () => {
    test('rect draw: armed -> drawing -> widget added -> back to armed', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.toggleTool('rect');
            m.canvasPointerDown({x: 10, y: 10});
            expect(m.mode().tag).toBe('drawing');
            m.pointerMove({x: 100, y: 80});
            m.pointerUp();
            expect(m.widgets.length).toBe(n + 1);
            expect(m.widgets[n].tag).toBe('rect');
            const mode = m.mode();
            expect(mode.tag).toBe('armed');
            if (mode.tag === 'armed') expect(mode.tool).toBe('rect');
            invariant(m);
        });
    });

    test('too-small draw adds no widget', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.toggleTool('rect');
            m.canvasPointerDown({x: 10, y: 10});
            m.pointerMove({x: 12, y: 12});
            m.pointerUp();
            expect(m.widgets.length).toBe(n);
            invariant(m);
        });
    });

    test('annotation draw adds annotation widget', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.toggleTool('annotation');
            m.canvasPointerDown({x: 0, y: 0});
            m.pointerMove({x: 100, y: 100});
            m.pointerUp();
            expect(m.widgets[n].tag).toBe('annotation');
            invariant(m);
        });
    });
});

describe('selection and drag', () => {
    test('widgetPointerDown in idle selects and enters dragging', () => {
        withModel((m) => {
            const target = m.widgets[0];
            m.widgetPointerDown(target.id, {x: target.x + 10, y: target.y + 10});
            expect(m.selectedWidget()?.id).toBe(target.id);
            expect(m.mode().tag).toBe('dragging');
            invariant(m);
        });
    });

    test('widgetPointerDown while armed is a no-op', () => {
        withModel((m) => {
            m.toggleTool('rect');
            const target = m.widgets[0];
            m.widgetPointerDown(target.id, {x: 0, y: 0});
            expect(m.selectedWidget()).toBe(null);
            expect(m.mode().tag).toBe('armed');
        });
    });

    test('pointerMove while dragging moves widget; pointerUp ends drag but keeps selection', () => {
        withModel((m) => {
            const target = m.widgets[0];
            const startX = target.x;
            m.widgetPointerDown(target.id, {x: target.x, y: target.y});
            m.pointerMove({x: target.x + 50, y: target.y + 30});
            const moved = m.widgets.find((w) => w.id === target.id);
            expect(moved?.x).toBe(startX + 50);
            m.pointerUp();
            expect(m.mode().tag).toBe('idle');
            expect(m.selectedWidget()?.id).toBe(target.id);
            invariant(m);
        });
    });

    test('canvas click in idle clears selection', () => {
        withModel((m) => {
            const target = m.widgets[0];
            m.widgetPointerDown(target.id, {x: target.x, y: target.y});
            m.pointerUp();
            expect(m.selectedWidget()?.id).toBe(target.id);
            m.canvasPointerDown({x: 2000, y: 2000});
            expect(m.selectedWidget()).toBe(null);
            invariant(m);
        });
    });

    test('cancel clears selection and mode', () => {
        withModel((m) => {
            const target = m.widgets[0];
            m.widgetPointerDown(target.id, {x: target.x, y: target.y});
            m.pointerUp();
            m.toggleTool('rect');
            m.cancel();
            expect(m.mode().tag).toBe('idle');
            expect(m.selectedWidget()).toBe(null);
        });
    });
});

describe('delete', () => {
    test('deleteSelected removes widget and clears selection', () => {
        withModel((m) => {
            const target = m.widgets[0];
            const n = m.widgets.length;
            m.widgetPointerDown(target.id, {x: target.x, y: target.y});
            m.pointerUp();
            m.deleteSelected();
            expect(m.widgets.length).toBe(n - 1);
            expect(m.widgets.some((w) => w.id === target.id)).toBe(false);
            expect(m.selectedWidget()).toBe(null);
            invariant(m);
        });
    });

    test('deleteSelected with no selection is a no-op', () => {
        withModel((m) => {
            const n = m.widgets.length;
            m.deleteSelected();
            expect(m.widgets.length).toBe(n);
        });
    });

    test('deleteSelected during drag is a no-op', () => {
        withModel((m) => {
            const target = m.widgets[0];
            const n = m.widgets.length;
            m.widgetPointerDown(target.id, {x: target.x, y: target.y});
            m.deleteSelected();
            expect(m.widgets.length).toBe(n);
            expect(m.mode().tag).toBe('dragging');
        });
    });
});

describe('widgetBounds', () => {
    test('returns geometry for rect/button/annotation', () => {
        const rect: Widget = {tag: 'rect', id: 'a', x: 10, y: 20, w: 100, h: 50};
        expect(widgetBounds(rect)).toEqual({x: 10, y: 20, w: 100, h: 50});
    });

    test('computes box for text from content length', () => {
        const t: Widget = {tag: 'text', id: 'a', x: 100, y: 100, content: 'Hi'};
        const b = widgetBounds(t);
        expect(b.w).toBeGreaterThan(0);
        expect(b.h).toBeGreaterThan(0);
    });
});
