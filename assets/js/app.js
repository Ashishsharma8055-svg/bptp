// >>> Set your GAS Web App /exec URL here
export const GAS_BASE_URL = "https://script.google.com/macros/s/AKfycbwdiyMjFIoAy9-wIGrUCfsPftrUg8l8Zw1PPh_5xW4ffgVEGkNOaERXvmQNygku-CW2/exec";

function assertConfigured(){
  if(!GAS_BASE_URL || GAS_BASE_URL.includes("YOUR_DEPLOYMENT_ID")){
    throw new Error("GAS_BASE_URL not set. Edit assets/js/app.js");
  }
}

export async function apiGet(params = {}) {
  assertConfigured();
  const qs = new URLSearchParams(params).toString();
  const url = `${GAS_BASE_URL}?${qs}`;
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  try {
    if (!res.ok) throw new Error(`GET ${res.status} ${text}`);
    return JSON.parse(text);
  } catch (e) {
    console.error("GET error:", e, "Response:", text);
    throw e;
  }
}

// ✅ changed to text/plain to avoid CORS preflight
export async function apiPost(action, body = {}) {
  assertConfigured();
  const url = `${GAS_BASE_URL}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try {
    if (!res.ok) throw new Error(`POST ${res.status} ${text}`);
    return JSON.parse(text);
  } catch (e) {
    console.error("POST error:", e, "Response:", text);
    throw e;
  }
}

export function toast(msg, ok = true) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: 99999,
    background: ok ? "#2ecc71" : "#ff6b6b", color: "#fff",
    padding: "10px 14px", borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,.35)", fontWeight: 700
  });
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

export function escapeHtml(s){ if(s==null) return ""; return (""+s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function qs(name){ return new URLSearchParams(location.search).get(name) || ""; }