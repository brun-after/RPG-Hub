// auth/auth.js
// RPG Hub — Authentication system: login, registration, password recovery, session management
// Includes: authTab(), fazerLogin(), registrar(), recuperarSenha(), refreshSession(), logout()

// ═══════════════════════════════════════════════════════════════

let AUTH_MODE = 'login';
let HCAPTCHA_WIDGET_ID = null;

// Inicializa o widget hCaptcha quando a API estiver pronta
function onHcaptchaLoad() {
  const el = document.getElementById('auth-hcaptcha');
  if (!el) return;
  HCAPTCHA_WIDGET_ID = hcaptcha.render('auth-hcaptcha', {
    sitekey: HCAPTCHA_SITEKEY,
    theme: 'dark',
    size: 'normal'
  });
}

function authTab(modo) {
  AUTH_MODE = modo;
  const isLogin = modo === 'login';
  document.getElementById('auth-tab-login').style.background    = isLogin ? 'var(--primario)' : 'transparent';
  document.getElementById('auth-tab-login').style.color         = isLogin ? '#fff' : 'var(--suave)';
  document.getElementById('auth-tab-cadastro').style.background = isLogin ? 'transparent' : 'var(--primario)';
  document.getElementById('auth-tab-cadastro').style.color      = isLogin ? 'var(--suave)' : '#fff';
  document.getElementById('auth-nickname-wrap').style.display    = isLogin ? 'none'  : 'block';
  document.getElementById('auth-nome-real-wrap').style.display   = isLogin ? 'none'  : 'block';
  document.getElementById('auth-cadastro-extra').style.display  = isLogin ? 'none'  : 'block';
  document.getElementById('auth-esqueci-wrap').style.display    = (isLogin && EMAIL_CONFIRMATION_ENABLED) ? 'block' : 'none';
  document.getElementById('auth-btn').textContent               = isLogin ? 'Entrar' : 'Criar Conta';
  authErro(''); authSucesso(''); authOcultarRecuperacao();
  if (HCAPTCHA_WIDGET_ID !== null) hcaptcha.reset(HCAPTCHA_WIDGET_ID);
}

function authErro(msg) {
  const el = document.getElementById('auth-erro');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
}

function authSucesso(msg) {
  const el = document.getElementById('auth-sucesso');
  el.textContent = msg; el.style.display = msg ? 'block' : 'none';
}

function authToggleSenha() {
  const inp = document.getElementById('auth-senha');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}
function authToggleSenha2() {
  const inp = document.getElementById('auth-senha2');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function authSubmit() {
  const email = document.getElementById('auth-email').value.trim().toLowerCase();
  const senha  = document.getElementById('auth-senha').value;
  if (!email || !email.includes('@')) { authErro('Informe um e-mail válido'); return; }
  if (senha.length < 8) { authErro('Senha deve ter no mínimo 8 caracteres'); return; }
  // Verificar se o widget do hCaptcha já foi renderizado antes de tentar obter resposta
  if (HCAPTCHA_WIDGET_ID === null) {
    authErro('O desafio de segurança ainda está carregando. Aguarde um instante e tente novamente.');
    return;
  }
  const btn = document.getElementById('auth-btn');
  btn.textContent = '...'; btn.disabled = true;
  try {
    if (AUTH_MODE === 'cadastro') {
      const nickname = document.getElementById('auth-nickname').value.trim().toLowerCase();
      const nomeReal  = document.getElementById('auth-nome-real').value.trim();
      const senha2   = document.getElementById('auth-senha2').value;
      if (!nickname) { authErro('Informe seu nickname'); return; }
      if (!/^[a-z0-9_]{2,30}$/.test(nickname)) {
        authErro('Nickname: apenas letras minúsculas, números e _ (2–30 caracteres)'); return;
      }
      if (!nomeReal || nomeReal.length < 2) { authErro('Informe seu nome real (mínimo 2 caracteres)'); return; }
      if (senha !== senha2) { authErro('As senhas não coincidem'); return; }
      await authCadastrar(email, senha, nickname, nomeReal);
    } else {
      await authEntrar(email, senha);
    }
  } catch(e) {
    authErro(e.message || 'Erro desconhecido');
  } finally {
    btn.disabled = false;
    btn.textContent = AUTH_MODE === 'login' ? 'Entrar' : 'Criar Conta';
  }
}

async function authCadastrar(email, senha, nickname, nomeReal = '') {
  const captchaToken = hcaptcha.getResponse(HCAPTCHA_WIDGET_ID);
  if (!captchaToken) { authErro('Por favor, complete o desafio de segurança.'); return; }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({
      email, password: senha,
      data: { nickname, nome_real: nomeReal },
      gotrue_meta_security: { captcha_token: captchaToken }
    })
  });
  const data = await res.json();
  const errCad = data.error_description || data.msg ||
    (typeof data.error === 'string' ? data.error : data.error?.message);
  hcaptcha.reset(HCAPTCHA_WIDGET_ID);
  if (errCad) throw new Error(traduzirErroAuth(errCad));
  if (EMAIL_CONFIRMATION_ENABLED) {
    authSucesso('Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.');
  } else {
    authSucesso('Conta criada! Agora faça login com seu e-mail e senha.');
  }
  authErro('');
}

