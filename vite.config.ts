import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Dev only: the ?studio page posts PNG captures here; they land in tools/art-staging/. */
function studioSave(): Plugin {
  return {
    name: 'studio-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__studio/save', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9_-]{1,40}$/.test(name)) {
          res.statusCode = 400;
          res.end('bad request');
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const data = Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, '');
          const dir = path.resolve(__dirname, 'tools/art-staging');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(data, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

/**
 * Where the game is served from. "/" locally; on GitHub Pages it is "/<repository>/", set by the deploy
 * workflow through BASE_PATH (see docs/PUBLICAR.md). Asset URLs in code go through src/assetPath.ts.
 */
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  base,
  plugins: [react(), studioSave()],
  optimizeDeps: {
    exclude: ['@react-three/rapier'],
  },
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      output: {
        // Separate long-lived vendor code so game updates don't re-download the engine.
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          physics: ['@react-three/rapier'],
          react: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
