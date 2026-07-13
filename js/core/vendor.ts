// core/vendor.js
// RPG Hub — Bibliotecas de terceiros via bundle (antes: tags de CDN no index.html).
// Expõe no window os mesmos globais que os builds UMD criavam.
import { gsap } from 'gsap';
import { Howl, Howler } from 'howler';

Object.assign(window, { gsap, Howl, Howler });
