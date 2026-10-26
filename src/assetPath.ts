/**
 * URL of a file in public/, valid at any deploy path. The game is served from "/" locally and from
 * "/<repository>/" on GitHub Pages (vite.config.ts `base`); a hard-coded "/assets/..." only works at the root.
 * CSS url() and index.html links are rewritten by Vite; strings in code must go through this.
 */
export function asset(path: string) {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '');
}
