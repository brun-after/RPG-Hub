# Arquitetura do RPG Hub

## Visão Geral

RPG Hub é um **Progressive Web App (PWA)** construído como **Single-Page Application (SPA)** sem frameworks ou etapa de build. Toda a lógica roda no navegador e se comunica com o Supabase (PostgreSQL + Auth + Realtime) como backend-as-a-service.

```
┌─────────────────────────────────────────────────┐
│                  NAVEGADOR                       │
│                                                 │
│  index.html  ──►  css/styles.css                │
│      │        └►  js/ (26 módulos)              │
│      │                │                         │
│      └── Service Worker (sw.js)                 │
│                       │                         │
│              Estado Global (state.js)            │
│                       │                         │
└───────────────────────┼─────────────────────────┘
                        │ HTTPS + WebSocket
              ┌─────────▼──────────┐
              │     SUPABASE       │
              │  ─ PostgreSQL DB   │
              │  ─ Auth (JWT)      │
              │  ─ Realtime WS     │
              │  ─ Storage         │
              └────────────────────┘
```

---

## Estrutura de Arquivos JS

O JavaScript está dividido em **26 arquivos** dentro de `js/`, organizados por domínio. Não existe build step, bundler ou npm — os arquivos são carregados diretamente no `index.html` em ordem de dependência.

```
js/
├── config.js                  # Credenciais e constantes globais
├── state.js                   # Variáveis de estado global da aplicação
├── init.js                    # Sinal de inicialização (carregado por último)
│
├── core/
│   ├── events.js              # Helpers de permissão e utilitários de batalha
│   ├── utils.js               # Ícones, animações CSS, configuração de dados
│   ├── supabase.js            # Cliente Supabase: leitura, escrita, upload
│   └── realtime.js            # WebSocket / sincronização em tempo real
│
├── auth/
│   └── auth.js                # Login, registro, recuperação de senha, sessão
│
├── chat/
│   └── chat.js                # Chat em tempo real via Supabase Broadcast
│
├── characters/
│   ├── characters.js          # Fichas de personagem, atributos, level up, XP
│   └── skills.js              # Habilidades: CRUD, builder de fórmulas, lore, novo mapa
│
├── combat/
│   ├── combat.js              # Sistema de combate: iniciativa, turnos, dano, críticos, empurrar
│   └── animations.js          # Animações de combate no Canvas 2D + handlers de broadcast
│
├── maps/
│   ├── camera.js              # Efeitos visuais, zonas, tokens mortos, inicialização
│   └── maps.js                # Renderização de mapas, tokens, movimento, combate tático completo
│
├── systems/
│   ├── inventory.js           # Inventário, equipamentos, itens, wizard de campanha
│   ├── lore.js                # Lore: renderização, filtros, CRUD de entradas
│   ├── npcs.js                # Geração e posicionamento de NPCs genéricos
│   ├── creative.js            # Ações criativas, tutorial, fluxo de ataque da arena
│   ├── catalog.js             # Editor canvas de mapa, APMOD, mapeamento de atributos, catálogo
│   ├── arena.js               # Modo Arena (PvP/PvE): estado, navegação, combate
│   └── rest.js                # ★ NOVO — Sistema de Descanso Curto e Longo
│
├── hub/
│   ├── hub.js                 # Hub de campanhas: lista, mesa 3 colunas, iniciarApp()
│   └── import.js              # Importação de campanhas, geração por IA, tabs, toasts
│
└── ui/
    ├── modals.js              # Mercado secreto, painel de sessão
    └── tabs.js                # Paredes, portas, chaves, baús: lógica de colisão e interação
```

---

## Ordem de Carregamento no `index.html`

Os arquivos são carregados em ordem de dependência. Não altere essa ordem sem motivo:

