// CONFIG
const SUPABASE_URL = 'https://eaeuqcdcnkztttkfvbut.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f89Uz7LwwTcjqpdKKzXlYg_HuNsTtC3';
const ANTHROPIC_KEY_PLACEHOLDER = 'USE_YOUR_ANTHROPIC_KEY'; // Se llena desde el backend
const DRIVE_FOLDER_ID = '1c5gqD11F2szgL-EB5MYP2C4qg8g7nv7m';
const SERVICE_ACCOUNT = {
  client_email: 'avimex-drive@automatizacionmay2026.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCq7e34rJ/Dq/lU\\\nWX8QJfwH1kPzty/LgQMc4MTewgzffmIRK3pPUPPXckrxEmwoLNOfTKjyPETTOSLF\\\nUAoJxZWRpT3Db11ND4QX58DBHUe7KpldNIl6qnWZMm2+WlrBvU3O1h7yYFxMFtcT\\\nRl6FMtTDP8ht8Nzr2xKcFJyInjQtIVC1IERQrzbfodrzTuEVvZz7LuDlVRT15h7p\\\nOC3gt3ArFalq5Qb/fCPnw4Qg/KL0FbmQEx80MW4/fglssNUIRZKR6yP6vkOveXFR\\\n8e8yqFP4wcV894tYfSkuUQNAF/ljqN3B2hkKElxB6OrS+bi4SWLjV7NGfmBpYlzg\\\nevQPo0qVAgMBAAECggEAIMfwRWqP2lY7Q0TFtFpgjz01u4Ikma4Eo49s2j7TerJR\\\nivLwalE/bpCGFF1A3mSYclrgpNJPrcWtqDM9NZoN4QiUg4xyU5LX9cC1zCN6LAhT\\\nsNcgTaTu2EJeXy0TbkgIqdQRS9EUqmgP9+udOYTh3o83OHSC3f3eAA6I5b+XiJbk\\\ndWQ1BHxqse/xrSs57okknFeEa/tamn4wYfJZ1KWm+uLQig66sP+djbO6RAduTM6y\\\na8itVglTFVJ69jLxfRkGRP78Cq/pSRzOpgWMDRE3/Rzb8KcnLIYw/ykkRhqtoRYY\\\nIO9gyRm8xYvoUfaRxQXtvqoxZNnv2EtJKtUfMlDD8QKBgQDdqEYqEkXTZmCXALhc\\\nh0fSgqpIfsE9MImUU7HWTFH0T/1DijdtIfyvi/9scyoU8IG6PtkIxe1GxtMTjMZv\\\nH5O+h3TprN35ZFkHsLAo/w+UyB9vRH8+uY9ZuXRz0MgkHnWBcs+qC087Rqgz4AZS\\\nu+LgLfmzVd//pUGBI7gTosF/UQKBgQDFaZq20ZTyZ1/GOqRDnjfjv2veSc/zvUJe\\\n+9F0HDNDlA5VJeDBVryx44SV9ySoDLFeTw+RKKFDkjKhfyY4WE+WB7eXyN0wksTi\\\n'
};

// GLOBALS
let sb;
let currentUser = null;
let allUsers = [];
let allWeeks = [];
let selectedWeekId = null;
let tecSelectedDate = new Date().toISOString().split('T')[0];
let pendingStartActId = null;
let timers = {};

// INIT
function init() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  setupEventListeners();
  checkSession();
  setInterval(autoUpdateFixedActivities, 60000);
}

function setupEventListeners() {
  const pinInput = document.getElementById('pin-input');
  if(pinInput) {
    pinInput.addEventListener('input', (e) => {
      if(e.target.value.length === 4) {
        processLogin(e.target.value);
      }
    });
  }
}

async function checkSession() {
  const stored = localStorage.getItem('avimex_user');
  if (stored) {
    currentUser = JSON.parse(stored);
    await loadInitialData();
    showView(currentUser.role);
  } else {
    showView('login');
    await loadUsersForLogin();
  }
}

async function loadUsersForLogin() {
  const { data, error } = await sb.from('users').select('*').order('name');
  if (error) return;
  allUsers = data;
  const sel = document.getElementById('login-user-select');
  if (sel) {
    sel.innerHTML = allUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
  }
}

