// Preferência de música do jogador e volume efetivo da BGM (js/systems/audio.js):
// _effectiveAudio resolve as trilhas por modo ('auto'/'master'/'custom') e
// _bgmVolume decide entre o volume do mestre (volume_musica) e o ajuste local.
// playSFX: ganho relativo ao slider, rate-limit e teto de vozes por URL.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../../js/systems/audio.js';

const g = globalThis as any;

function novoManager() {
  return new g._AudioManager();
}

describe('_effectiveAudio (trilhas efetivas por preferência do jogador)', () => {
  let am: any;
  beforeEach(() => {
    am = novoManager();
    am._phaseConfig = { exploracao_url: 'master-exp', combate_url: 'master-comb', volume_musica: 0.8 };
  });

  it('sem preferência devolve a config do mestre intacta', () => {
    expect(am._effectiveAudio()).toBe(am._phaseConfig);
  });

  it("modo 'master' segue a trilha do mestre sem alteração", () => {
    am.setPlayerPref({ mode: 'master' });
    expect(am._effectiveAudio()).toEqual(am._phaseConfig);
  });

  it("modo 'custom' parcial sobrescreve só as trilhas preenchidas", () => {
    am.setPlayerPref({ mode: 'custom', tracks: { combate_url: 'minha-comb' } });
    const audio = am._effectiveAudio();
    expect(audio.combate_url).toBe('minha-comb');
    expect(audio.exploracao_url).toBe('master-exp');
    expect(audio.volume_musica).toBe(0.8);
    // e não muta a config original do mestre
    expect(am._phaseConfig.combate_url).toBe('master-comb');
  });

  it("modo 'auto' (ou pref nula) limpa a preferência", () => {
    am.setPlayerPref({ mode: 'custom', tracks: { boss_url: 'x' } });
    am.setPlayerPref({ mode: 'auto' });
    expect(am._playerPref).toBeNull();
    am.setPlayerPref(null);
    expect(am._playerPref).toBeNull();
  });
});

describe('_bgmVolume (volume local do jogador × volume_musica do mestre)', () => {
  it('sem ajuste local vale o volume_musica do mestre', () => {
    const am = novoManager();
    expect(am._bgmVolume({ volume_musica: 0.8 })).toBe(0.8);
  });

  it('sem ajuste local e sem volume_musica cai no padrão do manager', () => {
    const am = novoManager();
    expect(am._bgmVolume({})).toBe(am.volume.music);
  });

  it('ajuste local (setMusicVolume) vence o volume_musica do mestre', () => {
    const am = novoManager();
    am.setMusicVolume(0.1);
    expect(am._bgmVolume({ volume_musica: 0.8 })).toBe(0.1);
  });
});

// Dublê de Howl: registra opções de construção e chamadas de play/volume.
class FakeHowl {
  static instances: any[] = [];
  opts: any;
  playCalls = 0;
  volumeCalls: any[] = [];
  _nextId = 1;
  constructor(opts: any) { this.opts = opts; FakeHowl.instances.push(this); }
  play() { this.playCalls++; return this._nextId++; }
  volume(...args: any[]) { this.volumeCalls.push(args); }
  rate() {}
  once() {}
  unload() {}
}

