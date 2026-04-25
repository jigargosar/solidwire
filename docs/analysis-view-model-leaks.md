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

# Round 2 — user pushback

Intent boundary: 
  alternative approach. view just forwards events, onKeyEvent, onPointerEvent etc.
view passes all the information, when how model consumes it is upto the model. 

model has complete information of world space. and view translates and sends world position.
model exposes viewport information, view just uses it window into the world. model owns the camera, into the world.
model returns a derived viewModel, i.e. controlled exposure.
model stores and returns data about widgets, and view renders it.

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

this is mizing data + rendering logic. Either this should be split, or model manages only data, and exposes it, and view renders it via lookup. widgets will need registery, but modes/tools wont exponentially explode so state machine can handle it.

Model needs a different kind of simplification, and we can never write code which guards by if s, but via switch. And it doesnt matter if the switch is 100 lines. as long as its not growing exponentially. 

These are current thoughts, more are spinning in my head but they will depend on our discussion of these points. Express your conscerns, and comeup with mitigation strategies.

# Round 2 — response

## 1. View as a pure event forwarder

> view just forwards `onKeyEvent`, `onPointerEvent`; model owns world/camera; view reads a derived `viewModel`.

### Concerns

1. **Hit-testing needs SVG geometry.** "What's under the pointer?" is answered by `document.elementFromPoint` or per-element `pointerEvents` — both are DOM-only. If the view forwards a raw `PointerEvent`, the model can't hit-test without reaching into the DOM, which breaks testability (model unit tests need a DOM).
2. **Coordinate conversion needs the SVG element.** `getScreenCTM().inverse()` requires `SVGSVGElement`. If the view only forwards client coordinates, the model needs the matrix — fine, but the matrix changes on every resize/scroll, so the view has to push it on every event or the model has to ask for it.
3. **`PointerEvent` is not serializable** and carries 30+ DOM-coupled fields. Forwarding it as-is leaks the DOM into the model surface. You lose the undo/replay property — events aren't reproducible.
4. **`viewModel` shape isn't free.** "Model returns a derived viewModel" sounds clean, but in SolidJS, returning a snapshot object on every change defeats fine-grained reactivity. You'd want it to be a bag of accessors/memos — which is what `createModel` already returns. So "viewModel" is a renaming, not a structural change. Worth doing for clarity, but doesn't shift any leak.

### Mitigations (★ recommended hybrid)

1. **View does the minimum DOM work, then forwards a normalized intent.** Specifically:
   1. Coordinate conversion (client → world via viewport + CTM) — view.
   2. Hit-test (DOM → `Target`) — view.
   3. Everything else (mode, selection, what-it-means) — model.
2. **Model owns the camera as state, view reads it as a memo and applies it as an SVG `transform`.** This matches your "model owns the camera" instinct without forcing the model to do DOM math. The view's `toWorld` becomes `(clientPt) => applyInverse(camera(), clientCTM, clientPt)` — pure function, given camera + CTM.
3. **`Intent` is the serializable boundary, not `Event`.** The view's job: `Event → Intent`. Two-line functions per handler. This preserves your "view just forwards" spirit while keeping the model DOM-free and replayable.

> **Net:** I'd push back on "view forwards raw events." The view should forward *normalized intents* — that's the same architectural commitment with a thinner, testable boundary.

## 2. Camera in the model

### Concerns

1. **Pan/zoom at 60fps mutating model state will trigger model-wide reactivity.** Every memo that closes over `camera()` re-runs on every wheel tick. If `selectionBounds` doesn't depend on camera, fine. But you have to be disciplined that *world-space* derivations don't accidentally read camera.
2. **Undo/redo over camera is usually wrong.** Users don't want Ctrl+Z to undo a pan. So even if camera lives in the model, it must be excluded from the undo stack — meaning you already have two classes of model state (history vs. transient). That's fine, but it argues that camera *could* live in the view without losing anything.

### Mitigation

1. Keep camera in the model **as transient state** (not in the undo stack). Mark transient vs. historical explicitly — e.g., `widgets` and `selection` snapshot into history; `mode` and `camera` don't.
2. Zoom-to-fit, "frame selection," and saved viewports are real features that need camera-in-model. So your instinct is right — just budget for the transient/historical split.

