import rough from "roughjs";
import {Drawable} from "roughjs/bin/core";

const generator = rough.generator();

export function renderDrawable(drawable: Drawable) {
    return generator.toPaths(drawable).map((p) => (
        <path
            d={p.d}
            stroke={p.stroke}
            stroke-width={p.strokeWidth}
            fill={p.fill}
        />
    ));
}

export const toPath = (drawable: any) =>
    generator.toPaths(drawable).map(p => p.d).join(' ');