```html
<script src="js/config.js"></script>       <!-- 1. Constantes e event bus -->
<script src="js/state.js"></script>         <!-- 2. Estado global -->
<script src="js/core/utils.js"></script>    <!-- 3. Utilitários base -->
<script src="js/core/supabase.js"></script> <!-- 4. API do banco -->
<script src="js/core/realtime.js"></script> <!-- 5. WebSocket -->
<script src="js/core/events.js"></script>   <!-- 6. Helpers de permissão -->
<script src="js/chat/chat.js"></script>     <!-- 7. Chat -->
<script src="js/combat/combat.js"></script> <!-- 8. Combate -->
<script src="js/combat/animations.js"></script>
<script src="js/maps/camera.js"></script>   <!-- 9. Mapa -->
<script src="js/maps/maps.js"></script>
<script src="js/auth/auth.js"></script>     <!-- 10. Autenticação -->
<script src="js/hub/hub.js"></script>       <!-- 11. Hub -->
<script src="js/systems/lore.js"></script>  <!-- 12. Sistemas -->
<script src="js/characters/characters.js"></script>
<script src="js/characters/skills.js"></script>
<script src="js/systems/npcs.js"></script>
<script src="js/hub/import.js"></script>
<script src="js/systems/arena.js"></script>
<script src="js/systems/inventory.js"></script>
<script src="js/systems/rest.js"></script>  <!-- ★ NOVO: após inventory, antes de creative -->
<script src="js/systems/creative.js"></script>
<script src="js/systems/catalog.js"></script>
<script src="js/ui/modals.js"></script>     <!-- 13. UI -->
<script src="js/ui/tabs.js"></script>
<script src="js/init.js"></script>          <!-- 14. Inicialização -->
```

---

## Estrutura de Telas (Screens)

O app gerencia a visibilidade de "telas" via display CSS, sem roteamento de URL:

```
tela-auth        →  Login / Cadastro
     ↓
hub              →  Lista de campanhas do usuário
     ↓
app              →  Interface principal da campanha
     ↓
arena-hub        →  Hub do modo Arena
arena-session    →  Sessão ativa de Arena
```

Telas auxiliares:
- `import-screen` — Importar campanha via CSV/JSON
- `criar-screen` — Wizard de criação de campanha
- `loading` — Overlay de carregamento animado
- `tutorial-overlay` — Tutorial de boas-vindas

---

## Sistema de Abas (Tabs)

Dentro de `#app`, o conteúdo é organizado em abas controladas por `abrirAba(id, btn)` (em `import.js`):

| Aba | ID | Conteúdo |
|---|---|---|
| Lore | `tab-lore` | Histórico e lore da campanha |
| Personagem | `tab-personagem` | Ficha, status e edição |
| Atributos | `tab-atributos` | Grupos e valores de atributos |
| Dados | `tab-dados` | Rolagem de dados |
| Mesa | `tab-mapas` | Mapa de batalha tático |
| Tabelas | `tab-tabelas` | Tabelas de referência |
| Config | `tab-config` | Configurações da campanha |

> **Atenção:** A aba Mesa (`tab-mapas`) usa layout de 3 colunas em telas largas via classe `mesa-ativo`. Essa classe só aplica `display:grid` quando combinada com `.active` — sem isso o mapa apareceria em todas as abas.

---

## Sistema de Mapas

### render_data (jsonb no banco)
Cada mapa tem uma coluna `render_data` no banco com a seguinte estrutura:

```javascript
{
  paredes: [
    { id, tipo: 'h'|'v', col, row, cor, largura }
  ],
  portas: [
    { id, col, row, nome, aberta, trancada, chave_palavra,
      mapa_destino, destino_col, destino_row, cor, icone }
  ],
  objetos: [
    // Objetos de cenário
    { id, tipo: 'obstaculo'|'bau'|'chave', col, row, nome, icone,
      aberto, coletada, loot_tipo, ... },
    // ★ NOVO — Superfícies de Terreno
    { id, tipo: 'superficie', col, row, efeito: 'fogo'|'gelo'|'oleo'|'agua'|'venenoso',
      valor: '1d6', tipo_dano: 'fogo', turnos: 3 }
  ]
}
```

### Superfícies de Terreno ★ NOVO
Novo tipo de objeto no `render_data.objetos`. Ao entrar na célula durante o jogo:
- `fogo` — aplica DOT (queimando, 1d6/turno por 2 turnos)
- `gelo` — aplica debuff de movimento (1 turno sem mover)
- `venenoso` — aplica DOT veneno (1d4/turno por 3 turnos)
- `oleo` / `agua` — reservados para efeitos futuros

