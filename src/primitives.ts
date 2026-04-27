import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'

export function createWindowListener<K extends keyof WindowEventMap>(
    type: K,
    handler: (e: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
) {
    window.addEventListener(type, handler, options)
    onCleanup(() => window.removeEventListener(type, handler, options))
}

export type ElementSize = { width: number; height: number }

export function createElementSize<T extends Element>(
    el: Accessor<T | null>,
): Accessor<ElementSize | null> {
    const [size, setSize] = createSignal<ElementSize | null>(null, {
        equals: (a, b) => a?.width === b?.width && a?.height === b?.height,
    })
    createEffect(() => {
        const node = el()
        if (!node) {
            setSize(null)
            return
        }
        const rect = node.getBoundingClientRect()
        setSize({ width: rect.width, height: rect.height })
        const ro = new ResizeObserver((entries) => {
            const box = entries[0].borderBoxSize[0]
            setSize({ width: box.inlineSize, height: box.blockSize })
        })
        ro.observe(node)
        onCleanup(() => ro.disconnect())
    })
    return size
}

export type DragGestureOpts = {
    threshold: number
    button?: number
    onDrag: (dx: number, dy: number) => void
    onTap?: (e: PointerEvent) => void
}

export type DragGesture = {
    start: (e: PointerEvent) => void
    active: Accessor<boolean>
    dragging: Accessor<boolean>
}

const buttonToButtonsMask = (button: number): number => {
    switch (button) {
        case 0:
            return 1
        case 1:
            return 4
        case 2:
            return 2
        case 3:
            return 8
        case 4:
            return 16
        default:
            return 0
    }
}

export function createDragGesture(opts: DragGestureOpts): DragGesture {
    const button = opts.button ?? 0
    const mask = buttonToButtonsMask(button)
    let origin: { x: number; y: number } | null = null
    let last: { x: number; y: number } | null = null
    let detach: (() => void) | null = null
    const [dragging, setDragging] = createSignal(false)
    const [active, setActive] = createSignal(false)

    const reset = () => {
        origin = null
        last = null
        setActive(false)
        setDragging(false)
        if (detach) {
            detach()
            detach = null
        }
    }

    const onMove = (e: PointerEvent) => {
        if (!origin || !last) return
        if (!(e.buttons & mask)) {
            reset()
            return
        }
        if (!dragging()) {
            const dx = e.clientX - origin.x
            const dy = e.clientY - origin.y
            if (Math.hypot(dx, dy) > opts.threshold) setDragging(true)
        }
        if (dragging()) {
            opts.onDrag(e.clientX - last.x, e.clientY - last.y)
        }
        last = { x: e.clientX, y: e.clientY }
    }

    const onUp = (e: PointerEvent) => {
        if (e.button !== button) return
        const wasDragging = dragging()
        reset()
        if (!wasDragging && opts.onTap) opts.onTap(e)
    }

    const onCancel = () => {
        reset()
    }

    const start = (e: PointerEvent) => {
        if (origin) return
        if (e.button !== button) return
        origin = { x: e.clientX, y: e.clientY }
        last = { x: e.clientX, y: e.clientY }
        setActive(true)
        setDragging(false)
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        detach = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
        }
    }

    onCleanup(() => {
        if (detach) detach()
    })

    return { start, active, dragging }
}

// --- BELOW: pending design review. Uncomment one at a time as approved. ---

// import { createMemo } from 'solid-js'
// import type { Bounds } from './geom'

// export type HotkeyMap = Record<string, () => void>
//
// export function createHotkeys(map: HotkeyMap, opts?: { allowModifiers?: boolean }) {
//     createWindowListener('keydown', (e) => {
//         if (!opts?.allowModifiers && (e.metaKey || e.ctrlKey || e.altKey)) return
//         const handler = map[e.key]
//         if (handler) handler()
//     })
// }

// export type Selection<T> = {
//     selectedId: Accessor<string | null>
//     setSelectedId: (id: string | null) => void
//     selected: Accessor<T | null>
//     clear: () => void
// }
//
// export function createSelection<T>(
//     items: () => readonly T[],
//     getId: (item: T) => string,
// ): Selection<T> {
//     const [selectedId, setSelectedId] = createSignal<string | null>(null)
//     const selected = createMemo<T | null>(() => {
//         const id = selectedId()
//         if (!id) return null
//         return items().find((x) => getId(x) === id) ?? null
//     })
//     return {
//         selectedId,
//         setSelectedId,
//         selected,
//         clear: () => setSelectedId(null),
//     }
// }

// export function createBoundsAggregate<T>(
//     items: () => readonly T[],
//     getBounds: (item: T) => Bounds,
// ): Accessor<Bounds | null> {
//     return createMemo(() => {
//         const list = items()
//         if (list.length === 0) return null
//         let minX = Infinity
//         let minY = Infinity
//         let maxX = -Infinity
//         let maxY = -Infinity
//         for (const it of list) {
//             const b = getBounds(it)
//             if (b.x < minX) minX = b.x
//             if (b.y < minY) minY = b.y
//             if (b.x + b.w > maxX) maxX = b.x + b.w
//             if (b.y + b.h > maxY) maxY = b.y + b.h
//         }
//         return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
//     })
// }
