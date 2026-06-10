// ═══════════════════════════════════════════════
//  AVI-MEX Mantenimiento — app.js
//  Single-file architecture
// ═══════════════════════════════════════════════

const SUPABASE_URL = 'https://eaeuqcdcnkztttkfvbut.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f89Uz7LwwTcjqpdKKzXlYg_HuNsTtC3';
const APPS_SCRIPT  = 'https://script.google.com/macros/s/AKfycbz-sfnuB48hihTyy1UvJJO43oQd9J84NzyjFJ5c9MKKYjOWX_l6y6ZXu-RX00-v1J_A/exec';

// ── STATE ──
let sb = null;
let currentUser = null;
let allUsers = [];
let allWeeks = [];
let selectedWeekId = null;
let pinBuffer = '';
let selectedUserId = null;
let selectedDayTec = new Date();
let selectedDaySup = new Date();

// ── HELPERS ──
function today() {
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function dateStr(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function isoNow() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString();
}
function fmtDate(d) {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear();
}
function fmtDay(d) {
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return days[d.getDay()];
}
function fmtTime(iso) {
  if(!iso) return '';
  return new Date(iso).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
}
function currentWeek() {
  const t = today();
  return allWeeks.find(w => t >= w.start_date && t <= w.end_date) || allWeeks[0];
}

function showToast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' '+type : '');
  setTimeout(() => el.className = 'toast', 2800);
}

function el(id) { return document.getElementById(id); }

// ── INIT ──
window.addEventListener('load', async function() {
  if(typeof supabase === 'undefined') {
    el('login-error').textContent = 'Error de conexión. Recarga la página.';
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const [{ data: users }, { data: weeks }] = await Promise.all([
    sb.from('users').select('*').order('created_at'),
    sb.from('weeks').select('*').order('start_date', {ascending:false})
  ]);
  allUsers = users || [];
  allWeeks = weeks || [];
  const cw = currentWeek();
  selectedWeekId = cw ? cw.id : null;
  renderUserBtns();
  const saved = localStorage.getItem('avimex_user');
  if(saved) { currentUser = JSON.parse(saved); showApp(); }
  // Background jobs
  setInterval(autoStartFixed, 60000);
  setInterval(autoRollover, 60000);
  autoStartFixed();
  autoRollover();
});

// ── LOGIN ──
function renderUserBtns() {
  el('user-btns').innerHTML = allUsers.map(u => `
    <button class="user-btn" id="ubtn-${u.id}" onclick="selectUser('${u.id}')">
      <div class="avatar av-${u.name.toLowerCase()}">${u.name[0]}</div>
      <span>${u.name}</span>
      ${u.role==='supervisor' ? '<span class="role-tag">SUPERVISOR</span>' : ''}
    </button>`).join('');
}

function selectUser(id) {
  selectedUserId = id;
  pinBuffer = '';
  updatePinDots();
  document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('selected'));
  el('ubtn-'+id)?.classList.add('selected');
  el('login-error').textContent = '';
}

function pinKey(k) {
  if(!selectedUserId) { el('login-error').textContent = 'Selecciona un usuario'; return; }
  if(pinBuffer.length >= 4) return;
  pinBuffer += k;
  updatePinDots();
  if(pinBuffer.length === 4) setTimeout(pinEnter, 200);
}
function pinDel() { pinBuffer = pinBuffer.slice(0,-1); updatePinDots(); }
function pinClear() { pinBuffer = ''; updatePinDots(); }
function updatePinDots() {
  for(let i=0;i<4;i++) el('pd'+i).classList.toggle('filled', i < pinBuffer.length);
}
function pinEnter() {
  const user = allUsers.find(u => u.id === selectedUserId);
  if(!user || user.pin !== pinBuffer) {
    el('login-error').textContent = 'PIN incorrecto';
    pinBuffer = ''; updatePinDots(); return;
  }
  currentUser = user;
  localStorage.setItem('avimex_user', JSON.stringify(user));
  showApp();
}

function showApp() {
  el('login-screen').classList.remove('active');
  el('app-screen').classList.add('active');
  el('topbar-name').textContent = currentUser.name;
  el('topbar-avatar').textContent = currentUser.name[0];
  el('topbar-avatar').className = 'topbar-avatar av-'+currentUser.name.toLowerCase();
  selectedDayTec = new Date();
  selectedDaySup = new Date();
  if(currentUser.role === 'supervisor') setupSupervisor();
  else setupTecnico();
}

function logout() {
  localStorage.removeItem('avimex_user');
  currentUser = null; pinBuffer = ''; selectedUserId = null;
  updatePinDots();
  document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('selected'));
  el('login-error').textContent = '';
  el('app-screen').classList.remove('active');
  el('login-screen').classList.add('active');
}

// ══════════════════════════════════════════
//  TÉCNICO
// ══════════════════════════════════════════
function setupTecnico() {
  el('tec-view').classList.add('active');
  el('sup-view').classList.remove('active');
  el('bottom-nav').innerHTML = `
    <button class="bnav-btn active" id="bn-tec-hoy" onclick="tecTab('hoy')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"/></svg>
      HOY
    </button>
    <button class="bnav-btn" id="bn-tec-pendientes" onclick="tecTab('pendientes')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke-linecap="round"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
      PENDIENTES
    </button>`;
  loadTecHoy();
}

