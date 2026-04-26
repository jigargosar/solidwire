import { createSignal, type Accessor } from 'solid-js'
import type { Bounds, Point } from './geom'

export const MIN_SCALE = 0.1
const MAX_SCALE = 4
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export interface Camera {
    tx: Accessor<number>
    ty: Accessor<number>
    scale: Accessor<number>
    screenToWorld: (p: Point) => Point
    worldToScreen: (p: Point) => Point
    panBy: (dx: number, dy: number) => void
    zoomAt: (p: Point, factor: number) => void
    fit: (b: Bounds, vp: Bounds) => void
    reset: (center: Point) => void
}

export function createCamera(getMinScale: () => number = () => MIN_SCALE): Camera {
    const [tx, setTx] = createSignal(0)
    const [ty, setTy] = createSignal(0)
    const [scale, setScale] = createSignal(1)

    const screenToWorld = (p: Point): Point => ({
        x: (p.x - tx()) / scale(),
        y: (p.y - ty()) / scale(),
    })

    const worldToScreen = (p: Point): Point => ({
        x: p.x * scale() + tx(),
        y: p.y * scale() + ty(),
    })

    const panBy = (dx: number, dy: number) => {
        setTx(tx() + dx)
        setTy(ty() + dy)
    }

    const zoomAt = (p: Point, factor: number) => {
        const oldScale = scale()
        const newScale = clamp(oldScale * factor, getMinScale(), MAX_SCALE)
        const worldX = (p.x - tx()) / oldScale
        const worldY = (p.y - ty()) / oldScale
        setScale(newScale)
        setTx(p.x - worldX * newScale)
        setTy(p.y - worldY * newScale)
    }

    const fit = (b: Bounds, vp: Bounds) => {
        const sx = vp.w / Math.max(1, b.w)
        const sy = vp.h / Math.max(1, b.h)
        const newScale = Math.min(sx, sy)
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        setScale(newScale)
        setTx(vp.x + vp.w / 2 - cx * newScale)
        setTy(vp.y + vp.h / 2 - cy * newScale)
    }

    const reset = (center: Point) => zoomAt(center, 1 / scale())

    return { tx, ty, scale, screenToWorld, worldToScreen, panBy, zoomAt, fit, reset }
}
