import { createMemo, createSignal, type Accessor } from 'solid-js'
import { createStore, type Store } from 'solid-js/store'
import { boundsFromPoints, type Bounds, type Point } from './geom'
import { assertNever } from './util'
import { widgetBounds, type Widget, type WidgetId } from './widgets'
import { createCamera, type Camera } from './camera'

export type Tool = 'rect' | 'button' | 'text' | 'annotation'
type DrawKind = 'rect' | 'annotation'

export type Mode =
    | { tag: 'idle' }
    | { tag: 'armed'; tool: Tool }
    | { tag: 'drawing'; kind: DrawKind; start: Point; current: Point }
    | { tag: 'dragging'; id: WidgetId; offset: Point }

export type KeyInput = {
    key: string
    meta: boolean
    ctrl: boolean
    alt: boolean
}

export interface ModelOpts {
    screenBounds: () => Bounds | null
}

// --- MODEL ---
export interface Model {
    widgets: Store<Widget[]>
    mode: Accessor<Mode>
    camera: Camera
    selectedWidgetBounds: Accessor<Bounds | null>
    previewRect: Accessor<Bounds | null>
    activeTool: () => Tool | null
    toggleTool: (tool: Tool) => void
    canvasPointerDown: (p: Point) => void
    widgetPointerDown: (id: WidgetId, cursor: Point) => void
    pointerMove: (p: Point) => void
    pointerUp: () => void
    keyDown: (k: KeyInput) => void
}

export function createModel(opts: ModelOpts): Model {
    const newId = (): WidgetId => crypto.randomUUID()

    const [widgets, setWidgets] = createStore<Widget[]>([
        { tag: 'rect', id: newId(), x: 300, y: 100, w: 200, h: 150 },
        { tag: 'button', id: newId(), x: 600, y: 300, w: 240, h: 80 },
    ])
    const [mode, setMode] = createSignal<Mode>({ tag: 'idle' })
    const [selectedId, setSelectedId] = createSignal<WidgetId | null>(null)
    const selectedWidget = createMemo<Widget | null>(() => {
        const id = selectedId()
        if (!id) return null
        return widgets.find((w) => w.id === id) ?? null
    })

    const previewRect = createMemo<Bounds | null>(() => {
        const m = mode()
        if (m.tag !== 'drawing') return null
        return boundsFromPoints(m.start, m.current)
    })

    const selectedWidgetBounds = createMemo<Bounds | null>(() => {
        const w = selectedWidget()
        return w ? widgetBounds(w) : null
    })

    const worldBounds = createMemo<Bounds | null>(() => {
        if (widgets.length === 0) return null
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const w of widgets) {
            const b = widgetBounds(w)
            if (b.x < minX) minX = b.x
            if (b.y < minY) minY = b.y
            if (b.x + b.w > maxX) maxX = b.x + b.w
            if (b.y + b.h > maxY) maxY = b.y + b.h
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    })

    const camera = createCamera({ worldBounds, screenBounds: opts.screenBounds })

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
        setSelectedId(null)
    }

    const deleteSelected = () => {
        const id = selectedId()
        if (!id) return
        if (mode().tag === 'dragging') return
        setWidgets((ws) => ws.filter((w) => w.id !== id))
        setSelectedId(null)
    }

    const keyDown = (k: KeyInput) => {
        const modified = k.meta || k.ctrl || k.alt
        if (k.key === 'Escape') cancel()
        if ((k.key === 'Delete' || k.key === 'Backspace') && !modified) deleteSelected()
        if (k.key === 'r' && !modified) camera.reset()
        if (k.key === 'f' && !modified) camera.fit()
    }

    const canvasPointerDown = (p: Point) => {
        const m = mode()
        if (m.tag !== 'armed') {
            if (m.tag === 'idle') setSelectedId(null)
            return
        }
        switch (m.tool) {
            case 'rect':
                setMode({ tag: 'drawing', kind: 'rect', start: p, current: p })
                return
            case 'annotation':
                setMode({ tag: 'drawing', kind: 'annotation', start: p, current: p })
                return
            case 'button':
                setWidgets((ws) => [
                    ...ws,
                    { tag: 'button', id: newId(), x: p.x - 120, y: p.y - 40, w: 240, h: 80 },
                ])
                return
            case 'text':
                setWidgets((ws) => [
                    ...ws,
                    { tag: 'text', id: newId(), x: p.x, y: p.y, content: 'Text' },
                ])
                return
            default:
                return assertNever(m.tool)
        }
    }

    const widgetPointerDown = (id: WidgetId, cursor: Point) => {
        if (mode().tag !== 'idle') return
        const widget = widgets.find((w) => w.id === id)
        if (!widget) return
        setSelectedId(id)
        setMode({ tag: 'dragging', id, offset: { x: cursor.x - widget.x, y: cursor.y - widget.y } })
    }

    const pointerMove = (p: Point) => {
        const m = mode()
        switch (m.tag) {
            case 'dragging':
                setWidgets((w) => w.id === m.id, { x: p.x - m.offset.x, y: p.y - m.offset.y })
                return
            case 'drawing':
                setMode({ tag: 'drawing', kind: m.kind, start: m.start, current: p })
                return
            case 'idle':
            case 'armed':
                return
            default:
                return assertNever(m)
        }
    }

    const pointerUp = () => {
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
            case 'armed':
                return
            default:
                return assertNever(m)
        }
    }

    return {
        widgets,
        mode,
        camera,
        selectedWidgetBounds,
        previewRect,
        activeTool,
        toggleTool,
        canvasPointerDown,
        widgetPointerDown,
        pointerMove,
        pointerUp,
        keyDown,
    }
}
