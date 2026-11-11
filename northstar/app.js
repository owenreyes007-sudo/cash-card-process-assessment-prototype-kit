/* Northstar Account Console: card diagnostics. All data is fictional and held in browser memory only.
   Flow: Select concern -> Select record -> Run Diagnostic -> brief scan -> assessment popup.
   Presenter conditions are applied through presenter.js; one evaluation (diagnostic-conditions.js) feeds every panel. */
const demoAccount = { customer:'Jamie Rivera', accountRef:'NS-20481' };
const recordCatalog = window.NorthstarDiagnosticRecords;
const NC = window.NorthstarConditions;
const issues = [
  {id:'activation',name:'Card activation',desc:'Card has not activated or activation fails',icon:'activate'},
  {id:'decline',name:'Declined transaction',desc:'A card payment was declined',icon:'decline'},
  {id:'delivery',name:'Card delivery',desc:'Card has not arrived or delivery failed',icon:'delivery'},
  {id:'replacement',name:'Card replacement',desc:'Card is lost, damaged, or needs replacing',icon:'replace'},
  {id:'notworking',name:'Card not working',desc:'Card fails during an attempted transaction',icon:'card'},
  {id:'restrictions',name:'Card restrictions',desc:'Card may be limited or restricted',icon:'shield'}
];
const scanSteps = {
  activation:'Checking card and activation status…', decline:'Checking transaction status…', delivery:'Checking delivery status…',
  replacement:'Checking replacement request…', notworking:'Checking recent card attempts…', restrictions:'Checking card controls and restrictions…'
};
const iconPaths={
  activate:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/><path d="M17 13v5M14.5 15.5h5"/>',
  decline:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4M16 14l3 3m0-3-3 3"/>',
  delivery:'<path d="M2.5 7h12v10h-12zM14.5 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/><path d="M16 12h2"/>',
  replace:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4M15 15h3"/><path d="M7 3 4 6l3 3M17 22l3-3-3-3"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/><path d="m15 14 2 2 3-4"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
  checks:'<path d="M9 5h11M9 12h11M9 19h11"/><path d="m3 5 1.3 1.3L6.5 4M3 12l1.3 1.3L6.5 11M3 19l1.3 1.3L6.5 18"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="1.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/>',
  guidance:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  message:'<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-3.5-.75L4 20l1.3-3.3A7.2 7.2 0 0 1 4 12c0-4.2 3.6-7.5 8-7.5s8 3.1 8 7z"/><path d="M8 11h8M8 14h5"/>',
  spinner:'<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4v5h-5"/>'
};

