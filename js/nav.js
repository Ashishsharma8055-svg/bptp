function fmtNumber(n) {
  try {
    const v = Math.round(Number(n) || 0);
    return new Intl.NumberFormat('en-IN').format(v);
  } catch (e) {
    return String(Math.round(Number(n) || 0));
  }
}

(function () {
  if (window.__modern_nav_injected) return;
  window.__modern_nav_injected = true;

  const nav = document.createElement('nav');
  nav.className = 'modern-nav';
  nav.innerHTML = `
    <div class="nav-left">
      <button class="nav-btn" id="nav_home">🏠</button>
    </div>
    <div class="nav-center">
      <div class="nav-title" id="nav_title">BPTP</div>
    </div>
    <div class="nav-right">
      <button class="nav-btn secondary" id="nav_back">← Back</button>
    </div>
  `;

  document.body.insertBefore(nav, document.body.firstChild);

  document.getElementById('nav_home').addEventListener('click', () => location.href = 'index.html');
  document.getElementById('nav_back').addEventListener('click', () => history.back());

  function setBodyGap() {
    const r = nav.getBoundingClientRect();
    document.body.style.paddingTop = (r.height + 12) + 'px';
  }

  setBodyGap();
  window.addEventListener('resize', setBodyGap);
})();