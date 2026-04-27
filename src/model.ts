import { createMemo, createSignal, type Accessor } from 'solid-js'
import { createStore, type Store } from 'solid-js/store'
import { boundsFromPoints, type Bounds, type Point } from './geom'
import { createBoundsAggregate, createSelection } from './primitives'
import { createCamera, type Camera } from './camera'

export function assertNever(_: never): never {
    throw new Error('unreachable')
}

// --- TYPES ---
export type WidgetId = string

export type Widget =
    | { tag: 'rect'; id: WidgetId; x: number; y: number; w: number; h: number }
    | { tag: 'button'; id: WidgetId; x: number; y: number; w: number; h: number }
    | { tag: 'text'; id: WidgetId; x: number; y: number; content: string }
    | { tag: 'annotation'; id: WidgetId; x: number; y: number; w: number; h: number; text: string }

export type Tool = 'rect' | 'button' | 'text' | 'annotation'
type DrawKind = 'rect' | 'annotation'

export type Mode =
    | { tag: 'idle' }
    | { tag: 'armed'; tool: Tool }
    | { tag: 'drawing'; kind: DrawKind; start: Point; current: Point }
    | { tag: 'dragging'; id: WidgetId; offset: Point }

export function widgetBounds(w: Widget): Bounds {
    switch (w.tag) {
        case 'rect':
        case 'button':
        case 'annotation':
            return { x: w.x, y: w.y, w: w.w, h: w.h }
        case 'text':
            return { x: w.x - 4, y: w.y - 24, w: w.content.length * 14 + 8, h: 32 }
        default:
            return assertNever(w)
    }
}

// Pointer info passed in by the view-side gesture primitive.
export type PointerMoveInfo = { dragging: boolean; dx: number; dy: number }
export type PointerUpInfo = { wasDragging: boolean }

// --- MODEL ---
export interface ModelOpts {
    screenBounds: () => Bounds | null
}

export interface Model {
    widgets: Store<Widget[]>
    mode: Accessor<Mode>
    selectedId: Accessor<WidgetId | null>
    selectedWidgetBounds: Accessor<Bounds | null>
    previewRect: Accessor<Bounds | null>
    camera: Camera
    activeTool: () => Tool | null
    toggleTool: (tool: Tool) => void
    cancel: () => void
    deleteSelected: () => void
    canvasPointerDown: (localPoint: Point) => void
    canvasPointerMove: (localPoint: Point, info: PointerMoveInfo) => void
    canvasPointerUp: (localPoint: Point, info: PointerUpInfo) => void
}

