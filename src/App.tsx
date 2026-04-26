import { For, onCleanup, Show, type Accessor } from 'solid-js'
import { createModel, type Model, type WidgetId } from './model'
import type { Bounds, Point } from './geom'
import { roughRect, strokeColor } from './rough'
import { WidgetView } from './widgets'
import { Toolbar } from './toolbar'

function GridBackground() {
    return (
        <>
            <defs>
                <pattern id='dotGrid' width='30' height='30' patternUnits='userSpaceOnUse'>
                    <circle cx='2' cy='2' r='0.8' class='fill-blue-400' />
                </pattern>
            </defs>
            <rect width='100%' height='100%' fill='url(#dotGrid)' />
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
    setRef: (el: SVGSVGElement) => void
    toLocal: (e: PointerEvent) => Point | null
}) {
    const onDragStart = (id: WidgetId, e: PointerEvent) => {
        if (props.model.mode().tag !== 'idle') return
        const p = props.toLocal(e)
        if (!p) return
        e.stopPropagation()
        props.model.widgetPointerDown(id, p)
    }

    return (
        <svg
            ref={props.setRef}
            class={`h-full w-full block bg-gray-100 ${props.model.activeTool() ? 'cursor-crosshair' : ''}`}
        >
            <GridBackground />

            <For each={props.model.widgets}>
                {(w) => (
                    <WidgetView w={w} mode={props.model.mode} onDragStart={onDragStart} />
                )}
            </For>

            <DrawPreview rect={props.model.previewRect} />
            <SelectionOverlay bounds={props.model.selectedWidgetBounds} />
        </svg>
    )
}

function createCanvasCoords() {
    let el: SVGSVGElement | undefined
    const setRef = (svg: SVGSVGElement) => {
        el = svg
    }
    const toLocal = (e: PointerEvent): Point | null => {
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

export default function App() {
    const model = createModel()
    const { setRef, toLocal, isCanvas } = createCanvasCoords()
    installGlobalKeys(model)

    return (
        <main
            class='relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900 select-none'
            onPointerDown={(e) => {
                if (!isCanvas(e.target)) return
                const p = toLocal(e)
                if (p) model.canvasPointerDown(p)
            }}
            onPointerMove={(e) => {
                const p = toLocal(e)
                if (p) model.pointerMove(p)
            }}
            onPointerUp={() => model.pointerUp()}
        >
            <Toolbar model={model} />
            <Canvas model={model} setRef={setRef} toLocal={toLocal} />
        </main>
    )
}
