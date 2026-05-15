// ui/modals.js
// RPG Hub — PixiParticles VFX engine v7 (rays, fade, decals)
// Market system moved to: js/systems/market.js


// ============================================================
// ✨ PIXI PARTICLES PLUGIN — RPG Hub v7 RAIOS E FADE
// COM SUPORTE A RAIOS CONTÍNUOS E FADE GRADUAL DE DECALS
// ============================================================

(function () {
  'use strict';

  const PIXI_TYPE = 'pixi_particles';

  // ── Canvas Persistente para Decalques COM FADE GRADUAL ───────────────
  let DECAL_CANVAS = null;
  let DECAL_CTX = null;
  let DECAL_ITEMS = []; // Array de {imageData, alpha, x, y, w, h, fadeRate}
  let DECAL_RAF = null;

  function _getDecalCanvas() {
    if (!DECAL_CANVAS) {
      DECAL_CANVAS = document.createElement('canvas');
      DECAL_CANVAS.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8887;width:100vw;height:100vh';
      DECAL_CANVAS.width = innerWidth;
      DECAL_CANVAS.height = innerHeight;
      DECAL_CTX = DECAL_CANVAS.getContext('2d');
      document.body.appendChild(DECAL_CANVAS);
    }
    return { canvas: DECAL_CANVAS, ctx: DECAL_CTX };
  }

  function _clearDecals() {
    DECAL_ITEMS = [];
    if (DECAL_CTX) DECAL_CTX.clearRect(0, 0, DECAL_CANVAS.width, DECAL_CANVAS.height);
    if (DECAL_RAF) {
      cancelAnimationFrame(DECAL_RAF);
      DECAL_RAF = null;
    }
  }

  function _startDecalFadeLoop() {
    if (DECAL_RAF) return; // Já rodando
    
    let lastTime = performance.now();
    
    function fadeLoop(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      
      // Atualizar alphas
      for (let i = DECAL_ITEMS.length - 1; i >= 0; i--) {
        const item = DECAL_ITEMS[i];
        item.alpha -= item.fadeRate * dt;
        if (item.alpha <= 0) {
          DECAL_ITEMS.splice(i, 1);
        }
      }
      
      // Redesenhar tudo
      if (DECAL_CTX && DECAL_CANVAS) {
        DECAL_CTX.clearRect(0, 0, DECAL_CANVAS.width, DECAL_CANVAS.height);
        
        DECAL_ITEMS.forEach(item => {
          DECAL_CTX.save();
          DECAL_CTX.globalAlpha = Math.max(0, Math.min(1, item.alpha));
          DECAL_CTX.putImageData(item.imageData, item.x, item.y);
          DECAL_CTX.restore();
        });
      }
      
      // Continuar loop se ainda há decals
      if (DECAL_ITEMS.length > 0) {
        DECAL_RAF = requestAnimationFrame(fadeLoop);
      } else {
        DECAL_RAF = null;
        // Limpar canvas quando não há mais nada
        if (DECAL_CTX) DECAL_CTX.clearRect(0, 0, DECAL_CANVAS.width, DECAL_CANVAS.height);
      }
    }
    
    DECAL_RAF = requestAnimationFrame(fadeLoop);
  }

  // ── Custom Shape Definitions COM RAIOS ───────────────────────────────

  function _executeCustomShapeCode(code, ctx, size, progress) {
    try {
      const cos = Math.cos, sin = Math.sin, PI = Math.PI;
      const abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow;
      const min = Math.min, max = Math.max, floor = Math.floor;
      const random = Math.random;
      
      const shapeFunc = new Function('ctx', 'size', 'progress', 'Math', `
        const {cos, sin, PI, abs, sqrt, pow, min, max, floor, random} = Math;
        ${code}
      `);
      
      shapeFunc(ctx, size, progress, Math);
    } catch (e) {
      console.warn('[PixiParticles] Erro ao executar customShapeCode:', e);
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    }
  }
  
  const CUSTOM_SHAPES = {
    // ═══ RAIOS E ELETRICIDADE ═══
    
    // Raio simples (bolt)
    lightning_bolt: function(ctx, size, progress) {
      const s = size;
      const jitter = Math.sin(progress * Math.PI * 16) * 0.08;
      
      ctx.save();
      ctx.lineWidth = s * 0.15;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Raio principal com zigue-zague
      ctx.beginPath();
      ctx.moveTo(0, -s);
      
      const segments = 8;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const y = -s + (s * 2 * t);
        const x = ((i % 2) * 2 - 1) * s * 0.3 * (1 - t * 0.5) + (Math.random() - 0.5) * s * jitter;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      
      // Brilho interno
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = s * 0.06;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      
      ctx.restore();
    },
    
    // Corrente elétrica (chain)
    electric_chain: function(ctx, size, progress) {
      const s = size;
      const wobble = Math.sin(progress * Math.PI * 12);
      
      ctx.save();
      
      // Corrente principal
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(0, -s);
      
      const links = 6;
      for (let i = 1; i <= links; i++) {
        const t = i / links;
        const y = -s + (s * 2 * t);
        const x = Math.sin(t * Math.PI * 4 + wobble) * s * 0.25;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
      
      // Elos brilhantes
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i <= links; i++) {
        const t = i / links;
        const y = -s + (s * 2 * t);
        const x = Math.sin(t * Math.PI * 4 + wobble) * s * 0.25;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    },
    
    // Arco elétrico (arc)
    electric_arc: function(ctx, size, progress) {
      const s = size;
      const pulse = 0.8 + Math.sin(progress * Math.PI * 10) * 0.2;
      
      ctx.save();
      ctx.lineWidth = s * 0.12 * pulse;
      ctx.lineCap = 'round';
      ctx.strokeStyle = ctx.fillStyle;
      
      // Arco principal
      ctx.beginPath();
      const cp1x = -s * 0.5, cp1y = 0;
      const cp2x = s * 0.5, cp2y = 0;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(cp1x, cp1y - s * 0.3, cp2x, cp2y - s * 0.3, 0, s);
      ctx.stroke();
      
      // Brilho
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = s * 0.05;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      
      // Faíscas ao longo do arco
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        // Ponto na curva de Bézier
        const mt = 1 - t;
        const x = mt * mt * mt * 0 + 
                  3 * mt * mt * t * cp1x + 
                  3 * mt * t * t * cp2x + 
                  t * t * t * 0;
        const y = mt * mt * mt * (-s) + 
                  3 * mt * mt * t * (cp1y - s * 0.3) + 
                  3 * mt * t * t * (cp2y - s * 0.3) + 
                  t * t * t * s;
        
        ctx.beginPath();
        ctx.arc(x, y, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    },
    
    // Plasma ball (esfera de plasma)
    plasma_ball: function(ctx, size, progress) {
      const s = size;
      const flicker = 0.85 + Math.sin(progress * Math.PI * 20) * 0.15;
      
      ctx.save();
      
      // Núcleo
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9 * flicker;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Raios emanando do centro
      ctx.strokeStyle = ctx.fillStyle || '#81d4fa';
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      
      const rays = 8;
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + progress * Math.PI;
        const length = s * (0.7 + Math.random() * 0.3) * flicker;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        // Raio com segmentos irregulares
        let x = 0, y = 0;
        const segments = 3;
        for (let j = 1; j <= segments; j++) {
          const t = j / segments;
          const r = length * t;
          const a = angle + (Math.random() - 0.5) * 0.3;
          x = Math.cos(a) * r;
          y = Math.sin(a) * r;
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
      }
      
      ctx.restore();
    },
    
    // Spark (faísca)
    spark: function(ctx, size, progress) {
      const s = size;
      const intensity = 1 - progress * 0.3;
      
      ctx.save();
      
      // Cruz brilhante
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = s * 0.15 * intensity;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(-s * intensity, 0);
      ctx.lineTo(s * intensity, 0);
      ctx.moveTo(0, -s * intensity);
      ctx.lineTo(0, s * intensity);
      ctx.stroke();
      
      // Núcleo brilhante
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.2 * intensity, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    },

    // ═══ FORMAS ORIGINAIS ═══
    
    // Cabeça de dragão
    dragon_head: function(ctx, size, progress) {
      const s = size;
      ctx.save();
      // Mandíbula inferior
      ctx.beginPath();
      ctx.moveTo(-s*0.6, s*0.3);
      ctx.quadraticCurveTo(-s*0.3, s*0.6, 0, s*0.4);
      ctx.quadraticCurveTo(s*0.3, s*0.6, s*0.6, s*0.3);
      // Dentes
      for(let i = -2; i <= 2; i++) {
        ctx.lineTo(i*s*0.15, s*0.3 - s*0.15);
        ctx.lineTo((i+0.5)*s*0.15, s*0.3);
      }
      ctx.closePath();
      ctx.fill();
      
      // Mandíbula superior
      ctx.beginPath();
      ctx.moveTo(-s*0.7, 0);
      ctx.quadraticCurveTo(-s*0.4, -s*0.4, 0, -s*0.5);
      ctx.quadraticCurveTo(s*0.4, -s*0.4, s*0.7, 0);
      ctx.lineTo(s*0.6, s*0.1);
      ctx.quadraticCurveTo(s*0.3, s*0.3, 0, s*0.2);
      ctx.quadraticCurveTo(-s*0.3, s*0.3, -s*0.6, s*0.1);
      ctx.closePath();
      ctx.fill();
      
      // Olho
      ctx.fillStyle = progress > 0.5 ? '#ff0000' : '#ffaa00';
      ctx.beginPath();
      ctx.arc(-s*0.3, -s*0.2, s*0.12, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    },

    // Punho de energia
    fist: function(ctx, size, progress) {
      const s = size;
      const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
      ctx.save();
      
      // Palma
      ctx.fillStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.ellipse(0, 0, s*0.4*pulse, s*0.5*pulse, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Dedos
      for(let i = 0; i < 4; i++) {
        const x = (i-1.5) * s*0.15;
        const y = -s*0.3;
        const w = s*0.1*pulse;
        const h = s*0.25*pulse;
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI*2);
        ctx.fill();
      }
      
      // Polegar
      ctx.beginPath();
      ctx.ellipse(-s*0.4, s*0.1, s*0.12*pulse, s*0.2*pulse, Math.PI*0.3, 0, Math.PI*2);
      ctx.fill();
      
      // Brilho de energia
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-s*0.1, -s*0.1, s*0.15*pulse, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    },

    // Espada fantasma
    blade: function(ctx, size, progress) {
      const s = size;
      const trail = Math.max(0, progress - 0.5) * 2;
      ctx.save();
      
      // Lâmina
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s*0.08, -s*0.2);
      ctx.lineTo(s*0.08, s*0.6);
      ctx.lineTo(0, s*0.7);
      ctx.lineTo(-s*0.08, s*0.6);
      ctx.lineTo(-s*0.08, -s*0.2);
      ctx.closePath();
      ctx.fill();
      
      // Guarda
      ctx.fillRect(-s*0.25, s*0.6, s*0.5, s*0.08);
      
      // Cabo
      ctx.fillRect(-s*0.05, s*0.68, s*0.1, s*0.25);
      
      // Rastro de movimento
      if(trail > 0) {
        ctx.globalAlpha = 0.3 * (1 - trail);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = s*0.15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-s*0.3*trail, -s);
        ctx.lineTo(-s*0.3*trail, s*0.7);
        ctx.stroke();
      }
      
      ctx.restore();
    },

    // Chamas (anatomia vetorial)
    flame: function(ctx, size, progress) {
      const s = size;
      const flicker = Math.sin(progress * Math.PI * 8) * 0.15;
      ctx.save();
      
      // Camada externa (vermelha)
      ctx.fillStyle = '#ff2200';
      ctx.beginPath();
      ctx.moveTo(0, s*0.5);
      ctx.quadraticCurveTo(-s*0.3*(1+flicker), s*0.2, -s*0.2, -s*0.3);
      ctx.quadraticCurveTo(-s*0.1, -s*0.6*(1+flicker*0.5), 0, -s);
      ctx.quadraticCurveTo(s*0.1, -s*0.6*(1+flicker*0.5), s*0.2, -s*0.3);
      ctx.quadraticCurveTo(s*0.3*(1+flicker), s*0.2, 0, s*0.5);
      ctx.closePath();
      ctx.fill();
      
      // Camada média (laranja)
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(0, s*0.4);
      ctx.quadraticCurveTo(-s*0.2, s*0.1, -s*0.15, -s*0.2);
      ctx.quadraticCurveTo(-s*0.05, -s*0.5, 0, -s*0.8);
      ctx.quadraticCurveTo(s*0.05, -s*0.5, s*0.15, -s*0.2);
      ctx.quadraticCurveTo(s*0.2, s*0.1, 0, s*0.4);
      ctx.closePath();
      ctx.fill();
      
      // Núcleo (amarelo-branco)
      ctx.fillStyle = '#ffee00';
      ctx.beginPath();
      ctx.moveTo(0, s*0.3);
      ctx.quadraticCurveTo(-s*0.1, 0, -s*0.08, -s*0.3);
      ctx.quadraticCurveTo(0, -s*0.6, 0, -s*0.7);
      ctx.quadraticCurveTo(0, -s*0.6, s*0.08, -s*0.3);
      ctx.quadraticCurveTo(s*0.1, 0, 0, s*0.3);
      ctx.closePath();
      ctx.fill();
      
      ctx.restore();
    },

    // Garra/Raiz (para efeitos de natureza)
    claw: function(ctx, size, progress) {
      const s = size;
      const grow = Math.min(1, progress * 2);
      ctx.save();
      
      for(let i = 0; i < 3; i++) {
        const angle = (i - 1) * Math.PI * 0.2;
        ctx.save();
        ctx.rotate(angle);
        
        // Garra individual
        ctx.beginPath();
        ctx.moveTo(0, s*0.3);
        ctx.quadraticCurveTo(-s*0.05, s*0.1, -s*0.08, -s*0.4*grow);
        ctx.quadraticCurveTo(-s*0.05, -s*0.5*grow, 0, -s*0.6*grow);
        ctx.quadraticCurveTo(s*0.05, -s*0.5*grow, s*0.08, -s*0.4*grow);
        ctx.quadraticCurveTo(s*0.05, s*0.1, 0, s*0.3);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      }
      
      // Base
      ctx.beginPath();
      ctx.arc(0, s*0.3, s*0.15, 0, Math.PI*2);
      ctx.fill();
      
      ctx.restore();
    }
  };

  // ── Motor Canvas 2D com Sakuga Features ──────────────────────────────
  class PixiParticleEngine {
    constructor(canvas, config, emitterPos) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.cfg = config || {};
      this.pos = emitterPos || { x: canvas.width/2, y: canvas.height/2 };
      this.particles = [];
      this.time = 0;
      this.accumulator = 0;
      this.raf = null;
      this.lastTs = null;
      this.impactFrames = [];
      this.isPreview = false;
      this._parse();
    }

    _parse() {
      const c = this.cfg;
      
      // Básicos
      this.maxParticles = Math.min(c.maxParticles || 100, 400);
      this.frequency = Math.max(c.frequency || 0.016, 0.001);
      this.particlesPerWave = c.particlesPerWave || 1;
      this.emitterLifetime = c.emitterLifetime !== undefined ? c.emitterLifetime : 1.0;
      this.addAtBack = !!c.addAtBack;
      
      // Spawn
      this.spawnType = c.spawnType || 'point';
      this.spawnCircle = c.spawnCircle || { x:0, y:0, r:10 };
      this.spawnRect = c.spawnRect || { x:0, y:0, w:20, h:20 };
      
      // Alpha & Scale
      this.alphaStart = c.alpha?.start ?? 1;
      this.alphaEnd = c.alpha?.end ?? 0;
      this.alphaCurve = c.alphaCurve || 'linear';
      this.scaleStart = c.scale?.start ?? 1;
      this.scaleEnd = c.scale?.end ?? 0.1;
      this.scaleCurve = c.scaleCurve || 'linear';
      
      // Cores
      this.colorStart = this._hex(c.color?.start || '#fff');
      this.colorEnd = this._hex(c.color?.end || '#fff');
      this.colorMid = c.color?.mid ? this._hex(c.color.mid) : null;
      
      // Velocidade & Física
      this.speedStart = c.speed?.start ?? 100;
      this.speedEnd = c.speed?.end ?? 0;
      this.maxSpeed = c.maxSpeed ?? Infinity;
      this.lifetimeMin = c.lifetime?.min ?? 0.3;
      this.lifetimeMax = c.lifetime?.max ?? 0.8;
      this.rotMin = (c.startRotation?.min ?? 0) * Math.PI/180;
      this.rotMax = (c.startRotation?.max ?? 360) * Math.PI/180;
      this.rotSpeedMin = (c.rotationSpeed?.min ?? 0) * Math.PI/180;
      this.rotSpeedMax = (c.rotationSpeed?.max ?? 0) * Math.PI/180;
      this.accel = { x: c.acceleration?.x ?? 0, y: c.acceleration?.y ?? 0 };
      
      // Renderização
      this.blendMode = c.blendMode || 'normal';
      this.noRotation = !!c.noRotation;
      this.baseSize = Math.max(c.particleBaseSize || 8, 2);
      this.particleShape = c.particleShape || 'circle';
      this.glowStrength = c.glowStrength ?? 0;
      this.turbulence = c.turbulence ?? 0;
      this.scaleXRatio = c.scaleXRatio ?? 1;
      
      // Recursos SAKUGA
      this.customShapeCode = c.customShapeCode || null;
      this.stretchSquash = c.stretchSquash !== false;
      this.stretchFactor = c.stretchFactor || 0.15;
      this.timingCurve = c.timingCurve || 'linear';
      this.hangTime = c.hangTime || 0;
      this.hangPoint = c.hangPoint || 0.5;
      this.customShape = c.customShape;
      this.shapeProgress = c.shapeProgress !== false;
      this.persistentDecal = c.persistentDecal || null;
      this.composite = c.composite || null;
      this.skeleton = c.skeleton || null;
      this.impactFrame = c.impactFrame || null;
    }

    _hex(h) {
      if (!h) return {r:255,g:255,b:255};
      const s = h.replace('#','');
      if (s.length===3) return {r:parseInt(s[0]+s[0],16),g:parseInt(s[1]+s[1],16),b:parseInt(s[2]+s[2],16)};
      return {r:parseInt(s.slice(0,2),16),g:parseInt(s.slice(2,4),16),b:parseInt(s.slice(4,6),16)};
    }

    _lerp(a,b,t) { return a+(b-a)*t; }

    _lerpColor(t) {
      if (this.colorMid) {
        if (t < 0.5) return this._lerpC(this.colorStart, this.colorMid, t * 2);
        return this._lerpC(this.colorMid, this.colorEnd, (t - 0.5) * 2);
      }
      return this._lerpC(this.colorStart, this.colorEnd, t);
    }
    
    _lerpC(a,b,t) {
      return {
        r:Math.round(this._lerp(a.r,b.r,t)),
        g:Math.round(this._lerp(a.g,b.g,t)),
        b:Math.round(this._lerp(a.b,b.b,t))
      };
    }

    _ease(t, curve) {
      switch(curve) {
        case 'easeIn': return t * t;
        case 'easeOut': return 1 - (1-t)*(1-t);
        case 'easeInOut': return t < 0.5 ? 2*t*t : 1 - 2*(1-t)*(1-t);
        case 'pulse': return Math.sin(t * Math.PI);
        case 'overshoot': {
          const s = 1.70158;
          return t * t * ((s + 1) * t - s);
        }
        case 'elastic': {
          if (t === 0 || t === 1) return t;
          const p = 0.3;
          return Math.pow(2, -10 * t) * Math.sin((t - p/4) * (2*Math.PI) / p) + 1;
        }
        case 'bounce': {
          if (t < 1/2.75) return 7.5625 * t * t;
          if (t < 2/2.75) return 7.5625 * (t -= 1.5/2.75) * t + 0.75;
          if (t < 2.5/2.75) return 7.5625 * (t -= 2.25/2.75) * t + 0.9375;
          return 7.5625 * (t -= 2.625/2.75) * t + 0.984375;
        }
        default: return t;
      }
    }

    _spawnPos() {
      const b = {x:this.pos.x, y:this.pos.y};
      if(this.spawnType==='circle') {
        const r=Math.random()*this.spawnCircle.r, a=Math.random()*Math.PI*2;
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      if(this.spawnType==='ring') {
        const r=this.spawnCircle.r, a=Math.random()*Math.PI*2;
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      if(this.spawnType==='rect') {
        return {x:b.x+(Math.random()-.5)*this.spawnRect.w, y:b.y+(Math.random()-.5)*this.spawnRect.h};
      }
      if(this.spawnType==='burst') {
        const a=Math.random()*Math.PI*2, r=Math.random()*(this.spawnCircle.r||10);
        return {x:b.x+Math.cos(a)*r, y:b.y+Math.sin(a)*r};
      }
      return {...b};
    }

    _spawn() {
      const sp = this._spawnPos();
      const angle = this.rotMin + Math.random() * (this.rotMax - this.rotMin);
      const lt = this.lifetimeMin + Math.random() * (this.lifetimeMax - this.lifetimeMin);
      const rs = this.noRotation ? 0 : this.rotSpeedMin + Math.random() * (this.rotSpeedMax - this.rotSpeedMin);
      
      return {
        x: sp.x,
        y: sp.y,
        vx: Math.cos(angle) * this.speedStart,
        vy: Math.sin(angle) * this.speedStart,
        dir: angle,
        rotation: angle,
        rotSpeed: rs,
        lifetime: lt,
        age: 0,
        stretchX: 1,
        stretchY: 1,
        hung: false,
        impacted: false
      };
    }

    update(dt) {
      // Verificar impact frames
      if (this.impactFrame && !this.impacted) {
        const progress = this.time / (this.emitterLifetime > 0 ? this.emitterLifetime : 1);
        if (progress >= this.impactFrame.at) {
          this.impacted = true;
          this.impactFrames.push({
            start: performance.now(),
            duration: this.impactFrame.duration * 1000,
            timeScale: this.impactFrame.timeScale || 0.05
          });
        }
      }

      // Aplicar impact frame slowdown
      let effectiveDt = dt;
      for (let i = this.impactFrames.length - 1; i >= 0; i--) {
        const imp = this.impactFrames[i];
        const elapsed = performance.now() - imp.start;
        if (elapsed < imp.duration) {
          effectiveDt *= imp.timeScale;
        } else {
          this.impactFrames.splice(i, 1);
        }
      }

      // Spawn de partículas
      if (this.emitterLifetime < 0 || this.time < this.emitterLifetime) {
        this.accumulator += effectiveDt;
        while (this.accumulator >= this.frequency && this.particles.length < this.maxParticles) {
          for (let i = 0; i < this.particlesPerWave; i++) {
            if (this.particles.length < this.maxParticles) {
              this.particles.push(this._spawn());
            }
          }
          this.accumulator -= this.frequency;
        }
      }

      // Update partículas
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += effectiveDt;
        
        if (p.age >= p.lifetime) {
          // Ao morrer, criar decal se configurado E NÃO estiver em modo preview
          if (this.persistentDecal && this.persistentDecal.enabled && !this.isPreview) {
            this._createDecal(p);
          }
          this.particles.splice(i, 1);
          continue;
        }

        const t = p.age / p.lifetime;
        
        // Hang time
        if (this.hangTime > 0 && !p.hung && t >= this.hangPoint && t < this.hangPoint + 0.05) {
          p.hung = true;
        }
        
        // Velocidade com curva de timing
        const speedT = this._ease(t, this.timingCurve);
        const spd = this._lerp(this.speedStart, this.speedEnd, speedT);
        const cur = Math.sqrt(p.vx*p.vx + p.vy*p.vy) || 1;
        
        p.vx = (p.vx/cur) * spd + this.accel.x * effectiveDt;
        p.vy = (p.vy/cur) * spd + this.accel.y * effectiveDt;
        
        // Turbulência
        if (this.turbulence > 0) {
          const drift = (Math.random()-.5) * this.turbulence * effectiveDt * 6;
          const cos = Math.cos(drift), sin = Math.sin(drift);
          const nx = p.vx*cos - p.vy*sin;
          const ny = p.vx*sin + p.vy*cos;
          p.vx = nx;
          p.vy = ny;
        }
        
        // Max speed
        if (this.maxSpeed < Infinity) {
          const spd2 = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
          if (spd2 > this.maxSpeed) {
            p.vx = (p.vx/spd2) * this.maxSpeed;
            p.vy = (p.vy/spd2) * this.maxSpeed;
          }
        }
        
        // Stretch & Squash
        if (this.stretchSquash) {
          const velocity = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
          const stretchAmount = Math.min(velocity * this.stretchFactor * 0.001, 0.5);
          
          p.stretchX = 1 + stretchAmount;
          p.stretchY = 1 / p.stretchX;
          
          if (this.particleShape === 'spark' || this.particleShape === 'blade') {
            p.rotation = Math.atan2(p.vy, p.vx);
          }
        } else {
          p.stretchX = 1;
          p.stretchY = 1;
        }
        
        // Posição
        p.x += p.vx * effectiveDt;
        p.y += p.vy * effectiveDt;
        
        // Rotação
        if (this.particleShape === 'spark' || this.particleShape === 'blade') {
          p.rotation = Math.atan2(p.vy, p.vx);
        } else if (!this.noRotation) {
          p.rotation += p.rotSpeed * effectiveDt;
        }
      }
      
      this.time += effectiveDt;
    }

    _createDecal(particle) {
      const decal = this.persistentDecal;
      const { ctx, canvas } = _getDecalCanvas();
      if (!ctx || !canvas) return;
      
      const t = particle.age / particle.lifetime;
      const col = this._lerpColor(t);
      const decalColor = decal.color || `rgb(${col.r},${col.g},${col.b})`;
      const size = this.baseSize * this._lerp(this.scaleStart, this.scaleEnd, t);
      const decalSize = size * (decal.sizeMultiplier || 1.2);
      
      // Criar um canvas temporário para capturar o decal
      const tempCanvas = document.createElement('canvas');
      const margin = 20;
      tempCanvas.width = decalSize * 2 + margin * 2;
      tempCanvas.height = decalSize * 2 + margin * 2;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.save();
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.globalAlpha = decal.alpha || 0.3;
      tempCtx.fillStyle = decalColor;
      tempCtx.shadowColor = decalColor;
      tempCtx.shadowBlur = decal.blur || 15;
      
      // Marca de queimadura/cicatriz
      tempCtx.beginPath();
      tempCtx.arc(0, 0, decalSize, 0, Math.PI*2);
      tempCtx.fill();
      tempCtx.restore();
      
      // Capturar imageData
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Adicionar ao array de decals com fade
      const fadeTime = decal.fadeTime || 3000;
      DECAL_ITEMS.push({
        imageData: imageData,
        alpha: 1.0,
        x: Math.floor(particle.x - tempCanvas.width / 2),
        y: Math.floor(particle.y - tempCanvas.height / 2),
        w: tempCanvas.width,
        h: tempCanvas.height,
        fadeRate: 1.0 / (fadeTime / 1000) // alpha por segundo
      });
      
      // Iniciar loop de fade se não estiver rodando
      _startDecalFadeLoop();
    }

    // Desenho de formas
    _drawShape(ctx, shape, size, progress, particle) {
      // 1. Código customizado inline (prioridade máxima)
      if (this.customShapeCode && typeof this.customShapeCode === 'string') {
        _executeCustomShapeCode(this.customShapeCode, ctx, size, progress);
        return;
      }
      
      // 2. Custom shape (função ou nome)
      if (this.customShape) {
        if (typeof this.customShape === 'function') {
          this.customShape(ctx, size, progress);
          return;
        }
        if (typeof this.customShape === 'string' && CUSTOM_SHAPES[this.customShape]) {
          CUSTOM_SHAPES[this.customShape](ctx, size, progress);
          return;
        }
      }
      
      // 3. Composite (múltiplas formas)
      if (this.composite && Array.isArray(this.composite)) {
        this.composite.forEach(comp => {
          ctx.save();
          if (comp.offset) ctx.translate(comp.offset.x || 0, comp.offset.y || 0);
          if (comp.color) ctx.fillStyle = comp.color;
          const compSize = size * (comp.scale || 1);
          
          if (comp.code) {
            _executeCustomShapeCode(comp.code, ctx, compSize, progress);
          } else {
            this._drawBasicShape(ctx, comp.shape || 'circle', compSize, progress);
          }
          ctx.restore();
        });
        return;
      }
      
      // 4. Formas básicas
      this._drawBasicShape(ctx, shape, size, progress);
    }

    _drawBasicShape(ctx, shape, size, progress) {
      switch(shape) {
        case 'star': {
          const pts=5, outer=size, inner=size*.42;
          ctx.beginPath();
          for(let i=0;i<pts*2;i++){
            const r=i%2===0?outer:inner, a=(i*Math.PI/pts)-Math.PI/2;
            i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
          }
          ctx.closePath();
          break;
        }
        case 'spark': case 'blade': {
          const lx=this.scaleXRatio*size*.18, ly=size*1.6;
          ctx.beginPath();
          ctx.ellipse(0,0,lx,ly,0,0,Math.PI*2);
          break;
        }
        case 'diamond': {
          ctx.beginPath();
          ctx.moveTo(0,-size);
          ctx.lineTo(size*.55,0);
          ctx.lineTo(0,size);
          ctx.lineTo(-size*.55,0);
          ctx.closePath();
          break;
        }
        case 'square': {
          const h=size*.75;
          ctx.beginPath();
          ctx.rect(-h,-h,h*2,h*2);
          break;
        }
        case 'flame': {
          CUSTOM_SHAPES.flame(ctx, size, progress);
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(0,0,size,0,Math.PI*2);
          break;
        }
      }
    }

    _blendOp(m) {
      const MAP = {
        normal:'source-over', add:'lighter', screen:'screen', multiply:'multiply',
        overlay:'overlay', 'soft-light':'soft-light', 'hard-light':'hard-light',
        'color-dodge':'color-dodge'
      };
      return MAP[m]||'source-over';
    }

    // Renderização
    _renderParticles() {
      const ctx = this.ctx;
      const blendOp = this._blendOp(this.blendMode);
      const useGlow = this.glowStrength > 0;
      const list = this.addAtBack ? this.particles : [...this.particles].reverse();

      let glowCtx = null, glowCanvas = null;
      if (useGlow) {
        glowCanvas = this._glowCanvas || (this._glowCanvas = document.createElement('canvas'));
        glowCanvas.width = this.canvas.width;
        glowCanvas.height = this.canvas.height;
        glowCtx = glowCanvas.getContext('2d');
        glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
      }

      ctx.globalCompositeOperation = blendOp;

      for (const p of list) {
        const t = p.age / p.lifetime;
        const alphaT = this._ease(t, this.alphaCurve);
        const scaleT = this._ease(t, this.scaleCurve);
        const alpha = Math.max(0, this._lerp(this.alphaStart, this.alphaEnd, alphaT));
        let scale = Math.max(0, this._lerp(this.scaleStart, this.scaleEnd, scaleT)) * this.baseSize;
        const col = this._lerpColor(t);
        
        if (alpha <= 0 || scale <= 0) continue;
        
        const cr = col.r, cg = col.g, cb = col.b;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.stretchX, p.stretchY);

        // Desenhar shape
        if (this.particleShape === 'circle') {
          try {
            const g = ctx.createRadialGradient(0,0,0,0,0,scale);
            g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(.45, `rgba(${cr},${cg},${cb},.75)`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            this._drawShape(ctx, 'circle', scale, t, p);
            ctx.fillStyle = g;
            ctx.fill();
          } catch(_) {}
        } else {
          try {
            ctx.save();
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.clip();
            const g = ctx.createRadialGradient(-scale*.2,-scale*.2,0,0,0,scale*1.2);
            g.addColorStop(0, `rgba(255,255,255,.55)`);
            g.addColorStop(.4, `rgba(${cr},${cg},${cb},1)`);
            g.addColorStop(1, `rgba(${Math.max(0,cr-40)},${Math.max(0,cg-40)},${Math.max(0,cb-40)},.9)`);
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
          } catch(_) {
            this._drawShape(ctx, this.particleShape, scale, t, p);
            ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
            ctx.fill();
          }
        }
        
        ctx.restore();

        // Glow layer
        if (useGlow && glowCtx) {
          glowCtx.save();
          glowCtx.globalAlpha = alpha * 0.7;
          glowCtx.translate(p.x, p.y);
          glowCtx.rotate(p.rotation);
          const gs = scale * (1 + this.glowStrength * .6);
          glowCtx.beginPath();
          glowCtx.arc(0, 0, gs, 0, Math.PI*2);
          glowCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
          glowCtx.fill();
          glowCtx.restore();
        }
      }

      // Aplicar glow
      if (useGlow && glowCanvas) {
        const blur = Math.round(this.glowStrength * 8);
        ctx.save();
        ctx.filter = `blur(${blur}px)`;
        ctx.globalCompositeOperation = this.blendMode === 'multiply' ? 'multiply' : 'lighter';
        ctx.globalAlpha = 0.65;
        ctx.drawImage(glowCanvas, 0, 0);
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    draw() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._renderParticles();
    }

    drawNoClear() {
      this._renderParticles();
    }

    get isAlive() {
      return this.particles.length > 0 || this.emitterLifetime < 0 || this.time < this.emitterLifetime;
    }

    start(onDone) {
      const loop = (ts) => {
        if (!this.lastTs) this.lastTs = ts;
        const dt = Math.min((ts - this.lastTs) / 1000, .05);
        this.lastTs = ts;
        this.update(dt);
        this.draw();
        if (this.isAlive) this.raf = requestAnimationFrame(loop);
        else if (typeof onDone === 'function') onDone();
      };
      this.raf = requestAnimationFrame(loop);
    }

    stop() {
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = null;
      }
    }
  }

  // ── Variáveis de preview ──────────────────────────────────────────────
  let _previewEng = null;
  let _previewRaf = null;

  // ── Injetar UI ────────────────────────────────────────────────────────
  function _injetarUI() {
    const sel = document.getElementById('sk-anim-tipo');
    if (sel && !sel.querySelector(`option[value="${PIXI_TYPE}"]`)) {
      const og = document.createElement('optgroup');
      og.label = 'Pixi Particles (IA Sakuga)';
      const op = document.createElement('option');
      op.value = PIXI_TYPE;
      op.textContent = '✨ Pixi Particles (IA Sakuga)';
      og.appendChild(op);
      sel.appendChild(og);
    }
    
    if (!document.getElementById('sk-anim-campos-pixi')) {
      const ref = document.getElementById('sk-anim-campos-midia');
      if (!ref) return;
      
      const div = document.createElement('div');
      div.id = 'sk-anim-campos-pixi';
      div.style.display = 'none';
      div.innerHTML = `
        <div class="form-group" style="margin-bottom:8px">
          <label>🤖 Descreva o ataque para a IA</label>
          <input type="text" id="sk-anim-pixi-descricao" placeholder="Ex: Cabeça de dragão cospe chamas, punho fantasma ataca, espada arcana corta o ar…" style="text-align:left;font-size:0.82rem">
        </div>
        <div class="form-group" style="margin-bottom:10px"><label>Posição do Efeito</label>
            <select id="sk-anim-pixi-posicao" onchange="skAnimPixiPosicaoChange()" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <optgroup label="Posições básicas">
                <option value="alvo">No alvo</option>
                <option value="atacante">No atacante</option>
                <option value="meio">No meio</option>
                <option value="trajetoria">Trajetória (projétil)</option>
                <option value="raio">⚡ Raio Contínuo</option>
              </optgroup>
              <optgroup label="Posições avançadas">
                <option value="area">💥 Área de Efeito (AoE)</option>
                <option value="multiplo_alvo">🎯 Múltiplos Alvos (cadeia)</option>
                <option value="orbital">🔵 Orbital (em torno do atacante)</option>
                <option value="cadeia">⛓ Cadeia (salta entre alvos)</option>
                <option value="sequencial">⚡⚡ Sequencial (multi-golpe)</option>
                <option value="retorno">↩ Retorno (bumerangue)</option>
              </optgroup>
            </select>
        </div>
        <div id="sk-anim-pixi-tipo-trajetoria-wrap" style="display:none;margin-bottom:10px">
          <div class="form-group">
            <label>Tipo de Trajetória</label>
            <select id="sk-anim-pixi-tipo-trajetoria" style="width:100%;padding:8px 4px;background:var(--painel);border:1px solid var(--borda);border-radius:4px;color:var(--texto);font-family:var(--fonte-d);font-size:0.72rem">
              <option value="arco">🌙 Em Arco (padrão)</option>
              <option value="direta">➡️ Linha Reta</option>
            </select>
          </div>
        </div>
        <button onclick="(document.getElementById('sk-anim-tipo')?.value==='combo_total'?skAnimComboGerarPrompt:skAnimPixiGerarPrompt)()" id="sk-anim-pixi-btn-prompt" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(123,47,190,0.3),rgba(79,163,209,0.2));border:1px solid rgba(123,47,190,0.5);border-radius:8px;color:#c8a84b;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">
          📋 Gerar Prompt para IA
        </button>
        <div id="sk-anim-pixi-prompt-wrap" style="display:none;margin-bottom:12px">
          <div style="font-size:0.62rem;color:#7a92aa;margin-bottom:4px">Cole este prompt na sua IA externa e cole o JSON retornado no campo abaixo:</div>
          <div style="position:relative">
            <textarea id="sk-anim-pixi-prompt-out" rows="8" readonly style="width:100%;box-sizing:border-box;padding:8px;padding-right:70px;background:rgba(20,12,40,0.9);border:1px solid rgba(123,47,190,0.4);border-radius:6px;color:#c8a84b;font-family:monospace;font-size:0.62rem;resize:vertical;line-height:1.45"></textarea>
            <button onclick="skAnimPixiCopiarPrompt()" id="sk-anim-pixi-btn-copiar" style="position:absolute;top:6px;right:6px;padding:4px 10px;background:rgba(123,47,190,0.25);border:1px solid rgba(123,47,190,0.5);border-radius:4px;color:#c8a84b;font-size:0.6rem;cursor:pointer">📋 Copiar</button>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:8px">
          <label style="display:flex;justify-content:space-between;align-items:center">
            <span id="sk-anim-pixi-json-label">JSON — Pixi Particles SAKUGA</span>
            <span style="display:flex;gap:6px">
              <button onclick="skAnimPixiPreviewPlay()" style="font-size:0.6rem;padding:2px 8px;background:rgba(200,168,75,0.1);border:1px solid rgba(200,168,75,0.3);border-radius:4px;color:#c8a84b;cursor:pointer">▶ Preview</button>
            </span>
          </label>
          <textarea id="sk-anim-pixi-json" rows="10" oninput="skAnimPixiOnJsonChange()" placeholder='Cole o JSON da IA ou edite manualmente'
            style="width:100%;box-sizing:border-box;padding:8px;background:rgba(5,8,16,0.9);border:1px solid rgba(123,47,190,0.3);border-radius:6px;color:#aed6f1;font-family:monospace;font-size:0.72rem;resize:vertical;margin-top:4px;line-height:1.5"></textarea>
          <div id="sk-anim-pixi-json-erro" style="display:none;font-size:0.65rem;color:#e74c3c;margin-top:4px"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div class="form-group"><label>Duração/ciclo (ms)</label><input type="number" id="sk-anim-pixi-duracao" value="1500" min="200" max="10000" step="100" style="text-align:center"></div>
          <div class="form-group"><label>Repetições</label><input type="number" id="sk-anim-pixi-repeticao" value="1" min="1" max="10" style="text-align:center"></div>
        </div>
        <div id="sk-anim-pixi-preview-wrap" style="display:none;background:rgba(5,8,16,0.92);border:1px solid rgba(123,47,190,0.3);border-radius:10px;padding:10px;text-align:center;margin-bottom:8px">
          <div style="font-size:0.65rem;color:var(--suave);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.08em">✦ Preview</div>
          <canvas id="sk-anim-pixi-preview-canvas" width="320" height="120" style="max-width:100%;border-radius:6px;background:rgba(15,21,32,0.95)"></canvas>
          <button onclick="skAnimPixiPreviewPlay()" style="display:block;margin:8px auto 0;padding:4px 16px;background:rgba(123,47,190,0.15);border:1px solid rgba(123,47,190,0.4);border-radius:5px;color:#a084e8;font-family:var(--fonte-d);font-size:0.6rem;cursor:pointer;text-transform:uppercase">▶ Repetir</button>
        </div>`;
      ref.parentNode.insertBefore(div, ref.nextSibling);
    }
  }

  // ── Mostrar/esconder tipo de trajetória ──────────────────────────────
  window.skAnimPixiPosicaoChange = function() {
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value;
    const wrap = document.getElementById('sk-anim-pixi-tipo-trajetoria-wrap');
    if (wrap) {
      wrap.style.display = posicao === 'trajetoria' ? '' : 'none';
    }
  };

  // ── Patch skAnimTipoChange ────────────────────────────────────────────
  const _origTipoChange = window.skAnimTipoChange;
  window.skAnimTipoChange = function () {
    const tipo = document.getElementById('sk-anim-tipo')?.value;
    const pixi = document.getElementById('sk-anim-campos-pixi');
    if (tipo === PIXI_TYPE || tipo === 'combo_total') {
      ['sk-anim-campos-canvas','sk-anim-campos-midia'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      ['sk-anim-preview-wrap','sk-anim-midia-preview-wrap'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      if (pixi) pixi.style.display = '';
      skAnimPixiPosicaoChange();
      // combo_total: JSON unificado — ocultar seções individuais de GSAP e Spine
      ['sk-anim-campos-gsap','sk-anim-campos-spine'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.style.display = 'none';
      });
      const lbl = document.getElementById('sk-anim-pixi-json-label');
      if (lbl) lbl.textContent = tipo === 'combo_total' ? 'JSON — Combo Completo (Pixi + GSAP + Esquelético)' : 'JSON — Pixi Particles SAKUGA';
      const btnP = document.getElementById('sk-anim-pixi-btn-prompt');
      if (btnP) btnP.textContent = tipo === 'combo_total' ? '📋 Gerar Prompt Combo Completo para IA' : '📋 Gerar Prompt para IA';
    } else {
      if (pixi) pixi.style.display = 'none';
      if (typeof _origTipoChange === 'function') _origTipoChange.call(this);
    }
  };

  // ── Gerador de Prompt SAKUGA ADAPTATIVO ───────────────────────────────
  window.skAnimPixiGerarPrompt = function () {
    const desc = document.getElementById('sk-anim-pixi-descricao')?.value.trim() || '';
    const nome = document.getElementById('sk-habilidade')?.value.trim() || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const tipoTraj = document.getElementById('sk-anim-pixi-tipo-trajetoria')?.value || 'arco';
    const descSkill = document.getElementById('sk-efeito')?.value.trim() || '';
    const tipoDano = document.getElementById('sk-tipo-dano')?.value || '';
    const tipoHabilidade = document.getElementById('sk-tipo-habilidade')?.value || 'acao';
    const wrapEl = document.getElementById('sk-anim-pixi-prompt-wrap');
    const outEl = document.getElementById('sk-anim-pixi-prompt-out');

    const posDescMap = {
      alvo: 'no alvo (impacto direto)',
      atacante: 'no atacante (emana do caster)',
      meio: 'no meio do campo (área central)',
      trajetoria: `trajetória ${tipoTraj === 'direta' ? 'em linha reta' : 'em arco parabólico'} do atacante ao alvo`,
      raio: 'raio contínuo que conecta atacante e alvo',
      area: 'área de efeito ampla centrada entre os combatentes (AoE)',
      multiplo_alvo: 'múltiplos alvos — o efeito se replica em cadeia para tokens adjacentes',
      orbital: 'efeito que orbita em torno do atacante durante o cast',
      cadeia: 'efeito em cadeia que salta visualmente de alvo em alvo',
      sequencial: 'múltiplos impactos sequenciais no mesmo alvo (multi-golpe rápido)',
      retorno: 'projétil/efeito viaja ao alvo e retorna ao atacante (bumerangue)',
    };
    const posDesc = posDescMap[posicao] || posicao;

    const isInvocacao = tipoHabilidade === 'invocacao';
    const invocacaoSecao = isInvocacao ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO ESPECIAL: INVOCAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Esta habilidade é uma INVOCAÇÃO — não um ataque. A animação deve representar a APARIÇÃO da entidade, não um impacto.
Pense: como essa entidade entra no mundo? O espaço se rasga? Ela emerge do solo, das sombras, do éter?
A animação deve cobrir a materialização completa — silhueta ganhando forma, massa, volume, presença.
A duração deve ser longa o suficiente para sentir o peso da chegada.
` : '';

    const prompt = `Você é o diretor de VFX de um RPG. Crie a animação da habilidade abaixo. Use criatividade total — não siga modelos ou paletas pré-definidos.

RESPONDA APENAS COM O JSON SOLICITADO. Sem texto explicativo, sem markdown, sem blocos de código.

══════════════════════════════════════════
HABILIDADE: "${nome}"
DESCRIÇÃO: "${desc || descSkill || '(sem descrição)'}"
TIPO DE DANO: ${tipoDano || '(não especificado)'}
POSIÇÃO DO EFEITO: ${posDesc}
══════════════════════════════════════════
${invocacaoSecao}
═══════════════════════════════════════════
SISTEMAS DE ANIMAÇÃO DISPONÍVEIS
═══════════════════════════════════════════

Você pode usar UM, DOIS ou TODOS OS TRÊS sistemas simultaneamente. Escolha o que melhor serve a habilidade.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA 1 — PIXI PARTICLES (partículas canvas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Array de emissores independentes. Cada emissor tem controle total de física, forma e timing.

Campos por emissor:
  alpha: {start, end}          scale: {start, end}        color: {start, end} (hex)
  speed: {start, end}          acceleration: {x, y}       startRotation: {min, max}
  rotationSpeed: {min, max}    lifetime: {min, max}        frequency (s entre emissões)
  emitterLifetime              maxParticles                addAtBack (bool)
  blendMode: "add"|"screen"|"normal"|"multiply"
  particleShape: "circle"|"star"|"diamond"|"spark"|"square"|"ring"
  spawnType: "point"|"circle"|"ring"|"burst"
  spawnCircle: {x, y, r}       glowStrength: 0–5           turbulence: 0–3
  stretchSquash (bool)         timingCurve: "linear"|"overshoot"|"elastic"|"bounce"|"pulse"
  impactFrame: {at, duration, timeScale}   hangTime: {at, duration}
  persistentDecal: {enabled, fadeTime, flicker, color, alpha}
  customShapeCode: string (código canvas; variáveis: ctx, size, progress)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA 2 — GSAP (movimento de token DOM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Anima o token DOM do personagem. Roda em paralelo com as partículas.

Presets (escolha um):
  Efeitos no token:    impacto_shake | impacto_escala | aura_pulso | critico_espiral | cura_flutuante
  Movimento físico:    lancamento | token_dash | token_teleport | token_arremesso_volta | token_recuo

Parâmetros: preset, cor (hex), duracao (ms), intensidade (0.3–2.0), alvo_efeito ("alvo"|"atacante"|"ambos")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SISTEMA 3 — ANIMAÇÃO ESQUELÉTICA (canvas procedural)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Bones animados com keyframes, desenhados no canvas. Sem dependência de arquivos externos.

Estrutura:
  skeleton.bones: [{id, parent?, x, y, length}]
  skeleton.slots: [{bone, draw: {type, fill, stroke?, strokeW?, glow?, alpha?, composite?}}]
    draw.type: "circle" → r | "rect" → w, h | "line" → x2, y2 | "arc" → r, startAngle, endAngle
  skeleton.tracks: [{bone, keyframes: [{t, angle, alpha?, scaleX?, scaleY?}]}]
    t vai de 0.0 a 1.0 (fração da duração total)

Parâmetros extras: duracao (ms), posicao ("alvo"|"atacante"|"meio"), escala (0.1–3.0)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMATO DE RESPOSTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apenas um sistema:
[{...emissor1...}, {...emissor2...}]   ← array puro = Pixi Particles

Dois ou três sistemas combinados:
{
  "pixi_config":  [{...}],
  "gsap_config":  {"preset":"token_dash","cor":"#ff4400","duracao":500,"intensidade":1.2,"alvo_efeito":"atacante"},
  "spine_config": {"duracao":1200,"posicao":"alvo","escala":1.0,"skeleton":{"bones":[...],"slots":[...],"tracks":[...]}}
}

Inclua apenas as seções que você vai usar. Não inclua seções vazias.

O que o observador VÊ quando "${nome}" é ativada? Construa uma identidade visual única para este momento.

JSON:`;

    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skAnimPixiCopiarPrompt = function () {
    const el = document.getElementById('sk-anim-pixi-prompt-out');
    const btn = document.getElementById('sk-anim-pixi-btn-copiar');
    if (!el) return;
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy'));
    if (btn) {
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800);
    }
  };

  // ── Gerador de Prompt Esquelético ─────────────────────────────────────
  window.skAnimSpineGerarPrompt = function () {
    const nome = document.getElementById('sk-habilidade')?.value.trim() || '';
    const descSkill = document.getElementById('sk-efeito')?.value.trim() || '';
    const tipoDano = document.getElementById('sk-tipo-dano')?.value || '';
    const tipoHabilidade = document.getElementById('sk-tipo-habilidade')?.value || 'acao';
    const wrapEl = document.getElementById('sk-anim-spine-prompt-wrap');
    const outEl  = document.getElementById('sk-anim-spine-prompt-out');

    const isInvocacao = tipoHabilidade === 'invocacao';
    const invocacaoHint = isInvocacao
      ? '\nEsta habilidade é uma INVOCAÇÃO. A animação deve mostrar a APARIÇÃO da entidade — como ela emerge, materializa-se, ganha forma e volume. Não um ataque.\n'
      : '';

    const prompt = `Você é o diretor de VFX de um RPG. Crie uma animação esquelética procedural para a habilidade abaixo.

RESPONDA APENAS COM O JSON SOLICITADO. Sem texto explicativo, sem markdown, sem blocos de código.

══════════════════════════════════
HABILIDADE: "${nome}"
DESCRIÇÃO: "${descSkill || '(sem descrição)'}"
TIPO DE DANO: ${tipoDano || '(não especificado)'}
══════════════════════════════════
${invocacaoHint}
SISTEMA DE ANIMAÇÃO ESQUELÉTICA
════════════════════════════════
Crie uma hierarquia de bones com keyframes. O renderer desenha os bones em canvas overlay em posição fixa na tela.

Estrutura do JSON:
{
  "duracao": <ms, ex: 1500>,
  "posicao": "alvo"|"atacante"|"meio"|"area"|"multiplo_alvo"|"orbital"|"cadeia"|"sequencial"|"retorno"|"trajetoria"|"raio",
  "escala": <0.1–3.0, ex: 1.0>,
  "skeleton": {
    "bones": [
      {"id": "root", "x": 0, "y": 0, "length": 0},
      {"id": "limb_a", "parent": "root", "x": 0, "y": -20, "length": 50}
    ],
    "slots": [
      {
        "bone": "limb_a",
        "draw": {
          "type": "rect",
          "w": 8, "h": 50,
          "fill": "#4488ff",
          "glow": 12,
          "alpha": 1.0,
          "composite": "lighter"
        }
      }
    ],
    "tracks": [
      {
        "bone": "limb_a",
        "keyframes": [
          {"t": 0.0, "angle": -90, "alpha": 0, "scaleX": 0.3, "scaleY": 0.3},
          {"t": 0.3, "angle":   0, "alpha": 1, "scaleX": 1.0, "scaleY": 1.0},
          {"t": 0.8, "angle":  45, "alpha": 1, "scaleX": 1.2, "scaleY": 1.2},
          {"t": 1.0, "angle":  90, "alpha": 0, "scaleX": 0.2, "scaleY": 0.2}
        ]
      }
    ]
  }
}

COMPORTAMENTO DAS POSIÇÕES:
  alvo/sequencial/multiplo_alvo/retorno → centralizado no alvo
  atacante/orbital → centralizado no atacante
  meio/area/cadeia/trajetoria/raio → ponto médio entre atacante e alvo
  Crie seus bones relativos a esse ponto de origem (0,0 é o ponto da posição escolhida).

Campos de bone: id (string único), parent? (id do bone pai), x/y (offset local em px), length (comprimento em px)
Campos de slot/draw:
  type: "circle" → r | "rect" → w, h | "line" → x2, y2 | "arc" → r, startAngle, endAngle
  fill: cor hex | stroke/strokeW: borda | glow: 0–30 (shadowBlur) | alpha: 0–1
  composite: "source-over"|"lighter"|"screen"|"multiply"
Campos de keyframe: t (0–1), angle (graus), alpha?, scaleX?, scaleY?
  O renderer interpola linearmente entre keyframes adjacentes.

Crie uma estrutura de bones que expresse a identidade visual de "${nome}".
Sem URLs, sem assets externos — apenas geometria, transformações e luz.

JSON:`;

    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skAnimSpineCopiarPrompt = function () {
    const el = document.getElementById('sk-anim-spine-prompt-out');
    const btn = document.getElementById('sk-anim-spine-btn-copiar');
    if (!el) return;
    el.select();
    el.setSelectionRange(0, 99999);
    navigator.clipboard?.writeText(el.value).catch(() => document.execCommand('copy'));
    if (btn) {
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.textContent = '📋 Copiar'; }, 1800);
    }
  };

  window.skAnimSpineOnJsonChange = function () {
    const val = document.getElementById('sk-anim-spine-json-config')?.value.trim() || '';
    const err = document.getElementById('sk-anim-spine-json-erro');
    if (!val) { if (err) err.style.display = 'none'; return; }
    try {
      JSON.parse(val);
      if (err) err.style.display = 'none';
    } catch (e) {
      if (err) { err.style.display = ''; err.textContent = '⚠ JSON inválido: ' + e.message; }
    }
  };

  // ── Preview GSAP ─────────────────────────────────────────────────────
  window.skAnimGSAPPreviewPlay = function () {
    const preset = document.getElementById('sk-anim-gsap-preset')?.value || 'impacto_shake';
    const cor = document.getElementById('sk-anim-gsap-cor')?.value || '#e74c3c';
    const intensidade = parseFloat(document.getElementById('sk-anim-gsap-intensidade')?.value) || 1.0;
    const duracao = parseInt(document.getElementById('sk-anim-gsap-duracao')?.value) || 800;
    const wrap = document.getElementById('sk-anim-gsap-preview-wrap');
    const token = document.getElementById('sk-anim-gsap-preview-token');
    if (!token || typeof gsap === 'undefined') return;
    if (wrap) wrap.style.display = '';
    gsap.killTweensOf(token);
    gsap.set(token, { clearProps: 'transform,filter,opacity' });

    const movPresets = new Set(['lancamento','token_dash','token_teleport','token_arremesso_volta','token_recuo']);
    if (movPresets.has(preset)) {
      // For movement presets, show a simple scale bounce as stand-in
      gsap.timeline()
        .to(token, { scaleX: 1.4, scaleY: 0.7, duration: 0.15, ease: 'power2.out' })
        .to(token, { scaleX: 0.7, scaleY: 1.3, filter: `drop-shadow(0 0 14px ${cor})`, duration: 0.1 })
        .to(token, { scaleX: 1, scaleY: 1, filter: 'none', duration: 0.4, ease: 'elastic.out(1,0.4)' })
        .then(() => { gsap.set(token, { clearProps: 'transform,filter,opacity' }); });
      return;
    }

    const cfg = { cor, intensidade, duracao };
    let tl;
    if (preset === 'impacto_shake') {
      const dist = 8 * intensidade;
      tl = gsap.timeline()
        .to(token, { x: -dist, duration: 0.05 })
        .to(token, { x: dist, duration: 0.05 })
        .to(token, { x: -dist * 0.6, duration: 0.05 })
        .to(token, { x: dist * 0.6, duration: 0.05 })
        .to(token, { x: 0, duration: 0.08, ease: 'power2.out' })
        .to(token, { filter: `brightness(3) drop-shadow(0 0 14px ${cor})`, duration: 0.08 }, 0)
        .to(token, { filter: 'none', duration: 0.25 }, 0.08);
    } else if (preset === 'impacto_escala') {
      const s = 1 + 0.35 * intensidade;
      tl = gsap.timeline()
        .to(token, { scaleX: s, scaleY: s, duration: 0.1, ease: 'power2.out' })
        .to(token, { filter: `drop-shadow(0 0 12px ${cor})`, duration: 0.1 }, 0)
        .to(token, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
        .to(token, { filter: 'none', duration: 0.3 }, 0.15);
    } else if (preset === 'aura_pulso') {
      const reps = Math.round(3 * intensidade);
      tl = gsap.timeline()
        .to(token, { filter: `drop-shadow(0 0 18px ${cor}) brightness(1.4)`, scaleX: 1.12, scaleY: 1.12, duration: 0.2, ease: 'sine.inOut', repeat: reps, yoyo: true })
        .to(token, { filter: 'none', scaleX: 1, scaleY: 1, duration: 0.2 });
    } else if (preset === 'critico_espiral') {
      const s = 1 + 0.5 * intensidade;
      tl = gsap.timeline()
        .to(token, { rotation: 180, scaleX: s, scaleY: s, duration: 0.35, ease: 'power2.in' })
        .to(token, { filter: `brightness(4) drop-shadow(0 0 20px ${cor})`, duration: 0.1 }, 0.25)
        .to(token, { rotation: 0, scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1, 0.3)' })
        .to(token, { filter: 'none', duration: 0.3 }, 0.4);
    } else if (preset === 'cura_flutuante') {
      const dist = 12 * intensidade;
      tl = gsap.timeline()
        .to(token, { y: -dist, filter: `drop-shadow(0 0 14px ${cor}) brightness(1.3)`, duration: 0.25, ease: 'power2.out' })
        .to(token, { y: 0, filter: 'none', duration: 0.5, ease: 'bounce.out' });
    } else {
      gsap.to(token, { filter: `drop-shadow(0 0 16px ${cor})`, duration: 0.2 })
        .then(() => gsap.to(token, { filter: 'none', duration: 0.3 }));
      return;
    }
    if (tl) tl.then(() => { gsap.set(token, { clearProps: 'transform,filter,opacity' }); });
  };

  // ── Preview Esquelético ───────────────────────────────────────────────
  window.skAnimSpinePreviewPlay = function () {
    const jsonEl = document.getElementById('sk-anim-spine-json-config');
    const canvas = document.getElementById('sk-anim-spine-preview-canvas');
    const wrap = document.getElementById('sk-anim-spine-preview-wrap');
    if (!jsonEl || !canvas) return;
    let cfg;
    try { cfg = JSON.parse(jsonEl.value.trim()); } catch (_) { return; }
    if (!cfg.skeleton) { return; }
    if (wrap) wrap.style.display = '';
    // Stop any running preview
    if (canvas._esqueleticoStop) { canvas._esqueleticoStop(); delete canvas._esqueleticoStop; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2, cy = canvas.height / 2;
    const durMs = cfg.duracao || 1500;

    const renderer = window._esqPreviewRender;
    if (typeof renderer !== 'function') return;

    // Draw background markers
    ctx.save();
    ctx.strokeStyle = 'rgba(88,160,88,0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    let looping = true;
    function playOnce() {
      if (!looping) return;
      renderer(cfg, canvas, cx, cy, durMs).then(() => {
        if (looping) setTimeout(playOnce, 400);
      });
    }
    playOnce();

    // Store stop handle
    canvas._previewLoopStop = () => { looping = false; if (canvas._esqueleticoStop) canvas._esqueleticoStop(); };
  };

  // ── Gerador de Prompt COMBO COMPLETO ─────────────────────────────────
  window.skAnimComboGerarPrompt = function () {
    const nome = document.getElementById('sk-habilidade')?.value.trim() || '';
    const desc = document.getElementById('sk-anim-pixi-descricao')?.value.trim() || '';
    const descSkill = document.getElementById('sk-efeito')?.value.trim() || '';
    const tipoDano = document.getElementById('sk-tipo-dano')?.value || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const tipoTraj = document.getElementById('sk-anim-pixi-tipo-trajetoria')?.value || 'arco';
    const tipoHabilidade = document.getElementById('sk-tipo-habilidade')?.value || 'acao';
    const wrapEl = document.getElementById('sk-anim-pixi-prompt-wrap');
    const outEl  = document.getElementById('sk-anim-pixi-prompt-out');

    const posDescMap = {
      alvo:'no alvo', atacante:'no atacante', meio:'no meio', trajetoria:`trajetória ${tipoTraj==='direta'?'reta':'arco'}`,
      raio:'raio contínuo', area:'AoE ampla', multiplo_alvo:'múltiplos alvos',
      orbital:'orbital (em torno do atacante)', cadeia:'cadeia (salta alvos)',
      sequencial:'sequencial (multi-golpe)', retorno:'retorno (bumerangue)',
    };

    const isInvocacao = tipoHabilidade === 'invocacao';
    const invHint = isInvocacao ? `\nINVOCAÇÃO: represente a APARIÇÃO da entidade — materialização, emergência, não um ataque.\n` : '';

    const prompt = `Você é o diretor de VFX de um RPG. Crie uma animação usando TODOS OS TRÊS sistemas disponíveis em combinação.

RESPONDA APENAS COM O JSON SOLICITADO. Sem texto explicativo, sem markdown, sem blocos de código.

══════════════════════════════════════
HABILIDADE: "${nome}"
DESCRIÇÃO: "${desc || descSkill || '(sem descrição)'}"
TIPO DE DANO: ${tipoDano || '(não especificado)'}
POSIÇÃO DO EFEITO: ${posDescMap[posicao] || posicao}
══════════════════════════════════════
${invHint}
Use todos os três sistemas em paralelo para máximo impacto visual.

SISTEMA 1 — PIXI PARTICLES (pixi_config):
Array de emissores. Campos: alpha/scale/color/speed:{start,end} acceleration:{x,y} startRotation/rotationSpeed:{min,max}
lifetime:{min,max} frequency emitterLifetime maxParticles addAtBack(bool)
blendMode("add"|"screen"|"normal"|"multiply") particleShape("circle"|"star"|"diamond"|"spark"|"ring")
spawnType("point"|"circle"|"ring"|"burst") spawnCircle:{x,y,r}
glowStrength(0–5) turbulence(0–3) stretchSquash timingCurve impactFrame hangTime persistentDecal
customShapeCode: string (código canvas; vars: ctx, size, progress)

SISTEMA 2 — GSAP (gsap_config):
Anima o token DOM. Preset: impacto_shake|impacto_escala|aura_pulso|critico_espiral|cura_flutuante|lancamento|token_dash|token_teleport|token_arremesso_volta|token_recuo
Campos: preset, cor (hex), duracao (ms), intensidade (0.3–2.0)
alvo_efeito: "alvo"|"atacante"|"ambos"|"area"|"orbital"|"cadeia"|"sequencial"|"retorno"|"trajetoria"|"raio"|"multiplo_alvo"

SISTEMA 3 — ESQUELÉTICO (spine_config):
Bones animados em canvas overlay. Sem arquivos externos.
{duracao, posicao, escala, skeleton:{
  bones:[{id, parent?, x, y, length}],
  slots:[{bone, draw:{type("circle"|"rect"|"line"|"arc"), fill, glow?, alpha?, composite?}}],
  tracks:[{bone, keyframes:[{t(0-1), angle, alpha?, scaleX?, scaleY?}]}]
}}

FORMATO DE RESPOSTA (objeto com as 3 seções):
{
  "pixi_config": [{...emissores...}],
  "gsap_config": {"preset":"...","cor":"#hex","duracao":<ms>,"intensidade":<0.3-2.0>,"alvo_efeito":"..."},
  "spine_config": {"duracao":<ms>,"posicao":"...","escala":<float>,"skeleton":{...}}
}

Construa uma identidade visual única para "${nome}". Os três sistemas devem se complementar, não repetir o mesmo efeito.

JSON:`;

    if (outEl) outEl.value = prompt;
    if (wrapEl) wrapEl.style.display = '';
  };

  window.skAnimPixiOnJsonChange = function () {
    const val = document.getElementById('sk-anim-pixi-json')?.value.trim() || '';
    const err = document.getElementById('sk-anim-pixi-json-erro');
    if (!val) {
      if (err) err.style.display = 'none';
      return;
    }
    try {
      JSON.parse(val);
      if (err) err.style.display = 'none';
    } catch (e) {
      if (err) {
        err.style.display = '';
        err.textContent = '⚠ JSON inválido: ' + e.message;
      }
    }
  };

  // ── Preview ───────────────────────────────────────────────────────────
  function _drawPreviewMarkers(ctx, OX, OY, TX, TY) {
    ctx.save();
    // Marcador origem (azul)
    ctx.beginPath();
    ctx.arc(OX, OY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(79,163,209,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,163,209,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Marcador alvo (vermelho)
    ctx.beginPath();
    ctx.arc(TX, TY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,80,60,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,80,60,0.9)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    ctx.restore();
  }

  window.skAnimPixiPreviewPlay = function () {
    const jsonEl = document.getElementById('sk-anim-pixi-json');
    const canvas = document.getElementById('sk-anim-pixi-preview-canvas');
    const wrap = document.getElementById('sk-anim-pixi-preview-wrap');
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const tipoTraj = document.getElementById('sk-anim-pixi-tipo-trajetoria')?.value || 'arco';
    
    if (!jsonEl || !canvas) return;
    
    let cfg;
    try {
      cfg = JSON.parse(jsonEl.value.trim());
    } catch (_) {
      return;
    }
    
    if (wrap) wrap.style.display = '';

    if (_previewEng) {
      _previewEng.stop();
      _previewEng = null;
    }
    if (_previewRaf) {
      cancelAnimationFrame(_previewRaf);
      _previewRaf = null;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const OX = 36, OY = canvas.height / 2;
    const TX = canvas.width - 36, TY = canvas.height / 2;

    if (posicao === 'raio') {
      // PREVIEW RAIO CONTÍNUO
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const totalMs = Math.min(parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500, 3000);

      const back = layers.filter(l => l.addAtBack);
      const front = layers.filter(l => !l.addAtBack);
      const ordered = [...back, ...front];

      const emPos = { x: OX, y: OY };
      const engines = ordered.map(layerCfg => {
        const adapted = _adaptarLayerParaRaio(layerCfg, {x:OX, y:OY}, {x:TX, y:TY}, totalMs);
        const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
        eng.isPreview = true;
        return eng;
      });

      let last = performance.now();
      const t0 = last;

      function raioPreviewLoop(ts) {
        const dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        const elapsed = ts - t0;

        // Calcular ângulo para o raio
        const dx = TX - OX, dy = TY - OY;
        const angleToTarget = Math.atan2(dy, dx);
        const spread = 0.1; // Pequeno spread para raios

        engines.forEach(eng => {
          eng.pos = { x: OX, y: OY };
          eng.rotMin = angleToTarget - spread;
          eng.rotMax = angleToTarget + spread;
          eng.update(dt);
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        engines.forEach(eng => eng.drawNoClear());
        _drawPreviewMarkers(ctx, OX, OY, TX, TY);

        if (elapsed < totalMs + 600) {
          _previewRaf = requestAnimationFrame(raioPreviewLoop);
        } else {
          engines.forEach(eng => {
            eng.particles = [];
            eng.time = 0;
            eng.accumulator = 0;
          });
          const t0new = performance.now();
          last = t0new;
          _previewRaf = requestAnimationFrame(raioPreviewLoop);
        }
      }

      _drawPreviewMarkers(ctx, OX, OY, TX, TY);
      _previewRaf = requestAnimationFrame(raioPreviewLoop);

    } else if (posicao === 'trajetoria') {
      // PREVIEW TRAJETÓRIA (código existente)
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const totalMs = Math.min(parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500, 3000);
      const origem = { x: OX, y: OY }, alvo = { x: TX, y: TY };

      const back = layers.filter(l => l.addAtBack);
      const front = layers.filter(l => !l.addAtBack);
      const ordered = [...back, ...front];

      const emPos = { ...origem };
      const engines = ordered.map(layerCfg => {
        const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvas, tipoTraj);
        const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
        eng._spreadAngle = adapted._spreadAngle;
        eng._tipoTrajetoria = tipoTraj;
        eng.isPreview = true;
        return eng;
      });

      let last = performance.now(), boom = false;
      const t0 = last;

      function previewLoop(ts) {
        const dt = Math.min((ts - last) / 1000, 0.05);
        last = ts;
        const elapsed = ts - t0;
        const t = Math.min(elapsed / totalMs, 1);

        if (tipoTraj === 'direta') {
          emPos.x = origem.x + (alvo.x - origem.x) * t;
          emPos.y = origem.y + (alvo.y - origem.y) * t;
        } else {
          const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const arcH = Math.min(dist * 0.15, 28);
          const cx = (origem.x + alvo.x) / 2;
          const cy = Math.min(origem.y, alvo.y) - arcH;

          emPos.x = (1 - t) * (1 - t) * origem.x + 2 * (1 - t) * t * cx + t * t * alvo.x;
          emPos.y = (1 - t) * (1 - t) * origem.y + 2 * (1 - t) * t * cy + t * t * alvo.y;
        }

        const nt = Math.min(t + 0.03, 1);
        let tnx, tny;
        if (tipoTraj === 'direta') {
          tnx = origem.x + (alvo.x - origem.x) * nt;
          tny = origem.y + (alvo.y - origem.y) * nt;
        } else {
          const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const arcH = Math.min(dist * 0.15, 28);
          const cx = (origem.x + alvo.x) / 2;
          const cy = Math.min(origem.y, alvo.y) - arcH;
          tnx = (1 - nt) * (1 - nt) * origem.x + 2 * (1 - nt) * nt * cx + nt * nt * alvo.x;
          tny = (1 - nt) * (1 - nt) * origem.y + 2 * (1 - nt) * nt * cy + nt * nt * alvo.y;
        }
        const tangAngle = Math.atan2(tny - emPos.y, tnx - emPos.x);

        if (t >= 0.88 && !boom) {
          boom = true;
          engines.forEach(eng => {
            eng.emitterLifetime = eng.time + 0.35;
            eng.frequency = Math.max(eng.frequency * 0.4, 0.002);
            eng.maxParticles = Math.min(eng.maxParticles * 2, 200);
            eng.rotMin = 0;
            eng.rotMax = Math.PI * 2;
            eng.speedStart = eng.speedStart * 1.5;
          });
        }

        engines.forEach(eng => {
          eng.pos = { ...emPos };
          eng.rotMin = tangAngle - eng._spreadAngle;
          eng.rotMax = tangAngle + eng._spreadAngle;
          eng.update(dt);
        });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        engines.forEach(eng => eng.drawNoClear());
        _drawPreviewMarkers(ctx, OX, OY, TX, TY);

        if (elapsed < totalMs + 600) {
          _previewRaf = requestAnimationFrame(previewLoop);
        } else {
          engines.forEach(eng => {
            eng.particles = [];
            eng.time = 0;
            eng.accumulator = 0;
          });
          boom = false;
          const t0new = performance.now();
          last = t0new;
          _previewRaf = requestAnimationFrame(previewLoop);
        }
      }

      _drawPreviewMarkers(ctx, OX, OY, TX, TY);
      _previewRaf = requestAnimationFrame(previewLoop);

    } else {
      // PREVIEW FIXO (código existente)
      _drawPreviewMarkers(ctx, OX, OY, TX, TY);
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      const cx = canvas.width / 2, cy = canvas.height / 2;

      if (layers.length === 1) {
        const pcfg = { ...layers[0], emitterLifetime: Math.min(layers[0].emitterLifetime || 1, 2.5) };
        _previewEng = new PixiParticleEngine(canvas, pcfg, { x: cx, y: cy });
        _previewEng.isPreview = true;
        _previewEng.start(null);
      } else {
        const back = layers.filter(l => l.addAtBack);
        const front = layers.filter(l => !l.addAtBack);
        const ordered = [...back, ...front];
        const durSecs = Math.min((parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500) / 1000, 4);

        const previewEngines = ordered.map(lc => {
          const pc = { ...lc, emitterLifetime: Math.min(lc.emitterLifetime || 1, durSecs * 0.85) };
          const eng = new PixiParticleEngine(canvas, pc, { x: cx, y: cy });
          eng.isPreview = true;
          return eng;
        });

        let last2 = performance.now();

        function fixoLoop(ts) {
          const dt = Math.min((ts - last2) / 1000, 0.05);
          last2 = ts;
          previewEngines.forEach(eng => {
            eng.pos = { x: cx, y: cy };
            eng.update(dt);
          });
          const ctx2 = canvas.getContext('2d');
          ctx2.clearRect(0, 0, canvas.width, canvas.height);
          previewEngines.forEach(eng => eng.drawNoClear());
          _drawPreviewMarkers(ctx2, OX, OY, TX, TY);
          
          const alive = previewEngines.some(e => e.isAlive);
          if (alive) {
            _previewRaf = requestAnimationFrame(fixoLoop);
          } else {
            previewEngines.forEach(e => {
              e.stop();
              e.particles = [];
              e.time = 0;
              e.accumulator = 0;
              e._parse();
            });
            last2 = performance.now();
            _previewRaf = requestAnimationFrame(fixoLoop);
          }
        }
        _previewRaf = requestAnimationFrame(fixoLoop);
      }
    }
  };

  // ── Adaptador para trajetória ─────────────────────────────────────────
  function _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, canvasRef, tipoTrajetoria) {
    const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const travelSecs = totalMs / 1000;
    const origSpeed = layerCfg.speed?.start || 100;

    const isProjectile = !!(layerCfg.customShape || layerCfg.customShapeCode || 
                            layerCfg.composite || layerCfg.particleShape !== 'circle');

    let spreadDeg, newSpeedStart, newSpeedEnd;
    
    if (isProjectile) {
      spreadDeg = 3;
      newSpeedStart = 8;
      newSpeedEnd = 0;
    } else {
      if (origSpeed > 500) {
        spreadDeg = 6;
        newSpeedStart = 12;
        newSpeedEnd = 0;
      } else if (origSpeed > 200) {
        spreadDeg = 18;
        newSpeedStart = 35;
        newSpeedEnd = 0;
      } else {
        spreadDeg = 40;
        newSpeedStart = 60;
        newSpeedEnd = 0;
      }
    }

    const scaleFactor = canvasRef ? Math.min(1, canvasRef.width / 900) : 1;
    const lifeScale = 0.5 + scaleFactor * 0.5;
    const lifeMin = Math.min((layerCfg.lifetime?.min ?? 0.15) * lifeScale, travelSecs * 0.55);
    const lifeMax = Math.min((layerCfg.lifetime?.max ?? 0.35) * lifeScale, travelSecs * 0.85);

    const freqScale = isProjectile ? 1.5 : (origSpeed > 500 ? 2.5 : 2.0);
    const newFreq = Math.max((layerCfg.frequency || 0.016) * freqScale, 0.005);
    const newEmitterLifetime = travelSecs * 0.93;

    const accel = tipoTrajetoria === 'direta' 
      ? (layerCfg.acceleration || { x: 0, y: 0 })
      : { x: 0, y: layerCfg.acceleration?.y ?? 0 };

    const adapted = {
      ...layerCfg,
      speed: { start: newSpeedStart, end: newSpeedEnd },
      lifetime: { min: Math.max(lifeMin, 0.05), max: Math.max(lifeMax, 0.1) },
      frequency: newFreq,
      emitterLifetime: newEmitterLifetime,
      acceleration: accel,
      startRotation: { min: 0, max: 360 },
      maxParticles: Math.min(layerCfg.maxParticles || 100, isProjectile ? 120 : 220),
    };

    adapted._spreadAngle = spreadDeg * Math.PI / 180;
    adapted._isProjectile = isProjectile;
    adapted._tipoTrajetoria = tipoTrajetoria;
    return adapted;
  }

  // ── Adaptador para RAIO ───────────────────────────────────────────────
  function _adaptarLayerParaRaio(layerCfg, origem, alvo, totalMs) {
    const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const travelSecs = totalMs / 1000;
    
    // Raios são contínuos, partículas nascem e morrem rapidamente
    const adapted = {
      ...layerCfg,
      // Velocidade adaptada para alcançar o alvo
      speed: { 
        start: dist / 0.3, // Alcança o alvo em ~0.3s
        end: dist / 0.5 
      },
      // Lifetime curto para renovação constante
      lifetime: { 
        min: Math.max(layerCfg.lifetime?.min || 0.15, 0.12), 
        max: Math.max(layerCfg.lifetime?.max || 0.3, 0.25) 
      },
      // Frequência alta para raio contínuo
      frequency: Math.max(layerCfg.frequency || 0.012, 0.008),
      // Emissor sempre ativo
      emitterLifetime: travelSecs,
      // Sem aceleração (raio direto)
      acceleration: { x: 0, y: 0 },
      // Partículas suficientes para raio contínuo
      maxParticles: Math.min(layerCfg.maxParticles || 100, 200),
    };

    return adapted;
  }

  // ── salvarSkill patch ─────────────────────────────────────────────────
  const _origSalvar = window.salvarSkill;
  window.salvarSkill = async function () {
    const animTipo = document.getElementById('sk-anim-tipo')?.value;
    if (animTipo !== PIXI_TYPE && animTipo !== 'combo_total') {
      return typeof _origSalvar === 'function' ? _origSalvar.call(this) : undefined;
    }

    const rawJson = document.getElementById('sk-anim-pixi-json')?.value.trim() || '';
    if (!rawJson) {
      mostrarToast('Configure as partículas antes de salvar', 'aviso');
      return;
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(rawJson);
    } catch (_) {
      mostrarToast('JSON de partículas inválido', 'erro');
      return;
    }

    // Suporta três formatos de saída da IA:
    // 1. Array legado: [{layer1}, {layer2}]  → pixi_config somente
    // 2. Objeto: {"pixi_config": [...], "gsap_config": {...}} → combo pixi+gsap
    // 3. Objeto: {"pixi_config": [...], "gsap_config": {...}, "spine_config": {...}} → triple
    let pixiCfg, gsapCfg, spineCfg;
    if (Array.isArray(parsedJson)) {
      pixiCfg = parsedJson;
    } else if (parsedJson && typeof parsedJson === 'object') {
      pixiCfg  = parsedJson.pixi_config  || parsedJson;
      gsapCfg  = parsedJson.gsap_config  || undefined;
      spineCfg = parsedJson.spine_config || undefined;
    } else {
      mostrarToast('Formato de JSON não reconhecido', 'erro');
      return;
    }

    const skillIdEditar = document.getElementById('modal-skill-id')?.value || '';
    const personagem = document.getElementById('modal-skill-personagem')?.value || '';
    const posicao = document.getElementById('sk-anim-pixi-posicao')?.value || 'alvo';
    const tipoTrajetoria = document.getElementById('sk-anim-pixi-tipo-trajetoria')?.value || 'arco';
    const duracao = parseInt(document.getElementById('sk-anim-pixi-duracao')?.value) || 1500;
    const repeticao = parseInt(document.getElementById('sk-anim-pixi-repeticao')?.value) || 1;

    const animacaoPixi = {
      tipo: animTipo,
      pixi_config: pixiCfg,
      posicao,
      tipo_trajetoria: posicao === 'trajetoria' ? tipoTrajetoria : undefined,
      duracao,
      repeticao,
      gsap_config:  gsapCfg,
      spine_config: spineCfg,
    };
    Object.keys(animacaoPixi).forEach(k => animacaoPixi[k] === undefined && delete animacaoPixi[k]);

    const qtdAntes = (window.RPG_DATA?.skills || []).length;

    // FIX: marcar a skill ANTES de chamar _origSalvar para que o evento realtime
    // do primeiro PATCH (animacao:null) não sobrescreva o pixi_config em memória.
    if (!window._pixiPatchPendente) window._pixiPatchPendente = {};
    if (skillIdEditar) window._pixiPatchPendente[skillIdEditar] = true;

    document.getElementById('sk-anim-tipo').value = 'nenhuma';

    try {
      await _origSalvar.call(this);
    } catch (e) {
      console.error('[PixiParticles] Erro no salvarSkill original:', e);
      return;
    }

    let targetId = skillIdEditar;
    if (!targetId) {
      const skills = window.RPG_DATA?.skills || [];
      if (skills.length > qtdAntes) {
        targetId = skills[skills.length - 1].id;
      }
      if (!targetId) {
        const charId = typeof _skCharId === 'function' ? _skCharId(personagem) : null;
        const sk = [...skills].reverse().find(s =>
          s.personagem === personagem || (charId && s.character_id === charId)
        );
        if (sk) targetId = sk.id;
      }
    }

    if (!targetId) {
      mostrarToast('Skill salva, mas animação pixi não pôde ser persistida', 'aviso');
      return;
    }

    // Garantir que targetId também está marcado (cobre o caso de skills novas)
    if (!window._pixiPatchPendente) window._pixiPatchPendente = {};
    window._pixiPatchPendente[targetId] = true;

    const skImm = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
    if (skImm) skImm.animacao = animacaoPixi;

    try {
      await sb(`skills?id=eq.${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ animacao: animacaoPixi })
      });
      delete window._pixiPatchPendente[targetId];
      const skPost = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(targetId));
      if (skPost) skPost.animacao = animacaoPixi;
      console.log('[PixiParticles] ✓ animacao persistida — skill', targetId);
    } catch (e) {
      delete window._pixiPatchPendente[targetId];
      console.error('[PixiParticles] Erro ao persistir animacao pixi:', e);
      mostrarToast('Skill salva, mas erro ao persistir animação de partículas', 'aviso');
    }
  };

  // ── animarAtaque patch ────────────────────────────────────────────────
  const _origAnimar = window.animarAtaque;
  window.animarAtaque = function ({ atacEl, alvoEl, animacao, dano }) {
    if (animacao?.tipo === PIXI_TYPE || animacao?.tipo === 'pixi') {
      console.log('[PixiParticles] Executando animação em jogo:', animacao);
      return new Promise(resolve => {
        const c = el => {
          if (typeof _animCentro === 'function') return _animCentro(el);
          if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        const origem = c(atacEl);
        const alvo = c(alvoEl);
        console.log('[PixiParticles] Posições - Origem:', origem, 'Alvo:', alvo);
        _runPixi(animacao, origem, alvo, resolve);
      });
    }
    return typeof _origAnimar === 'function'
      ? _origAnimar.call(this, { atacEl, alvoEl, animacao, dano })
      : Promise.resolve();
  };

  function _mkCanvas() {
    const c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:8888;width:100vw;height:100vh';
    c.width = innerWidth;
    c.height = innerHeight;
    document.body.appendChild(c);
    console.log('[PixiParticles] Canvas criado:', c.width, 'x', c.height);
    return c;
  }

  function _runPixi(animacao, origem, alvo, resolve) {
    console.log('[PixiParticles] _runPixi chamado');
    
    _clearDecals();
    
    const cfg = animacao.pixi_config || {};
    const pos = animacao.posicao || 'alvo';
    const tipoTraj = animacao.tipo_trajetoria || 'arco';
    const durMs = animacao.duracao || 1500;
    
    const maxDecalTime = 8000;
    setTimeout(() => {
      DECAL_ITEMS.forEach(item => {
        item.fadeRate = 1.0 / 2; // Fade mais rápido após tempo máximo
      });
    }, durMs + maxDecalTime);

    if (pos === 'raio') {
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      _runRaio(layers, origem, alvo, durMs, resolve);
      return;
    }

    if (pos === 'trajetoria') {
      const layers = Array.isArray(cfg) ? cfg : [cfg];
      _runTrajetoria(layers, origem, alvo, durMs, tipoTraj, resolve);
      return;
    }

    const emPos = pos === 'atacante'
      ? { ...origem }
      : pos === 'meio'
      ? { x: (origem.x + alvo.x) / 2, y: (origem.y + alvo.y) / 2 }
      : { ...alvo };
    
    console.log('[PixiParticles] Posição do emissor:', emPos);
    
    const layers = Array.isArray(cfg) ? cfg : [cfg];

    if (layers.length === 1) {
      const canvas = _mkCanvas();
      const cfgR = {
        ...layers[0],
        emitterLifetime: Math.min(layers[0].emitterLifetime || 1, (durMs / 1000) * .7)
      };
      const eng = new PixiParticleEngine(canvas, cfgR, emPos);
      eng.isPreview = false;
      const t0 = performance.now();
      eng.start(() => {
        const rem = Math.max(0, durMs - (performance.now() - t0));
        setTimeout(() => {
          canvas.remove();
          resolve();
        }, rem);
      });
      setTimeout(() => {
        eng.stop();
        canvas.remove();
        resolve();
      }, durMs + 600);
      return;
    }

    _runFixo(layers, emPos, durMs, resolve);
  }

  function _runFixo(layers, emPos, durMs, resolve) {
    console.log('[PixiParticles] _runFixo - layers:', layers.length);
    const canvas = _mkCanvas();
    const travelSecs = durMs / 1000;

    const back = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const engines = ordered.map(layerCfg => {
      const cfgR = {
        ...layerCfg,
        emitterLifetime: Math.min(layerCfg.emitterLifetime || 1, travelSecs * 0.85),
      };
      const eng = new PixiParticleEngine(canvas, cfgR, { ...emPos });
      eng.isPreview = false;
      return eng;
    });

    const t0 = performance.now();
    let last = t0, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;

      engines.forEach(eng => {
        eng.pos = { ...emPos };
        eng.update(dt);
      });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());

      if (elapsed < durMs + 800) {
        raf = requestAnimationFrame(loop);
      } else {
        engines.forEach(e => e.stop());
        canvas.remove();
        resolve();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  function _runTrajetoria(layers, origem, alvo, totalMs, tipoTrajetoria, resolve) {
    console.log('[PixiParticles] _runTrajetoria - tipo:', tipoTrajetoria);
    const canvas = _mkCanvas();
    const t0 = performance.now();

    const back = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const emPos = { ...origem };

    const engines = ordered.map(layerCfg => {
      const adapted = _adaptarLayerParaTrajetoria(layerCfg, origem, alvo, totalMs, null, tipoTrajetoria);
      const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
      eng._spreadAngle = adapted._spreadAngle;
      eng._tipoTrajetoria = tipoTrajetoria;
      eng.isPreview = false;
      return eng;
    });

    let last = t0, boom = false, raf = null;

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;
      const t = Math.min(elapsed / totalMs, 1);

      if (tipoTrajetoria === 'direta') {
        emPos.x = origem.x + (alvo.x - origem.x) * t;
        emPos.y = origem.y + (alvo.y - origem.y) * t;
      } else {
        const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const arcH = Math.min(dist * 0.15, 80);
        const cx = (origem.x + alvo.x) / 2;
        const cy = Math.min(origem.y, alvo.y) - arcH;

        emPos.x = (1 - t) * (1 - t) * origem.x + 2 * (1 - t) * t * cx + t * t * alvo.x;
        emPos.y = (1 - t) * (1 - t) * origem.y + 2 * (1 - t) * t * cy + t * t * alvo.y;
      }

      const nt = Math.min(t + 0.02, 1);
      let tnx, tny;
      if (tipoTrajetoria === 'direta') {
        tnx = origem.x + (alvo.x - origem.x) * nt;
        tny = origem.y + (alvo.y - origem.y) * nt;
      } else {
        const dx = alvo.x - origem.x, dy = alvo.y - origem.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const arcH = Math.min(dist * 0.15, 80);
        const cx = (origem.x + alvo.x) / 2;
        const cy = Math.min(origem.y, alvo.y) - arcH;
        tnx = (1 - nt) * (1 - nt) * origem.x + 2 * (1 - nt) * nt * cx + nt * nt * alvo.x;
        tny = (1 - nt) * (1 - nt) * origem.y + 2 * (1 - nt) * nt * cy + nt * nt * alvo.y;
      }
      const tangAngle = Math.atan2(tny - emPos.y, tnx - emPos.x);

      if (t >= 0.88 && !boom) {
        boom = true;
        engines.forEach(eng => {
          eng.emitterLifetime = eng.time + 0.45;
          eng.frequency = Math.max(eng.frequency * 0.35, 0.002);
          eng.maxParticles = Math.min(eng.maxParticles * 2, 350);
          eng.particlesPerWave = 3;
          eng.rotMin = 0;
          eng.rotMax = Math.PI * 2;
          eng.speedStart = eng.speedStart * 1.6;
        });
      }

      engines.forEach(eng => {
        eng.pos = { ...emPos };
        eng.rotMin = tangAngle - eng._spreadAngle;
        eng.rotMax = tangAngle + eng._spreadAngle;
        eng.update(dt);
      });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());

      if (elapsed < totalMs + 700) {
        raf = requestAnimationFrame(loop);
      } else {
        engines.forEach(e => e.stop());
        canvas.remove();
        resolve();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  // ── NOVA FUNÇÃO: _runRaio ─────────────────────────────────────────────
  function _runRaio(layers, origem, alvo, totalMs, resolve) {
    console.log('[PixiParticles] _runRaio - raio contínuo');
    const canvas = _mkCanvas();
    const t0 = performance.now();

    const back = layers.filter(l => l.addAtBack);
    const front = layers.filter(l => !l.addAtBack);
    const ordered = [...back, ...front];

    const emPos = { ...origem };

    const engines = ordered.map(layerCfg => {
      const adapted = _adaptarLayerParaRaio(layerCfg, origem, alvo, totalMs);
      const eng = new PixiParticleEngine(canvas, adapted, { ...emPos });
      eng.isPreview = false;
      return eng;
    });

    let last = t0, raf = null;

    // Calcular ângulo para o raio
    const dx = alvo.x - origem.x;
    const dy = alvo.y - origem.y;
    const angleToTarget = Math.atan2(dy, dx);
    const spread = 0.1; // Pequeno spread para raios caóticos

    function loop(ts) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      const elapsed = ts - t0;

      engines.forEach(eng => {
        eng.pos = { x: origem.x, y: origem.y };
        // Raios apontam sempre para o alvo com pequena variação
        eng.rotMin = angleToTarget - spread;
        eng.rotMax = angleToTarget + spread;
        eng.update(dt);
      });

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      engines.forEach(eng => eng.drawNoClear());

      if (elapsed < totalMs + 400) {
        raf = requestAnimationFrame(loop);
      } else {
        engines.forEach(e => e.stop());
        canvas.remove();
        resolve();
      }
    }

    raf = requestAnimationFrame(loop);
  }

  // ── abrirModalSkill patch ─────────────────────────────────────────────
  const _origAbrir = window.abrirModalSkill;

  function _populatePixiFields() {
    const sid = document.getElementById('modal-skill-id')?.value;
    if (!sid) return false;
    const sk = (window.RPG_DATA?.skills || []).find(s => String(s.id) === String(sid));
    const anim = sk?.animacao;
    if (!anim || (anim.tipo !== PIXI_TYPE && anim.tipo !== 'pixi' && anim.tipo !== 'combo_total')) return false;

    _injetarUI();

    const tipoEl = document.getElementById('sk-anim-tipo');
    const tipoAlvo = (anim.tipo === 'combo_total') ? 'combo_total' : PIXI_TYPE;
    if (tipoEl && tipoEl.value !== tipoAlvo) {
      tipoEl.value = tipoAlvo;
      if (typeof window.skAnimTipoChange === 'function') window.skAnimTipoChange();
    }
    const pixi = document.getElementById('sk-anim-campos-pixi');
    if (pixi) pixi.style.display = '';

    const jEl = document.getElementById('sk-anim-pixi-json');
    const pEl = document.getElementById('sk-anim-pixi-posicao');
    const tEl = document.getElementById('sk-anim-pixi-tipo-trajetoria');
    const dEl = document.getElementById('sk-anim-pixi-duracao');
    const rEl = document.getElementById('sk-anim-pixi-repeticao');
    // Pixi JSON: para combo_total mostra o objeto unificado completo
    let jsonParaExibir;
    if (anim.tipo === 'combo_total') {
      const unified = {};
      if (anim.pixi_config) unified.pixi_config = anim.pixi_config;
      if (anim.gsap_config) unified.gsap_config = anim.gsap_config;
      if (anim.spine_config) unified.spine_config = anim.spine_config;
      jsonParaExibir = Object.keys(unified).length ? JSON.stringify(unified, null, 2) : '';
    } else if (anim.gsap_config || anim.spine_config) {
      const obj = {};
      if (anim.pixi_config) obj.pixi_config = anim.pixi_config;
      if (anim.gsap_config)  obj.gsap_config  = anim.gsap_config;
      if (anim.spine_config) obj.spine_config = anim.spine_config;
      jsonParaExibir = JSON.stringify(obj, null, 2);
    } else {
      jsonParaExibir = anim.pixi_config ? JSON.stringify(anim.pixi_config, null, 2) : '';
    }
    if (jEl) jEl.value = jsonParaExibir;
    if (pEl) pEl.value = anim.posicao || 'alvo';
    if (tEl) tEl.value = anim.tipo_trajetoria || 'arco';
    if (dEl) dEl.value = anim.duracao || 1500;
    if (rEl) rEl.value = anim.repeticao || 1;

    skAnimPixiPosicaoChange();
    return true;
  }

  window.abrirModalSkill = function (...args) {
    _injetarUI();
    if (typeof _origAbrir === 'function') _origAbrir.apply(this, args);
    _populatePixiFields();
  };

  // ── Init ──────────────────────────────────────────────────────────────
  function _init() {
    _injetarUI();
    const ov = document.getElementById('modal-skill-overlay');
    if (ov) {
      new MutationObserver(() => {
        if (ov.style.display !== 'none') _injetarUI();
      }).observe(ov, { attributes: true, attributeFilter: ['style'] });
    }
    console.log('✓ Pixi Particles Plugin v7 — RAIOS E FADE GRADUAL DE DECALS');
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 800);
  }

})();

// ── Abrir modal de colar pacote ───────────────────────────────────────────
window._abrirModalPacote = function() {
  const m = document.getElementById('modal-colar-pacote');
  if (m) { m.style.display = 'flex'; }
};

// Renderizar painel de sessão ao abrir aba mapas
HUB_EVENTS.on('cena_carregada', () => sessionRenderPainel());
