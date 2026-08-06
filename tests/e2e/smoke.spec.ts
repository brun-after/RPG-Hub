// Smoke E2E: o build de produção (vite preview) sobe, o boot do bundle roda
// sem exceção não tratada e a tela de login renderiza. Este teste conversa com
// o Supabase real ao carregar, então as asserções toleram falhas de REDE —
// só exceções de JavaScript reprovam.
import { test, expect } from '@playwright/test';

// Erros de console que são rede/recurso, não bug de JS.
const RUIDO_DE_REDE = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /ERR_INTERNET_DISCONNECTED/i,
  /fetch/i,
  /hcaptcha/i,
  /localhost detected/i, // hCaptcha: "Warning: localhost detected. Please use a valid host."
  /service.?worker/i,
];

test('boot do app: tela de login visível e sem exceções de JS', async ({ page }) => {
  const excecoes: string[] = [];
  const errosConsole: string[] = [];

  page.on('pageerror', err => excecoes.push(String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') errosConsole.push(msg.text());
  });

  await page.goto('/');

  // Sem sessão salva, o boot deve exibir a tela de autenticação.
  const telaAuth = page.locator('#tela-auth');
  await expect(telaAuth).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#auth-email')).toBeVisible();

  // O hub (pós-login) não pode aparecer sem sessão.
  await expect(page.locator('#hub')).toBeHidden();

  // Exceções não tratadas de JS reprovam sempre.
  expect(excecoes, `exceções de página: ${excecoes.join(' | ')}`).toEqual([]);

  // Erros de console que não sejam ruído de rede também reprovam.
  const errosReais = errosConsole.filter(e => !RUIDO_DE_REDE.some(rx => rx.test(e)));
  expect(errosReais, `erros de console: ${errosReais.join(' | ')}`).toEqual([]);
});
