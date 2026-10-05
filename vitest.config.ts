import { defineConfig } from 'vitest/config';

// Unit tests live in tests/unit/. Playwright's specs live in tests/e2e/
// and run separately (npm run test:e2e), so keep Vitest out of them.
export default defineConfig({
  test: { include: ['tests/unit/**/*.test.ts'] },
});
