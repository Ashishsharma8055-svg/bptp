function fmtNumber(n){
  try{ const v = Math.round(Number(n)||0); return new Intl.NumberFormat('en-IN').format(v);}catch(e){return String(Math.round(Number(n)||0));}}


import { apiGet } from './app.js';
async function load(){
  try{ if(window.showLoader) showLoader('Loading Projects...', 'Fetching projects...'); }catch(e){}
  const container = document.getElementById('projectsGrid');
  container.innerHTML = '';
  let data = [];
  try{ data = await apiGet('projects') || []; }catch(e){ console.error(e); data = []; }
  data.sort((a,b)=> (a['Project Name']||'').toLowerCase().localeCompare((b['Project Name']||'').toLowerCase()));
  if(!data.length){ container.innerHTML = '<div class="center" style="padding:24px;color:#345a6d">No projects found.</div>'; if(window.hideLoader) hideLoader(); return; }
  data.forEach((p, idx)=>{
    const name = p['Project Name'] || `Project ${idx+1}`;
    const location = p['Location'] || p['City'] || '';
    const cls = p['Class'] || p['Category'] || '';
    const status = p['Status'] || '';
    const img = p['Image 1 URL'] || p['Image URL'] || '';
    const card = document.createElement('a'); card.className='project-card __glass-3d'; card.href='javascript:void(0)';
    card.dataset.projectName = name;
    const thumb = document.createElement('div'); thumb.className='card-thumb'; if(img) thumb.style.backgroundImage = `url(${img})`; else { thumb.classList.add('placeholder'); thumb.textContent='Real Estate' }
    const tag = document.createElement('div'); tag.className='thumb-tag'; tag.textContent = cls || 'Project'; thumb.appendChild(tag);
    const body = document.createElement('div'); body.className='card-body';
    const title = document.createElement('h3'); title.className='card-title'; title.textContent = name;
    const loc = document.createElement('div'); loc.className='card-location'; loc.textContent = location;
    body.appendChild(title); body.appendChild(loc);
    const footer = document.createElement('div'); footer.className='card-footer';
    const meta = document.createElement('div'); meta.className='meta-chip'; meta.textContent = status || cls || 'Project';
    const btn = document.createElement('button'); btn.className='view-btn'; btn.textContent='View';
    footer.appendChild(meta); footer.appendChild(btn);
    card.appendChild(thumb); card.appendChild(body); card.appendChild(footer);
    container.appendChild(card);
    const openProject = ()=>{ localStorage.setItem('selectedProjectName', name); window.location.href = `project.html?project=${encodeURIComponent(name)}`; };
    card.addEventListener('click', openProject); btn.addEventListener('click', (ev)=>{ ev.stopPropagation(); openProject(); });
  });
  if(window.hideLoader) hideLoader();
}
document.addEventListener('DOMContentLoaded', load);
