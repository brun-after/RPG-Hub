// combat/anim-gsap-spine.js
// RPG Hub — Suporte a GSAP e Pixi Spine nas animações de habilidades
// Monkey-patcha window.animarAtaque para interceptar os tipos gsap / pixi_spine / gsap_pixi_spine

(function _iniciarAnimGSAPSpine() {

  const GSAP_TYPE        = 'gsap';
  const SPINE_TYPE       = 'pixi_spine';
  const COMBO_TYPE       = 'gsap_pixi_spine';
  const COMBO_TOTAL_TYPE = 'combo_total';

  // ── Presets GSAP ──────────────────────────────────────────────────────────
  // Opera sempre no .mapa-token-circle (filho) para não conflitar com o
  // transform:translate(-50%,-50%) do wrapper do token.

  // ── Helper: clonar token em posição fixed para animações de movimento ────
  function _clonarToken(el: any) {
    const clone = el.cloneNode(true);
    const r = el.getBoundingClientRect();
    clone.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;pointer-events:none;z-index:10200;margin:0;transform:none`;
    document.body.appendChild(clone);
    return { clone, r };
  }

  const GSAP_PRESETS: Record<string, any> = {

    // ── Efeitos sobre o token (inner circle) ────────────────────────────

    impacto_shake(el: any, cfg: any) {
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

    impacto_escala(el: any, cfg: any) {
      const s = 1 + 0.35 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, { scaleX: s, scaleY: s, duration: 0.1, ease: 'power2.out' })
        .to(el, { filter: `drop-shadow(0 0 12px ${cfg.cor||'#e74c3c'})`, duration: 0.1 }, 0)
        .to(el, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
        .to(el, { filter: 'none', duration: 0.3 }, 0.15);
    },

    aura_pulso(el: any, cfg: any) {
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

    critico_espiral(el: any, cfg: any) {
      const s = 1 + 0.5 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, { rotation: 180, scaleX: s, scaleY: s, duration: 0.35, ease: 'power2.in' })
        .to(el, { filter: `brightness(4) drop-shadow(0 0 20px ${cfg.cor||'#f0cc6a'})`, duration: 0.1 }, 0.25)
        .to(el, { rotation: 0, scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
        .to(el, { filter: 'none', duration: 0.3 }, 0.4);
    },

    cura_flutuante(el: any, cfg: any) {
      const dist = 12 * (cfg.intensidade || 1);
      return gsap.timeline()
        .to(el, {
          y: -dist,
          filter: `drop-shadow(0 0 14px ${cfg.cor||'#5ee09a'}) brightness(1.3)`,
          duration: 0.25, ease: 'power2.out'
        })
        .to(el, { y: 0, filter: 'none', duration: 0.5, ease: 'bounce.out' });
    },

    // ── Movimento do token (usa clone em posição fixed) ──────────────────

    lancamento(atacEl: any, alvoEl: any, cfg: any) {
      const { clone, r: ra } = _clonarToken(atacEl);
      const rb = alvoEl.getBoundingClientRect();
      const dur = (cfg.duracao || 600) / 1000;
      return gsap.timeline()
        .to(clone, {
          left: (rb.left + rb.width/2 - ra.width/2) + 'px',
          top:  (rb.top  + rb.height/2 - ra.height/2) + 'px',
          scale: 0.7, opacity: 0.85,
          duration: dur * 0.7, ease: 'power2.in'
        })
        .to(clone, { scale: 0, opacity: 0, duration: dur * 0.3, ease: 'power3.in' })
        .add(() => clone.remove());
    },

    token_dash(atacEl: any, alvoEl: any, cfg: any) {
      const { clone, r: ra } = _clonarToken(atacEl);
      const rb = alvoEl.getBoundingClientRect();
      const dur = (cfg.duracao || 550) / 1000;
      const int = cfg.intensidade || 1;

      // Posição destino: 70% do caminho até o alvo
      const stopX = ra.left + (rb.left - ra.left) * 0.7;
      const stopY = ra.top  + (rb.top  - ra.top ) * 0.7;

      return gsap.timeline()
        // Dash forward com efeito de stretch
        .to(clone, {
          left: stopX + 'px', top: stopY + 'px',
          scaleX: 1.4 * int, scaleY: 0.65,
          filter: `brightness(1.8) drop-shadow(0 0 8px ${cfg.cor||'#e74c3c'})`,
          duration: dur * 0.28, ease: 'power3.out'
        })
        // Impacto: squash
        .to(clone, { scaleX: 0.7, scaleY: 1.3, duration: dur * 0.1 })
        // Flash no impacto
        .to(clone, { filter: `brightness(4) drop-shadow(0 0 20px ${cfg.cor||'#e74c3c'})`, duration: 0.04 }, '<')
        .to(clone, { filter: 'none', duration: 0.06 })
        // Retorno rápido
        .to(clone, {
          left: ra.left + 'px', top: ra.top + 'px',
          scaleX: 1.2, scaleY: 0.8,
          duration: dur * 0.35, ease: 'power2.in'
        })
        .to(clone, { scaleX: 1, scaleY: 1, opacity: 0, duration: dur * 0.2 })
        .add(() => clone.remove());
    },

    token_teleport(atacEl: any, alvoEl: any, cfg: any) {
      const inner = atacEl.querySelector('.mapa-token-circle') || atacEl;
      const rb = alvoEl.getBoundingClientRect();
      const dur = (cfg.duracao || 600) / 1000;
      const cor = cfg.cor || '#9b59b6';

      // Flash no local de chegada
      const flash = document.createElement('div');
      flash.style.cssText = `position:fixed;left:${rb.left}px;top:${rb.top}px;` +
        `width:${rb.width}px;height:${rb.height}px;border-radius:50%;` +
        `pointer-events:none;z-index:10200;background:radial-gradient(circle,rgba(255,255,255,0.95),${cor}44);opacity:0`;
      document.body.appendChild(flash);

      return gsap.timeline()
        // Warp-out do atacante
        .to(inner, { scaleX: 0.05, scaleY: 1.6, opacity: 0, filter: `brightness(5) drop-shadow(0 0 20px ${cor})`, duration: dur * 0.18, ease: 'power3.in' })
        // Flash no destino
        .to(flash, { opacity: 1, scale: 1.2, duration: dur * 0.12, ease: 'power2.out' }, '-=0.04')
        .to(flash, { opacity: 0, scale: 1.8, duration: dur * 0.35, ease: 'power2.in' })
        // Warp-in: atacante reaparece
        .set(inner, { scaleX: 0.05, scaleY: 1.6, opacity: 0, filter: 'none' }, '<-=0.1')
        .to(inner, { scaleX: 1, scaleY: 1, opacity: 1, filter: 'none', duration: dur * 0.3, ease: 'elastic.out(1, 0.4)' })
        .add(() => { flash.remove(); gsap.set(inner, { clearProps: 'transform,filter,opacity' }); });
    },

    token_arremesso_volta(atacEl: any, alvoEl: any, cfg: any) {
      const { clone, r: ra } = _clonarToken(atacEl);
      const rb = alvoEl.getBoundingClientRect();
      const dur = (cfg.duracao || 700) / 1000;
      const cor = cfg.cor || '#e67e22';

      return gsap.timeline()
        // Deslizamento fluído em arco
        .to(clone, {
          left: (rb.left + rb.width/2 - ra.width/2) + 'px',
          top:  (rb.top  + rb.height/2 - ra.height/2) + 'px',
          filter: `drop-shadow(0 0 12px ${cor}) brightness(1.5)`,
          duration: dur * 0.45, ease: 'power2.inOut'
        })
        // Breve pausa no alvo
        .to(clone, { scale: 1.15, duration: dur * 0.08, ease: 'power2.out' })
        .to(clone, { filter: `brightness(3) drop-shadow(0 0 22px ${cor})`, duration: 0.05 }, '<')
        // Retorno com trail
        .to(clone, {
          left: ra.left + 'px', top: ra.top + 'px',
          scale: 1, filter: 'none',
          duration: dur * 0.38, ease: 'power2.inOut'
        })
        .to(clone, { opacity: 0, duration: dur * 0.1 })
        .add(() => clone.remove());
    },

    token_recuo(alvoEl: any, cfg: any) {
      const inner = alvoEl.querySelector('.mapa-token-circle') || alvoEl;
      const dist = 22 * (cfg.intensidade || 1);
      const dur = (cfg.duracao || 400) / 1000;
      const cor = cfg.cor || '#e74c3c';

      return gsap.timeline()
        .to(inner, { x: -dist * 0.15, scaleX: 1.3, scaleY: 0.7, duration: 0.04, ease: 'power3.in' })
        .to(inner, { x: dist, scaleX: 0.75, scaleY: 1.2, filter: `drop-shadow(${dist}px 0 10px ${cor})`, duration: dur * 0.3, ease: 'power3.out' })
        .to(inner, { x: dist * 0.4, duration: dur * 0.15 })
        .to(inner, { x: 0, scaleX: 1, scaleY: 1, filter: 'none', duration: dur * 0.4, ease: 'elastic.out(1, 0.3)' })
        .add(() => gsap.set(inner, { clearProps: 'transform,filter,opacity' }));
    },

    // ── Movimento Permanente (token NÃO retorna à origem) ────────────
    // Use junto com efeito mover_usuario nos efeitos_bonus da skill.
    // O sistema de efeitos re-renderiza o token na nova posição após a animação.

    dash_avanco(atacEl: any, alvoEl: any, cfg: any) {
      const { clone, r: ra } = _clonarToken(atacEl);
      const rb = alvoEl.getBoundingClientRect();
      const dur = (cfg.duracao || 450) / 1000;
      const cor = cfg.cor || '#4af';
      // Token original desaparece (o sistema vai re-renderizá-lo na nova posição)
      const inner = atacEl.querySelector('.mapa-token-circle') || atacEl;

      return gsap.timeline()
        // Clone avança em dash até o alvo (90% do caminho)
        .to(clone, {
          left: (ra.left + (rb.left - ra.left) * 0.9) + 'px',
          top:  (ra.top  + (rb.top  - ra.top ) * 0.9) + 'px',
          scaleX: 1.5, scaleY: 0.6,
          filter: `brightness(2.2) drop-shadow(0 0 10px ${cor})`,
          duration: dur * 0.3, ease: 'power3.out'
        })
        // Impacto
        .to(clone, { scaleX: 0.8, scaleY: 1.3, filter: `brightness(3.5) drop-shadow(0 0 20px ${cor})`, duration: 0.06 })
        .to(clone, { scaleX: 1.1, scaleY: 1.1, filter: 'none', duration: dur * 0.15 })
        // Ocultar original imediatamente
        .to(inner, { opacity: 0, duration: 0.08 }, 0)
        // Clone some (o sistema coloca token na nova posição)
        .to(clone, { opacity: 0, scale: 0.5, duration: dur * 0.2, ease: 'power2.in' })
        .add(() => {
          clone.remove();
          // Token original permanece invisível até o sistema re-renderizá-lo
          // (a re-renderização acontece quando atkAplicarEfeito chama mapaAdjacenteAlvo)
          setTimeout(() => gsap.set(inner, { clearProps: 'transform,filter,opacity' }), 800);
        });
    },

    teleporte_saida(atacEl: any, _alvoEl: any, cfg: any) {
      const inner = atacEl.querySelector('.mapa-token-circle') || atacEl;
      const dur = (cfg.duracao || 400) / 1000;
      const cor = cfg.cor || '#9b59b6';

      // Flash de partida
      const flash = document.createElement('div');
      const r = atacEl.getBoundingClientRect();
      flash.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:50%;pointer-events:none;z-index:10200;background:radial-gradient(circle,rgba(255,255,255,0.9),${cor}66);opacity:0`;
      document.body.appendChild(flash);

      return gsap.timeline()
        // Warp-out: comprimir e some
        .to(flash, { opacity: 1, scale: 1.6, duration: 0.08 })
        .to(flash, { opacity: 0, scale: 2.4, duration: dur * 0.25, ease: 'power2.out' })
        .to(inner, { scaleX: 0.05, scaleY: 2.0, opacity: 0, filter: `brightness(5) drop-shadow(0 0 18px ${cor})`, duration: dur * 0.2, ease: 'power3.in' }, 0)
        .set(inner, { opacity: 0 })
        .add(() => {
          flash.remove();
          // Token some e fica invisível até re-renderização pelo sistema de movimento
          setTimeout(() => gsap.set(inner, { clearProps: 'transform,filter,opacity' }), 1000);
        });
    },
  };

  // Presets que operam nos wrappers (movimento real) — precisam de atacEl e alvoEl
  const PRESETS_MOVIMENTO = new Set(['lancamento','token_dash','token_teleport','token_arremesso_volta','token_recuo','dash_avanco','teleporte_saida']);

  // ── Executor GSAP ─────────────────────────────────────────────────────────
  function _animGSAP(animacao: any, atacEl: any, alvoEl: any) {
    if (typeof gsap === 'undefined') {
      console.warn('[AnimGSAP] GSAP não carregado.');
      return Promise.resolve();
    }

    const cfg    = animacao.gsap_config || {};
    const preset = cfg.preset || 'impacto_shake';
    const alvoEf = cfg.alvo_efeito || 'alvo';

    const innerEl = (el: any) => el?.querySelector('.mapa-token-circle') || el;

    let tl: any;

    if (PRESETS_MOVIMENTO.has(preset)) {
      const fn = GSAP_PRESETS[preset];
      if (!fn) return Promise.resolve();
      // Presets de movimento recebem os wrappers completos (atacEl, alvoEl, cfg)
      if (preset === 'token_recuo') {
        tl = fn(alvoEl, cfg);
      } else if (preset === 'teleporte_saida') {
        tl = fn(atacEl, null, cfg);
      } else {
        tl = fn(atacEl, alvoEl, cfg);
      }
    } else {
      // Mapear posições expandidas para atacante/alvo/ambos
      let targets;
      if (alvoEf === 'atacante' || alvoEf === 'orbital') {
        targets = [innerEl(atacEl)];
      } else if (alvoEf === 'ambos' || alvoEf === 'area' || alvoEf === 'cadeia' || alvoEf === 'raio' || alvoEf === 'trajetoria') {
        targets = [innerEl(atacEl), innerEl(alvoEl)];
      } else {
        // alvo, multiplo_alvo, sequencial, retorno → aplica no alvo
        targets = [innerEl(alvoEl)];
      }

      const fn = GSAP_PRESETS[preset];
      if (!fn) return Promise.resolve();

      tl = gsap.timeline();
      targets.forEach(el => { tl.add(fn(el, cfg), 0); });
    }

    return tl.then(() => {
      // Limpar propriedades para não acumular resíduos de transform/filter
      // (presets de movimento já fazem clearProps internamente)
      if (!PRESETS_MOVIMENTO.has(preset)) {
        const els = [
          alvoEl?.querySelector('.mapa-token-circle') || alvoEl,
          atacEl?.querySelector('.mapa-token-circle') || atacEl,
        ].filter(Boolean);
        gsap.set(els, { clearProps: 'transform,filter,opacity' });
      }
    });
  }

  // ── Lazy loader PixiJS + pixi-spine (delegado ao core/pixi-lazy.js) ───────
  function _carregarPixiSpine() {
    return pixiEnsureSpine();
  }

  // ── Renderer Esquelético Procedural ──────────────────────────────────────
  function _renderEsqueleticoEmCanvas(cfg: any, canvas: any, posX: any, posY: any, durMs: any) {
    const skel = cfg.skeleton;
    if (!skel) return Promise.resolve();
    const escala = cfg.escala || 1.0;
    const ctx = canvas.getContext('2d');

    const bonesMap: Record<string, any> = {};
    (skel.bones || []).forEach((b: any) => { bonesMap[b.id] = { ...b, children: [] }; });
    (skel.bones || []).forEach((b: any) => {
      if (b.parent && bonesMap[b.parent]) bonesMap[b.parent].children.push(b.id);
    });

    const tracksMap: Record<string, any> = {};
    (skel.tracks || []).forEach((tr: any) => { tracksMap[tr.bone] = tr.keyframes || []; });

    function lerp(a: any, b: any, t: any) { return a + (b - a) * t; }

    function applyEasing(f: any, easing: any) {
      switch (easing) {
        case 'easeIn':    return f * f;
        case 'easeOut':   return f * (2 - f);
        case 'easeInOut': return f < 0.5 ? 2 * f * f : -1 + (4 - 2 * f) * f;
        case 'elastic': {
          if (f === 0 || f === 1) return f;
          return -Math.pow(2, 10 * f - 10) * Math.sin((f * 10 - 10.75) * (2 * Math.PI) / 3);
        }
        case 'bounce': {
          let t = 1 - f; // let: os branches abaixo reatribuem t (com const era TypeError em runtime)
          if (t < 1 / 2.75) return 1 - 7.5625 * t * t;
          if (t < 2 / 2.75) return 1 - (7.5625 * (t -= 1.5 / 2.75) * t + 0.75);
          if (t < 2.5 / 2.75) return 1 - (7.5625 * (t -= 2.25 / 2.75) * t + 0.9375);
          return 1 - (7.5625 * (t -= 2.625 / 2.75) * t + 0.984375);
        }
        default: return f;
      }
    }

    function interpolar(keyframes: any, t: any, prop: any, def: any) {
      if (!keyframes.length) return def;
      if (t <= keyframes[0].t) return keyframes[0][prop] !== undefined ? keyframes[0][prop] : def;
      if (t >= keyframes[keyframes.length - 1].t) {
        const last = keyframes[keyframes.length - 1];
        return last[prop] !== undefined ? last[prop] : def;
      }
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
          const span = keyframes[i + 1].t - keyframes[i].t;
          let f = span > 0 ? (t - keyframes[i].t) / span : 0;
          f = applyEasing(f, keyframes[i].easing);
          const va = keyframes[i][prop];
          const vb = keyframes[i + 1][prop];
          if (va === undefined && vb === undefined) return def;
          return lerp(va !== undefined ? va : def, vb !== undefined ? vb : def, f);
        }
      }
      return def;
    }

    function calcWorld(boneId: any, t: any, parentWorldAngle: any, parentWorldX: any, parentWorldY: any) {
      const bone = bonesMap[boneId];
      if (!bone) return;
      const kfs = tracksMap[boneId] || [];
      const localAngle = interpolar(kfs, t, 'angle', bone.angle || 0);
      const slotAlpha = interpolar(kfs, t, 'alpha', 1);
      const slotScaleX = interpolar(kfs, t, 'scaleX', 1);
      const slotScaleY = interpolar(kfs, t, 'scaleY', 1);
      const worldAngle = parentWorldAngle + localAngle;
      const rad = worldAngle * Math.PI / 180;
      const worldX = parentWorldX + (bone.x || 0) * escala;
      const worldY = parentWorldY + (bone.y || 0) * escala;
      bone._wx = worldX; bone._wy = worldY; bone._wAngle = worldAngle;
      bone._alpha = slotAlpha; bone._scaleX = slotScaleX; bone._scaleY = slotScaleY;
      bone._tipX = worldX + Math.sin(rad) * (bone.length || 0) * escala;
      bone._tipY = worldY - Math.cos(rad) * (bone.length || 0) * escala;
      (bone.children || []).forEach((cid: any) => calcWorld(cid, t, worldAngle, worldX, worldY));
    }

    function drawSlot(slot: any) {
      const bone = bonesMap[slot.bone];
      if (!bone) return;
      const d = slot.draw || {};
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, bone._alpha !== undefined ? bone._alpha : 1));
      ctx.globalCompositeOperation = d.composite || 'source-over';
      if (d.glow) { ctx.shadowBlur = d.glow * escala; ctx.shadowColor = d.fill || '#ffffff'; }
      ctx.translate(bone._wx, bone._wy);
      ctx.rotate(bone._wAngle * Math.PI / 180);
      ctx.scale(bone._scaleX || 1, bone._scaleY || 1);
      ctx.fillStyle = d.fill || '#ffffff';
      ctx.strokeStyle = d.stroke || 'transparent';
      ctx.lineWidth = (d.strokeW || 0) * escala;
      const type = d.type || 'circle';
      ctx.beginPath();
      if (type === 'circle') {
        ctx.arc(0, 0, (d.r || 8) * escala, 0, Math.PI * 2);
      } else if (type === 'rect') {
        const w = (d.w || 8) * escala, h = (d.h || 20) * escala;
        ctx.rect(-w / 2, -h / 2, w, h);
      } else if (type === 'line') {
        ctx.moveTo(0, 0);
        ctx.lineTo((d.x2 || 0) * escala, (d.y2 || (bone.length || 20)) * escala);
        ctx.lineWidth = (d.strokeW || 3) * escala;
        ctx.strokeStyle = d.fill || '#ffffff';
        ctx.stroke();
        ctx.restore();
        return;
      } else if (type === 'arc') {
        const sa = (d.startAngle || 0) * Math.PI / 180;
        const ea = (d.endAngle || 180) * Math.PI / 180;
        ctx.arc(0, 0, (d.r || 20) * escala, sa, ea);
        if (d.strokeW) { ctx.lineWidth = d.strokeW * escala; ctx.stroke(); }
      }
      ctx.fill();
      if (d.strokeW && type !== 'line' && type !== 'arc') ctx.stroke();
      ctx.restore();
    }

    return new Promise<void>(resolve => {
      const start = performance.now();
      let raf: any;
      let done = false;

      function frame(now: any) {
        const elapsed = now - start;
        const t = Math.min(elapsed / durMs, 1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        (skel.bones || [])
          .filter((b: any) => !b.parent || !bonesMap[b.parent])
          .forEach((b: any) => calcWorld(b.id, t, 0, posX, posY));
        (skel.slots || []).forEach(drawSlot);
        if (elapsed < durMs && !done) {
          raf = requestAnimationFrame(frame);
        } else {
          cancelAnimationFrame(raf);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          resolve();
        }
      }

      raf = requestAnimationFrame(frame);
      // Store raf cancel handle on the canvas so callers can stop it
      canvas._esqueleticoStop = () => { done = true; cancelAnimationFrame(raf); ctx.clearRect(0, 0, canvas.width, canvas.height); };
    });
  }

  function _animEsqueletico(cfg: any, posX: any, posY: any, durMs: any) {
    const skel = cfg.skeleton;
    if (!skel) return Promise.resolve();
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10100;width:100vw;height:100vh';
    document.body.appendChild(canvas);
    return _renderEsqueleticoEmCanvas(cfg, canvas, posX, posY, durMs).then(() => canvas.remove());
  }

  // Exposed for modal preview
  window._esqPreviewRender = _renderEsqueleticoEmCanvas;

  // ── Executor Pixi Spine ───────────────────────────────────────────────────
  async function _animPixiSpine(animacao: any, origem: any, alvo: any) {
    const cfg = animacao.spine_config || {};

    // Calcular posição de exibição
    const pos = cfg.posicao || animacao.posicao || 'alvo';
    let x, y;
    if (pos === 'atacante' || pos === 'orbital') {
      x = origem.x; y = origem.y;
    } else if (pos === 'meio' || pos === 'area' || pos === 'cadeia' || pos === 'trajetoria' || pos === 'raio') {
      x = (origem.x + alvo.x) / 2; y = (origem.y + alvo.y) / 2;
    } else {
      // alvo, sequencial, multiplo_alvo, retorno, and default
      x = alvo.x; y = alvo.y;
    }

    const durMs = cfg.duracao || animacao.duracao || 1500;

    // Formato procedural (skeleton JSON) — sem URLs
    if (cfg.skeleton) {
      return _animEsqueletico(cfg, x, y, durMs);
    }

    // Formato avançado: URLs de assets Spine reais
    if (!cfg.json_url || !cfg.atlas_url) {
      console.warn('[AnimSpine] spine_config precisa de "skeleton" ou "json_url"+"atlas_url".');
      return;
    }

    try {
      await _carregarPixiSpine();
    } catch(e) {
      console.warn('[AnimSpine] Não foi possível carregar PixiJS/pixi-spine:', e);
      return;
    }

    const escala   = cfg.escala || 0.5;
    const animName = cfg.animation_name || 'animation';

    return new Promise<void>(resolve => {
      let app: any;
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

      PIXI.Assets.load([cfg.json_url, cfg.atlas_url]).then(() => {
        try {
          const spine = PIXI.spine.Spine.from(cfg.json_url, cfg.atlas_url);
          spine.x = x;
          spine.y = y;
          spine.scale.set(escala);
          app.stage.addChild(spine);
          const trackNames = spine.state.data.skeletonData.animations.map((a: any) => a.name);
          const nameToPlay = trackNames.includes(animName) ? animName : trackNames[0];
          if (nameToPlay) spine.state.setAnimation(0, nameToPlay, false);
        } catch(e) {
          console.warn('[AnimSpine] Erro ao criar/iniciar Spine:', e);
        }
        setTimeout(destruir, durMs);
      }).catch((e: any) => {
        console.warn('[AnimSpine] Erro ao carregar assets Spine:', e);
        destruir();
      });
    });
  }

  // Resolve áudio da animação: usa configurado ou auto-detecta pelo tipo/dano
  function _resolveAnimAudio(animacao: any) {
    if (animacao?.audio?.cast || animacao?.audio?.impact) return animacao.audio || {};
    if (typeof AudioManager === 'undefined') return {};
    return AudioManager.getSkillSfx(
      animacao?.tipo     || '',
      animacao?.posicao  || '',
      animacao?.tipo_dano || '',
      animacao?.gsap_config?.preset || ''
    );
  }

  // ── Monkey-patch de window.animarAtaque ───────────────────────────────────
  // Aguarda o DOM estar pronto para garantir que modals.js já aplicou seu patch
  function _aplicarPatch() {
    const _origAnimar = window.animarAtaque;

    window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
      if (typeof AudioManager !== 'undefined') {
        const _sfx = _resolveAnimAudio(animacao);
        if (_sfx.cast) AudioManager.playSFX(_sfx.cast, { volume: animacao?.audio?.volume ?? 0.75, pitchVariance: 0.06 });
      }
      const tipo = animacao?.tipo;

      if (tipo === GSAP_TYPE || tipo === SPINE_TYPE || tipo === COMBO_TYPE || tipo === COMBO_TOTAL_TYPE) {
        return new Promise<void>(resolve => {
          const c = (el: any) => {
            if (typeof _animCentro === 'function') return _animCentro(el);
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          };
          const origem = c(atacEl);
          const alvo   = c(alvoEl);

          if (tipo === COMBO_TOTAL_TYPE) {
            // Pixi particles conduz; GSAP e Spine rodam em paralelo fire-and-forget
            if (animacao.gsap_config)  _animGSAP(animacao, atacEl, alvoEl).catch(() => {});
            if (animacao.spine_config) _animPixiSpine(animacao, origem, alvo).catch(() => {});
            // Delegar pixi ao handler da cadeia (modals.js) com tipo trocado
            const animPixi = { ...animacao, tipo: 'pixi_particles' };
            const r = typeof _origAnimar === 'function'
              ? _origAnimar.call(this, { atacEl, alvoEl, animacao: animPixi, dano })
              : Promise.resolve();
            (r || Promise.resolve()).then(resolve).catch(resolve);
            return;
          }

          const tarefas = [];
          if (tipo === GSAP_TYPE || tipo === COMBO_TYPE) {
            tarefas.push(_animGSAP(animacao, atacEl, alvoEl));
          }
          if (tipo === SPINE_TYPE || tipo === COMBO_TYPE) {
            tarefas.push(_animPixiSpine(animacao, origem, alvo));
          }
          Promise.all(tarefas).then(resolve as any).catch(resolve as any);
        });
      }

      // COMBO: qualquer tipo pode ter gsap_config e/ou spine_config opcionais.
      // Ambos rodam em paralelo (fire-and-forget) sem bloquear a animação principal.
      if (animacao?.gsap_config) {
        _animGSAP(animacao, atacEl, alvoEl).catch(() => {});
      }
      if (animacao?.spine_config) {
        const c = (el: any) => {
          if (typeof _animCentro === 'function') return _animCentro(el);
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        _animPixiSpine(animacao, c(atacEl), c(alvoEl)).catch(() => {});
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

/* [migração-esm] accessors globais */
