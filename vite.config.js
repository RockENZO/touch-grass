import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages project sites.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
