// CONFIG
const SUPABASE_URL = 'https://eaeuqcdcnkztttkfvbut.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f89Uz7LwwTcjqpdKKzXlYg_HuNsTtC3';


// Google Drive integration removed
let sb = null;
// ── TIMEZONE HELPERS (Mexico UTC-6) ──
function localDateStr() {
  // Returns today's date as YYYY-MM-DD in local timezone
  const d = new Date();
  return d.getFullYear() + '-'
    + String(d.getMonth()+1).padStart(2,'0') + '-'
    + String(d.getDate()).padStart(2,'0');
}

function localTimeStr() {
  // Returns current time as HH:MM in local timezone
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function localISOStr() {
  // Returns local datetime as ISO string (for DB storage)
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString();
}

function dateToLocal(dateStr) {
  // Parses a YYYY-MM-DD string safely without timezone shift
  if(!dateStr) return new Date();
  return new Date(dateStr + 'T12:00:00');
}

function getMondayOf(dateStr) {
  // Returns the Wednesday of the week (Mi-Ma) containing dateStr
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  // Week: Wed(3),Thu(4),Fri(5),Sat(6),Sun(0),Mon(1),Tue(2)
  // offset to get to Wednesday:
  let offset;
  if(dow === 3) offset = 0;
  else if(dow === 4) offset = -1;
  else if(dow === 5) offset = -2;
  else if(dow === 6) offset = -3;
  else if(dow === 0) offset = -4; // Sun
  else if(dow === 1) offset = -5; // Mon
  else if(dow === 2) offset = -6; // Tue
  const wed = new Date(d);
  wed.setDate(d.getDate() + offset);
  return wed;
}

function fmtLocalTime(isoStr) {
  // Formats a DB timestamp to local HH:MM
  if(!isoStr) return '--:--';
  return new Date(isoStr).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
}

// STATE
let currentUser = null, allUsers = [], allWeeks = [], selectedWeekId = null;
let selectedDayTec = (function(){ var d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0); })();
let pinBuffer = '', selectedUserId = null, timers = {};
let pendingStartActId = null;
// INIT
async function init() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const [{ data: users }, { data: weeks }] = await Promise.all([
    sb.from('users').select('*').order('created_at'),
    sb.from('weeks').select('*').order('start_date', { ascending: false })
  ]);
  allUsers = users || [];
  allWeeks = weeks || [];
  const todayStr = localDateStr();
  const currentWeek = allWeeks.find(w => todayStr >= w.start_date && todayStr <= w.end_date);
  selectedWeekId = currentWeek ? currentWeek.id : allWeeks[0].id;
  renderUserBtns();
  const saved = localStorage.getItem('avimex_user');
  if (saved) { currentUser = JSON.parse(saved); showApp(); }
  setInterval(autoUpdateFixedActivities, 60000);
}

function renderUserBtns() {
  document.getElementById('user-btns').innerHTML = allUsers.map(u => `
    <button class="user-btn" id="ubtn-${u.id}" onclick="selectUser('${u.id}')">
      <div class="user-avatar av-${u.name.toLowerCase()}">${u.name[0]}</div>
      <span>${u.name}</span>
      ${u.role==='supervisor'?'<span style="font-size:.6rem;color:var(--accent);font-family:DM Mono">SUPERVISOR</span>':''}
    </button>`).join('');
}

// AUTO-UPDATE FIXED ACTIVITIES
async function autoUpdateFixedActivities() {
  const now = new Date();
  const today = localDateStr();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const { data: fixedActs } = await sb.from('activities')
    .select('*').eq('is_fixed', true).eq('scheduled_date', today);
  if(!fixedActs) return;

  // Deduplicate by title+user+start - process only one per combination
  const seen = {};
  const unique = [];
  fixedActs.forEach(function(a) {
    const key = a.title + '|' + a.assigned_to + '|' + (a.scheduled_start||'');
    if(!seen[key]) { seen[key] = true; unique.push(a); }
  });

  for(const act of unique) {
    const start = (act.scheduled_start||'').slice(0,5);
    const end2 = (act.scheduled_end||'').slice(0,5);
    if(!start || !end2) continue;
    if(act.status === 'pendiente' && timeStr >= start && timeStr < end2) {
      await sb.from('activities').update({
        status: 'en_progreso', started_at: localISOStr()
      }).eq('id', act.id);
    } else if(act.status === 'en_progreso' && timeStr >= end2) {
      const started = act.started_at ? new Date(act.started_at) : now;
      const mins = Math.max(0, Math.round((now - started) / 60000));
      await sb.from('activities').update({
        status: 'completada', finished_at: localISOStr(), duration_minutes: mins
      }).eq('id', act.id);
    }
  }
}

