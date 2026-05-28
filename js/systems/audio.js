// audio.js — AudioManager (Howler.js)
// Gerencia música de fundo (exploração/combate/boss) e SFX de skills/ataques.
// Requer Howler.js carregado antes deste arquivo.

const SOUND_BANK = {
  // Ataques básicos — fontes OpenGameArt / FreePD (domínio público)
  sword_slash:   'https://opengameart.org/sites/default/files/sword_slash.ogg',
  bow_release:   'https://opengameart.org/sites/default/files/bow_release.ogg',
  punch_impact:  'https://opengameart.org/sites/default/files/punch.ogg',
  magic_cast:    'https://opengameart.org/sites/default/files/magic_spell.ogg',
  magic_charge:  'https://opengameart.org/sites/default/files/magic_charge.ogg',
  // Impactos
  hit_physical:  'https://opengameart.org/sites/default/files/hit_hurt.ogg',
  hit_magic:     'https://opengameart.org/sites/default/files/magic_hit.ogg',
  critical_hit:  'https://opengameart.org/sites/default/files/critical.ogg',
  shield_block:  'https://opengameart.org/sites/default/files/shield_block.ogg',
  arrow_whoosh:  'https://opengameart.org/sites/default/files/arrow_whoosh.ogg',
  // Elementais
  fire_burst:    'https://opengameart.org/sites/default/files/fire_burst.ogg',
  thunder_crack: 'https://opengameart.org/sites/default/files/thunder.ogg',
  ice_shatter:   'https://opengameart.org/sites/default/files/ice_shatter.ogg',
  dark_whoosh:   'https://opengameart.org/sites/default/files/dark_whoosh.ogg',
  holy_shine:    'https://opengameart.org/sites/default/files/holy_shine.ogg',
  // Cura / utilidade
  heal_chime:    'https://opengameart.org/sites/default/files/heal.ogg',
  level_up:      'https://opengameart.org/sites/default/files/level_up.ogg',
  chest_open:    'https://opengameart.org/sites/default/files/chest_open.ogg',
  door_open:     'https://opengameart.org/sites/default/files/door_open.ogg',
};

class _AudioManager {
  constructor() {
    this._musicState  = 'silent';
    this._currentBgm  = null;
    this._phaseConfig = null;
    this._sfxCache    = {};
    this.volume       = { music: 0.45, sfx: 0.75 };
    this._muted       = false;
  }

  // ── Música de fundo ───────────────────────────────────────────────────────

  onEnterPhase(fase) {
    const audio = fase?.audio || fase?.render_data?.audio || {};
    this._phaseConfig = audio;
    const url = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (url) {
      this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    } else {
      this.stopMusic();
    }
    this._musicState = 'exploration';
  }

  onCombatStart(hasBoss = false) {
    if (this._musicState === 'combat' || this._musicState === 'boss') return;
    const audio = this._phaseConfig || {};
    const key   = hasBoss ? 'boss_url' : 'combate_url';
    const url   = this._resolveId(audio[key]);
    if (url) {
      this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    }
    this._musicState = hasBoss ? 'boss' : 'combat';
  }

  onCombatEnd() {
    if (this._musicState !== 'combat' && this._musicState !== 'boss') return;
    const audio = this._phaseConfig || {};
    const url   = this._resolveId(audio.exploracao_url || audio.musica_url);
    if (url) {
      this._playBgm(url, { volume: audio.volume_musica ?? this.volume.music });
    }
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
    if (typeof Howl === 'undefined') return;
    if (this._currentBgm) {
      const old = this._currentBgm;
      old.fade(old.volume(), 0, fade);
      setTimeout(() => old.stop(), fade + 50);
    }
    const howl = new Howl({
      src: [url],
      loop: true,
      volume: this._muted ? 0 : 0,
      html5: true,
    });
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
      howl = new Howl({ src: [url], volume: vol });
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
    if (idOrUrl.startsWith('http') || idOrUrl.startsWith('/')) return idOrUrl;
    return SOUND_BANK[idOrUrl] || null;
  }
}

window.AudioManager = new _AudioManager();
