// Simulação de jogabilidade da aventura REAL "The One" — 2 clientes no build
// de produção, rede hermética servindo a linha real de rpg_registry exportada
// do banco (dungeon 51×37, 33 inimigos com estado persistido, fase extra,
// level_config real). Não é um teste de regressão: é uma sessão de jogo
// roteirizada que coleta erros/divergências para o relatório de bugs.
import fs from 'node:fs';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { criarBrokerPhoenix, type BrokerPhoenix } from './helpers/phoenix-broker';
import {
  instalarRedeTheOne, THEONE_RPG_ID, SKILL_IDS, type ReqLogEntry,
} from './helpers/theone-fixtures';

// Dossiê da sessão (achados + tráfego REST) — vai para o output dir do Playwright.
const OUT_DIR = 'test-results';

const RUIDO = [
  /Failed to load resource/i, /net::ERR_/i, /fetch/i, /hcaptcha/i,
  /localhost detected/i, /service.?worker/i, /WebSocket/i, /ERR_FAILED/i,
];
const errosReais = (erros: string[]) => erros.filter(e => !RUIDO.some(rx => rx.test(e)));

interface Cliente {
  context: BrowserContext; page: Page; uid: string; charNome: string;
  pageErrors: string[]; consoleErrors: string[]; consoleWarnings: string[];
  reqLog: ReqLogEntry[];
}

