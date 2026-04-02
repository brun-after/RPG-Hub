# Arquitetura do RPG Hub

## Visão Geral

RPG Hub é um **Progressive Web App (PWA)** construído como **Single-Page Application (SPA)** sem frameworks ou etapa de build. Toda a lógica roda no navegador e se comunica com o Supabase (PostgreSQL + Auth + Realtime) como backend-as-a-service.

```
┌─────────────────────────────────────────────────┐
│                  NAVEGADOR                       │
│                                                 │
│  index.html  ──►  css/styles.css                │
│      │        └►  js/ (25 módulos)              │
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

O JavaScript está dividido em **25 arquivos** dentro de `js/`, organizados por domínio. Não existe build step, bundler ou npm — os arquivos são carregados diretamente no `index.html` em ordem de dependência.

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
│   ├── combat.js              # Sistema de combate: iniciativa, turnos, dano, críticos
│   └── animations.js          # Animações de combate no Canvas 2D
│
├── maps/
│   ├── camera.js              # Efeitos visuais, zonas, tokens mortos, inicialização
│   └── maps.js                # Editor de mapas, fog of war, tokens, movimento
│
├── systems/
│   ├── inventory.js           # Inventário, equipamentos, itens, wizard de campanha
│   ├── lore.js                # Lore: renderização, filtros, CRUD de entradas
│   ├── npcs.js                # Geração e posicionamento de NPCs genéricos
│   ├── creative.js            # Ações criativas, tutorial, fluxo de ataque da arena
│   ├── catalog.js             # Aparência (APMOD), mapeamento de atributos, catálogo
│   └── arena.js               # Modo Arena (PvP/PvE): estado, navegação, combate
│
├── hub/
│   ├── hub.js                 # Hub de campanhas: lista, mesa 3 colunas, iniciarApp()
│   └── import.js              # Importação de campanhas, geração por IA, tabs, toasts
│
└── ui/
    ├── modals.js              # Mercado secreto, painel de sessão, sistema de paredes
    └── tabs.js                # Editor de cena: paredes, portas, chaves, baús, obstáculos
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

Dentro de `#app`, o conteúdo é organizado em abas controladas por `mostrarAba(id)`:

| Aba | ID | Conteúdo |
|---|---|---|
| Personagem | `tab-personagem` | Ficha, status e edição |
| Atributos | `tab-atributos` | Grupos e valores de atributos |
| Habilidades | `tab-habilidades` | Skills e efeitos ativos |
| Inventário | `tab-inventario` | Slots de equipamento e bolsa |
| Lore | `tab-lore` | Histórico e lore da campanha |
| Mesa | `tab-mesa` | Mapa de batalha tático |
| Dados | `tab-dados` | Rolagem de dados |
| Tabelas | `tab-tabelas` | Tabelas de referência |
| Catálogo | `tab-catalogo` | Catálogo de itens/NPCs |

---

## Modais

O app usa múltiplos modais sobrepostos, todos controlados por funções `abrirModal*()`/`fecharModal*()`:

**Personagem**
- `modal-criar-personagem` — Criar novo personagem
- `modal-editar-personagem` — Editar personagem existente
- `modal-personagem-detalhes` — Ver detalhes completos

**Batalha**
- `modal-batalha` — Interface de batalha ativa (iniciativa, ataques, turnos)
- `modal-batalha-resultado` — Resultado de ataque/dano

**Mapa**
- `modal-criar-mapa` — Criar mapa (nome, tamanho, grid)
- `modal-editor-mapa` — Editor Canvas com ferramentas de desenho
- `modal-editor-cena` — Editor de cena: paredes, portas, chaves, baús, obstáculos

**Habilidades / Inventário**
- `modal-nova-habilidade` — Adicionar/editar habilidade
- `modal-item-detalhe` — Detalhes de item no inventário

**NPCs / Arena**
- `modal-criar-arena` — Criar sessão de Arena
- `modal-npc-generator` — Gerador de NPC

**Mercado / Sessão**
- `modal-mercado-secreto` — Mercado secreto de itens
- `modal-painel-sessao` — Painel de controle do mestre

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
| `CURRENT_RPG` | String | ID da campanha aberta |
| `RPG_DATA` | Object | Dados completos da campanha ativa (personagens, habilidades, mapas, etc.) |
| `RPG_REGISTRY` | Object | Metadados da campanha (tema, config) |
| `HUB_DATA` | Object | Lista de campanhas do usuário `{ rpgs: [] }` |
| `CHARACTERS` | Array | Lista de personagens da campanha |
| `BATALHA_ATUAL_ID` | String | ID da batalha ativa |
| `BATALHA_ATUAL` | Object | Dados da batalha em andamento |
| `MAPAS` | Array | Mapas disponíveis na campanha |
| `MAPA_ZOOM` | Number | Nível de zoom atual do mapa |
| `MAPA_STATE` | Object | Estado de pan/câmera do mapa |
| `SKILLS` | Array | Habilidades dos personagens |
| `LORE` | Array | Entradas de lore da campanha |
| `CRIATIVOS` | Array | Ações criativas pendentes de aprovação |
| `ATTR_DEFS` | Array | Definições de atributos customizados |
| `ATRIBUTOS_GRUPOS` | Object | Mapeamento de grupos de atributos |
| `RPG_MEMBERS` | Array | Membros da campanha com papéis |
| `CHAT` | Object | Mensagens, lista de online, contagem de não lidos |
| `HISTORICO` | Array | Histórico de rolagens de dados |
| `TIPOS_DADO` | Object | Configurações de tipos de dado disponíveis |
| `IMPORT_CSVS` | Object | Dados em processo de importação |

---

## Comunicação com Supabase

### REST API (CRUD)
Todas as operações de banco passam pela função genérica `sb()` em `js/core/supabase.js`:

```javascript
const res = await sb('GET' | 'POST' | 'PATCH' | 'DELETE', '/rest/v1/tabela', body);
```

Internamente, `sb()` injeta os headers de autenticação e implementa retry com backoff exponencial.

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
O app mantém uma conexão WebSocket persistente para sincronização em tempo real:

```
Supabase Realtime Channel → broadcast → chatReceberMensagem()
                                      → atualizarPresenca()
                                      → sincronizarDados()
```

Gerenciado por `js/core/realtime.js` via `iniciarRealtime(rpgId)` e `fecharRealtime()`.

---

## Sistema de Permissões (Papéis)

| Papel | Permissões |
|---|---|
| `mestre` | Controle total: criar, editar, deletar, aprovar ações |
| `jogador` | Editar próprio personagem, enviar ações criativas |
| `espectador` | Somente leitura |

O papel é verificado via `isMestre()` e `temPermissao(acao)` (em `js/core/events.js`) antes de qualquer operação privilegiada.

---

## Comunicação entre Módulos

Como não há bundler, os módulos se comunicam por dois mecanismos:

- **Variáveis globais** declaradas em `state.js` — acessíveis diretamente por todos os arquivos
- **Event bus `HUB_EVENTS`** declarado em `config.js` — pub/sub para notificações entre módulos sem acoplamento direto

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
- **IDs HTML**: kebab-case (ex: `modal-criar-personagem`, `tab-inventario`)
- **CSS**: Variáveis customizadas com prefixo `--` (ex: `--primario`, `--destaque`)
- **Funções de UI**: Prefixo descritivo — `abrir*()`, `fechar*()`, `render*()`, `atualizar*()`
- **Funções de dados**: Verbos diretos — `salvar*()`, `deletar*()`, `buscar*()`
- **Sem build step**: edite o arquivo, salve, recarregue o browser — pronto
