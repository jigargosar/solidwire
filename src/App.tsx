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
    return { setRef, toLocal, isCanvas }
}

function installGlobalKeys(model: Model) {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') model.cancel()
        if (e.key === 'Delete' || e.key === 'Backspace') model.deleteSelected()
    }
    window.addEventListener('keydown', handleKey)
    onCleanup(() => window.removeEventListener('keydown', handleKey))
}

const PAN_THRESHOLD = 3

type PanGesture = { startX: number; startY: number; panning: boolean }

export default function App() {
    const model = createModel()
    const camera = createCamera()
    const { setRef, toLocal, isCanvas } = createCanvasCoords()
    installGlobalKeys(model)

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
                const p = toLocal(e)
                if (!p) return
                if (e.ctrlKey || e.metaKey) {
                    const factor = Math.exp(-e.deltaY * 0.01)
                    camera.zoomAt(p, factor)
                } else {
                    e.preventDefault()
                    camera.panBy(-e.deltaX, -e.deltaY)
                }
            }}
        >
            <Toolbar model={model} />
            <Canvas model={model} camera={camera} setRef={setRef} onDragStart={onDragStart} />
        </main>
    )
}
