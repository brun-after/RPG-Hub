// main.ts
// RPG Hub — Ponto de entrada do bundle (Vite).
// A ordem dos imports reproduz a ordem dos antigos <script> tags do index.html:
// os módulos dependem uns dos outros via globals expostos em window
// (rodapés "[migração-esm] accessors globais" em cada arquivo).

// Bibliotecas de terceiros (antes: CDN)
import './core/vendor';
import './core/pixi-lazy';

// Core
import './config';
import './state';
import './core/utils';
import './core/supabase';
import './core/optimistic-save';
import './core/realtime';
import './core/rtnet';
import './core/events';

// Chat + áudio
import './chat/chat';
import './systems/audio';

// Registry central de tipos de efeito de skill (consumido por combate/aventura)
import './systems/effect-registry';

// Combate
import './combat/combat';
import './combat/animations';
import './combat/battle-system';
import './combat/reactions';

// Mapas
import './maps/camera';
import './maps/fase-renderer';
import './maps/fase-generator';
import './maps/fase-tileset';
import './maps/maps';
import './maps/tactical';
import './maps/background';

// Auth, hub e sistemas
import './auth/auth';
import './hub/hub';
import './systems/lore';
import './characters/characters';
import './characters/fichas';
import './characters/skills';
import './characters/invocacoes';
import './characters/appearance';
import './systems/npcs';
import './hub/import';
import './systems/arena';
import './systems/inventory';
import './systems/aventura';
import './aventura/renderer-pixi';
import './aventura/fase-editor';
import './systems/avt-walk-presets';
import './systems/avt-menu';
import './systems/avt-inventario';
import './systems/avt-perf';
import './systems/catalog-packages';
import './systems/catalog';
import './systems/attribute-mapping';
import './systems/rest';
import './ui/confirm';
import './ui/tutorial';
import './systems/creative';
import './systems/pixi-studio-presets';
import './systems/pixi-studio';
import './systems/pixi-studio-avt';
import './systems/market';
import './ui/modals';
import './combat/anim-gsap-spine';
import './characters/anim-renderer';
import './characters/token';
import './characters/anim-generator';
import './init';

// Blocos que eram <script> inline no index.html (mesma ordem relativa)
import './ui/inline-patch-import';
import './ui/inline-tema';
import './ui/inline-mapa-ataque';
import './ui/inline-combate-log';
import './ui/inline-error-handler';