async function loadInitialData() {
  const { data: u } = await sb.from('users').select('*').order('name');
  if(u) allUsers = u;
  const { data: w } = await sb.from('weeks').select('*').order('start_date', { ascending: false });
  if(w) {
    allWeeks = w;
    if(w.length > 0) selectedWeekId = w[0].id;
  }
}

function showView(view) {
  document.getElementById('view-login').style.display = view === 'login' ? 'block' : 'none';
  document.getElementById('view-supervisor').style.display = view === 'supervisor' ? 'block' : 'none';
  document.getElementById('view-tecnico').style.display = view === 'tecnico' ? 'block' : 'none';
  
  if (view === 'supervisor') {
    initSupervisor();
  } else if (view === 'tecnico') {
    initTecnico();
  }
}

async function processLogin(pin) {
  const userId = document.getElementById('login-user-select').value;
  const user = allUsers.find(u => u.id == userId);
  if (user && user.pin === pin) {
    currentUser = user;
    localStorage.setItem('avimex_user', JSON.stringify(user));
    document.getElementById('pin-input').value = '';
    await loadInitialData();
    showView(user.role);
  } else {
    showToast('PIN Incorrecto', 'error');
    document.getElementById('pin-input').value = '';
  }
}

function logout() {
  localStorage.removeItem('avimex_user');
  currentUser = null;
  showView('login');
  loadUsersForLogin();
}

// AUTO UPDATE FIXED ACTIVITIES (EVERY 60S)
async function autoUpdateFixedActivities() {
  if (!sb) return;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  
  const { data: fixedActs } = await sb.from('activities')
    .select('*')
    .eq('is_fixed', true)
    .eq('scheduled_date', today)
    .eq('status', 'pendiente');
    
  if (fixedActs) {
    for (const act of fixedActs) {
      if (act.scheduled_start && act.scheduled_end) {
        if (timeStr >= act.scheduled_start && timeStr < act.scheduled_end) {
          await sb.from('activities').update({ status: 'en_progreso', started_at: new Date().toISOString() }).eq('id', act.id);
        }
      }
    }
  }
  
  const { data: inProgressFixed } = await sb.from('activities')
    .select('*').eq('is_fixed', true).eq('scheduled_date', today).eq('status', 'en_progreso');
  if (!inProgressFixed) return;
  for (const act of inProgressFixed) {
    if (act.scheduled_end && timeStr >= act.scheduled_end) {
      const started = act.started_at ? new Date(act.started_at) : new Date();
      const mins = Math.round((new Date() - started)/60000);
      await sb.from('activities').update({ status: 'completada', finished_at: new Date().toISOString(), duration_minutes: mins }).eq('id', act.id);
    }
  }
  if (currentUser && currentUser.role === 'tecnico') {
    renderTecCalendar();
    loadTecnicoToday();
  }
}

// TECNICO LOGIC
async function initTecnico() {
  document.getElementById('tec-user-name').textContent = currentUser.name;
  tecSelectedDate = new Date().toISOString().split('T')[0];
  renderTecCalendar();
  await loadTecnicoToday();
  await loadTecnicoList();
}

async function renderTecCalendar() {
  const container = document.getElementById('tec-calendar-days');
  if(!container || !currentUser) return;
  
  const days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  const today = new Date();
  
  // Consultamos las actividades de la semana para pintar los indicadores/puntos correspondientes de actividades fijas
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  const { data: weekActs } = await sb.from('activities')
    .select('scheduled_date, is_fixed')
    .eq('assigned_to', currentUser.id)
    .gte('scheduled_date', startOfWeek.toISOString().split('T')[0])
    .lte('scheduled_date', endOfWeek.toISOString().split('T')[0]);

  let html = '';
  for(let i=0; i<7; i++) {
    let d = new Date();
    d.setDate(today.getDate() - today.getDay() + i);
    let dateStr = d.toISOString().split('T')[0];
    let isToday = dateStr === today.toISOString().split('T')[0];
    let isSelected = dateStr === tecSelectedDate;
    
    // Contar actividades para los puntos visuales (fijas vs normales)
    const dayActs = weekActs ? weekActs.filter(a => a.scheduled_date === dateStr) : [];
    const fixedCount = dayActs.filter(a => a.is_fixed).length;
    
    let bg = 'transparent', border = 'transparent', tc = 'var(--text)';
    if(isSelected) { bg = 'var(--accent)'; border = 'var(--accent)'; tc = '#fff'; }
    else if(isToday) { bg = 'var(--card)'; border = 'var(--border2)'; tc = 'var(--text)'; }
    else { bg = 'var(--card)'; border = 'var(--border)'; tc = 'var(--muted)'; }
    
    var todayDot = isToday && !isSelected ? '<div style="width:4px;height:4px;border-radius:50%;background:var(--orange);margin:2px auto 0"></div>' : '';
    var fixedDot = fixedCount > 0 ? '<div style="display:flex;gap:1px;justify-content:center;margin-top:2px">'
      + Array.from({length: Math.min(fixedCount, 3)}).map(function(){ return '<div style="width:3px;height:3px;border-radius:50%;background:var(--fixed);opacity:.7"></div>'; }).join('')
      + '</div>' : '';
      
    html += `<div data-date="${dateStr}" onclick="tecJumpToDay(this.dataset.date)" style="flex:1;min-width:0;background:${bg};border:1.5px solid ${border};border-radius:8px;padding:5px 2px;text-align:center;cursor:pointer">
      <div style="font-size:.6rem;font-weight:700;color:${tc}">${days[i]}</div>
      <div style="font-size:.72rem;font-weight:600;color:${tc};line-height:1.3">${d.getDate()}</div>
      ${todayDot}
      ${fixedDot}
    </div>`;
  }
  container.innerHTML = html;
}