async function authEntrar(email, senha) {
  const captchaToken = hcaptcha.getResponse(HCAPTCHA_WIDGET_ID);
  if (!captchaToken) { authErro('Por favor, complete o desafio de segurança.'); return; }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password: senha, gotrue_meta_security: { captcha_token: captchaToken } })
  });
  const data = await res.json();
  // Supabase pode retornar erro como string, objeto ou no campo msg/error_description
  const errMsg = data.error_description || data.msg ||
    (typeof data.error === 'string' ? data.error : data.error?.message);
  hcaptcha.reset(HCAPTCHA_WIDGET_ID);
  if (errMsg || !data.user) throw new Error(traduzirErroAuth(errMsg));

  // Busca nickname na tabela players
  const playerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${data.user.id}&select=nickname`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${data.access_token}` } }
  );
  const players  = await playerRes.json();
  const nickname = players?.[0]?.nickname || data.user.email;

  SESSION = {
    user:          data.user,
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    nickname
  };
  localStorage.setItem('rpghub_session', JSON.stringify(SESSION));
  iniciarApp();
}

// ── RECUPERAÇÃO DE SENHA ──────────────────────────────────────
function authMostrarRecuperacao() {
  document.getElementById('auth-recuperacao-painel').style.display = 'block';
  document.getElementById('auth-recuperacao-email').value = document.getElementById('auth-email').value;
  document.getElementById('auth-recuperacao-msg').style.display = 'none';
  setTimeout(() => document.getElementById('auth-recuperacao-email').focus(), 100);
}

function authOcultarRecuperacao() {
  document.getElementById('auth-recuperacao-painel').style.display = 'none';
}

async function authEnviarRecuperacao() {
  const msgEl = document.getElementById('auth-recuperacao-msg');
  if (!EMAIL_CONFIRMATION_ENABLED) {
    msgEl.textContent = 'Recuperação de senha temporariamente indisponível. Tente mais tarde.';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
    return;
  }
  const email = document.getElementById('auth-recuperacao-email').value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    msgEl.textContent = 'Informe um e-mail válido';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
    return;
  }
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ email })
    });
    msgEl.textContent = 'Se o e-mail estiver cadastrado, o link chegará em instantes. Verifique também o spam.';
    msgEl.style.cssText = 'display:block;color:#5ee09a;background:rgba(94,224,154,0.06);border:1px solid rgba(94,224,154,0.2);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
  } catch(e) {
    msgEl.textContent = 'Erro ao enviar. Tente novamente.';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
  }
}

