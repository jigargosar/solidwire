import { onCleanup } from 'solid-js'

export function createWindowListener<K extends keyof WindowEventMap>(
    type: K,
    handler: (e: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
) {
    window.addEventListener(type, handler, options)
    onCleanup(() => window.removeEventListener(type, handler, options))
}
