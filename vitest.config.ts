import { defineConfig } from 'vitest/config';

// Unit tests for game logic and data (math answers, practice generator, progression, store).
// happy-dom gives the modules the `window`/`localStorage` they expect in the browser.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
