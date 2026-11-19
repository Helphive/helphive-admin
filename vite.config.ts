import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: { '@': path.resolve(__dirname, './src') },
    },
    server: { port: 3001 },
    preview: { port: 3001 },
    build: {
        outDir: 'dist',
        sourcemap: true,
        // ECharts (about 560 kB minified) is its own chunk, loaded only with chart pages.
        chunkSizeWarningLimit: 650,
        rollupOptions: {
            output: {
                // Long-lived vendor chunks: app code changes far more often than these.
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (/node_modules\/(echarts|zrender|tslib)\//.test(id)) return 'echarts';
                    if (
                        /node_modules\/(@mui|@emotion|@popperjs|react-transition-group|stylis)/.test(
                            id
                        )
                    )
                        return 'mui';
                    if (/node_modules\/@phosphor-icons\//.test(id)) return 'icons';
                    if (
                        /node_modules\/(react|react-dom|scheduler|react-router|@remix-run|react-redux|redux|@reduxjs|reselect|immer|use-sync-external-store)\//.test(
                            id
                        )
                    )
                        return 'react';
                    return undefined;
                },
            },
        },
    },
});