function tecJumpToDay(date) {
  tecSelectedDate = date;
  renderTecCalendar();
  loadTecnicoToday();
}

async function loadTecnicoToday() {
  if (!currentUser) return;
  const { data: acts, error } = await sb.from('activities')
    .select('*')
    .eq('assigned_to', currentUser.id)
    .eq('scheduled_date', tecSelectedDate)
    .order('scheduled_start');
    
  if (error) return;
  
  const fixed = acts.filter(a => a.is_fixed);
  const nonFixed = acts.filter(a => !a.is_fixed);
  
  const fixedEl = document.getElementById('tec-fixed-activities');
  if (fixedEl) {
    fixedEl.innerHTML = fixed.length === 0 
      ? '<div class="empty-state"><div class="empty-text">Sin actividades fijas hoy</div></div>'
      : fixed.map(a => renderActCardTec(a, true)).join('');
  }
  
  const todayEl = document.getElementById('tec-today-activities');
  if (todayEl) {
    if (nonFixed.length === 0) {
      todayEl.innerHTML = '<div class="empty-state"><div class="empty-text">' + (tecSelectedDate === new Date().toISOString().split('T')[0] ? 'No tienes actividades pendientes. Usa el boton "+" para agregar una.' : 'Sin actividades este dia.') + '</div></div>';
    } else {
      todayEl.innerHTML = nonFixed.map(a => renderActCardTec(a, false)).join('');
      // Ejecución segura de cronómetros
      nonFixed.filter(a => a.status === 'en_progreso').forEach(a => {
        if(document.getElementById('timer-' + a.id) && typeof startTimerDisplay === 'function') {
          startTimerDisplay(a.id);
        }
      });
    }
  }
}

async function loadTecnicoList() {
  if (!selectedWeekId || !currentUser) return;
  const { data: acts } = await sb.from('activities')
    .select('*')
    .eq('assigned_to', currentUser.id)
    .eq('week_id', selectedWeekId)
    .order('scheduled_date');
    
  const listEl = document.getElementById('tec-list-activities');
  if (listEl) {
    listEl.innerHTML = !acts || acts.length === 0
      ? '<div class="empty-state"><div class="empty-text">Sin actividades en esta semana</div></div>'
      : acts.map(a => renderActCardTec(a, false, true)).join('');
  }
}

