import { apiGet, escapeHtml, qs, toast } from './app.js';

const projectSelect  = document.getElementById('projectSelect');
const inventoryBody  = document.getElementById('inventoryBody');
const noData         = document.getElementById('noData');

// Session-only unlock (clears on reload)
const unlockedProjectsSession = new Set();

async function loadProjects(){
  projectSelect.innerHTML = '<option>Loading…</option>';
  const list = await apiGet({ type: 'projects' });
  projectSelect.innerHTML = list.map(
    p => `<option>${escapeHtml(p['Project Name'] || '')}</option>`
  ).join('');
  const initial = qs('project');
  if (initial && list.some(p => p['Project Name'] === initial)) {
    projectSelect.value = initial;
  }
}

async function loadInventory(){
  const project = projectSelect.value;
  if(!project){ inventoryBody.innerHTML = ''; return; }

  inventoryBody.innerHTML = '<tr><td colspan="7">Loading…</td></tr>';
  noData.style.display = 'none';

  const rows = await apiGet({ type: 'inventory', project });
  if(!rows || !rows.length){
    inventoryBody.innerHTML = '';
    noData.textContent = 'No inventory for selected project.';
    noData.style.display = 'block';
    return;
  }

  const isUnlocked = unlockedProjectsSession.has(project);

  inventoryBody.innerHTML = rows.map(r => {
    const projectName = r['Project Name'] || '';
    const projectType = r['Property Type'] || r['Project Type'] || '';
    const unit        = r['Unit Number'] || r['Unit No'] || r['Unit'] || '';
    const size        = r['Size'] || r['Unit Size'] || '';
    const budget      = r['Budget'] || r['Price'] || '';
    const status      = r['Property Status'] || r['Status'] || '';

    const unitCell = isUnlocked ? escapeHtml(unit) : `<span class="blur">${escapeHtml(unit || '-')}</span>`;
    const sizeCell = isUnlocked ? escapeHtml(size) : `<span class="blur">${escapeHtml(size || '-')}</span>`;
    const budCell  = isUnlocked ? escapeHtml(budget) : `<span class="blur">${escapeHtml(budget || '-')}</span>`;

    const actionBtn = isUnlocked
      ? `<span class="small">Unlocked</span>`
      : `<button class="btn show-btn" data-project="${escapeHtml(projectName)}" data-unit="${escapeHtml(unit)}">SHOW</button>`;

    return `<tr>
      <td>${escapeHtml(projectName)}</td>
      <td>${escapeHtml(projectType)}</td>
      <td>${unitCell}</td>
      <td>${sizeCell}</td>
      <td>${budCell}</td>
      <td>${escapeHtml(status)}</td>
      <td>${actionBtn}</td>
    </tr>`;
  }).join('');

  if(!isUnlocked){
    document.querySelectorAll('button.show-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.project;
        const u = btn.dataset.unit;
        const url = `lead.html?project=${encodeURIComponent(p)}&unit=${encodeURIComponent(u)}`;
        const w=680,h=720,left=(screen.width-w)/2,top=(screen.height-h)/2;
        const child = window.open(url, "lead_capture", `width=${w},height=${h},left=${left},top=${top}`);
        if(!child) alert('Popup blocked — please allow popups');
      });
    });
  }
}

// Receive result AFTER lead capture
window.addEventListener('message', ev => {
  if(!ev.data || ev.data.type !== 'leadSaved') return;
  const project = String(ev.data.project || '');
  if(!project) return;

  if (ev.data.blocked === true) {
    // Do NOT unlock if GAS marked this IP/mobile as blocked
    toast('Blocked', false);
    return;
  }

  // Successful & not blocked → unlock entire project (session-only)
  unlockedProjectsSession.add(project);
  loadInventory();
});

projectSelect.addEventListener('change', loadInventory);

(async function init(){
  await loadProjects();
  await loadInventory();
})();