async function loadDashboard() {
  if (!selectedWeekId) return;
  const week = allWeeks.find(w=>w.id===selectedWeekId);
  if (week) document.getElementById('dashboard-week-label').textContent = week.label;
  const { data: acts } = await sb.from('activities').select('*').eq('week_id', selectedWeekId);
  if (!acts) return;
  const total=acts.length, done=acts.filter(a=>a.status==='completada').length,
    prog=acts.filter(a=>a.status==='en_progreso').length, pend=acts.filter(a=>a.status==='pendiente').length;
  document.getElementById('stat-total').textContent=total;
  document.getElementById('stat-done').textContent=done;
  document.getElementById('stat-prog').textContent=prog;
  document.getElementById('stat-pend').textContent=pend;
  const pedro=allUsers.find(u=>u.name==='Pedro'), said=allUsers.find(u=>u.name==='Said');
  if (pedro) { const pa=acts.filter(a=>a.assigned_to===pedro.id); const pp=pa.length?Math.round(pa.filter(a=>a.status==='completada').length/pa.length*100):0; document.getElementById('pct-pedro').textContent=pp+'%'; document.getElementById('bar-pedro').style.width=pp+'%'; }
  if (said) { const sa=acts.filter(a=>a.assigned_to===said.id); const sp=sa.length?Math.round(sa.filter(a=>a.status==='completada').length/sa.length*100):0; document.getElementById('pct-said').textContent=sp+'%'; document.getElementById('bar-said').style.width=sp+'%'; }
  const live=acts.filter(a=>a.status==='en_progreso');
  document.getElementById('live-activities').innerHTML = live.length===0
    ? `<div class="empty-state"><div class="empty-icon">\ud83d\udca4</div><div class="empty-text">Sin actividades en progreso</div></div>`
    : live.map(a=>renderActCardSup(a)).join('');
  document.getElementById('acts-pedro').innerHTML = acts.filter(a=>a.assigned_to===pedro?.id).map(a=>renderActCardSup(a)).join('') || `<div class="empty-state"><div class="empty-text">Sin actividades</div></div>`;
  document.getElementById('acts-said').innerHTML = acts.filter(a=>a.assigned_to===said?.id).map(a=>renderActCardSup(a)).join('') || `<div class="empty-state"><div class="empty-text">Sin actividades</div></div>`;
  loadDashboardExtras(acts);
}
function renderActCardSup(a) {
  const timeStr = a.scheduled_start ? `${a.scheduled_start.slice(0,5)}-${(a.scheduled_end||'').slice(0,5)}` : '';
  const dur = a.duration_minutes ? `${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m` : '';
  const statusLabel = a.status==='completada'
    ? '<span style="color:var(--green);font-size:.78rem;font-weight:600">&#10003; Completada</span>'
    : a.status==='en_progreso'
    ? '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
      + '<span class="live-badge"><span class="live-dot"></span>En progreso</span>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">'
      + '<button class="btn btn-finish btn-sm" data-id="'+a.id+'" onclick="supFinishActivity(this.dataset.id)" style="color:#fff;font-size:.65rem;padding:4px 10px">&#10003; Finalizar</button>'
      + '<button class="btn btn-sm" data-id="'+a.id+'" onclick="supCancelStart(this.dataset.id)" style="border:1px solid var(--red);color:var(--red);background:transparent;font-size:.65rem;padding:4px 10px">&#10005; Cancelar</button>'
      + '</div></div>'
    : a.status==='pendiente'
    ? '<button class="btn btn-start btn-sm" data-id="'+a.id+'" onclick="supStartActivity(this.dataset.id)" style="color:#fff;font-size:.65rem;padding:4px 12px">&#9654; Iniciar</button>'
    : '<span style="color:var(--muted);font-size:.72rem">'+a.status+'</span>';
  return `<div class="act-card" id="card-${a.id}">
    <div class="act-card-header" onclick="toggleCardSup('${a.id}')">
    <div class="act-status-dot dot-${a.status}"></div>
    <div class="act-card-info">
    <div class="act-card-title">${a.title}</div>
    <div class="act-card-meta"><span class="act-type-pill type-${a.type}">${a.type}</span>${timeStr?`<span class="act-time">${timeStr}</span>`:''}</div>
    </div>
    ${statusLabel}<span class="act-card-arrow">&#8250;</span>
    </div>
    <div class="act-card-body">
    ${a.description?`<div class="desc-box">${a.description}<span class="desc-edit-btn" onclick="openEditDesc('${a.id}','${encodeURIComponent(a.description)}')">\u270f\ufe0f Editar</span></div>`:''}
    <div class="comments-section">
    <div class="comments-title">Comentarios</div>
    <div id="cmts-${a.id}"></div>
    <div class="comment-input-wrap">
    <input class="comment-input" id="cmt-input-${a.id}" placeholder="Agregar comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}')">
    <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}')">Enviar</button>
    </div>
    </div>
    <div class="images-section">
    <div class="comments-title">Im&#225;genes de evidencia</div>
    <div class="images-grid" id="imgs-${a.id}"></div>
    <input type="file" class="img-file-input" id="file-${a.id}" accept="image/*" multiple onchange="handleImageUpload('${a.id}',this)">
    <button class="img-upload-btn" onclick="document.getElementById('file-${a.id}').click()">&#128247; Subir im&#225;genes &#8594; Drive</button>
    </div>
    </div>
  </div>`;
}
function toggleCardSup(id) {
  const card = document.getElementById('card-'+id);
  if (card.classList.toggle('open')) { loadComments(id); loadImages(id); }
}
// STATS + PDF
async function loadStats() {
  document.getElementById('stats-content').innerHTML = '<div class="loading"><div class="spinner"></div>Generando...</div>';
  const { data: acts } = await sb.from('activities').select('*');
  if (!acts) return;
  const now = new Date();
  const currentMonth = now.getMonth();
  const html = await buildStatsHTML(acts, now);
  document.getElementById('stats-content').innerHTML = html;
}
async function buildStatsHTML(acts, now) {
  const pedro = allUsers.find(u=>u.name==='Pedro');
  const said  = allUsers.find(u=>u.name==='Said');
  let html = '';
  for (const week of [...allWeeks].reverse()) {
    const wa = acts.filter(a=>a.week_id===week.id);
    const isCurrentWeek = new Date(week.start_date) <= now && now <= new Date(week.end_date);
    const isPast = new Date(week.end_date) < now;
    html += `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <div style="font-family:Bebas Neue;font-size:1.1rem;letter-spacing:2px;color:var(--accent)">${week.label}</div>
    ${isCurrentWeek?'<span class="live-badge"><span class="live-dot"></span>Semana actual</span>':isPast?'<span style="font-family:DM Mono;font-size:.6rem;color:var(--muted)">COMPLETADA</span>':''}
    </div>`;
    for (const person of [pedro, said]) {
    if (!person) continue;
    const pa = wa.filter(a=>a.assigned_to===person.id);
    const done = pa.filter(a=>a.status==='completada').length;
    const total = pa.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const totalMins = pa.filter(a=>a.duration_minutes).reduce((s,a)=>s+(a.duration_minutes||0),0);
    const h = Math.floor(totalMins/60), m = totalMins%60;
    const color = person.name==='Pedro'?'var(--pedro)':'var(--said)';
    html += `<div style="margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
    <span style="font-size:.8rem;font-weight:600;color:${color}">${person.name}</span>
    <span style="font-family:DM Mono;font-size:.72rem;color:var(--muted2)">${done}/${total} &middot; ${h}h ${m}m</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
    if (isCurrentWeek) {
    const inProg = pa.filter(a=>a.status==='en_progreso');
    if (inProg.length) {
    html += `<div style="margin-bottom:8px"><div style="font-family:DM Mono;font-size:.58rem;color:var(--muted);letter-spacing:1px;margin-bottom:6px">EN PROGRESO AHORA</div>`;
    inProg.forEach(a => { html += `<div style="font-size:.75rem;color:var(--accent);padding:4px 0;border-bottom:1px solid var(--border)">&#9654; ${a.title}</div>`; });
    html += '</div>';
    }
    const pendActs = pa.filter(a=>a.status==='pendiente' && !a.is_fixed);
    if (pendActs.length) {
    html += `<div style="margin-bottom:8px"><div style="font-family:DM Mono;font-size:.58rem;color:var(--muted);letter-spacing:1px;margin-bottom:6px">PENDIENTES</div>`;
    pendActs.slice(0,5).forEach(a => { html += `<div style="font-size:.75rem;color:var(--muted2);padding:4px 0;border-bottom:1px solid var(--border)">\u2022 ${a.title}</div>`; });
    html += '</div>';
    }
    }
    }
    html += '</div>';
  }
  return html || '<div class="empty-state"><div class="empty-text">Sin datos a&#250;n</div></div>';
}
async function downloadStatsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const { data: acts } = await sb.from('activities').select('*');
  const pedro = allUsers.find(u=>u.name==='Pedro');
  const said  = allUsers.find(u=>u.name==='Said');
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  doc.setFillColor(15,20,32); doc.rect(0,0,210,40,'F');
  doc.setTextColor(240,192,64); doc.setFontSize(24); doc.setFont('helvetica','bold');
  doc.text('AVI-MEX &middot; MANTENIMIENTO', 15, 18);
  doc.setFontSize(9); doc.setTextColor(96,112,160); doc.setFont('helvetica','normal');
  doc.text('Planta Jojutla - Nave 1 y Nave 2', 15, 25);
  doc.text(`Reporte generado: ${dateStr}`, 15, 31);
  doc.text(`Supervisor: Juli&#225;n`, 15, 37);
  let y = 50;
  for (const week of [...allWeeks].reverse()) {
    const wa = (acts||[]).filter(a=>a.week_id===week.id);
    const isCurrentWeek = new Date(week.start_date) <= now && now <= new Date(week.end_date);
    doc.setFillColor(26,34,54); doc.rect(10, y-5, 190, 10, 'F');
    doc.setTextColor(240,192,64); doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.text(week.label + (isCurrentWeek?' &middot; SEMANA EN CURSO':''), 15, y+1);
    y += 12;
    for (const person of [pedro, said]) {
    if (!person) continue;
    const pa = wa.filter(a=>a.assigned_to===person.id);
    const done = pa.filter(a=>a.status==='completada').length;
    const total = pa.length;
    const pct = total ? Math.round(done/total*100) : 0;
    const totalMins = pa.filter(a=>a.duration_minutes).reduce((s,a)=>s+(a.duration_minutes||0),0);
    const h=Math.floor(totalMins/60), m=totalMins%60;
    doc.setTextColor(person.name==='Pedro'?61:61, person.name==='Pedro'?142:200, person.name==='Pedro'?240:122);
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text(`${person.name}`, 15, y);
    doc.setTextColor(100,120,160); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`${done}/${total} actividades completadas (${pct}%) &middot; Tiempo registrado: ${h}h ${m}m`, 35, y);
    y += 5;
    doc.setFillColor(26,34,54); doc.rect(15, y, 80, 3, 'F');
    const barColor = person.name==='Pedro' ? [61,142,240] : [61,200,122];
    doc.setFillColor(...barColor); doc.rect(15, y, 80*pct/100, 3, 'F');
    y += 8;
    if (isCurrentWeek) {
    const completed = pa.filter(a=>a.status==='completada' && !a.is_fixed);
    if (completed.length) {
    doc.setTextColor(60,160,80); doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('COMPLETADAS:', 18, y); y += 4;
    completed.forEach(a => {
    doc.setTextColor(80,100,130); doc.setFont('helvetica','normal');
    const dur = a.duration_minutes ? ` (${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m)` : '';
    const lines = doc.splitTextToSize(`&#10003; ${a.title}${dur}`, 170);
    doc.text(lines, 20, y); y += lines.length * 4;
    });
    y += 2;
    }
    const pending = pa.filter(a=>a.status==='pendiente' && !a.is_fixed);
    if (pending.length) {
    doc.setTextColor(160,100,60); doc.setFontSize(7); doc.setFont('helvetica','bold');
    doc.text('PENDIENTES:', 18, y); y += 4;
    pending.forEach(a => {
    doc.setTextColor(100,80,60); doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(`\u2022 ${a.title}`, 170);
    doc.text(lines, 20, y); y += lines.length * 4;
    });
    y += 2;
    }
    }
    y += 4;
    if (y > 260) { doc.addPage(); y = 20; }
    }
    y += 6;
    if (y > 260) { doc.addPage(); y = 20; }
  }
  doc.setFillColor(15,20,32); doc.rect(0, 285, 210, 12, 'F');
  doc.setTextColor(96,112,160); doc.setFontSize(7);
  doc.text('AVI-MEX S.A. de C.V. &middot; 001-JOJN1CERING-001 &middot; Confidencial', 15, 292);
  doc.text(`P&#225;gina 1`, 190, 292);
  doc.save(`AVI-MEX_Estadisticas_${now.toISOString().split('T')[0]}.pdf`);
  showToast('PDF descargado &#10003;', 'success');
}
// ADD ACTIVITY
async function generateDescription(fromModal=false) {
  const titleEl = fromModal ? document.getElementById('m-title') : document.getElementById('new-title');
  const descEl  = fromModal ? document.getElementById('m-desc')  : document.getElementById('new-desc');
  const title = titleEl.value.trim();
  if (!title) { showToast('Escribe primero el t&#237;tulo', 'error'); return; }
  descEl.value = 'Generando descripci&#243;n...'; descEl.disabled = true;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
    model:'claude-sonnet-4-20250514', max_tokens:300,
    messages:[{ role:'user', content:`Eres un t&#233;cnico de mantenimiento industrial. Genera una descripci&#243;n t&#233;cnica formal en espa&#241;ol para la siguiente actividad de mantenimiento: "${title}". La descripci&#243;n debe incluir: qu&#233; se hace, por qu&#233; es importante, y consideraciones de seguridad. M&#225;ximo 3 oraciones concisas. Solo la descripci&#243;n, sin t&#237;tulo ni formato adicional.` }]
    })
    });
    const data = await res.json();
    descEl.value = data.content?.[0]?.text || 'Error al generar descripci&#243;n';
  } catch(e) {
    descEl.value = `Actividad de mantenimiento: ${title}. Ejecutar siguiendo los procedimientos establecidos y utilizando el EPP correspondiente.`;
  }
  descEl.disabled = false;
}
function generateDescModal() { generateDescription(true); }
async function addActivity() {
  const title = document.getElementById('new-title').value.trim();
  const type  = document.getElementById('new-type').value;
  const assigned = document.getElementById('new-assigned').value;
  const weekId   = document.getElementById('new-week').value;
  const date     = document.getElementById('new-date').value || null;
  const start    = document.getElementById('new-start').value || null;
  const end      = document.getElementById('new-end').value || null;
  let desc       = document.getElementById('new-desc').value.trim();
  if (!title) { showToast('Escribe un t&#237;tulo', 'error'); return; }
  if (!desc) {
    document.getElementById('new-desc').value = 'Generando...';
    try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:200,
    messages:[{role:'user',content:`Descripci&#243;n t&#233;cnica formal en espa&#241;ol para mantenimiento industrial: "${title}". M&#225;ximo 2 oraciones. Solo la descripci&#243;n.`}]
    })
    });
    const data = await res.json();
    desc = data.content?.[0]?.text || '';
    } catch(e) { desc = `Actividad de mantenimiento: ${title}.`; }
    document.getElementById('new-desc').value = desc;
  }
  const { error } = await sb.from('activities').insert({
    title, type, assigned_to: assigned, week_id: weekId,
    scheduled_date: date, scheduled_start: start, scheduled_end: end,
    description: desc, is_fixed: type==='fija', status:'pendiente', created_by: currentUser.id
  });
  if (error) { showToast('Error al guardar', 'error'); return; }
  showToast('Actividad agregada &#10003;', 'success');
  document.getElementById('new-title').value = '';
  document.getElementById('new-desc').value = '';
  loadDashboard();
}
async function addActivityModal() {
  const title = document.getElementById('m-title').value.trim();
  const type  = document.getElementById('m-type').value;
  const assigned = document.getElementById('m-assigned').value;
  const weekId   = document.getElementById('m-week').value;
  const date     = document.getElementById('m-date').value || null;
  let desc       = document.getElementById('m-desc').value.trim();
  if (!title) { showToast('Escribe un t&#237;tulo', 'error'); return; }
  if (!desc) desc = `Actividad de mantenimiento: ${title}. Ejecutar con el EPP correspondiente.`;
  const { error } = await sb.from('activities').insert({
    title, type, assigned_to: assigned, week_id: weekId,
    scheduled_date: date, description: desc,
    is_fixed: type==='fija', status:'pendiente', created_by: currentUser.id
  });
  if (error) { showToast('Error', 'error'); return; }
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('m-title').value = ''; document.getElementById('m-desc').value = '';
  showToast('Actividad agregada &#10003;', 'success'); loadDashboard();
}
// T\u00c9CNICO
function setupTecnico() {
  document.getElementById('sup-tabs').style.display = 'none';
  document.getElementById('tec-view').style.display = 'block';
  // fab removed
  document.getElementById('bottom-nav').innerHTML='<button class="bnav-btn active" id="bn-tec-today" data-tectab="today"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/></svg>Mis tareas</button>';
  document.getElementById('bottom-nav').addEventListener('click', function(e){
    var btn=e.target.closest('[data-tectab]');
    if(!btn) return;
    tecTab(btn.dataset.tectab);
  });
  selectedDayTec = new Date();
  updateTecDayHeader();
  loadTecnicoToday();
}
function tecTab(t) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tec-'+t).classList.add('active');
  document.getElementById('bn-tec-'+t).classList.add('active');
}
function tecSelectWeek(id, el) {
  selectedWeekId = id;
  document.querySelectorAll('#week-selector-tec .week-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); loadTecnicoList();
}
async function loadTecnicoToday() {
  if(!sb || !currentUser) { console.error('sb or currentUser not ready'); return; }
  if(!selectedDayTec) selectedDayTec = new Date();
  updateTecDayHeader();
  // Use local date, not UTC
  const viewDate = selectedDayTec.getFullYear() + '-'
    + String(selectedDayTec.getMonth()+1).padStart(2,'0') + '-'
    + String(selectedDayTec.getDate()).padStart(2,'0');
  const todayStr = localDateStr();
  const isToday = viewDate === todayStr;
  const viewDow = new Date(viewDate + 'T12:00:00').getDay();

  if(viewDow === 0) {
    // Sunday: check if supervisor assigned anything
    const { data: sundayActs } = await sb.from('activities').select('id')
      .eq('assigned_to', currentUser.id).eq('scheduled_date', viewDate).eq('is_fixed', false);
    if(!sundayActs || !sundayActs.length) {
      const fe = document.getElementById('tec-fixed-today');
      const te = document.getElementById('tec-today-acts');
      const ds = document.getElementById('tec-completed-section');
      if(fe) fe.innerHTML = '<div style="color:var(--muted);font-size:.8rem">Sin actividades fijas este dia</div>';
      if(te) te.innerHTML = '<div class="empty-state"><div style="font-size:2rem">😴</div><div class="empty-text">D\u00eda de descanso</div></div>';
      if(ds) ds.style.display = 'none';
      document.getElementById('tec-pct').textContent = '0%';
      document.getElementById('tec-bar').style.width = '0%';
      return;
    }
  }
  const mw = allWeeks.find(w => viewDate >= w.start_date && viewDate <= w.end_date);
  const weekId = mw ? mw.id : selectedWeekId;
  const { data: weekActs } = await sb.from('activities').select('id,status')
    .eq('assigned_to', currentUser.id).eq('week_id', weekId).eq('is_fixed', false);
  const wDone = (weekActs||[]).filter(a => a.status === 'completada').length;
  const wTotal = (weekActs||[]).length;
  const pct = wTotal ? Math.round(wDone/wTotal*100) : 0;
  document.getElementById('tec-pct').textContent = pct + '%';
  document.getElementById('tec-bar').style.width = pct + '%';
  loadTecWeekOverview();
  // Get non-fixed activities for this exact date
  const { data: dayActs } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id)
    .eq('scheduled_date', viewDate)
    .eq('is_fixed', false);
  const nonFixed = dayActs || [];

  // Get fixed activities: first try exact date, then fall back to same DOW
  const { data: fixedExact } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id)
    .eq('scheduled_date', viewDate)
    .eq('is_fixed', true);



  let fixed = fixedExact || [];

  // Fallback: if no fixed for this exact date, find same day-of-week from past 90 days
  if(!fixed.length) {
    const past = new Date(viewDate + 'T12:00:00');
    past.setDate(past.getDate() - 90);
    const { data: fixedFallback } = await sb.from('activities').select('*')
      .eq('assigned_to', currentUser.id)
      .eq('is_fixed', true)
      .gte('scheduled_date', past.toISOString().split('T')[0]);
    // Filter by same DOW
    const seen = {};
    (fixedFallback || []).forEach(a => {
      if(!a.scheduled_date) return;
      const dow = new Date(a.scheduled_date + 'T12:00:00').getDay();
      if(dow !== viewDow) return;
      const k = a.title + '|' + (a.scheduled_start||'');
      if(!seen[k]) { seen[k] = true; fixed.push(a); }
    });
  }
  const fixedEl = document.getElementById('tec-fixed-today');
  if(fixedEl) {
    if(!fixed.length) {
    fixedEl.innerHTML = '<div style="color:var(--muted);font-size:.8rem;margin-bottom:8px">Sin actividades fijas este dia</div>';
    } else {
    const nowStr = new Date().toTimeString().slice(0,5);
    const seen = {};
    const uniqueFixed = fixed.filter(a => {
    const k = a.title + '|' + (a.scheduled_start||'');
    if(seen[k]) return false;
    seen[k] = true;
    return true;
    });
    uniqueFixed.sort((a,b) => (a.scheduled_start||'').localeCompare(b.scheduled_start||''));
    fixedEl.innerHTML = uniqueFixed.map(a => {
    const t = a.scheduled_start ? a.scheduled_start.slice(0,5) + '-' + (a.scheduled_end||'').slice(0,5) : '';
    let status = 'Programada', cls = 'fas-pend';
    if(isToday && a.scheduled_start && a.scheduled_end) {
    if(nowStr >= a.scheduled_start && nowStr < a.scheduled_end) { status = 'En progreso'; cls = 'fas-prog'; }
    else if(nowStr >= a.scheduled_end) { status = 'Completada'; cls = 'fas-done'; }
    }
    return '<div class="fixed-act-row">'
    + '<div class="fixed-act-time">' + t + '</div>'
    + '<div class="fixed-act-name">' + a.title + '</div>'
    + '<span class="fixed-act-status ' + cls + '">' + status + '</span>'
    + '</div>';
    }).join('');
    }
  }
  const todayEl = document.getElementById('tec-today-acts');
  if(!todayEl) return;
  if(!nonFixed.length) {
    todayEl.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128203;</div><div class="empty-text">'
    + (isToday ? 'Sin actividades para hoy.<br>Ve a Lista completa para agregar una.' : 'Sin actividades este dia.')
    + '</div></div>';
  } else {
    // Split active vs completed
    var activeActs = nonFixed.filter(function(a){ return a.status !== 'completada'; });
    var doneActs = nonFixed.filter(function(a){ return a.status === 'completada'; });

    todayEl.innerHTML = activeActs.length
      ? activeActs.map(function(a){ return renderActCardTec(a, false); }).join('')
      : '<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin actividades pendientes</div>';

    var doneSection = document.getElementById('tec-completed-section');
    var doneEl = document.getElementById('tec-today-done');
    if(doneSection && doneEl) {
      if(doneActs.length) {
        doneSection.style.display = 'block';
        var doneLabel = document.getElementById('tec-done-label');
        if(doneLabel) doneLabel.textContent = isToday ? 'Completadas hoy' : 'Completadas este día';
        doneEl.innerHTML = doneActs.map(function(a){ return renderActCardTec(a, false); }).join('');
      } else {
        doneSection.style.display = 'none';
      }
    }
  }
}
async function loadTecnicoList() {
  if (!selectedWeekId) return;
  const { data: rawActs } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id).eq('week_id', selectedWeekId)
    .eq('is_fixed', false).order('scheduled_date').order('status');
  const acts = rawActs||[];
  const el = document.getElementById('tec-list-acts');
  if (!acts || acts.length===0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">&#9989;</div><div class="empty-text">Sin actividades esta semana</div></div>`; return;
  }
  el.innerHTML = acts.map(a=>renderActCardTec(a, true)).join('');
}
function renderActCardTec(a, fromList=false) {
  const timeStr = a.scheduled_start ? `${a.scheduled_start.slice(0,5)}-${(a.scheduled_end||'').slice(0,5)}` : '';
  let actionBtns = '';
  if (a.status==='pendiente') {
    actionBtns = '<button class="btn btn-start btn-sm" data-id="' + a.id + '" onclick="startDirectly(this.dataset.id)">&#9654; Iniciar</button>';
    if (!fromList) actionBtns += '<button class="btn btn-outline btn-sm" data-id="' + a.id + '" onclick="moveToTomorrow(this.dataset.id,event)">&#8631; Mover a ma&#241;ana</button>';
  } else if (a.status==='en_progreso') {
    actionBtns = '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + '<button class="btn btn-finish btn-sm" data-id="' + a.id + '" onclick="finishActivity(this.dataset.id,event)" style="color:#fff">&#10003; Finalizar</button>'
      + '<button class="btn btn-outline btn-sm" data-id="' + a.id + '" onclick="cancelStart(this.dataset.id)" style="border-color:var(--red);color:var(--red)">&#10005; Cancelar</button>'
      + '</div>';
  } else if (a.status==='completada') {
    const dur = a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';
    actionBtns = `<span style="color:var(--green);font-size:.78rem;font-family:DM Mono">&#10003; Completada ${dur?'&middot; '+dur:''}</span>`;
  }
  if (fromList && a.status==='pendiente') {
    actionBtns = `<button class="btn btn-accent btn-sm" style="color:#fff" onclick="addToToday('${a.id}',event)">+ Agregar a mi d&#237;a</button>`;
  }
  return `<div class="act-card" id="card-${a.id}">
    <div class="act-card-header" data-cid="${a.id}" onclick="toggleCardTec(this.dataset.cid)">
    <div class="act-status-dot dot-${a.status}"></div>
    <div class="act-card-info">
    <div class="act-card-title">${a.title}</div>
    <div class="act-card-meta"><span class="act-type-pill type-${a.type}">${a.type}</span>${timeStr?`<span class="act-time">${timeStr}</span>`:''}</div>
    </div>
    <span class="act-card-arrow">&#8250;</span>
    </div>
    <div class="act-card-body">
    ${a.description?`<div class="desc-box">${a.description}</div>`:''}
    <div class="epp-banner"><div class="epp-icon">&#9888;</div><div class="epp-text"><strong>EPP obligatorio:</strong> Usar casco, guantes, botas de seguridad y cualquier equipo de protecci&#243;n adicional requerido para esta actividad.</div></div>
    <div class="act-actions">${actionBtns}</div>
    ${a.status!=='pendiente'?`
    <div class="images-section">
    <div class="comments-title">Im&#225;genes de evidencia</div>
    <div class="images-grid" id="imgs-${a.id}"></div>
    <input type="file" class="img-file-input" id="file-${a.id}" accept="image/*" multiple onchange="handleImageUpload('${a.id}',this)">
    <button class="img-upload-btn" onclick="document.getElementById('file-${a.id}').click()">\ud83d\udcf7 Subir im&#225;genes \u2192 Drive</button>
    </div>`:''}
    <div class="comments-section">
    <div class="comments-title">Comentarios</div>
    <div id="cmts-${a.id}"></div>
    <div class="comment-input-wrap">
    <input class="comment-input" id="cmt-input-${a.id}" placeholder="Agregar comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}')">
    <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}')">Enviar</button>
    </div>
    </div>
    </div>
  </div>`;
}
function toggleCardTec(id) {
  const card = document.getElementById('card-'+id);
  if (!card) return;
  if (card.classList.toggle('open')) {
    loadComments(id);
    loadImages(id);
  }
}
// CONFIRM START
function showConfirm(actId, e) {
  if (e) e.stopPropagation();
  if(!actId || actId === 'null' || actId === 'undefined') {
    showToast('Error: ID invalido', 'error');
    return;
  }
  // Store in button data attribute - more reliable than global var
  const confirmBtn = document.querySelector('#confirm-overlay .btn-start');
  if(confirmBtn) confirmBtn.dataset.actid = actId;
  pendingStartActId = actId;
  sb.from('activities').select('title,description').eq('id',actId).single().then(function(r){
    const data = r.data;
    document.getElementById('confirm-title').textContent = data?.title || 'Confirmar actividad';
    document.getElementById('confirm-desc').textContent = data?.description || 'Ejecutar siguiendo los procedimientos establecidos.';
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
function closeConfirm() { document.getElementById('confirm-overlay').classList.remove('open'); pendingStartActId=null; }
async function confirmStart() {
  // Get ID from button dataset as primary source
  const confirmBtn = document.querySelector('#confirm-overlay .btn-start');
  const id = (confirmBtn && confirmBtn.dataset.actid) ? confirmBtn.dataset.actid : pendingStartActId;
  if (!id || id === 'null' || id === 'undefined') {
    showToast('Error: no hay actividad seleccionada', 'error');
    return;
  }
  closeConfirm();
  pendingStartActId = null;
  if(confirmBtn) confirmBtn.dataset.actid = '';
  const { error } = await sb.from('activities').update({
    status: 'en_progreso',
    started_at: localISOStr()
  }).eq('id', id);
  if(error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Actividad iniciada', 'success');
  loadTecnicoToday();
}
async function addToToday(id, e) {
  if (e) e.stopPropagation();
  const today = localDateStr();
  const todayWeek = allWeeks.find(w=>today>=w.start_date&&today<=w.end_date);
  const { error } = await sb.from('activities').update({ scheduled_date: today, week_id: todayWeek?todayWeek.id:selectedWeekId }).eq('id', id);
  if (error) { showToast('Error', 'error'); return; }
  showToast('Agregada a hoy', 'success');
  tecTab('today');
  loadTecnicoToday(); loadTecnicoList();
}
async function moveToTomorrow(id, e) {
  if (e) e.stopPropagation();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const { error } = await sb.from('activities').update({ scheduled_date: tomorrowStr }).eq('id', id);
  if (error) { showToast('Error', 'error'); return; }
  showToast('Movida a ma&#241;ana &#10003;', 'success'); loadTecnicoToday();
}
// ACTIVITY ACTIONS
async function loadTecWeekOverview() {
  const el = document.getElementById('tec-week-overview');
  if(!el || !currentUser || !sb) return;
  // Use local date, not UTC
  const viewDate = selectedDayTec.getFullYear() + '-'
    + String(selectedDayTec.getMonth()+1).padStart(2,'0') + '-'
    + String(selectedDayTec.getDate()).padStart(2,'0');
  const mw = allWeeks.find(w => viewDate >= w.start_date && viewDate <= w.end_date);
  // Calculate monday manually if no week found
  const viewD = new Date(viewDate + 'T12:00:00');
  const dayOfWeek = viewD.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = getMondayOf(viewDate);
  const mondayStr = monday.getFullYear()+'-'+String(monday.getMonth()+1).padStart(2,'0')+'-'+String(monday.getDate()).padStart(2,'0');
  const sundayD = new Date(monday); sundayD.setDate(monday.getDate()+6);
  const sundayStr = sundayD.getFullYear()+'-'+String(sundayD.getMonth()+1).padStart(2,'0')+'-'+String(sundayD.getDate()).padStart(2,'0');
  const { data: weekActs } = await sb.from('activities').select('scheduled_date,status,is_fixed')
    .eq('assigned_to', currentUser.id)
    .gte('scheduled_date', mondayStr)
    .lte('scheduled_date', sundayStr);
  const todayStr = localDateStr();
  const days = ['Mi','J','V','S','D','L','Ma'];
  // Build 7 dates starting from Monday of the week
  const dates = Array.from({length:7}, function(_, i) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  el.innerHTML = dates.map(function(d, i) {
    const dateStr = d.toISOString().split('T')[0];
    const isSelected = dateStr === viewDate;
    const isToday = dateStr === todayStr;
    const dayActs = (weekActs||[]).filter(a => a.scheduled_date === dateStr && !a.is_fixed);
    const fixedCount = (weekActs||[]).filter(a => a.scheduled_date === dateStr && a.is_fixed).length;
    const done = dayActs.filter(a => a.status === 'completada').length;
    const total = dayActs.length;
    var bg, border, tc;
    if(isSelected){ bg='var(--orange)'; border='var(--orange)'; tc='#fff'; }
    else if(total>0 && done===total){ bg='rgba(21,128,61,.1)'; border='rgba(21,128,61,.4)'; tc='var(--green)'; }
    else if(done>0){ bg='rgba(234,88,12,.06)'; border='rgba(234,88,12,.3)'; tc='var(--orange)'; }
    else if(total>0){ bg='var(--card)'; border='var(--border2)'; tc='var(--text)'; }
    else{ bg='var(--card)'; border='var(--border)'; tc='var(--muted)'; }
    const todayDot = isToday && !isSelected ? '<div style="width:4px;height:4px;border-radius:50%;background:var(--orange);margin:1px auto 0"></div>' : '';
    const fixedDot = fixedCount>0 && !isSelected ? '<div style="width:4px;height:4px;border-radius:50%;background:#f59e0b;margin:1px auto 0"></div>' : '';
    return '<div data-date="'+dateStr+'" onclick="tecJumpToDay(this.dataset.date)" style="flex:1;min-width:38px;max-width:52px;background:'+bg+';border:1.5px solid '+border+';border-radius:8px;padding:5px 2px;text-align:center;cursor:pointer">'
      + '<div style="font-size:.6rem;font-weight:700;color:'+tc+'">'+days[i]+'</div>'
      + '<div style="font-size:.75rem;font-weight:600;color:'+tc+'">'+d.getDate()+'</div>'
      + (total>0 ? '<div style="font-size:.5rem;color:'+tc+';opacity:.9">'+done+'/'+total+'</div>' : '<div style="font-size:.5rem;color:var(--muted)">-</div>')
      + fixedDot + todayDot
      + '</div>';
  }).join('');
}


async function loadSupWeekOverview() {
  const el = document.getElementById('sup-week-overview');
  if(!el || !sb) return;
  const viewDate = selectedDayJulian ? selectedDayJulian.toISOString().split('T')[0] : localDateStr();
  const mw = allWeeks.find(w => viewDate >= w.start_date && viewDate <= w.end_date);
  const viewD2 = new Date(viewDate + 'T12:00:00');
  const dow2 = viewD2.getDay();
  const mOff = dow2 === 0 ? -6 : 1 - dow2;
  const monday = getMondayOf(viewDate);
  const mondayStr2 = monday.getFullYear()+'-'+String(monday.getMonth()+1).padStart(2,'0')+'-'+String(monday.getDate()).padStart(2,'0');
  const sundayD2 = new Date(monday); sundayD2.setDate(monday.getDate()+6);
  const sundayStr2 = sundayD2.getFullYear()+'-'+String(sundayD2.getMonth()+1).padStart(2,'0')+'-'+String(sundayD2.getDate()).padStart(2,'0');
  const { data: weekActs } = await sb.from('activities').select('scheduled_date,status')
    .eq('is_fixed', false)
    .gte('scheduled_date', mondayStr2)
    .lte('scheduled_date', sundayStr2);
  const todayStr = localDateStr();
  const days = ['Mi','J','V','S','D','L','Ma'];
  const dates = Array.from({length:7}, function(_, i) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  el.innerHTML = dates.map(function(d, i) {
    const dateStr = d.toISOString().split('T')[0];
    const isSelected = dateStr === viewDate;
    const isToday = dateStr === todayStr;
    const dayActs = (weekActs||[]).filter(a => a.scheduled_date === dateStr);
    const done = dayActs.filter(a => a.status === 'completada').length;
    const total = dayActs.length;
    var bg, border, tc;
    if(isSelected){ bg='var(--orange)'; border='var(--orange)'; tc='#fff'; }
    else if(total>0 && done===total){ bg='rgba(21,128,61,.1)'; border='rgba(21,128,61,.4)'; tc='var(--green)'; }
    else if(done>0){ bg='rgba(234,88,12,.06)'; border='rgba(234,88,12,.3)'; tc='var(--orange)'; }
    else if(total>0){ bg='var(--card)'; border='var(--border2)'; tc='var(--text)'; }
    else{ bg='var(--card)'; border='var(--border)'; tc='var(--muted)'; }
    const todayDot = isToday && !isSelected ? '<div style="width:4px;height:4px;border-radius:50%;background:var(--orange);margin:1px auto 0"></div>' : '';
    return '<div data-date="'+dateStr+'" onclick="supJumpToDay(this.dataset.date)" style="flex:1;min-width:38px;max-width:52px;background:'+bg+';border:1.5px solid '+border+';border-radius:8px;padding:5px 2px;text-align:center;cursor:pointer">'
      + '<div style="font-size:.6rem;font-weight:700;color:'+tc+'">'+days[i]+'</div>'
      + '<div style="font-size:.75rem;font-weight:600;color:'+tc+'">'+d.getDate()+'</div>'
      + (total>0 ? '<div style="font-size:.5rem;color:'+tc+';opacity:.9">'+done+'/'+total+'</div>' : '<div style="font-size:.5rem;color:var(--muted)">-</div>')
      + todayDot
      + '</div>';
  }).join('');
}


function supJumpToDay(dateStr) {
  selectedDayJulian = new Date(dateStr + 'T12:00:00');
  const mw = allWeeks.find(function(w){ return dateStr >= w.start_date && dateStr <= w.end_date; });
  if(mw) selectedWeekId = mw.id;
  loadJulianDay();
}

async function startDirectly(id) {
  if(!id || id === 'null') return;
  const now = new Date();
  const startedAt = now.toISOString();
  const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  const { error } = await sb.from('activities').update({
    status: 'en_progreso',
    started_at: startedAt,
    scheduled_date: today
  }).eq('id', id);
  if(error) { showToast('Error: ' + error.message, 'error'); return; }
  // Jump to today
  selectedDayTec = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const mw = allWeeks.find(function(w){ return today >= w.start_date && today <= w.end_date; });
  if(mw) selectedWeekId = mw.id;
  showToast('Actividad iniciada', 'success');
  loadTecnicoToday();
}

async function cancelStart(id) {
  if(!id || id === 'null') return;
  if(timers[id]) { clearInterval(timers[id]); delete timers[id]; }
  const { error } = await sb.from('activities').update({
    status: 'pendiente',
    started_at: null
  }).eq('id', id);
  if(error) { showToast('Error', 'error'); return; }
  showToast('Inicio cancelado', 'success');
  loadTecnicoToday();
}

async function supStartActivity(id) {
  if(!id || id==='null') return;
  const now = new Date();
  const { error } = await sb.from('activities').update({
    status: 'en_progreso',
    started_at: localISOStr()
  }).eq('id', id);
  if(error){ showToast('Error: '+error.message,'error'); return; }
  showToast('Actividad iniciada','success');
  loadDashboard();
  if(document.getElementById('julian-hoy-acts')) loadJulianDay();
}

async function supFinishActivity(id) {
  if(!id || id==='null') return;
  // Require at least 1 photo
  const { data: imgs } = await sb.from('activity_images').select('id').eq('activity_id', id);
  if(!imgs || imgs.length===0){
    showToast('Sube al menos 1 foto antes de finalizar','error');
    return;
  }
  const { data } = await sb.from('activities').select('started_at').eq('id',id).single();
  const now = new Date();
  const started = data?.started_at ? new Date(data.started_at) : now;
  const mins = Math.max(0, Math.round((now-started)/60000));
  const { error } = await sb.from('activities').update({
    status: 'completada',
    finished_at: localISOStr(),
    duration_minutes: mins
  }).eq('id', id);
  if(error){ showToast('Error','error'); return; }
  showToast('Actividad completada &#10003;','success');
  loadDashboard();
  if(document.getElementById('julian-hoy-acts')) loadJulianDay();
}
