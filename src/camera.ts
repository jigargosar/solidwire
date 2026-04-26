import { createSignal, type Accessor } from 'solid-js'
import type { Bounds, Point } from './geom'

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const ZOOM_SENSITIVITY = 0.01
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export interface CameraOpts {
    worldBounds: () => Bounds | null
    screenBounds: () => Bounds | null
}

export interface Camera {
    tx: Accessor<number>
    ty: Accessor<number>
    scale: Accessor<number>
    screenToWorld: (p: Point) => Point
    worldToScreen: (p: Point) => Point
    panBy: (dx: number, dy: number) => void
    zoomAt: (p: Point, factor: number) => void
    zoomByDelta: (p: Point, deltaY: number) => void
    fit: () => void
    reset: () => void
}

export function createCamera(opts: CameraOpts): Camera {
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

    const fitScale = (b: Bounds, area: Bounds) =>
        Math.min(area.w / Math.max(1, b.w), area.h / Math.max(1, b.h))

    const dynamicMinScale = () => {
        const b = opts.worldBounds()
        const area = opts.screenBounds()
        if (!b || !area) return MIN_SCALE
        return Math.min(MIN_SCALE, fitScale(b, area))
    }

    const panBy = (dx: number, dy: number) => {
        setTx(tx() + dx)
        setTy(ty() + dy)
    }

    const zoomAt = (p: Point, factor: number) => {
        const oldScale = scale()
        const newScale = clamp(oldScale * factor, dynamicMinScale(), MAX_SCALE)
        const worldX = (p.x - tx()) / oldScale
        const worldY = (p.y - ty()) / oldScale
        setScale(newScale)
        setTx(p.x - worldX * newScale)
        setTy(p.y - worldY * newScale)
    }

    const zoomByDelta = (p: Point, deltaY: number) => {
        zoomAt(p, Math.exp(-deltaY * ZOOM_SENSITIVITY))
    }

    const fit = () => {
        const b = opts.worldBounds()
        const area = opts.screenBounds()
        if (!b || !area) return
        const newScale = fitScale(b, area)
        const cx = b.x + b.w / 2
        const cy = b.y + b.h / 2
        setScale(newScale)
        setTx(area.x + area.w / 2 - cx * newScale)
        setTy(area.y + area.h / 2 - cy * newScale)
    }

    const reset = () => {
        const area = opts.screenBounds()
        if (!area) return
        zoomAt({ x: area.x + area.w / 2, y: area.y + area.h / 2 }, 1 / scale())
    }

    return {
        tx,
        ty,
        scale,
        screenToWorld,
        worldToScreen,
        panBy,
        zoomAt,
        zoomByDelta,
        fit,
        reset,
    }
}
