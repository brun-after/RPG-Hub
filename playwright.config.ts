import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

// Em ambientes sandbox (ex.: Claude Code remoto) não há download de browser,
// mas existe um Chromium pré-provisionado em /opt/pw-browsers/chromium.
// Quando a instalação padrão do Playwright está presente (CI, máquina local
// com `npx playwright install chromium`), ela tem prioridade.
function executablePathFallback(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require('playwright-core');
    if (fs.existsSync(chromium.executablePath())) return undefined;
  } catch { /* segue para o fallback */ }
  const local = '/opt/pw-browsers/chromium';
  return fs.existsSync(local) ? local : undefined;
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: {
      executablePath: executablePathFallback(),
    },
  },
  // Serve o build de produção (dist/) — rodar `npm run build` antes.
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
