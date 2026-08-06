// Preferência de música do jogador e volume efetivo da BGM (js/systems/audio.js):
// _effectiveAudio resolve as trilhas por modo ('auto'/'master'/'custom') e
// _bgmVolume decide entre o volume do mestre (volume_musica) e o ajuste local.
import { describe, it, expect, beforeEach } from 'vitest';
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
