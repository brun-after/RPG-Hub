// audio.js — AudioManager (Howler.js)
// Gerencia música de fundo (exploração/combate/boss) e SFX de skills/ataques.
// Requer Howler.js carregado antes deste arquivo.

// ── Trilhas padrão dark-fantasy (Kevin MacLeod — CC BY, incompetech.com) ────
const DEFAULT_SOUNDTRACKS = {
  exploracao: [
    { id:'ossuary5',   label:'Ossuary 5 – Rest',          url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ossuary%205%20-%20Rest.mp3' },
    { id:'darkest',    label:'Darkest Child',             url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Darkest%20Child.mp3' },
    { id:'oppressive', label:'Oppressive Gloom',          url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Oppressive%20Gloom.mp3' },
    { id:'dark_times', label:'Dark Times',                url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dark%20Times.mp3' },
    { id:'cipher',     label:'Cipher',                    url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher.mp3' },
    { id:'sneaky',     label:'Sneaky Adventure',          url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Adventure.mp3' },
    { id:'cataclysm',  label:'Cataclysmic Molten Core',   url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cataclysmic%20Molten%20Core.mp3' },
    { id:'monkeys',    label:'Monkeys Spinning Monkeys',  url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Monkeys%20Spinning%20Monkeys.mp3' },
    { id:'carefree',   label:'Carefree',                  url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Carefree.mp3' },
    { id:'pixelland',  label:'Pixelland',                 url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pixelland.mp3' },
    { id:'fluffing',   label:'Fluffing a Duck',           url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fluffing%20a%20Duck.mp3' },
    { id:'bummin',     label:'Bummin on Tremelo',         url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bummin%20on%20Tremelo.mp3' },
  ],
  combate: [
    { id:'volatile',    label:'Volatile Reaction',         url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Volatile%20Reaction.mp3' },
    { id:'rising',      label:'Rising Tide',               url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Rising%20Tide.mp3' },
    { id:'phantom',     label:'Phantom from Space',        url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Phantom%20from%20Space.mp3' },
    { id:'hall',        label:'Hall of the Mountain King', url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hall%20of%20the%20Mountain%20King.mp3' },
    { id:'clash',       label:'Clash Defiant',             url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Clash%20Defiant.mp3' },
    { id:'impact_mod',  label:'Impact Moderato',           url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3' },
    { id:'exhilarate',  label:'Exhilarate',                url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Exhilarate.mp3' },
    { id:'blkvortex',   label:'Black Vortex',              url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Black%20Vortex.mp3' },
    { id:'fivearmies',  label:'Five Armies',               url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Five%20Armies.mp3' },
  ],
  boss: [
    { id:'dark_hall',   label:'Dark Hall',                 url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Dark%20Hall.mp3' },
    { id:'fatal',       label:'Fatal Combat',              url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Fatal%20Combat.mp3' },
    { id:'heavy',       label:'Heavy Heart',               url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Heavy%20Heart.mp3' },
    { id:'iron',        label:'Iron Horse',                url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Iron%20Horse.mp3' },
    { id:'majestic',    label:'Majestic Hills',            url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Majestic%20Hills.mp3' },
    { id:'movprop',     label:'Movement Proposition',      url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Movement%20Proposition.mp3' },
    { id:'eternterm',   label:'Eternal Terminal',          url:'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Eternal%20Terminal.mp3' },
  ],
};

// ── Biblioteca de efeitos sonoros (arquivos locais em assets/sfx/) ───────────
const DEFAULT_SFX_LIBRARY = {
  // Ataques físicos
  sword_slash:   { label:'Espada – Golpe leve',   url:'assets/sfx/mixkit-sword-slash-sweep-2264.wav',          cat:'ataque'  },
  sword_heavy:   { label:'Espada – Golpe pesado', url:'assets/sfx/mixkit-metal-hit-woosh-1485.wav',            cat:'ataque'  },
  axe_swing:     { label:'Machado – Swing',       url:'assets/sfx/mixkit-sword-slash-2219.wav',               cat:'ataque'  },
  spear_thrust:  { label:'Lança – Estocada',      url:'assets/sfx/mixkit-medieval-show-fanfare-announcement-226.wav', cat:'ataque' },
  bow_release:   { label:'Arco – Disparo',        url:'assets/sfx/mixkit-arrow-whoosh-1491.wav',              cat:'ataque'  },
  arrow_whoosh:  { label:'Flecha – Voo',          url:'assets/sfx/mixkit-arrow-whoosh-1491.wav',              cat:'ataque'  },
  punch_impact:  { label:'Soco – Impacto',        url:'assets/sfx/mixkit-boxing-glove-hard-punch-2355.wav',   cat:'ataque'  },
  // Impactos
  hit_physical:  { label:'Impacto Físico',        url:'assets/sfx/mixkit-sword-slash-2219.wav',               cat:'impacto' },
  hit_flesh:     { label:'Impacto – Carne',       url:'assets/sfx/mixkit-boxing-glove-hard-punch-2355.wav',   cat:'impacto' },
  critical_hit:  { label:'Acerto Crítico',        url:'assets/sfx/mixkit-game-level-completed-2059.wav',      cat:'impacto' },
  shield_block:  { label:'Bloqueio – Escudo',     url:'assets/sfx/mixkit-metal-hit-2195.wav',                 cat:'impacto' },
  // Magia geral
  magic_cast:    { label:'Magia – Conjuração',    url:'assets/sfx/mixkit-magic-spell-casting-2104.wav',       cat:'magia'   },
  magic_charge:  { label:'Magia – Carga',         url:'assets/sfx/mixkit-mysterious-moment-notification-686.wav', cat:'magia' },
  magic_hit:     { label:'Magia – Impacto',       url:'assets/sfx/mixkit-magic-sweep-game-trophy-257.wav',    cat:'magia'   },
  spell_whoosh:  { label:'Magia – Projétil',      url:'assets/sfx/mixkit-woosh-hit-with-echo-1488.wav',       cat:'magia'   },
  // Elementais
  fire_cast:     { label:'Fogo – Conjura',        url:'assets/sfx/mixkit-fire-burning-2956.wav',              cat:'elemento'},
  fire_burst:    { label:'Fogo – Explosão',       url:'assets/sfx/mixkit-explosion-impact-1684.wav',          cat:'elemento'},
  fire_impact:   { label:'Fogo – Impacto',        url:'assets/sfx/mixkit-explosion-impact-1684.wav',          cat:'elemento'},
  ice_cast:      { label:'Gelo – Conjura',        url:'assets/sfx/mixkit-spell-casting-sound-1484.wav',       cat:'elemento'},
  ice_shatter:   { label:'Gelo – Estilhaço',      url:'assets/sfx/mixkit-glass-break-1197.wav',              cat:'elemento'},
  thunder_cast:  { label:'Trovão – Conjura',      url:'assets/sfx/mixkit-thunder-strike-1361.wav',            cat:'elemento'},
  thunder_crack: { label:'Trovão – Estrondo',     url:'assets/sfx/mixkit-thunder-strike-1361.wav',            cat:'elemento'},
  dark_whoosh:   { label:'Sombra – Rajada',       url:'assets/sfx/mixkit-dark-magic-whoosh-1474.wav',         cat:'elemento'},
  dark_impact:   { label:'Sombra – Impacto',      url:'assets/sfx/mixkit-dark-magic-whoosh-1474.wav',         cat:'elemento'},
  holy_shine:    { label:'Sagrado – Brilho',      url:'assets/sfx/mixkit-fairy-sparkles-bell-754.wav',        cat:'elemento'},
  holy_impact:   { label:'Sagrado – Impacto',     url:'assets/sfx/mixkit-game-level-completed-2059.wav',      cat:'elemento'},
  poison_hiss:   { label:'Veneno – Sibilo',       url:'assets/sfx/mixkit-hiss-game-over-1222.wav',            cat:'elemento'},
  // Cura / suporte
  heal_chime:    { label:'Cura – Campainha',      url:'assets/sfx/mixkit-fairy-sparkles-bell-754.wav',        cat:'cura'    },
  heal_glow:     { label:'Cura – Brilho',         url:'assets/sfx/mixkit-magic-item-pickup-1684.wav',         cat:'cura'    },
  shield_raise:  { label:'Escudo – Erguer',       url:'assets/sfx/mixkit-metal-hit-2195.wav',                 cat:'cura'    },
  buff_activate: { label:'Buff – Ativação',       url:'assets/sfx/mixkit-game-power-up-1487.wav',             cat:'cura'    },
  // Ambiente / interação
  chest_open:    { label:'Baú – Abrir',           url:'assets/sfx/mixkit-opening-a-wooden-box-2220.wav',      cat:'ambiente'},
  door_open:     { label:'Porta – Abrir',         url:'assets/sfx/mixkit-wood-door-open-and-close-1797.wav',  cat:'ambiente'},
  level_up:      { label:'Subir de Nível',        url:'assets/sfx/mixkit-game-level-completed-2059.wav',      cat:'ambiente'},
  coin_pickup:   { label:'Coletar Moeda',         url:'assets/sfx/mixkit-coin-winning-1956.wav',              cat:'ambiente'},
  step_stone:    { label:'Passos – Pedra',        url:'assets/sfx/mixkit-quick-jump-arcade-game-239.wav',     cat:'ambiente'},
};

// Mantém SOUND_BANK como alias sobre DEFAULT_SFX_LIBRARY para compatibilidade
const SOUND_BANK = Object.fromEntries(
  Object.entries(DEFAULT_SFX_LIBRARY).map(([k, v]) => [k, v.url])
);

// ── Tabela de auto-mapeamento: tipo de animação + contexto → {cast, impact} ──
const _SFX_AUTO_MAP = {
  // Projétil por tipo de dano
  'projetil_fogo':         { cast:'fire_cast',    impact:'fire_impact'   },
  'projetil_gelo':         { cast:'magic_cast',   impact:'ice_shatter'   },
  'projetil_eletricidade': { cast:'thunder_cast', impact:'thunder_crack' },
  'projetil_sombra':       { cast:'dark_whoosh',  impact:'dark_impact'   },
  'projetil_sagrado':      { cast:'spell_whoosh', impact:'holy_impact'   },
  'projetil_veneno':       { cast:'spell_whoosh', impact:'poison_hiss'   },
  'projetil_fisico':       { cast:'bow_release',  impact:'hit_physical'  },
  'projetil_magico':       { cast:'magic_cast',   impact:'magic_hit'     },
  'projetil_':             { cast:'spell_whoosh', impact:'hit_physical'  },
  // Onda
  'onda_fogo':             { cast:'fire_cast',    impact:'fire_burst'    },
  'onda_gelo':             { cast:'ice_cast',     impact:'ice_shatter'   },
  'onda_eletricidade':     { cast:'thunder_cast', impact:'thunder_crack' },
  'onda_':                 { cast:'spell_whoosh', impact:'thunder_crack' },
  // Explosão
  'explosao_fogo':         { cast:'fire_cast',    impact:'fire_burst'    },
  'explosao_eletricidade': { cast:'thunder_cast', impact:'thunder_crack' },
  'explosao_':             { cast:'magic_charge', impact:'magic_hit'     },
  // Raio
  'raio_eletricidade':     { cast:'thunder_cast', impact:'thunder_crack' },
  'raio_':                 { cast:'thunder_cast', impact:'thunder_crack' },
  // Aura
  'aura_sagrado':          { cast:'holy_shine',   impact:'holy_impact'   },
  'aura_sombra':           { cast:'dark_whoosh',  impact:'dark_impact'   },
  'aura_cura':             { cast:'heal_chime',   impact:'heal_glow'     },
  'aura_':                 { cast:'magic_charge', impact:'magic_hit'     },
  // GSAP por preset
  'gsap_impacto_shake':    { cast:'sword_slash',  impact:'hit_physical'  },
  'gsap_impacto_escala':   { cast:'sword_slash',  impact:'hit_physical'  },
  'gsap_cura_flutuante':   { cast:'heal_chime',   impact:'heal_glow'     },
  'gsap_token_teleport':   { cast:'spell_whoosh', impact:'magic_hit'     },
  'gsap_teleporte_saida':  { cast:'spell_whoosh', impact:'magic_hit'     },
  'gsap_token_dash':       { cast:'sword_slash',  impact:'hit_flesh'     },
  'gsap_dash_avanco':      { cast:'sword_slash',  impact:'hit_flesh'     },
  'gsap_aura_pulso':       { cast:'magic_charge', impact:'magic_hit'     },
  'gsap_critico_espiral':  { cast:'sword_slash',  impact:'critical_hit'  },
  'gsap_lancamento':       { cast:'spell_whoosh', impact:'hit_physical'  },
  'gsap_token_recuo':      { cast:'hit_physical', impact:'hit_flesh'     },
  'gsap_':                 { cast:'sword_slash',  impact:'hit_physical'  },
  // Pixi particles por posição
  'pixi_particles_alvo':       { cast:'spell_whoosh', impact:'magic_hit'     },
  'pixi_particles_trajetoria': { cast:'magic_cast',   impact:'magic_hit'     },
  'pixi_particles_atacante':   { cast:'magic_charge', impact:'magic_hit'     },
  'pixi_particles_area':       { cast:'spell_whoosh', impact:'thunder_crack' },
  'pixi_particles_orbital':    { cast:'magic_charge', impact:'magic_hit'     },
  'pixi_particles_cadeia':     { cast:'magic_cast',   impact:'magic_hit'     },
  'pixi_particles_':           { cast:'spell_whoosh', impact:'magic_hit'     },
  // Pixi Spine / combos
  'pixi_spine_':               { cast:'magic_cast',   impact:'critical_hit'  },
  'gsap_pixi_spine_':          { cast:'magic_cast',   impact:'critical_hit'  },
  'combo_total_':              { cast:'magic_cast',   impact:'critical_hit'  },
  // Mídia (gif/imagem/iframe)
  'gif_':                      { cast:'magic_cast',   impact:'magic_hit'     },
  'imagem_':                   { cast:'magic_cast',   impact:'magic_hit'     },
  'iframe_':                   { cast:'magic_cast',   impact:'magic_hit'     },
};

class _AudioManager {
  constructor() {
    this._musicState      = 'silent';
    this._currentBgm      = null;
    this._phaseConfig     = null;
    this._currentPhaseId  = 'main';
    this._defaultExploracao = null;
    this._sfxCache           = {};
    this.volume              = { music: 0.45, sfx: 0.75 };
    this._muted              = false;
    this._pendingBgm         = null;  // {url, volume} para retry após autoplay bloqueado
    this._userSfxBiblioteca  = [];    // [{id, nome, url, cat}] — carregado sob demanda
    this._userSfxLoaded      = false;
    if (typeof Howler !== 'undefined') Howler.html5PoolSize = 20;

    // Retry BGM na primeira interação do usuário (política de autoplay dos browsers)
    const _retryBgm = () => {
      if (!this._pendingBgm) return;
      if (this._currentBgm?.playing()) return;
      const { url, volume } = this._pendingBgm;
      if (typeof Howl === 'undefined') return;
      if (this._currentBgm) { try { this._currentBgm.stop(); } catch (_) {} }
      const howl = new Howl({ src: [url], loop: true, volume: 0, html5: true });
      howl.play();
      if (!this._muted) howl.fade(0, volume, 400);
      this._currentBgm = howl;
    };
    document.addEventListener('click',      _retryBgm);
    document.addEventListener('touchstart', _retryBgm);
    document.addEventListener('keydown',    _retryBgm);
  }

  // ── Música de fundo ───────────────────────────────────────────────────────

  onEnterPhase(fase, phaseId) {
    const audio = fase?.audio || fase?.render_data?.audio || {};
    this._phaseConfig    = audio;
    this._currentPhaseId = phaseId || fase?.map_id || fase?.id || 'main';

    let url = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (!url) {
      url = this._getOrPickDefaultTrack('exploracao', this._currentPhaseId);
      this._defaultExploracao = url;
    } else {
      this._defaultExploracao = null;
    }
    if (url) this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    else this.stopMusic();
    this._musicState = 'exploration';
  }

  onCombatStart(hasBoss = false) {
    if (this._musicState === 'combat' || this._musicState === 'boss') return;
    const audio = this._phaseConfig || {};
    const key   = hasBoss ? 'boss_url' : 'combate_url';
    let url = this._resolveId(audio[key]);
    if (!url) {
      const cat = hasBoss ? 'boss' : 'combate';
      url = this._getOrPickDefaultTrack(cat, this._currentPhaseId);
    }
    if (url) this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    this._musicState = hasBoss ? 'boss' : 'combat';
  }

  onCombatEnd() {
    if (this._musicState !== 'combat' && this._musicState !== 'boss') return;
    const audio = this._phaseConfig || {};
    let url = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (!url) url = this._defaultExploracao || this._getOrPickDefaultTrack('exploracao', this._currentPhaseId);
    if (url) this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    this._musicState = 'exploration';
  }

  stopMusic({ fade = 800 } = {}) {
    if (!this._currentBgm) return;
    if (typeof Howl !== 'undefined' && fade > 0) {
      const bgm = this._currentBgm;
      bgm.fade(bgm.volume(), 0, fade);
      setTimeout(() => bgm.stop(), fade + 50);
    } else {
      this._currentBgm.stop();
    }
    this._currentBgm = null;
  }

  _playBgm(url, { volume = this.volume.music, fade = 800 } = {}) {
    this._pendingBgm = { url, volume };  // Guarda para retry caso autoplay esteja bloqueado
    if (typeof Howl === 'undefined') return;
    if (this._currentBgm) {
      const old = this._currentBgm;
      old.fade(old.volume(), 0, fade);
      setTimeout(() => old.stop(), fade + 50);
    }
    const howl = new Howl({ src: [url], loop: true, volume: 0, html5: true });
    howl.play();
    if (!this._muted) howl.fade(0, volume, fade);
    this._currentBgm = howl;
  }

  // ── SFX ──────────────────────────────────────────────────────────────────

  playSFX(idOrUrl, { volume, pitchVariance = 0 } = {}) {
    if (this._muted || typeof Howl === 'undefined') return;
    const url = this._resolveId(idOrUrl);
    if (!url) return;
    const vol = Math.min(1, Math.max(0, volume ?? this.volume.sfx));
    let howl = this._sfxCache[url];
    if (!howl) {
      howl = new Howl({
        src: [url],
        volume: vol,
        onloaderror: (_id, err) => console.warn('[SFX] Falha ao carregar:', url, err),
        onplayerror:  (_id, err) => console.warn('[SFX] Falha ao tocar:',    url, err),
      });
      this._sfxCache[url] = howl;
    }
    const id = howl.play();
    howl.volume(vol, id);
    if (pitchVariance > 0) {
      const rate = 1 + (Math.random() * 2 - 1) * pitchVariance;
      howl.rate(Math.max(0.5, Math.min(2, rate)), id);
    }
  }

  preloadSFX(ids = []) {
    if (typeof Howl === 'undefined') return;
    ids.forEach(id => {
      const url = this._resolveId(id);
      if (url && !this._sfxCache[url]) {
        this._sfxCache[url] = new Howl({ src: [url], preload: true });
      }
    });
  }

  // ── Auto-mapeamento de SFX por tipo de animação ───────────────────────────

  getSkillSfx(tipo, posicao, tipoDano, gsapPreset) {
    if (!tipo || tipo === 'nenhuma') return {};
    let candidate, fallback;

    if (tipo === 'gsap' || tipo === 'gsap_pixi_spine') {
      const preset = gsapPreset || posicao || '';
      candidate = _SFX_AUTO_MAP[`gsap_${preset}`];
      fallback  = _SFX_AUTO_MAP['gsap_'];
    } else if (tipo === 'pixi_particles') {
      const pos = posicao || '';
      candidate = _SFX_AUTO_MAP[`pixi_particles_${pos}`];
      fallback  = _SFX_AUTO_MAP['pixi_particles_'];
    } else if (['pixi_spine','combo_total'].includes(tipo)) {
      fallback  = _SFX_AUTO_MAP[`${tipo}_`] || _SFX_AUTO_MAP['pixi_spine_'];
    } else {
      const td = tipoDano || '';
      candidate = _SFX_AUTO_MAP[`${tipo}_${td}`];
      fallback  = _SFX_AUTO_MAP[`${tipo}_`];
    }

    return candidate || fallback || { cast: 'magic_cast', impact: 'magic_hit' };
  }

  // ── Métodos de consulta para UI ───────────────────────────────────────────

  getDefaultSoundtrackList(tipo) {
    return DEFAULT_SOUNDTRACKS[tipo] || [];
  }

  loadUserSfxLibrary(biblioteca = []) {
    this._userSfxBiblioteca = Array.isArray(biblioteca) ? biblioteca : [];
    this._userSfxLoaded = true;
  }

  getSfxList(cat) {
    const builtIn = Object.entries(DEFAULT_SFX_LIBRARY).map(([id, v]) => ({ id, ...v }));
    const user    = this._userSfxBiblioteca.map(e => ({ id: e.id, label: e.nome, url: e.url, cat: e.cat || 'custom', _user: true }));
    const all     = [...builtIn, ...user];
    return cat ? all.filter(e => e.cat === cat) : all;
  }

  getSfxLabel(idOrUrl) {
    if (!idOrUrl) return '';
    const entry = DEFAULT_SFX_LIBRARY[idOrUrl];
    if (entry) return entry.label;
    const userEntry = this._userSfxBiblioteca.find(e => e.id === idOrUrl || e.url === idOrUrl);
    if (userEntry) return userEntry.nome;
    return idOrUrl;
  }

  // ── Volume / mute ─────────────────────────────────────────────────────────

  setMusicVolume(v) {
    this.volume.music = Math.min(1, Math.max(0, v));
    if (this._currentBgm) this._currentBgm.volume(this._muted ? 0 : this.volume.music);
  }

  setSfxVolume(v) {
    this.volume.sfx = Math.min(1, Math.max(0, v));
  }

  setMuted(muted) {
    this._muted = !!muted;
    if (this._currentBgm) this._currentBgm.volume(this._muted ? 0 : this.volume.music);
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _resolveId(idOrUrl) {
    if (!idOrUrl) return null;
    if (typeof idOrUrl === 'string' && (idOrUrl.startsWith('http') || idOrUrl.startsWith('/'))) return idOrUrl;
    const sfx = DEFAULT_SFX_LIBRARY[idOrUrl];
    if (sfx) return sfx.url;
    const userEntry = this._userSfxBiblioteca.find(e => e.id === idOrUrl);
    if (userEntry) return userEntry.url;
    return null;
  }

  _getOrPickDefaultTrack(tipo, phaseId) {
    const key = `rpghub_track_${tipo}_${phaseId}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return cached;
    } catch (_) {}
    const list = DEFAULT_SOUNDTRACKS[tipo] || [];
    if (!list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)].url;
    try { sessionStorage.setItem(key, pick); } catch (_) {}
    return pick;
  }
}

window.AudioManager = new _AudioManager();