async function novoCliente(browser: Browser, broker: BrokerPhoenix,
                           opts: { uid: string; charNome: string }): Promise<Cliente> {
  const context = await browser.newContext();
  const reqLog: ReqLogEntry[] = [];
  await instalarRedeTheOne(context, opts.uid, reqLog);
  await context.routeWebSocket(/realtime\/v1\/websocket/, broker.handler);

  await context.addInitScript(({ uid, charNome }) => {
    localStorage.setItem('rpghub_session', JSON.stringify({
      user: { id: uid, email: `${uid}@sim.test` },
      access_token: `tok-${uid}`, refresh_token: `ref-${uid}`,
      nickname: charNome,
    }));
    localStorage.setItem('avt_renderer', 'canvas');
  }, { uid: opts.uid, charNome: opts.charNome });

  const page = await context.newPage();
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  page.on('pageerror', err => pageErrors.push(String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  await page.goto('/');
  await page.waitForFunction(() => (window as any).SESSION?.user?.id, null, { timeout: 20_000 });
  return { context, page, uid: opts.uid, charNome: opts.charNome,
           pageErrors, consoleErrors, consoleWarnings, reqLog };
}

async function entrar(cliente: Cliente) {
  await cliente.page.evaluate(async ({ rpgId, charNome }) => {
    const w = window as any;
    // Sonda: registra o stack de todo chamador dos writers de theme_json
    // (o accessor global rebinda a function declaration do módulo).
    w.__regSaves = [];
    for (const fn of ['_avtSalvarDungeon', '_avtSalvarThemeJson']) {
      const orig = w[fn];
      if (typeof orig === 'function') {
        w[fn] = function (...args: any[]) {
          try { w.__regSaves.push(fn + ' :: ' + (new Error().stack || '').split('\n').slice(2, 7).join(' | ')); } catch(_) {}
          return orig.apply(this, args);
        };
      }
    }
    const hostChange = new Promise<void>(res => {
      addEventListener('rtnet:hostchange', () => res(), { once: true });
    });
    await w._avtCarregarDados(rpgId);
    w.AVT_STATE.myCharNome = charNome;
    w.AVT_STATE.npcSyncEnabled = false;
    w.AVT_STATE.npcIaAtiva = false;
    w._avtMostrarAventuraScreen();
    await w._avtIniciarRTNet(rpgId, w._avtIniciarCanvas);
    await Promise.race([hostChange, new Promise(r => setTimeout(r, 12_000))]);
  }, { rpgId: THEONE_RPG_ID, charNome: cliente.charNome });
}

const digestDe = (page: Page) => page.evaluate(() => {
  const S = (window as any).AVT_STATE;
  return (S?.entidades || [])
    .filter((e: any) => !e.escondido)
    .map((e: any) => [e.id, Math.round(e.x), Math.round(e.y), e.hp, e.hpMax, e.tipo].join(':'))
    .sort().join('|');
});

function divergenciaMaxima(a0: string, b0: string): number {
  const parse = (d: string) => {
    const m = new Map<string, { x: number; y: number }>();
    for (const l of d.split('|').filter(Boolean)) {
      const [id, x, y] = l.split(':');
      m.set(id, { x: Number(x), y: Number(y) });
    }
    return m;
  };
  const a = parse(a0), b = parse(b0);
  let max = 0;
  for (const [id, pa] of a) {
    const pb = b.get(id);
    if (pb) max = Math.max(max, Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
  }
  return max;
}

test.describe('the one: sessão de jogo simulada', () => {
  test.setTimeout(240_000);
  let a: Cliente; let b: Cliente;
  const achados: any = { observacoes: [] };

  test.afterEach(async () => {
    // Dossiê da sessão para o relatório (mesmo em caso de falha do teste)
    const tally = (log: ReqLogEntry[]) => {
      const t: Record<string, number> = {};
      for (const r of log) {
        const path = r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        const k = `${r.method} ${path}`;
        t[k] = (t[k] || 0) + 1;
      }
      return t;
    };
    achados.reqA = a ? tally(a.reqLog) : null;
    achados.reqB = b ? tally(b.reqLog) : null;
    const escritas = (log: ReqLogEntry[]) => log
      .filter(r => r.method !== 'GET' && !r.url.includes('/auth/'))
      .map(r => ({ m: r.method, u: r.url.replace(/^https?:\/\/[^/]+/, ''), body: r.body }));
    achados.escritasA = a ? escritas(a.reqLog) : null;
    achados.escritasB = b ? escritas(b.reqLog) : null;
    achados.pageErrorsA = a?.pageErrors; achados.pageErrorsB = b?.pageErrors;
    achados.consoleErrorsA = a ? errosReais(a.consoleErrors) : null;
    achados.consoleErrorsB = b ? errosReais(b.consoleErrors) : null;
    achados.consoleWarningsA = a?.consoleWarnings?.slice(0, 60);
    achados.consoleWarningsB = b?.consoleWarnings?.slice(0, 60);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(`${OUT_DIR}/theone-sim-report.json`, JSON.stringify(achados, null, 2));
    await a?.context.close().catch(() => {});
    await b?.context.close().catch(() => {});
  });

  test('carga real, host, movimento, skill, morte de inimigo e vitalidade', async ({ browser }) => {
    const broker = criarBrokerPhoenix();

    // ── 1. Ares entra primeiro (solo → host) ────────────────────────────────
    a = await novoCliente(browser, broker, { uid: 'uid-ares', charNome: 'Ares' });
    await entrar(a);

    // Estado carregado a partir do dado REAL: 4 jogadores + 33 inimigos
    const cargaA = await a.page.evaluate(() => {
      const S = (window as any).AVT_STATE;
      return {
        rpgId: S.rpgId, nome: S.rpg?.name,
        dungeonW: S.dungeon?.w, dungeonH: S.dungeon?.h,
        jogadores: S.entidades.filter((e: any) => e.tipo === 'jogador').map((e: any) => e.nome),
        inimigos: S.entidades.filter((e: any) => e.tipo === 'inimigo').length,
        inimigosMortos: S.entidades.filter((e: any) => e.tipo === 'inimigo' && (e.hp <= 0 || e.morto)).length,
        skills: S.skills?.length, fase: S._faseAtualId,
        chests: S.dungeon?._chestPositions?.length,
        hpAres: S.entidades.find((e: any) => e.nome === 'Ares')?.hp,
        hpMaxAres: S.entidades.find((e: any) => e.nome === 'Ares')?.hpMax,
      };
    });
    achados.carga = cargaA;
    expect(cargaA.rpgId).toBe(THEONE_RPG_ID);
    expect(cargaA.jogadores).toContain('Ares');
    expect(cargaA.inimigos).toBeGreaterThan(0);

    // ── 2. Haima entra e descobre o host ────────────────────────────────────
    b = await novoCliente(browser, broker, { uid: 'uid-haima', charNome: 'Haima Volkov' });
    await entrar(b);

    await expect.poll(async () => {
      const [hA, hB] = await Promise.all([
        a.page.evaluate(() => !!(window as any)._avtSouHostDaFaseAtual?.()),
        b.page.evaluate(() => !!(window as any)._avtSouHostDaFaseAtual?.()),
      ]);
      return `${hA}|${hB}`;
    }, { timeout: 20_000, message: 'exatamente um host de fase' }).toMatch(/^(true\|false|false\|true)$/);

    achados.rtnetA = await a.page.evaluate(() => (window as any).RTNet?.getStats?.() ?? null);
    achados.rtnetB = await b.page.evaluate(() => (window as any).RTNet?.getStats?.() ?? null);
    achados.broadcastsPendentesA = await a.page.evaluate(() => ((window as any).__avtPendingBroadcasts || []).length);
    achados.broadcastsPendentesB = await b.page.evaluate(() => ((window as any).__avtPendingBroadcasts || []).length);

    await expect.poll(async () => {
      const [dA, dB] = await Promise.all([digestDe(a.page), digestDe(b.page)]);
      return divergenciaMaxima(dA, dB);
    }, { timeout: 20_000, message: 'estado inicial converge' }).toBeLessThanOrEqual(1);

    // ── 3. Ares caminha pelo dungeon real (procura destino alcançável) ──────
    const mov = await a.page.evaluate(() => {
      const w = window as any;
      const ares = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      const x0 = Math.round(ares.x), y0 = Math.round(ares.y);
      const candidatos = [[4,0],[0,3],[3,2],[-3,0],[0,-2],[5,1],[2,4],[-2,3],[6,0],[1,1]];
      for (const [dx, dy] of candidatos) {
        const caminho = w._avtPathfindSimples(x0, y0, x0 + dx, y0 + dy);
        if (caminho?.length > 2) {
          w.AVT_STATE._caminhoDestino = caminho.slice(1);
          return { de: { x: x0, y: y0 }, para: { x: x0 + dx, y: y0 + dy }, caminhoLen: caminho.length };
        }
      }
      return { de: { x: x0, y: y0 }, para: null, caminhoLen: 0 };
    });
    achados.movimento = mov;
    expect(mov.caminhoLen, 'nenhum destino alcançável a partir do spawn').toBeGreaterThan(2);

    await expect.poll(async () => {
      const [dA, dB] = await Promise.all([digestDe(a.page), digestDe(b.page)]);
      return divergenciaMaxima(dA, dB);
    }, { timeout: 25_000, message: 'movimento sincronizado' }).toBeLessThanOrEqual(1);

    await expect.poll(() => a.page.evaluate(() => {
      const w = window as any;
      const ares = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      return (ares._waypoints?.length ?? 0) + (w.AVT_STATE._caminhoDestino?.length ?? 0);
    }), { timeout: 25_000 }).toBe(0);

    // ── 4. Sonda de animação no receptor + ataque com skill real ────────────
    await b.page.evaluate(() => {
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
          for (const m of muts) m.addedNodes.forEach((n: any) => {
            if (n?.classList?.contains?.('avt-dano-popup') ||
                n?.classList?.contains?.('avt-dano-popup-baixo')) w.__danoPopups++;
          });
        }).observe(overlay, { childList: true, subtree: true });
      }
      w.__psAtivo = () => (w._PS_AVT_ACTIVE?.length ?? 0);
    });

    const alvo = await a.page.evaluate(({ skillId }) => {
      const w = window as any;
      const ares = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      const vivos = w.AVT_STATE.entidades.filter((e: any) => e.tipo === 'inimigo' && e.hp > 0 && !e.escondido);
      vivos.sort((p: any, q: any) =>
        (Math.abs(p.x - ares.x) + Math.abs(p.y - ares.y)) - (Math.abs(q.x - ares.x) + Math.abs(q.y - ares.y)));
      const alvo = vivos[0];
      return alvo ? { id: alvo.id, nome: alvo.nome, hp: alvo.hp, hpMax: alvo.hpMax, skillId } : null;
    }, { skillId: SKILL_IDS.chicoteDeLava });
    achados.alvo = alvo;
    expect(alvo).toBeTruthy();

    await a.page.evaluate(async ({ alvoId, skillId }) => {
      const w = window as any;
      const ares = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      const ini = w.AVT_STATE.entidades.find((e: any) => e.id === alvoId);
      ares.x = ini.x - 2; ares.y = ini.y;
      ares.renderX = ares.x; ares.renderY = ares.y;
      const origRandom = Math.random;
      Math.random = () => 0.5; // d20 = 11: acerto normal, determinístico
      try { await w._avtExecutarPrimeiroAtaque(skillId, alvoId); }
      finally { Math.random = origRandom; }
    }, { alvoId: alvo!.id, skillId: SKILL_IDS.chicoteDeLava });

    await expect.poll(async () => {
      const anims = await b.page.evaluate(() => (window as any).__animRecebidas ?? []);
      return anims.length;
    }, { timeout: 15_000, message: 'animação da skill chega em B' }).toBeGreaterThanOrEqual(1);

    await expect.poll(() => a.page.evaluate((id: string) =>
      (window as any).AVT_STATE.entidades.find((e: any) => e.id === id).hp, alvo!.id),
      { timeout: 15_000, message: 'dano aplicado em A' }).toBeLessThan(alvo!.hp);

    await expect.poll(async () => {
      const [hpA, hpB] = await Promise.all([
        a.page.evaluate((id: string) => (window as any).AVT_STATE.entidades.find((e: any) => e.id === id).hp, alvo!.id),
        b.page.evaluate((id: string) => (window as any).AVT_STATE.entidades.find((e: any) => e.id === id).hp, alvo!.id),
      ]);
      return hpA === hpB ? 'igual' : `A=${hpA} B=${hpB}`;
    }, { timeout: 15_000, message: 'HP do alvo converge' }).toBe('igual');

    achados.divergenciaAposSkill = divergenciaMaxima(await digestDe(a.page), await digestDe(b.page));

    achados.manaAposSkill = await a.page.evaluate(() => {
      const chars = (window as any).AVT_STATE.chars;
      const c = chars.find((c: any) => c.nome === 'Ares');
      return { mana: c?.custom_attrs?.atributos?.Mana, manaMax: c?.custom_attrs?.atributos?.ManaMax };
    });

    // ── 5. Matar o inimigo mais ferido do mapa real (XP/loot/estado) ────────
    const fraco = await a.page.evaluate(() => {
      const w = window as any;
      const vivos = w.AVT_STATE.entidades.filter((e: any) => e.tipo === 'inimigo' && e.hp > 0 && !e.escondido);
      vivos.sort((p: any, q: any) => p.hp - q.hp);
      const f = vivos[0];
      return f ? { id: f.id, nome: f.nome, hp: f.hp } : null;
    });
    achados.alvoFraco = fraco;
    if (fraco) {
      const xpAntes = await a.page.evaluate(() => {
        const c = (window as any).AVT_STATE.chars.find((c: any) => c.nome === 'Ares');
        return c?.xp ?? 0;
      });
      // Golpes sucessivos até matar (máx 25)
      for (let i = 0; i < 25; i++) {
        const hp = await a.page.evaluate(async ({ alvoId, skillId }) => {
          const w = window as any;
          const ini = w.AVT_STATE.entidades.find((e: any) => e.id === alvoId);
          if (!ini || ini.hp <= 0) return 0;
          const ares = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
          ares.x = ini.x - 1; ares.y = ini.y;
          ares.renderX = ares.x; ares.renderY = ares.y;
          // Repor mana para não travar a rotina (o custo já foi validado acima)
          const atrs = w.AVT_STATE.chars.find((c: any) => c.nome === 'Ares')?.custom_attrs?.atributos;
          if (atrs) atrs.Mana = atrs.ManaMax;
          const origRandom = Math.random;
          Math.random = () => 0.5;
          try { await w._avtExecutarPrimeiroAtaque(skillId, alvoId); }
          finally { Math.random = origRandom; }
          await new Promise(r => setTimeout(r, 1800)); // dano aplica ~1.5s após cast
          return w.AVT_STATE.entidades.find((e: any) => e.id === alvoId)?.hp ?? 0;
        }, { alvoId: fraco.id, skillId: SKILL_IDS.chicoteDeLava });
        if (hp <= 0) break;
      }
      achados.morteInimigo = await a.page.evaluate(({ alvoId, xpAntes }) => {
        const w = window as any;
        const ini = w.AVT_STATE.entidades.find((e: any) => e.id === alvoId);
        const c = w.AVT_STATE.chars.find((c: any) => c.nome === 'Ares');
        return { hpFinal: ini?.hp, morto: !!(ini?.morto || (ini?.hp ?? 1) <= 0),
                 xpAntes, xpDepois: c?.xp ?? 0, nivel: c?.nivel };
      }, { alvoId: fraco.id, xpAntes });
    }

    // ── 6. Vitalidade e saldo de erros ──────────────────────────────────────
    await expect.poll(() => a.page.evaluate(() => (window as any).AVT_PERF?.fpsAtual?.() ?? 0),
      { timeout: 10_000 }).toBeGreaterThan(20);
    await expect.poll(() => b.page.evaluate(() => (window as any).AVT_PERF?.fpsAtual?.() ?? 0),
      { timeout: 10_000 }).toBeGreaterThan(20);
    achados.fpsA = await a.page.evaluate(() => (window as any).AVT_PERF?.fpsAtual?.() ?? 0);
    achados.fpsB = await b.page.evaluate(() => (window as any).AVT_PERF?.fpsAtual?.() ?? 0);

    // Divergência final: mede já, espera 6s de ticks, mede de novo. O estado
    // DEVE convergir (keyframe a cada 1s) — residual >1 célula é bug de sync.
    achados.divergenciaFinalImediata = divergenciaMaxima(await digestDe(a.page), await digestDe(b.page));
    await a.page.waitForTimeout(6_000);
    achados.divergenciaFinalApos6s = divergenciaMaxima(await digestDe(a.page), await digestDe(b.page));
    expect(achados.divergenciaFinalApos6s, 'estado não convergiu 6s após o combate').toBeLessThanOrEqual(1);
    // Posição de Ares vista por cada lado (isola desync de teleporte)
    achados.aresA = await a.page.evaluate(() => {
      const e = (window as any).AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      return e ? { x: e.x, y: e.y, hp: e.hp } : null;
    });
    achados.aresB = await b.page.evaluate(() => {
      const e = (window as any).AVT_STATE.entidades.find((e: any) => e.nome === 'Ares');
      return e ? { x: e.x, y: e.y, hp: e.hp } : null;
    });
    achados.alvoFracoB = await b.page.evaluate((id: string) => {
      const e = (window as any).AVT_STATE.entidades.find((e: any) => e.id === id);
      return e ? { hp: e.hp, morto: !!e.morto } : null;
    }, achados.alvoFraco?.id ?? '');
    // Flag `morto` deve espelhar o host no convidado (propagada pelo state tick)
    if (achados.morteInimigo?.morto) {
      expect(achados.alvoFracoB?.morto, 'convidado não recebeu morto:true do host').toBe(true);
    }
    // Só o host da fase tem autoridade sobre o registro: o cliente que NÃO é
    // host não pode ter gravado theme_json nenhuma vez na sessão.
    const hostEhA = await a.page.evaluate(() => !!(window as any)._avtSouHostDaFaseAtual?.());
    const naoHost = hostEhA ? b : a;
    const patchesRegistroNaoHost = naoHost.reqLog.filter(r =>
      r.method === 'PATCH' && r.url.includes('/rest/v1/rpg_registry')).length;
    achados.hostFinal = hostEhA ? 'A' : 'B';
    achados.regSavesA = await a.page.evaluate(() => (window as any).__regSaves ?? []);
    achados.regSavesB = await b.page.evaluate(() => (window as any).__regSaves ?? []);
    expect(patchesRegistroNaoHost, `cliente não-host (${naoHost.charNome}) gravou theme_json no registro`).toBe(0);

    expect(a.pageErrors, `pageerrors em A: ${a.pageErrors.join(' | ')}`).toEqual([]);
    expect(b.pageErrors, `pageerrors em B: ${b.pageErrors.join(' | ')}`).toEqual([]);
    expect(errosReais(a.consoleErrors), 'console de A').toEqual([]);
    expect(errosReais(b.consoleErrors), 'console de B').toEqual([]);
  });
});
