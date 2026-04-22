import { createMemo } from "solid-js";
import rough from "roughjs";

export default function App() {
    const generator = rough.generator();
    const strokeColor = '#374151';

    const buttonDrawable = createMemo(() =>
        generator.rectangle(400, 300, 240, 80, {
            roughness: 1.5,
            stroke: strokeColor,
            strokeWidth: 2
        })
    );

    const miniButton = createMemo(() =>
        generator.rectangle(5, 5, 70, 30, {
            roughness: 1.0,
            stroke: strokeColor,
            strokeWidth: 1.5
        })
    );

    const toPath = (drawable: any) =>
        generator.toPaths(drawable).map(p => p.d).join(' ');

    return (
        <main class="relative h-screen w-screen overflow-hidden bg-gray-200 font-sans text-gray-900">

            {/* LIFTED SIDEBAR: Shadow on all directions */}
            <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
                <div class="flex flex-col gap-3">
                    <div class="group aspect-square w-full rounded-lg border border-gray-300 bg-gray-50 p-2 hover:border-blue-500 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm">
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path d={toPath(miniButton())} fill="none" stroke={strokeColor} stroke-width="1.5" />
                            <text x="40" y="26" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="text-[10px] fill-gray-600 select-none font-bold">Button</text>
                        </svg>
                    </div>
                </div>
            </aside>

            {/* CANVAS */}
            <svg class="h-full w-full block bg-gray-100">
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-400" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                <g class="cursor-move">
                    <path d={toPath(buttonDrawable())} fill="none" stroke={strokeColor} stroke-width="2.5" />
                    <text x="520" y="350" text-anchor="middle" style={{ "font-family": "'Kalam', cursive" }} class="select-none text-2xl fill-gray-800 font-bold">Button</text>
                </g>
            </svg>
        </main>
    );
}