function tecTab(tab) {
  document.querySelectorAll('#tec-view .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  el('tec-'+tab).classList.add('active');
  el('bn-tec-'+tab)?.classList.add('active');
  if(tab === 'pendientes') loadTecPendientes();
  else loadTecHoy();
}

function tecNavDay(d) {
  selectedDayTec = new Date(selectedDayTec);
  selectedDayTec.setDate(selectedDayTec.getDate() + d);
  loadTecHoy();
}
function tecGoToday() { selectedDayTec = new Date(); loadTecHoy(); }

async function loadTecHoy() {
  const viewDate = dateStr(selectedDayTec);
  const todayStr = today();
  const isToday = viewDate === todayStr;
  const isPast = viewDate < todayStr;

  // Update day header
  const dayDiff = Math.round((new Date(viewDate+'T12:00:00') - new Date(todayStr+'T12:00:00')) / 86400000);
  let label = isToday ? 'HOY' : dayDiff === 1 ? 'MAÑANA' : dayDiff === -1 ? 'AYER' : fmtDay(selectedDayTec).toUpperCase();
  el('tec-day-label').textContent = label;
  el('tec-day-date').textContent = fmtDate(selectedDayTec);
  el('tec-btn-today').style.display = isToday ? 'none' : 'inline-block';

  // Load fixed activities
  const fixedEl = el('tec-fixed');
  fixedEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const { data: fixed } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id).eq('scheduled_date', viewDate).eq('is_fixed', true);
  
  if(!fixed || !fixed.length) {
    fixedEl.innerHTML = '<div style="color:var(--text-muted);font-size:.78rem;padding:6px 0">Sin actividades fijas este día</div>';
  } else {
    const nowStr = new Date().toTimeString().slice(0,5);
    // Deduplicate
    const seen = {}; const unique = [];
    fixed.forEach(a => { const k=a.title+'|'+(a.scheduled_start||''); if(!seen[k]){seen[k]=true;unique.push(a);} });
    unique.sort((a,b)=>(a.scheduled_start||'').localeCompare(b.scheduled_start||''));
    fixedEl.innerHTML = unique.map(a => {
      const t = a.scheduled_start ? a.scheduled_start.slice(0,5)+' - '+(a.scheduled_end||'').slice(0,5) : '';
      let statusClass = 'badge-pending', statusText = 'Programada';
      if(a.status==='en_progreso'){statusClass='badge-progress';statusText='En progreso';}
      else if(a.status==='completada'){statusClass='badge-done';statusText='Completada';}
      else if(isToday && a.scheduled_start && nowStr >= (a.scheduled_start||'').slice(0,5) && a.status==='pendiente'){statusClass='badge-progress';statusText='En horario';}
      return `<div class="fixed-row">
        <div class="fixed-time">${t}</div>
        <div class="fixed-name">${a.title}</div>
        <span class="badge ${statusClass}" style="font-size:.65rem">${statusText}</span>
      </div>`;
    }).join('');
  }

  // Load regular activities
  const actsEl = el('tec-acts');
  actsEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const { data: acts } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id).eq('scheduled_date', viewDate).eq('is_fixed', false);
  
  if(!acts || !acts.length) {
    actsEl.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">${isToday?'Sin actividades para hoy':'Sin actividades este día'}</div></div>`;
    return;
  }
  actsEl.innerHTML = acts.map(a => renderTecCard(a, isPast)).join('');
}

