import { onCleanup, Show, type Accessor } from 'solid-js'
import { createModel, type Model, type WidgetId } from './model'
import type { Bounds, Point } from './geom'
import { roughRect, strokeColor } from './rough'
import { Widgets } from './widgets'
import { Toolbar } from './toolbar'
import { createCamera, type Camera } from './camera'

function GridBackground() {
    return (
        <>
            <defs>
                <pattern id='dotGrid' width='30' height='30' patternUnits='userSpaceOnUse'>
                    <circle cx='2' cy='2' r='0.8' class='fill-blue-400' />
                </pattern>
            </defs>
            <rect x={-100000} y={-100000} width={200000} height={200000} fill='url(#dotGrid)' />
        </>
    )
}

function DrawPreview(props: { rect: Accessor<Bounds | null> }) {
    return (
        <Show when={props.rect()}>
            {(r) => (
                <path
                    d={roughRect(r().w, r().h)}
                    transform={`translate(${r().x}, ${r().y})`}
                    fill='none'
                    stroke={strokeColor}
                    stroke-dasharray='5,5'
                />
            )}
        </Show>
    )
}

function SelectionOverlay(props: { bounds: Accessor<Bounds | null> }) {
    return (
        <Show when={props.bounds()}>
            {(b) => (
                <rect
                    x={b().x - 4}
                    y={b().y - 4}
                    width={b().w + 8}
                    height={b().h + 8}
                    fill='none'
                    stroke='#2563eb'
                    stroke-width='1.5'
                    stroke-dasharray='4,3'
                    pointer-events='none'
                />
            )}
        </Show>
    )
}

function Canvas(props: {
    model: Model
    camera: Camera
    setRef: (el: SVGSVGElement) => void
    onDragStart: (id: WidgetId, e: PointerEvent) => void
}) {
    const transform = () =>
        `translate(${props.camera.tx()}, ${props.camera.ty()}) scale(${props.camera.scale()})`
    return (
        <svg
            ref={props.setRef}
            class={`h-full w-full block bg-gray-100 ${props.model.activeTool() ? 'cursor-crosshair' : ''}`}
        >
            <g transform={transform()}>
                <GridBackground />
                <Widgets
                    widgets={props.model.widgets}
                    mode={props.model.mode}
                    onDragStart={props.onDragStart}
                />
                <DrawPreview rect={props.model.previewRect} />
                <SelectionOverlay bounds={props.model.selectedWidgetBounds} />
            </g>
        </svg>
    )
}

function createCanvasCoords() {
    let el: SVGSVGElement | undefined
    const setRef = (svg: SVGSVGElement) => {
        el = svg
    }
    const toLocal = (e: { clientX: number; clientY: number }): Point | null => {
        if (!el) return null
        const ctm = el.getScreenCTM()
        if (!ctm) return null
        const pt = el.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const r = pt.matrixTransform(ctm.inverse())
        return { x: r.x, y: r.y }
    }
    const isCanvas = (target: EventTarget | null): boolean =>
        target instanceof Node && !!el && el.contains(target)
    const getViewport = (): { w: number; h: number } | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { w: r.width, h: r.height }
    }
    return { setRef, toLocal, isCanvas, getViewport }
}

function installGlobalKeys(handlers: {
    cancel: () => void
    deleteSelected: () => void
    reset: () => void
    fit: () => void
}) {
    const handleKey = (e: KeyboardEvent) => {
        const modified = e.metaKey || e.ctrlKey || e.altKey
        if (e.key === 'Escape') handlers.cancel()
        if ((e.key === 'Delete' || e.key === 'Backspace') && !modified) handlers.deleteSelected()
        if (e.key === 'r' && !modified) handlers.reset()
        if (e.key === 'f' && !modified) handlers.fit()
    }
    window.addEventListener('keydown', handleKey)
    onCleanup(() => window.removeEventListener('keydown', handleKey))
}

const PAN_THRESHOLD = 3

type PanGesture = { startX: number; startY: number; panning: boolean }

const TOOLBAR_W = 140
const FIT_PAD = 24

export default function App() {
    const model = createModel()
    const { setRef, toLocal, isCanvas, getViewport } = createCanvasCoords()

    const getScreenBounds = (): Bounds | null => {
        const vp = getViewport()
        if (!vp) return null
        return {
            x: TOOLBAR_W + FIT_PAD,
            y: FIT_PAD,
            w: vp.w - TOOLBAR_W - FIT_PAD * 2,
            h: vp.h - FIT_PAD * 2,
        }
    }

    const camera = createCamera({
        worldBounds: model.worldBounds,
        screenBounds: getScreenBounds,
    })

    installGlobalKeys({
        cancel: model.cancel,
        deleteSelected: model.deleteSelected,
        reset: camera.reset,
        fit: camera.fit,
    })

    let pan: PanGesture | null = null

    const toWorld = (e: { clientX: number; clientY: number }): Point | null => {
        const p = toLocal(e)
        return p ? camera.screenToWorld(p) : null
    }

    const onDragStart = (id: WidgetId, e: PointerEvent) => {
        if (model.mode().tag !== 'idle') return
        const p = toWorld(e)
        if (!p) return
        e.stopPropagation()
        model.widgetPointerDown(id, p)
    }

    return (
        <main
            class='relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900 select-none'
            style={{ 'touch-action': 'none' }}
            onPointerDown={(e) => {
                if (!isCanvas(e.target)) return
                if (model.mode().tag === 'idle') {
                    pan = { startX: e.clientX, startY: e.clientY, panning: false }
                    return
                }
                const p = toWorld(e)
                if (p) model.canvasPointerDown(p)
            }}
            onPointerMove={(e) => {
                if (pan) {
                    if (!(e.buttons & 1)) {
                        pan = null
                        return
                    }
                    if (!pan.panning) {
                        const dx = e.clientX - pan.startX
                        const dy = e.clientY - pan.startY
                        if (Math.hypot(dx, dy) > PAN_THRESHOLD) pan.panning = true
                    }
                    if (pan.panning) camera.panBy(e.movementX, e.movementY)
                    return
                }
                const p = toWorld(e)
                if (p) model.pointerMove(p)
            }}
            onPointerUp={(e) => {
                if (pan) {
                    if (!pan.panning) {
                        const p = toWorld(e)
                        if (p) model.canvasPointerDown(p)
                    }
                    pan = null
                    return
                }
                model.pointerUp()
            }}
            onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) e.preventDefault()
                if (!isCanvas(e.target)) return
                e.preventDefault()
                const p = toLocal(e)
                if (p) camera.zoomByDelta(p, e.deltaY)
            }}
        >
            <Toolbar model={model} />
            <Canvas model={model} camera={camera} setRef={setRef} onDragStart={onDragStart} />
            <div class='absolute top-3 right-3 z-10 rounded-md border border-gray-400 bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700 shadow-sm pointer-events-none'>
                {Math.round(camera.scale() * 100)}%
            </div>
        </main>
    )
}
