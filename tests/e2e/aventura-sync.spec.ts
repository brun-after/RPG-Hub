// Teste de jogabilidade multiplayer do Modo Aventura — 2 clientes reais no
// build de produção, rede 100% hermética (fixtures REST + broker Phoenix no
// processo do teste). Valida: topologia de host, sincronia de movimento entre
// clientes, fluxo de animação de skill através da rede e vitalidade do loop.
import { test, expect } from '@playwright/test';
import { criarBrokerPhoenix } from './helpers/phoenix-broker';
import {
  novoClienteAventura, entrarAventura, digestDe, divergenciaMaxima,
  souHostDaFase, statsRtnet, fpsAtual, broadcastsPendentes, faseAtual,
  instalarSondaAnim, animRecebidas, danoPopups, fxAtivos, errosReais,
  type ClienteAventura,
} from './helpers/aventura-client';

test.describe('aventura: 2 clientes', () => {
  test.setTimeout(180_000);

  let a: ClienteAventura;
  let b: ClienteAventura;

  test.afterEach(async () => {
    await a?.context.close().catch(() => {});
    await b?.context.close().catch(() => {});
  });

  test('sincronia de movimento, animação de skill cross-client e loop vivo', async ({ browser }) => {
    const broker = criarBrokerPhoenix();

    // Cliente A entra primeiro (solo → auto-promove a host em ~3s)
    a = await novoClienteAventura(browser, broker, { uid: 'uid-aaa', charNome: 'Alice' });
    await entrarAventura(a);

    // Cliente B entra depois e descobre o host via sinalização
    b = await novoClienteAventura(browser, broker, { uid: 'uid-bbb', charNome: 'Bob' });
    await entrarAventura(b);

    // ── 1. Topologia: exatamente um host de fase ─────────────────────────────
    await expect.poll(async () => {
      const [hostA, hostB] = await Promise.all([souHostDaFase(a.page), souHostDaFase(b.page)]);
      return `${hostA}|${hostB}`;
    }, { timeout: 20_000, message: 'exatamente um host de fase' }).toMatch(/^(true\|false|false\|true)$/);

    const [stA, stB] = await Promise.all([statsRtnet(a.page), statsRtnet(b.page)]);
    expect(stA, 'RTNet.getStats indisponível em A').toBeTruthy();
    expect(stB, 'RTNet.getStats indisponível em B').toBeTruthy();
    // p2p, mixed ou supabase — todos são transportes saudáveis aqui (no
    // fallback, os ticks fluem pelo broker); o que não pode é não haver stats.
    expect(['p2p', 'mixed', 'supabase']).toContain(stA.mode);

    // Broadcasts enfileirados sem handler = bug de ordem de boot
    expect(await broadcastsPendentes(a.page)).toBe(0);
    expect(await broadcastsPendentes(b.page)).toBe(0);

    // Mesma fase nos dois clientes (pré-condição de todo o sync)
    expect(await faseAtual(a.page)).toBe(await faseAtual(b.page));

    // Estado inicial dos dois lados já deve convergir via keyframe do tick
    await expect.poll(async () => {
      const [dA, dB] = await Promise.all([digestDe(a.page), digestDe(b.page)]);
      return divergenciaMaxima(dA, dB);
    }, { timeout: 15_000, message: 'estado inicial converge' }).toBeLessThanOrEqual(1);

    // ── 2. Movimento em A propaga para B (≤1 célula de divergência) ─────────
    await a.page.evaluate(() => {
      const w = window as any;
      const alice = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Alice');
      const caminho = w._avtPathfindSimples(
        Math.round(alice.x), Math.round(alice.y),
        Math.round(alice.x) + 5, Math.round(alice.y) + 4,
      );
      w.AVT_STATE._caminhoDestino = caminho.slice(1);
    });

    await expect.poll(async () => {
      const [dA, dB] = await Promise.all([digestDe(a.page), digestDe(b.page)]);
      return divergenciaMaxima(dA, dB);
    }, { timeout: 20_000, message: 'movimento sincronizado entre A e B' }).toBeLessThanOrEqual(1);

    // A parou de andar (waypoints drenados) e B vê a mesma posição final
    await expect.poll(() => a.page.evaluate(() => {
      const w = window as any;
      const alice = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Alice');
      return alice._waypoints.length + (w.AVT_STATE._caminhoDestino?.length ?? 0);
    }), { timeout: 20_000 }).toBe(0);

    // ── 3. Skill de A: animação, dano e HP fluem até B ──────────────────────
    await instalarSondaAnim(b.page);

    const hpGoblinAntes = await a.page.evaluate(() =>
      (window as any).AVT_STATE.entidades.find((e: any) => e.id === 'ini_0').hp);

    await a.page.evaluate(async () => {
      const w = window as any;
      const alice = w.AVT_STATE.entidades.find((e: any) => e.nome === 'Alice');
      const goblin = w.AVT_STATE.entidades.find((e: any) => e.id === 'ini_0');
      // Aproxima em alcance (skill 101 tem alcance 4) — teleporte controlado
      alice.x = goblin.x - 2; alice.y = goblin.y;
      alice.renderX = alice.x; alice.renderY = alice.y;
      // d20 determinístico (0.5 → 11: acerto normal; ≤3 seria erro crítico)
      const origRandom = Math.random;
      Math.random = () => 0.5;
      try {
        await w._avtExecutarPrimeiroAtaque(101, 'ini_0'); // Bola de Fogo
      } finally {
        Math.random = origRandom;
      }
    });

    // B recebeu o broadcast de animação da skill certa
    await expect.poll(async () => {
      const anims = await animRecebidas(b.page);
      return anims.filter((p: any) => p?.skillId === 101).length;
    }, { timeout: 15_000, message: 'avt_skill_anim chega em B' }).toBeGreaterThanOrEqual(1);

    // HP do goblin caiu em A (dano aplicado ~1.5s após o cast)...
    await expect.poll(() => a.page.evaluate(() =>
      (window as any).AVT_STATE.entidades.find((e: any) => e.id === 'ini_0').hp,
    ), { timeout: 15_000, message: 'dano aplicado em A' }).toBeLessThan(hpGoblinAntes);

    // ...e converge para o MESMO valor em B via tick/broadcast
    await expect.poll(async () => {
      const [hpA, hpB] = await Promise.all([
        a.page.evaluate(() => (window as any).AVT_STATE.entidades.find((e: any) => e.id === 'ini_0').hp),
        b.page.evaluate(() => (window as any).AVT_STATE.entidades.find((e: any) => e.id === 'ini_0').hp),
      ]);
      return hpA === hpB ? 'igual' : `A=${hpA} B=${hpB}`;
    }, { timeout: 15_000, message: 'HP do alvo converge entre clientes' }).toBe('igual');

    // Pipeline visual de dano rendeu popups em B (prova zero-instrumentação)
    await expect.poll(() => danoPopups(b.page), {
      timeout: 15_000, message: 'popup de dano renderizado em B',
    }).toBeGreaterThan(0);

    // FX one-shot terminam: registro de animações vivas volta a zero
    await expect.poll(() => fxAtivos(b.page), {
      timeout: 20_000, message: 'FX one-shot terminam em B',
    }).toBe(0);
    await expect.poll(() => fxAtivos(a.page), { timeout: 20_000 }).toBe(0);

    // ── 4. Vitalidade do loop nos dois clientes ─────────────────────────────
    await expect.poll(() => fpsAtual(a.page), { timeout: 10_000 }).toBeGreaterThan(20);
    await expect.poll(() => fpsAtual(b.page), { timeout: 10_000 }).toBeGreaterThan(20);

    // ── 5. Zero exceções de JS e zero erros reais de console ────────────────
    expect(a.pageErrors, `pageerrors em A: ${a.pageErrors.join(' | ')}`).toEqual([]);
    expect(b.pageErrors, `pageerrors em B: ${b.pageErrors.join(' | ')}`).toEqual([]);
    expect(errosReais(a.consoleErrors), 'console de A').toEqual([]);
    expect(errosReais(b.consoleErrors), 'console de B').toEqual([]);
  });
});
