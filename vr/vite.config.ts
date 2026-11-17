/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  plugins: [iwsdkDev()],
  server: {
    host: '0.0.0.0',
    port: 8081,
    open: false,
    // Dev only: VR_API_TARGET=http://localhost:3000 sends /api to a running LafaekTOEFL app, so the
    // emulator uses real study-plan data. The app checks the request origin, so it is rewritten.
    proxy: process.env.VR_API_TARGET
      ? {
          '/api': {
            target: process.env.VR_API_TARGET,
            changeOrigin: true,
            configure: (proxy) =>
              proxy.on('proxyReq', (req) => {
                req.setHeader('origin', process.env.VR_API_TARGET!);
                // Dev only: VR_DEV_COOKIE signs the emulator in (for automated hand tests).
                if (process.env.VR_DEV_COOKIE) req.setHeader('cookie', process.env.VR_DEV_COOKIE);
              }),
          },
        }
      : undefined,
  },
  build: {
    // Served by the LafaekTOEFL Next.js app at /vr/room (see next.config.ts rewrites).
    outDir: '../public/vr/room',
    emptyOutDir: true,
    sourcemap: false,
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (its own three vs the app's super-three alias). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  // Production is served at /vr/room by the Next.js app; the managed dev server stays at /.
  base: command === 'build' ? '/vr/room/' : '/',
}));
