import { Show, createSignal, type Accessor } from 'solid-js'
import { createModel, type Model, type WidgetId } from './model'
import type { Bounds, Point } from './geom'
import { roughRect, strokeColor } from './rough'
import { Widgets } from './widgets'
import { Toolbar } from './toolbar'
import { createCamera, type Camera } from './camera'
import {
    createDragGesture,
    createElementSize,
    createWindowListener,
} from './primitives'

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
    const [el, setRef] = createSignal<SVGSVGElement | null>(null)
    const toLocal = (e: { clientX: number; clientY: number }): Point | null => {
        const svg = el()
        if (!svg) return null
        const ctm = svg.getScreenCTM()
        if (!ctm) return null
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const r = pt.matrixTransform(ctm.inverse())
        return { x: r.x, y: r.y }
    }
    const isCanvas = (target: EventTarget | null): boolean => {
        const svg = el()
        return target instanceof Node && svg !== null && svg.contains(target)
    }
    return { el, setRef, toLocal, isCanvas }
}

const PAN_THRESHOLD = 3
const TOOLBAR_W = 140
const FIT_PAD = 24

export default function App() {
    const model = createModel()
    const { el, setRef, toLocal, isCanvas } = createCanvasCoords()
    const canvasSize = createElementSize(el)

    const getScreenBounds = (): Bounds | null => {
        const s = canvasSize()
        if (!s) return null
        return {
            x: TOOLBAR_W + FIT_PAD,
            y: FIT_PAD,
            w: s.width - TOOLBAR_W - FIT_PAD * 2,
            h: s.height - FIT_PAD * 2,
        }
    }

    const camera = createCamera({
        worldBounds: model.worldBounds,
        screenBounds: getScreenBounds,
    })

    createWindowListener('keydown', (e) => {
        const modified = e.metaKey || e.ctrlKey || e.altKey
        if (e.key === 'Escape') model.cancel()
        if ((e.key === 'Delete' || e.key === 'Backspace') && !modified) model.deleteSelected()
        if (e.key === 'r' && !modified) camera.reset()
        if (e.key === 'f' && !modified) camera.fit()
    })

    const toWorld = (e: { clientX: number; clientY: number }): Point | null => {
        const p = toLocal(e)
        return p ? camera.screenToWorld(p) : null
    }

    const drag = createDragGesture({
        threshold: PAN_THRESHOLD,
        onDrag: (dx, dy) => camera.panBy(dx, dy),
        onTap: (e) => {
            const p = toWorld(e)
            if (p) model.canvasPointerDown(p)
        },
    })

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
                    drag.start(e)
                    return
                }
                const p = toWorld(e)
                if (p) model.canvasPointerDown(p)
            }}
            onPointerMove={(e) => {
                if (drag.active()) return
                const p = toWorld(e)
                if (p) model.pointerMove(p)
            }}
            onPointerUp={() => {
                if (drag.active()) return
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
