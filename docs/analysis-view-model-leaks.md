# Diagnosis

You're right — the split is leaking. Let me name the leaks first, then propose where the seams should actually be.

## 1. Concrete leaks in `App.tsx`

1. **Mode-tag inspection in the view.** `cursorClass` (line 29), `onDragStart` guard (line 140), and the `m.activeTool() ? 'cursor-crosshair'` (line 179) all read `mode.tag` or derive UI affordances from it. The view shouldn't know `'idle'` exists.
2. **Coordinate extraction is half here, half there.** `toLocal` (121–130) is view code (it needs the SVG element), but every handler then guards `if (!p) return` and decides whether to call the model. The model never sees the raw event; the view never sees a clean intent.
3. **`stopPropagation` inside `onDragStart` (143).** Event-bubble policy is leaking into the model's call site. If you later add multi-select with shift-click, this gets tangled.
4. **`widgetBounds(w())` called in the view (213).** Selection bounds is a derivation — the model already has `selectedWidget`; it should also expose `selectionBounds`.
5. **The big `switch (w.tag)` at 192–200.** Adding a widget = touching the view. The widget→component mapping is data, not control flow.
6. **Keyboard handling (132–137).** The view decides `Escape → cancel`, `Delete → deleteSelected`. That's an input-binding table, not view logic, and it's the same shape as pointer handling (which lives in the model).
7. **Mini-preview geometry duplicated.** `miniRect`/`miniButton` (116–119) plus the per-widget `roughRect` memos all know rough.js details. There's no "renderer" boundary.

## 2. Why these leaks block your roadmap

1. **Undo/redo** needs a single chokepoint where state mutates. Right now mutations happen inside ~6 handlers in `model.ts`, and the view also mutates indirectly by calling them with raw points. You need a *command* layer (or a reducer) so every change is a serializable value you can push onto a stack.
2. **Pan/zoom** changes the meaning of "local coordinates". Today `toLocal` uses `getScreenCTM`, which works only because there's no viewport transform. Add zoom, and every handler needs to compose viewport ↔ world. That should be one function the view owns, returning *world* points to the model.
3. **Multi-select** explodes the `selectedId: WidgetId | null` model. You need `selection: Set<WidgetId>` plus a `Selection` concept with bounds, hit-testing, and group operations. The view's `selectedWidget()` shape won't survive.
4. **Resize** introduces handles — new hit-targets that aren't widgets. The current `widgetPointerDown` vs `canvasPointerDown` dichotomy can't express "pointer down on the SE resize handle of widget X". You need a hit-test step that returns a *target* (`{kind:'widget',id} | {kind:'handle',id,corner} | {kind:'canvas'}`), and the model dispatches on that.
5. **Group/ungroup** means widgets need a parent. `Widget[]` becomes a tree (or flat + `parentId`). Every traversal in the view that assumes a flat list breaks.
6. **More tools/widgets** today require edits in: `Tool` union, `Widget` union, `widgetBounds`, `canvasPointerDown` switch, `pointerUp` switch, the `tools` array in App, the `switch(w.tag)` in App, plus a new `XWidget` component. That's 8 places. It should be 1 (a registry) + 1 (a component).

## 3. Where the seams actually belong

I'd carve the architecture into four layers, with strict directional dependencies:

```
  view (App.tsx)            ← only knows: DOM, SVG, components, keybinding table
       │ dispatches Intents
       ▼
  intents / commands        ← serializable values: PointerDown{target,worldPt}, KeyPress{...}
       │
       ▼
  model (state machine)     ← owns Mode, Selection, Widgets; produces derivations
       │ reads from
       ▼
  registry (widget kinds)   ← per-tag: bounds, hitTest, render, defaults, toolbar preview
```

### 3.1 Intent boundary (fixes leaks 1–3, 6)

Replace the seven model handlers with one:

```ts
type Target =
  | { tag: 'canvas' }
  | { tag: 'widget'; id: WidgetId }
  | { tag: 'handle'; id: WidgetId; corner: 'nw'|'ne'|'sw'|'se' }

type Intent =
  | { tag: 'pointerDown'; target: Target; world: Point; mods: Mods }
  | { tag: 'pointerMove'; world: Point }
  | { tag: 'pointerUp'; world: Point }
  | { tag: 'key'; key: string; mods: Mods }
  | { tag: 'toolbar'; tool: Tool }

m.dispatch(intent)
```

