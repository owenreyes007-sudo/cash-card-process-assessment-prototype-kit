const catalogUrl = new URL('./catalog.json', location.href);
const filtersRoot = document.querySelector('#filters');
const grid = document.querySelector('#grid');
const search = document.querySelector('#search');
const count = document.querySelector('#count');
const empty = document.querySelector('#empty');
let catalog = [];
let selectedCategory = 'All prototypes';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categoryNames = items => [...new Set(items.map(item => item.category))];
function drawFilters(){
  const categories = ['All prototypes', ...categoryNames(catalog)];
  filtersRoot.innerHTML = categories.map(category => `<button class="filter${category===selectedCategory?' active':''}" type="button" data-category="${esc(category)}">${esc(category)} <span>${category==='All prototypes'?catalog.length:catalog.filter(item=>item.category===category).length}</span></button>`).join('');
}
function render(){
  const term = search.value.trim().toLowerCase();
  const matches = catalog.filter(item => (selectedCategory==='All prototypes' || item.category===selectedCategory) && [item.name,item.description,item.problem,item.category,...(item.tags||[])].join(' ').toLowerCase().includes(term));
  count.textContent = String(matches.length).padStart(2,'0');
  empty.hidden = matches.length>0;
  grid.innerHTML = matches.map((item,index) => {
    const statusClass = item.accessMode==='local-file'?'local':item.accessMode==='source-only'?'source-only':'';
    const accessLabel = item.accessMode==='source-only'?'Open source':'Launch prototype';
    const preview = item.preview ? `<img src="${esc(item.preview)}" alt="Preview of ${esc(item.name)}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('no-image')">` : '';
    const icon = item.category.includes('Workflow')?'↗':item.category.includes('Diagnostics')?'⌕':item.category.includes('Card')?'◈':'✳';
    return `<article class="card"><div class="thumb ${item.preview?'':'no-image'}">${preview}<span class="thumb-num">${String(index+1).padStart(2,'0')} / ${String(matches.length).padStart(2,'0')}</span>${!item.preview?`<span class="thumb-icon">${icon}</span>`:''}<span class="thumb-cat">${esc(item.category.toUpperCase())}</span></div><div class="card-body"><div class="card-topline"><span class="category">${esc(item.category)}</span><span class="status ${statusClass}">${esc(item.status)}</span></div><h3>${esc(item.name)}</h3><p class="card-desc">${esc(item.description)}</p><p class="problem"><b>Addresses:</b> ${esc(item.problem)}</p><div class="card-bottom"><div class="tags">${(item.tags||[]).slice(0,2).map(tag=>`<span class="tag">${esc(tag)}</span>`).join('')}</div><div class="actions"><a class="launch" href="${esc(item.accessUrl)}" ${['external','source-only'].includes(item.accessMode)?'target="_blank" rel="noreferrer"':''}>${accessLabel} ↗</a>${item.sourceUrl?`<a class="source" href="${esc(item.sourceUrl)}" target="_blank" rel="noreferrer">Source</a>`:''}</div></div></div></article>`;
  }).join('');
}
filtersRoot.addEventListener('click', event=>{const button=event.target.closest('[data-category]');if(!button)return;selectedCategory=button.dataset.category;drawFilters();render();});
search.addEventListener('input',render);
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();search.focus();}});
document.querySelector('#year').textContent = new Date().getFullYear();
fetch(catalogUrl).then(response=>{if(!response.ok)throw new Error('catalog unavailable');return response.json();}).then(data=>{catalog=data.prototypes||[];drawFilters();render();}).catch(error=>{grid.innerHTML='<p>Could not load catalog.json. Serve this folder from a local web server or GitHub Pages.</p>';console.error(error);});


