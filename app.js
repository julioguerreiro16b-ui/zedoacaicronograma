'use strict';
const source = JSON.parse(document.getElementById('schedule-data').textContent);
const tasks = source.tarefas, tz = 'America/Sao_Paulo';
const dayNames = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const titles = { abertura:['Abertura','Antes de começar o atendimento','☀'], durante_expediente:['Durante o expediente','Conferir no turno e repetir ao longo do dia','↻'], noite:['Noite','Reposição e cuidado com o self-service','☾'], fechamento:['Fechamento','Antes de a última pessoa sair','✓'] };
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse = s => new Date(s + 'T12:00:00');
const shift = Schedule.shift;
const validDate = Schedule.validDate;
const weekOfMonth = s => Math.ceil(Number(s.slice(-2)) / 7);
const format = (s, opts = {day:'numeric',month:'long',year:'numeric'}) => parse(s).toLocaleDateString('pt-BR', opts);
const shortDate = s => format(s, {day:'2-digit',month:'2-digit',year:'numeric'});
function today() { return new Intl.DateTimeFormat('en-CA', {timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
let selected = today(), view = 'today', filter = 'all', records = {}, conflicts = {}, renderPending = false;
function periodicRange(s) { const w=weekOfMonth(s),d=parse(s),last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); return `${(w-1)*7+1}–${Math.min(w*7,last)}`; }
function due(s = selected) { return Schedule.entries(source, s, records); }
function record(t) { return records[t.key] || {done:false,owner:'',date:selected,scheduledDate:t.scheduledDate,completedAt:null,revision:0}; }
function toast(message) { $('toast').textContent=message; $('toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').hidden=true,5000); }
function badge(t) { return t.prioridade==='critica'?'<span class="badge critical">Crítica</span>':t.prioridade==='alta'?'<span class="badge high">Alta</span>':'<span class="badge">Rotina</span>'; }
function cycleLabel(t) {
  if (t.frequencia==='diaria') return '';
  const status=Schedule.status(t,selected);
  const text=status==='overdue'?`Atrasada · prevista para ${shortDate(t.scheduledDate)}`:status==='scheduled'?(Schedule.cycle(t)?'Semana programada · fazer agora':'Programada para este dia'):`Programada para ${shortDate(t.scheduledDate)}`;
  return `<span class="badge ${status}">${text}</span>`;
}
function taskHTML(t) {
  const r=record(t),id=encodeURIComponent(t.key),status=Schedule.status(t,selected);
  return `<article class="task ${r.done?'done':''} ${status}" data-id="${t.id}" data-occurrence="${esc(t.key)}">
    <div class="taskline"><input type="checkbox" id="check-${id}" data-check="${esc(t.key)}" ${r.done?'checked':''} aria-label="Concluir: ${esc(t.tarefa)}"><label class="tasktitle" for="check-${id}">${esc(t.tarefa)}</label></div>
    <div class="taskmeta">${badge(t)}<span>${esc(t.area)}</span>${cycleLabel(t)}</div>
    ${t.observacao&&t.momento!=='noite'?`<p class="tasknote">${esc(t.observacao)}</p>`:''}
    <div class="ownerrow"><label for="owner-${id}">Quem fez *</label><input id="owner-${id}" data-owner="${esc(t.key)}" value="${esc(r.owner)}" maxlength="80" required placeholder="Nome obrigatório para concluir" aria-label="Quem fez: ${esc(t.tarefa)}">${r.done?`<span class="finished">${new Date(r.completedAt).toLocaleTimeString('pt-BR',{timeZone:tz,hour:'2-digit',minute:'2-digit'})}</span>`:''}</div></article>`;
}
function groupHTML(title,hint,icon,list,classes='') {
  const shown=list.filter(t=>filter==='all'||filter==='pending'&&!record(t).done||filter==='critical'&&t.prioridade==='critica');
  const done=list.filter(t=>record(t).done).length;
  return `<section class="group ${classes}"><header class="grouphead"><span class="stage-icon" aria-hidden="true">${icon}</span><div><h3>${title}</h3><small>${hint}</small></div><span class="count">${done}/${list.length}</span></header><div class="tasklist">${shown.length?shown.map(taskHTML).join(''):'<div class="empty">Nenhuma tarefa pendente neste filtro.</div>'}</div></section>`;
}
function statsHTML() {
  const list=due(),done=list.filter(t=>record(t).done).length,critical=list.filter(t=>t.prioridade==='critica'&&!record(t).done).length;
  const completedCycles=Object.entries(records).filter(([k,r])=>r.done&&r.date===selected&&tasks.find(t=>t.id===k.split('|')[0])?.frequencia!=='diaria').length;
  const total=list.length+completedCycles,completed=done+completedCycles,percent=total?Math.round(completed/total*100):100;
  return `<div class="stat accent"><small>Progresso do checklist</small><strong>${percent}<span style="font-size:19px">%</span></strong><div class="track"><i style="width:${percent}%"></i></div></div><div class="stat"><small>Concluídas</small><strong>${String(completed).padStart(2,'0')}</strong><span>inclui recorrentes feitas nesta data</span></div><div class="stat"><small>Pendentes</small><strong>${String(list.length-done).padStart(2,'0')}</strong><span>inclui cuidados ainda não feitos</span></div><div class="stat"><small>Críticas pendentes</small><strong>${String(critical).padStart(2,'0')}</strong><span>atenção especial da equipe</span></div>`;
}
function dailyView() {
  const list=due(),closing=list.filter(t=>t.momento==='fechamento'),pending=closing.filter(t=>!record(t).done).length,extra=list.filter(t=>t.frequencia!=='diaria');
  return `<div class="workspace"><div><div class="sectionbar"><h2>${dayNames[parse(selected).getDay()]}, ${format(selected,{day:'numeric',month:'long'})}</h2><div class="filters" aria-label="Filtrar tarefas"><button data-filter="all" class="filter ${filter==='all'?'active':''}">Todas</button><button data-filter="pending" class="filter ${filter==='pending'?'active':''}">Pendentes</button><button data-filter="critical" class="filter ${filter==='critical'?'active':''}">Críticas</button></div></div><div class="groups">
  ${Object.entries(titles).map(([moment,[title,hint,icon]])=>groupHTML(title,hint,icon,list.filter(t=>t.momento===moment),moment==='fechamento'?'close':'')).join('')}
  ${groupHTML('Cuidados programados','Continuam aqui até serem feitos; as conclusões ficam no Histórico.','▦',extra,'wide extras')}</div></div>
  <aside class="aside"><section class="remember"><span class="eyebrow">Combinados da loja</span><h3>Cuidados.<br>Todos os dias.</h3>${source.regras.map((rule,i)=>`<div class="rule"><strong>0${i+1}</strong><span>${esc(rule)}</span></div>`).join('')}</section><section class="closing"><h3>Antes de ir embora</h3><div class="closing-state ${pending?'':'ready'}"><span>${pending?'◷':'✓'}</span><span>${pending?`${pending} conferência(s) pendente(s)`:'Todas as conferências foram marcadas'}</span></div><p>Confira os equipamentos desligados, o lixo retirado e as lixeiras limpas.</p></section>
  <div class="tip"><span class="eyebrow">Como usar</span><p>Informe o nome de quem fez a tarefa antes de marcar a conclusão.</p><p>As tarefas semanais seguem os dias da rotina original. Uma pendência anterior permanece identificada pela data prevista.</p><p>Os cuidados mensais e quinzenais saem do checklist ao serem concluídos. Durante a semana programada, aparecem em destaque. Depois dela, ficam como atrasados até a conclusão.</p><p>Durante o expediente, continue guardando os cremes e cuidando do vidro mesmo após conferir.</p><div class="legend"><span class="badge scheduled">Programada agora</span><span class="badge overdue">Atrasada</span></div></div></aside></div>`;
}
function weekView() {
  const start=shift(selected,-((parse(selected).getDay()+6)%7));
  return `<div class="sectionbar"><h2>Sua semana, de segunda a domingo</h2></div><div class="weekintro"><strong>Todos os dias:</strong> 5 tarefas na abertura · 2 cuidados durante o expediente · 3 tarefas à noite · 3 conferências no fechamento.<br>Limpezas nos dias indicados pela loja. Pendências anteriores continuam aparecendo até a conclusão.</div><div class="weekgrid">${Array.from({length:7},(_,i)=>{
    const date=shift(start,i),extra=due(date).filter(t=>t.frequencia!=='diaria');
    return `<article class="daycard ${date===selected?'selected':''}"><h3>${dayNames[parse(date).getDay()]}</h3><small>${shortDate(date)}</small><ul>${extra.length?extra.map(t=>`<li>${esc(t.tarefa)} <small>(${shortDate(t.scheduledDate)})</small></li>`).join(''):'<li>Sem cuidados adicionais pendentes.</li>'}</ul><button class="btn" data-day="${date}">Abrir checklist →</button></article>`;
  }).join('')}</div>`;
}
function monthView() {
  const last=new Date(parse(selected).getFullYear(),parse(selected).getMonth()+1,0).getDate();
  return `<div class="sectionbar"><h2>${format(selected,{month:'long',year:'numeric'})}</h2></div><div class="weekintro">As semanas são contadas a partir do dia 1. Cuidados mensais e quinzenais pendentes permanecem no checklist, mesmo depois do período programado.</div><div class="monthgrid">${Array.from({length:Math.ceil(last/7)},(_,i)=>{
    const week=i+1,date=`${selected.slice(0,7)}-${String(i*7+1).padStart(2,'0')}`,list=tasks.filter(t=>Schedule.cycle(t)&&t.semanas_mes.includes(week));
    return `<article class="monthcard ${week===weekOfMonth(selected)?'selected':''}"><span class="num">${week}ª semana</span><h3>Dias ${i*7+1} a ${Math.min(week*7,last)}</h3><ul>${list.map(t=>`<li>${records[Schedule.key(t,date)]?.done?'✓ ':''}${esc(t.tarefa)}</li>`).join('')}</ul><p>${list.length?'Uma conclusão para cada tarefa deste período.':'Manter a rotina diária, semanal e as pendências anteriores.'}</p><button class="btn" data-day="${date}">Abrir período →</button></article>`;
  }).join('')}</div>`;
}
function historyView() {
  const rows=Object.entries(records).filter(([,r])=>r.done||r.owner).sort((a,b)=>b[1].date.localeCompare(a[1].date)||a[0].localeCompare(b[0]));
  return `<div class="sectionbar"><h2>Histórico de conferências</h2><span class="period">${rows.length} registros</span></div><p class="sub">Data prevista, data da conferência e nome de quem fez. Horários no fuso de São Paulo.</p>${rows.length?`<div class="tablewrap"><table><thead><tr><th>Prevista</th><th>Tarefa</th><th>Quem fez</th><th>Status</th><th>Conferência</th><th></th></tr></thead><tbody>${rows.map(([key,r])=>{
    const task=tasks.find(t=>t.id===key.split('|')[0]);
    return `<tr><td>${shortDate(r.scheduledDate)}</td><td>${esc(task.tarefa)}</td><td>${esc(r.owner)||'Não informado'}</td><td><span class="badge ${r.done?'ok':''}">${r.done?'Concluída':'Pendente'}</span></td><td>${r.completedAt?esc(new Date(r.completedAt).toLocaleString('pt-BR',{timeZone:tz})):'—'}</td><td>${r.done?`<button class="btn" data-undo="${esc(key)}">Reabrir tarefa</button>`:`<button class="btn" data-day="${r.date}">Ver dia</button>`}</td></tr>`;
  }).join('')}</tbody></table></div>`:'<div class="weekintro">Preencha um responsável ou conclua uma tarefa para começar.</div>'}<p class="sub">Exportar cria uma cópia de segurança. Ao importar registros diferentes dos existentes, você escolhe qual versão manter.</p>`;
}
function renderConflicts() {
  $('conflicts').innerHTML=Object.entries(conflicts).map(([key,c])=>{
    const task=tasks.find(t=>t.id===key.split('|')[0]),local=records[key];
    const describe=r=>r?`${r.done?'Concluída':'Pendente'} · ${esc(r.owner)||'Sem nome'}${r.completedAt?' · '+esc(new Date(r.completedAt).toLocaleString('pt-BR',{timeZone:tz})):''}`:'Sem registro';
    return `<section class="warning"><strong>Conferir alteração: ${esc(task.tarefa)}</strong><p>Equipe: ${describe(c.current)}</p><p>Neste computador: ${describe(local)}</p><button class="btn" data-resolve="${esc(key)}" data-local="false">Usar registro da equipe</button> <button class="btn" data-resolve="${esc(key)}" data-local="true">Enviar minha versão</button></section>`;
  }).join('');
}
function render() {
  $('date').value=selected; $('period').textContent=`${weekOfMonth(selected)}ª semana do mês · dias ${periodicRange(selected)}`;
  $('stats').hidden=view!=='today'; $('stats').innerHTML=statsHTML();
  document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',String(b.dataset.view===view));});
  $('content').innerHTML=view==='today'?dailyView():view==='week'?weekView():view==='month'?monthView():historyView();
  renderConflicts(); renderPending=false;
}
function receive(next, nextConflicts) {
  records=next; conflicts=nextConflicts;
  if (document.activeElement?.matches('[data-owner]')) { renderPending=true; return; }
  render();
}
const store=createChecklistStore({source,onChange:receive,onStatus:(status,message)=>{
  $('saveNote').textContent=message;
  $('syncMessage').textContent=message;
  $('syncPanel').hidden=status==='synced';
  $('syncLogin').hidden=status!=='auth';
  if (status==='storage-error') { $('storageWarning').hidden=false; $('storageWarning').textContent=message; }
}});
records=store.records; conflicts=store.conflicts;
document.addEventListener('focusout',()=>{setTimeout(()=>{if(renderPending&&!document.activeElement?.matches('[data-owner]'))render();},0);});
document.addEventListener('click',e=>{
  const v=e.target.closest('[data-view]'),f=e.target.closest('[data-filter]'),d=e.target.closest('[data-day]'),undo=e.target.closest('[data-undo]'),resolve=e.target.closest('[data-resolve]');
  if(v){view=v.dataset.view;render();} if(f){filter=f.dataset.filter;render();}
  if(d){selected=d.dataset.day;view='today';filter='all';render();window.scrollTo({top:0,behavior:'smooth'});}
  if(undo){const key=undo.dataset.undo;store.update(key,{...records[key],done:false,completedAt:null});toast('Tarefa reaberta. Ela voltou às pendências.');}
  if(resolve)store.resolve(resolve.dataset.resolve,resolve.dataset.local==='true');
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-owner]')) {
    const t=due().find(t=>t.key===e.target.dataset.owner);if(!t)return;
    const owner=e.target.value.trim(),r=record(t);
    if(r.done&&!owner){e.target.value=r.owner;toast('Uma tarefa concluída precisa do nome de quem fez.');return;}
    e.target.value=owner;
    store.update(t.key,{...r,owner});
  }
  if(e.target.matches('[data-check]')) {
    const t=due().find(t=>t.key===e.target.dataset.check);if(!t)return;
    const r=record(t),ownerInput=document.getElementById('owner-'+encodeURIComponent(t.key)),owner=ownerInput.value.trim();
    if(e.target.checked&&!owner){e.target.checked=false;ownerInput.setCustomValidity('Informe o nome de quem fez a tarefa.');ownerInput.reportValidity();ownerInput.focus();toast('Preencha o nome de quem fez antes de concluir.');return;}
    store.update(t.key,{...r,owner,done:e.target.checked,date:e.target.checked?selected:r.date,completedAt:e.target.checked?new Date().toISOString():null});
  }
});
document.addEventListener('input',e=>{if(e.target.matches('[data-owner]'))e.target.setCustomValidity('');});
$('syncLogin').onsubmit=e=>{e.preventDefault();void store.setToken($('teamCode').value);$('teamCode').value='';};
$('syncRetry').onclick=()=>void store.sync();
$('connectBtn').onclick=()=>{$('syncPanel').hidden=false;$('syncLogin').hidden=false;$('teamCode').focus();};
$('date').addEventListener('change',e=>{if(validDate(e.target.value)){selected=e.target.value;render();}else e.target.value=selected;});
$('prevDate').onclick=()=>{selected=shift(selected,-1);render();};$('nextDate').onclick=()=>{selected=shift(selected,1);render();};$('todayBtn').onclick=()=>{selected=today();render();};$('printBtn').onclick=()=>window.print();
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({schema:2,records,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`registros-zedoacai-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Cópia de segurança exportada.');};
$('importBtn').onclick=()=>$('importFile').click();
$('importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw Error('A cópia deve ter até 5 MB.');store.importData(JSON.parse(await file.text()));toast('Cópia importada. Confira eventuais alterações simultâneas.');}catch(error){toast('Não foi possível importar. '+error.message);}e.target.value='';};
render(); void store.sync();