Render visual: overlay colorido semitransparente sobre a célula (`superficieRenderizar` em `maps.js`).  
Lógica de efeito: `superficieVerificarEntrada` em `maps.js`, chamado no movimento por seta e na chegada via portal.

### Criação de paredes (editor canvas)
- Acessado pela aba `🎨 Pintar` no modal de criar/editar mapa
- Ferramentas 🧱 🚪 📦 integradas na mesma toolbar do pincel e formas
- O `render_data` é salvo no banco ao clicar "✓ Concluir"
- Paredes existentes são carregadas automaticamente ao reabrir o editor

### Colisão e interação (jogo ao vivo)
- `paredeBloqueiaMovimento()` em `tabs.js` — verifica paredes durante movimento de token
- `usarPorta()` em `tabs.js` — toggle aberta/fechada, verifica tranca, teletransporta entre mapas
- Botões contextuais aparecem automaticamente quando personagem está adjacente a porta/chave/baú

### Fog of war
Completamente desativado. As funções `fogRenderizar`, `fogInicializar` etc. existem no código de `maps.js` mas retornam imediatamente sem desenhar nada. O canvas `#fog-canvas` é removido sempre que um mapa é carregado.

> **Nota:** A função `fogRevealAround` foi preparada para Linha de Visão — integra `losVerificar()` antes de revelar cada célula. Assim que o fog for reativado, o LoS entrará em funcionamento automaticamente.

---

## Sistema de Combate Tático

### Fases da Batalha
```
posicionamento  →  iniciativa  →  combate  →  (encerrada)
```

| Fase | Descrição |
|---|---|
| `posicionamento` | ★ NOVA — jogadores se movem livremente antes de rolar iniciativa. Mestre confirma via botão. |
| `iniciativa` | Jogadores rolam d20; quando todos rolaram, avança para combate |
| `combate` | Turnos em ordem; cada personagem tem ação + movimento |
| `encerrada` | Batalha finalizada, tela de vitória exibida |

### Estado da Batalha (`bs` / `MAPA_STATE.batalhas[id]`)
```javascript
{
  ativa: true,
  fase: 'combate',           // 'posicionamento' | 'iniciativa' | 'combate'
  turnoRound: 3,
  ordemAtual: 1,
  participantes: [...],
  movimentoRestante: {},
  acaoRestante: {},
  cooldowns: {},
  reacoes: {},               // ★ NOVO — false = reação usada neste round
  pausada: false,
  mapa_id: 'map_001',
  stats: {}
}
```

### Estado de Personagem — campos relevantes para combate
```javascript
// Em c.custom_attrs:
{
  morto:        true,           // Personagem eliminado definitivamente
  moribundo:    true,           // ★ NOVO — HP=0, salvaguardas ativas
  estabilizado: true,           // ★ NOVO — estabilizou (não rola mais salvaguardas)
  salvaguardas: {               // ★ NOVO — contadores de d20 por round
    sucessos: 1,
    falhas:   2
  }
}
```

### HUD de Turno ★ NOVO
Elemento fixo no bottom da tela (`#hud-turno`), visível apenas quando for a vez do jogador (ou sempre para o mestre). Contém nome do personagem e botão "Encerrar Turno". Atualizado via `HUB_EVENTS.on('turno_avancou')`.

### Highlight de Células ★ NOVO
Overlay SVG sobre `#mapa-tokens`, ativado ao clicar num token durante combate:
- **Azul** — células alcançáveis pelo movimento restante (BFS, respeita paredes)
- **Vermelho** — células com inimigos dentro do alcance de ataque

### Salvaguardas de Morte ★ NOVO
Rola automaticamente para cada personagem moribundo no início de cada round (`batalhaPassarVez`):
- **d20 = 20** → acorda com 1 HP
- **d20 ≥ 10** → sucesso (2 = estabiliza)
- **d20 < 10** → falha (3 = morte)

### Ataques de Oportunidade ★ NOVO
Ativados quando um NPC sai de célula adjacente a um jogador durante o movimento (`verificarAtaqueOportunidade`). Consome a reação do round (`bs.reacoes[nome] = false`). Reações resetam no início de cada round.