function renderTecCard(a, isPast) {
  const isAlert = a.rolled_over;
  let statusBadge = '';
  let actions = '';
  
  if(a.status === 'pendiente') {
    statusBadge = `<span class="badge badge-pending">Pendiente</span>`;
    if(!isPast) actions = `<button class="btn btn-primary btn-sm" onclick="tecStart('${a.id}')">▶ Iniciar</button>`;
  } else if(a.status === 'en_progreso') {
    statusBadge = `<span class="badge badge-progress"><span class="live-dot"></span> En progreso</span>`;
    actions = `
      <label class="upload-btn" style="margin:0;padding:7px 12px;font-size:.75rem">
        📷 Fotos
        <input type="file" class="img-file-input" accept="image/*" multiple onchange="tecUploadPhoto('${a.id}',this)">
      </label>
      <button class="btn btn-success btn-sm" onclick="tecFinish('${a.id}')">✓ Finalizar</button>
      <button class="btn btn-danger btn-sm" onclick="tecCancel('${a.id}')">✕</button>`;
  } else if(a.status === 'completada') {
    statusBadge = `<span class="badge badge-done">✓ Completada</span>`;
    actions = `
      <label class="upload-btn" style="margin:0;padding:7px 12px;font-size:.75rem">
        📷 Más fotos
        <input type="file" class="img-file-input" accept="image/*" multiple onchange="tecUploadPhoto('${a.id}',this)">
      </label>`;
  }

  return `<div class="card" id="card-${a.id}">
    ${isAlert ? `<div class="alert alert-warning" style="margin-bottom:8px">⚠️ No fue concluida el día anterior</div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1">
        <div class="card-title">${a.title||''}</div>
        ${a.description ? `<div class="card-meta" style="margin-top:3px">${a.description}</div>` : ''}
        ${a.type ? `<span class="badge badge-pending" style="margin-top:6px;font-size:.65rem">${a.type}</span>` : ''}
      </div>
      ${statusBadge}
    </div>
    ${actions ? `<div class="card-actions">${actions}</div>` : ''}
    <div id="imgs-${a.id}" class="img-grid" style="margin-top:8px"></div>
  </div>`;
}

async function tecStart(id) {
  await sb.from('activities').update({status:'en_progreso', started_at:isoNow()}).eq('id',id);
  showToast('Actividad iniciada','success');
  loadTecHoy();
}

async function tecFinish(id) {
  const { data: imgs, error: imgErr } = await sb.from('activity_images').select('id').eq('activity_id', id);
  if(imgErr) { showToast('Error verificando fotos: '+imgErr.message,'error'); return; }
  if(!imgs || !imgs.length) { showToast('Sube al menos 1 foto antes de finalizar','error'); return; }
  const { data } = await sb.from('activities').select('started_at').eq('id',id).single();
  const now = new Date();
  const mins = data?.started_at ? Math.max(0, Math.round((now - new Date(data.started_at))/60000)) : 0;
  await sb.from('activities').update({status:'completada', finished_at:isoNow(), duration_minutes:mins}).eq('id',id);
  showToast('¡Actividad completada! ✓','success');
  loadTecHoy();
}

async function tecCancel(id) {
  await sb.from('activities').update({status:'pendiente', started_at:null}).eq('id',id);
  showToast('Inicio cancelado');
  loadTecHoy();
}

async function uploadPhotos(actId, input, onDone) {
  if(!input.files.length) return;
  showToast('Subiendo fotos...');
  const { data: act } = await sb.from('activities').select('title,scheduled_date,week_id').eq('id',actId).single();
  const week = allWeeks.find(w => w.id === act?.week_id);
  const d = new Date((act?.scheduled_date||today())+'T12:00:00');
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const folderPath = 'AVI-MEX/' + months[d.getMonth()] + ' ' + d.getFullYear() + '/' + (week?.label||'Sin semana') + '/' + (act?.title||'Actividad');
  const files = Array.from(input.files);
  let uploaded = 0;
  await Promise.allSettled(files.map(async (file) => {
    const reader = new FileReader();
    const dataUrl = await new Promise(res => { reader.onload = e => res(e.target.result); reader.readAsDataURL(file); });
    const b64 = dataUrl.split(',')[1];
    const mimeType = file.type || 'image/jpeg';
    try {
      const form = new FormData();
      form.append('file', b64);
      form.append('filename', Date.now()+'_'+file.name);
      form.append('folder', folderPath);
      form.append('mimeType', mimeType);
      const res = await fetch(APPS_SCRIPT, {method:'POST', body:form, redirect:'follow'});
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch(e) { data = {}; }
      if(data.url) {
        const { error: insErr } = await sb.from('activity_images').insert({
          activity_id: actId, 
          url: data.url, 
          uploaded_by: currentUser.id,
          created_at: new Date().toISOString()
        });
        if(insErr) {
          showToast('Error BD: '+insErr.message, 'error');
          console.error('Insert error:', insErr);
        } else {
          uploaded++;
        }
      } else {
        showToast('Drive no devolvió URL', 'error');
        console.error('No URL in response:', text);
      }
    } catch(err) {
      console.error('Upload error:', err);
    }
  }));
  if(uploaded > 0) {
    showToast(uploaded + ' foto(s) subida(s) ✓','success');
    // Reload images in card
    const imgGrid = document.getElementById('imgs-'+actId);
    if(imgGrid) {
      const { data: imgs } = await sb.from('activity_images').select('*').eq('activity_id', actId);
      if(imgs && imgs.length) {
        imgGrid.innerHTML = imgs.map(i => `<img src="${i.drive_file_url}" class="img-thumb">`).join('');
      }
    }
  } else {
    showToast('Error al subir fotos','error');
  }
  if(onDone) onDone();
}

async function tecUploadPhoto(actId, input) {
  await uploadPhotos(actId, input, () => loadTecHoy());
}

async function loadTecPendientes() {
  const pendEl = el('tec-pend-list');
  const doneEl = el('tec-done-list');
  const futureEl = el('tec-future-list');
  pendEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  const { data: all } = await sb.from('activities').select('*')
    .eq('assigned_to', currentUser.id).eq('is_fixed', false).order('scheduled_date');
  const acts = all || [];
  const todayStr = today();

  const pending = acts.filter(a => a.status !== 'completada' && a.scheduled_date <= todayStr);
  const done = acts.filter(a => a.status === 'completada');
  const future = acts.filter(a => a.status === 'pendiente' && a.scheduled_date > todayStr);

  // Pending
  if(!pending.length) {
    pendEl.innerHTML = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Sin actividades pendientes</div></div>';
  } else {
    pendEl.innerHTML = `<div class="sec-label">Pendientes (${pending.length})</div>` +
      pending.map(a => renderTecCard(a, false)).join('');
  }

  // Done
  if(done.length) {
    doneEl.innerHTML = `<div style="height:1px;background:var(--border);margin:14px 0"></div>
      <div class="sec-label">Completadas (${done.length})</div>` +
      done.map(a => renderTecCard(a, true)).join('');
  }

  // Future by month
  if(future.length) {
    const byMonth = {};
    future.forEach(a => {
      const d = new Date(a.scheduled_date+'T12:00:00');
      const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const key = months[d.getMonth()]+' '+d.getFullYear();
      if(!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(a);
    });
    let html = `<div style="height:1px;background:var(--border);margin:14px 0"></div><div class="sec-label">Próximas actividades</div>`;
    Object.entries(byMonth).forEach(([month, acts]) => {
      html += `<div class="month-section">
        <button class="month-toggle" onclick="toggleMonth(this)">${month} <span class="arrow">▾</span></button>
        <div class="month-content">${acts.map(a => `
          <div class="card" style="margin-top:6px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <div class="card-title">${a.title}</div>
                <div class="card-meta">${a.scheduled_date}</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="tecMoveToToday('${a.id}')">+ Hoy</button>
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    });
    futureEl.innerHTML = html;
  }
}

function toggleMonth(btn) {
  btn.classList.toggle('open');
  btn.nextElementSibling.classList.toggle('open');
}

async function tecMoveToToday(id) {
  await sb.from('activities').update({scheduled_date: today()}).eq('id', id);
  showToast('Actividad movida a hoy','success');
  loadTecPendientes();
}

// ══════════════════════════════════════════
//  SUPERVISOR
// ══════════════════════════════════════════
function setupSupervisor() {
  el('sup-view').classList.add('active');
  el('tec-view').classList.remove('active');
  el('bottom-nav').innerHTML = `
    <button class="bnav-btn active" id="bn-dashboard" onclick="supTab('dashboard')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      DASHBOARD
    </button>
    <button class="bnav-btn" id="bn-semana" onclick="supTab('semana')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"/></svg>
      SEMANA
    </button>
    <button class="bnav-btn" id="bn-lista" onclick="supTab('lista')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke-linecap="round"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
      LISTA
    </button>
    <button class="bnav-btn" id="bn-agregar" onclick="supTab('agregar')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16" stroke-linecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke-linecap="round"/></svg>
      AGREGAR
    </button>
    <button class="bnav-btn" id="bn-stats" onclick="supTab('stats')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      STATS
    </button>`;
  loadSupDashboard();
  populateAddForm();
}

function supTab(tab) {
  document.querySelectorAll('#sup-view .tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  el('sup-'+tab).classList.add('active');
  el('bn-'+tab)?.classList.add('active');
  if(tab==='dashboard') loadSupDashboard();
  else if(tab==='semana') loadSupSemana();
  else if(tab==='lista') loadSupLista();
  else if(tab==='stats') loadSupStats();
}

function supNavDay(d) {
  selectedDaySup = new Date(selectedDaySup);
  selectedDaySup.setDate(selectedDaySup.getDate() + d);
  loadSupDayActs();
}
function supGoToday() { selectedDaySup = new Date(); loadSupDayActs(); }

async function loadSupDashboard() {
  const cw = currentWeek();
  if(cw) selectedWeekId = cw.id;
  
  // Build week chips
  buildWeekChips('sup-week-chips', selectedWeekId, (wid) => {
    selectedWeekId = wid;
    el('sup-week-label').textContent = allWeeks.find(w=>w.id===wid)?.label || '';
    loadSupDashboardData();
  });
  
  el('sup-week-label').textContent = cw?.label || 'Semana actual';
  await loadSupDashboardData();
  await loadSupDayActs();
}

async function loadSupDashboardData() {
  const { data: acts } = await sb.from('activities').select('*')
    .eq('week_id', selectedWeekId).eq('is_fixed', false);
  if(!acts) return;
  
  el('dash-total').textContent = acts.length;
  el('dash-done').textContent = acts.filter(a=>a.status==='completada').length;
  el('dash-prog').textContent = acts.filter(a=>a.status==='en_progreso').length;
  el('dash-pend').textContent = acts.filter(a=>a.status==='pendiente').length;

  ['pedro','said'].forEach(name => {
    const user = allUsers.find(u=>u.name.toLowerCase()===name);
    if(!user) return;
    const ua = acts.filter(a=>a.assigned_to===user.id);
    const p = ua.length ? Math.round(ua.filter(a=>a.status==='completada').length/ua.length*100) : 0;
    el('pct-'+name).textContent = p+'%';
    el('bar-'+name).style.width = p+'%';
  });

  // Live activities
  const live = acts.filter(a=>a.status==='en_progreso');
  el('sup-live').innerHTML = !live.length
    ? '<div class="empty"><div class="empty-text">Sin actividades en progreso</div></div>'
    : live.map(a => renderSupCard(a)).join('');
}

async function loadSupDayActs() {
  const viewDate = dateStr(selectedDaySup);
  const todayStr = today();
  const isToday = viewDate === todayStr;
  const dayDiff = Math.round((new Date(viewDate+'T12:00:00') - new Date(todayStr+'T12:00:00'))/86400000);
  
  let label = isToday ? 'HOY' : dayDiff===1 ? 'MAÑANA' : dayDiff===-1 ? 'AYER' : fmtDay(selectedDaySup).toUpperCase();
  el('sup-day-label').textContent = label;
  el('sup-day-date').textContent = fmtDate(selectedDaySup);
  el('sup-btn-today').style.display = isToday ? 'none' : 'inline-block';

  const supUser = allUsers.find(u=>u.role==='supervisor');
  if(!supUser) return;

  // Fixed
  const { data: fixed } = await sb.from('activities').select('*')
    .eq('assigned_to', supUser.id).eq('scheduled_date', viewDate).eq('is_fixed', true);
  const fixedEl = el('sup-day-fixed');
  if(!fixed || !fixed.length) { fixedEl.innerHTML = ''; }
  else {
    fixedEl.innerHTML = fixed.sort((a,b)=>(a.scheduled_start||'').localeCompare(b.scheduled_start||'')).map(a => {
      const t = a.scheduled_start ? a.scheduled_start.slice(0,5)+'-'+(a.scheduled_end||'').slice(0,5) : '';
      let cls = 'badge-pending', txt = 'Programada';
      if(a.status==='en_progreso'){cls='badge-progress';txt='En progreso';}
      if(a.status==='completada'){cls='badge-done';txt='Completada';}
      return `<div class="fixed-row"><div class="fixed-time">${t}</div><div class="fixed-name">${a.title}</div><span class="badge ${cls}">${txt}</span></div>`;
    }).join('');
  }

  // Regular
  const { data: acts } = await sb.from('activities').select('*')
    .eq('assigned_to', supUser.id).eq('scheduled_date', viewDate).eq('is_fixed', false);
  const actsEl = el('sup-day-acts');
  if(!acts || !acts.length) {
    actsEl.innerHTML = `<div class="empty" style="padding:16px"><div class="empty-text">Sin actividades este día</div></div>`;
  } else {
    actsEl.innerHTML = acts.map(a => renderSupCard(a)).join('');
  }
}

function renderSupCard(a) {
  const who = allUsers.find(u=>u.id===a.assigned_to);
  const whoName = who ? who.name : 'Sin asignar';
  let statusBadge = '', actions = '';
  
  if(a.status==='pendiente') {
    statusBadge = `<span class="badge badge-pending">Pendiente</span>`;
    actions = `<button class="btn btn-primary btn-sm" onclick="supStart('${a.id}')">▶ Iniciar</button>
      <button class="btn btn-outline btn-sm" onclick="openEdit('${a.id}')">✏️ Editar</button>`;
  } else if(a.status==='en_progreso') {
    statusBadge = `<span class="badge badge-progress"><span class="live-dot"></span> En progreso</span>`;
    actions = `
      <label class="upload-btn" style="margin:0;padding:7px 12px;font-size:.75rem">
        📷 Fotos
        <input type="file" class="img-file-input" accept="image/*" multiple onchange="supUploadPhoto('${a.id}',this)">
      </label>
      <button class="btn btn-success btn-sm" onclick="supFinish('${a.id}')">✓ Finalizar</button>
      <button class="btn btn-danger btn-sm" onclick="supCancel('${a.id}')">✕</button>
      <button class="btn btn-outline btn-sm" onclick="openEdit('${a.id}')">✏️</button>`;
  } else {
    statusBadge = `<span class="badge badge-done">✓ Completada</span>`;
    actions = `
      <label class="upload-btn" style="margin:0;padding:7px 12px;font-size:.75rem">
        📷 Más fotos
        <input type="file" class="img-file-input" accept="image/*" multiple onchange="supUploadPhoto('${a.id}',this)">
      </label>
      <button class="btn btn-outline btn-sm" onclick="openEdit('${a.id}')">✏️ Editar</button>`;
  }

  return `<div class="card" id="card-${a.id}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1">
        <div class="card-title">${a.title||''}</div>
        <div class="card-meta">${whoName}${a.scheduled_date?' · '+a.scheduled_date:''}</div>
      </div>
      ${statusBadge}
    </div>
    ${actions ? `<div class="card-actions">${actions}</div>` : ''}
    <div id="imgs-${a.id}" class="img-grid" style="margin-top:8px"></div>
  </div>`;
}

async function supStart(id) {
  await sb.from('activities').update({status:'en_progreso',started_at:isoNow()}).eq('id',id);
  showToast('Iniciada','success');
  loadSupDashboard();
}
async function supFinish(id) {
  const { data: imgs } = await sb.from('activity_images').select('id').eq('activity_id',id);
  if(!imgs||!imgs.length){showToast('Sube al menos 1 foto','error');return;}
  const { data } = await sb.from('activities').select('started_at').eq('id',id).single();
  const now = new Date();
  const mins = data?.started_at ? Math.max(0,Math.round((now-new Date(data.started_at))/60000)) : 0;
  await sb.from('activities').update({status:'completada',finished_at:isoNow(),duration_minutes:mins}).eq('id',id);
  showToast('Completada ✓','success');
  loadSupDashboard();
}
async function supCancel(id) {
  await sb.from('activities').update({status:'pendiente',started_at:null}).eq('id',id);
  showToast('Cancelado');
  loadSupDashboard();
}

async function supUploadPhoto(actId, input) {
  await uploadPhotos(actId, input, () => loadSupDashboard());
}

// ── SEMANA ──
async function loadSupSemana() {
  const monthsEl = el('sup-semana-months');
  monthsEl.innerHTML = '';
  
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const byMonth = {};
  allWeeks.slice().reverse().forEach(w => {
    const d = new Date(w.start_date+'T12:00:00');
    const key = monthNames[d.getMonth()]+' '+d.getFullYear();
    if(!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(w);
  });

  Object.entries(byMonth).forEach(([month, weeks]) => {
    const div = document.createElement('div');
    div.className = 'month-section';
    const isCurrentMonth = weeks.some(w => w.id === selectedWeekId);
    div.innerHTML = `
      <button class="month-toggle ${isCurrentMonth?'open':''}" onclick="toggleMonth(this)">
        ${month} <span class="arrow">▾</span>
      </button>
      <div class="month-content ${isCurrentMonth?'open':''}">
        ${weeks.map(w => `
          <div style="padding:6px 0;border-bottom:1px solid var(--border)">
            <button style="width:100%;text-align:left;padding:8px 4px;font-size:.82rem;font-weight:${w.id===selectedWeekId?'700':'500'};color:${w.id===selectedWeekId?'var(--blue)':'var(--text)'}" 
              onclick="selectWeekSemana('${w.id}')">
              ${w.label} ${w.id===selectedWeekId?'◀':''}
            </button>
          </div>`).join('')}
      </div>`;
    monthsEl.appendChild(div);
  });

  loadWeekTable(selectedWeekId);
}

async function selectWeekSemana(wid) {
  selectedWeekId = wid;
  loadWeekTable(wid);
  loadSupSemana();
}

async function loadWeekTable(weekId) {
  const tableEl = el('sup-semana-table');
  tableEl.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const week = allWeeks.find(w=>w.id===weekId);
  if(!week){tableEl.innerHTML='';return;}
  
  const { data: acts } = await sb.from('activities').select('*').eq('week_id', weekId);
  const allActs = acts || [];
  const todayStr = today();
  
  // Build Wed-Tue days
  const days = ['Mié','Jue','Vie','Sáb','Dom','Lun','Mar'];
  const start = new Date(week.start_date+'T12:00:00');
  const dates = [];
  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate()+i);
    dates.push(dateStr(d));
  }

  let html = `<table class="week-table"><thead><tr><th style="min-width:60px">Usuario</th>`;
  dates.forEach((dt,i) => {
    const isToday = dt===todayStr;
    html += `<th style="${isToday?'background:var(--orange)':''}">
      ${days[i]}<br><span style="font-weight:400;font-size:.65rem">${dt.slice(5)}</span>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  // Row per user
  allUsers.forEach(user => {
    html += `<tr><td style="font-weight:700;font-size:.75rem;padding:6px 4px">${user.name}</td>`;
    dates.forEach(dt => {
      const isToday = dt===todayStr;
      const dayActs = allActs.filter(a=>a.assigned_to===user.id && a.scheduled_date===dt);
      html += `<td class="${isToday?'today':''}">`;
      if(!dayActs.length) {
        html += `<div style="color:var(--border);text-align:center;padding:4px">—</div>`;
      } else {
        dayActs.forEach(a => {
          const cls = a.status==='completada'?'done':a.status==='en_progreso'?'prog':'';
          html += `<div class="wt-act ${cls}" onclick="openEdit('${a.id}')" title="${a.title}">
            ${a.title.length>18?a.title.slice(0,16)+'…':a.title}
          </div>`;
        });
      }
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  tableEl.innerHTML = html;
}

// ── LISTA ──
async function loadSupLista() {
  const el_lista = el('sup-lista-content');
  el_lista.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  const { data: acts } = await sb.from('activities').select('*').eq('is_fixed',false).order('scheduled_date');
  const all = acts || [];
  const todayStr = today();
  
  const active = all.filter(a => a.status !== 'completada');
  const done = all.filter(a => a.status === 'completada');
  
  let html = '';
  
  if(active.length) {
    html += `<div class="sec-label">Pendientes / En progreso (${active.length})</div>`;
    html += active.map(a => renderSupCard(a)).join('');
  } else {
    html += '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Sin actividades pendientes</div></div>';
  }

  // Done by week
  if(done.length) {
    html += `<div style="height:1px;background:var(--border);margin:16px 0"></div>
      <div class="sec-label">Completadas por semana</div>`;
    const byWeek = {};
    done.forEach(a => { const k=a.week_id||'sin'; if(!byWeek[k]) byWeek[k]=[]; byWeek[k].push(a); });
    allWeeks.slice().reverse().forEach(w => {
      if(!byWeek[w.id]?.length) return;
      html += `<div class="month-section" style="margin-bottom:8px">
        <button class="month-toggle" onclick="toggleMonth(this)">${w.label} (${byWeek[w.id].length}) <span class="arrow">▾</span></button>
        <div class="month-content">${byWeek[w.id].map(a => renderSupCard(a)).join('')}</div>
      </div>`;
    });
  }

  el_lista.innerHTML = html;
}

// ── STATS ──
async function loadSupStats() {
  const statsEl = el('stats-content');
  statsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Generando...</div>';
  
  const cw = currentWeek();
  if(!cw){statsEl.innerHTML='<div class="empty"><div class="empty-text">Sin semana actual</div></div>';return;}

  const { data: thisWeek } = await sb.from('activities').select('*').eq('week_id',cw.id).eq('is_fixed',false);
  
  // Last week
  const cwIdx = allWeeks.findIndex(w=>w.id===cw.id);
  const lastWeek = allWeeks[cwIdx+1];
  const { data: lastWeekActs } = lastWeek 
    ? await sb.from('activities').select('*').eq('week_id',lastWeek.id).eq('is_fixed',false) 
    : {data:[]};

  const tw = thisWeek||[], lw = lastWeekActs||[];
  const twDone = tw.filter(a=>a.status==='completada').length;
  const lwDone = lw.filter(a=>a.status==='completada').length;
  const twPct = tw.length ? Math.round(twDone/tw.length*100) : 0;
  const lwPct = lw.length ? Math.round(lwDone/lw.length*100) : 0;

  let html = `
    <div class="sec-label">Semana actual vs anterior</div>
    <div class="chart-bar-wrap">
      <div class="chart-label"><span>${cw.label}</span><span>${twPct}% (${twDone}/${tw.length})</span></div>
      <div class="chart-bar-bg"><div class="chart-bar-fill" style="width:${twPct}%"></div></div>
    </div>
    ${lastWeek ? `<div class="chart-bar-wrap">
      <div class="chart-label"><span>${lastWeek.label}</span><span>${lwPct}% (${lwDone}/${lw.length})</span></div>
      <div class="chart-bar-bg"><div class="chart-bar-fill orange" style="width:${lwPct}%"></div></div>
    </div>` : ''}
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <div class="sec-label">Por técnico — semana actual</div>`;

  allUsers.filter(u=>u.role!=='supervisor').forEach(user => {
    const ua = tw.filter(a=>a.assigned_to===user.id);
    const done2 = ua.filter(a=>a.status==='completada').length;
    const pct = ua.length ? Math.round(done2/ua.length*100) : 0;
    html += `<div class="chart-bar-wrap">
      <div class="chart-label"><span>${user.name}</span><span>${pct}% (${done2}/${ua.length})</span></div>
      <div class="chart-bar-bg"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  });

  html += `<div style="height:1px;background:var(--border);margin:16px 0"></div>
    <div class="sec-label">Actividades completadas esta semana</div>`;
  
  if(!twDone) {
    html += '<div class="empty"><div class="empty-text">Sin actividades completadas</div></div>';
  } else {
    tw.filter(a=>a.status==='completada').forEach(a => {
      const who = allUsers.find(u=>u.id===a.assigned_to);
      html += `<div style="padding:8px 12px;background:var(--white);border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:.82rem;font-weight:600">${a.title}</div><div style="font-size:.72rem;color:var(--text-muted)">${who?.name||'—'}</div></div>
        <span class="badge badge-done">✓</span>
      </div>`;
    });
  }

  statsEl.innerHTML = html;
}

function downloadReport(type) {
  showToast('Descarga próximamente disponible');
}

// ── ADD ACTIVITY ──
function populateAddForm() {
  const sel = el('add-assigned');
  sel.innerHTML = '<option value="">— Sin asignar —</option>' +
    allUsers.map(u=>`<option value="${u.id}">${u.name}${u.role==='supervisor'?' (Supervisor)':''}</option>`).join('');
  
  const weekSel = el('add-week');
  const todayStr = today();
  const cw = currentWeek();
  weekSel.innerHTML = allWeeks.slice().reverse().map(w =>
    `<option value="${w.id}" ${w.id===cw?.id?'selected':''}>${w.label}</option>`).join('');
  
  el('add-date').value = todayStr;
  el('add-autostart').addEventListener('change', function() {
    el('add-time-fields').style.display = this.value==='yes' ? 'block' : 'none';
  });
}

async function addActivity() {
  const title = el('add-title').value.trim();
  if(!title){showToast('Escribe un título','error');return;}
  const assigned = el('add-assigned').value || null;
  const type = el('add-type').value;
  const date = el('add-date').value || null;
  const weekId = el('add-week').value || null;
  const autostart = el('add-autostart').value === 'yes';
  const startTime = autostart ? el('add-start').value || null : null;
  const endTime = autostart ? el('add-end').value || null : null;
  const desc = el('add-desc').value.trim() || null;
  const month = date ? parseInt(date.split('-')[1]) : new Date().getMonth()+1;

  const { error } = await sb.from('activities').insert({
    title, type, assigned_to: assigned, scheduled_date: date,
    week_id: weekId, scheduled_month: month,
    description: desc, status: 'pendiente', is_fixed: false,
    auto_start: autostart,
    scheduled_start: startTime, scheduled_end: endTime,
    created_by: currentUser.id
  });
  if(error){showToast('Error al guardar','error');return;}
  showToast('Actividad agregada ✓','success');
  el('add-title').value = '';
  el('add-desc').value = '';
  el('add-autostart').value = 'no';
  el('add-time-fields').style.display = 'none';
}

// ── EDIT ──
async function openEdit(id) {
  const { data: a } = await sb.from('activities').select('*').eq('id',id).single();
  if(!a) return;
  const who = allUsers.find(u=>u.id===a.assigned_to);
  const imgs = await sb.from('activity_images').select('*').eq('activity_id',id);
  const imgList = (imgs.data||[]).map(i=>`<img src="${i.drive_file_url}" class="img-thumb">`).join('');

  el('edit-title-label').textContent = a.title;
  el('edit-content').innerHTML = `
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select class="form-input" id="edit-status">
        <option value="pendiente" ${a.status==='pendiente'?'selected':''}>Pendiente</option>
        <option value="en_progreso" ${a.status==='en_progreso'?'selected':''}>En progreso</option>
        <option value="completada" ${a.status==='completada'?'selected':''}>Completada</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Asignar a</label>
      <select class="form-input" id="edit-assigned">
        <option value="">— Sin asignar —</option>
        ${allUsers.map(u=>`<option value="${u.id}" ${u.id===a.assigned_to?'selected':''}>${u.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input class="form-input" id="edit-date" type="date" value="${a.scheduled_date||''}">
    </div>
    <div class="form-group">
      <label class="form-label">Semana</label>
      <select class="form-input" id="edit-week">
        ${allWeeks.slice().reverse().map(w=>`<option value="${w.id}" ${w.id===a.week_id?'selected':''}>${w.label}</option>`).join('')}
      </select>
    </div>
    ${imgList ? `<div class="sec-label">Fotos</div><div class="img-grid">${imgList}</div>` : ''}
    <label class="upload-btn" style="margin-top:10px">
      📷 Subir fotos
      <input type="file" class="img-file-input" accept="image/*" multiple onchange="supUploadPhoto('${id}',this)">
    </label>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" onclick="saveEdit('${id}')">Guardar cambios</button>
      <button class="btn btn-danger btn-sm" onclick="deleteActivity('${id}')">Eliminar</button>
      <button class="btn btn-outline btn-sm" onclick="closeEdit()">Cancelar</button>
    </div>`;

  el('edit-overlay').classList.add('open');
  el('edit-overlay').onclick = function(e) { if(e.target===this) closeEdit(); };
}

async function saveEdit(id) {
  const status = el('edit-status').value;
  const assigned = el('edit-assigned').value || null;
  const date = el('edit-date').value || null;
  const weekId = el('edit-week').value || null;
  await sb.from('activities').update({status, assigned_to:assigned, scheduled_date:date, week_id:weekId}).eq('id',id);
  showToast('Guardado ✓','success');
  closeEdit();
  loadSupDashboard();
}

async function deleteActivity(id) {
  if(!confirm('¿Eliminar esta actividad?')) return;
  await sb.from('activities').delete().eq('id',id);
  showToast('Actividad eliminada');
  closeEdit();
  loadSupDashboard();
}

function closeEdit() {
  el('edit-overlay').classList.remove('open');
}

// ── WEEK CHIPS HELPER ──
function buildWeekChips(containerId, activeId, onSelect) {
  const container = el(containerId);
  if(!container) return;
  const todayStr = today();
  const cw = currentWeek();
  container.innerHTML = allWeeks.slice().reverse().map(w => {
    const isCurrent = w.id === (cw?.id);
    return `<div class="week-chip ${w.id===activeId?'active':''}" onclick="(${onSelect.toString()})('${w.id}')">
      ${w.label}${isCurrent?' ●':''}
    </div>`;
  }).join('');
  setTimeout(() => {
    const a = container.querySelector('.week-chip.active');
    if(a) a.scrollIntoView({inline:'nearest',behavior:'auto'});
  }, 50);
}

// ── AUTO START FIXED ──
async function autoStartFixed() {
  const todayStr = today();
  const nowStr = new Date().toTimeString().slice(0,5);
  const { data: acts } = await sb.from('activities').select('*')
    .eq('is_fixed', true).eq('scheduled_date', todayStr).eq('status', 'pendiente');
  if(!acts) return;
  for(const a of acts) {
    if(!a.scheduled_start) continue;
    const start = a.scheduled_start.slice(0,5);
    const end = (a.scheduled_end||'99:99').slice(0,5);
    if(nowStr >= start && nowStr < end) {
      await sb.from('activities').update({status:'en_progreso', started_at:isoNow()}).eq('id',a.id);
    }
  }
  // Auto complete if past end time
  const { data: prog } = await sb.from('activities').select('*')
    .eq('is_fixed', true).eq('scheduled_date', todayStr).eq('status', 'en_progreso');
  if(!prog) return;
  for(const a of prog) {
    if(!a.scheduled_end) continue;
    if(nowStr >= a.scheduled_end.slice(0,5)) {
      const started = a.started_at ? new Date(a.started_at) : new Date();
      const mins = Math.max(0, Math.round((new Date()-started)/60000));
      await sb.from('activities').update({status:'completada', finished_at:isoNow(), duration_minutes:mins}).eq('id',a.id);
    }
  }
}

// ── AUTO ROLLOVER (7am) ──
async function autoRollover() {
  const now = new Date();
  if(now.getHours() < 7) return; // Only after 7am
  const todayStr = today();
  // Get yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr = dateStr(yesterday);
  
  const { data: overdue } = await sb.from('activities').select('*')
    .eq('scheduled_date', yesterdayStr)
    .neq('status', 'completada')
    .eq('is_fixed', false);
  
  if(!overdue || !overdue.length) return;
  
  // Find week for today
  const cw = currentWeek();
  
  for(const a of overdue) {
    await sb.from('activities').update({
      scheduled_date: todayStr,
      week_id: cw?.id || a.week_id,
      status: 'pendiente',
      started_at: null,
      rolled_over: true
    }).eq('id', a.id);
  }
}