function renderActCardTec(a, isFixed, fromList=false) {
  let timeLabel = a.scheduled_start ? a.scheduled_start.slice(0,5) : '--:--';
  if (a.scheduled_end) timeLabel += ' - ' + a.scheduled_end.slice(0,5);
  
  let badgeColor = 'var(--muted)';
  if(a.type==='correctivo') badgeColor='var(--red)';
  if(a.type==='preventivo') badgeColor='var(--blue)';
  if(a.type==='rutina') badgeColor='var(--purple)';
  
  let actionBtns = '';
  if (a.status === 'pendiente' || a.status === 'revisar') {
    actionBtns = `<button class="btn btn-accent btn-sm" onclick="openConfirmStart('${a.id}',event)">&#9654; Iniciar</button>`;
    if (!fromList && !isFixed) actionBtns += `<button class="btn btn-outline btn-sm" onclick="moveToTomorrow('${a.id}',event)">&#8631; Mover a mañana</button>`;
  } else if (a.status === 'en_progreso') {
    actionBtns = `<div class="timer-display" id="timer-${a.id}">00:00:00</div>
                  <button class="btn btn-finish btn-sm" onclick="finishActivity('${a.id}',event)">&#10003; Finalizar</button>`;
  } else if (a.status === 'completada') {
    actionBtns = `<span style="color:var(--green);font-size:.75rem;font-weight:600">&#10003; Completada</span>`;
  } else if (a.status === 'validada') {
    actionBtns = `<span style="color:var(--blue);font-size:.75rem;font-weight:600">&#10003;&#10003; Validada</span>`;
  }
  
  const revBadge = a.status === 'revisar' ? `<span class="live-badge" style="background:var(--red);margin-left:6px">REHACER</span>` : '';
  const fixedBadge = isFixed ? `<span class="live-badge" style="background:var(--accent);margin-left:6px">FIJA</span>` : '';

  return `<div class="act-card" id="card-${a.id}">
    <div class="act-card-header" onclick="toggleCardDetails('${a.id}')">
      <div style="flex:1">
        <div style="font-size:.6rem;font-family:DM Mono;color:var(--muted);letter-spacing:0.5px">${timeLabel}${revBadge}${fixedBadge}</div>
        <div class="act-card-title">${a.title}</div>
        <div style="margin-top:4px">
          <span class="act-type-pill" style="background:${badgeColor}">${a.type}</span>
          <span class="act-type-pill" style="background:var(--border2);color:var(--text);margin-left:4px">${a.area || 'General'}</span>
        </div>
      </div>
      <div style="text-align:right;padding-left:10px;font-size:1rem;color:var(--muted)" id="arrow-${a.id}">&#9662;</div>
    </div>
    <div class="act-card-body" id="details-${a.id}">
      ${a.description ? `<div style="font-size:.75rem;color:var(--text);margin-bottom:10px;white-space:pre-wrap">${a.description}</div>` : ''}
      ${a.reopen_reason ? `<div style="font-size:.7rem;background:#fef2f2;color:var(--red);padding:6px;border-radius:4px;margin-bottom:10px"><strong>Motivo de rechazo:</strong> ${a.reopen_reason}</div>` : ''}
      <div class="act-card-actions">${actionBtns}</div>
      <div id="fimgs-${a.id}" class="evidence-grid" style="margin-top:10px"></div>
      <div id="fcmts-${a.id}" class="comments-section" style="margin-top:10px"></div>
    </div>
  </div>`;
}

function openConfirmStart(id, e) {
  if(e) e.stopPropagation();
  pendingStartActId = id;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('remove');
  document.getElementById('confirm-overlay').classList.remove('open');
  pendingStartActId = null;
}

async function confirmStart() {
  if (!pendingStartActId) return;
  closeConfirm();
  
  const id = pendingStartActId;
  pendingStartActId = null;
  const now = new Date().toISOString();

  try {
    const { error } = await sb.from('activities')
      .update({
        status: 'en_progreso',
        started_at: now
      })
      .eq('id', id);

    if (error) {
      console.error(error);
      showToast('Error al iniciar', 'error');
      return;
    }

    showToast('Actividad iniciada', 'success');

    // Forzar renderizado y llamada segura al timer
    await loadTecnicoToday();
    await loadTecnicoList();

    if (typeof startTimerDisplay === 'function') {
      startTimerDisplay(id);
    } else {
      setTimeout(() => {
        if (typeof startTimerDisplay === 'function') startTimerDisplay(id);
      }, 300);
    }

  } catch (err) {
    console.error(err);
    showToast('Error inesperado', 'error');
  }
}

async function moveToTomorrow(id, e) {
  if(e) e.stopPropagation();
  let d = new Date();
  d.setDate(d.getDate() + 1);
  const tomorrowStr = d.toISOString().split('T')[0];
  
  const { error } = await sb.from('activities').update({ scheduled_date: tomorrowStr }).eq('id', id);
  if(error) { showToast('Error al mover', 'error'); return; }
  showToast('Movida a mañana', 'success');
  loadTecnicoToday();
}
