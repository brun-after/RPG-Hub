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
};
