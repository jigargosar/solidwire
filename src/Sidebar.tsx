// Sidebar.tsx
import { For } from "solid-js";
import { tools } from "./tools";
import { getActiveTool, toggleTool, ToolKind } from "./model";
import { Drawable } from "roughjs/bin/core";
import {renderDrawable} from "./rough-utils";


// ToolButton subcomponent
function ToolButton(props: { type: ToolKind; label: string; mini: Drawable }) {
    return (
        <div
            onClick={() => toggleTool(props.type)}
            class={`group aspect-square w-full rounded-lg border p-2 transition-colors cursor-pointer flex flex-col items-center justify-center shadow-sm ${
                getActiveTool() === props.type
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-300 bg-gray-50 hover:border-blue-500"
            }`}
        >
            <svg viewBox="0 0 80 40" class="w-full">
                {renderDrawable(props.mini)}
                <text
                    x="40"
                    y="26"
                    text-anchor="middle"
                    style={{ "font-family": "'Kalam', cursive" }}
                    class="text-[10px] fill-gray-600 select-none font-bold"
                >
                    {props.label}
                </text>
            </svg>
        </div>
    );
}

// Sidebar component
export default function Sidebar() {
    return (
        <aside class="absolute top-3 left-3 bottom-3 w-28 overflow-y-auto rounded-xl border border-gray-400 bg-gray-200 z-10 p-3 shadow-[0_0_30px_-5px_rgba(0,0,0,0.25)]">
            <div class="flex flex-col gap-3">
                <For each={tools}>
                    {(t) => <ToolButton type={t.type} label={t.label} mini={t.mini} />}
                </For>
            </div>
        </aside>
    );
}