export function createModel(opts: ModelOpts): Model {
    const newId = (): WidgetId => crypto.randomUUID()

    const [widgets, setWidgets] = createStore<Widget[]>([
        { tag: 'rect', id: newId(), x: 300, y: 100, w: 200, h: 150 },
        { tag: 'button', id: newId(), x: 600, y: 300, w: 240, h: 80 },
    ])
    const [mode, setMode] = createSignal<Mode>({ tag: 'idle' })

    const worldBounds = createBoundsAggregate(() => widgets, widgetBounds)

    const camera = createCamera({
        worldBounds,
        screenBounds: opts.screenBounds,
    })

    const selection = createSelection<Widget, WidgetId>(
        () => widgets,
        (w) => w.id,
    )

    const previewRect = createMemo<Bounds | null>(() => {
        const m = mode()
        if (m.tag !== 'drawing') return null
        return boundsFromPoints(m.start, m.current)
    })

    const selectedWidgetBounds = createMemo<Bounds | null>(() => {
        const w = selection.selected()
        return w ? widgetBounds(w) : null
    })

    const activeTool = (): Tool | null => {
        const m = mode()
        switch (m.tag) {
            case 'armed':
                return m.tool
            case 'drawing':
                return m.kind
            case 'idle':
            case 'dragging':
                return null
            default:
                return assertNever(m)
        }
    }

    const toggleTool = (tool: Tool) => {
        const m = mode()
        if (m.tag === 'armed' && m.tool === tool) setMode({ tag: 'idle' })
        else setMode({ tag: 'armed', tool })
    }

    const cancel = () => {
        setMode({ tag: 'idle' })
        selection.clear()
    }

    const deleteSelected = () => {
        const id = selection.selectedId()
        if (!id) return
        if (mode().tag === 'dragging') return
        setWidgets((ws) => ws.filter((w) => w.id !== id))
        selection.clear()
    }

    const hitTest = (worldPoint: Point): Widget | null => {
        for (let i = widgets.length - 1; i >= 0; i--) {
            const w = widgets[i]
            const b = widgetBounds(w)
            if (
                worldPoint.x >= b.x &&
                worldPoint.x <= b.x + b.w &&
                worldPoint.y >= b.y &&
                worldPoint.y <= b.y + b.h
            ) {
                return w
            }
        }
        return null
    }

    const canvasPointerDown = (localPoint: Point) => {
        const m = mode()
        const world = camera.screenToWorld(localPoint)

        if (m.tag === 'idle') {
            const hit = hitTest(world)
            if (hit) {
                selection.setSelectedId(hit.id)
                setMode({
                    tag: 'dragging',
                    id: hit.id,
                    offset: { x: world.x - hit.x, y: world.y - hit.y },
                })
            }
            return
        }

        if (m.tag !== 'armed') return

        switch (m.tool) {
            case 'rect':
                setMode({ tag: 'drawing', kind: 'rect', start: world, current: world })
                return
            case 'annotation':
                setMode({
                    tag: 'drawing',
                    kind: 'annotation',
                    start: world,
                    current: world,
                })
                return
            case 'button':
                setWidgets((ws) => [
                    ...ws,
                    { tag: 'button', id: newId(), x: world.x - 120, y: world.y - 40, w: 240, h: 80 },
                ])
                return
            case 'text':
                setWidgets((ws) => [
                    ...ws,
                    { tag: 'text', id: newId(), x: world.x, y: world.y, content: 'Text' },
                ])
                return
            default:
                return assertNever(m.tool)
        }
    }

    const canvasPointerMove = (localPoint: Point, info: PointerMoveInfo) => {
        const m = mode()
        const world = camera.screenToWorld(localPoint)
        switch (m.tag) {
            case 'dragging':
                setWidgets(
                    (w) => w.id === m.id,
                    { x: world.x - m.offset.x, y: world.y - m.offset.y },
                )
                return
            case 'drawing':
                setMode({ tag: 'drawing', kind: m.kind, start: m.start, current: world })
                return
            case 'idle':
                if (info.dragging) camera.panBy(info.dx, info.dy)
                return
            case 'armed':
                return
            default:
                return assertNever(m)
        }
    }

    const canvasPointerUp = (_localPoint: Point, info: PointerUpInfo) => {
        const m = mode()
        switch (m.tag) {
            case 'drawing': {
                const r = previewRect()
                if (r && r.w > 5 && r.h > 5) {
                    const id = newId()
                    switch (m.kind) {
                        case 'rect':
                            setWidgets((ws) => [...ws, { tag: 'rect', id, ...r }])
                            break
                        case 'annotation':
                            setWidgets((ws) => [
                                ...ws,
                                {
                                    tag: 'annotation',
                                    id,
                                    ...r,
                                    text: 'Note. Type more to see wrap.',
                                },
                            ])
                            break
                        default:
                            return assertNever(m.kind)
                    }
                }
                setMode({ tag: 'armed', tool: m.kind })
                return
            }
            case 'dragging':
                setMode({ tag: 'idle' })
                return
            case 'idle':
                if (!info.wasDragging) selection.clear()
                return
            case 'armed':
                return
            default:
                return assertNever(m)
        }
    }

    return {
        widgets,
        mode,
        selectedId: selection.selectedId,
        selectedWidgetBounds,
        previewRect,
        camera,
        activeTool,
        toggleTool,
        cancel,
        deleteSelected,
        canvasPointerDown,
        canvasPointerMove,
        canvasPointerUp,
    }
}
