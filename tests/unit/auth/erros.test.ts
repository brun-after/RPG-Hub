// Tradução de erros do Supabase Auth para mensagens em português
// (js/auth/auth.js).
import { describe, it, expect } from 'vitest';
import '../../../js/auth/auth.js';

const g = globalThis as any;

describe('traduzirErroAuth', () => {
  it.each([
    ['User already registered', 'Esse e-mail já está cadastrado'],
    ['user already exists', 'Esse e-mail já está cadastrado'],
    ['Invalid login credentials', 'E-mail ou senha incorretos'],
    ['invalid_grant', 'E-mail ou senha incorretos'],
    ['Email not confirmed', 'E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam).'],
    ['weak password: too short', 'Senha muito fraca'],
    ['Rate limit exceeded', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'],
    ['too many requests', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(g.traduzirErroAuth(entrada)).toBe(esperado);
  });

  it('é insensível a caixa', () => {
    expect(g.traduzirErroAuth('INVALID LOGIN')).toBe('E-mail ou senha incorretos');
  });

  it('mensagem desconhecida passa adiante; vazia vira "Erro desconhecido"', () => {
    expect(g.traduzirErroAuth('Erro exótico 42')).toBe('Erro exótico 42');
    expect(g.traduzirErroAuth('')).toBe('Erro desconhecido');
    expect(g.traduzirErroAuth(null)).toBe('Erro desconhecido');
  });
});
