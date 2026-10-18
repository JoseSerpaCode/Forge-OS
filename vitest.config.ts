import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/cypress/**', 
      '**/.{idea,git,cache,output,temp}/**', 
      '**/tests/e2e/**', // Exclude Playwright tests from Vitest
      // Los worktrees de las sesiones de Claude Code viven dentro del repo; sin
      // esto, vitest corre también sus copias de los tests.
      '**/.claude/**',
    ],
  },
});
