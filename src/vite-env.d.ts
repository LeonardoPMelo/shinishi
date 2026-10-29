/// <reference types="vite/client" />

/** The .glb files present under public/assets/models, e.g. "characters/hana.glb" (vite.config.ts `modelFiles`). */
declare module 'virtual:model-files' {
  const files: string[];
  export default files;
}