const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function lineIcon(name){return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g>${iconPaths[name]||iconPaths.checks}</g></svg>`;}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* Status system: tone carries severity; every status is icon + text so meaning never depends on colour alone. */
const statusIcons={
  success:'<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
  pending:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  attention:'<path d="M12 4 3 20h18z"/><path d="M12 10v4M12 17v.01"/>',
  danger:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  neutral:'<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  unknown:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.7M12 17v.01"/>'
};
const statusSvg=t=>`<svg viewBox="0 0 24 24" aria-hidden="true">${statusIcons[t]}</svg>`;
const statusMarkup=(label,tone)=>`<span class="status st-${tone}">${statusSvg(tone)}${esc(label)}</span>`;
const cardTone=s=>({Suspended:'danger',Locked:'attention',Active:'success'}[s]||'neutral');
const deliveryTone=s=>({Delivered:'success','In transit':'pending',Delayed:'attention',Exception:'attention','Not shipped':'attention','Tracking unavailable':'neutral'}[s]||'success');

let state={view:'overview',issue:null,record:null,result:null,dialog:null,config:{},scanTimer:null,shown:null,scanning:false};
let toastTimer;
function showToast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}

function setNav(href){$$('.nav-item').forEach(n=>n.classList.toggle('active',n.getAttribute('href')===href));}
function setCrumbs(){
  const issue=issues.find(i=>i.id===state.issue),deep=state.view==='troubleshoot'&&issue&&(state.dialog?.open||state.scanning||state.record);
  const rec=deep&&(state.dialog?.open?null:state.record);
  const items=state.view==='overview'?[['Accounts','overview'],['Account overview',null]]:[['Accounts','overview'],['Card diagnostics',deep?'troubleshoot':null],...(deep?[[issue.name,rec?'troubleshoot':null]]:[]),...(rec?[[rec.identifier,null]]:[])];
  $('#crumbs').innerHTML=items.map(([t,nav],i)=>{const last=i===items.length-1;return `<li>${nav&&!last?`<button type="button" data-crumb="${nav}">${esc(t)}</button>`:`<span ${last?'aria-current="page"':''}>${esc(t)}</span>`}</li>`;}).join('');
}
function navigate(view,initial){state.view=view;$$('.view').forEach(x=>x.classList.toggle('active-view',x.id===view));setNav(view==='overview'?'#overview':'#troubleshoot');setCrumbs();if(initial)return;$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'smooth'});}

/* Shared customer / account context, rendered on every screen from the shared account facts. */
const complianceTags=['KYC verified','ID verified','Sanctions screening clear','Bank linked'];
function renderContext(w){
  const risk=w.risk&&w.risk!=='none';
  $('#account-context').innerHTML=`<div class="cb-top"><div class="cb-id"><span class="cb-avatar" aria-hidden="true">JR</span><div><div class="cb-name">${esc(demoAccount.customer)}${statusMarkup('Verified','success')}</div><ul class="tags" aria-label="Compliance tags">${complianceTags.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></div></div><div class="cb-states"><div class="cb-field"><span class="cb-label">Account status</span>${w.hold==='yes'?statusMarkup('On hold','attention'):statusMarkup('Active','success')}</div><div class="cb-field"><span class="cb-label">Risk review</span>${risk?statusMarkup(w.risk,'danger'):statusMarkup('Clear','success')}</div><div class="cb-field"><span class="cb-label">Linked account</span>${statusMarkup('Confirmed','success')}</div></div></div><dl class="cb-attrs"><div><dt>Account</dt><dd class="mono">${esc(demoAccount.accountRef)}</dd></div><div><dt>Handle</dt><dd class="mono">$jamie.rivera</dd></div><div><dt>Customer since</dt><dd>Aug 2021</dd></div><div><dt>Account type</dt><dd>Consumer</dd></div><div><dt>Occupation</dt><dd>Product designer</dd></div><div><dt>Employment</dt><dd>Employed</dd></div></dl>`;
}
const money=n=>{const [i,d]=n.toFixed(2).split('.');return `$${Number(i).toLocaleString('en-US')}<span class="decimal">.${d}</span>`;};
function renderKpis(w){
  const declines=recordCatalog.decline.records.filter(r=>NC.evaluate('decline',r,state.config.decline||[],w).tone!=='clear').length;
  const notes=NC.notes(state.config),dates=['Oct 10, 2026',...notes.map(n=>n.date)].sort((a,b)=>NC.tsOf(b)-NC.tsOf(a));
  const groups=[
    {t:'Balances',hero:`<strong id="balance-value">${money(w.balanceLow?24:1284.62)}</strong>`,sub:'Available',rows:[['Pending','$0.00'],['Savings','$312.40']]},
    {t:'Card activity · 30 days',hero:`<strong>${money(684.31)}</strong>`,sub:'Card spend',rows:[['Card transactions','14'],['Declined payments',String(declines),declines>0]]},
    {t:'Inflow · 30 days',hero:`<strong>${money(2460)}</strong>`,sub:'Incoming',rows:[['Deposits','3'],['Direct deposit','$1,800.00']]},
    {t:'Lifetime',hero:`<strong>${money(92002.02)}</strong>`,sub:'Payment volume',rows:[['Payments','1,343'],['Average payment','$68.50']]},
    {t:'Support',hero:'<strong>2</strong>',sub:'Open cases',rows:[['Contacts · 90 days',String(2+notes.length)],['Last contact',dates[0].replace(', 2026','')]]}
  ];
  $('#kpi-strip').innerHTML=groups.map(g=>`<article class="kpi"><span class="cb-label">${esc(g.t)}</span><div class="kpi-hero">${g.hero}<small>${esc(g.sub)}</small></div><dl>${g.rows.map(([k,v,warn])=>`<div><dt>${esc(k)}</dt><dd class="${warn?'warn':''}">${esc(v)}</dd></div>`).join('')}</dl></article>`).join('');
}
const chartData={labels:['Sep 14','Sep 21','Sep 28','Oct 5','Oct 12','Oct 19'],volume:[412.3,508.9,377.2,640.1,455.8,389.4],count:[9,11,8,14,10,9]};
function renderChart(mode){
  const vals=chartData[mode],max=Math.max(...vals),top=mode==='volume'?Math.ceil(max/200)*200:Math.ceil(max/4)*4,W=640,H=210,L=44,B=26,T=10,pw=W-L-8,ph=H-B-T,bw=pw/vals.length;
  const fmt=v=>mode==='volume'?'$'+v.toLocaleString('en-US'):String(v),ticks=[0,.25,.5,.75,1].map(f=>Math.round(top*f));
  $('#activity-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly payment ${mode} for the last six weeks: ${vals.map((v,i)=>chartData.labels[i]+' '+fmt(v)).join(', ')}" preserveAspectRatio="xMidYMid meet">${ticks.map(t=>{const y=T+ph-(t/top)*ph;return `<line class="grid" x1="${L}" x2="${W-8}" y1="${y}" y2="${y}"/><text class="ytick" x="${L-8}" y="${y+4}" text-anchor="end">${fmt(t)}</text>`;}).join('')}${vals.map((v,i)=>{const h=(v/top)*ph,x=L+i*bw+bw*.2,y=T+ph-h;return `<g><title>${chartData.labels[i]} · ${mode==='volume'?'$'+v.toFixed(2):v+' payments'}</title><rect class="bar" x="${x}" y="${y}" width="${bw*.6}" height="${h}" rx="3"/><text class="xtick" x="${x+bw*.3}" y="${H-8}" text-anchor="middle">${chartData.labels[i]}</text></g>`;}).join('')}</svg>`;
}
const cardRows=[
  {last:'1842',name:'Northstar debit · Physical',issued:'Oct 05, 2026',base:'Not activated',note:'Awaiting activation'},
  {last:'6620',name:'Replacement debit',issued:'Oct 11, 2026',base:'Not activated',note:'Replaces card 4821 · RP-76882'},
  {last:'8115',name:'Northstar debit · Physical',issued:'Oct 09, 2026',base:'Not activated',note:'Awaiting activation'},
  {last:'3306',name:'Northstar debit · Physical',issued:'Mar 14, 2026',base:'Active',note:''},
  {last:'5518',name:'Northstar debit · Physical',issued:'Jul 02, 2026',base:'Active',note:''},
  {last:'7040',name:'Northstar debit · Physical',issued:'Aug 21, 2026',base:'Active',note:''},
  {last:'2290',name:'Northstar debit · Physical',issued:'Jan 09, 2026',base:'Active',note:'Replacement RP-77104'},
  {last:'9037',name:'Northstar debit · Physical',issued:'Sep 03, 2026',base:'Active',note:'Replacement RP-77215'},
  {last:'4821',name:'Northstar debit · Physical',issued:'Apr 18, 2026',base:'Closed',note:'Replaced by card 6620'}
];
function renderCards(w){
  $('#cards-body').innerHTML=cardRows.map(c=>{let st=c.base;if(st!=='Closed'){if(w.cardStatus==='Suspended'||w.cardStatus==='Locked')st=w.cardStatus;else if(w.cardStatus==='Active'&&st==='Not activated')st='Active';}
    return `<tr><td><b>${esc(c.name)}</b><small class="mono">•••• ${c.last}</small></td><td>${statusMarkup(st,st==='Closed'?'neutral':cardTone(st))}</td><td>${esc(c.issued)}</td><td class="muted">${esc(c.note)}</td></tr>`;}).join('');
}
const baseContacts=[{date:'Oct 10, 2026',channel:'Chat',text:'Reported lost card ending 4821; replacement RP-76882 requested'},{date:'Sep 22, 2026',channel:'Chat',text:'Updated mailing address (verified)'}];
function renderContacts(){
  const rows=[...NC.notes(state.config),...baseContacts].sort((a,b)=>NC.tsOf(b.date)-NC.tsOf(a.date));
  $('#contacts-body').innerHTML=rows.map(r=>{const [d,t]=r.date.split(' · ');return `<tr><td>${esc(d.replace(', 2026',''))}${t?`<small>${esc(t)}</small>`:''}</td><td>${esc(r.channel)}</td><td>${esc(r.text)}</td></tr>`;}).join('');
}
const olderActivity=[
  {name:'Corner Coffee',sub:'Food & drink',ref:'TXN-882904',date:'Oct 13, 2026 · 8:21 AM',amount:'−$8.45'},
  {name:'Market Square',sub:'Groceries',ref:'TXN-882771',date:'Oct 12, 2026 · 6:14 PM',amount:'−$39.60'}
];
function renderActivity(w){
  const rows=recordCatalog.decline.records.map(r=>{
    const o=NC.evaluate('decline',r,state.config.decline||[],w);
    return {name:r.label,sub:r.sub,ref:r.identifier,date:r.date,amount:'−$'+r.amountValue.toFixed(2),declined:o.tone!=='clear'};
  }).concat(olderActivity).sort((a,b)=>NC.tsOf(b.date)-NC.tsOf(a.date)).slice(0,5);
  $('#activity-body').innerHTML=rows.map(r=>{const [d,t]=r.date.split(' · ');return `<tr><td><span class="merchant"><span class="merchant-icon" aria-hidden="true">${esc(r.name[0])}</span><span><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span></span></td><td><span class="ref">${esc(r.ref)}</span></td><td>${esc(d)}<small>${esc(t)}</small></td><td>${r.declined?statusMarkup('Declined','danger'):statusMarkup('Posted','success')}</td><td class="right amount">${esc(r.amount)}</td></tr>`;}).join('');
}
let chartMode='volume';
function syncAccountContext(){
  const w=NC.world(state.config);
  renderContext(w);renderKpis(w);renderChart(chartMode);renderCards(w);renderContacts();renderActivity(w);
  $('#card-status').innerHTML=statusMarkup(w.cardStatus||'Not activated',cardTone(w.cardStatus));
  const dv=w.delivery||'Delivered';$('#delivery-status').innerHTML=statusMarkup(dv,deliveryTone(dv));
}

/* Diagnostics screen: concern list (left) and a quiet diagnostic status panel (right) that hosts the scan. */
function diagPanelMarkup(mode,phase){
  const issue=issues.find(i=>i.id===state.issue),rec=state.record;
  if(mode==='scan')return `<div class="diag-body" aria-live="polite"><dl class="diag-kv"><div><dt>Concern</dt><dd>${esc(issue.name)}</dd></div><div><dt>Record</dt><dd class="mono">${esc(rec.identifier)}</dd></div></dl><div class="progress" role="progressbar" aria-label="Diagnostic progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${phase.pct}"><span style="width:${phase.pct}%"></span></div><div class="scan-line"><i class="spinner" aria-hidden="true"></i><span>${esc(phase.text)}</span></div></div>`;
  return `<div class="diag-body"><p>Select a reported concern, then choose the record to diagnose.</p></div>`;
}
function renderTroubleshoot(){
  const root=$('#troubleshoot');syncAccountContext();setCrumbs();
  root.innerHTML=`<div class="page-head"><div><h1 id="diagnostics-title">Card diagnostics</h1><p>Select the customer's reported concern, then the record to diagnose.</p></div><button class="button" data-nav="overview">Back to account</button></div>
  <div class="diag-grid"><section class="panel" aria-labelledby="concern-title"><div class="panel-head"><h2 id="concern-title">Reported concern</h2><span class="hint">${issues.length} concerns</span></div><div class="concern-list">${issues.map(i=>`<button class="issue-card" data-issue="${i.id}" ${state.issue===i.id&&(state.dialog?.open||state.scanning)?'aria-current="true"':''} ${state.scanning?'disabled':''}><span class="ic-icon">${lineIcon(i.icon)}</span><span class="ic-copy"><b>${i.name}</b><small>${i.desc}</small></span><svg class="ic-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`).join('')}</div></section>
  <aside class="panel diag-status" aria-labelledby="diag-title"><div class="panel-head"><h2 id="diag-title">Diagnostic</h2><span class="hint">${state.scanning?'Running':'Ready'}</span></div><div id="diag-panel">${diagPanelMarkup('idle')}</div></aside></div>`;
}

function recordRowMarkup(r,kind,d){
  const sel=d.recordId===r.id,mark='<span class="record-select-mark"></span>';
  const attrs=`type="button" data-record="${r.id}" role="radio" aria-checked="${sel}"`;
  if(kind==='transaction'){const [dt,tm]=r.date.split(' · ');return `<button ${attrs} class="record-option tx ${sel?'selected':''}">${mark}<span class="rc-main"><b>${esc(r.label)}</b><span class="mono">${esc(r.identifier)} · •••• ${esc(r.card)}</span></span><span class="rc-date">${esc(dt)}<small>${esc(tm)}</small></span><span class="rc-amt">${esc(r.amount.replace(' USD',''))}</span></button>`;}
  return `<button ${attrs} class="record-option ${sel?'selected':''}">${mark}<span class="rc-main"><b>${esc(r.label)} <span class="mono" style="display:inline">${esc(r.identifier)}</span></b><small>${esc(r.detail)}</small></span></button>`;
}
function selectedRecord(){return state.dialog?.recordId?recordCatalog[state.issue]?.records.find(r=>r.id===state.dialog.recordId)||null:state.record||null;}
function renderContextDialog(){
  const host=$('#context-dialog-root');if(!state.dialog?.open){host.innerHTML='';return;}
  const issue=issues.find(i=>i.id===state.issue),cfg=recordCatalog[state.issue],d=state.dialog,record=selectedRecord();
  let list=cfg.records;if(cfg.searchable){const q=(d.search||'').trim().toLowerCase();if(q)list=list.filter(r=>[r.label,r.identifier,r.date,r.amount,r.card].some(v=>String(v||'').toLowerCase().includes(q)));}
  const body=`<p class="dialog-intro">Select the ${esc(cfg.prompt)} linked to the customer's concern.</p>${cfg.searchable?`<label class="field record-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="record-search" type="search" value="${esc(d.search||'')}" placeholder="Search merchant, reference, date or amount" aria-label="Search transactions"></label>`:''}<div class="record-list" role="radiogroup" aria-label="Select a ${esc(cfg.kind)} record">${cfg.kind==='transaction'&&list.length?'<div class="record-head" aria-hidden="true"><span></span><span>Transaction</span><span>Date</span><span>Amount</span></div>':''}${list.length?list.map(r=>recordRowMarkup(r,cfg.kind,d)).join(''):`<div class="record-empty"><b>No matching transactions</b>Try another merchant, reference, date or amount.</div>`}</div>`;
  host.innerHTML=`<div class="context-modal-backdrop"><section class="context-modal" role="dialog" aria-modal="true" aria-labelledby="context-dialog-title" aria-describedby="context-dialog-description"><header class="context-modal-header"><div><span class="section-kicker">${esc(issue.name)}</span><h2 id="context-dialog-title">${esc(cfg.title)}</h2><p id="context-dialog-description">${esc(demoAccount.customer)} · Account ${esc(demoAccount.accountRef)}</p></div><button type="button" class="dialog-close" data-dialog-cancel aria-label="Cancel">×</button></header><div class="context-modal-body">${body}</div><footer class="context-modal-footer"><button type="button" class="button outline" data-dialog-cancel>Cancel</button><span class="dialog-footer-spacer"></span><button type="button" class="button primary" data-dialog-next ${record?'':'disabled'}>Run Diagnostic</button></footer></section></div>`;
  if(cfg.searchable){const input=$('#record-search');input?.addEventListener('input',()=>{d.search=input.value;d.recordId=null;renderContextDialog();const nx=$('#record-search');nx?.focus();nx?.setSelectionRange(d.search.length,d.search.length);});}
  if(!d.focused){d.focused=true;($('.record-option.selected')||$('.record-option')||$('#record-search'))?.focus();}
}
function beginContextSelection(issueId){clearResult();state.issue=issueId;state.record=null;state.dialog={open:true,recordId:null,search:''};renderTroubleshoot();renderContextDialog();setCrumbs();}
function closeDialog(){state.dialog=null;renderContextDialog();if(state.view==='troubleshoot'){renderTroubleshoot();}setCrumbs();}

/* Result lifecycle: any change of concern, record or applied configuration clears findings and aborts a running scan. */
function clearResult(){clearInterval(state.scanTimer);state.scanTimer=null;state.scanning=false;state.result=null;$('#result-popup-root').replaceChildren();}
function evaluateCurrent(){
  const rec=state.record,cfg=recordCatalog[state.issue];
  if(!rec||!cfg.records.some(r=>r.id===rec.id))throw new Error('Select a record first');
  const out=NC.evaluate(state.issue,rec,state.config[state.issue]||[],NC.world(state.config));
  return {...out,issue:issues.find(x=>x.id===state.issue),identifier:rec.identifier,kind:cfg.kind};
}
function process(){
  if(!state.record)return showToast('Select a record first.');
  clearResult();navigate('troubleshoot');state.scanning=true;renderTroubleshoot();setCrumbs();
  const phases=['Reviewing account information…',scanSteps[state.issue],'Reviewing recorded attempts and events…','Preparing diagnostic assessment…'];
  const panel=()=>$('#diag-panel');
  panel().innerHTML=diagPanelMarkup('scan',{pct:8,text:phases[0]});
  let n=0;
  state.scanTimer=setInterval(()=>{
    n++;if(!panel()){clearInterval(state.scanTimer);return;}
    if(n<4){panel().innerHTML=diagPanelMarkup('scan',{pct:Math.round((n+.5)/4*100),text:phases[n]});return;}
    clearInterval(state.scanTimer);state.scanTimer=null;state.scanning=false;state.result=evaluateCurrent();renderTroubleshoot();showPopup(state.result);
  },300);
}

const evIcon={ok:'✓',fail:'✕',info:'•'};
function summaryText(r){
  const L=[`Card diagnostic · ${r.issue.name} · ${r.identifier}`,`Status: ${r.status}`,'',r.blockers.length?'Findings:':'Finding:'];
  (r.blockers.length?r.blockers:[r.primary]).forEach(f=>L.push(`- ${f.title} (${f.evidence})`));
  r.questions.forEach(f=>L.push(`- Unable to determine: ${f.title.replace(/^Unable to determine\s*/i,'')}`));
  L.push('',r.tone==='blocker'?'Why the request is blocked:':r.tone==='unknown'?'Why no conclusion yet:':'Why this matters:');r.why.forEach(w=>L.push(w));
  L.push('','Advocate action:');r.actions.forEach(a=>L.push(`- ${a.text}${a.ext?' (outside this tool)':''}`));
  if(r.done.length||r.skip.length){L.push('','Already done (do not repeat):');r.done.forEach(d=>L.push(`- ${d}`));if(r.skip.length)L.push(`Do not suggest: ${r.skip.join('; ')}`);}
  if(r.customer.length){L.push('','Suggested customer wording:',r.customer.join(' '));if(r.sensitive)L.push('Internal risk details are not for customer disclosure.');}
  if(r.timeline.length>=2){L.push('','Timeline:');r.timeline.forEach(t=>L.push(`- ${t.when}: ${t.text}`));}
  return L.join('\n');
}
async function copySummary(){
  const r=state.shown;if(!r)return;const text=summaryText(r);
  try{await navigator.clipboard.writeText(text);}catch(e){const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy');}catch(_){}t.remove();}
  const b=$('#result-copy');if(b){b.textContent='Copied';setTimeout(()=>{const x=$('#result-copy');if(x)x.textContent='Copy summary';},1800);}
}
function popupTone(r){return r.status==='Multiple Blockers Detected'?'danger':r.tone==='blocker'?'attention':r.tone==='unknown'?'unknown':'success';}
const checkSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
function showPopup(r){
  state.shown=r;
  const host=$('#result-popup-root'),tone=popupTone(r),multi=r.blockers.length>1||(r.blockers.length&&r.questions.length);
  const sec=(label,html,cls='')=>`<section class="rp-sec ${cls}"><h3>${label}</h3>${html}</section>`;
  const item=(f,q)=>`<li class="${q?'q':''}"><b>${esc(f.title)}</b><p>${esc(f.why)}</p><small>${esc(f.evidence)}</small></li>`;
  const findingList=multi?`<ul class="rp-blockers">${r.blockers.map(b=>item(b)).join('')}${r.questions.map(q=>item(q,true)).join('')}</ul>`:`<ul class="rp-blockers single">${item(r.primary,r.tone==='unknown')}</ul>`;
  const actions=sec('Advocate action',`<ol class="rp-actions">${r.actions.map(a=>`<li>${esc(a.text)}${a.ext?' <em class="rp-ext">outside this tool</em>':''}</li>`).join('')}</ol>`,'rp-do');
  const done=(r.done.length||r.skip.length)?sec('Already done · don’t repeat',`${r.done.length?`<ul class="rp-done">${r.done.map(d=>`<li>${checkSvg}<span>${esc(d)}</span></li>`).join('')}</ul>`:''}${r.skip.length?`<div class="rp-skip"><span>Don’t suggest</span>${r.skip.map(x=>`<em>${esc(x)}</em>`).join('')}</div>`:''}`):'';
  const row=t=>`<li class="${t.res}"><i aria-hidden="true">${evIcon[t.res]}</i><span class="when">${esc(t.when)}</span><span>${esc(t.text)}</span></li>`;
  const timeline=r.timeline.length>=2?`<details class="rp-evidence-box rp-timeline-box"><summary>Timeline · ${r.timeline.length} events</summary><ol class="rp-timeline">${r.timeline.map(row).join('')}</ol></details>`:'';
  const customer=r.customer.length?sec('Customer expectation',`<blockquote class="rp-customer">${r.customer.map(c=>esc(c)).join(' ')}</blockquote>${r.sensitive?'<small class="rp-note">Internal risk details are not for customer disclosure.</small>':''}`):'';
  host.innerHTML=`<div class="context-modal-backdrop result-backdrop"><section class="context-modal result-popup" role="dialog" aria-modal="true" aria-labelledby="result-title" aria-describedby="result-record"><header class="context-modal-header"><div><span class="section-kicker">${esc(r.issue.name)}</span><h2 id="result-title">Diagnostic assessment</h2><span class="rp-id" id="result-record">${esc(r.identifier)}</span></div><button type="button" class="dialog-close" data-result-close aria-label="Close">×</button></header><div class="context-modal-body"><div class="result-status tone-${tone}" role="status">${statusSvg(tone)}<span>${esc(r.status)}</span></div>${sec(multi?'Findings':'Finding',findingList)}${actions}${done}${customer}${timeline}<details class="rp-evidence-box"><summary>Supporting evidence</summary><ul>${r.evidence.map(e=>`<li><b>${esc(e.title)}</b><small>${esc(e.evidence)}</small></li>`).join('')}</ul></details></div><footer class="context-modal-footer"><button type="button" class="button outline" id="result-copy">Copy summary</button><span class="dialog-footer-spacer"></span><button type="button" class="button primary" id="result-close">Close</button></footer></section></div>`;
  $('#result-close').focus();
}
function closePopup(){if(!$('#result-popup-root').children.length)return;$('#result-popup-root').replaceChildren();state.result=null;state.record=null;state.issue=null;navigate('overview');}

function selectTab(id){$$('.tab').forEach(t=>{const on=t.id===id;t.classList.toggle('active',on);t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=!on;});}
function init(){
  clearInterval(state.scanTimer);
  state={view:'overview',issue:null,record:null,result:null,dialog:null,config:{},scanTimer:null,shown:null,scanning:false};
  $('#context-dialog-root').replaceChildren();$('#result-popup-root').replaceChildren();
  syncAccountContext();navigate('overview',true);renderTroubleshoot();
  const goTroubleshoot=()=>{clearResult();state.issue=null;state.record=null;state.dialog=null;renderContextDialog();navigate('troubleshoot');renderTroubleshoot();};
  $('#launch-diagnostics').addEventListener('click',goTroubleshoot);
  document.querySelector('.nav-item[href="#troubleshoot"]').addEventListener('click',e=>{e.preventDefault();goTroubleshoot();});
  document.querySelector('.nav-item[href="#overview"]').addEventListener('click',e=>{e.preventDefault();clearResult();state.dialog=null;renderContextDialog();navigate('overview');});
  for(const href of ['#activity','#card'])document.querySelector(`.nav-item[href="${href}"]`).addEventListener('click',e=>{e.preventDefault();clearResult();state.dialog=null;renderContextDialog();navigate('overview',true);setNav(href);if(href==='#card')selectTab('tab-cards');else selectTab('tab-payments');document.querySelector('#activity').scrollIntoView({behavior:'smooth',block:'start'});});
  $$('.tab').forEach(t=>t.addEventListener('click',()=>selectTab(t.id)));
  $('.tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;const tabs=$$('.tab'),i=tabs.indexOf(document.activeElement);if(i<0)return;const n=tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];selectTab(n.id);n.focus();});
  $$('.seg').forEach(b=>b.addEventListener('click',()=>{chartMode=b.dataset.measure;$$('.seg').forEach(x=>{const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-pressed',on);});renderChart(chartMode);}));
  $('#card-details').addEventListener('click',()=>showToast('Card details are not available in this workflow.'));
  $('#crumbs').addEventListener('click',e=>{const c=e.target.closest('[data-crumb]');if(!c)return;if(c.dataset.crumb==='overview'){clearResult();state.dialog=null;renderContextDialog();navigate('overview');}else goTroubleshoot();});
  $('#troubleshoot').addEventListener('click',e=>{const issue=e.target.closest('[data-issue]'),nav=e.target.closest('[data-nav]');if(issue&&!issue.disabled){beginContextSelection(issue.dataset.issue);return;}if(nav){clearResult();state.dialog=null;renderContextDialog();navigate(nav.dataset.nav);if(nav.dataset.nav==='troubleshoot')renderTroubleshoot();}});
  $('#context-dialog-root').addEventListener('click',e=>{
    const cancel=e.target.closest('[data-dialog-cancel]'),next=e.target.closest('[data-dialog-next]'),rec=e.target.closest('[data-record]');
    if(cancel||e.target.classList.contains('context-modal-backdrop')){closeDialog();return;}
    if(rec){state.dialog.recordId=rec.dataset.record;renderContextDialog();$(`[data-record="${rec.dataset.record}"]`)?.focus();return;}
    if(next&&!next.disabled){if(!selectedRecord())return;state.record=selectedRecord();state.dialog=null;renderContextDialog();process();}
  });
  $('#result-popup-root').addEventListener('click',e=>{if(e.target.closest('#result-copy')){copySummary();return;}if(e.target.closest('#result-close')||e.target.closest('[data-result-close]')||e.target.classList.contains('result-backdrop'))closePopup();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab'){const root=[$('#presenter-root'),$('#result-popup-root'),$('#context-dialog-root')].find(r=>r&&r.children.length);const m=root&&root.querySelector('.context-modal');if(m){const f=[...m.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(f.length){const i=f.indexOf(document.activeElement);if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus();}else if(!e.shiftKey&&(i===f.length-1||i<0)){e.preventDefault();f[0].focus();}}}}
    if(e.key==='Escape'&&$('#presenter-root').children.length)return;
    if(e.key==='Escape'&&$('#result-popup-root').children.length){closePopup();return;}
    if(e.key==='Escape'&&state.dialog?.open)closeDialog();
  });
}
document.addEventListener('DOMContentLoaded',init);

