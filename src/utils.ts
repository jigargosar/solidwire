import rough from "roughjs";

const generator = rough.generator();

export const toPath = (drawable: any) =>
    generator.toPaths(drawable).map(p => p.d).join(' ');
