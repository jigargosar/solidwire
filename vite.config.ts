import tailwindcss from '@tailwindcss/vite';
import {defineConfig} from 'vite';
import solid from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';


export default defineConfig({
    plugins: [
        devtools({
            "autoname": true,
            "locator": {
                "targetIDE": "vscode",
                "componentLocation":true,
                "key":"Control",
                "jsxLocation" : true,
            },

        })
        , solid()
        , tailwindcss()
    ],
    server: {
        port: 3000,
    },
    build: {
        target: 'esnext',
    },
});
