// ui/confirm.ts
// RPG Hub — confirmação não-bloqueante: substitui window.confirm() nos fluxos
// de salvamento. confirm() nativo congela a thread inteira (inclusive o ticker
// do Pixi e qualquer animação) até o clique; este overlay devolve uma Promise
// e deixa o resto da UI viva. O DOM é criado sob demanda no primeiro uso.

let _confirmOverlay: HTMLElement | null = null;
let _confirmResolver: ((ok: boolean) => void) | null = null;

function _confirmarMontar(): HTMLElement {
  if (_confirmOverlay) return _confirmOverlay;
  const ov = document.createElement('div');
  ov.id = 'modal-confirmar-overlay';
  ov.style!.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1200;align-items:center;justify-content:center';
  ov.innerHTML = `
    <div style="background:var(--escuro);border:1px solid var(--borda);border-top:2px solid var(--primario);border-radius:16px;padding:24px 20px;width:calc(100% - 32px);max-width:420px">
      <div id="modal-confirmar-msg" style="font-size:0.92rem;color:var(--texto);line-height:1.5;margin-bottom:20px;white-space:pre-line"></div>
      <div style="display:flex;gap:10px">
        <button id="modal-confirmar-ok" class="btn-primario" style="flex:2;padding:10px;border-radius:8px;font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer;letter-spacing:0.06em"></button>
        <button id="modal-confirmar-cancelar" style="flex:1;padding:10px;background:none;border:1px solid var(--borda);border-radius:8px;color:var(--suave);font-family:var(--fonte-d);font-size:0.72rem;cursor:pointer"></button>
      </div>
    </div>`;
  ov.addEventListener('click', (e) => { if (e.target === ov) _confirmarFechar(false); });
  document.body.appendChild(ov);
  (ov.querySelector('#modal-confirmar-ok') as HTMLElement).onclick = () => _confirmarFechar(true);
  (ov.querySelector('#modal-confirmar-cancelar') as HTMLElement).onclick = () => _confirmarFechar(false);
  _confirmOverlay = ov;
  return ov;
}

function _confirmarFechar(ok: boolean) {
  if (_confirmOverlay) _confirmOverlay.style!.display = 'none';
  const r = _confirmResolver;
  _confirmResolver = null;
  if (r) r(ok);
}

function confirmarAsync(msg: string, opts?: { ok?: string; cancelar?: string }): Promise<boolean> {
  const ov = _confirmarMontar();
  // Confirmação já aberta: responde 'não' à anterior antes de reaproveitar
  if (_confirmResolver) _confirmarFechar(false);
  (ov.querySelector('#modal-confirmar-msg') as HTMLElement).textContent = msg;
  (ov.querySelector('#modal-confirmar-ok') as HTMLElement).textContent = opts?.ok || 'Confirmar';
  (ov.querySelector('#modal-confirmar-cancelar') as HTMLElement).textContent = opts?.cancelar || 'Cancelar';
  ov.style!.display = 'flex';
  return new Promise<boolean>((resolve) => { _confirmResolver = resolve; });
}

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "confirmarAsync", { configurable: true, writable: true, value: confirmarAsync });
