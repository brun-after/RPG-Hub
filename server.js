/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              RPG HUB - SERVIDOR LOCAL                       ║
 * ║  Substitui o Supabase quando offline / sem internet         ║
 * ║                                                              ║
 * ║  Como usar:                                                  ║
 * ║  1. npm install   (primeira vez)                             ║
 * ║  2. node server.js                                           ║
 * ║  3. Abra http://localhost:3000 no navegador                  ║
 * ║  4. Outros jogadores: http://SEU-IP:3000                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const express    = require('express');
const { WebSocketServer } = require('ws');
const http       = require('http');
const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'local_data');
const ASSETS_DIR = path.join(__dirname, 'local_assets');

// Garante que as pastas de dados existem
[DATA_DIR, ASSETS_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ──────────────────────────────────────────────
// BANCO DE DADOS LOCAL (JSON em memória + disco)
// ──────────────────────────────────────────────
const DB = {
  rpg_registry: [],
  characters:   [],
  skills:       [],
  lore:         [],
  attr_defs:    [],
  mapas:        [],
  batalhas:     [],
  criativos:    [],
  item_catalog: [],
  inventario:   [],
  players:      [],
};

// Carrega dados do disco na inicialização
function carregarDados() {
  const arquivo = path.join(DATA_DIR, 'db.json');
  if (fs.existsSync(arquivo)) {
    try {
      const raw = fs.readFileSync(arquivo, 'utf8');
      const salvo = JSON.parse(raw);
      Object.assign(DB, salvo);
      console.log('✓ Dados carregados do disco');
    } catch(e) {
      console.error('Erro ao carregar dados:', e.message);
    }
  }
}

// Salva dados no disco (debounced)
let _saveTimer = null;
function salvarDados() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(path.join(DATA_DIR, 'db.json'), JSON.stringify(DB, null, 2));
    } catch(e) {
      console.error('Erro ao salvar dados:', e.message);
    }
  }, 300);
}

// ──────────────────────────────────────────────
// IMPORTAR campanha exportada do Supabase
// ──────────────────────────────────────────────
function importarCampanha(dadosJson) {
  const d = typeof dadosJson === 'string' ? JSON.parse(dadosJson) : dadosJson;
  const tabelas = ['rpg_registry','characters','skills','lore','attr_defs','mapas','batalhas','criativos','item_catalog','inventario','players'];
  let importadas = 0;
  for (const tabela of tabelas) {
    if (d[tabela] && Array.isArray(d[tabela])) {
      // Merge: não duplica por id/rpg_id
      for (const rec of d[tabela]) {
        const idKey = tabela === 'rpg_registry' ? 'rpg_id' : 'id';
        const existeIdx = DB[tabela].findIndex(r => r[idKey] === rec[idKey]);
        if (existeIdx >= 0) DB[tabela][existeIdx] = rec;
        else DB[tabela].push(rec);
      }
      importadas++;
    }
  }
  salvarDados();
  return importadas;
}