## 3. Registry mixes data + rendering

> "Either this should be split, or model manages only data and exposes it, and view renders it via lookup."

You're right. I conflated two registries. Split them:

```
widgets/data-registry.ts     ← model-side. bounds, hitTest, create, place, defaults
widgets/render-registry.ts   ← view-side.  render component, toolbar preview
```

1. **Model imports only `data-registry`.** No JSX, no Component types — testable in node.
2. **View imports both** (data for hit-test if it does DOM-side hit-testing; render for components).
3. The two registries are keyed by the same `Widget['tag']`. TypeScript can enforce that every tag appears in both via a mapped type:
   ```ts
   type DataRegistry  = { [K in Widget['tag']]: WidgetData<Extract<Widget,{tag:K}>> }
   type RenderRegistry = { [K in Widget['tag']]: WidgetRender<Extract<Widget,{tag:K}>> }
   ```
   Add a new widget tag → both registries must add an entry → compile error elsewhere.

This is strictly better than my original. Adopting.

## 4. "Modes/tools won't explode, so state machine handles it"

I agree, with one caveat.

### Concerns

1. **Modes don't explode in count, but they do explode in cross-product.** `mode × tool × selection-shape × modifier-keys` is where the combinatorics live. A flat `Mode` union handles this cleanly *only if* you resist the urge to encode tool/selection inside `Mode` variants. E.g., `drawing{kind}` is fine; `drawingWithMultiSelectAndShift` is the road to hell.
2. **Some "modes" are really tool behaviors.** `drawing` for `rect` and `annotation` is identical except for what gets committed on `pointerUp`. Today this is handled by carrying `kind` in the mode. That works at 2 draw-tools; at 8, the `pointerUp` switch becomes "look up tool behavior." Which is the registry, again — but only the *behavior*, not rendering.

### Mitigation

1. **Keep `Mode` small and orthogonal.** Variants should describe *interaction shape* (idle, armed, drawing, dragging, resizing, panning, marquee-selecting), not *which tool* is active. Tool identity rides as a field inside the variant.
2. **Tool behavior table** (model-side, separate from data-registry):
   ```ts
   type ToolBehavior = {
     onArmedPointerDown: (p: Point, model) => Mode   // returns next mode
     onDrawingPointerUp: (rect: Bounds, model) => Widget | null
   }
   ```
   This is data, not switch cases. Adding a tool = one entry. **But** this only pays off at ~5+ tools; at 4, the switch is fine. So defer until you feel the pain.

## 5. "No `if` guards — only `switch`"

Strong agreement on the spirit. Two concerns about the absolute form:

### Concerns

1. **Some guards aren't on a discriminated union.** `if (!canvasRef) return` (null check), `if (rect.w > 5 && rect.h > 5)` (threshold), `if (!ctm)` — these aren't switchable; they're predicates over non-union values. Banning `if` here either forces awkward `Option<T>` types or just gets violated.
2. **Switch-on-tag has a known weak spot: nested state.** When you need to dispatch on `mode.tag × intent.tag` (16 cases for 4×4), a flat switch becomes a 200-line table. That's *fine* by your "100 lines is OK" rule, but TS won't help you spot a missing cell unless you build the table as `Record<ModeTag, Record<IntentTag, Handler>>` — which is what reducer libraries do.

### Mitigation

1. **Rule, not absolute:** `if` is banned for *control-flow over discriminated unions*. `if` for null-checks and numeric thresholds is fine — they're not exhaustiveness-bearing.
2. **For `mode × intent`,** build it as a 2D table indexed by tags, with a default `assertNever` per row. TS's `Record<Tag, ...>` enforces row-completeness; per-row `switch(intent.tag)` with `assertNever` enforces column-completeness. This is the "switch can be 100 lines" idea, with structure.

## 6. The bigger concern I'd raise back to you

Your proposals all point one direction: **make the model the universe, make the view a thin projection.** That's a coherent architecture (it's basically Elm/TEA). But it has a real cost:

