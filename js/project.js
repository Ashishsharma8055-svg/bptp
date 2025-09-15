function fmtNumber(n){
  try{ const v = Math.round(Number(n)||0); return new Intl.NumberFormat('en-IN').format(v);}catch(e){return String(Math.round(Number(n)||0));}}


import { apiGet } from './app.js';
async function init(){
  if(window.showLoader) showLoader('Loading Project Details...', 'Fetching project details...');
  const projectName = localStorage.getItem('selectedProjectName') || new URLSearchParams(location.search).get('project') || '';
  const data = await apiGet('projects') || [];
  const project = data.find(p => (p['Project Name']||'')===projectName) || data[0] || null;
  if(!project){ document.getElementById('projectTitle').innerText='Project Not Found'; if(window.hideLoader) hideLoader(); return; }
  document.getElementById('projectTitle').innerText = project['Project Name']||projectName;
  const table = document.getElementById('projectTable'); table.innerHTML='';
  const fields=['RERA','Status','Class','Category','Structure','Typology','Possession','USP','Location'];
  fields.forEach(f=>{ if(project[f]){ const row=table.insertRow(); row.insertCell(0).innerText=f; row.insertCell(1).innerText=project[f]; } });
  const brochureBtn=document.getElementById('downloadBrochure');
  if(project['Brouchre URL']) brochureBtn.onclick=()=>window.open(project['Brouchre URL'],'_blank'); else { brochureBtn.disabled=true; brochureBtn.innerText='Brochure N/A' }
  document.getElementById('goInventory').addEventListener('click', ()=>{ try{ localStorage.setItem('selectedProjectName', project['Project Name']||''); }catch(e){} window.location.href='inventory.html'; });
  // gallery modal setup
  const gallery=document.getElementById('gallery'); gallery.innerHTML='';
  const images=[]; for(let i=1;i<=4;i++){ const url=project['Image '+i+' URL']; if(url){ images.push(url); const img=document.createElement('img'); img.src=url; img.alt=project['Project Name']+' image '+i; gallery.appendChild(img); } }
  // modal
  const modal = document.createElement('div'); modal.className='modal'; modal.innerHTML = '<button class="close">✕</button><div class="nav left">‹</div><img/><div class="nav right">›</div>'; document.body.appendChild(modal);
  const modalImg = modal.querySelector('img'); const closeBtn = modal.querySelector('.close'); const navLeft = modal.querySelector('.nav.left'); const navRight = modal.querySelector('.nav.right');
  let idx=0; function openModal(i){ idx=i; modalImg.src = images[idx]; modal.style.display='flex'; } function closeModal(){ modal.style.display='none'; } function show(n){ idx = (n+images.length)%images.length; modalImg.src = images[idx]; }
  gallery.querySelectorAll('img').forEach((el,i)=> el.addEventListener('click', ()=> openModal(i))); closeBtn.addEventListener('click', closeModal); navLeft.addEventListener('click', ()=> show(idx-1)); navRight.addEventListener('click', ()=> show(idx+1)); modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(); });
  if(window.hideLoader) hideLoader();
}
document.addEventListener('DOMContentLoaded', init);



// Remove/hide video player (ensure no video loads)
(function removeProjectVideo(){
  try{
    const vid = document.getElementById('projectVideo') || document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
    if(vid){
      const wrapper = vid.closest('.video-section') || vid.parentElement;
      if(wrapper) wrapper.remove();
      else vid.remove();
      console.log('Project video removed');
    }
  }catch(e){ console.warn('removeProjectVideo error', e); }
})();