describe('playSFX (ganho relativo ao slider, rate-limit e teto de vozes)', () => {
  let am: any;
  beforeEach(() => {
    FakeHowl.instances = [];
    vi.stubGlobal('Howl', FakeHowl);
    am = novoManager();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('multiplica o ganho do chamador pelo volume global do slider', () => {
    am.setSfxVolume(0.5);
    am.playSFX('sword_slash', { volume: 0.8 });
    expect(FakeHowl.instances).toHaveLength(1);
    expect(FakeHowl.instances[0].opts.volume).toBeCloseTo(0.4);
  });

  it('sem ganho explícito, toca no volume do slider', () => {
    am.setSfxVolume(0.6);
    am.playSFX('sword_slash');
    expect(FakeHowl.instances[0].opts.volume).toBeCloseTo(0.6);
  });

  it('slider a zero não instancia nem toca nada', () => {
    am.setSfxVolume(0);
    am.playSFX('sword_slash', { volume: 0.8 });
    expect(FakeHowl.instances).toHaveLength(0);
  });

  it('rate-limit por URL: rajada dentro de 80ms colapsa numa tocada só', () => {
    vi.useFakeTimers();
    am.playSFX('sword_slash');
    am.playSFX('sword_slash');
    expect(FakeHowl.instances[0].playCalls).toBe(1);
    vi.advanceTimersByTime(100);
    am.playSFX('sword_slash');
    expect(FakeHowl.instances[0].playCalls).toBe(2);
  });

  it('teto de vozes: com 4 instâncias ativas da mesma URL não toca outra', () => {
    const url = am._resolveId('sword_slash');
    am._sfxVoices[url] = 4;
    am.playSFX('sword_slash');
    expect(FakeHowl.instances).toHaveLength(0);
  });
});

describe('trilhas padrão de exploração (sem faixas cômicas + cache de sessão)', () => {
  it('a playlist padrão não contém as faixas cômicas removidas', () => {
    const ids = (g.DEFAULT_SOUNDTRACKS.exploracao || []).map((t: any) => t.id);
    for (const comica of ['monkeys', 'carefree', 'pixelland', 'fluffing']) {
      expect(ids).not.toContain(comica);
    }
    expect(ids.length).toBeGreaterThan(0);
  });

  it('cache de sessão apontando para faixa removida é re-sorteado', () => {
    const am = novoManager();
    sessionStorage.setItem('rpghub_track_exploracao_fase-x', 'https://exemplo.com/removida.mp3');
    const pick = am._getOrPickDefaultTrack('exploracao', 'fase-x');
    const urls = g.DEFAULT_SOUNDTRACKS.exploracao.map((t: any) => t.url);
    expect(urls).toContain(pick);
    expect(sessionStorage.getItem('rpghub_track_exploracao_fase-x')).toBe(pick);
  });

  it('cache de sessão que ainda existe na lista continua honrado', () => {
    const am = novoManager();
    const valida = g.DEFAULT_SOUNDTRACKS.exploracao[0].url;
    sessionStorage.setItem('rpghub_track_exploracao_fase-y', valida);
    expect(am._getOrPickDefaultTrack('exploracao', 'fase-y')).toBe(valida);
  });
});

// Dublê de Howl para BGM: play/pause/stop/fade/playing.
class FakeBgmHowl {
  static instances: any[] = [];
  opts: any;
  _playing = false;
  pauseCalls = 0;
  stopCalls = 0;
  constructor(opts: any) { this.opts = opts; FakeBgmHowl.instances.push(this); }
  play() { this._playing = true; }
  pause() { this._playing = false; this.pauseCalls++; }
  stop() { this._playing = false; this.stopCalls++; }
  fade() {}
  playing() { return this._playing; }
  volume() { return this.opts.volume ?? 0; }
}

describe('stopMusic (saída para o menu não deixa rastro)', () => {
  let am: any;
  beforeEach(() => {
    FakeBgmHowl.instances = [];
    vi.stubGlobal('Howl', FakeBgmHowl);
    am = novoManager();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('limpa _pendingBgm e reseta o estado mesmo sem BGM ativa', () => {
    am._pendingBgm = { url: 'trilha', volume: 0.5 };
    am._musicState = 'combat';
    am._musicPausada = true;
    am.stopMusic({ fade: 0 });
    expect(am._pendingBgm).toBeNull();
    expect(am._musicState).toBe('silent');
    expect(am._musicPausada).toBe(false);
  });

  it('para a BGM ativa e o clique seguinte não a ressuscita', () => {
    am._playBgm('trilha', { volume: 0.5, fade: 0 });
    const bgm = FakeBgmHowl.instances[0];
    am.stopMusic({ fade: 0 });
    expect(bgm.stopCalls).toBeGreaterThan(0);
    expect(am._currentBgm).toBeNull();
    document.dispatchEvent(new Event('click')); // retry de autoplay
    expect(FakeBgmHowl.instances).toHaveLength(1); // nenhuma nova instância
  });
});

describe('pauseMusic/resumeMusic (pausa in-game)', () => {
  let am: any;
  beforeEach(() => {
    FakeBgmHowl.instances = [];
    vi.stubGlobal('Howl', FakeBgmHowl);
    am = novoManager();
  });
  afterEach(() => { vi.useRealTimers(); });

  it('pausa a BGM atual e retoma do ponto', () => {
    am._playBgm('trilha', { volume: 0.5, fade: 0 });
    const bgm = FakeBgmHowl.instances[0];
    am.pauseMusic();
    expect(bgm.playing()).toBe(false);
    expect(am._musicPausada).toBe(true);
    am.resumeMusic();
    expect(bgm.playing()).toBe(true);
    expect(am._musicPausada).toBe(false);
  });

  it('clique durante a pausa não ressuscita a BGM (retry bloqueado)', () => {
    am._playBgm('trilha', { volume: 0.5, fade: 0 });
    am.pauseMusic();
    document.dispatchEvent(new Event('click'));
    expect(FakeBgmHowl.instances).toHaveLength(1);
    expect(am._currentBgm.playing()).toBe(false);
  });

  it('troca de trilha durante a pausa só agenda; resume toca a pendente', () => {
    am._playBgm('exploracao', { volume: 0.5, fade: 0 });
    am.pauseMusic();
    am._playBgm('combate', { volume: 0.7, fade: 0 }); // ex.: perseguição começou
    expect(am._currentBgm).toBeNull();               // nada tocando durante a pausa
    expect(am._pendingBgm).toEqual({ url: 'combate', volume: 0.7 });
    am.resumeMusic();
    const nova = FakeBgmHowl.instances[FakeBgmHowl.instances.length - 1];
    expect(nova.opts.src).toEqual(['combate']);
    expect(nova.playing()).toBe(true);
  });

  it('resumeMusic sem pausa ativa é no-op', () => {
    am._playBgm('trilha', { volume: 0.5, fade: 0 });
    const antes = FakeBgmHowl.instances.length;
    am.resumeMusic();
    expect(FakeBgmHowl.instances).toHaveLength(antes);
  });
});
