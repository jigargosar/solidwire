import { createSignal, type Accessor } from 'solid-js'
import type { Point } from './geom'

const MIN_SCALE = 0.1
const MAX_SCALE = 8
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export interface Camera {
    tx: Accessor<number>
    ty: Accessor<number>
    scale: Accessor<number>
    screenToWorld: (p: Point) => Point
    worldToScreen: (p: Point) => Point
    panBy: (dx: number, dy: number) => void
    zoomAt: (p: Point, factor: number) => void
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

    const reset = () => {
        setTx(0)
        setTy(0)
        setScale(1)
    }

    return { tx, ty, scale, screenToWorld, worldToScreen, panBy, zoomAt, reset }
}