// ──────────────────────────────────────────────
// FILTROS tipo PostgREST (subset básico)
// ──────────────────────────────────────────────
function aplicarFiltros(registros, queryString) {
  let res = [...registros];
  for (const [chave, valor] of Object.entries(queryString)) {
    if (['select','order','limit','offset','prefer'].includes(chave)) continue;
    
    // eq.valor
    const eqMatch = valor.match(/^eq\.(.+)$/);
    if (eqMatch) {
      const v = eqMatch[1];
      res = res.filter(r => String(r[chave] ?? '') === String(v));
      continue;
    }
    // neq.valor
    const neqMatch = valor.match(/^neq\.(.+)$/);
    if (neqMatch) {
      const v = neqMatch[1];
      res = res.filter(r => String(r[chave] ?? '') !== String(v));
      continue;
    }
    // in.(a,b,c)
    const inMatch = valor.match(/^in\.\((.+)\)$/);
    if (inMatch) {
      const vals = inMatch[1].split(',').map(v => v.trim());
      res = res.filter(r => vals.includes(String(r[chave] ?? '')));
      continue;
    }
    // is.null / is.true / is.false
    const isMatch = valor.match(/^is\.(.+)$/);
    if (isMatch) {
      const v = isMatch[1];
      if (v === 'null') res = res.filter(r => r[chave] === null || r[chave] === undefined);
      else if (v === 'true') res = res.filter(r => r[chave] === true);
      else if (v === 'false') res = res.filter(r => r[chave] === false);
      continue;
    }
  }

  // Ordenação
  if (queryString.order) {
    const [campo, dir] = queryString.order.split('.');
    res.sort((a, b) => {
      const av = a[campo] ?? '', bv = b[campo] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  // Limit / offset
  const offset = parseInt(queryString.offset) || 0;
  const limit  = parseInt(queryString.limit);
  if (!isNaN(limit)) res = res.slice(offset, offset + limit);
  else if (offset > 0) res = res.slice(offset);

  return res;
}

// Seleção de campos (select=campo1,campo2,...)
function aplicarSelect(registros, selectStr) {
  if (!selectStr || selectStr === '*') return registros;
  const campos = selectStr.split(',').map(s => s.trim().split(':')[0]);
  return registros.map(r => {
    const obj = {};
    for (const c of campos) { if (c in r) obj[c] = r[c]; }
    return obj;
  });
}

// ──────────────────────────────────────────────
// WEBSOCKET - Tempo Real local
// ──────────────────────────────────────────────
const clients = new Set();
let wss;

function broadcast(msg, excluir = null) {
  const txt = typeof msg === 'string' ? msg : JSON.stringify(msg);
  for (const c of clients) {
    if (c !== excluir && c.readyState === 1) {
      try { c.send(txt); } catch(e) {}
    }
  }
}

// Simula uma mensagem de change do Supabase Realtime
function broadcastChange(tabela, evento, registro, oldRecord = null) {
  const topic = `realtime:public:${tabela}:rpg_id=eq.${registro.rpg_id}`;
  const msg = {
    topic,
    event: evento, // INSERT, UPDATE, DELETE
    payload: {
      schema: 'public',
      table: tabela,
      commit_timestamp: new Date().toISOString(),
      eventType: evento,
      new: registro,
      old: oldRecord || {},
      record: registro,
      old_record: oldRecord || {},
    },
    ref: null,
  };
  broadcast(msg);
}

// ──────────────────────────────────────────────
// APP EXPRESS
// ──────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS para jogadores na rede local
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,apikey,Authorization,Prefer');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve arquivos estáticos (seu jogo)
app.use(express.static(__dirname));

// Serve assets locais (imagens, etc.)
app.use('/local-assets', express.static(ASSETS_DIR));

// ──────────────────────────────────────────────
// ROTA: Auth (bypass — login por nome)
// ──────────────────────────────────────────────
app.post('/auth/v1/token', (req, res) => {
  const { nickname, email } = req.body || {};
  const nome = nickname || email || 'Jogador';
  const fakeUser = {
    id: 'local-' + nome.toLowerCase().replace(/\s+/g,'-'),
    email: nome + '@local',
    nickname: nome,
  };
  // Garante que o player existe no DB
  const existeIdx = DB.players.findIndex(p => p.id === fakeUser.id);
  if (existeIdx < 0) {
    DB.players.push({ id: fakeUser.id, nickname: nome });
    salvarDados();
  }
  res.json({
    access_token:  'local-token-' + fakeUser.id,
    refresh_token: 'local-refresh-' + fakeUser.id,
    user: fakeUser,
    token_type: 'bearer',
    expires_in: 86400,
  });
});

app.get('/auth/v1/user', (req, res) => {
  const auth = req.headers.authorization || '';
  const userId = auth.replace('Bearer local-token-', '').replace('Bearer ', '');
  const player = DB.players.find(p => p.id === userId) || { id: userId, email: userId + '@local', nickname: userId };
  res.json(player);
});

app.post('/auth/v1/token_refresh', (req, res) => {
  res.json({ access_token: req.body.refresh_token?.replace('refresh', 'token'), expires_in: 86400 });
});

// ──────────────────────────────────────────────
// ROTA: players
// ──────────────────────────────────────────────
app.get('/rest/v1/players', (req, res) => {
  let registros = aplicarFiltros(DB.players, req.query);
  registros = aplicarSelect(registros, req.query.select);
  res.json(registros);
});

// ──────────────────────────────────────────────
// IMPORTAR campanha via POST
// ──────────────────────────────────────────────
app.post('/importar', (req, res) => {
  try {
    const n = importarCampanha(req.body);
    res.json({ ok: true, tabelas: n });
  } catch(e) {
    res.status(400).json({ erro: e.message });
  }
});

// Listar campanhas disponíveis localmente
app.get('/campanhas', (req, res) => {
  res.json(DB.rpg_registry.map(r => ({ rpg_id: r.rpg_id, name: r.name })));
});

// Upload de assets locais
app.post('/storage/v1/object/game-assets/:folder/:arquivo', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
  const folder = req.params.folder;
  const arquivo = req.params.arquivo;
  const dir = path.join(ASSETS_DIR, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, arquivo);
  fs.writeFileSync(filePath, req.body);
  const publicUrl = `http://${req.headers.host}/local-assets/${folder}/${arquivo}`;
  res.json({ Key: `${folder}/${arquivo}`, publicUrl });
});

app.get('/storage/v1/object/public/game-assets/*', (req, res) => {
  // Redireciona para /local-assets/
  const p = req.params[0];
  res.redirect('/local-assets/' + p);
});

// ──────────────────────────────────────────────
// CRUD GENÉRICO para todas as tabelas
// ──────────────────────────────────────────────
const TABELAS_VALIDAS = Object.keys(DB).filter(t => t !== 'players');

function getTabela(nome) {
  return DB[nome] || null;
}

app.get('/rest/v1/:tabela', (req, res) => {
  const tabela = getTabela(req.params.tabela);
  if (!tabela) return res.status(404).json({ error: 'tabela não encontrada' });
  
  let registros = aplicarFiltros(tabela, req.query);
  registros = aplicarSelect(registros, req.query.select);
  res.json(registros);
});

app.post('/rest/v1/:tabela', (req, res) => {
  const nomeTbl = req.params.tabela;
  const tabela = getTabela(nomeTbl);
  if (!tabela) return res.status(404).json({ error: 'tabela não encontrada' });

  const prefer = req.headers.prefer || '';
  const registros = Array.isArray(req.body) ? req.body : [req.body];
  const inseridos = [];
  
  for (const reg of registros) {
    if (!reg.id && nomeTbl !== 'rpg_registry') {
      reg.id = crypto.randomUUID();
    }
    if (!reg.created_at) reg.created_at = new Date().toISOString();
    reg.updated_at = new Date().toISOString();
    tabela.push(reg);
    inseridos.push(reg);
    broadcastChange(nomeTbl, 'INSERT', reg);
  }
  
  salvarDados();
  
  if (prefer.includes('return=representation')) return res.status(201).json(inseridos);
  res.status(201).json(inseridos);
});

app.patch('/rest/v1/:tabela', (req, res) => {
  const nomeTbl = req.params.tabela;
  const tabela = getTabela(nomeTbl);
  if (!tabela) return res.status(404).json({ error: 'tabela não encontrada' });

  const indices = [];
  // Encontra quais registros satisfazem os filtros
  const candidatos = aplicarFiltros(tabela, req.query);
  const atualizados = [];
  
  for (const cand of candidatos) {
    const idKey = nomeTbl === 'rpg_registry' ? 'rpg_id' : 'id';
    const idx = tabela.findIndex(r => r[idKey] === cand[idKey]);
    if (idx >= 0) {
      Object.assign(tabela[idx], req.body, { updated_at: new Date().toISOString() });
      atualizados.push(tabela[idx]);
      broadcastChange(nomeTbl, 'UPDATE', tabela[idx]);
    }
  }
  
  salvarDados();
  const prefer = req.headers.prefer || '';
  if (prefer.includes('return=representation')) return res.json(atualizados);
  res.status(204).end();
});

app.put('/rest/v1/:tabela', (req, res) => {
  // Trata como upsert
  const nomeTbl = req.params.tabela;
  const tabela = getTabela(nomeTbl);
  if (!tabela) return res.status(404).json({ error: 'tabela não encontrada' });

  const registros = Array.isArray(req.body) ? req.body : [req.body];
  const resultado = [];
  const idKey = nomeTbl === 'rpg_registry' ? 'rpg_id' : 'id';
  
  for (const reg of registros) {
    if (!reg.id && nomeTbl !== 'rpg_registry') reg.id = crypto.randomUUID();
    reg.updated_at = new Date().toISOString();
    const idx = tabela.findIndex(r => r[idKey] === reg[idKey]);
    if (idx >= 0) {
      tabela[idx] = { ...tabela[idx], ...reg };
      resultado.push(tabela[idx]);
      broadcastChange(nomeTbl, 'UPDATE', tabela[idx]);
    } else {
      if (!reg.created_at) reg.created_at = new Date().toISOString();
      tabela.push(reg);
      resultado.push(reg);
      broadcastChange(nomeTbl, 'INSERT', reg);
    }
  }
  
  salvarDados();
  res.json(resultado);
});

app.delete('/rest/v1/:tabela', (req, res) => {
  const nomeTbl = req.params.tabela;
  const tabela = getTabela(nomeTbl);
  if (!tabela) return res.status(404).json({ error: 'tabela não encontrada' });

  const candidatos = aplicarFiltros(tabela, req.query);
  const idKey = nomeTbl === 'rpg_registry' ? 'rpg_id' : 'id';
  
  for (const cand of candidatos) {
    const idx = tabela.findIndex(r => r[idKey] === cand[idKey]);
    if (idx >= 0) {
      const [removido] = tabela.splice(idx, 1);
      broadcastChange(nomeTbl, 'DELETE', removido);
    }
  }
  
  salvarDados();
  res.status(204).end();
});

// ──────────────────────────────────────────────
// PAINEL DE CONTROLE (página web de gerenciamento)
// ──────────────────────────────────────────────
app.get('/painel', (req, res) => {
  const ip = Object.values(require('os').networkInterfaces())
    .flat().filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address)[0] || 'localhost';
    
  res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>RPG Hub - Servidor Local</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; background: #0a0f1a; color: #c9d4e0; padding: 24px; min-height: 100vh; }
    h1 { color: #c8a84b; font-size: 1.4rem; margin-bottom: 8px; }
    .sub { color: #7a92aa; font-size: 0.85rem; margin-bottom: 28px; }
    .card { background: #131c2e; border: 1px solid #1e2d42; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
    .card h2 { color: #8ab4d4; font-size: 0.95rem; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
    .info { background: #0d1520; border-radius: 8px; padding: 12px 16px; font-family: monospace; font-size: 0.88rem; color: #5ee09a; }
    .url { font-size: 1.1rem; color: #f0cc6a; font-weight: bold; }
    button { background: #c8a84b; color: #0a0f1a; border: none; border-radius: 6px; padding: 10px 20px; font-size: 0.9rem; font-weight: bold; cursor: pointer; }
    button:hover { background: #e0b95a; }
    button.sec { background: transparent; color: #8ab4d4; border: 1px solid #8ab4d4; margin-left: 8px; }
    button.sec:hover { background: rgba(138,180,212,0.1); }
    input[type=file] { display: none; }
    label.upload { display: inline-block; background: #1e3a5f; color: #8ab4d4; border: 1px dashed #8ab4d4; border-radius: 6px; padding: 10px 20px; cursor: pointer; font-size: 0.9rem; }
    label.upload:hover { background: #1e4a7f; }
    #msg { margin-top: 12px; padding: 10px 14px; border-radius: 6px; display: none; font-size: 0.85rem; }
    .ok { background: rgba(94,224,154,0.1); color: #5ee09a; border: 1px solid rgba(94,224,154,0.3); }
    .err { background: rgba(231,76,60,0.1); color: #e74c3c; border: 1px solid rgba(231,76,60,0.3); }
    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .stat { background: #0d1520; border-radius: 8px; padding: 10px 14px; }
    .stat .n { font-size: 1.6rem; font-weight: bold; color: #c8a84b; }
    .stat .l { font-size: 0.75rem; color: #7a92aa; margin-top: 2px; }
    .clients { font-size: 0.9rem; color: #8ab4d4; }
    table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    th { text-align: left; padding: 6px 10px; color: #7a92aa; border-bottom: 1px solid #1e2d42; }
    td { padding: 6px 10px; border-bottom: 1px solid #0d1520; }
  </style>
</head>
<body>
  <h1>🐉 RPG Hub — Servidor Local</h1>
  <p class="sub">Modo offline ativo. Todos os dados são salvos no seu computador.</p>

  <div class="card">
    <h2>📡 Conexão</h2>
    <div class="info">
      <div>Seu computador: <span class="url">http://localhost:${PORT}</span></div>
      <div style="margin-top:8px">Outros jogadores (mesmo WiFi): <span class="url">http://${ip}:${PORT}</span></div>
    </div>
  </div>

  <div class="card">
    <h2>📊 Status</h2>
    <div class="stats" id="stats-grid"></div>
    <div style="margin-top:12px" class="clients" id="clients-info">Clientes conectados: —</div>
  </div>

  <div class="card">
    <h2>📥 Importar Campanha</h2>
    <p style="font-size:0.82rem;color:#7a92aa;margin-bottom:14px">
      Selecione o arquivo JSON exportado pela ferramenta de exportação.
    </p>
    <label class="upload" for="arquivo-import">📁 Selecionar arquivo JSON</label>
    <input type="file" id="arquivo-import" accept=".json" onchange="importar(this)">
    <div id="msg"></div>
  </div>

  <div class="card">
    <h2>📤 Exportar Backup</h2>
    <p style="font-size:0.82rem;color:#7a92aa;margin-bottom:14px">
      Baixa todos os dados locais em um arquivo JSON.
    </p>
    <button onclick="exportar()">⬇ Baixar backup local</button>
  </div>

  <div class="card">
    <h2>📋 Campanhas Locais</h2>
    <div id="campanhas-lista">Carregando...</div>
  </div>

  <script>
    async function atualizar() {
      // Stats
      const res = await fetch('/api/stats');
      const d = await res.json();
      const grid = document.getElementById('stats-grid');
      grid.innerHTML = Object.entries(d.tabelas).map(([k,v]) =>
        '<div class="stat"><div class="n">'+v+'</div><div class="l">'+k+'</div></div>'
      ).join('');
      document.getElementById('clients-info').textContent = 'Clientes WS conectados: ' + d.clientes;

      // Campanhas
      const cr = await fetch('/campanhas');
      const camps = await cr.json();
      const el = document.getElementById('campanhas-lista');
      if (!camps.length) { el.innerHTML = '<p style="color:#7a92aa;font-size:0.85rem">Nenhuma campanha importada ainda.</p>'; return; }
      el.innerHTML = '<table><tr><th>ID</th><th>Nome</th></tr>' +
        camps.map(c => '<tr><td style="color:#7a92aa;font-family:monospace">'+c.rpg_id+'</td><td>'+c.name+'</td></tr>').join('') +
        '</table>';
    }

    async function importar(input) {
      const file = input.files[0]; if (!file) return;
      const msg = document.getElementById('msg');
      msg.style.display='none';
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const res = await fetch('/importar', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
        const r = await res.json();
        if (r.ok) { msg.className='ok'; msg.textContent='✓ Campanha importada com sucesso! '+r.tabelas+' tabelas carregadas.'; }
        else { msg.className='err'; msg.textContent='Erro: '+r.erro; }
        msg.style.display='block';
        atualizar();
      } catch(e) {
        msg.className='err'; msg.textContent='Erro: '+e.message; msg.style.display='block';
      }
      input.value = '';
    }

    async function exportar() {
      const res = await fetch('/api/backup');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url; a.download='rpghub-backup-'+Date.now()+'.json'; a.click();
    }

    atualizar();
    setInterval(atualizar, 5000);
  </script>
</body>
</html>`);
});

// Stats da API
app.get('/api/stats', (req, res) => {
  const tabelas = {};
  for (const [k, v] of Object.entries(DB)) tabelas[k] = v.length;
  res.json({ tabelas, clientes: clients.size });
});

// Backup completo
app.get('/api/backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=rpghub-backup-${Date.now()}.json`);
  res.send(JSON.stringify(DB, null, 2));
});

// ──────────────────────────────────────────────
// INICIALIZAÇÃO
// ──────────────────────────────────────────────
carregarDados();

const server = http.createServer(app);

// WebSocket — substitui o Supabase Realtime
wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] Cliente conectado. Total: ${clients.size}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Phoenix join: confirma subscription
      if (msg.event === 'phx_join') {
        ws.send(JSON.stringify({
          topic: msg.topic,
          event: 'phx_reply',
          payload: { status: 'ok', response: {} },
          ref: msg.ref,
        }));
        return;
      }

      // Heartbeat
      if (msg.event === 'heartbeat') {
        ws.send(JSON.stringify({ topic: 'phoenix', event: 'phx_reply', payload: { status:'ok', response:{} }, ref: msg.ref }));
        return;
      }

      // Broadcast genérico (chat, movimentação, etc.)
      if (msg.event === 'broadcast') {
        // Reencaminha para todos os outros clientes
        broadcast({ ...msg }, ws);
        return;
      }
    } catch(e) {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Cliente desconectado. Total: ${clients.size}`);
  });

  ws.on('error', () => clients.delete(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ip = Object.values(os.networkInterfaces())
    .flat().filter(i => i.family === 'IPv4' && !i.internal)
    .map(i => i.address)[0] || 'localhost';
    
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          🐉 RPG HUB - SERVIDOR LOCAL ATIVO           ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Seu navegador:     http://localhost:${PORT}           ║`);
  console.log(`║  Outros jogadores:  http://${ip}:${PORT}        ║`);
  console.log(`║  Painel de controle: http://localhost:${PORT}/painel  ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
});
