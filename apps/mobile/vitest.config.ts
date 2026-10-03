import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    // Only framework-independent domain logic is unit tested here. Component
    // rendering requires the React Native preset and is introduced with the
    // first real screen in phase 13.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});