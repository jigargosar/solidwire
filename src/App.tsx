import { createMemo } from "solid-js";
import rough from "roughjs";

export default function App() {
    const generator = rough.generator();

    // Unified color for sketchy elements
    const strokeColor = '#4b5563'; // gray-600

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
        <main class="relative h-screen w-screen overflow-hidden bg-white font-sans text-gray-900">

            {/* APP CHROME: Floating Sidebar (Uniform 12px/p-3 spacing) */}
            <aside class="absolute top-3 left-3 bottom-3 w-36 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 shadow-xl z-10 p-3">
                <div class="flex flex-col gap-3">
                    {/* Miniature Widget Card */}
                    <div class="group aspect-square w-full rounded-lg border border-gray-200 bg-white p-2 hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center">
                        <svg viewBox="0 0 80 40" class="w-full">
                            <path
                                d={toPath(miniButton())}
                                fill="none"
                                stroke={strokeColor}
                                stroke-width="1.5"
                            />
                            <text
                                x="40"
                                y="26"
                                text-anchor="middle"
                                style={{ "font-family": "'Kalam', cursive" }}
                                class="text-[10px] fill-gray-600 select-none"
                            >
                                Button
                            </text>
                        </svg>
                    </div>
                </div>
            </aside>

            {/* EDITOR CANVAS */}
            <svg class="h-full w-full block">
                <defs>
                    <pattern id="dotGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        {/* Reduced dot size, preserved blue accent */}
                        <circle cx="2" cy="2" r="0.8" class="fill-blue-300" />
                    </pattern>
                </defs>

                <rect width="100%" height="100%" fill="url(#dotGrid)" />

                {/* Canvas Widget: Button */}
                <g class="cursor-move">
                    <path
                        d={toPath(buttonDrawable())}
                        fill="none"
                        stroke={strokeColor}
                        stroke-width="2.5"
                    />
                    <text
                        x="520"
                        y="350"
                        text-anchor="middle"
                        style={{ "font-family": "'Kalam', cursive" }}
                        class="select-none text-2xl fill-gray-700"
                    >
                        Button
                    </text>
                </g>
            </svg>
        </main>
    );
}