// vite.config.js
import { defineConfig } from 'vite'
import { v4wp } from '@kucrut/vite-for-wp';
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets'

export default defineConfig({
    plugins: [
        v4wp( {
            input: {
                'simebv-viewer-lib': 'src/js/simebv-viewer.js',
                'simebv-viewer-init': 'src/js/simebv-init.js',
            },
            outDir: 'dist',
        } ),
        nodePolyfills({
            include: ['fs', 'http', 'https'],
        }),
        // libAssetsPlugin({
        //     include: [/\.pfb$/, /\.bcmap$/, /\.map$/, /\.mjs$/, /\.woff2$/, /\.ttf$/],
        // }),
    ],
    server: {
        cors: {
            origin: [
                /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
                /^https?:\/\/(?:www\.)?embedebooks-wp\.it/,
            ],
        },
        origin: 'http://www.embedebooks-wp.it',
    },
    esbuild: {
        // supported: {
        //     'top-level-await': true,
        // },
        minifyIdentifiers: false,
        keepNames: true,
    },
    build: {
        // lib: {
        //     entry: {'simebv-viewer-lib': 'src/js/simebv-viewer.js'},
        //     formats: ['es'],
        // },
        minify: true,
        // terserOptions: {
        //     mangle: {
        //         reserved: ["Reader", "initializeViewer"],
        //         keep_classnames: /Reader/,
        //         keep_fnames: /initializeViewer/,
        //         properties: {
        //             reserved: ["Reader", "initializeViewer", "__", "_x", "_n", "sprintf", "source_url"],
        //         },
        //     },
        //     // compress: {
        //     //     keep_classnames: /Reader/,
        //     //     keep_fnames: /initializeViewer/,
        //     // },
        // },
        sourcemap: false,
        manifest: true,
        chunkSizeWarningLimit: 610,
        rollupOptions: {
            output: {
                entryFileNames: "[name].js",
                // exports: "named",
            },
            preserveEntrySignatures: "strict",
        },
    },
});