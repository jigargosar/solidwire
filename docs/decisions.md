# Decisions

1. Camera is its own module, responsible for viewport state and coordinate conversion between viewport and world. View sends viewport-relative coordinates; model uses the camera module to interpret them.
2. Model never touches DOM/SVG. View attaches handlers only to the SVG root and forwards pojos (custom serializable input types).
3. Default state location is the model. UI-local state lives in components only when no other handler reads it.
4. Only widgets and their version snapshots are persisted. Everything else is transient editor state.
5. Geometry is a shared pure module — no DOM, no reactivity. Used by model handlers and view rendering math.
6. Widgets have two registries keyed by tag: data-registry (model-side: bounds, hit-test, create, place) and render-registry (view-side: component, toolbar preview).
