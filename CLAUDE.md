# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MockBench — a wireframing tool with a sketchy hand-drawn aesthetic (built with SolidJS + roughjs). It's a thinking tool, not a production design tool: low fidelity is deliberate. See `docs/NorthStar.md` for the design philosophy ("as fast as a pencil", progressive disclosure).

## Commands

Package manager is **pnpm** (workspace-enabled via `pnpm-workspace.yaml`).

- `pnpm dev` — Vite dev server
- `pnpm build` — production build
- `pnpm typecheck` — `tsc --noEmit` (run after edits; `.tsx`/`.ts` strict)
- `pnpm test` — vitest run (single pass)
- `pnpm test:watch` — vitest watch
- Run a single test: `pnpm test -- src/model.test.ts -t "test name"`

## Architecture

The app is small and centralizes all state and transitions in one model module. Two files do most of the work:

- `src/model.ts` — `createModel()` returns the entire app state machine. It owns widgets (`createStore`), `mode`, `selectedId`, and exposes derived memos (`selectedWidget`, `previewRect`, `activeTool`) plus pointer/keyboard intent handlers (`canvasPointerDown`, `widgetPointerDown`, `pointerMove`, `pointerUp`, `toggleTool`, `cancel`, `deleteSelected`). The view never mutates state directly — it calls these handlers.
- `src/App.tsx` — pure view. Renders the toolbar, SVG canvas, widget components (`RectWidget`, `ButtonWidget`, `TextWidget`, `AnnotationWidget`), draw preview, and selection bounding box. Translates DOM pointer events into local SVG coordinates via `getScreenCTM` and forwards them to the model.

### State machine

`Mode` is a discriminated union: `idle | armed{tool} | drawing{kind,start,current} | dragging{id,offset}`. All transitions live in the model handlers; switch on `.tag` with `assertNever` in the default. `Widget` is also a discriminated union (`rect | button | annotation` share `{x,y,w,h}`; `text` derives bounds from content length via `widgetBounds`).

Click-to-place tools (`button`, `text`) insert immediately on `canvasPointerDown`. Drag-to-draw tools (`rect`, `annotation`) enter `drawing` mode; the preview rect is a memo over `mode`, and commit happens on `pointerUp` if the rect exceeds a 5px threshold (otherwise it returns to `armed`).

### Rendering

`roughjs` paths are computed inside `createMemo` per widget so they only regenerate when dimensions change. The toolbar tiles render mini previews via the same `generator`. Hand-drawn typography uses the Kalam font (loaded via `index.css`); styling is Tailwind v4 (`@tailwindcss/vite`).

## Conventions specific to this repo

1. Discriminated unions use `tag` (not `kind`/`type`) per the global TypeScript rule. `model.ts` exports an `assertNever` used at every switch default.
2. Widget IDs are `WidgetId` (string, `crypto.randomUUID()`) — do not reintroduce numeric IDs.
3. Per-widget rough geometry must stay inside `createMemo` — regenerating on every render breaks the sketchy-but-stable aesthetic (paths jitter).
4. The model is the single source of truth. Per the global rule "models own their state and derivations": add a memo/getter to `createModel` instead of computing over `m.widgets` in the view.