// ── HANDLER DO LINK DE RECUPERAÇÃO ──────────────────────────
function authVerificarLinkRecuperacao() {
  const hash   = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  if (params.get('type') !== 'recovery') return false;
  const token = params.get('access_token');
  if (!token) return false;
  history.replaceState(null, '', window.location.pathname);
  authExibirFormNovaSenha(token);
  return true;
}

async function authVerificarConfirmacaoEmail() {
  const hash   = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  const type   = params.get('type');
  if (type !== 'signup' && type !== 'email_change') return false;
  const access_token  = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token) return false;

  // Limpa o hash da URL
  history.replaceState(null, '', window.location.pathname);

  // Busca dados do usuário com o token recebido
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${access_token}` }
    });
    const userData = await userRes.json();
    if (!userData.id) throw new Error('Usuário inválido');

    const playerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/players?id=eq.${userData.id}&select=nickname`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${access_token}` } }
    );
    const players  = await playerRes.json();
    const nickname = players?.[0]?.nickname || userData.email;

    SESSION = { user: userData, access_token, refresh_token, nickname };
    localStorage.setItem('rpghub_session', JSON.stringify(SESSION));
    iniciarApp();
  } catch(e) {
    // Se falhar, apenas mostra o login normalmente
    document.getElementById('hub').style.display       = 'none';
    document.getElementById('tela-auth').style.display = 'flex';
    authSucesso('E-mail confirmado! Faça login para continuar.');
  }
  return true;
}

function authExibirFormNovaSenha(tokenRecuperacao) {
  document.getElementById('hub').style.display       = 'none';
  document.getElementById('tela-auth').style.display = 'flex';
  const overlay = document.createElement('div');
  overlay.id = 'modal-nova-senha';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML = `
    <div style="background:var(--painel);border:1px solid var(--borda);border-radius:12px;padding:28px;width:100%;max-width:360px">
      <div style="font-family:var(--fonte-d);font-size:0.75rem;color:var(--destaque);text-transform:uppercase;margin-bottom:16px">🗝 Nova Senha</div>
      <p style="font-size:0.82rem;color:var(--suave);margin-bottom:16px;line-height:1.5">Escolha uma nova senha para sua conta.</p>
      <div class="form-group" style="margin-bottom:14px">
        <label>Nova Senha</label>
        <input type="password" id="nova-senha-input" placeholder="Mínimo 8 caracteres" style="text-align:left">
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label>Confirmar Nova Senha</label>
        <input type="password" id="nova-senha-conf" placeholder="Repita a senha" style="text-align:left">
      </div>
      <div id="nova-senha-msg" style="display:none;margin-bottom:14px;border-radius:6px;padding:8px 12px;font-size:0.78rem"></div>
      <button onclick="authSalvarNovaSenha('${tokenRecuperacao}')"
        class="btn btn-primario" style="width:100%;font-family:var(--fonte-d)">Salvar Nova Senha</button>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('nova-senha-input')?.focus(), 100);
}

