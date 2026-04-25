export type Point = { x: number; y: number }

export type Bounds = { x: number; y: number; w: number; h: number }

export function boundsFromPoints(a: Point, b: Point): Bounds {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y),
    }
}
