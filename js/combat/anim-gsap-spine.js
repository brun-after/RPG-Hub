// combat/anim-gsap-spine.js
// RPG Hub — Suporte a GSAP e Pixi Spine nas animações de habilidades
// Monkey-patcha window.animarAtaque para interceptar os tipos gsap / pixi_spine / gsap_pixi_spine

(function _iniciarAnimGSAPSpine() {

  const GSAP_TYPE  = 'gsap';
  const SPINE_TYPE = 'pixi_spine';
  const COMBO_TYPE = 'gsap_pixi_spine';

  // ── Presets GSAP ──────────────────────────────────────────────────────────
  // Opera sempre no .mapa-token-circle (filho) para não conflitar com o
  // transform:translate(-50%,-50%) do wrapper do token.

  const GSAP_PRESETS = {

    impacto_shake(el, cfg) {
      const dist = 8 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, { x: -dist, duration: 0.05, ease: 'none' })
        .to(el, { x:  dist, duration: 0.05, ease: 'none' })
        .to(el, { x: -dist * 0.6, duration: 0.05, ease: 'none' })
        .to(el, { x:  dist * 0.6, duration: 0.05, ease: 'none' })
        .to(el, { x: 0, duration: 0.08, ease: 'power2.out' })
        .to(el, { filter: `brightness(3) drop-shadow(0 0 14px ${cfg.cor||'#e74c3c'})`, duration: 0.08 }, 0)
        .to(el, { filter: 'none', duration: 0.25 }, 0.08);
    },

    impacto_escala(el, cfg) {
      const s = 1 + 0.35 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, { scaleX: s, scaleY: s, duration: 0.1, ease: 'power2.out' })
        .to(el, { filter: `drop-shadow(0 0 12px ${cfg.cor||'#e74c3c'})`, duration: 0.1 }, 0)
        .to(el, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
        .to(el, { filter: 'none', duration: 0.3 }, 0.15);
    },

    aura_pulso(el, cfg) {
      const reps = Math.round(3 * (cfg.intensidade || 1));
      return gsap.timeline()
        .to(el, {
          filter: `drop-shadow(0 0 18px ${cfg.cor||'#9b59b6'}) brightness(1.4)`,
          scaleX: 1.12, scaleY: 1.12,
          duration: 0.2, ease: 'sine.inOut',
          repeat: reps, yoyo: true
        })
        .to(el, { filter: 'none', scaleX: 1, scaleY: 1, duration: 0.2 });
    },

    lancamento(atacEl, alvoEl, cfg) {
      // Cria um clone do token atacante que desliza até o alvo
      const clone = atacEl.cloneNode(true);
      clone.style.cssText += ';pointer-events:none;z-index:10200;position:fixed';
      const ra = atacEl.getBoundingClientRect();
      const rb = alvoEl.getBoundingClientRect();
      clone.style.left = (ra.left + ra.width/2) + 'px';
      clone.style.top  = (ra.top  + ra.height/2) + 'px';
      clone.style.transform = 'translate(-50%,-50%)';
      document.body.appendChild(clone);
      const dur = (cfg.duracao || 600) / 1000;
      return gsap.timeline()
        .to(clone, {
          left: (rb.left + rb.width/2) + 'px',
          top:  (rb.top  + rb.height/2) + 'px',
          scale: 0.7, opacity: 0.85,
          duration: dur * 0.7, ease: 'power2.in'
        })
        .to(clone, { scale: 0, opacity: 0, duration: dur * 0.3, ease: 'power3.in' })
        .add(() => clone.remove());
    },

    critico_espiral(el, cfg) {
      const s = 1 + 0.5 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, { rotation: 180, scaleX: s, scaleY: s, duration: 0.35, ease: 'power2.in' })
        .to(el, { filter: `brightness(4) drop-shadow(0 0 20px ${cfg.cor||'#f0cc6a'})`, duration: 0.1 }, 0.25)
        .to(el, { rotation: 0, scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
        .to(el, { filter: 'none', duration: 0.3 }, 0.4);
    },

    cura_flutuante(el, cfg) {
      const dist = 12 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, {
          y: -dist,
          filter: `drop-shadow(0 0 14px ${cfg.cor||'#5ee09a'}) brightness(1.3)`,
          duration: 0.25, ease: 'power2.out'
        })
        .to(el, { y: 0, filter: 'none', duration: 0.5, ease: 'bounce.out' });
    },
  };

  // ── Executor GSAP ─────────────────────────────────────────────────────────
  function _animGSAP(animacao, atacEl, alvoEl) {
    if (typeof gsap === 'undefined') {
      console.warn('[AnimGSAP] GSAP não carregado.');
      return Promise.resolve();
    }

    const cfg    = animacao.gsap_config || {};
    const preset = cfg.preset || 'impacto_shake';
    const alvoEf = cfg.alvo_efeito || 'alvo';

    const targetEl = alvoEf === 'atacante' ? atacEl : alvoEl;
    const innerEl  = el => el?.querySelector('.mapa-token-circle') || el;

    let tl;

    if (preset === 'lancamento') {
      tl = GSAP_PRESETS.lancamento(atacEl, innerEl(alvoEl), cfg);
    } else {
      const targets = alvoEf === 'ambos'
        ? [innerEl(atacEl), innerEl(alvoEl)]
        : [innerEl(targetEl)];

      const fn = GSAP_PRESETS[preset];
      if (!fn) { return Promise.resolve(); }

      // Preset "lancamento" é especial (2 args), os demais recebem (el, cfg)
      tl = gsap.timeline();
      targets.forEach(el => { tl.add(fn(el, cfg), 0); });
    }

    return tl.then(() => {
      // Limpar propriedades para não acumular resíduos de transform/filter
      const els = [
        alvoEl?.querySelector('.mapa-token-circle') || alvoEl,
        atacEl?.querySelector('.mapa-token-circle') || atacEl,
      ].filter(Boolean);
      gsap.set(els, { clearProps: 'all' });
    });
  }

  // ── Lazy loader PixiJS + pixi-spine ──────────────────────────────────────
  let _pixiSpinePromise = null;

  function _carregarPixiSpine() {
    if (_pixiSpinePromise) return _pixiSpinePromise;
    if (window.PIXI && window.PIXI.spine) {
      _pixiSpinePromise = Promise.resolve();
      return _pixiSpinePromise;
    }
    _pixiSpinePromise = new Promise((resolve, reject) => {
      function carregarScript(src, onLoad) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = onLoad;
        s.onerror = () => reject(new Error('[AnimSpine] Falha ao carregar: ' + src));
        document.head.appendChild(s);
      }
      if (window.PIXI) {
        // PixiJS já existe, carregar apenas pixi-spine
        carregarScript(
          'https://cdn.jsdelivr.net/npm/pixi-spine@4.0.4/dist/pixi-spine.umd.js',
          resolve
        );
      } else {
        carregarScript(
          'https://cdn.jsdelivr.net/npm/pixi.js@7/dist/pixi.min.js',
          () => carregarScript(
            'https://cdn.jsdelivr.net/npm/pixi-spine@4.0.4/dist/pixi-spine.umd.js',
            resolve
          )
        );
      }
    });
    return _pixiSpinePromise;
  }

  // ── Executor Pixi Spine ───────────────────────────────────────────────────
  async function _animPixiSpine(animacao, origem, alvo) {
    try {
      await _carregarPixiSpine();
    } catch(e) {
      console.warn('[AnimSpine] Não foi possível carregar PixiJS/pixi-spine:', e);
      return;
    }

    const cfg = animacao.spine_config || {};
    if (!cfg.json_url || !cfg.atlas_url) {
      console.warn('[AnimSpine] json_url e atlas_url são obrigatórios.');
      return;
    }

    // Calcular posição de exibição
    const pos = cfg.posicao || animacao.posicao || 'alvo';
    let x, y;
    if (pos === 'atacante') { x = origem.x; y = origem.y; }
    else if (pos === 'meio') { x = (origem.x + alvo.x) / 2; y = (origem.y + alvo.y) / 2; }
    else { x = alvo.x; y = alvo.y; }

    const durMs = cfg.duracao || animacao.duracao || 1500;
    const escala = cfg.escala || 0.5;
    const animName = cfg.animation_name || 'animation';

    return new Promise(resolve => {
      let app;
      try {
        app = new PIXI.Application({
          backgroundAlpha: 0,
          width:  window.innerWidth,
          height: window.innerHeight,
          antialias: true,
        });
        app.view.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10100;width:100vw;height:100vh';
        document.body.appendChild(app.view);
      } catch(e) {
        console.warn('[AnimSpine] Falha ao criar PIXI.Application:', e);
        resolve(); return;
      }

      function destruir() {
        try { app.destroy(true, { children: true, texture: true, baseTexture: true }); } catch(_) {}
        resolve();
      }

      // Carregar assets Spine
      PIXI.Assets.load([cfg.json_url, cfg.atlas_url]).then(() => {
        try {
          const spine = PIXI.spine.Spine.from(cfg.json_url, cfg.atlas_url);
          spine.x = x;
          spine.y = y;
          spine.scale.set(escala);
          app.stage.addChild(spine);

          // Tentar encontrar a animação pelo nome; cair para a primeira disponível
          const trackNames = spine.state.data.skeletonData.animations.map(a => a.name);
          const nameToPlay = trackNames.includes(animName) ? animName : trackNames[0];
          if (nameToPlay) spine.state.setAnimation(0, nameToPlay, false);
        } catch(e) {
          console.warn('[AnimSpine] Erro ao criar/iniciar Spine:', e);
        }
        setTimeout(destruir, durMs);
      }).catch(e => {
        console.warn('[AnimSpine] Erro ao carregar assets Spine:', e);
        destruir();
      });
    });
  }

  // ── Monkey-patch de window.animarAtaque ───────────────────────────────────
  // Aguarda o DOM estar pronto para garantir que modals.js já aplicou seu patch
  function _aplicarPatch() {
    const _origAnimar = window.animarAtaque;

    window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
      const tipo = animacao?.tipo;

      if (tipo === GSAP_TYPE || tipo === SPINE_TYPE || tipo === COMBO_TYPE) {
        return new Promise(resolve => {
          const c = el => {
            if (typeof _animCentro === 'function') return _animCentro(el);
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          };
          const origem = c(atacEl);
          const alvo   = c(alvoEl);

          const tarefas = [];

          if (tipo === GSAP_TYPE || tipo === COMBO_TYPE) {
            tarefas.push(_animGSAP(animacao, atacEl, alvoEl));
          }
          if (tipo === SPINE_TYPE || tipo === COMBO_TYPE) {
            tarefas.push(_animPixiSpine(animacao, origem, alvo));
          }

          Promise.all(tarefas).then(resolve).catch(resolve);
        });
      }

      return typeof _origAnimar === 'function'
        ? _origAnimar.call(this, { atacEl, alvoEl, animacao, dano })
        : Promise.resolve();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _aplicarPatch);
  } else {
    _aplicarPatch();
  }

})();
