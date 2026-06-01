async function openReassign(id){
  var r=await sb.from('activities').select('*').eq('id',id).single();var a=r.data;if(!a)return;
  document.getElementById('reassign-act-id').value=id;
  document.getElementById('reassign-act-name').textContent=a.title;
  document.getElementById('reassign-date').value=a.scheduled_date||'';
  var sel=document.getElementById('reassign-user');
  sel.innerHTML='<option value="">- Sin asignar -</option>'+allUsers.map(function(u){return '<option value="'+u.id+'"'+(u.id===a.assigned_to?' selected':'')+'>'+u.name+(u.role==='supervisor'?' (Sup)':'')+'</option>';}).join('');
  document.getElementById('reassign-overlay').classList.add('open');
}
async function saveReassign(){
  var id=document.getElementById('reassign-act-id').value;
  var assigned=document.getElementById('reassign-user').value||null;
  var date=document.getElementById('reassign-date').value||null;
  if(!date){showToast('Selecciona una fecha','error');return;}
  var mw=allWeeks.find(function(w){return date>=w.start_date&&date<=w.end_date;});
  await sb.from('activities').update({assigned_to:assigned,scheduled_date:date,week_id:mw?mw.id:selectedWeekId}).eq('id',id);
  document.getElementById('reassign-overlay').classList.remove('open');
  showToast('Reasignada','success');loadDashboard();buildSemanaTable();
}
async function openEditAct(id){
  var r=await sb.from('activities').select('*').eq('id',id).single();var a=r.data;if(!a)return;
  document.getElementById('edit-act-id').value=id;
  document.getElementById('edit-title').value=a.title||'';
  document.getElementById('edit-type').value=a.type||'pendiente';
  document.getElementById('edit-date').value=a.scheduled_date||'';
  document.getElementById('edit-start').value=a.scheduled_start?a.scheduled_start.slice(0,5):'';
  document.getElementById('edit-end').value=a.scheduled_end?a.scheduled_end.slice(0,5):'';
  document.getElementById('edit-notes').value=a.description||'';
  var sel=document.getElementById('edit-assigned');
  sel.innerHTML='<option value="">- Sin asignar -</option>'+allUsers.map(function(u){return '<option value="'+u.id+'"'+(u.id===a.assigned_to?' selected':'')+'>'+u.name+(u.role==='supervisor'?' (Sup)':'')+'</option>';}).join('');
  document.getElementById('edit-overlay').classList.add('open');
}
async function saveEdit(){
  var id=document.getElementById('edit-act-id').value;
  var date=document.getElementById('edit-date').value||null;
  var mw=allWeeks.find(function(w){return date&&date>=w.start_date&&date<=w.end_date;});
  await sb.from('activities').update({title:document.getElementById('edit-title').value.trim(),type:document.getElementById('edit-type').value,assigned_to:document.getElementById('edit-assigned').value||null,scheduled_date:date,week_id:mw?mw.id:selectedWeekId,scheduled_start:document.getElementById('edit-start').value||null,scheduled_end:document.getElementById('edit-end').value||null,description:document.getElementById('edit-notes').value.trim()||null,is_fixed:document.getElementById('edit-type').value==='fija'}).eq('id',id);
  document.getElementById('edit-overlay').classList.remove('open');
  showToast('Guardado','success');loadDashboard();
}
async function deleteActivityEdit(){
  var id=document.getElementById('edit-act-id').value;
  if(!confirm('Eliminar esta actividad?'))return;
  await sb.from('activity_images').delete().eq('activity_id',id);
  await sb.from('comments').delete().eq('activity_id',id);
  await sb.from('activities').delete().eq('id',id);
  document.getElementById('edit-overlay').classList.remove('open');
  showToast('Eliminada','success');loadDashboard();
}
async function openStatus(id,date){
  var r=await sb.from('activities').select('*').eq('id',id).single();var a=r.data;if(!a)return;
  var now=new Date();var nowStr=now.toTimeString().slice(0,5);var todayStr=now.toISOString().split('T')[0];var isToday=date===todayStr;
  var who=allUsers.find(function(u){return u.id===a.assigned_to;});
  var whoColor=who?(who.name==='Pedro'?'var(--pedro)':who.name==='Said'?'var(--said)':'var(--orange)'):'var(--muted2)';
  var html='<div style="margin-bottom:12px"><div style="font-weight:600;font-size:.9rem;margin-bottom:4px">'+a.title+'</div><div style="font-size:.65rem;color:'+whoColor+'">'+(who?who.name:'Sin asignar')+'</div></div>';
  if(a.status==='completada'){var fin=a.finished_at?new Date(a.finished_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'--';var dur=a.duration_minutes?Math.floor(a.duration_minutes/60)+'h '+a.duration_minutes%60+'m':'--';html+='<div style="background:rgba(21,128,61,.08);border:1.5px solid rgba(21,128,61,.2);border-radius:10px;padding:14px"><div style="font-size:1.2rem;margin-bottom:6px">&#10003;</div><div style="font-weight:600;color:var(--green);margin-bottom:4px">Completada</div><div style="font-size:.72rem;color:var(--muted2)">A las <strong>'+fin+'</strong> - Duracion: <strong>'+dur+'</strong></div></div>';}
  else if(a.status==='en_progreso'){var st=a.started_at?new Date(a.started_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'--';var el2=a.started_at?Math.floor((now-new Date(a.started_at))/60000):0;html+='<div style="background:rgba(21,128,61,.08);border:1.5px solid rgba(21,128,61,.2);border-radius:10px;padding:14px"><div style="font-size:1.2rem;margin-bottom:6px">&#9679;</div><div style="font-weight:600;color:var(--green);margin-bottom:4px">En progreso</div><div style="font-size:.72rem;color:var(--muted2)">Inicio a las <strong>'+st+'</strong></div><div style="font-size:.85rem;color:var(--green);margin-top:4px;font-weight:600">'+Math.floor(el2/60)+'h '+el2%60+'m transcurridos</div></div>';}
  else{var stime=a.scheduled_start?a.scheduled_start.slice(0,5):null;var isDelayed=isToday&&stime&&nowStr>stime;if(isDelayed){var dm=Math.floor((now-new Date(now.toDateString()+' '+stime))/60000);html+='<div style="background:rgba(185,28,28,.08);border:1.5px solid rgba(185,28,28,.2);border-radius:10px;padding:14px"><div style="font-size:1.2rem;margin-bottom:6px">!</div><div style="font-weight:600;color:var(--red);margin-bottom:4px">Retrasada</div><div style="font-size:.72rem;color:var(--muted2)">Debio iniciar a las <strong>'+stime+'</strong></div><div style="font-size:.85rem;color:var(--red);margin-top:4px;font-weight:600">Retraso: '+Math.floor(dm/60)+'h '+dm%60+'m</div></div>';}else if(stime){var dlabel=date===todayStr?'hoy':(date?new Date(date+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'}):'sin fecha');html+='<div style="background:rgba(217,119,6,.08);border:1.5px solid rgba(217,119,6,.2);border-radius:10px;padding:14px"><div style="font-size:1.2rem;margin-bottom:6px">&#128467;</div><div style="font-weight:600;color:var(--fixed);margin-bottom:4px">Programada</div><div style="font-size:.72rem;color:var(--muted2)">Fecha: <strong>'+dlabel+'</strong> - Hora: <strong>'+stime+'</strong></div></div>';}else{html+='<div style="background:var(--card2);border:1.5px solid var(--border);border-radius:10px;padding:14px"><div style="font-size:1.2rem;margin-bottom:6px">&#128203;</div><div style="font-weight:600;color:var(--muted2);margin-bottom:4px">Pendiente</div><div style="font-size:.72rem;color:var(--muted)">Sin hora programada</div></div>';}}
  document.getElementById('status-modal-content').innerHTML=html;
  document.getElementById('status-overlay').classList.add('open');
}
async function confirmarRehacer(){
  var id=document.getElementById('rehacer-act-id').value;
  var motivo=document.getElementById('rehacer-motivo').value.trim();
  var assignedTo=document.getElementById('rehacer-user').value||null;
  var date=document.getElementById('rehacer-date').value;
  if(!motivo){showToast('Escribe el motivo','error');return;}
  var r=await sb.from('activities').select('*').eq('id',id).single();var orig=r.data;if(!orig)return;
  await sb.from('comments').insert({activity_id:id,user_id:currentUser.id,body:'REHACER: '+motivo});
  var mw=allWeeks.find(function(w){return date>=w.start_date&&date<=w.end_date;});
  await sb.from('activities').insert({title:orig.title,type:orig.type,assigned_to:assignedTo,week_id:mw?mw.id:selectedWeekId,scheduled_date:date,scheduled_start:orig.scheduled_start,scheduled_end:orig.scheduled_end,description:'[REHACER] Motivo: '+motivo,is_fixed:false,status:'pendiente',created_by:currentUser.id,scheduled_month:date.substring(0,7)});
  document.getElementById('rehacer-overlay').classList.remove('open');
  showToast('Marcada para rehacer','success');loadDashboard();
}
async function loadDashboardExtras(acts){
  var today=localDateStr();
  var dayName=new Date().toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'});
  var todayActs=acts.filter(function(a){return !a.is_fixed&&a.scheduled_date===today;});
  var pend=todayActs.filter(function(a){return a.status==='pendiente'||a.status==='revisar';}).length;
  var prog=todayActs.filter(function(a){return a.status==='en_progreso';}).length;
  var done=todayActs.filter(function(a){return a.status==='completada';}).length;
  var sumEl=document.getElementById('today-summary');
  if(sumEl)sumEl.innerHTML='<div style="background:var(--accent);border-radius:12px;padding:14px 16px;color:#fff;margin-bottom:4px">'
    +'<div style="font-size:.62rem;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;margin-bottom:6px">Hoy - '+dayName+'</div>'
    +'<div style="display:flex;gap:16px">'
    +'<div><div style="font-size:1.8rem;font-weight:700;line-height:1">'+pend+'</div><div style="font-size:.65rem;opacity:.8">Pendientes</div></div>'
    +'<div><div style="font-size:1.8rem;font-weight:700;line-height:1;color:#fbbf24">'+prog+'</div><div style="font-size:.65rem;opacity:.8">En progreso</div></div>'
    +'<div><div style="font-size:1.8rem;font-weight:700;line-height:1;color:#86efac">'+done+'</div><div style="font-size:.65rem;opacity:.8">Completadas</div></div>'
    +'</div></div>';
  window._dashActs=acts;
  var pedro=allUsers.find(function(u){return u.name==='Pedro';});
  var said=allUsers.find(function(u){return u.name==='Said';});
  var pending=acts.filter(function(a){return !a.is_fixed&&a.status!=='completada';});
  var pEl=document.getElementById('acts-pedro');
  var sEl=document.getElementById('acts-said');
  if(pEl)pEl.innerHTML=pending.filter(function(a){return a.assigned_to===pedro?.id;}).map(function(a){return renderActCardSup(a);}).join('')||'<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin actividades pendientes</div>';
  if(sEl)sEl.innerHTML=pending.filter(function(a){return a.assigned_to===said?.id;}).map(function(a){return renderActCardSup(a);}).join('')||'<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin actividades pendientes</div>';
  var completed=acts.filter(function(a){return !a.is_fixed&&a.status==='completada';}).sort(function(a,b){return new Date(b.finished_at||0)-new Date(a.finished_at||0);});
  var cEl=document.getElementById('acts-completed');
  if(cEl)cEl.innerHTML=completed.length===0?'<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin actividades completadas esta semana</div>':completed.map(function(a){var who=allUsers.find(function(u){return u.id===a.assigned_to;});var whoColor=who?(who.name==='Pedro'?'var(--pedro)':who.name==='Said'?'var(--said)':'var(--orange)'):'var(--muted2)';var dur=a.duration_minutes?Math.floor(a.duration_minutes/60)+'h '+a.duration_minutes%60+'m':'';var fin=a.finished_at?new Date(a.finished_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'';return '<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-left:4px solid var(--green);border-radius:8px;margin-bottom:6px"><span style="color:var(--green)">&#10003;</span><div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+a.title+'</div><div style="font-size:.65rem;color:var(--muted);margin-top:2px"><span style="color:'+whoColor+';font-weight:600">'+(who?who.name:'?')+'</span>'+(fin?' - '+fin:'')+(dur?' - '+dur:'')+'</div></div><button data-id="'+a.id+'" class="rehacer-btn" style="background:rgba(185,28,28,.08);border:1px solid rgba(185,28,28,.25);color:var(--red);font-size:.58rem;padding:3px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;flex-shrink:0">Rehacer</button></div>';}).join('');
}
function jCardOpen(h){var c=h.closest('.act-card');if(c.classList.toggle('open')){var id=h.dataset.jid;loadComments(id,'jcmts-'+id);}}
function closeModal2(el,e){if(e.target===el)el.classList.remove('open');}
async function downloadPDF(mode){
  var {jsPDF} = window.jspdf;
  if(!jsPDF){ showToast('Libreria PDF no disponible','error'); return; }
  var doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pageW=210, margin=15, y=20;
  var now=new Date();
  doc.setFillColor(31,41,55);
  doc.rect(0,0,pageW,30,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(20);
  doc.setFont('helvetica','bold');
  doc.text('AVI-MEX - Planta Jojutla',margin,12);
  doc.setFontSize(10);
  doc.setFont('helvetica','normal');
  doc.text('Sistema de Mantenimiento Industrial',margin,19);
  doc.text('Generado: '+now.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),margin,26);
  y=40;
  var pedro=allUsers.find(function(u){return u.name==='Pedro';});
  var said=allUsers.find(function(u){return u.name==='Said';});
  function addTableHeader(cols,x,y,w){
    doc.setFillColor(234,88,12);
    doc.rect(x,y-5,w,8,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(8);
    doc.setFont('helvetica','bold');
    var colW=w/cols.length;
    cols.forEach(function(c,i){doc.text(c,x+colW*i+2,y);});
    doc.setTextColor(0,0,0);
    doc.setFont('helvetica','normal');
    return y+8;
  }
  function addRow(cells,x,y,w,shade){
    if(shade){doc.setFillColor(242,242,244);doc.rect(x,y-5,w,7,'F');}
    doc.setFontSize(7.5);
    var colW=w/cells.length;
    cells.forEach(function(c,i){doc.text(String(c||'').slice(0,30),x+colW*i+2,y);});
    return y+7;
  }
  function checkPage(y){
    if(y>270){doc.addPage();return 20;}
    return y;
  }
  if(mode==='week'){
    var week=allWeeks.find(function(w){return w.id===selectedWeekId;});
    doc.setFontSize(14);doc.setFont('helvetica','bold');
    doc.text('Reporte Semanal - '+(week?week.label:'Semana actual'),margin,y);y+=8;
    var r=await sb.from('activities').select('*').eq('week_id',selectedWeekId).eq('is_fixed',false).order('scheduled_date');
    var acts=r.data||[];
    doc.setFontSize(10);doc.setFont('helvetica','normal');
    doc.text('Total actividades: '+acts.length+' | Completadas: '+acts.filter(function(a){return a.status==='completada';}).length+' | Pendientes: '+acts.filter(function(a){return a.status==='pendiente';}).length,margin,y);y+=10;
    [pedro,said].forEach(function(person){
    if(!person)return;
    var pa=acts.filter(function(a){return a.assigned_to===person.id;});
    var done=pa.filter(function(a){return a.status==='completada';}).length;
    var pct=pa.length?Math.round(done/pa.length*100):0;
    var mins=pa.filter(function(a){return a.status==='completada';}).reduce(function(s,a){return s+(a.duration_minutes||0);},0);
    doc.setFontSize(9);doc.setFont('helvetica','bold');
    doc.text(person.name+': '+done+'/'+pa.length+' completadas ('+pct+'%) - '+Math.floor(mins/60)+'h '+mins%60+'m',margin,y);y+=6;
    });
    y+=4;
    y=addTableHeader(['Actividad','Tipo','Asignado','Estado','Duracion'],margin,y,pageW-margin*2);
    acts.forEach(function(a,i){
    y=checkPage(y);
    var who=allUsers.find(function(u){return u.id===a.assigned_to;});
    var dur=a.duration_minutes?Math.floor(a.duration_minutes/60)+'h '+a.duration_minutes%60+'m':'';
    y=addRow([a.title.slice(0,35),a.type,who?who.name:'',a.status,dur],margin,y,pageW-margin*2,i%2===0);
    });
    doc.save('avimex_semana_'+(week?week.label.replace(/\s/g,'_'):now.toISOString().split('T')[0])+'.pdf');
  } else if(mode==='month'){
    var monthKey=prompt('Mes a descargar (ej: 2026-05):',now.toISOString().substring(0,7));
    if(!monthKey)return;
    var mNames={'2026-05':'Mayo 2026','2026-06':'Junio 2026','2026-07':'Julio 2026','2026-08':'Agosto 2026','2026-09':'Septiembre 2026','2026-10':'Octubre 2026','2026-11':'Noviembre 2026','2026-12':'Diciembre 2026'};
    var monthLabel=mNames[monthKey]||monthKey;
    doc.setFontSize(14);doc.setFont('helvetica','bold');
    doc.text('Reporte Mensual - '+monthLabel,margin,y);y+=8;
    var r2=await sb.from('activities').select('*').eq('scheduled_month',monthKey).eq('is_fixed',false).order('scheduled_date');
    var acts2=r2.data||[];
    doc.setFontSize(10);doc.setFont('helvetica','normal');
    doc.text('Total: '+acts2.length+' | Completadas: '+acts2.filter(function(a){return a.status==='completada';}).length,margin,y);y+=10;
    [pedro,said].forEach(function(person){
    if(!person)return;
    var pa=acts2.filter(function(a){return a.assigned_to===person.id&&a.status==='completada';});
    var mins=pa.reduce(function(s,a){return s+(a.duration_minutes||0);},0);
    doc.setFontSize(9);doc.setFont('helvetica','bold');
    doc.text(person.name+': '+pa.length+' completadas - '+Math.floor(mins/60)+'h '+mins%60+'m trabajadas',margin,y);y+=6;
    });
    y+=4;
    var byWeek={};
    acts2.forEach(function(a){var k=a.week_id||'sin';if(!byWeek[k])byWeek[k]=[];byWeek[k].push(a);});
    Object.keys(byWeek).forEach(function(wid){
    var week2=allWeeks.find(function(w){return w.id===wid;});
    y=checkPage(y);
    doc.setFontSize(9);doc.setFont('helvetica','bold');
    doc.text(week2?week2.label:'Sin semana',margin,y);y+=4;
    y=addTableHeader(['Actividad','Tipo','Asignado','Estado','Dur.'],margin,y,pageW-margin*2);
    byWeek[wid].forEach(function(a,i){
    y=checkPage(y);
    var who=allUsers.find(function(u){return u.id===a.assigned_to;});
    var dur=a.duration_minutes?Math.floor(a.duration_minutes/60)+'h '+a.duration_minutes%60+'m':'';
    y=addRow([a.title.slice(0,35),a.type,who?who.name:'',a.status,dur],margin,y,pageW-margin*2,i%2===0);
    });
    y+=4;
    });
    doc.save('avimex_mensual_'+monthLabel.replace(/\s/g,'_')+'.pdf');
  } else if(mode==='year'){
    var yearKey=prompt('Anio a descargar (ej: 2026):','2026');
    if(!yearKey)return;
    doc.setFontSize(14);doc.setFont('helvetica','bold');
    doc.text('Reporte Anual - '+yearKey,margin,y);y+=10;
    var months2=['01','02','03','04','05','06','07','08','09','10','11','12'];
    var mLabels=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    for(var mi=0;mi<months2.length;mi++){
    var mk=yearKey+'-'+months2[mi];
    var r3=await sb.from('activities').select('*').eq('scheduled_month',mk).eq('is_fixed',false);
    var mActs=r3.data||[];
    if(!mActs.length)continue;
    y=checkPage(y);
    doc.setFontSize(11);doc.setFont('helvetica','bold');
    doc.setFillColor(31,41,55);doc.rect(margin,y-5,pageW-margin*2,8,'F');
    doc.setTextColor(255,255,255);
    doc.text(mLabels[mi]+' '+yearKey,margin+2,y);
    doc.setTextColor(0,0,0);y+=8;
    var done3=mActs.filter(function(a){return a.status==='completada';}).length;
    doc.setFontSize(8);doc.setFont('helvetica','normal');
    doc.text('Total: '+mActs.length+' | Completadas: '+done3+' | Pendientes: '+(mActs.length-done3),margin,y);y+=5;
    [pedro,said].forEach(function(person){
    if(!person)return;
    var pa3=mActs.filter(function(a){return a.assigned_to===person.id&&a.status==='completada';});
    var mins3=pa3.reduce(function(s,a){return s+(a.duration_minutes||0);},0);
    if(pa3.length>0){doc.text('  '+person.name+': '+pa3.length+' completadas, '+Math.floor(mins3/60)+'h '+mins3%60+'m',margin,y);y+=4;}
    });
    y+=3;
    }
    doc.save('avimex_anual_'+yearKey+'.pdf');
  }
  showToast('PDF generado','success');
}
function tecSubTab(tab){
  document.getElementById('tec-panel-hoy').style.display = tab==='hoy'?'block':'none';
  document.getElementById('tec-panel-lista').style.display = tab==='lista'?'block':'none';
  var h=document.getElementById('tec-sub-hoy'), l=document.getElementById('tec-sub-lista');
  if(h){ h.style.background=tab==='hoy'?'var(--orange)':'transparent'; h.style.color=tab==='hoy'?'#fff':'var(--muted2)'; h.style.borderColor=tab==='hoy'?'var(--orange)':'var(--border2)'; }
  if(l){ l.style.background=tab==='lista'?'var(--orange)':'transparent'; l.style.color=tab==='lista'?'#fff':'var(--muted2)'; l.style.borderColor=tab==='lista'?'var(--orange)':'var(--border2)'; }
  if(tab==='lista') loadTecListaCompleta();
}
async function loadTecListaCompleta() {
  var r = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id).eq('is_fixed', false)
    .order('scheduled_date');
  var all = r.data || [];
  var prog = all.filter(function(a){ return a.status === 'en_progreso'; });
  var pend = all.filter(function(a){ return a.status === 'pendiente' || a.status === 'revisar'; });
  var done = all.filter(function(a){ return a.status === 'completada'; })
    .sort(function(a,b){ return new Date(b.finished_at||b.created_at) - new Date(a.finished_at||a.created_at); });

  var pEl = document.getElementById('tec-list-prog');
  var pendEl = document.getElementById('tec-list-pend');
  var doneEl = document.getElementById('tec-list-done');

  if(pEl) pEl.innerHTML = prog.length
    ? prog.map(function(a){ return renderActCardTec(a, true); }).join('')
    : '<div style="color:var(--muted);font-size:.8rem;padding:6px 0">Sin actividades en progreso</div>';

  if(pendEl) pendEl.innerHTML = pend.length
    ? pend.map(function(a){ return renderActCardTec(a, true); }).join('')
    : '<div style="color:var(--muted);font-size:.8rem;padding:6px 0">Sin actividades pendientes</div>';

  if(doneEl) doneEl.innerHTML = done.length
    ? done.map(function(a){ return renderActCardTec(a, true); }).join('')
    : '<div style="color:var(--muted);font-size:.8rem;padding:6px 0">Sin actividades completadas</div>';

  // Start timers for in-progress
  prog.forEach(function(a){
    if(document.getElementById('timer-'+a.id)) startTimerDisplay(a.id, a.started_at);
  });
}


async function addTecToToday(el){
  var id=el.dataset.id;
  var today=localDateStr();
  var mw=allWeeks.find(function(w){return today>=w.start_date&&today<=w.end_date;});
  var r=await sb.from('activities').update({scheduled_date:today,week_id:mw?mw.id:selectedWeekId,status:'pendiente'}).eq('id',id);
  if(r.error){showToast('Error','error');return;}
  showToast('Agregada a hoy','success');
  tecSubTab('hoy'); loadTecnicoToday();
}
function updateTecDayHeader(){
  var dayNames=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  var monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var today=new Date(); today.setHours(0,0,0,0);
  var sel=new Date(selectedDayTec); sel.setHours(0,0,0,0);
  var diff=Math.round((sel-today)/86400000);
  var prefix=diff===0?'HOY - ':diff===1?'MANANA - ':diff===-1?'AYER - ':'';
  var dn=document.getElementById('tec-day-name');
  var dd=document.getElementById('tec-day-date');
  if(dn) dn.textContent=prefix+dayNames[selectedDayTec.getDay()].toUpperCase();
  if(dd) dd.textContent=selectedDayTec.getDate()+' de '+monthNames[selectedDayTec.getMonth()]+' '+selectedDayTec.getFullYear();
  var nt=document.getElementById('tec-name-title');
  if(nt) nt.textContent='Semana actual';
}
function cambiarDiaTec(delta){
  selectedDayTec=new Date(selectedDayTec.getFullYear(),selectedDayTec.getMonth(),selectedDayTec.getDate()+delta,12,0,0);
  var d=selectedDayTec.getFullYear()+'-'+String(selectedDayTec.getMonth()+1).padStart(2,'0')+'-'+String(selectedDayTec.getDate()).padStart(2,'0');
  var mw=allWeeks.find(function(w){return d>=w.start_date&&d<=w.end_date;});
  if(mw) selectedWeekId=mw.id;
  loadTecnicoToday();
}
function toggleFixedCard(h){
  var c=h.closest('.act-card');
  if(c.classList.toggle('open')){
    var id=h.dataset.id;
    loadComments(id,'fcmts-'+id);
    loadImages(id,'fimgs-'+id);
  }
}
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent=msg; t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'), 3000);
}
// START

async function openRehacer(id,e){
  if(e) e.stopPropagation();
  var r=await sb.from('activities').select('*').eq('id',id).single();
  var a=r.data; if(!a) return;
  document.getElementById('rehacer-act-id').value=id;
  document.getElementById('rehacer-act-name').textContent=a.title;
  var who=allUsers.find(function(u){return u.id===a.assigned_to;});
  document.getElementById('rehacer-act-who').textContent='Realizada por: '+(who?who.name:'Sin asignar');
  document.getElementById('rehacer-motivo').value='';
  document.getElementById('rehacer-date').value=localDateStr();
  var sel=document.getElementById('rehacer-user');
  sel.innerHTML='<option value="">- Sin asignar -</option>'+allUsers.map(function(u){
    return '<option value="'+u.id+'"'+(u.id===a.assigned_to?' selected':'')+'>'+u.name+(u.role==='supervisor'?' (Sup)':'')+'</option>';
  }).join('');
  document.getElementById('rehacer-overlay').classList.add('open');
}