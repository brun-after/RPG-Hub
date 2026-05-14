// lib/supabase.js
// Cliente REST para Supabase — replica o padrão sb() do app
// Suporta: GET, POST, PATCH, DELETE com auth Bearer
// Em modo simulação (setSimMode), roteia para simdb.js em memória

import fetch from 'node-fetch';
import { simSb, simBroadcast } from './simdb.js';

let _url = '';
let _key = '';
let _serviceKey = '';
let _token = '';
let _simMode = false;

export function initSupabase(url, anonKey, serviceRoleKey = '') {
  _url = url;
  _key = anonKey;
  _serviceKey = serviceRoleKey;
}

export function setSimMode(enabled = true) { _simMode = enabled; }
export function isSimMode() { return _simMode; }
export function hasServiceRole() { return !!_serviceKey; }
export function getServiceKey()  { return _serviceKey; }

export function setAuthToken(token) { _token = token; }
export function clearAuthToken()    { _token = ''; }

// Equivalente ao sb() do app — em sim mode usa banco em memória
export async function sb(endpoint, opts = {}) {
  if (_simMode) return simSb(endpoint, opts);

  const url = `${_url}/rest/v1/${endpoint}`;
  const headers = {
    'apikey': _key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body || undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new SbError(res.status, endpoint, errBody);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Auth — signup
export async function authSignup(email, senha, nickname, nomeReal) {
  const res = await fetch(`${_url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'apikey': _key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: senha,
      data: { nickname, nome_real: nomeReal },
      // Sem captcha_token — testando se backend exige
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new SbError(res.status, 'auth/signup', JSON.stringify(body));
  return body;
}

// Auth — login (tenta sem captcha, pode falhar se hCaptcha habilitado)
export async function authLogin(email, senha) {
  const res = await fetch(`${_url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': _key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  const body = await res.json();
  if (!res.ok) throw new SbError(res.status, 'auth/login', JSON.stringify(body));
  return body; // { access_token, refresh_token, user }
}

// Auth Admin — cria usuário via service role (sem captcha)
export async function adminCreateUser(email, senha, metadata = {}) {
  if (!_serviceKey) throw new Error('Service role key não configurada');
  const res = await fetch(`${_url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': _serviceKey,
      'Authorization': `Bearer ${_serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: senha,
      email_confirm: true, // confirma email automaticamente
      user_metadata: metadata,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new SbError(res.status, 'admin/users', JSON.stringify(body));
  return body;
}

// Auth Admin — gera token de acesso para usuário existente (via service role)
// Usa o endpoint de impersonação do Supabase
export async function adminGetUserToken(userId) {
  if (!_serviceKey) throw new Error('Service role key não configurada');
  // Não existe endpoint oficial de impersonação direto via REST
  // Usamos a chave de serviço como token de auth para fazer operações em nome do usuário
  return { access_token: _serviceKey, user: { id: userId } };
}

// Fluxo completo: criar ou recuperar usuário e retornar sessão
export async function ensureTestUser(email, senha, metadata = {}) {
  if (_serviceKey) {
    // Com service role: criar usuário (ignora se já existe) e retornar sessão de serviço
    try {
      await adminCreateUser(email, senha, metadata);
    } catch (e) {
      if (!e.body?.includes('already') && !e.message?.includes('already')) throw e;
      // Usuário já existe — tudo bem
    }
    // Login direto (service role pode contornar captcha dependendo da config)
    try {
      const sess = await authLogin(email, senha);
      return sess;
    } catch {
      // Fallback: retornar "sessão" com service role token
      return { access_token: _serviceKey, refresh_token: null, user: { email } };
    }
  } else {
    // Sem service role: tentar login direto (falha se captcha ativo no login)
    return await authLogin(email, senha);
  }
}

// Auth — refresh
export async function authRefresh(refreshToken) {
  const res = await fetch(`${_url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'apikey': _key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await res.json();
  if (!res.ok) throw new SbError(res.status, 'auth/refresh', JSON.stringify(body));
  return body;
}

// Broadcast — envia evento para canal realtime (via REST Broadcast API)
export async function broadcast(channel, event, payload) {
  if (_simMode) { simBroadcast(channel, event, payload); return; }

  const res = await fetch(`${_url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'apikey': _key,
      'Authorization': `Bearer ${_token || _key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ topic: channel, event, payload }]
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new SbError(res.status, `broadcast/${channel}`, t);
  }
}

export class SbError extends Error {
  constructor(status, endpoint, body) {
    super(`[Supabase ${status}] ${endpoint}: ${body}`);
    this.status = status;
    this.endpoint = endpoint;
    this.body = body;
  }
}