### Empurrar ★ NOVO
`acaoEmpurrar(atacante, alvo, batalhaId)` em `combat.js`:
1. Rola Força vs Força (d20 + atributo)
2. Se vencer: desloca alvo 2 células na direção oposta
3. Se bater em parede: aplica dano de impacto (1d6)

### Sistema de Descanso ★ NOVO
Botões **⏱ Curto** e **☀ Longo** no painel do mestre. Chama `descansoGrupo(tipo)` em `rest.js`:

| Tipo | Efeito |
|---|---|
| Curto | +50% HP (configurável), reseta cooldowns `tipo_recarga: 'descanso_curto'` |
| Longo | HP máximo, todos os cooldowns, recursos ao máximo, limpa moribundo/estabilizado |

---

## Modais

O app usa múltiplos modais sobrepostos, todos controlados por funções `abrirModal*()`/`fecharModal*()`:

**Personagem**
- `modal-novo-char-overlay` — Criar novo personagem/NPC
- `modal-level-up-overlay` — Level up de personagem

**Batalha**
- Modal de combate inline — ataques, dano, turnos
- `#btn-confirmar-posicionamento-wrap` ★ NOVO — botão verde visível na fase `posicionamento`

**Mapa**
- `modal-novo-mapa-overlay` — Criar novo mapa (inclui aba `🎨 Pintar` com editor canvas + ferramentas de cenário)
- `modal-mapa-config-overlay` — Configurar mapa existente
- `modal-cena-overlay` — Editor de cena legado (mantido para compatibilidade)

**Habilidades / Inventário**
- `modal-skill-overlay` — Adicionar/editar habilidade
- Modal de inventário — detalhes, uso e descarte de itens

**Mercado / Sessão**
- `modal-mercado-overlay` — Mercado secreto de itens
- `modal-sessao-overlay` — Painel de controle do mestre

---

## Fluxo de Autenticação

```
1. App carrega → verifica sessão Supabase no localStorage
2. Sessão válida → carrega hub de campanhas
3. Sem sessão → exibe tela-auth
4. Login/Cadastro → hCaptcha → Supabase Auth
5. Sucesso → armazena SESSION → carrega hub
```

---

## Estado Global

O estado da aplicação é mantido em variáveis globais JavaScript declaradas em `js/state.js`, acessíveis em todos os módulos:

| Variável | Tipo | Descrição |
|---|---|---|
| `SESSION` | Object | Dados da sessão autenticada `{ access_token, user: { id, email } }` |
| `CURRENT_RPG` | Object | Metadados da campanha aberta (inclui `theme` mapeado de `theme_json`) |
| `RPG_DATA` | Object | Dados completos da campanha ativa (personagens, habilidades, mapas, etc.) |
| `HUB_DATA` | Object | Lista de campanhas do usuário `{ rpgs: [] }` |
| `BATALHA_ATUAL_ID` | String | ID da batalha ativa |
| `MAPA_ZOOM` | Object | Estado de zoom e pan do mapa |
| `MAPA_STATE` | Object | Estado do mapa: `mapaAtualId`, `toolMode`, `batalhas` |
| `CHAT` | Object | Mensagens, lista de online, contagem de não lidos, `_loreId` de cache |
| `HISTORICO` | Array | Histórico de rolagens de dados |
| `TIPOS_DADO` | Object | Configurações de tipos de dado disponíveis |
| `FOG_STATE` | Object | Estado do fog of war (desativado — mantido por compatibilidade) |

---

## Comunicação com Supabase

### REST API (CRUD)
Todas as operações de banco passam pela função genérica `sb()` em `js/core/supabase.js`:

```javascript
await sb('tabela?filtro=eq.valor', {
  method: 'PATCH',          // GET (default), POST, PATCH, DELETE
  body: JSON.stringify({}), // payload
  prefer: 'return=minimal', // header Prefer do Supabase
  headers: {}               // headers extras opcionais
});
```

> **Importante:** Nunca usar `encodeURIComponent()` em IDs inteiros nos filtros de path — causa falha silenciosa no Supabase REST.

Funções de alto nível disponíveis:

