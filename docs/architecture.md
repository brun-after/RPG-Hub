# Arquitetura do RPG Hub

## Visão Geral

RPG Hub é um **Progressive Web App (PWA)** construído como **Single-Page Application (SPA)** sem frameworks ou etapa de build. Toda a lógica roda no navegador e se comunica com o Supabase (PostgreSQL + Auth + Realtime) como backend-as-a-service.

```
┌─────────────────────────────────────────────────┐
│                  NAVEGADOR                       │
│                                                 │
│  index.html  ──►  css/styles.css                │
│      │        └►  js/app.js                     │
│      │                │                         │
│      └── Service Worker (sw.js)                 │
│                       │                         │
│              Estado Global (JS)                  │
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
| Mesa | `tab-mesa` | Mapa de batalha |
| Dados | `tab-dados` | Rolagem de dados |
| Tabelas | `tab-tabelas` | Tabelas de referência |
| Catálogo | `tab-catalogo` | Catálogo de itens/NPCs |

---

## Modais

O app usa ~30 modais sobrepostos, todos controlados por funções `abrirModal*()`/`fecharModal*()`:

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

**Habilidades / Inventário**
- `modal-nova-habilidade` — Adicionar/editar habilidade
- `modal-item-detalhe` — Detalhes de item no inventário

**NPCs / Arena**
- `modal-criar-arena` — Criar sessão de Arena
- `modal-npc-generator` — Gerador de NPC

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

O estado da aplicação é mantido em variáveis globais JavaScript no `js/app.js`:

| Variável | Tipo | Descrição |
|---|---|---|
| `SESSION` | Object | Dados da sessão autenticada (usuário, perfil) |
| `RPG_DATA` | Object | Dados completos da campanha ativa |
| `RPG_REGISTRY` | Object | Metadados da campanha (tema, config) |
| `CHARACTERS` | Array | Lista de personagens da campanha |
| `BATALHA_ATUAL_ID` | String | ID da batalha ativa |
| `BATALHA_ATUAL` | Object | Dados da batalha em andamento |
| `MAPAS` | Array | Mapas disponíveis na campanha |
| `SKILLS` | Array | Habilidades dos personagens |
| `LORE` | Array | Entradas de lore da campanha |
| `CRIATIVOS` | Array | Ações criativas pendentes de aprovação |
| `ATTR_DEFS` | Array | Definições de atributos customizados |
| `ATRIBUTOS_GRUPOS` | Object | Mapeamento de grupos de atributos |
| `RPG_MEMBERS` | Array | Membros da campanha com papéis |

---

## Comunicação com Supabase

### REST API (CRUD)
Todas as operações de banco seguem o padrão:
```javascript
const res = await fetch(`${SUPABASE_URL}/rest/v1/tabela`, {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SESSION.access_token}`,
    'Content-Type': 'application/json'
  }
});
```

### Realtime (WebSocket)
O app mantém uma conexão WebSocket persistente para sincronização em tempo real:
```
Supabase Realtime Channel → broadcast → chatReceberMensagem()
                                      → atualizarPresenca()
                                      → sincronizarDados()
```

### Retry Logic
Chamadas à API implementam retry com backoff exponencial para resiliência a falhas de rede.

---

## Sistema de Permissões (Papéis)

| Papel | Permissões |
|---|---|
| `mestre` | Controle total: criar, editar, deletar, aprovar ações |
| `jogador` | Editar próprio personagem, enviar ações criativas |
| `espectador` | Somente leitura |

O papel é verificado via `isMestre()` antes de qualquer operação privilegiada.

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
