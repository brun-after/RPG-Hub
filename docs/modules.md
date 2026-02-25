# Documentação de Módulos — js/app.js

O arquivo `js/app.js` (~25.000 linhas) contém toda a lógica do RPG Hub organizada em seções funcionais.
Abaixo estão descritos os principais módulos, suas responsabilidades e as funções públicas mais importantes.

---

## Índice

1. [Configuração e Constantes](#1-configuração-e-constantes)
2. [Estado Global](#2-estado-global)
3. [Supabase — API e Storage](#3-supabase--api-e-storage)
4. [Realtime — WebSocket](#4-realtime--websocket)
5. [Autenticação](#5-autenticação)
6. [Hub de Campanhas](#6-hub-de-campanhas)
7. [Importação e Criação de Campanhas](#7-importação-e-criação-de-campanhas)
8. [Chat em Tempo Real](#8-chat-em-tempo-real)
9. [Personagens](#9-personagens)
10. [Atributos](#10-atributos)
11. [Habilidades (Skills)](#11-habilidades-skills)
12. [Inventário](#12-inventário)
13. [Sistema de Batalha](#13-sistema-de-batalha)
14. [Mapa de Batalha](#14-mapa-de-batalha)
15. [Editor de Mapa (Canvas)](#15-editor-de-mapa-canvas)
16. [Rolagem de Dados](#16-rolagem-de-dados)
17. [Lore](#17-lore)
18. [NPCs e Entidades](#18-npcs-e-entidades)
19. [Ações Criativas](#19-ações-criativas)
20. [Arena](#20-arena)
21. [Catálogo / Mercado](#21-catálogo--mercado)
22. [Utilitários e UI](#22-utilitários-e-ui)
23. [Animações e Ícones](#23-animações-e-ícones)
24. [Tutorial](#24-tutorial)

---

## 1. Configuração e Constantes

**Localização:** Início de `js/app.js` (linhas 1–14)

Variáveis de configuração que devem ser preenchidas antes do deploy:

```javascript
const SUPABASE_URL = '...';        // URL do projeto Supabase
const SUPABASE_KEY = '...';        // Chave anon do Supabase (pública)
const HCAPTCHA_SITEKEY = '...';    // Site Key do hCaptcha
const EMAIL_CONFIRMATION_ENABLED = true; // Ativar após DNS do Resend propagado
```

> **Nota:** A `SUPABASE_KEY` é a chave `anon` pública — segura para frontend. O acesso real é controlado pelas políticas RLS do Supabase.

---

## 2. Estado Global

**Localização:** linhas 16–45

Variáveis globais que armazenam o estado atual do app:

| Variável | Tipo | Descrição |
|---|---|---|
| `SESSION` | Object \| null | Sessão do usuário autenticado (`{access_token, user}`) |
| `RPG_DATA` | Object \| null | Todos os dados da campanha ativa |
| `CURRENT_RPG` | String \| null | ID da campanha ativa |
| `HUB_DATA` | Object | Lista de campanhas do hub |
| `CHAT` | Object | Estado do chat (mensagens, online, badge) |
| `MAPA_STATE` | Object | Estado do mapa atual (batalhas, tool mode, drag) |
| `MAPA_ZOOM` | Object | Zoom, pan e lock do mapa |
| `BATALHA_ATUAL_ID` | String \| null | ID da batalha sendo exibida |
| `CRIATIVOS_CAMP` | Array | Ações criativas da campanha |
| `HISTORICO` | Array | Histórico de rolagens de dados |

---

## 3. Supabase — API e Storage

**Localização:** linhas 328–736

### `sb(path, opts, _retry)` → `async`
Wrapper universal para chamadas à API REST do Supabase. Implementa retry automático com backoff exponencial em casos de timeout (`57014`).

```javascript
// Exemplos de uso
const data = await sb('characters?rpg_id=eq.abc&select=*');
await sb('characters', { method: 'POST', body: JSON.stringify({...}) });
await sb(`characters?id=eq.${id}`, { method: 'DELETE' });
```

### `uploadToStorage(file, folder)` → `async`
Faz upload de arquivo (imagem) para o Supabase Storage e retorna a URL pública.

### `getAllRPGs()` → `async`
Retorna todas as campanhas do usuário autenticado.

### `getRPGData(rpgId)` → `async`
Carrega todos os dados de uma campanha específica.

### `_carregarProgressivo(rpgId)` → `async`
Carrega dados da campanha em etapas paralelas (characters, skills, lore, mapas, etc.) exibindo progresso visual.

### `saveCharacterStats(rpgId, charName, stats)` → `async`
Salva estatísticas de um personagem no banco.

### `deleteRPGData(rpgId)` → `async`
Remove completamente uma campanha e todos seus dados associados.

---

## 4. Realtime — WebSocket

**Localização:** linhas 738–960

### `iniciarRealtime(rpgId)`
Abre a conexão WebSocket com o canal Supabase Realtime da campanha. Registra handlers para:
- Atualizações de dados (`refresh`)
- Mensagens de chat
- Presença de jogadores
- Animações de dados e batalha

### `fecharRealtime()`
Encerra a conexão WebSocket e limpa os intervalos de presença.

---

## 5. Autenticação

**Funções principais:**

| Função | Descrição |
|---|---|
| `authTab(tipo)` | Alterna entre abas "Entrar" e "Criar Conta" |
| `authSubmit()` | Processa login ou cadastro |
| `authLogout()` | Faz logout e limpa sessão |
| `verificarSessao()` | Verifica sessão salva no localStorage ao carregar o app |
| `onHcaptchaLoad()` | Callback de carregamento do widget hCaptcha |

---

## 6. Hub de Campanhas

**Funções principais:**

| Função | Descrição |
|---|---|
| `carregarHub()` | Carrega e renderiza a lista de campanhas do usuário |
| `renderizarHub()` | Renderiza os cards de campanha na tela |
| `abrirRPG(rpgId)` | Abre uma campanha e carrega seus dados |
| `voltarHub()` | Fecha a campanha atual e volta para o hub |
| `criarRPG()` | Inicia o wizard de criação de campanha |

---

## 7. Importação e Criação de Campanhas

**Localização:** linhas 533–736

### `importRPG(payload, mapasJSON)` → `async`
Importa uma campanha completa a partir de um payload JSON estruturado.
Insere personagens, habilidades, lore, mapas e configurações de forma atômica.

### `updateRPG(rpgId, payload)` → `async`
Atualiza dados de uma campanha existente (upsert completo).

### `buildLevelConfig(cfg)`
Constrói o objeto de configuração de níveis e progressão.

### `buildTheme(cfg)`
Constrói o objeto de tema visual da campanha (cores, ícones, SVGs customizados).

### `insertSection(rpgId, section, rows, levelConfig)` → `async`
Insere uma seção (personagens, skills, lore...) no banco durante a importação.

---

## 8. Chat em Tempo Real

**Localização:** linhas 1012–1326

### `chatIniciar(rpgId, wsRef)` → `async`
Inicializa o chat: carrega histórico do banco, configura listeners WebSocket e presença.

### `chatEnviar()`
Envia mensagem do campo de texto para o canal Realtime. Também persiste no banco periodicamente.

### `chatReceberMensagem(pkg)`
Handler de mensagem recebida via WebSocket. Renderiza nova mensagem e atualiza badge de não-lidos.

### `chatRenderizar()`
Re-renderiza todo o histórico de mensagens no DOM.

### `chatToggle()` / `chatAbrir()` / `chatOcultar()`
Controles de visibilidade do painel de chat.

### `chatSalvarLog()` → `async`
Persiste o histórico de chat no banco de dados (na tabela de lore).

---

## 9. Personagens

**Funções principais:**

| Função | Descrição |
|---|---|
| `renderizarPersonagem(nome)` | Renderiza a ficha completa de um personagem |
| `abrirModalCriarPersonagem()` | Abre modal para criar novo personagem |
| `abrirModalEditarPersonagem(nome)` | Abre modal para editar personagem existente |
| `salvarPersonagem()` | Persiste alterações do personagem no banco |
| `deletarPersonagem(nome)` | Remove personagem da campanha |
| `vincularPersonagem(nome)` | Vincula o usuário logado a um personagem |
| `buscarPersonagem(query)` | Filtra a lista de personagens por nome/atributo |
| `podeEditarPersonagem(nome)` | Verifica se o usuário tem permissão para editar |

---

## 10. Atributos

**Funções principais:**

| Função | Descrição |
|---|---|
| `renderizarAtributos()` | Renderiza grupos de atributos na aba |
| `editarAtributo(nome, grupo)` | Abre edição inline de um atributo |
| `salvarAtributo(nome, grupo, valor)` | Persiste novo valor de atributo |
| `abrirModalAtribuicaoAtributos()` | Modal para mapear atributos em grupos |
| `calcularHpMaxComAtributos(lc, attrs, hpMax)` | Calcula HP máximo considerando bônus de atributos |

---

## 11. Habilidades (Skills)

**Funções principais:**

| Função | Descrição |
|---|---|
| `renderizarHabilidades()` | Renderiza lista de habilidades do personagem |
| `abrirModalNovaHabilidade()` | Modal para criar/editar habilidade |
| `salvarHabilidade()` | Persiste habilidade no banco |
| `usarHabilidade(id)` | Usa uma habilidade (aplica efeito, consome uso) |
| `calcModAtributo(hab, atacante, ctx)` | Calcula bônus de atributo para uma habilidade |

**Sistema de Efeitos (`skToggle*()`):**
Funções de toggle para cada tipo de efeito de habilidade: DOT, HOT, Boost, Recarga, Movimento, Ataque, Debuff.

---

## 12. Inventário

**Localização:** linhas 16453+

### `renderizarInventario()`
Renderiza os slots de equipamento e a bolsa do personagem.

### `usarItem(id)` / `equiparItem(id)`
Usa ou equipa um item do inventário. Verifica requisitos e aplica efeitos.

### `adicionarItemInventario(item, charNome)` → `async`
Adiciona um item ao inventário do personagem. Gerencia stacks para consumíveis.

### `removerItemInventario(id)` → `async`
Remove um item do inventário.

### `calcularBonusEquipamentos(charNome)`
Calcula o total de bônus de atributos de todos os equipamentos do personagem.

---

## 13. Sistema de Batalha

**Localização:** linhas 1434 e ~2892+

### `abrirModalAtaque(atacanteNome, contexto)` → `async`
Abre o modal de configuração de ataque. Carrega habilidades disponíveis do atacante e define alvos possíveis.

### `atkConfirmarAtaque()` → `async`
Executa o ataque: rola os dados, aplica modificadores de atributo, detecta crítico/falha crítica, aplica dano.

### `batalhaAtacarVez()`
Processa o turno de ataque da entidade atual na iniciativa.

### `batalhaPassarVez()`
Passa o turno para a próxima entidade na ordem de iniciativa.

### `pausarOuRetomarBatalha()` → `async`
Pausa ou retoma uma batalha ativa. Sincroniza estado via Realtime.

### `parsearFormulaDano(formula)`
Parser de fórmulas de dados do tipo `"2d6+1d8+3"`, `"d20"`, etc.

### `rolarFormula(parsed)`
Executa uma fórmula de dados e retorna os resultados individuais e o total.

### `abrirModalCriticoMestre(alvos, ehPositivo, criticoTexto, contexto)`
Abre o modal do mestre para aplicar efeito de crítico: buff, debuff, dano, cura.

---

## 14. Mapa de Batalha

**Localização:** linhas 46–245 e 9278+

### `mapaZoomApply()`
Aplica zoom e pan ao elemento de imagem do mapa via CSS transform.

### `mapaZoomInit()`
Inicializa os eventos de zoom (scroll de mouse, pinch gesture mobile, botões de UI).

### `mapaToggleLock()`
Alterna o travamento do mapa (impede pan acidental).

### `mapaCharSizeAtivar(nome)` / `mapaCharSizeSlide(v)` / `mapaCharSizeConfirmar()`
HUD de ajuste de tamanho individual do token de um personagem no mapa.

### `mapaShowRangeCircle(atacanteNome, alcanceCelulas)`
Exibe um círculo visual de alcance de ataque centrado no token do personagem.

### `renderizarMapaTokens()`
Renderiza todos os tokens (personagens, NPCs) sobre o SVG do mapa.

### Drag de Token
Sistema de arrastar tokens no mapa com suporte a touch mobile e compensação de zoom:
- `mapaTokenDragStart(e, nome)`
- `mapaTokenDragMove(e)`
- `mapaTokenDragEnd(e)`

---

## 15. Editor de Mapa (Canvas)

**Localização:** linhas 8469+

Editor de mapa com ferramentas de desenho livre sobre canvas HTML5:

| Ferramenta | Descrição |
|---|---|
| `brush` | Pincel livre |
| `eraser` | Borracha |
| `fill` | Balde de tinta (flood fill) |
| `line` | Linha reta |
| `rect` | Retângulo |
| `circle` | Círculo/elipse |
| `eyedropper` | Conta-gotas (captura cor) |
| `terrain` | Pintura de terreno por tile |

**Funções principais:**
- `canvasEditorInit(contexto)` — Inicializa o editor
- `canvasEditorSalvar()` → `async` — Salva mapa como imagem no Supabase Storage
- `canvasFloodFill(x, y, cor)` — Algoritmo de flood fill no canvas
- `canvasDesenharGrade(tipo)` — Desenha grade quadrada ou isométrica

---

## 16. Rolagem de Dados

**Funções principais:**

| Função | Descrição |
|---|---|
| `rolarDado(tipo)` | Rola um dado do tipo especificado (d4, d6, d8, d10, d12, d20, d100) |
| `getDiceConfig(rpgId)` | Carrega configuração de dados do localStorage |
| `setDiceConfig(rpgId, arr)` | Salva configuração de dados no localStorage |
| `renderizarDados()` | Renderiza a aba de dados com histórico |
| `animarDado(resultado, critico)` | Anima o dado visualmente com SVG |

---

## 17. Lore

**Funções principais:**

| Função | Descrição |
|---|---|
| `renderizarLore()` | Renderiza lista de entradas de lore |
| `abrirModalNovaLore()` | Modal para criar/editar entrada de lore |
| `salvarLore()` | Persiste entrada de lore no banco |
| `deletarLore(id)` | Remove entrada de lore |
| `buscarLore(query)` | Filtra entradas de lore por texto |

---

## 18. NPCs e Entidades

**Funções principais:**

| Função | Descrição |
|---|---|
| `abrirModalNPCGenerator()` | Abre gerador de NPC com stats randomizados |
| `criarEntidadesBulk(lista)` | Cria múltiplas entidades de uma vez |
| `vincularEntidadeMapa(nomeEntidade, mapaId)` | Associa entidade a um mapa específico |
| `renderizarListaNPCs()` | Renderiza lista de NPCs/entidades da campanha |

---

## 19. Ações Criativas

Sistema para jogadores proporem ações fora do padrão, sujeitas à aprovação do mestre.

| Função | Descrição |
|---|---|
| `enviarAcaoCriativa(texto)` | Jogador envia proposta de ação criativa |
| `abrirModalCriativoMestre(id)` | Mestre abre modal para aprovar/rejeitar |
| `aprovarAcaoCriativa(id, dc)` | Mestre aprova com DC definido; joga dados |
| `rejeitarAcaoCriativa(id)` | Mestre rejeita a ação proposta |

---

## 20. Arena

**Localização:** linhas 13443+ e 18513+

Modo independente de batalha PvP/PvE com Beyonders, sem necessidade de campanha ativa.

| Função | Descrição |
|---|---|
| `abrirArenaHub()` | Abre o hub de arenas do usuário |
| `fecharArenaHub()` | Fecha o hub de arenas |
| `abrirModalCriarArena()` | Modal para criar nova sessão de arena |
| `arEntrarPorCodigo()` | Entrar em arena existente via código |
| `arIniciarSessao(id)` | Inicia ou retoma sessão de arena |
| `arAcaoAtacar(atacante, alvo)` | Executa ataque na arena |
| `arPassarTurno()` | Passa turno na arena |

---

## 21. Catálogo / Mercado

**Localização:** linhas 16554+

| Função | Descrição |
|---|---|
| `renderizarCatalogo()` | Renderiza catálogo de itens e NPCs |
| `renderizarMercado()` | Renderiza mercado de itens disponíveis |
| `comprarItem(itemId, charNome)` → `async` | Processa compra de item do mercado |
| `filtrarCatalogo(tipo)` | Filtra catálogo por tipo (arma, armadura, consumível...) |

---

## 22. Utilitários e UI

**Localização:** linhas 9451+

| Função | Descrição |
|---|---|
| `mostrarAba(id)` | Exibe a aba especificada, ocultando as demais |
| `mostrarLoading(msg, tipo)` | Exibe overlay de carregamento com mensagem |
| `esconderLoading()` | Oculta o overlay de carregamento |
| `mostrarToast(msg, tipo)` | Exibe toast notification temporária |
| `confirmarAcao(msg, fn)` | Dialog de confirmação antes de ação destrutiva |
| `formatarData(ts)` | Formata timestamp para exibição |
| `normalizeImgUrl(url)` | Normaliza URL de imagem do Supabase Storage |
| `isMestre()` | Retorna `true` se o usuário é mestre da campanha |
| `temPermissao(chave)` | Verifica permissão específica do usuário |
| `reflashDados()` → `async` | Recarrega dados da campanha do banco |

---

## 23. Animações e Ícones

**Localização:** linhas 265–323

| Função | Descrição |
|---|---|
| `injectCustomCSS(rpgId, css)` | Injeta CSS customizado de tema da campanha |
| `processCustomSVG(svg, color1, color2)` | Processa SVG customizado substituindo cores |
| `getCardIconSVG(tipo, c1, c2, customSVG)` | Retorna SVG de ícone de card de campanha |
| `getLoadingAnimSVG(tipo, customSVG)` | Retorna SVG para animação de loading |

---

## 24. Tutorial

**Localização:** linhas 18270+

Sistema de tutorial interativo para novos usuários:

| Função | Descrição |
|---|---|
| `tutorialIniciar()` | Inicia o tutorial de boas-vindas |
| `tutorialProximo()` | Avança para o próximo passo |
| `tutorialAnterior()` | Volta ao passo anterior |
| `tutorialFechar()` | Fecha o tutorial e marca como visto |
| `tutorialJaVisto(rpgId)` | Verifica se o tutorial já foi exibido |

---

## css/styles.css

Arquivo com todos os estilos do app (~725 linhas), organizados em:

| Seção | Conteúdo |
|---|---|
| Reset e Tipografia | `* { box-sizing }`, body, fontes |
| Variáveis CSS | `--primario`, `--destaque`, `--painel`, etc. |
| Hub | `.hub-header`, `.rpg-card`, `.hub-import-btn` |
| Import Screen | `.import-section`, `.btn-import-submit` |
| Loading | `#loading`, `.anim-flame`, `.anim-rune` |
| Animações | `@keyframes flamePulse`, `runeRotate`, `critPulse` |
| App Header | `header`, `.logo`, `.realtime-dot` |
| Abas | `.tab-bar`, `.tab-btn`, `.tab-content` |
| Modais | `.modal`, `.modal-header`, `.modal-body` |
| Formulários | `.form-group`, `input`, `select`, `button` |
| Arena | `#arena-hub`, `#arena-session`, `.ar-*` |
| Utilitários | `.toast`, `.badge`, `.btn-*` |