1. **Every DOM concern that touches state has to round-trip through intents.** Drag-and-drop ergonomics, pointer-capture, focus management, IME composition for text editing — all of these need the view to make decisions *immediately* (e.g., `setPointerCapture` must happen synchronously in the down handler). If the model dispatches asynchronously, you lose these.
2. **SolidJS specifically rewards keeping reactive state close to where it's read.** Pushing everything into one `createModel` blob can hurt fine-grained updates if memos over-subscribe. This is fixable but worth noting.

### Mitigation

1. **Synchronous intent dispatch** — `dispatch(intent)` returns before the handler returns, so `setPointerCapture` etc. still work in the same tick.
2. **Split the model into stores** as it grows: `widgetsStore`, `selectionStore`, `viewportStore`, `historyStore`. They can still be assembled by `createModel` and exposed as one object, but internally each is a separate reactive root. Defer until you see contention.

---

## Summary of where I'd land after your pushback

1. ★ Adopt **split registries** (data-registry model-side, render-registry view-side). Strictly better.
2. ★ Adopt **camera in model**, with explicit transient-vs-historical state classification.
3. **Keep intent boundary**, but reframe it as your "view forwards events" with the view doing only coordinate conversion + hit-testing first. Intents are the normalized shape, not raw events.
4. **Defer tool-behavior table** until 5+ tools. Switch is fine until then.
5. **`switch` over discriminated unions, `if` allowed for non-union predicates** — codify as a rule.
6. **`mode × intent` as a tag-indexed 2D table** when you reach the dispatch. Not yet.

Which of these do you want to push on next? My instinct says the registry split is the cleanest first move because it's a pure refactor and forces you to name the data/render boundary before the harder intent work.

# Round 3 — resolution of the original 7 leaks

Mapping each App.tsx leak from §1 onto the agreed architecture:

| # | Leak | Resolution |
|---|---|---|
| 1 | View reads `mode().tag` (`cursorClass`, drag guard, crosshair) | Model exposes a derived `cursor()` accessor. View reads it, no tag inspection. |
| 2 | `toLocal` + `if (!p) return` split across view/model | View always sends viewport coords as a pojo intent. No null guard at the call site. |
| 3 | `stopPropagation` in `onDragStart` | Single SVG-root handler. No bubbling, no stop calls. |
| 4 | `widgetBounds(w())` in view | Model exposes `selectionBounds()`. View renders it. |
| 5 | `switch(w.tag)` widget→component map in view | Render-registry keyed by `Widget['tag']`. View uses `<Dynamic>`. |
| 6 | Keyboard handler table in view | Keyboard pojos dispatched through the same intent path as pointer pojos. |
| 7 | Mini-preview geometry in view + per-widget rough memos | Per-widget rough geometry stays in the widget component (memo over dimensions). Toolbar preview moves into the render-registry entry for that widget. One source per widget. |

# Architectural ground rules (from rounds 2–3)

1. **Model never touches DOM/SVG.**
2. **View attaches handlers only to the SVG root.** No per-element handlers.
3. **Wire shape:** view sends viewport-relative coordinates as pojos. Model interprets via the camera module.
4. **Camera is its own module.** Owns viewport state and viewport↔world conversion. Model depends on it.
5. **Default state location is the model.** UI-local state lives in components only when no event handler other than the one setting it reads it. Discover by need, not upfront.
6. **Persistence:** only widgets and their version snapshots. Everything else is transient editor state.
7. **Pojos, not raw events.** Custom serializable input types. Field set added lazily; both producer and consumer ship together.
8. **Geometry is a shared pure module.** Used by model handlers; possibly by view for rendering math. No DOM, no reactivity.
9. **Discriminated unions dispatch via `switch` + `assertNever`.** `if` is allowed for non-union predicates (null checks, thresholds).
10. **Two registries** for widgets: data-registry (model-side: bounds, hit-test, create, place); render-registry (view-side: component, toolbar preview). Both keyed by `Widget['tag']`.

# Open items deferred

1. Tool-behavior table — defer until 5+ tools.
2. `mode × intent` 2D dispatch table — defer until needed.
3. Spatial index for hit-test — defer until measured.
4. Text-editing overlay (foreignObject focus exception to single-SVG-handler rule) — when text editing arrives.


