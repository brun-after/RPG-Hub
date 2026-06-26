// js/systems/avt-walk-presets.js
// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTECA DE PRESETS DE CAMINHADA — sprite isométrico do modo aventura
// ─────────────────────────────────────────────────────────────────────────────
// Os tokens são PNGs únicos de corpo inteiro. Não há rig esquelético, então a
// caminhada é EMULADA por fatiamento: a imagem é dividida em N tiras horizontais
// (0 = pés, 1 = topo) e cada tira é deslocada/escalada por frame. Diferentes
// presets variam COMO as tiras se movem — desde o "quique" original (imagem
// inteira balançando) até pernas articuladas de verdade (região inferior dividida
// em metade esquerda/direita, alternadas em fase oposta).
//
// Sistema de coordenadas: cada preset.draw(ctx, img, o) assume que o chamador já
// fez ctx.translate(footX, footY) e o espelhamento de facing. A origem (0,0) é o
// CENTRO DOS PÉS; a figura se estende para cima até y = -H. Use avtWalkRender()
// como ponto de entrada único (jogo + estúdio) para garantir WYSIWYG.
//
// Exposto: window.AVT_WALK_PRESETS (mapa ordenado) e window.avtWalkRender().

(function () {
  'use strict';

  const N = 18; // nº de tiras (mantém paridade visual com o motor original)

  // Geometria padrão compartilhada (idêntica ao _avtDesenharIsoIa original).
  function _geo(img, SZ) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const H = SZ * 1.12;           // altura desenhada (pousa no tile, um pouco maior)
    const W = H * (iw / ih);
    return { iw, ih, H, W };
  }

  // ── Motor genérico (quique / idle / attack) ────────────────────────────────
  // Réplica fiel do loop original: bob global + sway lateral ponderado pela
  // altura + respiração no idle + avanço no attack. Usado pelo preset "quique" e
  // como ESTADO idle/attack de TODOS os presets (consistência entre estilos).
  function _generic(ctx, img, o) {
    const { SZ, now, state, tState, iw, ih, H, W } = o;
    let swayAmp, swayHz, bobAmp, bobHz, breatheAmp;
    if (state === 'walk')        { swayAmp = W * 0.10; swayHz = 1 / 130; bobAmp = SZ * 0.06; bobHz = 1 / 130; breatheAmp = 0.0; }
    else if (state === 'attack') { swayAmp = W * 0.05; swayHz = 1 / 120; bobAmp = SZ * 0.02; bobHz = 1 / 120; breatheAmp = 0.0; }
    else                         { swayAmp = W * 0.035; swayHz = 1 / 760; bobAmp = SZ * 0.012; bobHz = 1 / 900; breatheAmp = 0.025; }

    let atkPush = 0, atkStretch = 1;
    if (state === 'attack') { const tt = Math.min(1, tState / 400); const e = Math.sin(tt * Math.PI); atkPush = e * W * 0.20; atkStretch = 1 + e * 0.06; }

    const bob = (state === 'walk')
      ? -Math.abs(Math.sin(now * bobHz * Math.PI * 2)) * bobAmp
      : Math.sin(now * bobHz * Math.PI * 2) * bobAmp;
    const breatheSy = 1 + breatheAmp * Math.sin(now / 900);

    for (let i = 0; i < N; i++) {
      const sy = ih * i / N, sh = ih / N;
      const h  = 1 - (i + 0.5) / N;
      let dx = swayAmp * h * Math.sin(now * swayHz * Math.PI * 2 + h * 2.2);
      dx += atkPush * h;
      const dyTop = (-H + H * (i / N)) * breatheSy + bob;
      const dh    = (H / N) * breatheSy + 0.6;
      const dw    = W * (1 + (atkStretch - 1) * h);
      ctx.drawImage(img, 0, sy, iw, sh, -dw / 2 + dx, dyTop, dw, dh);
    }
  }

  // ── Motor bípede (passada / marcha) ─────────────────────────────────────────
  // A região inferior (h < legSplitY) é cortada verticalmente em duas colunas
  // (perna esquerda/direita pelo legCenter) e cada uma recebe LIFT vertical +
  // OFFSET horizontal em fase oposta (π) → passos alternados. Acima da divisão, o
  // torso recebe contra-balanço + inclinação, com a banda da arma amortecida.
  function _makeBipede(cfg) {
    return function (ctx, img, o) {
      // idle/attack: usa o motor genérico (consistência). Pernas desligadas →
      // cai para o quique de caminhada (bob/sway sem articulação).
      if (o.state !== 'walk' || o.pernas === false) return _generic(ctx, img, o);

      const { SZ, now, iw, ih, H, W } = o;
      const p = o.params || {};
      const per     = (p.cadencia       ?? cfg.cadencia);        // período (ms) por passada
      const stepAmp = (p.amplitudePasso ?? cfg.amplitudePasso) * SZ;
      const reach   = stepAmp * 0.8;                              // alcance horizontal
      const bobAmp  = (p.bobAmp         ?? cfg.bobAmp) * SZ;
      const splitY  = (p.legSplitY      ?? cfg.legSplitY);        // fração de altura (pernas abaixo)
      const lc      = (p.legCenter      ?? cfg.legCenter);        // centro do corte (0..1 da largura)
      const lean    = (p.inclinacao     ?? cfg.inclinacao) * W;
      const wa      = (p.weaponAnchor   ?? cfg.weaponAnchor) || null;
      const squashK = cfg.squash || 0;

      const ph = now * (1 / per) * Math.PI * 2;
      const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
      const bob = -Math.abs(Math.sin(ph)) * bobAmp;              // 2 impactos por ciclo
      const squashSy = squashK ? (1 - Math.abs(Math.cos(ph)) * squashK) : 1;

      const sxL = Math.max(1, Math.round(iw * lc));
      const wL  = W * lc, wR = W * (1 - lc);

      for (let i = 0; i < N; i++) {
        const sy = ih * i / N, sh = ih / N;
        const h  = 1 - (i + 0.5) / N;
        const dh = (H / N) * squashSy + 0.6;
        const dyTop = (-H + H * (i / N)) * squashSy + bob;

        if (h < splitY) {
          // ── Tira de perna: duas colunas em fase oposta ──
          const legW  = (splitY - h) / splitY;          // 1 nos pés, 0 na divisão
          const liftL = Math.max(0, sL) * stepAmp * legW;
          const liftR = Math.max(0, sR) * stepAmp * legW;
          const offL  = sL * reach * legW;
          const offR  = sR * reach * legW;
          // metade esquerda da imagem → coluna esquerda
          ctx.drawImage(img, 0, sy, sxL, sh, -W / 2 + offL, dyTop - liftL, wL, dh);
          // metade direita da imagem → coluna direita
          ctx.drawImage(img, sxL, sy, iw - sxL, sh, -W / 2 + wL + offR, dyTop - liftR, wR, dh);
        } else {
          // ── Tira de torso: contra-balanço + inclinação ──
          const aboveT = (h - splitY) / (1 - splitY);   // 0 na divisão, 1 no topo
          let dx = -Math.sin(ph) * reach * 0.22 * aboveT;
          dx += lean * aboveT;
          if (wa && h >= wa.yTop && h <= wa.yBot) dx *= (1 - (wa.damp ?? 0.7));
          ctx.drawImage(img, 0, sy, iw, sh, -W / 2 + dx, dyTop, W, dh);
        }
      }
    };
  }

  // ── Motor flutuante (asas) ───────────────────────────────────────────────────
  // Sem pernas: hover vertical suave + pulso lateral na metade superior (asas).
  // Ignora o toggle de pernas (não há pernas para desligar).
  function _flutuar(ctx, img, o) {
    if (o.state !== 'walk') return _generic(ctx, img, o);
    const { SZ, now, iw, ih, H, W } = o;
    const p = o.params || {};
    const per     = (p.cadencia       ?? 1400);
    const wingPer = (p.cadencia2      ?? 760);
    const hover   = (p.hoverAmp       ?? 0.05) * SZ;
    const wingAmp = (p.amplitudePasso ?? 0.06) * W;
    const ph  = now * (1 / per)     * Math.PI * 2;
    const wph = now * (1 / wingPer) * Math.PI * 2;
    const hOff = Math.sin(ph) * hover;
    for (let i = 0; i < N; i++) {
      const sy = ih * i / N, sh = ih / N;
      const h  = 1 - (i + 0.5) / N;
      const wingW = Math.max(0, (h - 0.45) / 0.55);   // só metade de cima
      const dx = Math.sin(wph + h * 1.5) * wingAmp * wingW;
      const dyTop = (-H + H * (i / N)) + hOff;
      const dh = (H / N) + 0.6;
      ctx.drawImage(img, 0, sy, iw, sh, -W / 2 + dx, dyTop, W, dh);
    }
  }

  // ── Motor deslizante (manto/túnica) ──────────────────────────────────────────
  // Corpo desliza suave; a barra inferior (bainha) balança como tecido (pêndulo
  // amortecido). Sem passos discretos. Ignora o toggle de pernas.
  function _deslizar(ctx, img, o) {
    if (o.state !== 'walk') return _generic(ctx, img, o);
    const { SZ, now, iw, ih, H, W } = o;
    const p = o.params || {};
    const per    = (p.cadencia       ?? 520);
    const hemY   = (p.legSplitY      ?? 0.45);
    const hemAmp = (p.amplitudePasso ?? 0.09) * W;
    const bobAmp = (p.bobAmp         ?? 0.018) * SZ;
    const lean   = (p.inclinacao     ?? 0.015) * W;
    const ph = now * (1 / per) * Math.PI * 2;
    const bob = Math.sin(ph * 2) * bobAmp;
    for (let i = 0; i < N; i++) {
      const sy = ih * i / N, sh = ih / N;
      const h  = 1 - (i + 0.5) / N;
      const hemW   = h < hemY ? (hemY - h) / hemY : 0;
      const upperW = h >= hemY ? (h - hemY) / (1 - hemY) : 0;
      let dx = Math.sin(ph + (hemY - h) * 3) * hemAmp * hemW;   // pêndulo da bainha
      dx += -Math.sin(ph) * hemAmp * 0.15 * upperW;            // balanço sutil do corpo
      dx += lean * upperW;
      const dyTop = (-H + H * (i / N)) + bob;
      const dh = (H / N) + 0.6;
      ctx.drawImage(img, 0, sy, iw, sh, -W / 2 + dx, dyTop, W, dh);
    }
  }

  // ── Registro de presets (ordem = ordem de exibição no estúdio) ──────────────
  const AVT_WALK_PRESETS = {
    quique: {
      nome: 'Quique (clássico)',
      icone: '🔆',
      descricao: 'Balanço da imagem inteira — o comportamento padrão atual.',
      recomendado: ['qualquer', 'compatibilidade'],
      paramsPadrao: {},
      draw: _generic,
    },
    passada: {
      nome: 'Passada bípede',
      icone: '🚶',
      descricao: 'Pernas alternadas de verdade. Ideal para humanoides em pé.',
      recomendado: ['humanoide', 'pernas_visiveis'],
      paramsPadrao: {
        cadencia: 380, amplitudePasso: 0.10, bobAmp: 0.05,
        legSplitY: 0.42, legCenter: 0.5, inclinacao: 0.018, weaponAnchor: null,
      },
      draw: _makeBipede({
        cadencia: 380, amplitudePasso: 0.10, bobAmp: 0.05,
        legSplitY: 0.42, legCenter: 0.5, inclinacao: 0.018, weaponAnchor: null, squash: 0,
      }),
    },
    marcha: {
      nome: 'Marcha pesada',
      icone: '🥾',
      descricao: 'Passada larga e lenta com impacto e squash. Para tanques/vikings.',
      recomendado: ['pesado', 'armadura', 'arma_grande'],
      paramsPadrao: {
        cadencia: 540, amplitudePasso: 0.13, bobAmp: 0.08,
        legSplitY: 0.40, legCenter: 0.5, inclinacao: 0.014, weaponAnchor: null,
      },
      draw: _makeBipede({
        cadencia: 540, amplitudePasso: 0.13, bobAmp: 0.08,
        legSplitY: 0.40, legCenter: 0.5, inclinacao: 0.014, weaponAnchor: null, squash: 0.05,
      }),
    },
    flutuar: {
      nome: 'Flutuar (asas)',
      icone: '🧚',
      descricao: 'Hover suave + pulso das asas, sem tocar o chão. Para alados/etéreos.',
      recomendado: ['alado', 'voador', 'sem_pernas'],
      paramsPadrao: { cadencia: 1400, cadencia2: 760, hoverAmp: 0.05, amplitudePasso: 0.06 },
      draw: _flutuar,
    },
    deslizar: {
      nome: 'Deslizar (manto)',
      icone: '👻',
      descricao: 'Corpo desliza e a bainha do manto ondula. Para encapuzados/espectros.',
      recomendado: ['manto', 'tunica', 'encapuzado'],
      paramsPadrao: { cadencia: 520, legSplitY: 0.45, amplitudePasso: 0.09, bobAmp: 0.018, inclinacao: 0.015 },
      draw: _deslizar,
    },
  };

  // ── Ponto de entrada único (jogo + estúdio) ─────────────────────────────────
  // o = { footX, footY, SZ, now, state, tState, facing, presetId, params, pernas }
  function avtWalkRender(ctx, img, o) {
    if (!img || !(img.complete && img.naturalWidth > 0)) return;
    const id = (o.presetId && AVT_WALK_PRESETS[o.presetId]) ? o.presetId : 'quique';
    const preset = AVT_WALK_PRESETS[id];
    const g = _geo(img, o.SZ);
    const oo = Object.assign({}, o, g, {
      state: o.state || 'idle',
      tState: o.tState || 0,
      params: Object.assign({}, preset.paramsPadrao, o.params || {}),
    });
    ctx.save();
    ctx.translate(o.footX, o.footY);
    if ((o.facing || 1) < 0) ctx.scale(-1, 1);
    try { preset.draw(ctx, img, oo); } catch (e) { /* nunca quebra o loop de render */ }
    ctx.restore();
  }

  window.AVT_WALK_PRESETS = AVT_WALK_PRESETS;
  window.avtWalkRender = avtWalkRender;
})();
