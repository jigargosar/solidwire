import { createSignal, type Accessor } from 'solid-js'
import type { Bounds, Point } from './geom'

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const FIT_PADDING = 40
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export interface Camera {
    tx: Accessor<number>
    ty: Accessor<number>
    scale: Accessor<number>
    screenToWorld: (p: Point) => Point
    worldToScreen: (p: Point) => Point
    panBy: (dx: number, dy: number) => void
    zoomAt: (p: Point, factor: number) => void
    fit: (b: Bounds, vw: number, vh: number) => void
    reset: () => void
}

export function createCamera(): Camera {
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
        const newScale = clamp(oldScale * factor, MIN_SCALE, MAX_SCALE)
        const worldX = (p.x - tx()) / oldScale
        const worldY = (p.y - ty()) / oldScale
        setScale(newScale)
        setTx(p.x - worldX * newScale)
        setTy(p.y - worldY * newScale)
    }

    const fit = (b: Bounds, vw: number, vh: number) => {
        const availW = Math.max(1, vw - 2 * FIT_PADDING)
        const availH = Math.max(1, vh - 2 * FIT_PADDING)
        const sx = availW / Math.max(1, b.w)
        const sy = availH / Math.max(1, b.h)
        const newScale = clamp(Math.min(sx, sy), MIN_SCALE, MAX_SCALE)
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        setScale(newScale)
        setTx(vw / 2 - cx * newScale)
        setTy(vh / 2 - cy * newScale)
    }

    const reset = () => {
        setTx(0)
        setTy(0)
        setScale(1)
    }

    return { tx, ty, scale, screenToWorld, worldToScreen, panBy, zoomAt, fit, reset }
}
