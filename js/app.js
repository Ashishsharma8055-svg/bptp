function fmtNumber(n){
  try{ const v = Math.round(Number(n)||0); return new Intl.NumberFormat('en-IN').format(v);}catch(e){return String(Math.round(Number(n)||0));}}

export const GAS_URL = 'https://script.google.com/macros/s/AKfycbx_oIDtBJLI7xRovGss3Nnq-syCIk9zcnPbGkDe__FgLEe-j1oqL23j2EegGjUzGlTT/exec';

export async function apiGet(endpoint){
  try{
    const url = new URL(GAS_URL);
    if(endpoint==='projects') url.searchParams.set('endpoint','projects');
    if(endpoint==='inventory') url.searchParams.set('endpoint','inventory');
    if(endpoint.startsWith('project&id=')){ const id = endpoint.split('=')[1]; url.searchParams.set('endpoint','project'); url.searchParams.set('id', id); }
    const res = await fetch(url.toString());
    if(!res.ok) throw new Error('fetch failed');
    return await res.json();
  }catch(e){ console.error('apiGet error',e); return null; }
}

export async function apiPost(payload){
  try{
    const res = await fetch(GAS_URL, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    return await res.json();
  }catch(e){ console.error('apiPost error', e); return null; }
}

export function qs(s, ctx=document){ return ctx.querySelector(s); }

/* Global loader functions - pages should use window.showLoader(msg, sub) and window.hideLoader() */
(function(){
  let loaderEl = null;
  function create(){
    loaderEl = document.createElement('div');
    loaderEl.id = '__global_loader';
    loaderEl.innerHTML = `
      <div class="gr-backdrop" role="status" aria-live="polite">
        <div class="gr-card __glass-3d">
          <div class="gr-dots"><span></span><span></span><span></span></div>
          <div class="gr-texts"><div id="loaderText">Loading...</div><div id="loaderSub"></div></div>
        </div>
      </div>`;
    document.body.appendChild(loaderEl);
  }
  window.showLoader = function(msg, sub){
    if(!loaderEl) create();
    const t = loaderEl.querySelector('#loaderText');
    const s = loaderEl.querySelector('#loaderSub');
    if(t) t.textContent = msg || 'Loading...';
    if(s) s.textContent = sub || '';
    loaderEl.style.display = 'flex';
  };
  window.hideLoader = function(){
    if(!loaderEl) return;
    loaderEl.style.display = 'none';
  };
})();
