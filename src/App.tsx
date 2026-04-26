import { createMemo, For, onCleanup, Show, type Accessor, type JSX } from 'solid-js'
import rough from 'roughjs'
import type { Drawable } from 'roughjs/bin/core'
import {
    assertNever,
    createModel,
    widgetBounds,
    type Mode,
    type Tool,
    type Widget,
    type WidgetId,
} from './model'
import type { Bounds, Point } from './geom'

type ModelApi = ReturnType<typeof createModel>

// === ROUGH PRIMITIVES ===
const generator = rough.generator()
const strokeColor = '#374151'
const fontFamily = "'Kalam', cursive"

const toPath = (drawable: Drawable) =>
    generator
        .toPaths(drawable)
        .map((p) => p.d)
        .join(' ')

const roughRect = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }))

// === WIDGET TYPES ===
type RectW = Extract<Widget, { tag: 'rect' }>
type ButtonW = Extract<Widget, { tag: 'button' }>
type TextW = Extract<Widget, { tag: 'text' }>
type AnnotationW = Extract<Widget, { tag: 'annotation' }>
type BoxW = RectW | ButtonW | AnnotationW

type WidgetProps<T> = {
    w: T
    mode: Accessor<Mode>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
}

// === FRAME ===
function DraggableGroup(props: {
    id: WidgetId
    x: number
    y: number
    mode: Accessor<Mode>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
    children: JSX.Element
}) {
    return (
        <g
            transform={`translate(${props.x}, ${props.y})`}
            class={props.mode().tag === 'idle' ? 'cursor-move' : ''}
            onPointerDown={(e) => props.onDragStart(props.id, e)}
        >
            {props.children}
        </g>
    )
}

function RoughBox(
    props: WidgetProps<BoxW> & {
        pathProps: JSX.PathSVGAttributes<SVGPathElement>
        children?: JSX.Element
    },
) {
    const path = createMemo(() => roughRect(props.w.w, props.w.h))
    return (
        <DraggableGroup
            id={props.w.id}
            x={props.w.x}
            y={props.w.y}
            mode={props.mode}
            onDragStart={props.onDragStart}
        >
            <rect width={props.w.w} height={props.w.h} fill='transparent' />
            <path d={path()} pointer-events='none' {...props.pathProps} />
            {props.children}
        </DraggableGroup>
    )
}

// === WIDGETS ===
function RectWidget(props: WidgetProps<RectW>) {
    return (
        <RoughBox
            {...props}
            pathProps={{
                fill: 'white',
                'fill-opacity': 0.5,
                stroke: strokeColor,
                'stroke-width': '2.5',
            }}
        />
    )
}

function ButtonWidget(props: WidgetProps<ButtonW>) {
    return (
        <RoughBox
            {...props}
            pathProps={{ fill: 'none', stroke: strokeColor, 'stroke-width': '2.5' }}
        >
            <text
                x={props.w.w / 2}
                y={props.w.h / 2 + 10}
                text-anchor='middle'
                style={{ 'font-family': fontFamily }}
                class='select-none text-2xl fill-gray-800 font-bold'
                pointer-events='none'
            >
                Button
            </text>
        </RoughBox>
    )
}

function AnnotationWidget(props: WidgetProps<AnnotationW>) {
    return (
        <RoughBox
            {...props}
            pathProps={{
                fill: 'none',
                stroke: strokeColor,
                'stroke-width': '1.5',
                'stroke-dasharray': '3,3',
            }}
        >
            <foreignObject x={0} y={0} width={props.w.w} height={props.w.h} pointer-events='none'>
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        padding: '6px 8px',
                        'font-family': fontFamily,
                        'font-size': '14px',
                        color: strokeColor,
                        overflow: 'hidden',
                        'word-wrap': 'break-word',
                        'box-sizing': 'border-box',
                    }}
                >
                    {props.w.text}
                </div>
            </foreignObject>
        </RoughBox>
    )
}

function TextWidget(props: WidgetProps<TextW>) {
    const b = createMemo(() => widgetBounds(props.w))
    return (
        <DraggableGroup
            id={props.w.id}
            x={props.w.x}
            y={props.w.y}
            mode={props.mode}
            onDragStart={props.onDragStart}
        >
            <rect
                x={b().x - props.w.x}
                y={b().y - props.w.y}
                width={b().w}
                height={b().h}
                fill='transparent'
            />
            <text
                style={{ 'font-family': fontFamily }}
                class='select-none text-2xl fill-gray-800 font-bold'
                pointer-events='none'
            >
                {props.w.content}
            </text>
        </DraggableGroup>
    )
}

