
async function finishActivity(id, e) {
  if (e) e.stopPropagation();
  // Require at least 1 photo before finishing
  const { data: imgs } = await sb.from('activity_images').select('id').eq('activity_id', id);
  if(!imgs || imgs.length === 0) {
    showToast('Sube al menos 1 foto antes de finalizar', 'error');
    return;
  }
  const { data } = await sb.from('activities').select('started_at').eq('id',id).single();
  const now = new Date();
  const started = data?.started_at ? new Date(data.started_at) : now;
  const mins = Math.max(0, Math.round((now - started) / 60000));
  const { error } = await sb.from('activities').update({
    status: 'completada',
    finished_at: localISOStr(),
    duration_minutes: mins
  }).eq('id', id);
  if(error) { showToast('Error', 'error'); return; }
  if(timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  showToast('Actividad completada &#10003;', 'success');
  loadTecnicoToday();
}
function startTimerDisplay(id, startedAt) {
  const el = document.getElementById('timer-'+id);
  if (!el) return;
  if (timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  // Use started_at from element data attribute, parameter, or now
  const sa = startedAt || el.dataset.started || null;
  const start = sa ? new Date(sa) : new Date();
  timers[id] = setInterval(function(){
    const diff = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
    const h = String(Math.floor(diff/3600)).padStart(2,'0');
    const m = String(Math.floor((diff%3600)/60)).padStart(2,'0');
    const s = String(diff%60).padStart(2,'0');
    const el2 = document.getElementById('timer-'+id);
    if(el2) el2.textContent = h+':'+m+':'+s;
    else { clearInterval(timers[id]); delete timers[id]; }
  }, 1000);
}
// GOOGLE DRIVE INTEGRATION
let driveToken = null;
let driveTokenExpiry = 0;
async function handleImageUpload(actId, input) {
  const files = Array.from(input.files);
  if(!files.length) return;
  showToast('Subiendo ' + files.length + ' imagen(es)...', 'success');

  // Get activity details
  const { data: act } = await sb.from('activities').select('title, week_id, scheduled_date').eq('id', actId).single();
  const actTitle = act?.title || 'Actividad';

  // Get week label for folder structure
  const week = allWeeks.find(w => w.id === act?.week_id);
  const weekLabel = week ? week.label : 'Semana sin etiqueta';

  // Get month label
  const date = act?.scheduled_date ? new Date(act.scheduled_date + 'T12:00:00') : new Date();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthLabel = monthNames[date.getMonth()] + ' ' + date.getFullYear();

  const APPS_SCRIPT = 'https://script.google.com/macros/s/AKfycbwURq9doqIIJhR-CYGoefgYQqSmXPPm5UBBud8U3rwe2DaUjaToGWTLLdI_oTyxnhbJ/exec';

  async function uploadOne(file, index) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const now = new Date();
    const ts = now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0')
      +'_'+String(now.getHours()).padStart(2,'0')+String(now.getMinutes()).padStart(2,'0')+String(now.getSeconds()+index).padStart(2,'0');
    const fileName = actTitle.substring(0,25).replace(/[^a-zA-Z0-9]/g,'_') + '_' + ts + '.jpg';
    const response = await fetch(APPS_SCRIPT, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        activityTitle: actTitle,
        monthLabel: monthLabel,
        weekLabel: weekLabel,
        fileName: fileName,
        fileBase64: base64,
        mimeType: file.type || 'image/jpeg',
        uploadedBy: currentUser.name
      })
    });
    const result = await response.json();
    if(!result.success) throw new Error(result.error || 'Error');
    await sb.from('activity_images').insert({
      activity_id: actId,
      drive_file_url: result.fileUrl,
      filename: fileName,
      uploaded_by: currentUser.id
    });
    return true;
  }

  // Upload all in parallel
  const results = await Promise.allSettled(files.map((f, i) => uploadOne(f, i)));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  const fail = results.filter(r => r.status === 'rejected').length;

  if(ok > 0) showToast(ok + ' foto(s) subida(s) ✓' + (fail > 0 ? ' · ' + fail + ' fallaron' : ''), 'success');
  else showToast('Error al subir fotos', 'error');
  loadImages(actId);
}

