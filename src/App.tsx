import { createMemo, For, onCleanup, type Accessor, type JSX } from 'solid-js'
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
import type { Point } from './geom'
import { Show } from 'solid-js'

type ModelApi = ReturnType<typeof createModel>

// === ROUGH PRIMITIVES ===
const generator = rough.generator()
const strokeColor = '#374151'

const toPath = (drawable: Drawable) =>
    generator
        .toPaths(drawable)
        .map((p) => p.d)
        .join(' ')

const roughRect = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }))

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

// === SHARED WIDGET FRAME ===
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

const cursorClass = (mode: Accessor<Mode>) => (mode().tag === 'idle' ? 'cursor-move' : '')

function RoughBox(props: {
    w: BoxW
    mode: Accessor<Mode>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
    pathProps: JSX.PathSVGAttributes<SVGPathElement>
    children?: JSX.Element
}) {
    const d = createMemo(() => roughRect(props.w.w, props.w.h))
    return (
        <g
            transform={`translate(${props.w.x}, ${props.w.y})`}
            class={cursorClass(props.mode)}
            onPointerDown={(e) => props.onDragStart(props.w.id, e)}
        >
            <rect width={props.w.w} height={props.w.h} fill='transparent' />
            <path d={d()} pointer-events='none' {...props.pathProps} />
            {props.children}
        </g>
    )
}

// === WIDGETS ===
function RectWidget(props: WidgetProps<RectW>) {
    return (
        <RoughBox
            w={props.w}
            mode={props.mode}
            onDragStart={props.onDragStart}
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
            w={props.w}
            mode={props.mode}
            onDragStart={props.onDragStart}
            pathProps={{ fill: 'none', stroke: strokeColor, 'stroke-width': '2.5' }}
        >
            <text
                x={props.w.w / 2}
                y={props.w.h / 2 + 10}
                text-anchor='middle'
                style={{ 'font-family': "'Kalam', cursive" }}
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
            w={props.w}
            mode={props.mode}
            onDragStart={props.onDragStart}
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
                        'font-family': "'Kalam', cursive",
                        'font-size': '14px',
                        color: '#374151',
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
        <g
            transform={`translate(${props.w.x}, ${props.w.y})`}
            class={cursorClass(props.mode)}
            onPointerDown={(e) => props.onDragStart(props.w.id, e)}
        >
            <rect
                x={b().x - props.w.x}
                y={b().y - props.w.y}
                width={b().w}
                height={b().h}
                fill='transparent'
            />
            <text
                style={{ 'font-family': "'Kalam', cursive" }}
                class='select-none text-2xl fill-gray-800 font-bold'
                pointer-events='none'
            >
                {props.w.content}
            </text>
        </g>
    )
}

// === TOOLBAR ===
type ToolEntry = { tool: Tool; label: string; preview: () => JSX.Element }

const tools: ToolEntry[] = [
    {
        tool: 'rect',
        label: 'Rect',
        preview: () => (
            <path
                d={toPath(miniRectDrawable)}
                fill='none'
                stroke={strokeColor}
                stroke-width='1.5'
            />
        ),
    },
    {
        tool: 'button',
        label: 'Button',
        preview: () => (
            <path
                d={toPath(miniButtonDrawable)}
                fill='none'
                stroke={strokeColor}
                stroke-width='1.5'
            />
        ),
    },
    { tool: 'text', label: 'Text', preview: () => null },
    {
        tool: 'annotation',
        label: 'Note',
        preview: () => (
            <path
                d={toPath(miniRectDrawable)}
                fill='none'
                stroke={strokeColor}
                stroke-width='1'
                stroke-dasharray='3,3'
            />
        ),
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
                    style={{ 'font-family': "'Kalam', cursive" }}
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
function Canvas(props: {
    model: ModelApi
    setRef: (el: SVGSVGElement) => void
    toLocal: (e: PointerEvent) => Point | null
}) {
    const m = props.model

    const onDragStart = (id: WidgetId, e: PointerEvent) => {
        if (m.mode().tag !== 'idle') return
        const p = props.toLocal(e)
        if (!p) return
        e.stopPropagation()
        m.widgetPointerDown(id, p)
    }

    return (
        <svg
            ref={props.setRef}
            class={`h-full w-full block bg-gray-100 ${m.activeTool() ? 'cursor-crosshair' : ''}`}
            onPointerDown={(e) => {
                const p = props.toLocal(e)
                if (p) m.canvasPointerDown(p)
            }}
        >
            <defs>
                <pattern id='dotGrid' width='30' height='30' patternUnits='userSpaceOnUse'>
                    <circle cx='2' cy='2' r='0.8' class='fill-blue-400' />
                </pattern>
            </defs>
            <rect width='100%' height='100%' fill='url(#dotGrid)' />

            <For each={m.widgets}>
                {(w) => {
                    switch (w.tag) {
                        case 'rect':
                            return <RectWidget w={w} mode={m.mode} onDragStart={onDragStart} />
                        case 'button':
                            return <ButtonWidget w={w} mode={m.mode} onDragStart={onDragStart} />
                        case 'text':
                            return <TextWidget w={w} mode={m.mode} onDragStart={onDragStart} />
                        case 'annotation':
                            return (
                                <AnnotationWidget w={w} mode={m.mode} onDragStart={onDragStart} />
                            )
                        default:
                            return assertNever(w)
                    }
                }}
            </For>

            <Show when={m.previewRect()}>
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

            <Show when={m.selectedWidgetBounds()}>
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
        </svg>
    )
}

// === APP ===
export default function App() {
    const m = createModel()
    let canvasRef: SVGSVGElement | undefined

    const toLocal = (e: PointerEvent): Point | null => {
        if (!canvasRef) return null
        const ctm = canvasRef.getScreenCTM()
        if (!ctm) return null
        const pt = canvasRef.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const r = pt.matrixTransform(ctm.inverse())
        return { x: r.x, y: r.y }
    }

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') m.cancel()
        if (e.key === 'Delete' || e.key === 'Backspace') m.deleteSelected()
    }
    window.addEventListener('keydown', handleKey)
    onCleanup(() => window.removeEventListener('keydown', handleKey))

    return (
        <main
            class='relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900 select-none'
            onPointerMove={(e) => {
                const p = toLocal(e)
                if (p) m.pointerMove(p)
            }}
            onPointerUp={() => m.pointerUp()}
        >
            <Toolbar model={m} />
            <Canvas model={m} setRef={(el) => (canvasRef = el)} toLocal={toLocal} />
        </main>
    )
}
