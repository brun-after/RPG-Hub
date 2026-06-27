// ─── Studio Pixi — Presets Library ───────────────────────────────────────────
// 15+ curated animation configs in Studio Pixi format (version 2)
// Each entry is a full config_json ready to load into the editor or play in-game

var PIXI_STUDIO_PRESETS = {

  fogo_nova: {
    version: 2, behavior: 'one-shot', duracao_ms: 900, posicao: 'alvo',
    camera: { shake: { amp: 5, decay: 0.92, freq: 34 }, hitstop: { ms: 50, at: 0.18 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.85, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.12 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Núcleo', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 10, outerStrength: 1.4, color: '#ff8842' },
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.55, time: 0 }, { value: 0.05, time: 1 }], minimumScaleMultiplier: 0.7 },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ffb255', time: 0.3 }, { value: 'c44a1c', time: 1 }] },
          speed: { start: 260, end: 60, minimumSpeedMultiplier: 0.5 },
          acceleration: { x: 0, y: -50 }, startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -180, max: 180 },
          lifetime: { min: 0.3, max: 0.6 }, frequency: 0.006, emitterLifetime: 0.28,
          maxParticles: 90, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Fagulhas', visivel: true, z: 4, blendMode: 'add',
        texture: 'ember', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.32, time: 0 }, { value: 0.06, time: 1 }] },
          color: { list: [{ value: 'fff0c2', time: 0 }, { value: 'ff7a1c', time: 1 }] },
          speed: { start: 340, end: 90 }, acceleration: { x: 0, y: 220 },
          lifetime: { min: 0.4, max: 0.75 }, frequency: 0.014, emitterLifetime: 0.3,
          maxParticles: 28, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 3 }
        }, keyframes: [] },
    ],
  },

  gelo_estilhaco: {
    version: 2, behavior: 'one-shot', duracao_ms: 800, posicao: 'alvo',
    camera: { shake: { amp: 3, decay: 0.92, freq: 30 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.7, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.08 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Cristais', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 10, outerStrength: 1.3, color: '#9fd9ff' },
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.5, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: '7fc8ff', time: 1 }] },
          speed: { start: 240, end: 60 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.3, max: 0.6 }, frequency: 0.008, emitterLifetime: 0.3,
          maxParticles: 70, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 6 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Anel de Choque', visivel: true, z: 4, blendMode: 'add',
        texture: 'ring', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0.7, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.2, time: 0 }, { value: 1.8, time: 1 }] },
          color: { list: [{ value: 'e8f6ff', time: 0 }, { value: '4aa8e8', time: 1 }] },
          speed: { start: 0, end: 0 }, lifetime: { min: 0.45, max: 0.5 },
          frequency: 0.5, emitterLifetime: 0.05, maxParticles: 1, spawnType: 'point'
        }, keyframes: [] },
    ],
  },

  raio_cadeia: {
    version: 2, behavior: 'one-shot', duracao_ms: 650, posicao: 'alvo',
    camera: { shake: { amp: 7, decay: 0.88, freq: 42 }, hitstop: { ms: 40, at: 0.1 } },
    lighting: { bloom: { threshold: 0.5, intensity: 1.0, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.18 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Descarga', visivel: true, z: 3, blendMode: 'add',
        texture: 'streak', texture_url: null,
        glow: { distance: 12, outerStrength: 1.6, color: '#cfe4ff' },
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.5, time: 0 }, { value: 0.1, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: '9ec8ff', time: 1 }] },
          speed: { start: 120, end: 20 },
          lifetime: { min: 0.18, max: 0.35 }, frequency: 0.005, emitterLifetime: 0.3,
          maxParticles: 60, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 3 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Centelhas', visivel: true, z: 4, blendMode: 'add',
        texture: 'spark', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.2, time: 0 }, { value: 0.03, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'c8f0ff', time: 1 }] },
          speed: { start: 300, end: 30 }, acceleration: { x: 0, y: 80 },
          lifetime: { min: 0.15, max: 0.4 }, frequency: 0.008, emitterLifetime: 0.2,
          maxParticles: 40, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 4 }
        }, keyframes: [] },
    ],
  },

  veneno_nuvem: {
    version: 2, behavior: 'one-shot', duracao_ms: 1100, posicao: 'alvo',
    camera: { shake: { amp: 2, decay: 0.95, freq: 20 } },
    lighting: { bloom: { threshold: 0.65, intensity: 0.55, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Névoa', visivel: true, z: 2, blendMode: 'normal',
        texture: 'smoke', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0, time: 0 }, { value: 0.55, time: 0.3 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.3, time: 0 }, { value: 1.4, time: 1 }] },
          color: { list: [{ value: '80ff40', time: 0 }, { value: '204010', time: 1 }] },
          speed: { start: 40, end: 8 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.8, max: 1.2 }, frequency: 0.018, emitterLifetime: 0.6,
          maxParticles: 30, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 12 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Bolhas', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 6, outerStrength: 1.0, color: '#80ff40' },
        emitter: {
          alpha: { list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.2, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'c8ffb0', time: 0 }, { value: '408020', time: 1 }] },
          speed: { start: 60, end: 10 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.4, max: 0.7 }, frequency: 0.025, emitterLifetime: 0.7,
          maxParticles: 35, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 8 }
        }, keyframes: [] },
    ],
  },

  sagrado_explosao: {
    version: 2, behavior: 'one-shot', duracao_ms: 900, posicao: 'alvo',
    camera: { shake: { amp: 2, decay: 0.95, freq: 24 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.9, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.05 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Luz Divina', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 14, outerStrength: 1.6, color: '#ffe18a' },
        emitter: {
          alpha: { list: [{ value: 0.95, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.35, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ffd47a', time: 1 }] },
          speed: { start: 160, end: 30 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.45, max: 0.9 }, frequency: 0.01, emitterLifetime: 0.5,
          maxParticles: 90, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 8 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Runas', visivel: true, z: 4, blendMode: 'add',
        texture: 'rune', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0.7, time: 0.5 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.6, time: 0 }, { value: 0.1, time: 1 }] },
          color: { list: [{ value: 'fffbe8', time: 0 }, { value: 'c8901c', time: 1 }] },
          speed: { start: 70, end: 10 }, startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -60, max: 60 },
          lifetime: { min: 0.6, max: 1.0 }, frequency: 0.04, emitterLifetime: 0.3,
          maxParticles: 10, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 15 }
        }, keyframes: [] },
    ],
  },

  sombra_vortex: {
    version: 2, behavior: 'one-shot', duracao_ms: 1000, posicao: 'alvo',
    camera: { shake: { amp: 4, decay: 0.93, freq: 30 }, hitstop: { ms: 60, at: 0.55 } },
    lighting: { bloom: { threshold: 0.65, intensity: 0.7, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.25 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Sombra', visivel: true, z: 2, blendMode: 'multiply',
        texture: 'smoke', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0, time: 0 }, { value: 0.75, time: 0.5 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.2, time: 0 }, { value: 1.6, time: 1 }] },
          color: { list: [{ value: '4a1a6a', time: 0 }, { value: '0a0014', time: 1 }] },
          speed: { start: 90, end: 18 }, lifetime: { min: 0.7, max: 1.0 }, frequency: 0.014,
          emitterLifetime: 0.5, maxParticles: 40, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 10 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Maldição', visivel: true, z: 4, blendMode: 'add',
        texture: 'ember', texture_url: null,
        glow: { distance: 8, outerStrength: 1.2, color: '#a020f0' },
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.35, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'd080ff', time: 0 }, { value: '5010a0', time: 1 }] },
          speed: { start: -180, end: -15 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.5, max: 0.85 }, frequency: 0.008, emitterLifetime: 0.5,
          maxParticles: 55, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 60 }
        }, keyframes: [] },
    ],
  },

  vento_corte: {
    version: 2, behavior: 'one-shot', duracao_ms: 600, posicao: 'alvo',
    camera: { shake: { amp: 3, decay: 0.9, freq: 38 } },
    lighting: { bloom: { threshold: 0.7, intensity: 0.5, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.05 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Lâminas', visivel: true, z: 3, blendMode: 'add',
        texture: 'streak', texture_url: null,
        glow: { distance: 8, outerStrength: 1.2, color: '#c0f0d0' },
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.7, time: 0 }, { value: 0.1, time: 1 }] },
          color: { list: [{ value: 'e0fff0', time: 0 }, { value: '20b060', time: 1 }] },
          speed: { start: 350, end: 80 }, startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -200, max: 200 },
          lifetime: { min: 0.2, max: 0.45 }, frequency: 0.01, emitterLifetime: 0.25,
          maxParticles: 35, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 }
        }, keyframes: [] },
    ],
  },

  terra_tremor: {
    version: 2, behavior: 'one-shot', duracao_ms: 900, posicao: 'alvo',
    camera: { shake: { amp: 9, decay: 0.85, freq: 22 }, hitstop: { ms: 80, at: 0.1 } },
    lighting: { bloom: { threshold: 0.65, intensity: 0.6, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.15 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Detritos', visivel: true, z: 3, blendMode: 'normal',
        texture: 'smoke', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0.85, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.6, time: 0 }, { value: 0.15, time: 1 }] },
          color: { list: [{ value: 'c89060', time: 0 }, { value: '503020', time: 1 }] },
          speed: { start: 120, end: 20 }, acceleration: { x: 0, y: 200 },
          lifetime: { min: 0.5, max: 0.9 }, frequency: 0.01, emitterLifetime: 0.4,
          maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 15 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Poeira', visivel: true, z: 2, blendMode: 'normal',
        texture: 'smoke', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0, time: 0 }, { value: 0.4, time: 0.2 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.4, time: 0 }, { value: 2.0, time: 1 }] },
          color: { list: [{ value: 'e0c090', time: 0 }, { value: '806040', time: 1 }] },
          speed: { start: 60, end: 5 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.8, max: 1.2 }, frequency: 0.025, emitterLifetime: 0.5,
          maxParticles: 20, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 20 }
        }, keyframes: [] },
    ],
  },

  sangue_jato: {
    version: 2, behavior: 'one-shot', duracao_ms: 700, posicao: 'alvo',
    camera: { shake: { amp: 4, decay: 0.9, freq: 30 } },
    lighting: { bloom: { threshold: 0.7, intensity: 0.5, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Gotas', visivel: true, z: 3, blendMode: 'normal',
        texture: 'spark', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0.8, time: 0.7 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.3, time: 0 }, { value: 0.06, time: 1 }] },
          color: { list: [{ value: 'ff2020', time: 0 }, { value: '800010', time: 1 }] },
          speed: { start: 200, end: 40 }, acceleration: { x: 0, y: 300 },
          startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.3, max: 0.55 }, frequency: 0.008, emitterLifetime: 0.25,
          maxParticles: 60, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 }
        }, keyframes: [] },
    ],
  },

  fumaca_escura: {
    version: 2, behavior: 'one-shot', duracao_ms: 1200, posicao: 'alvo',
    camera: { shake: { amp: 1, decay: 0.97, freq: 16 } },
    lighting: { bloom: { threshold: 0.7, intensity: 0.4, quality: 3 }, tone: 'filmic' },
    background: { darken: 0.2 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Fumaça', visivel: true, z: 3, blendMode: 'multiply',
        texture: 'smoke', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0, time: 0 }, { value: 0.65, time: 0.25 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.3, time: 0 }, { value: 2.2, time: 1 }] },
          color: { list: [{ value: '606060', time: 0 }, { value: '101010', time: 1 }] },
          speed: { start: 30, end: 5 }, acceleration: { x: 0, y: -20 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 1.0, max: 1.5 }, frequency: 0.02, emitterLifetime: 0.7,
          maxParticles: 25, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 10 }
        }, keyframes: [] },
    ],
  },

  faiscas_magicas: {
    version: 2, behavior: 'one-shot', duracao_ms: 750, posicao: 'alvo',
    camera: { shake: { amp: 2, decay: 0.95, freq: 28 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.7, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.07 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Faíscas', visivel: true, z: 3, blendMode: 'add',
        texture: 'star', texture_url: null,
        glow: { distance: 8, outerStrength: 1.1, color: '#d0a0ff' },
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.5, time: 0 }, { value: 0.08, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'c060ff', time: 0.5 }, { value: '4010a0', time: 1 }] },
          speed: { start: 180, end: 30 }, startRotation: { min: 0, max: 360 }, rotationSpeed: { min: -120, max: 120 },
          lifetime: { min: 0.3, max: 0.6 }, frequency: 0.01, emitterLifetime: 0.35,
          maxParticles: 45, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 6 }
        }, keyframes: [] },
    ],
  },

  cura_luz: {
    version: 2, behavior: 'one-shot', duracao_ms: 1000, posicao: 'alvo',
    camera: { shake: { amp: 0, decay: 1, freq: 0 } },
    lighting: { bloom: { threshold: 0.5, intensity: 1.1, quality: 5 }, tone: 'filmic' },
    background: { darken: 0 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Partículas de Cura', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 12, outerStrength: 1.5, color: '#40ffb0' },
        emitter: {
          alpha: { list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.25, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: '80ffcc', time: 0.5 }, { value: '00c080', time: 1 }] },
          speed: { start: 80, end: 10 }, acceleration: { x: 0, y: -30 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.5, max: 1.0 }, frequency: 0.012, emitterLifetime: 0.6,
          maxParticles: 60, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 10 }
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Brilho', visivel: true, z: 2, blendMode: 'add',
        texture: 'glow', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 0, time: 0 }, { value: 0.6, time: 0.3 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.5, time: 0 }, { value: 1.5, time: 1 }] },
          color: { list: [{ value: 'b0ffe8', time: 0 }, { value: '008060', time: 1 }] },
          speed: { start: 0, end: 0 },
          lifetime: { min: 0.8, max: 1.0 }, frequency: 1, emitterLifetime: 0.1, maxParticles: 1, spawnType: 'point'
        }, keyframes: [] },
    ],
  },

  teleporte_anel: {
    version: 2, behavior: 'one-shot', duracao_ms: 700, posicao: 'alvo',
    camera: { shake: { amp: 2, decay: 0.94, freq: 26 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.8, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Anéis', visivel: true, z: 3, blendMode: 'add',
        texture: 'ring', texture_url: null,
        glow: { distance: 12, outerStrength: 1.4, color: '#a0c8ff' },
        emitter: {
          alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.15, time: 0 }, { value: 2.5, time: 1 }] },
          color: { list: [{ value: 'e0f0ff', time: 0 }, { value: '2060ff', time: 1 }] },
          speed: { start: 0, end: 0 },
          lifetime: { min: 0.35, max: 0.45 }, frequency: 0.1, emitterLifetime: 0.4, maxParticles: 4, spawnType: 'point'
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Portal', visivel: true, z: 2, blendMode: 'add',
        texture: 'spark', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.3, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: '4080ff', time: 1 }] },
          speed: { start: 100, end: 20 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.2, max: 0.5 }, frequency: 0.012, emitterLifetime: 0.4,
          maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 8 }
        }, keyframes: [] },
    ],
  },

  onda_de_choque: {
    version: 2, behavior: 'one-shot', duracao_ms: 800, posicao: 'alvo',
    camera: { shake: { amp: 8, decay: 0.87, freq: 36 }, hitstop: { ms: 70, at: 0.05 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.75, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.15 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Expansão', visivel: true, z: 4, blendMode: 'add',
        texture: 'ring', texture_url: null,
        glow: { distance: 10, outerStrength: 1.3, color: '#ffc840' },
        emitter: {
          alpha: { list: [{ value: 0.85, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.1, time: 0 }, { value: 3.0, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ffa020', time: 0.5 }, { value: 'a05010', time: 1 }] },
          speed: { start: 0, end: 0 },
          lifetime: { min: 0.5, max: 0.6 }, frequency: 0.25, emitterLifetime: 0.15, maxParticles: 2, spawnType: 'point'
        }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Debris', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null, glow: null,
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'ffee80', time: 0 }, { value: 'c04010', time: 1 }] },
          speed: { start: 280, end: 40 }, acceleration: { x: 0, y: 150 },
          startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.35, max: 0.6 }, frequency: 0.007, emitterLifetime: 0.2,
          maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 4 }
        }, keyframes: [] },
    ],
  },

  feixe_energia: {
    version: 2, behavior: 'projectile', duracao_ms: 1200, posicao: 'trajetoria',
    behavior_config: { projectile_speed_ms: 500 },
    camera: { shake: { amp: 3, decay: 0.94, freq: 30 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.9, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Núcleo do Feixe', visivel: true, z: 3, blendMode: 'add',
        texture: 'streak', texture_url: null,
        glow: { distance: 14, outerStrength: 2.0, color: '#ff8040' },
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.6, time: 0 }, { value: 0.06, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ff9040', time: 0.4 }, { value: 'ff3010', time: 1 }] },
          speed: { start: 80, end: 10 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.15, max: 0.3 }, frequency: 0.004, emitterLifetime: 0.5,
          maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 3 }
        }, keyframes: [] },
    ],
  },

  arcano_preciso: {
    version: 2, behavior: 'one-shot', duracao_ms: 600, posicao: 'alvo',
    camera: { shake: { amp: 2, decay: 0.95, freq: 28 } },
    lighting: { bloom: { threshold: 0.7, intensity: 0.5, quality: 4 }, tone: 'filmic' },
    background: { darken: 0.06 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Lança Arcana', visivel: true, z: 3, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 6, outerStrength: 1.0, color: '#a978ff' },
        emitter: {
          alpha: { list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.25, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'a978ff', time: 0.4 }, { value: '5a30c8', time: 1 }] },
          speed: { start: 90, end: 20 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.25, max: 0.45 }, frequency: 0.015, emitterLifetime: 0.3,
          maxParticles: 25, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 4 }
        }, keyframes: [] },
    ],
  },

  aura_persistente: {
    version: 2, behavior: 'follow-caster', duracao_ms: 3000, posicao: 'atacante',
    camera: { shake: { amp: 0, decay: 1, freq: 0 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.6, quality: 4 }, tone: 'filmic' },
    background: { darken: 0 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Aura', visivel: true, z: 2, blendMode: 'add',
        texture: 'spark', texture_url: null,
        glow: { distance: 10, outerStrength: 1.2, color: '#c8a84b' },
        emitter: {
          alpha: { list: [{ value: 0.6, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.2, time: 0 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'ffeeaa', time: 0 }, { value: 'c8780a', time: 1 }] },
          speed: { start: 50, end: 5 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.6, max: 1.2 }, frequency: 0.03, emitterLifetime: -1,
          maxParticles: 30, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 18 }
        }, keyframes: [] },
    ],
  },

  // ─── Showcase presets (glow + trilha + bloom + travel + easing + luz) ──────
  meteoro_flamejante: {
    version: 2, behavior: 'projectile', duracao_ms: 1100, posicao: 'trajetoria',
    behavior_config: { projectile_speed_ms: 700 }, travel: { path: 'arc', rotate: 'velocity' },
    camera: { shake: { amp: 6, decay: 0.9, freq: 36 }, hitstop: { ms: 60, at: 0.62 } },
    lighting: { bloom: { threshold: 0.5, intensity: 1.1, quality: 6 }, tone: 'filmic' },
    background: { darken: 0.12 }, audio: { cast: 'fire_cast', impact: 'fire_burst', volume: 0.8 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Núcleo', visivel: true, z: 3, blendMode: 'add', texture: 'ember', texture_url: null,
        glow: { distance: 14, outerStrength: 1.8, innerStrength: 0, color: '#ff8a2a' }, trail: { length: 14, fade: 0.7 },
        emitter: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.7, time: 0 }, { value: 0.1, time: 1 }] },
          color: { list: [{ value: 'fff1c2', time: 0 }, { value: 'ff6a1c', time: 1 }] }, speed: { start: 60, end: 10 },
          startRotation: { min: 0, max: 360 }, lifetime: { min: 0.3, max: 0.6 }, frequency: 0.006, emitterLifetime: -1, maxParticles: 120,
          spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 6 } }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Fagulhas', visivel: true, z: 4, blendMode: 'add', texture: 'spark', texture_url: null, glow: null,
        emitter: { alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.3, time: 0 }, { value: 0.02, time: 1 }] },
          color: { list: [{ value: 'ffe6a0', time: 0 }, { value: 'ff7a1c', time: 1 }] }, speed: { start: 160, end: 30 }, acceleration: { x: 0, y: 120 },
          lifetime: { min: 0.3, max: 0.7 }, frequency: 0.012, emitterLifetime: -1, maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 5 } }, keyframes: [] },
      { id: 'l2', tipo: 'light', nome: 'Clarão', visivel: true, z: 5, blendMode: 'add', color: '#ffb347',
        keyframes: [{ t: 0.55, x: 0, y: 0, radius: 20, alpha: 0, color: '#fff0c0' }, { t: 0.66, x: 0, y: 0, radius: 150, alpha: 0.9, color: '#ffb347', ease: 'easeOutCubic' }, { t: 1, x: 0, y: 0, radius: 90, alpha: 0, color: '#ff7a1c' }] },
    ],
  },

  lanca_estelar: {
    version: 2, behavior: 'projectile', duracao_ms: 850, posicao: 'trajetoria',
    behavior_config: { projectile_speed_ms: 520 }, travel: { path: 'homing', rotate: 'velocity' },
    camera: { shake: { amp: 4, decay: 0.92, freq: 34 } },
    lighting: { bloom: { threshold: 0.55, intensity: 1.0, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.08 }, audio: { cast: 'magic_cast', impact: 'magic_hit', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Feixe', visivel: true, z: 3, blendMode: 'add', texture: 'streak', texture_url: null,
        glow: { distance: 12, outerStrength: 1.6, innerStrength: 0, color: '#9fe6ff' }, trail: { length: 12, fade: 0.72 },
        emitter: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.55, time: 0 }, { value: 0.08, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: '7fd0ff', time: 1 }] }, speed: { start: 40, end: 5 },
          lifetime: { min: 0.25, max: 0.5 }, frequency: 0.006, emitterLifetime: -1, maxParticles: 90, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 3 } }, keyframes: [] },
      { id: 'l1', tipo: 'emitter', nome: 'Estrelas', visivel: true, z: 4, blendMode: 'add', texture: 'sparkle', texture_url: null, tint: '#bfefff',
        emitter: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.25, time: 0 }, { value: 0.02, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'a8e6ff', time: 1 }] }, speed: { start: 120, end: 20 }, startRotation: { min: 0, max: 360 },
          lifetime: { min: 0.3, max: 0.6 }, frequency: 0.02, emitterLifetime: -1, maxParticles: 30, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 4 } }, keyframes: [] },
    ],
  },

  explosao_sagrada: {
    version: 2, behavior: 'one-shot', duracao_ms: 950, posicao: 'alvo',
    camera: { shake: { amp: 8, decay: 0.9, freq: 40 }, hitstop: { ms: 70, at: 0.12 } },
    lighting: { bloom: { threshold: 0.45, intensity: 1.4, quality: 6 }, tone: 'aces' },
    background: { darken: 0.16 }, filters: [{ type: 'shockwave', amplitude: 30, wavelength: 170, speed: 650, brightness: 1 }],
    audio: { cast: 'holy_shine', impact: 'holy_impact', volume: 0.8 }, global: false,
    layers: [
      { id: 'l0', tipo: 'light', nome: 'Clarão', visivel: true, z: 1, blendMode: 'add', color: '#fff0c0',
        keyframes: [{ t: 0, x: 0, y: 0, radius: 30, alpha: 0, color: '#ffffff' }, { t: 0.14, x: 0, y: 0, radius: 180, alpha: 1, color: '#fff0c0', ease: 'easeOutCubic' }, { t: 1, x: 0, y: 0, radius: 110, alpha: 0, color: '#ffd47a' }] },
      { id: 'l1', tipo: 'emitter', nome: 'Raios', visivel: true, z: 3, blendMode: 'add', texture: 'spark', texture_url: null,
        glow: { distance: 12, outerStrength: 1.5, innerStrength: 0, color: '#ffe08a' },
        emitter: { alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.6, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'ffcf66', time: 1 }] }, speed: { start: 320, end: 60 },
          lifetime: { min: 0.3, max: 0.55 }, frequency: 0.006, emitterLifetime: 0.25, maxParticles: 80, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 6 } }, keyframes: [] },
      { id: 'l2', tipo: 'shape', nome: 'Anel', visivel: true, z: 4, blendMode: 'add', shape_type: 'circle',
        keyframes: [{ t: 0, radius: 8, stroke_color: '#fff3c0', stroke_alpha: 1, stroke_width: 4, fill_alpha: 0, ease: 'easeOutCubic' }, { t: 1, radius: 120, stroke_color: '#ffcf66', stroke_alpha: 0, stroke_width: 1, fill_alpha: 0 }] },
    ],
  },

  vortex_sombrio: {
    version: 2, behavior: 'follow-target', duracao_ms: 1600, posicao: 'alvo',
    camera: { shake: { amp: 3, decay: 0.95, freq: 22 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.9, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.2 }, audio: { cast: 'dark_whoosh', impact: 'dark_impact', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Vórtex', visivel: true, z: 3, blendMode: 'add', texture: 'swirl', texture_url: null,
        glow: { distance: 12, outerStrength: 1.4, innerStrength: 0, color: '#a020f0' }, trail: { length: 10, fade: 0.78 },
        emitter: { alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.4, time: 0 }, { value: 0.05, time: 1 }] },
          color: { list: [{ value: 'd9a0ff', time: 0 }, { value: '4a1070', time: 1 }] }, speed: { start: 30, end: 120 }, rotationSpeed: { min: 180, max: 320 },
          startRotation: { min: 0, max: 360 }, lifetime: { min: 0.5, max: 0.9 }, frequency: 0.01, emitterLifetime: -1, maxParticles: 70, spawnType: 'ring', spawnCircle: { x: 0, y: 0, r: 40 } }, keyframes: [] },
    ],
  },

  chuva_arcana: {
    version: 2, behavior: 'aoe', duracao_ms: 1400, posicao: 'area',
    camera: { shake: { amp: 4, decay: 0.94, freq: 26 } },
    lighting: { bloom: { threshold: 0.5, intensity: 1.0, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.14 }, filters: [{ type: 'rgbsplit', rx: -4, ry: 0, bx: 4, by: 0 }],
    audio: { cast: 'magic_charge', impact: 'magic_hit', volume: 0.75 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Chuva', visivel: true, z: 3, blendMode: 'add', texture: 'shard', texture_url: null,
        glow: { distance: 8, outerStrength: 1.2, innerStrength: 0, color: '#8ab4ff' },
        emitter: { alpha: { list: [{ value: 0.9, time: 0 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.35, time: 0 }, { value: 0.1, time: 1 }] },
          color: { list: [{ value: 'd6e6ff', time: 0 }, { value: '6a8cff', time: 1 }] }, speed: { start: 260, end: 200 }, acceleration: { x: 0, y: 300 },
          startRotation: { min: 80, max: 100 }, lifetime: { min: 0.5, max: 0.9 }, frequency: 0.01, emitterLifetime: 0.9, maxParticles: 80, spawnType: 'rect', spawnRect: { x: -120, y: -90, w: 240, h: 20 } }, keyframes: [] },
    ],
  },

  cura_radiante: {
    version: 2, behavior: 'follow-target', duracao_ms: 1500, posicao: 'alvo',
    camera: { shake: { amp: 0, decay: 1, freq: 0 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.8, quality: 5 }, tone: 'filmic' },
    background: { darken: 0 }, audio: { cast: 'heal_chime', impact: 'heal_glow', volume: 0.7 }, global: false,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Fagulhas', visivel: true, z: 3, blendMode: 'add', texture: 'sparkle', texture_url: null,
        glow: { distance: 10, outerStrength: 1.3, innerStrength: 0, color: '#8fffa8' }, trail: { length: 6, fade: 0.8 },
        emitter: { alpha: { list: [{ value: 0, time: 0 }, { value: 0.9, time: 0.2 }, { value: 0, time: 1 }] }, scale: { list: [{ value: 0.1, time: 0 }, { value: 0.28, time: 0.5 }, { value: 0.04, time: 1 }] },
          color: { list: [{ value: 'eaffe0', time: 0 }, { value: '6fe89a', time: 1 }] }, speed: { start: 30, end: 80 }, acceleration: { x: 0, y: -120 },
          startRotation: { min: 250, max: 290 }, lifetime: { min: 0.7, max: 1.2 }, frequency: 0.02, emitterLifetime: -1, maxParticles: 50, spawnType: 'circle', spawnCircle: { x: 0, y: 20, r: 22 } }, keyframes: [] },
      { id: 'l1', tipo: 'light', nome: 'Aura', visivel: true, z: 2, blendMode: 'add', color: '#9fffb0',
        keyframes: [{ t: 0, x: 0, y: 0, radius: 30, alpha: 0, color: '#d0ffd8' }, { t: 0.3, x: 0, y: 0, radius: 90, alpha: 0.6, color: '#9fffb0', ease: 'easeOutQuad' }, { t: 1, x: 0, y: 0, radius: 70, alpha: 0, color: '#6fe89a' }] },
    ],
  },

  // ─── v3: novos presets demonstrando o modelo de âncora (origem/altura/pose) ───

  // Círculo conjurador "em pé" no peitoral do conjurador, do qual sai um feixe ao alvo
  // (estilo ultimate da Lux). posicao 'raio' renderiza o feixe entre conjurador e alvo.
  circulo_feixe: {
    version: 3, behavior: 'one-shot', duracao_ms: 1100, posicao: 'raio',
    camera: { shake: { amp: 5, decay: 0.9, freq: 34 }, hitstop: { ms: 40, at: 0.25 } },
    lighting: { bloom: { threshold: 0.5, intensity: 1.0, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.14 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    iso_lift_frac: 0.62,
    layers: [
      { id: 'l0', tipo: 'shape', nome: 'Círculo conjurador', visivel: true, z: 2, blendMode: 'add', shape_type: 'circle',
        anchor: { source: 'caster', spot: 'center', z: 'chest', pose: 'upright' },
        keyframes: [
          { t: 0,    radius: 4,  stroke_color: '#ffd27a', stroke_alpha: 0,   stroke_width: 3, fill_alpha: 0 },
          { t: 0.18, radius: 34, stroke_color: '#ffe7b0', stroke_alpha: 1,   stroke_width: 4, fill_alpha: 0.08, ease: 'easeOutQuad' },
          { t: 0.5,  radius: 36, stroke_color: '#ffcf6a', stroke_alpha: 0.9, stroke_width: 3, fill_alpha: 0.05 },
          { t: 1,    radius: 30, stroke_color: '#ff9a3c', stroke_alpha: 0,   stroke_width: 1, fill_alpha: 0 } ] },
      { id: 'l1', tipo: 'emitter', nome: 'Feixe', visivel: true, z: 4, blendMode: 'add', texture: 'streak', texture_url: null,
        glow: { distance: 14, outerStrength: 1.8, color: '#ffb060' },
        anchor: { source: 'caster', z: 'chest', pose: 'upright' },
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.7, time: 0 }, { value: 0.2, time: 1 }] },
          color: { list: [{ value: 'fff4d0', time: 0 }, { value: 'ff7a1c', time: 1 }] },
          speed: { start: 40, end: 10 }, lifetime: { min: 0.25, max: 0.5 }, frequency: 0.004,
          emitterLifetime: 0.6, maxParticles: 120, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 4 } },
        start_t: 0.18, end_t: 1, keyframes: [] },
    ],
  },

  // Runa deitada no chão sob o conjurador, da qual um projétil é arremessado ao alvo.
  // O projétil usa spawn_path (conjurador→alvo) e sobe ao peitoral; a runa fica no chão.
  runa_projetil: {
    version: 3, behavior: 'one-shot', duracao_ms: 1000, posicao: 'alvo',
    camera: { shake: { amp: 3, decay: 0.92, freq: 30 } },
    lighting: { bloom: { threshold: 0.55, intensity: 0.9, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.1 }, audio: { cast: '', impact: '', volume: 0.75 }, global: false,
    iso_lift_frac: 0.62,
    layers: [
      { id: 'l0', tipo: 'shape', nome: 'Runa (chão)', visivel: true, z: 2, blendMode: 'add', shape_type: 'circle',
        anchor: { source: 'caster', spot: 'center', z: 'ground', pose: 'floor' },
        keyframes: [
          { t: 0,   radius: 6,  stroke_color: '#a878ff', stroke_alpha: 0, stroke_width: 2, fill_alpha: 0 },
          { t: 0.2, radius: 30, stroke_color: '#c8a8ff', stroke_alpha: 1, stroke_width: 3, fill_alpha: 0.06, ease: 'easeOutQuad' },
          { t: 1,   radius: 30, stroke_color: '#7a4cff', stroke_alpha: 0.5, stroke_width: 1, fill_alpha: 0 } ] },
      { id: 'l1', tipo: 'emitter', nome: 'Projétil', visivel: true, z: 4, blendMode: 'add', texture: 'spark', texture_url: null,
        glow: { distance: 12, outerStrength: 1.6, color: '#c060ff' },
        anchor: { source: 'caster', z: 'chest', pose: 'upright' },
        spawn_path: [{ x: -150, y: -10, t: 0 }, { x: 150, y: -10, t: 1 }],
        emitter: {
          alpha: { list: [{ value: 1, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.5, time: 0 }, { value: 0.12, time: 1 }] },
          color: { list: [{ value: 'ffffff', time: 0 }, { value: 'b060ff', time: 1 }] },
          speed: { start: 60, end: 10 }, acceleration: { x: 0, y: 0 }, lifetime: { min: 0.2, max: 0.4 },
          frequency: 0.006, emitterLifetime: -1, maxParticles: 90, spawnType: 'circle', spawnCircle: { x: 0, y: 0, r: 3 } },
        start_t: 0.2, end_t: 1, keyframes: [] },
    ],
  },

  // Mão gigante que sobe do chão sob o alvo e desce batendo. Demonstra source:'target',
  // altura 'ground' e poses 'upright' (mão sobe em pé) + 'floor' (onda de impacto no chão).
  mao_do_chao: {
    version: 3, behavior: 'one-shot', duracao_ms: 1300, posicao: 'alvo',
    camera: { shake: { amp: 8, decay: 0.9, freq: 40 }, hitstop: { ms: 60, at: 0.55 } },
    lighting: { bloom: { threshold: 0.6, intensity: 0.7, quality: 5 }, tone: 'filmic' },
    background: { darken: 0.16 }, audio: { cast: '', impact: '', volume: 0.8 }, global: false,
    iso_lift_frac: 0.0,
    layers: [
      { id: 'l0', tipo: 'emitter', nome: 'Terra subindo', visivel: true, z: 3, blendMode: 'normal', texture: 'smoke', texture_url: null,
        anchor: { source: 'target', spot: 'center', z: 'ground', pose: 'upright' },
        emitter: {
          alpha: { list: [{ value: 0.8, time: 0 }, { value: 0, time: 1 }] },
          scale: { list: [{ value: 0.4, time: 0 }, { value: 1.2, time: 1 }] },
          color: { list: [{ value: '8a6a44', time: 0 }, { value: '3a2a1a', time: 1 }] },
          speed: { start: 120, end: 20 }, acceleration: { x: 0, y: -60 }, lifetime: { min: 0.4, max: 0.8 },
          frequency: 0.01, emitterLifetime: 0.5, maxParticles: 60, spawnType: 'rect', spawnRect: { x: -24, y: 0, w: 48, h: 6 } },
        start_t: 0, end_t: 0.55, keyframes: [] },
      { id: 'l1', tipo: 'shape', nome: 'Mão (sobe e bate)', visivel: true, z: 4, blendMode: 'normal', shape_type: 'rect',
        anchor: { source: 'target', spot: 'center', z: 'ground', pose: 'upright' },
        keyframes: [
          { t: 0,   x: 0, y: 0,   radius: 2,  stroke_color: '#1a1020', stroke_alpha: 0, stroke_width: 2, fill_alpha: 0 },
          { t: 0.5, x: 0, y: -40, radius: 34, stroke_color: '#2a1a30', stroke_alpha: 1, stroke_width: 3, fill_alpha: 0.85, ease: 'easeOutQuad' },
          { t: 0.7, x: 0, y: -10, radius: 30, stroke_color: '#3a2440', stroke_alpha: 1, stroke_width: 3, fill_alpha: 0.9, ease: 'easeInQuad' },
          { t: 1,   x: 0, y: 0,   radius: 20, stroke_color: '#2a1a30', stroke_alpha: 0, stroke_width: 1, fill_alpha: 0 } ] },
      { id: 'l2', tipo: 'shape', nome: 'Impacto (chão)', visivel: true, z: 5, blendMode: 'add', shape_type: 'circle',
        anchor: { source: 'target', spot: 'center', z: 'ground', pose: 'floor' },
        start_t: 0.55, end_t: 1,
        keyframes: [
          { t: 0,   radius: 6,  stroke_color: '#ffd0a0', stroke_alpha: 0,   stroke_width: 4, fill_alpha: 0 },
          { t: 0.2, radius: 50, stroke_color: '#ffb070', stroke_alpha: 0.9, stroke_width: 3, fill_alpha: 0, ease: 'easeOutQuad' },
          { t: 1,   radius: 80, stroke_color: '#8a5a30', stroke_alpha: 0,   stroke_width: 1, fill_alpha: 0 } ] },
    ],
  },

};