async function authSalvarNovaSenha(tokenRecuperacao) {
  const nova  = document.getElementById('nova-senha-input').value;
  const conf  = document.getElementById('nova-senha-conf').value;
  const msgEl = document.getElementById('nova-senha-msg');
  if (nova.length < 8) {
    msgEl.textContent = 'Senha deve ter no mínimo 8 caracteres';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
    return;
  }
  if (nova !== conf) {
    msgEl.textContent = 'As senhas não coincidem';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
    return;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${tokenRecuperacao}`
      },
      body: JSON.stringify({ password: nova })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    msgEl.textContent = 'Senha alterada com sucesso!';
    msgEl.style.cssText = 'display:block;color:#5ee09a;background:rgba(94,224,154,0.06);border:1px solid rgba(94,224,154,0.2);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
    setTimeout(() => {
      document.getElementById('modal-nova-senha')?.remove();
      authSucesso('Senha alterada! Faça login com sua nova senha.');
    }, 1500);
  } catch(e) {
    msgEl.textContent = 'Erro ao salvar. O link pode ter expirado — solicite um novo.';
    msgEl.style.cssText = 'display:block;color:#e74c3c;background:rgba(231,76,60,0.08);border:1px solid rgba(231,76,60,0.25);border-radius:6px;padding:8px 12px;font-size:0.78rem;margin-bottom:14px';
  }
}

// ── TRADUÇÕES DE ERRO ─────────────────────────────────────────
function traduzirErroAuth(msg) {
  if (!msg) return 'Erro desconhecido';
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('user already exists'))
    return 'Esse e-mail já está cadastrado';
  if (m.includes('invalid login') || m.includes('invalid_grant') || m.includes('invalid credentials'))
    return 'E-mail ou senha incorretos';
  if (m.includes('email not confirmed') || m.includes('not confirmed'))
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada (e o spam).';
  if (m.includes('weak password'))
    return 'Senha muito fraca';
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return msg;
}

// ── REFRESH AUTOMÁTICO ────────────────────────────────────────
async function authRefreshSession() {
  if (!SESSION?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: SESSION.refresh_token })
    });
    const data = await res.json();
    if (data.error) return false;
    SESSION.access_token  = data.access_token;
    SESSION.refresh_token = data.refresh_token;
    localStorage.setItem('rpghub_session', JSON.stringify(SESSION));
    return true;
  } catch(e) { return false; }
}

// ── LOGOUT ────────────────────────────────────────────────────
function authSair() {
  SESSION = null;
  localStorage.removeItem('rpghub_session');
  localStorage.removeItem('rpghub_nav');
  document.getElementById('hub').style.display       = 'none';
  document.getElementById('tela-auth').style.display = 'flex';
  authTab('login');
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-senha').value = '';
}

// ── INIT ──────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  // Verificar link de confirmação de e-mail (cadastro)
  if (await authVerificarConfirmacaoEmail()) { esconderSplash(); return; }

  // Verificar link de recuperação de senha vindo do e-mail
  if (authVerificarLinkRecuperacao()) { esconderSplash(); return; }

  // Tentar restaurar sessão salva
  const sessaoSalva = localStorage.getItem('rpghub_session');
  if (sessaoSalva) {
    try {
      SESSION = JSON.parse(sessaoSalva);
      const ok = await authRefreshSession();
      if (ok) { esconderSplash(); iniciarApp(); return; }
    } catch(e) {}
  }

  // Sem sessão válida: mostrar tela de login
  esconderSplash();
  document.getElementById('hub').style.display       = 'none';
  document.getElementById('tela-auth').style.display = 'flex';
});

async function iniciarApp() {
  document.getElementById('tela-auth').style.display = 'none';
  // Hub fica oculto até confirmar que não há campanha salva para entrar direto
  USER_ID = SESSION?.nickname || SESSION?.user?.email || 'usuário';
  document.getElementById('hub-email').textContent = USER_ID;
  try {
    const rpgs = await getAllRPGs();
    HUB_DATA.rpgs = rpgs || [];
    renderRPGList(HUB_DATA.rpgs);
    try {
      const nav = JSON.parse(localStorage.getItem('rpghub_nav') || '{}');
      if (nav.screen === 'rpg' && nav.id) {
        const existe = HUB_DATA.rpgs.find(r => r.rpg_id === nav.id);
        if (existe) {
          // Sessão ativa dentro de campanha: entra direto sem mostrar hub
          if (existe.is_arena === true) {
            salvarNav('arena', nav.id);
            await abrirArenaHub(); await entrarArena(nav.id);
          } else {
            await entrarRPG(nav.id);
          }
          return;
        } else localStorage.removeItem('rpghub_nav');
      } else if (nav.screen === 'arena' && nav.id) {
        await abrirArenaHub(); await entrarArena(nav.id);
        return;
      }
    } catch(e) { localStorage.removeItem('rpghub_nav'); }
    // Sem campanha salva: exibe hub normalmente
    document.getElementById('hub').style.display = 'block';
  } catch(e) {
    document.getElementById('hub').style.display = 'block';
    document.getElementById('rpg-list').innerHTML =
      `<div style="color:#e74c3c;padding:20px;text-align:center">Erro ao conectar.</div>`;
  }
}


// ── HUB ───────────────────────────────────────────────────────
function renderRPGList(rpgs){
 const list=document.getElementById('rpg-list');
 if(!rpgs||!rpgs.length){list.innerHTML='<div style="text-align:center;padding:30px;color:#7a92aa;font-style:italic">Nenhuma campanha. Importe um RPG.</div>';return;}

 // Separar campanhas normais de arenas
 const campanhas=[], arenas=[];
 rpgs.forEach(r=>{
   const t = r.theme_json || {};
   if(r.is_arena===true) arenas.push({r,t});
   else campanhas.push({r,t});
 });

 let html='';

 // Campanhas normais
 if(campanhas.length){
   html+=campanhas.map(({r,t})=>{
     const cor=t.destaque||'#c8a84b',cor2=t.primario||'#4fa3d1';
     const customIcon=t.card_icon_svg||'';
     const rid=r.rpg_id.replace(/'/g,"\\'");
     return `<div class="rpg-card" onclick="entrarRPG('${rid}')" style="--card-accent:${cor}">
       <div class="rpg-card-header">
         <div class="rpg-card-icon" style="background:rgba(0,0,0,0.3);border:1px solid ${cor}22">
           ${getCardIconSVG(t.animation||'flame', cor, cor2, customIcon)}
         </div>
         <div><div class="rpg-card-name" style="color:${cor}">${r.name}</div></div>
       </div>
       ${t.description?`<div class="rpg-card-desc" style="font-size:0.8rem;color:#7a92aa;font-style:italic;padding:4px 0 6px;line-height:1.4">${t.description}</div>`:''}
       <div class="rpg-card-arrow">→</div>
     </div>`;
   }).join('');
 } else {
   html+='<div style="text-align:center;padding:30px;color:#7a92aa;font-style:italic">Nenhuma campanha. Importe um RPG.</div>';
 }

 // Arenas encontradas na lista — exibir como cards especiais de arena
 if(arenas.length){
   html+=`<div class="hub-section-title" style="color:rgba(232,80,60,0.55);margin-top:28px">Arenas salvas</div>`;
   html+=arenas.map(({r,t})=>{
     const bn=t.batalha_num||1;
     const rid=r.rpg_id.replace(/'/g,"\\'");
     return `<div class="rpg-card" onclick="entrarArenaFromHub('${rid}')" style="--card-accent:#e8604c;background:rgba(24,8,8,0.7);border-color:rgba(232,80,60,0.2)">
       <div class="rpg-card-header">
         <div class="rpg-card-icon" style="background:rgba(232,80,60,0.08);border:1px solid rgba(232,80,60,0.2)">
           <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
             <path d="M14 3 L25 9 L25 19 L14 25 L3 19 L3 9 Z" stroke="#e8604c" stroke-width="1.2" fill="none"/>
             <path d="M9 14 L19 14 M14 9 L14 19" stroke="#e8604c" stroke-width="1.5"/>
           </svg>
         </div>
         <div>
           <div class="rpg-card-name" style="color:#e8604c">${r.name}</div>
           <div style="font-size:0.7rem;color:rgba(232,80,60,0.5);font-family:'Cinzel',serif;text-transform:uppercase;letter-spacing:0.08em">Arena · Batalha #${bn}</div>
         </div>
       </div>
       <div class="rpg-card-arrow" style="color:rgba(232,80,60,0.3)">→</div>
     </div>`;
   }).join('');
 }

 list.innerHTML=html;
}

async function entrarArenaFromHub(rpgId){
 // Abre o hub de arena e entra direto na sessão
 document.getElementById('hub').style.display='none';
 document.getElementById('arena-hub').style.display='block';
 await carregarArenaList();
 await entrarArena(rpgId);
}
