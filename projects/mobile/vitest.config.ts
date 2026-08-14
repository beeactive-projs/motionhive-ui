import { defineConfig } from 'vitest/config';

// @ionic/angular ships directory-style ESM imports (@ionic/core/components)
// that Node's resolver rejects when the package is externalized — inline the
// Ionic packages so Vite resolves them instead.
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: [/@ionic[\\/]/, /ionicons[\\/]/, /@stencil[\\/]/],
      },
    },
  },
});