The view's job becomes: hit-test → build `Intent` → dispatch. No `mode().tag` reads. No `if (!p) return` after the call. `stopPropagation` is decided by the model returning a "consumed" flag, or by the view always stopping (since intents are always meaningful).

This is also the **undo seam** — intents that mutate become commands you can record/replay/invert.

### 3.2 Selection as a first-class concept (fixes leak 4, prepares multi-select)

```ts
// in model
selection: Accessor<ReadonlySet<WidgetId>>
selectionBounds: Accessor<Bounds | null>   // union of bounds, or null
selectedWidgets: Accessor<readonly Widget[]>
```

The view renders the bounding box from `selectionBounds()` — it never calls `widgetBounds` itself. Single-select today is just "set of size 1"; multi-select is the same code path.

### 3.3 Widget registry (fixes leak 5, the 8-place problem)

```ts
// widgets/registry.ts
type WidgetKind<T extends Widget> = {
  tag: T['tag']
  bounds: (w: T) => Bounds
  hitTest: (w: T, p: Point) => boolean
  render: Component<{ w: T; selected: boolean }>
  toolbar: { label: string; preview: JSX.Element; placement: 'click' | 'drag' }
  create: (start: Point, end: Point) => T   // for drag-to-draw
  place?: (p: Point) => T                   // for click-to-place
}

const registry: { [K in Widget['tag']]: WidgetKind<Extract<Widget,{tag:K}>> } = { ... }
```

Adding a new widget = one file. The model's `pointerUp` becomes `registry[mode.kind].create(start, end)`. The view's `<For>` becomes `<Dynamic component={registry[w.tag].render} ...>`. The toolbar reads from the registry.

This also kills `widgetBounds`'s switch — it's `registry[w.tag].bounds(w)`.

### 3.4 Viewport / coordinates (prepares pan/zoom)

```ts
// in view
type Viewport = { tx: number; ty: number; scale: number }
const [viewport, setViewport] = createSignal<Viewport>(...)
const toWorld = (clientPt) => /* compose viewport with getScreenCTM */
```

The model only ever sees world coordinates. Pan/zoom becomes view-only state plus an SVG `<g transform>`. The model is unaware.

Hit-testing happens in the view too (it has the geometry), and produces a `Target` for the intent. Use `document.elementFromPoint` or per-widget `pointerEvents` + dataset attributes — either works.

### 3.5 Commands and undo

Once intents drive everything, split intents into two kinds:

1. **Queries** (pointer move during drawing) — update transient `Mode`, no history.
2. **Commands** (commit a draw, delete, drag-end) — produce a `Command` value that's pushed to an undo stack. Each command has `apply(state)` and `invert(state)` (or you snapshot `widgets` before/after — simpler, fine for this scale).

A reasonable rule: history entries are produced only on `pointerUp` and on discrete actions (delete, paste). Drag/draw mid-flight is `Mode`, not history.

## 4. Recommended sequence

I'd land these in this order — each step is shippable and unblocks the next:

1. **★ Widget registry** (lowest risk, biggest leverage). Pure refactor; behavior identical. Removes 4 of the 8 places-to-edit-per-widget. Unblocks "more widgets".
2. **Selection as a set + `selectionBounds` memo**. Removes `widgetBounds` from the view. Prepares multi-select.
3. **`Target` + single `dispatch(intent)`**. Collapses the seven handlers; view stops reading `mode().tag`. This is the architectural turning point — after this, all features land cleanly.
4. **Undo/redo** as a command stack on top of the intent layer.
5. **Viewport** (pan/zoom) — view-only, model unaware.
6. **Resize handles** — new `Target` variant + new `Mode` variant (`resizing`). Trivial after step 3.
7. **Groups** — `parentId` on widgets, registry handles traversal, selection promotes to group on click.

## 5. Speculation flag

I haven't measured whether `dispatch(intent)` with a tagged union has any perceivable cost vs. direct method calls in SolidJS — I'd expect none, but I haven't profiled. Also, the registry approach assumes you're OK with widgets being plain data + external behavior tables (vs. classes/closures). For this codebase it fits, but it's a style choice.

---

Want me to sketch step 1 (the registry) as a concrete diff against the current code, so you can see the shape before committing to the full sequence?
