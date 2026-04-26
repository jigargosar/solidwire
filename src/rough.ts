import rough from 'roughjs'
import type { Drawable } from 'roughjs/bin/core'

export const generator = rough.generator()
export const strokeColor = '#374151'
export const fontFamily = "'Kalam', cursive"

export const toPath = (drawable: Drawable) =>
    generator
        .toPaths(drawable)
        .map((p) => p.d)
        .join(' ')

export const roughRect = (w: number, h: number) =>
    toPath(generator.rectangle(0, 0, w, h, { roughness: 1.2, stroke: strokeColor, strokeWidth: 2 }))
