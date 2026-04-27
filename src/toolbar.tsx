import { For, type JSX } from 'solid-js'
import type { Drawable } from 'roughjs/bin/core'
import { fontFamily, generator, strokeColor, toPath } from './rough'
import type { Model, Tool } from './model'

const miniOpts = { roughness: 1.0, stroke: strokeColor, strokeWidth: 1.5 }
const miniRectDrawable = generator.rectangle(10, 5, 60, 30, miniOpts)
const miniButtonDrawable = generator.rectangle(5, 5, 70, 30, miniOpts)

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
        [
            'group aspect-square w-full rounded-lg border p-2',
            'transition-colors cursor-pointer shadow-sm',
            'flex flex-col items-center justify-center',
            props.active
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-blue-500',
        ].join(' ')
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

export function Toolbar(props: { model: Model }) {
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