// === TOOLBAR ===
const miniRectDrawable = generator.rectangle(10, 5, 60, 30, {
    roughness: 1.0,
    stroke: strokeColor,
    strokeWidth: 1.5,
})
const miniButtonDrawable = generator.rectangle(5, 5, 70, 30, {
    roughness: 1.0,
    stroke: strokeColor,
    strokeWidth: 1.5,
})

function MiniPath(props: { drawable: Drawable; dashed?: boolean }) {
    return (
        <path
            d={toPath(props.drawable)}
            fill='none'
            stroke={strokeColor}
            stroke-width={props.dashed ? '1' : '1.5'}
            stroke-dasharray={props.dashed ? '3,3' : undefined}
        />
    )
}

type ToolEntry = { tool: Tool; label: string; preview: () => JSX.Element }

const tools: ToolEntry[] = [
    { tool: 'rect', label: 'Rect', preview: () => <MiniPath drawable={miniRectDrawable} /> },
    { tool: 'button', label: 'Button', preview: () => <MiniPath drawable={miniButtonDrawable} /> },
    {
        tool: 'text',
        label: 'Text',
        preview: () => (
            <text
                x='40'
                y='17'
                text-anchor='middle'
                style={{ 'font-family': fontFamily }}
                class='select-none text-base fill-gray-700 font-bold'
            >
                Aa
            </text>
        ),
    },
    {
        tool: 'annotation',
        label: 'Note',
        preview: () => <MiniPath drawable={miniRectDrawable} dashed />,
    },
]

function ToolTile(props: {
    label: string
    active: boolean
    onToggle: () => void
    preview: JSX.Element
}) {
    const tileClass = () =>
        `group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${
            props.active
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-blue-500'
        }`
    return (
        <div onClick={props.onToggle} class={tileClass()}>
            <svg viewBox='0 0 80 40' class='w-full'>
                {props.preview}
                <text
                    x='40'
                    y='26'
                    text-anchor='middle'
                    style={{ 'font-family': fontFamily }}
                    class='text-[10px] fill-gray-600 select-none font-bold'
                >
                    {props.label}
                </text>
            </svg>
        </div>
    )
}

function Toolbar(props: { model: ModelApi }) {
    return (
        <aside class='absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]'>
            <div class='flex flex-col gap-3'>
                <For each={tools}>
                    {(t) => (
                        <ToolTile
                            label={t.label}
                            active={props.model.activeTool() === t.tool}
                            onToggle={() => props.model.toggleTool(t.tool)}
                            preview={t.preview()}
                        />
                    )}
                </For>
            </div>
        </aside>
    )
}

// === CANVAS ===
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
    model: ModelApi
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

    const wp = { mode: props.model.mode, onDragStart }

    return (
        <svg
            ref={props.setRef}
            class={`h-full w-full block bg-gray-100 ${props.model.activeTool() ? 'cursor-crosshair' : ''}`}
            onPointerDown={(e) => {
                const p = props.toLocal(e)
                if (p) props.model.canvasPointerDown(p)
            }}
        >
            <GridBackground />

            <For each={props.model.widgets}>
                {(w) => {
                    switch (w.tag) {
                        case 'rect':
                            return <RectWidget w={w} {...wp} />
                        case 'button':
                            return <ButtonWidget w={w} {...wp} />
                        case 'text':
                            return <TextWidget w={w} {...wp} />
                        case 'annotation':
                            return <AnnotationWidget w={w} {...wp} />
                        default:
                            return assertNever(w)
                    }
                }}
            </For>

            <DrawPreview rect={props.model.previewRect} />
            <SelectionOverlay bounds={props.model.selectedWidgetBounds} />
        </svg>
    )
}

// === APP ===
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
    return { setRef, toLocal }
}

function createGlobalKeys(model: ModelApi) {
    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') model.cancel()
        if (e.key === 'Delete' || e.key === 'Backspace') model.deleteSelected()
    }
    window.addEventListener('keydown', handleKey)
    onCleanup(() => window.removeEventListener('keydown', handleKey))
}

export default function App() {
    const model = createModel()
    const { setRef, toLocal } = createCanvasCoords()
    createGlobalKeys(model)

    return (
        <main
            class='relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900 select-none'
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