// Display metadata for the presets library (nome PT-BR + categoria)
var PIXI_STUDIO_PRESET_META = {
  fogo_nova:        { nome: 'Fogo — Nova',          categoria: 'Fogo',    cor: '#ff8842' },
  gelo_estilhaco:   { nome: 'Gelo — Estilhaço',      categoria: 'Gelo',    cor: '#7fc8ff' },
  raio_cadeia:      { nome: 'Raio — Cadeia',          categoria: 'Raio',    cor: '#cfe4ff' },
  veneno_nuvem:     { nome: 'Veneno — Nuvem',         categoria: 'Veneno',  cor: '#80ff40' },
  sagrado_explosao: { nome: 'Sagrado — Explosão',     categoria: 'Sagrado', cor: '#ffd47a' },
  sombra_vortex:    { nome: 'Sombra — Vórtex',        categoria: 'Sombra',  cor: '#a020f0' },
  vento_corte:      { nome: 'Vento — Corte',          categoria: 'Vento',   cor: '#c0f0d0' },
  terra_tremor:     { nome: 'Terra — Tremor',          categoria: 'Terra',   cor: '#c89060' },
  sangue_jato:      { nome: 'Sangue — Jato',           categoria: 'Físico',  cor: '#ff2020' },
  fumaca_escura:    { nome: 'Fumaça Escura',           categoria: 'Sombra',  cor: '#606060' },
  faiscas_magicas:  { nome: 'Faíscas Mágicas',         categoria: 'Arcano',  cor: '#c060ff' },
  cura_luz:         { nome: 'Cura — Luz',              categoria: 'Cura',    cor: '#40ffb0' },
  teleporte_anel:   { nome: 'Teleporte — Anel',        categoria: 'Arcano',  cor: '#a0c8ff' },
  onda_de_choque:   { nome: 'Onda de Choque',          categoria: 'Físico',  cor: '#ffc840' },
  feixe_energia:    { nome: 'Feixe de Energia',        categoria: 'Fogo',    cor: '#ff8040' },
  arcano_preciso:   { nome: 'Arcano — Preciso',        categoria: 'Arcano',  cor: '#a978ff' },
  aura_persistente: { nome: 'Aura Persistente',        categoria: 'Buff',    cor: '#c8a84b' },
  meteoro_flamejante: { nome: 'Meteoro Flamejante',    categoria: 'Fogo',    cor: '#ff8a2a' },
  lanca_estelar:    { nome: 'Lança Estelar',           categoria: 'Arcano',  cor: '#7fd0ff' },
  explosao_sagrada: { nome: 'Explosão Sagrada',        categoria: 'Sagrado', cor: '#ffd47a' },
  vortex_sombrio:   { nome: 'Vórtex Sombrio',          categoria: 'Sombra',  cor: '#a020f0' },
  chuva_arcana:     { nome: 'Chuva Arcana',            categoria: 'Arcano',  cor: '#6a8cff' },
  cura_radiante:    { nome: 'Cura Radiante',           categoria: 'Cura',    cor: '#6fe89a' },
  circulo_feixe:    { nome: 'Círculo — Feixe',         categoria: 'Arcano',  cor: '#ffb060' },
  runa_projetil:    { nome: 'Runa — Projétil',         categoria: 'Arcano',  cor: '#b060ff' },
  mao_do_chao:      { nome: 'Mão do Chão',             categoria: 'Terra',   cor: '#6a4a2a' },
};
