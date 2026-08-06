// audio.js — AudioManager (Howler.js)
// Gerencia música de fundo (exploração/combate/boss) e SFX de skills/ataques.
// Requer Howler.js carregado antes deste arquivo.

// ── Trilhas padrão dark-fantasy (Kevin MacLeod — CC BY, incompetech.com) ────
const DEFAULT_SOUNDTRACKS: Record<string, any> = {
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

// ── Biblioteca de efeitos sonoros (gamesounds.xyz — CC0: Kenney & Sonniss GDC Bundles) ─────────
const DEFAULT_SFX_LIBRARY: Record<string, any> = {
  // Ataques físicos
  sword_slash:   { label:'Espada – Golpe leve',   url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Foley%20Sounds/Swords/sword1.ogg',                                                                                                                                                                      cat:'ataque'  },
  sword_heavy:   { label:'Espada – Golpe pesado', url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202021-2023%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Melee%20Weapons%20Sound%20Effects%20Pack%201/SWSH_Sword%20Slash%20Impact%20V2%20Assorted%2018_DDUMAIS_NONE.wav',                    cat:'ataque'  },
  axe_swing:     { label:'Machado – Swing',       url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202021-2023%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Melee%20Weapons%20Sound%20Effects%20Pack%201/SWSH_Swing%203%20Large%2003_DDUMAIS_NONE.wav',                                         cat:'ataque'  },
  spear_thrust:  { label:'Lança – Estocada',      url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Foley%20Sounds/Woosh/woosh4.ogg',                                                                                                                                                                       cat:'ataque'  },
  bow_release:   { label:'Arco – Disparo',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/SmartSoundFX%20%E2%80%93%20Medieval/BOW%20Arrow%20Hit%2005.wav',                                                                                                       cat:'ataque'  },
  arrow_whoosh:  { label:'Flecha – Voo',          url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Foley%20Sounds/Woosh/woosh2.ogg',                                                                                                                                                                       cat:'ataque'  },
  punch_impact:  { label:'Soco – Impacto',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/The%20Chris%20Alan%20-%20Hand-to-Hand%20Combat%20-%20Body%20Hits%20%26%20Vocal%20Excursions/Hand-to-Hand%20Combat%20-%20Body%20Hits%20-%20Deep%20Punch%2002.wav',     cat:'ataque'  },
  // Impactos
  hit_physical:  { label:'Impacto Físico',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/SmartSoundFX%20%E2%80%93%20Medieval/SWORD%20Hit%20Metal%2002.wav',                                                                                                     cat:'impacto' },
  hit_flesh:     { label:'Impacto – Carne',       url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/The%20Chris%20Alan%20-%20Hand-to-Hand%20Combat%20-%20Body%20Hits%20%26%20Vocal%20Excursions/Hand-to-Hand%20Combat%20-%20Body%20Hits%20-%20Body%20Slam%20Floor%2008.wav', cat:'impacto' },
  critical_hit:  { label:'Acerto Crítico',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202021-2023%20-%20Game%20Audio%20Bundle/344%20Audio%20-%20Epic%20Impacts%20Vol.%201/Impact%20021.wav',                                                                                                    cat:'impacto' },
  shield_block:  { label:'Bloqueio – Escudo',     url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/impactMetal_heavy_000.ogg',                                                                                                                                                             cat:'impacto' },
  // Magia geral
  magic_cast:    { label:'Magia – Conjuração',    url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202019%20-%20Game%20Audio%20Bundle/Sound%20Spark%20LLC%20%E2%80%93%20Magic%20Spells%2C%20Buffs%20and%20Attacks/Arcane_Spell_Doppler_Shift_03.wav',                                                       cat:'magia'   },
  magic_charge:  { label:'Magia – Carga',         url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/Gamemaster%20Audio%20-%20Magic%20and%20Spell%20Sounds/casting_charge_matter_grow_04.wav',                                                                              cat:'magia'   },
  magic_hit:     { label:'Magia – Impacto',       url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/Gamemaster%20Audio%20-%20Magic%20and%20Spell%20Sounds/electric_surge_blast_04.wav',                                                                                   cat:'magia'   },
  spell_whoosh:  { label:'Magia – Projétil',      url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/Gamemaster%20Audio%20-%20Magic%20and%20Spell%20Sounds/water_blast_projectile_spell_03.wav',                                                                            cat:'magia'   },
  // Elementais
  fire_cast:     { label:'Fogo – Conjura',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202019%20-%20Game%20Audio%20Bundle/Sound%20Spark%20LLC%20%E2%80%93%20Magic%20Spells%2C%20Buffs%20and%20Attacks/Fire_Spell_Dragon_Trap_03.wav',                                                           cat:'elemento'},
  fire_burst:    { label:'Fogo – Explosão',       url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202018%20-%20Game%20Audio%20Bundle/Lukas%20Tvrdon%20-%20Distant%20Blast/Distant%20Blast%2017.wav',                                                                                                        cat:'elemento'},
  fire_impact:   { label:'Fogo – Impacto',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202019%20-%20Game%20Audio%20Bundle/Sound%20Spark%20LLC%20%E2%80%93%20Magic%20Spells%2C%20Buffs%20and%20Attacks/Fire_Spell_Dragon_Trap_03.wav',                                                           cat:'elemento'},
  ice_cast:      { label:'Gelo – Conjura',        url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Ice%20%26%20Frost%20Magic%201/Magic_Spells_CastShort_Ice_General24.wav',                                                                  cat:'elemento'},
  ice_shatter:   { label:'Gelo – Estilhaço',      url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Ice%20%26%20Frost%20Magic%201/Magic_Spells_Impact_Ice13.wav',                                                                            cat:'elemento'},
  thunder_cast:  { label:'Trovão – Conjura',      url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Electricity%20Magic%201/Magic_Spells_CastShort_Electricity_General08.wav',                                                               cat:'elemento'},
  thunder_crack: { label:'Trovão – Estrondo',     url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202021-2023%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Magic%20Sound%20FX%20Pack%202/MagicPack2_ElectricitySpells_Spell2-002.wav',                                                        cat:'elemento'},
  dark_whoosh:   { label:'Sombra – Rajada',       url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Digital%20Audio/phaseJump1.ogg',                                                                                                                                                                        cat:'elemento'},
  dark_impact:   { label:'Sombra – Impacto',      url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle/David%20Dumais%20Audio%20-%20Electricity%20Magic%201/Magic_Spells_Impact_Electricity25.wav',                                                                          cat:'elemento'},
  holy_shine:    { label:'Sagrado – Brilho',      url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/impactBell_heavy_001.ogg',                                                                                                                                                              cat:'elemento'},
  holy_impact:   { label:'Sagrado – Impacto',     url:'https://gamesounds.xyz/Sonniss.com%20-%20GDC%202021-2023%20-%20Game%20Audio%20Bundle/344%20Audio%20-%20Epic%20Impacts%20Vol.%201/Impact%20045.wav',                                                                                                   cat:'elemento'},
  poison_hiss:   { label:'Veneno – Sibilo',       url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Foley%20Sounds/Woosh/woosh1.ogg',                                                                                                                                                                       cat:'elemento'},
  // Cura / suporte
  heal_chime:    { label:'Cura – Campainha',      url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/impactBell_heavy_000.ogg',                                                                                                                                                              cat:'cura'    },
  heal_glow:     { label:'Cura – Brilho',         url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/impactBell_heavy_002.ogg',                                                                                                                                                              cat:'cura'    },
  shield_raise:  { label:'Escudo – Erguer',       url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/impactMetal_medium_000.ogg',                                                                                                                                                            cat:'cura'    },
  buff_activate: { label:'Buff – Ativação',       url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Digital%20Audio/powerUp7.ogg',                                                                                                                                                                          cat:'cura'    },
  // Ambiente / interação
  chest_open:    { label:'Baú – Abrir',           url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/RPG%20Audio/creak1.ogg',                                                                                                                                                                                cat:'ambiente'},
  door_open:     { label:'Porta – Abrir',         url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/RPG%20Audio/doorOpen_1.ogg',                                                                                                                                                                            cat:'ambiente'},
  level_up:      { label:'Subir de Nível',        url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Interface%20Sounds/maximize_001.ogg',                                                                                                                                                                   cat:'ambiente'},
  coin_pickup:   { label:'Coletar Moeda',         url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/RPG%20Audio/handleCoins.ogg',                                                                                                                                                                           cat:'ambiente'},
  step_stone:    { label:'Passos – Pedra',        url:'https://gamesounds.xyz/Kenney%27s%20Sound%20Pack/Impact%20Sounds/footstep_concrete_000.ogg',                                                                                                                                                             cat:'ambiente'},
};

// Mantém SOUND_BANK como alias sobre DEFAULT_SFX_LIBRARY para compatibilidade
const SOUND_BANK = Object.fromEntries(
  Object.entries(DEFAULT_SFX_LIBRARY).map(([k, v]) => [k, v.url])
);

// ── Tabela de auto-mapeamento: tipo de animação + contexto → {cast, impact} ──
const _SFX_AUTO_MAP: Record<string, any> = {
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
  [key: string]: any;
  constructor() {
    this._musicState      = 'silent';
    this._currentBgm      = null;
    this._phaseConfig     = null;
    this._currentPhaseId  = 'main';
    this._defaultExploracao = null;
    this._sfxCache           = {};
    this.volume              = { music: 0.45, sfx: 0.75 };
    this._musicVolUser       = false; // true quando o jogador ajustou o slider local de música
    this._playerPref         = null;  // preferência de trilhas do jogador (setPlayerPref)
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

  // Config de áudio efetiva da fase: a do mestre (_phaseConfig), com as trilhas
  // sobrescritas pelas escolhas do jogador quando a preferência é 'custom'.
  // 'auto'/'master' seguem a trilha do mestre sem alteração.
  _effectiveAudio() {
    const base = this._phaseConfig || {};
    const pref = this._playerPref;
    if (!pref || pref.mode !== 'custom' || !pref.tracks) return base;
    const out = { ...base };
    if (pref.tracks.exploracao_url) out.exploracao_url = pref.tracks.exploracao_url;
    if (pref.tracks.combate_url)    out.combate_url    = pref.tracks.combate_url;
    if (pref.tracks.boss_url)       out.boss_url       = pref.tracks.boss_url;
    return out;
  }

  // Volume efetivo da BGM: o ajuste local do jogador (slider do menu) vence o
  // volume_musica configurado pelo mestre; sem ajuste local, vale o do mestre.
  _bgmVolume(audio: any) {
    if (this._musicVolUser) return this.volume.music;
    return audio?.volume_musica ?? this.volume.music;
  }

  onEnterPhase(fase: any, phaseId: any) {
    this._phaseConfig    = fase?.audio || fase?.render_data?.audio || {};
    this._currentPhaseId = phaseId || fase?.map_id || fase?.id || 'main';

    const audio = this._effectiveAudio();
    let url = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (!url) {
      url = this._getOrPickDefaultTrack('exploracao', this._currentPhaseId);
      this._defaultExploracao = url;
    } else {
      this._defaultExploracao = null;
    }
    if (url) this._playBgm(url, { volume: this._bgmVolume(audio) });
    else this.stopMusic();
    this._musicState = 'exploration';
  }

  onCombatStart(hasBoss = false) {
    if (this._musicState === 'combat' || this._musicState === 'boss') return;
    const audio = this._effectiveAudio();
    const key   = hasBoss ? 'boss_url' : 'combate_url';
    let url = this._resolveId(audio[key]);
    if (!url) {
      const cat = hasBoss ? 'boss' : 'combate';
      url = this._getOrPickDefaultTrack(cat, this._currentPhaseId);
    }
    if (url) this._playBgm(url, { volume: this._bgmVolume(audio) });
    this._musicState = hasBoss ? 'boss' : 'combat';
  }

  onCombatEnd() {
    if (this._musicState !== 'combat' && this._musicState !== 'boss') return;
    const audio = this._effectiveAudio();
    let url = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (!url) url = this._defaultExploracao || this._getOrPickDefaultTrack('exploracao', this._currentPhaseId);
    if (url) this._playBgm(url, { volume: this._bgmVolume(audio) });
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

  _playBgm(url: any, { volume = this.volume.music, fade = 800 } = {}) {
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

  // URL same-origin (assets locais) pode usar Web Audio (html5:false), que habilita
  // panning estéreo via stereo(); URLs remotas continuam html5:true (evita CORS).
  _isSameOrigin(url: any) {
    try {
      if (!url) return false;
      if (url.startsWith('/') || url.startsWith('./')) return true;
      if (url.startsWith('http')) return url.startsWith(location.origin);
      return true; // relativa
    } catch (_) { return false; }
  }

  playSFX(idOrUrl: any, { volume, pitchVariance = 0, pan = 0 }: any = {}) {
    if (this._muted || typeof Howl === 'undefined') return;
    const url = this._resolveId(idOrUrl);
    if (!url) return;
    const vol = Math.min(1, Math.max(0, volume ?? this.volume.sfx));
    let howl = this._sfxCache[url];
    if (!howl) {
      const local = this._isSameOrigin(url);
      // html5:true avoids CORS issues with cross-origin audio URLs (Web Audio API requires
      // proper CORS headers; HTML5 <audio> element does not for basic playback)
      howl = new Howl({
        src:    [url],
        volume: vol,
        html5:  !local,
        onloaderror: (_id: any, err: any) => {
          console.warn('[SFX] Falha ao carregar:', url, err);
          try { mostrarToast('Falha ao carregar áudio. Verifique se a URL é um link direto para .mp3, .wav ou .ogg.', 'aviso'); } catch (_) {}
        },
        onplayerror:  (_id: any, err: any) => console.warn('[SFX] Falha ao tocar:', url, err),
      });
      this._sfxCache[url] = howl;
    }
    const id = howl.play();
    howl.volume(vol, id);
    // Panning estéreo (posicional): só funciona no caminho Web Audio (assets locais)
    if (pan && typeof howl.stereo === 'function' && howl._webAudio) {
      try { howl.stereo(Math.max(-1, Math.min(1, pan)), id); } catch (_) {}
    }
    if (pitchVariance > 0) {
      const rate = 1 + (Math.random() * 2 - 1) * pitchVariance;
      howl.rate(Math.max(0.5, Math.min(2, rate)), id);
    }
  }

  // Howl em loop para fontes de som ambiente colocadas no mapa (tocha, cachoeira).
  // O chamador controla o volume por distância a cada tick; retorna o Howl ou null.
  criarLoopAmbiente(idOrUrl: any) {
    if (typeof Howl === 'undefined') return null;
    const url = this._resolveId(idOrUrl);
    if (!url) return null;
    try {
      const howl = new Howl({ src: [url], loop: true, volume: 0, html5: !this._isSameOrigin(url) });
      howl.play();
      return howl;
    } catch (_) { return null; }
  }

  preloadSFX(ids: any = []) {
    if (typeof Howl === 'undefined') return;
    ids.forEach((id: any) => {
      const url = this._resolveId(id);
      if (url && !this._sfxCache[url]) {
        this._sfxCache[url] = new Howl({ src: [url], preload: true, html5: true });
      }
    });
  }

  // ── Auto-mapeamento de SFX por tipo de animação ───────────────────────────

  getSkillSfx(tipo: any, posicao: any, tipoDano: any, gsapPreset: any) {
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

  getDefaultSoundtrackList(tipo: any) {
    return DEFAULT_SOUNDTRACKS[tipo] || [];
  }

  loadUserSfxLibrary(biblioteca: any = []) {
    this._userSfxBiblioteca = Array.isArray(biblioteca) ? biblioteca : [];
    this._userSfxLoaded = true;
  }

  getSfxList(cat: any) {
    const builtIn = Object.entries(DEFAULT_SFX_LIBRARY).map(([id, v]) => ({ id, ...v }));
    const user    = this._userSfxBiblioteca.map((e: any) => ({ id: e.id, label: e.nome, url: e.url, cat: e.cat || 'custom', _user: true }));
    const all     = [...builtIn, ...user];
    return cat ? all.filter(e => e.cat === cat) : all;
  }

  getSfxLabel(idOrUrl: any) {
    if (!idOrUrl) return '';
    const entry = DEFAULT_SFX_LIBRARY[idOrUrl];
    if (entry) return entry.label;
    const userEntry = this._userSfxBiblioteca.find((e: any) => e.id === idOrUrl || e.url === idOrUrl);
    if (userEntry) return userEntry.nome;
    return idOrUrl;
  }

  // ── Volume / mute ─────────────────────────────────────────────────────────

  setMusicVolume(v: any) {
    this.volume.music = Math.min(1, Math.max(0, v));
    this._musicVolUser = true; // preferência local passa a vencer o volume_musica do mestre
    if (this._currentBgm) this._currentBgm.volume(this._muted ? 0 : this.volume.music);
  }

  setSfxVolume(v: any) {
    this.volume.sfx = Math.min(1, Math.max(0, v));
  }

  setMuted(muted: any) {
    this._muted = !!muted;
    if (this._currentBgm) this._currentBgm.volume(this._muted ? 0 : this.volume.music);
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _resolveId(idOrUrl: any) {
    if (!idOrUrl) return null;
    if (typeof idOrUrl === 'string' && (idOrUrl.startsWith('http') || idOrUrl.startsWith('/'))) return idOrUrl;
    const sfx = DEFAULT_SFX_LIBRARY[idOrUrl];
    if (sfx) return sfx.url;
    const userEntry = this._userSfxBiblioteca.find((e: any) => e.id === idOrUrl);
    if (userEntry) return userEntry.url;
    return null;
  }

  _getOrPickDefaultTrack(tipo: any, phaseId: any) {
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

  // Preferência de música do jogador (definida no menu de início). Setter puro:
  // as trilhas efetivas são resolvidas em _effectiveAudio() a cada transição
  // (onEnterPhase/onCombatStart/onCombatEnd), então basta guardar a escolha.
  // pref = { mode: 'auto'|'master'|'custom', tracks: { exploracao_url, combate_url, boss_url } }
  setPlayerPref(pref: any) {
    this._playerPref = (!pref || pref.mode === 'auto') ? null : pref;
  }
}

window.AudioManager = new _AudioManager();

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "DEFAULT_SOUNDTRACKS", { configurable: true, get: () => DEFAULT_SOUNDTRACKS });
Object.defineProperty(globalThis, "DEFAULT_SFX_LIBRARY", { configurable: true, get: () => DEFAULT_SFX_LIBRARY });
Object.defineProperty(globalThis, "SOUND_BANK", { configurable: true, get: () => SOUND_BANK });
Object.defineProperty(globalThis, "_SFX_AUTO_MAP", { configurable: true, get: () => _SFX_AUTO_MAP });
// @ts-expect-error — setter rebinda a function declaration (semântica original dos accessors [migração-esm])
Object.defineProperty(globalThis, "_AudioManager", { configurable: true, get: () => _AudioManager, set: (__v) => { _AudioManager = __v; } });
