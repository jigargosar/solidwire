import { createMemo, For, type Accessor, type JSX } from 'solid-js'
import type { Bounds } from './geom'
import { fontFamily, roughRect, strokeColor } from './rough'
import { assertNever } from './util'

export type WidgetId = string

export type Widget =
    | { tag: 'rect'; id: WidgetId; x: number; y: number; w: number; h: number }
    | { tag: 'button'; id: WidgetId; x: number; y: number; w: number; h: number }
    | { tag: 'text'; id: WidgetId; x: number; y: number; content: string }
    | { tag: 'annotation'; id: WidgetId; x: number; y: number; w: number; h: number; text: string }

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

type RectW = Extract<Widget, { tag: 'rect' }>
type ButtonW = Extract<Widget, { tag: 'button' }>
type TextW = Extract<Widget, { tag: 'text' }>
type AnnotationW = Extract<Widget, { tag: 'annotation' }>
type BoxW = RectW | ButtonW | AnnotationW

type WidgetProps<T> = {
    w: T
    cursor: Accessor<string>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
}

function WidgetFrame(props: {
    id: WidgetId
    x: number
    y: number
    hit: Bounds
    cursor: Accessor<string>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
    children: JSX.Element
}) {
    return (
        <g
            transform={`translate(${props.x}, ${props.y})`}
            class={props.cursor()}
            onPointerDown={(e) => props.onDragStart(props.id, e)}
        >
            <rect
                x={props.hit.x}
                y={props.hit.y}
                width={props.hit.w}
                height={props.hit.h}
                fill='transparent'
            />
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
    const hit = createMemo(() => ({ x: 0, y: 0, w: props.w.w, h: props.w.h }))
    return (
        <WidgetFrame
            id={props.w.id}
            x={props.w.x}
            y={props.w.y}
            hit={hit()}
            cursor={props.cursor}
            onDragStart={props.onDragStart}
        >
            <path d={path()} pointer-events='none' {...props.pathProps} />
            {props.children}
        </WidgetFrame>
    )
}

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
    const hit = createMemo(() => {
        const b = widgetBounds(props.w)
        return { x: b.x - props.w.x, y: b.y - props.w.y, w: b.w, h: b.h }
    })
    return (
        <WidgetFrame
            id={props.w.id}
            x={props.w.x}
            y={props.w.y}
            hit={hit()}
            cursor={props.cursor}
            onDragStart={props.onDragStart}
        >
            <text
                style={{ 'font-family': fontFamily }}
                class='select-none text-2xl fill-gray-800 font-bold'
                pointer-events='none'
            >
                {props.w.content}
            </text>
        </WidgetFrame>
    )
}

function WidgetView(props: WidgetProps<Widget>) {
    switch (props.w.tag) {
        case 'rect':
            return <RectWidget {...props} w={props.w} />
        case 'button':
            return <ButtonWidget {...props} w={props.w} />
        case 'text':
            return <TextWidget {...props} w={props.w} />
        case 'annotation':
            return <AnnotationWidget {...props} w={props.w} />
        default:
            return assertNever(props.w)
    }
}

export function Widgets(props: {
    widgets: Widget[]
    cursor: Accessor<string>
    onDragStart: (id: WidgetId, e: PointerEvent) => void
}) {
    return (
        <For each={props.widgets}>
            {(w) => <WidgetView w={w} cursor={props.cursor} onDragStart={props.onDragStart} />}
        </For>
    )
}
