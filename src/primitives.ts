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

// --- BELOW: pending design review (Items 2–14). Uncomment one at a time as approved. ---

// import { createMemo } from 'solid-js'
// import type { Bounds } from './geom'

// export type PanGestureOpts = {
//     threshold: number
//     onPan: (dx: number, dy: number) => void
//     onTap?: (e: PointerEvent) => void
// }
//
// export type PanGesture = {
//     start: (e: PointerEvent) => void
//     move: (e: PointerEvent) => void
//     end: (e: PointerEvent) => void
//     active: Accessor<boolean>
//     panning: Accessor<boolean>
// }
//
// export function createPanGesture(opts: PanGestureOpts): PanGesture {
//     let origin: { x: number; y: number } | null = null
//     const [panning, setPanning] = createSignal(false)
//     const [active, setActive] = createSignal(false)
//
//     const reset = () => {
//         origin = null
//         setActive(false)
//         setPanning(false)
//     }
//
//     const start = (e: PointerEvent) => {
//         origin = { x: e.clientX, y: e.clientY }
//         setActive(true)
//         setPanning(false)
//     }
//
//     const move = (e: PointerEvent) => {
//         if (!origin) return
//         if (!(e.buttons & 1)) {
//             reset()
//             return
//         }
//         if (!panning()) {
//             const dx = e.clientX - origin.x
//             const dy = e.clientY - origin.y
//             if (Math.hypot(dx, dy) > opts.threshold) setPanning(true)
//         }
//         if (panning()) opts.onPan(e.movementX, e.movementY)
//     }
//
//     const end = (e: PointerEvent) => {
//         const wasPanning = panning()
//         reset()
//         if (!wasPanning && opts.onTap) opts.onTap(e)
//     }
//
//     return { start, move, end, active, panning }
// }

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