// COMMENTS
async function loadComments(actId) {
  const { data } = await sb.from('comments').select('*, users!comments_user_id_fkey(name)').eq('activity_id',actId).order('created_at');
  const el = document.getElementById('cmts-'+actId); if (!el) return;
  if (!data||data.length===0) { el.innerHTML='<div style="color:var(--muted);font-size:.75rem;margin-bottom:8px">Sin comentarios a&#250;n</div>'; return; }
  el.innerHTML = data.map(c=>`<div class="comment-item">
    <div class="comment-meta">
    <span class="comment-author" style="color:${c.users?.name==='Pedro'?'var(--pedro)':c.users?.name==='Said'?'var(--said)':'var(--accent)'}">${c.users?.name||'?'}</span>
    <span class="comment-time">${new Date(c.created_at).toLocaleString('es-MX',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</span>
    </div>
    <div class="comment-body">${c.body}</div>
  </div>`).join('');
}
async function addComment(actId) {
  const input = document.getElementById('cmt-input-'+actId);
  const body = input.value.trim(); if (!body) return;
  const { error } = await sb.from('comments').insert({ activity_id:actId, user_id:currentUser.id, body });
  if (error) { showToast('Error', 'error'); return; }
  input.value = ''; loadComments(actId); showToast('Comentario enviado', 'success');
}
// IMAGES LOAD
async function loadImages(actId, containerId) {
  var elId = containerId || 'imgs-'+actId;
  var r = await sb.from('activity_images').select('*').eq('activity_id', actId);
  var el = document.getElementById(elId);
  if(!el) return;
  var data = r.data;
  if(!data || !data.length){ el.innerHTML = ''; return; }
  var html = '';
  data.forEach(function(img){
    var url = img.drive_file_url || '';
    var parts = url.split('/d/');
    var fileId = parts.length > 1 ? parts[1].split('/')[0] : null;
    html += '<a href="' + url + '" target="_blank" class="img-thumb" style="display:block">';
    if(fileId) {
      html += '<img src="https://lh3.googleusercontent.com/d/' + fileId + '=w200" ';
      html += 'style="width:100%;height:80px;object-fit:cover;border-radius:6px;display:block">';
    }
    html += '<div style="font-size:.55rem;color:var(--muted);padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">';
    html += (img.filename || 'foto') + '</div></a>';
  });
  el.innerHTML = html;
}
// EDIT DESCRIPTION
function openEditDesc(id, encodedDesc) {
  document.getElementById('edit-desc-act-id').value = id;
  document.getElementById('edit-desc-text').value = decodeURIComponent(encodedDesc);
  document.getElementById('edit-desc-overlay').classList.add('open');
}
function closeEditDesc(e) { if (e.target===document.getElementById('edit-desc-overlay')) document.getElementById('edit-desc-overlay').classList.remove('open'); }
async function saveDescription() {
  const id = document.getElementById('edit-desc-act-id').value;
  const desc = document.getElementById('edit-desc-text').value.trim();
  if (!desc) return;
  const { error } = await sb.from('activities').update({ description: desc }).eq('id', id);
  if (error) { showToast('Error', 'error'); return; }
  document.getElementById('edit-desc-overlay').classList.remove('open');
  showToast('Descripci&#243;n actualizada &#10003;', 'success'); loadDashboard();
}
// MODAL HELPERS
function openModal() { populateUserSelects(); document.getElementById('modal-overlay').classList.add('open'); }
function closeModal(e) { if (e.target===document.getElementById('modal-overlay')) document.getElementById('modal-overlay').classList.remove('open'); }
// TOAST
// ── SEMANA ──
async function loadSemana(){
  var el=document.getElementById('week-selector-semana');
  if(!el) return;
  var weeksAsc=[...allWeeks].reverse();
  el.innerHTML=weeksAsc.map(function(w){var cls='week-chip'+(w.id===selectedWeekId?' active':'');return '<div class="'+cls+'" data-wid="'+w.id+'" onclick="semanaChipClick(this)">'+w.label+'</div>';}).join('');setTimeout(function(){var a=el.querySelector('.week-chip.active');if(a)a.scrollIntoView({inline:'center',behavior:'smooth'});},100);
  buildSemanaTable();
}
function selectWeekSemana(id,el){selectedWeekId=id;var parent=el.closest('#week-selector-semana');if(parent)parent.querySelectorAll('.week-chip').forEach(function(c){c.classList.remove('active');});el.classList.add('active');buildSemanaTable();}
async function buildSemanaTable(){
  var wrap=document.getElementById('semana-table');if(!wrap)return;
  wrap.innerHTML='<div class="loading"><div class="spinner"></div>Cargando...</div>';
  var week=allWeeks.find(function(w){return w.id===selectedWeekId;});
  if(!week){wrap.innerHTML='';return;}
  var r1=await sb.from('activities').select('*').eq('week_id',selectedWeekId).eq('is_fixed',false);
  var r2=await sb.from('activities').select('*').eq('is_fixed',true);
  var nonFixed=r1.data||[];
  var allFixed=r2.data||[];
  var fixedForWeek=[];
  var seen={};
  var wStart=new Date(week.start_date+'T12:00:00');
  allFixed.forEach(function(a){
    if(!a.scheduled_date) return;
    var origDate=new Date(a.scheduled_date+'T12:00:00');
    var dow=origDate.getDay();
    if(dow===0) return; // skip sunday
    var weekDate=new Date(wStart);
    while(weekDate.getDay()!==dow) weekDate.setDate(weekDate.getDate()+1);
    if(weekDate > new Date(week.end_date+'T12:00:00')) return;
    var dateStr=weekDate.toISOString().split('T')[0];
    var key=a.assigned_to+'_'+a.title+'_'+dateStr;
    if(!seen[key]){
    seen[key]=true;
    fixedForWeek.push(Object.assign({},a,{scheduled_date:dateStr}));
    }
  });
  var all=[...nonFixed,...fixedForWeek];
  var days=['Lun','Mar','Mie','Jue','Vie','Sab'];var dowMap=[1,2,3,4,5,6];
  var start=new Date(week.start_date+'T12:00:00');var dateByDow={};
  for(var i=0;i<7;i++){var d=new Date(start);d.setDate(start.getDate()+i);var dow=d.getDay();if(dow!==0)dateByDow[dow]=d.toISOString().split('T')[0];}
  var today=localDateStr();var nowStr=new Date().toTimeString().slice(0,5);
  var people=[allUsers.find(function(u){return u.name==='Pedro';}),allUsers.find(function(u){return u.name==='Said';}),allUsers.find(function(u){return u.name==='Julian';})].filter(Boolean);
  var html='<table style="width:100%;border-collapse:collapse;background:var(--surface);border-radius:12px;overflow:hidden;font-size:.72rem;min-width:580px;border:1px solid var(--border)">'
    +'<thead><tr style="background:var(--orange)">'
    +'<th style="padding:8px;text-align:left;color:#fff;font-size:.6rem;min-width:55px">Persona</th>';
  days.forEach(function(day,i){var date=dateByDow[dowMap[i]];var isToday=date===today;html+='<th style="padding:8px;text-align:center;color:#fff;font-size:.6rem;background:'+(isToday?'rgba(255,255,255,.2)':'')+'">'+'<div>'+day+'</div><div style="font-size:.55rem;opacity:.85">'+(date?date.slice(5).replace('-','/'):'')+'</div></th>';});
  html+='</tr></thead><tbody>';
  people.forEach(function(person){
    var color=person.name==='Pedro'?'var(--pedro)':person.name==='Said'?'var(--said)':'var(--orange)';
    var personActs=all.filter(function(a){return a.assigned_to===person.id;});
    html+='<tr style="border-top:1px solid var(--border)"><td style="padding:8px;font-weight:700;font-size:.9rem;color:'+color+';vertical-align:top">'+person.name+'</td>';
    dowMap.forEach(function(dow){
    var date=dateByDow[dow];var isToday=date===today;
    var dayActs=personActs.filter(function(a){return a.scheduled_date===date;});
    html+='<td style="padding:4px;vertical-align:top;background:'+(isToday?'rgba(234,88,12,.03)':'')+'">';
    if(!dayActs.length){html+='<div style="color:var(--border2);text-align:center;padding:6px 0;font-size:.65rem">-</div>';}
    else{dayActs.forEach(function(a){
    var isDone=a.status==='completada',isDelayed=isToday&&a.scheduled_start&&a.status==='pendiente'&&nowStr>a.scheduled_start,isInProg=a.status==='en_progreso';
    var bg=isDone?'rgba(21,128,61,.08)':isDelayed?'rgba(185,28,28,.08)':isInProg?'rgba(21,128,61,.06)':'rgba(31,41,55,.04)';
    var bc=isDone?'rgba(21,128,61,.25)':isDelayed?'rgba(185,28,28,.25)':isInProg?'rgba(21,128,61,.25)':'var(--border)';
    var isFixed=a.is_fixed;
    html+='<div style="background:'+bg+';border:1px solid '+bc+';border-radius:5px;padding:4px 5px;margin-bottom:3px">'
    +'<div style="display:flex;align-items:center;gap:2px;margin-bottom:3px">'
    +(isDelayed?'<span style="font-size:.6rem;color:var(--red)">!</span>':'')
    +(isInProg?'<span style="font-size:.6rem;color:var(--green)">&#9679;</span>':'')
    +(isDone?'<span style="font-size:.6rem;color:var(--green)">&#10003;</span>':'')
    +(isFixed?'<span style="font-size:.5rem;color:var(--fixed);font-weight:700;background:rgba(217,119,6,.1);padding:0 3px;border-radius:2px">F</span>':'')
    +'<span style="font-size:.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:var(--text)">'+(a.title.length>18?a.title.slice(0,16)+'..':a.title)+'</span></div>'
    +'<div style="display:flex;gap:2px;flex-wrap:wrap">'
    +'<button data-id="'+a.id+'" onclick="openReassign(this.dataset.id)" style="background:var(--accent);color:#fff;border:none;border-radius:3px;font-size:.5rem;padding:2px 5px;cursor:pointer">Reasignar</button>'
    +'<button data-id="'+a.id+'" onclick="openEditAct(this.dataset.id)" style="background:var(--orange);color:#fff;border:none;border-radius:3px;font-size:.5rem;padding:2px 5px;cursor:pointer">Editar</button>'
    +'<button data-id="'+a.id+'" data-date="'+(date||'')+'" onclick="openStatus(this.dataset.id,this.dataset.date)" style="background:var(--muted);color:#fff;border:none;border-radius:3px;font-size:.5rem;padding:2px 5px;cursor:pointer">Estado</button>'
    +'</div></div>';
    });}
    html+='</td>';
    });
    html+='</tr>';
  });
  wrap.innerHTML=html+'</tbody></table>';
}
function semanaChipClick(el){selectedWeekId=el.dataset.wid;var parent=el.closest('.week-selector');if(parent)parent.querySelectorAll('.week-chip').forEach(function(c){c.classList.remove('active');});el.classList.add('active');buildSemanaTable();}
function filterDashboard(q){if(!window._dashActs)return;q=q.toLowerCase().trim();var pedro=allUsers.find(function(u){return u.name==='Pedro';});var said=allUsers.find(function(u){return u.name==='Said';});var label=document.getElementById('dash-pending-label');var results=q?window._dashActs.filter(function(a){return !a.is_fixed&&a.title.toLowerCase().includes(q);}):window._dashActs.filter(function(a){return !a.is_fixed&&a.status!=='completada';});if(label)label.textContent=q?'Resultados: "'+q+'"':'Actividades pendientes';document.getElementById('acts-pedro').innerHTML=results.filter(function(a){return a.assigned_to===pedro?.id;}).map(function(a){return renderActCardSup(a);}).join('')||'<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin resultados</div>';document.getElementById('acts-said').innerHTML=results.filter(function(a){return a.assigned_to===said?.id;}).map(function(a){return renderActCardSup(a);}).join('')||'<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin resultados</div>';}
var MONTH_NAMES={'2026-05':'Mayo 2026','2026-06':'Junio 2026','2026-07':'Julio 2026','2026-08':'Agosto 2026','2026-09':'Septiembre 2026','2026-10':'Octubre 2026','2026-11':'Noviembre 2026','2026-12':'Diciembre 2026'};
async function toggleNext(el){var s=el.nextElementSibling;s.style.display=s.style.display==='none'?'block':'none';}
async function loadSupLista(){
  var el = document.getElementById('sup-lista-content');
  if(!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  var r = await sb.from('activities').select('*').eq('is_fixed', false).order('scheduled_date');
  var acts = r.data || [];

  // Separate pending/inprogress from completed
  var active = acts.filter(function(a){ return a.status !== 'completada'; });
  var done = acts.filter(function(a){ return a.status === 'completada'; });

  var html = '';

  // Active activities
  if(active.length) {
    html += "<div style='font-size:.62rem;color:var(--muted);letter-spacing:1px;margin-bottom:10px'>PENDIENTES / EN PROGRESO</div>";
    html += active.map(function(a){ return renderListCard(a); }).join('');
  }

  // Completed by week
  if(done.length) {
    html += '<div style="height:1px;background:var(--border);margin:20px 0"></div>';
    html += "<div style='font-size:.62rem;color:var(--green);letter-spacing:1px;margin-bottom:10px'>COMPLETADAS POR SEMANA</div>";

    // Group by week
    var byWeek = {};
    done.forEach(function(a) {
      var wid = a.week_id || 'sin-semana';
      if(!byWeek[wid]) byWeek[wid] = [];
      byWeek[wid].push(a);
    });

    // Sort weeks by start date
    var sortedWeeks = allWeeks.slice().sort(function(a,b){ return b.start_date.localeCompare(a.start_date); });

    sortedWeeks.forEach(function(week) {
      var weekActs = byWeek[week.id];
      if(!weekActs || !weekActs.length) return;
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px">';
      html += "<div style='font-size:.65rem;color:var(--accent);font-weight:700;margin-bottom:8px'>"+week.label+"</div>";
      html += weekActs.map(function(a){ return renderListCardDone(a); }).join('');
      html += '</div>';
    });

    // Activities without a week
    if(byWeek['sin-semana']) {
      html += '<div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px">';
      html += "<div style='font-size:.65rem;color:var(--muted);margin-bottom:8px'>SIN SEMANA ASIGNADA</div>";
      html += byWeek['sin-semana'].map(function(a){ return renderListCardDone(a); }).join('');
      html += '</div>';
    }
  }

  if(!html) html = '<div class="empty-state"><div class="empty-text">Sin actividades pendientes.<br>Todas las actividades estan completadas.</div></div>';
  el.innerHTML = html;
}


async function loadJulianDay(){
  loadSupWeekOverview();
  var julian=allUsers.find(function(u){return u.role==='supervisor';});if(!julian)return;
  var dayNames=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  var monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var today=new Date();today.setHours(0,0,0,0);
  var sel=new Date(selectedDayJulian);sel.setHours(0,0,0,0);
  var diff=Math.round((sel-today)/86400000);
  var prefix=diff===0?'HOY - ':diff===1?'MANANA - ':diff===-1?'AYER - ':'';
  var dn=document.getElementById('julian-day-name');var dd=document.getElementById('julian-day-date');
  if(dn)dn.textContent=prefix+dayNames[selectedDayJulian.getDay()].toUpperCase();
  if(dd)dd.textContent=selectedDayJulian.getDate()+' de '+monthNames[selectedDayJulian.getMonth()]+' '+selectedDayJulian.getFullYear();
  var viewDate=(selectedDayJulian.getFullYear()+'-'+String(selectedDayJulian.getMonth()+1).padStart(2,'0')+'-'+String(selectedDayJulian.getDate()).padStart(2,'0'));
  var isToday=diff===0;
  var mw=allWeeks.find(function(w){return viewDate>=w.start_date&&viewDate<=w.end_date;});
  var weekId=mw?mw.id:selectedWeekId;
  var r=await sb.from('activities').select('*').eq('assigned_to',julian.id).eq('is_fixed',false).eq('scheduled_date',viewDate);
  var acts=r.data||[];
  var listEl=document.getElementById('julian-hoy-acts');if(!listEl)return;
  if(!acts.length){listEl.innerHTML='<div class="empty-state"><div class="empty-icon">&#128203;</div><div class="empty-text">'+(isToday?'Sin actividades para hoy':'Sin actividades este dia')+'</div></div>';return;}
  listEl.innerHTML = acts.map(function(a){ return renderActCardSup(a); }).join('');
  acts.filter(function(a){ return a.status==='en_progreso'; }).forEach(function(a){
    var tEl = document.getElementById('timer-sup-'+a.id);
    if(tEl) startTimerDisplay(a.id, a.started_at);
  });
}
async function startActivity2(el){var id=el.dataset.id;await sb.from('activities').update({status:'en_progreso',started_at:localISOStr()}).eq('id',id);showToast('Iniciada','success');loadJulianDay();}
async function finishActivity2(el){var id=el.dataset.id;var r=await sb.from('activities').select('started_at').eq('id',id).single();var s=r.data&&r.data.started_at?new Date(r.data.started_at):new Date();var mins=Math.round((new Date()-s)/60000);await sb.from('activities').update({status:'completada',finished_at:localISOStr(),duration_minutes:mins}).eq('id',id);if(timers[id]){clearInterval(timers[id]);delete timers[id];}showToast('Completada','success');loadJulianDay();loadDashboard();}
async function julianRegresar(el){var id=el.dataset.id;if(timers[id]){clearInterval(timers[id]);delete timers[id];}var t=new Date();t.setDate(t.getDate()+1);await sb.from('activities').update({scheduled_date:t.toISOString().split('T')[0],status:'pendiente',started_at:null}).eq('id',id);showToast('Regresada','success');loadJulianDay();}
async function addComment2(actId,body){if(!body||!body.trim())return;await sb.from('comments').insert({activity_id:actId,user_id:currentUser.id,body:body.trim()});loadComments(actId,'jcmts-'+actId);showToast('Enviado','success');}
async function loadJulianList(){
  var julian=allUsers.find(function(u){return u.role==='supervisor';});if(!julian)return;
  var r=await sb.from('activities').select('*').eq('assigned_to',julian.id).eq('is_fixed',false).order('scheduled_date');
  var all=r.data||[];
  var mkRow=function(a){var dur=a.duration_minutes?' - '+Math.floor(a.duration_minutes/60)+'h '+a.duration_minutes%60+'m':'';var dateStr=a.scheduled_date?new Date(a.scheduled_date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}):'Sin fecha';return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:6px"><div style="flex:1"><div style="font-size:.82rem;font-weight:500">'+a.title+'</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px"><span class="act-type-pill type-'+a.type+'" style="font-size:.52rem">'+a.type+'</span><span style="margin-left:6px">'+dateStr+dur+'</span></div></div><button data-id="'+a.id+'" onclick="openEditAct(this.dataset.id)" class="btn btn-outline btn-sm" style="flex-shrink:0">Editar</button></div>';};
  var pEl=document.getElementById('julian-list-prog');var pendEl=document.getElementById('julian-list-pend');var doneEl=document.getElementById('julian-list-done');
  if(pEl)pEl.innerHTML=all.filter(function(a){return a.status==='en_progreso';}).map(mkRow).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades en progreso</div>';
  if(pendEl)pendEl.innerHTML=all.filter(function(a){return a.status==='pendiente'||a.status==='revisar';}).map(mkRow).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades pendientes</div>';
  if(doneEl)doneEl.innerHTML=all.filter(function(a){return a.status==='completada';}).sort(function(a,b){return new Date(b.finished_at||b.created_at)-new Date(a.finished_at||a.created_at);}).map(mkRow).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades completadas</div>';
}
async function supCancelStart(id) {
  if(!id || id === 'null') return;
  const { error } = await sb.from('activities').update({
    status: 'pendiente',
    started_at: null
  }).eq('id', id);
  if(error) { showToast('Error', 'error'); return; }
  showToast('Inicio cancelado', 'success');
  loadDashboard();
}
