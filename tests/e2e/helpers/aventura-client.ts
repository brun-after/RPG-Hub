// Bootstrap de um cliente da aventura num BrowserContext próprio, com rede
// hermética (fixtures REST + broker Phoenix) e sessão injetada. Traz também as
// sondas usadas pelo spec: digest de entidades, stats do RTNet, FPS e a sonda
// de animações/popups no cliente receptor.
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { BrokerPhoenix } from './phoenix-broker';
import { instalarRedeHermetica } from './supabase-fixtures';
import { RPG_ID } from '../../sim/fixtures-aventura';

export interface ClienteAventura {
  context: BrowserContext;
  page: Page;
  uid: string;
  charNome: string;
  pageErrors: string[];
  consoleErrors: string[];
}

// Ruído aceitável de console num ambiente hermético (recursos abortados etc.).
const RUIDO = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /fetch/i,
  /hcaptcha/i,
  /localhost detected/i,
  /service.?worker/i,
  /WebSocket/i,          // fechamentos de socket durante teardown
  /ERR_FAILED/i,         // requests abortados pela rede hermética
];

export function errosReais(erros: string[]): string[] {
  return erros.filter(e => !RUIDO.some(rx => rx.test(e)));
}

export async function novoClienteAventura(
  browser: Browser,
  broker: BrokerPhoenix,
  opts: { uid: string; charNome: string },
): Promise<ClienteAventura> {
  const context = await browser.newContext();
  await instalarRedeHermetica(context, opts.uid);
  await context.routeWebSocket(/realtime\/v1\/websocket/, broker.handler);

  await context.addInitScript(({ uid, charNome }) => {
    // Shape exato que auth.js grava/restaura (auth.js:143-149, :364-369)
    localStorage.setItem('rpghub_session', JSON.stringify({
      user: { id: uid, email: `${uid}@sim.test` },
      access_token: `tok-${uid}`,
      refresh_token: `ref-${uid}`,
      nickname: charNome,
    }));
    // Camada de mundo em canvas 2D — sem WebGL para o mundo (headless-friendly)
    localStorage.setItem('avt_renderer', 'canvas');
  }, { uid: opts.uid, charNome: opts.charNome });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('/');
  // Sessão restaurada → tela de auth some e o app inicializa
  await page.waitForFunction(() => (window as any).SESSION?.user?.id, null, { timeout: 20_000 });

  return { context, page, uid: opts.uid, charNome: opts.charNome, pageErrors, consoleErrors };
}

// Entrada programática na aventura — espelha o caminho real de
// _avtMenuEntrarJogo sem depender da UI do menu. Resolve quando o host da
// sessão é conhecido (evento rtnet:hostchange) ou após o grace timeout.
export async function entrarAventura(cliente: ClienteAventura) {
  await cliente.page.evaluate(async ({ rpgId, charNome }) => {
    const w = window as any;
    const hostChange = new Promise<void>(res => {
      addEventListener('rtnet:hostchange', () => res(), { once: true });
    });
    await w._avtCarregarDados(rpgId);
    w.AVT_STATE.myCharNome = charNome;
    w.AVT_STATE.npcSyncEnabled = false;   // state tick = autoridade única de posição
    w.AVT_STATE.npcIaAtiva = false;       // determinismo: IA não interfere na sincronia
    w._avtMostrarAventuraScreen();
    await w._avtIniciarRTNet(rpgId, w._avtIniciarCanvas);
    await Promise.race([hostChange, new Promise(r => setTimeout(r, 12_000))]);
  }, { rpgId: RPG_ID, charNome: cliente.charNome });
}

// ── Sondas ───────────────────────────────────────────────────────────────────

// Digest canônico (mesmos campos do state tick; renderX/renderY fora).
export function digestDe(page: Page): Promise<string> {
  return page.evaluate(() => {
    const S = (window as any).AVT_STATE;
    return (S?.entidades || [])
      .filter((e: any) => !e.escondido)
      .map((e: any) => [e.id, Math.round(e.x), Math.round(e.y), e.hp, e.hpMax, e.tipo].join(':'))
      .sort()
      .join('|');
  });
}

// Divergência máxima (em células) entre dois digests, por entidade comum.
export function divergenciaMaxima(digestA: string, digestB: string): number {
  const parse = (d: string) => {
    const m = new Map<string, { x: number; y: number }>();
    for (const linha of d.split('|').filter(Boolean)) {
      const [id, x, y] = linha.split(':');
      m.set(id, { x: Number(x), y: Number(y) });
    }
    return m;
  };
  const a = parse(digestA); const b = parse(digestB);
  let max = 0;
  for (const [id, pa] of a) {
    const pb = b.get(id);
    if (!pb) continue;
    max = Math.max(max, Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
  }
  return max;
}

export const souHostDaFase = (page: Page) =>
  page.evaluate(() => !!(window as any)._avtSouHostDaFaseAtual?.());

export const statsRtnet = (page: Page) =>
  page.evaluate(() => (window as any).RTNet?.getStats?.() ?? null);

export const fpsAtual = (page: Page) =>
  page.evaluate(() => (window as any).AVT_PERF?.fpsAtual?.() ?? 0);

export const broadcastsPendentes = (page: Page) =>
  page.evaluate(() => ((window as any).__avtPendingBroadcasts || []).length);

export const faseAtual = (page: Page) =>
  page.evaluate(() => (window as any).AVT_STATE?._faseAtualId ?? null);

// Instala no cliente RECEPTOR: registra animações de skill recebidas pela
// rede, popups de dano inseridos no DOM e o contador de FX one-shot vivos.
export async function instalarSondaAnim(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__animRecebidas = [];
    const original = w.avtReceberSkillAnim;
    w.avtReceberSkillAnim = function (payload: any) {
      w.__animRecebidas.push(payload);
      return original?.call(this, payload);
    };

    w.__danoPopups = 0;
    const overlay = document.getElementById('avt-dados-overlay');
    if (overlay) {
      new MutationObserver(muts => {
        for (const m of muts) {
          m.addedNodes.forEach((n: any) => {
            if (n?.classList?.contains?.('avt-dano-popup') ||
                n?.classList?.contains?.('avt-dano-popup-baixo')) w.__danoPopups++;
          });
        }
      }).observe(overlay, { childList: true, subtree: true });
    }

    w.__psAtivo = () => (w._PS_AVT_ACTIVE?.length ?? 0);
  });
}

export const animRecebidas = (page: Page) =>
  page.evaluate(() => (window as any).__animRecebidas ?? []);

export const danoPopups = (page: Page) =>
  page.evaluate(() => (window as any).__danoPopups ?? 0);

export const fxAtivos = (page: Page) =>
  page.evaluate(() => (window as any).__psAtivo?.() ?? 0);
