# Model leaks

Places where view reads model internals or makes decisions the model should make. Each leak has a resolution under the agreed architecture (see `decisions.md`).

## 1. Mode-tag inspection in view

**Where:** `App.tsx` — `cursorClass` (line 29), `onDragStart` guard (line 140), `cursor-crosshair` class (line 179).

**Wrong:** view branches on `mode().tag` and `activeTool()` to decide cursor and whether to forward events. View shouldn't know `'idle'` exists.

**Resolve:** model exposes a derived `cursor()` accessor. View reads it as a string.

## 2. Coordinate extraction split across view and model

**Where:** `toLocal` (lines 121–130) plus `if (!p) return` guards in every handler call site.

**Wrong:** view does half the work (CTM math) then leaves a null-guard dance at every call site. Model handlers don't know if the point is real.

**Resolve:** view always sends viewport-relative coordinates inside a pojo intent. No null at the boundary. Camera module converts.

## 3. `stopPropagation` in view drag handler

**Where:** `onDragStart` (line 143).

**Wrong:** event-bubble policy is a view concern leaking into the model's call site. Will tangle with shift-click multi-select later.

**Resolve:** single SVG-root handler. No bubbling, no `stopPropagation` calls anywhere.

## 4. `widgetBounds` called in view for selection bbox

**Where:** `App.tsx` line 213.

**Wrong:** selection bounding box is a derivation of selection + widget data. Model should expose it.

**Resolve:** model exposes `selectionBounds()`. View renders the rect from it. Generalizes to multi-select for free.

## 5. Widget→component switch in view

**Where:** `App.tsx` lines 192–200, `switch(w.tag)` mapping each widget tag to a component.

**Wrong:** adding a widget tag forces a view edit. The mapping is data, not control flow.

**Resolve:** render-registry keyed by `Widget['tag']` provides the component per tag. View uses `<Dynamic>`.

## 6. Keyboard handler table in view

**Where:** `App.tsx` lines 132–137 — `Escape → cancel`, `Delete/Backspace → deleteSelected`.

**Wrong:** view decides what keys mean. Same shape as pointer handling, which already lives in the model.

**Resolve:** keyboard pojos dispatched through the same intent path as pointer pojos. Model owns the binding.

## 7. Mini-preview geometry duplicated alongside per-widget rough memos

**Where:** `App.tsx` lines 116–119 (`miniRect`, `miniButton`) plus per-widget `roughRect` memos in each `*Widget` component.

**Wrong:** rough geometry knowledge is spread across the toolbar code and each widget component. No single owner per widget.

**Resolve:** per-widget rough geometry stays inside the widget component (memo over dimensions). Toolbar preview moves into that widget's render-registry entry. One source per widget.

## Roadmap blockers these leaks cause

1. **Undo/redo** needs one mutation chokepoint. Today mutations are spread across ~6 handlers and the view's call sites.
2. **Pan/zoom** breaks `toLocal` — it assumes no viewport transform. Camera module fixes this.
3. **Multi-select** breaks `selectedId: WidgetId | null`. Selection-as-set + `selectionBounds` resolves leak 4 and prepares this.
4. **Resize** needs a hit-test that returns sub-widget targets (handles). Single-handler + model-side hit-test resolves leak 2 and prepares this.
5. **Group/ungroup** needs widgets-as-tree. Touches data-registry, not view.
6. **More tools/widgets** today needs edits in 8 places. Two registries reduce this to 1 + 1 (data + render).