| Função | Descrição |
|---|---|
| `getAllRPGs()` | Lista todas as campanhas do usuário |
| `lerRPG(id)` | Carrega todos os dados de uma campanha |
| `importRPG(data)` | Cria campanha com dados importados |
| `updateRPGData(rpgId, section, data)` | Salva seção de dados na campanha |
| `deleteRPGData(id)` | Remove entrada do banco |
| `sbUpload(bucket, path, file)` | Upload de arquivos para o Storage |

### Realtime (WebSocket)
O app mantém uma conexão WebSocket persistente para sincronização em tempo real, gerenciada por `js/core/realtime.js`:

**Eventos recebidos:**
- `chat_msg` / `chat_presence` — mensagens e presença no chat
- `anim_ataque` — animações de combate
- `token_move` — movimentação de tokens no mapa
- `combate_evento` — eventos de batalha (inclui os novos abaixo)
- `porta_transicao` — teletransporte de personagem entre mapas

**Eventos de batalha novos (Vol II v2.1):**
- `personagem_caiu` — jogador entrou em estado moribundo
- `personagem_estabilizou` — personagem estabilizou ou acordou
- `fase_mudou` — batalha avançou de fase (ex: posicionamento → iniciativa)
- `empurrao_executado` — token foi empurrado para nova célula
- `ataque_oportunidade` — ataque fora de turno disparado

**Envio:**
```javascript
combateBroadcast('personagem_caiu', { nome: nomeAlvo });
realtimeBroadcast('porta_transicao', { charNome, mapa_destino, destino_col, destino_row });
```

### View necessária no banco
A view `players_with_email` deve existir para busca de jogadores por e-mail:
```sql
CREATE OR REPLACE VIEW public.players_with_email AS
SELECT p.id, p.nickname, p.nome_real, u.email
FROM public.players p JOIN auth.users u ON p.id = u.id;
```

---

## Sistema de Permissões (Papéis)

| Papel | Permissões |
|---|---|
| `mestre` | Controle total: criar, editar, deletar, aprovar ações; confirmar posicionamento; acionar descanso |
| `jogador` | Editar próprio personagem, enviar ações criativas, ver HUD de turno |

O papel é verificado via `temPermissao(acao)` (em `js/core/events.js`) antes de qualquer operação privilegiada. Elementos com `data-mestre-only` no HTML são controlados via JS.

---

## Comunicação entre Módulos

Como não há bundler, os módulos se comunicam por dois mecanismos:

- **Variáveis globais** declaradas em `state.js` — acessíveis diretamente por todos os arquivos
- **Event bus `HUB_EVENTS`** declarado em `config.js` — pub/sub para notificações entre módulos sem acoplamento direto

**Eventos do HUB_EVENTS:**

| Evento | Emitido por | Ouvido por |
|---|---|---|
| `turno_avancou` | `maps.js` (`_notificarVez`) | `maps.js` (reset movimento + HUD + highlight) |
| `token_moveu` | `maps.js` | `maps.js` (fog reveal) |
| `zona_ativada` | `maps.js` | `maps.js` (narração) |
| `dano_aplicado` | `maps.js` | `maps.js` (re-render) |
| `item_usado` | `maps.js` | `maps.js` (log) |
| `cena_carregada` | `maps.js` | — |

---

## PWA e Service Worker

O `sw.js` é minimalista — registra o Service Worker apenas para habilitar a instalação como PWA. Não implementa cache offline pois o app depende de dados em tempo real do Supabase.

```javascript
// sw.js — sem cache proposital
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
```

---

## Convenções de Código

- **Linguagem**: Todo o código e comentários estão em **português brasileiro**
- **Nomenclatura**: camelCase para funções e variáveis, SCREAMING_SNAKE_CASE para constantes globais
- **IDs HTML**: kebab-case (ex: `modal-novo-mapa-overlay`, `tab-mapas`)
- **CSS**: Variáveis customizadas com prefixo `--` (ex: `--primario`, `--destaque`)
- **Funções de UI**: Prefixo descritivo — `abrir*()`, `fechar*()`, `render*()`, `atualizar*()`
- **Funções de dados**: Verbos diretos — `salvar*()`, `deletar*()`, `buscar*()`
- **Sem build step**: edite o arquivo, salve, recarregue o browser — pronto
