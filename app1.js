// TIMEZONE & HELPERS
function localDateStr(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function localISOStr(){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString();}
function fmtLocalTime(s){if(!s)return'--:--';return new Date(s).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});}
function getMondayOf(dateStr){var d=new Date(dateStr+'T12:00:00');var dow=d.getDay();var off=dow===0?-6:1-dow;var m=new Date(d);m.setDate(d.getDate()+off);return m;}
function pinDel(){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();}
function pinClear(){pinBuffer='';updatePinDots();}


const SUPABASE_URL='https://eaeuqcdcnkztttkfvbut.supabase.co';
const SUPABASE_KEY='sb_publishable_f89Uz7LwwTcjqpdKKzXlYg_HuNsTtC3';
const APPS_SCRIPT_URL='https://script.google.com/macros/s/AKfycbwURq9doqIIJhR-CYGoefgYQqSmXPPm5UBBud8U3rwe2DaUjaToGWTLLdI_oTyxnhbJ/exec';
let sb=null;

let currentUser=null,allUsers=[],allWeeks=[],selectedWeekId=null;
let pinBuffer='',selectedUserId=null,timers={};
let selectedDay=new Date(),selectedDayJulian=new Date();
let selectedWeekSemana=null;

// \u2500\u2500 INIT \u2500\u2500
async function init(){
  const [{data:users},{data:weeks}]=await Promise.all([
    sb.from('users').select('*').order('created_at'),
    sb.from('weeks').select('*').order('start_date',{ascending:false})
  ]);
  allUsers=users||[]; allWeeks=weeks||[];
  const today=localDateStr();
  const cw=allWeeks.find(w=>today>=w.start_date&&today<=w.end_date);
  selectedWeekId=cw?.id||allWeeks[0]?.id;
  selectedWeekSemana=selectedWeekId;
  renderUserBtns();
  const saved=localStorage.getItem('avimex_user');
  if(saved){currentUser=JSON.parse(saved);showApp();}
  setInterval(autoUpdateFixedActivities, 60000);
}

// \u2500\u2500 LOGIN \u2500\u2500
function renderUserBtns(){
  document.getElementById('user-btns').innerHTML=allUsers.map(u=>`
    <button class="user-btn" id="ubtn-${u.id}" onclick="selectUser('${u.id}')">
      <div class="user-avatar av-${u.name.toLowerCase()}">${u.name[0]}</div>
      <span>${u.name}</span>
      ${u.role==='supervisor'?'<span style="font-size:.6rem;color:var(--accent);font-family:DM Mono;font-weight:700">SUPERVISOR</span>':''}
    </button>`).join('');
}
function selectUser(id){selectedUserId=id;pinBuffer='';updatePinDots();document.querySelectorAll('.user-btn').forEach(b=>b.classList.remove('selected'));document.getElementById('ubtn-'+id)?.classList.add('selected');document.getElementById('login-error').textContent='';}
function pinKey(k){if(!selectedUserId){document.getElementById('login-error').textContent='Selecciona un usuario';return;}if(pinBuffer.length>=4)return;pinBuffer+=k;updatePinDots();if(pinBuffer.length===4)setTimeout(pinEnter,200);}
function pinDel(){pinBuffer=pinBuffer.slice(0,-1);updatePinDots();}
function updatePinDots(){for(let i=0;i<4;i++)document.getElementById('pd'+i).classList.toggle('filled',i<pinBuffer.length);}
function pinEnter(){
  if(!selectedUserId||pinBuffer.length!==4)return;
  const user=allUsers.find(u=>u.id===selectedUserId);
  if(!user||user.pin!==pinBuffer){document.getElementById('login-error').textContent='PIN incorrecto';pinBuffer='';updatePinDots();return;}
  currentUser=user;localStorage.setItem('avimex_user',JSON.stringify(user));showApp();
}
function logout(){localStorage.removeItem('avimex_user');currentUser=null;selectedUserId=null;pinBuffer='';updatePinDots();document.querySelectorAll('.user-btn').forEach(b=>b.classList.remove('selected'));document.getElementById('login-error').textContent='';showScreen('login-screen');}
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}
function showApp(){
  showScreen('app-screen');
  document.getElementById('topbar-name').textContent=currentUser.name;
  const av=document.getElementById('topbar-avatar');
  av.textContent=currentUser.name[0];av.className=`topbar-avatar av-${currentUser.name.toLowerCase()}`;
  // Reset to today always
  selectedDay=new Date();selectedDayJulian=new Date();
  if(currentUser.role==='supervisor')setupSupervisor();else setupTecnico();
}

// \u2500\u2500 AGE CLASS \u2500\u2500
function getAgeClass(createdAt){
  if(!createdAt)return'';
  const days=Math.floor((new Date()-new Date(createdAt))/86400000);
  if(days>=5)return'age-red';
  if(days>=3)return'age-orange';
  if(days>=2)return'age-yellow';
  if(days>=1)return'age-green';
  return'';
}
function getAgeLabel(createdAt){
  if(!createdAt)return'';
  const days=Math.floor((new Date()-new Date(createdAt))/86400000);
  if(days===0)return'Hoy';
  if(days===1)return'1 d\u00eda';
  return days+'d';
}

// \u2500\u2500 SUPERVISOR \u2500\u2500
function setupSupervisor(){
  document.getElementById('sup-tabs').style.display='block';
  document.getElementById('tec-view').style.display='none';
  document.getElementById('fab').classList.remove('hidden');
  document.getElementById('bottom-nav').innerHTML=`
    <button class="bnav-btn active" id="bn-dashboard" onclick="switchTab('dashboard')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke-width="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke-width="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke-width="2"/></svg>Dashboard</button>
    <button class="bnav-btn" id="bn-julian" onclick="switchTab('julian')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke-width="2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke-width="2" stroke-linecap="round"/></svg>Mis tareas</button>
    <button class="bnav-btn" id="bn-semana" onclick="switchTab('semana');loadSupSemana()">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/><line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round"/></svg>Semana</button>
    <button class="bnav-btn" id="bn-lista" onclick="switchTab('lista');loadSupLista()">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>Lista</button>
    <button class="bnav-btn" id="bn-stats" onclick="switchTab('stats')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Stats</button>
    <button class="bnav-btn" id="bn-add" onclick="switchTab('add')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="16" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="16" y2="12" stroke-width="2" stroke-linecap="round"/></svg>Agregar</button>`;
  populateWeekSelectors();populateUserSelects();loadDashboard();
}
function switchTab(tab){
  document.querySelectorAll('#sup-tabs .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.getElementById('bn-'+tab)?.classList.add('active');
  if(tab==='stats')loadStats();
  if(tab==='dashboard')loadDashboard();
  if(tab==='julian')loadJulianDay();
}
function populateWeekSelectors(){
  // Newest first (allWeeks already sorted desc)
  ['week-selector','week-selector-stats','week-selector-semana-sup'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=allWeeks.map(w=>`<div class="week-chip ${w.id===selectedWeekId?'active':''}" onclick="selectWeekSup('${w.id}',this,'${id}')">${w.label}</div>`).join('');
  });
}
function selectWeekSup(id,el,selectorId){
  selectedWeekId=id;
  document.querySelectorAll(`#${selectorId} .week-chip`).forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  if(selectorId==='week-selector-semana-sup')loadSupSemana();
  else loadDashboard();
}
function populateUserSelects(){
  ['new-assigned','m-assigned','edit-assigned'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML='<option value="">\u2014 Sin asignar \u2014</option>'+allUsers.map(u=>`<option value="${u.id}">${u.name}${u.role==='supervisor'?' (Supervisor)':''}</option>`).join('');
  });
  ['new-week','m-week'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    el.innerHTML=allWeeks.map(w=>`<option value="${w.id}" ${w.id===selectedWeekId?'selected':''}>${w.label}</option>`).join('');
  });
}

// \u2500\u2500 DASHBOARD \u2500\u2500
async function loadDashboard(){
  if(!selectedWeekId)return;
  const week=allWeeks.find(w=>w.id===selectedWeekId);
  const {data:acts}=await sb.from('activities').select('*').eq('week_id',selectedWeekId);
  if(!acts)return;

  // Check unassigned preventivos for current month
  const currentMonth=new Date().toISOString().substring(0,7);
  const {data:unassignedPrev}=await sb.from('activities').select('id').eq('type','preventivo').eq('scheduled_month',currentMonth).is('assigned_to',null);
  const alertEl=document.getElementById('preventivo-alert');
  if(unassignedPrev&&unassignedPrev.length>0){
    alertEl.style.display='block';
    document.getElementById('alert-title').textContent=`${unassignedPrev.length} mantenimiento(s) sin asignar este mes`;
    document.getElementById('alert-text').textContent=`Hay mantenimientos preventivos de ${new Date().toLocaleDateString('es-MX',{month:'long',year:'numeric'})} pendientes de asignar.`;
  }else{
    alertEl.style.display='none';
  }

  const nonFixed=acts.filter(a=>!a.is_fixed);
  document.getElementById('stat-total').textContent=nonFixed.length;
  document.getElementById('stat-done').textContent=nonFixed.filter(a=>a.status==='completada').length;
  document.getElementById('stat-prog').textContent=nonFixed.filter(a=>a.status==='en_progreso').length;
  document.getElementById('stat-pend').textContent=nonFixed.filter(a=>a.status==='pendiente'||a.status==='revisar').length;

  const pedro=allUsers.find(u=>u.name==='Pedro'),said=allUsers.find(u=>u.name==='Said'),julian=allUsers.find(u=>u.name==='Julian');
  [{user:pedro,bar:'bar-pedro',pct:'pct-pedro'},{user:said,bar:'bar-said',pct:'pct-said'},{user:julian,bar:'bar-julian',pct:'pct-julian'}].forEach(({user,bar,pct})=>{
    if(!user)return;
    const ua=nonFixed.filter(a=>a.assigned_to===user.id);
    const p=ua.length?Math.round(ua.filter(a=>a.status==='completada').length/ua.length*100):0;
    document.getElementById(pct).textContent=p+'%';document.getElementById(bar).style.width=p+'%';
  });

  // Weekly table
  buildWeeklyTable(acts,week,'sup-weekly-table',true);

  // Live
  const live=acts.filter(a=>a.status==='en_progreso');
  document.getElementById('live-activities').innerHTML=live.length===0
    ?`<div class="empty-state"><div class="empty-icon">\ud83d\udca4</div><div class="empty-text">Sin actividades en progreso</div></div>`
    :live.map(a=>renderActCardSup(a)).join('');

  // Fixed summary
  const dayNames=['Dom','Lun','Mar','Mi\u00e9','Jue','Vie','S\u00e1b'];
  const {data:allFixed}=await sb.from('activities').select('*').eq('is_fixed',true);
  const fixedGroups={};
  (allFixed||[]).forEach(a=>{
    const who=allUsers.find(u=>u.id===a.assigned_to)?.name||'?';
    const key=who+'||'+a.title;
    if(!fixedGroups[key])fixedGroups[key]={who,title:a.title,time:a.scheduled_start?a.scheduled_start.slice(0,5)+'\u2013'+(a.scheduled_end||'').slice(0,5):'',days:new Set()};
    if(a.scheduled_date){const d=new Date(a.scheduled_date+'T12:00:00');fixedGroups[key].days.add(d.getDay());}
  });
  const whoColors={Pedro:'var(--pedro)',Said:'var(--said)',Julian:'var(--julian)'};
  document.getElementById('fixed-summary').innerHTML=Object.values(fixedGroups).length===0
    ?'<div style="color:var(--muted);font-size:.75rem">Sin actividades fijas</div>'
    :Object.values(fixedGroups).map(g=>{
      const daysStr=[...g.days].filter(d=>d!==0).sort().map(d=>dayNames[d]).join(', ');
      const color=whoColors[g.who]||'var(--muted2)';
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;background:#fff;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;box-shadow:var(--shadow)">
        <span style="font-family:'Bebas Neue';font-size:.9rem;letter-spacing:1px;color:${color};min-width:56px">${g.who}</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:500">${g.title}</div>
        <div style="font-family:'DM Mono';font-size:.6rem;color:var(--muted);margin-top:2px">${g.time?g.time+' \u00b7 ':''}${daysStr}</div></div>
      </div>`;
    }).join('');

  // Completed log
  const completed=acts.filter(a=>a.status==='completada'&&!a.is_fixed).sort((a,b)=>new Date(b.finished_at||b.created_at)-new Date(a.finished_at||a.created_at));
  document.getElementById('completed-log').innerHTML=completed.length===0
    ?'<div style="color:var(--muted);font-size:.75rem">Sin actividades completadas esta semana</div>'
    :completed.map(a=>{
      const who=allUsers.find(u=>u.id===a.assigned_to)?.name||'Sin asignar';
      const whoColor=who==='Pedro'?'var(--pedro)':who==='Said'?'var(--said)':who==='Julian'?'var(--julian)':'var(--muted2)';
      const finDate=a.finished_at?new Date(a.finished_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'\u2014';
      const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';
      return `<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 12px;background:#fff;border:1.5px solid rgba(26,158,92,.2);border-radius:8px;margin-bottom:6px;box-shadow:var(--shadow)">
        <span style="color:var(--green);font-size:1.1rem;flex-shrink:0;font-weight:700">\u2713</span>
        <div style="flex:1"><div style="font-size:.82rem;font-weight:500">${a.title}</div>
        <div style="font-family:'DM Mono';font-size:.6rem;color:var(--muted);margin-top:2px"><span style="color:${whoColor};font-weight:600">${who}</span> \u00b7 ${finDate}${dur?' \u00b7 '+dur:''}</div></div>
      </div>`;
    }).join('');

  const pending=nonFixed.filter(a=>a.status!=='completada');
  document.getElementById('acts-pedro').innerHTML=pending.filter(a=>a.assigned_to===pedro?.id).map(a=>renderActCardSup(a)).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades pendientes</div>';
  document.getElementById('acts-said').innerHTML=pending.filter(a=>a.assigned_to===said?.id).map(a=>renderActCardSup(a)).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades pendientes</div>';
  document.getElementById('acts-julian').innerHTML=pending.filter(a=>a.assigned_to===julian?.id).map(a=>renderActCardSup(a)).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades pendientes</div>';
  document.getElementById('acts-unassigned').innerHTML=pending.filter(a=>!a.assigned_to).map(a=>renderActCardSup(a)).join('')||'<div style="color:var(--muted);font-size:.75rem;padding:6px 0">Sin actividades sin asignar</div>';
}

// \u2500\u2500 WEEKLY TABLE (shared by sup and tec) \u2500\u2500
function buildWeeklyTable(acts, week, containerId, showAllUsers=false){
  const wrap=document.getElementById(containerId);
  if(!week||!wrap){return;}
  const days=['Lun','Mar','Mi\u00e9','Jue','Vie','S\u00e1b'];
  const dowMap=[1,2,3,4,5,6];
  const start=new Date(week.start_date+'T12:00:00');
  const dateByDow={};
  for(let i=0;i<7;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const dow=d.getDay();
    if(dow!==0)dateByDow[dow]=d.toISOString().split('T')[0];
  }
  const today=localDateStr();
  const nonFixed=acts.filter(a=>!a.is_fixed);

  // For tecnico: only show their own. For supervisor: show by person
  let rows=[];
  if(showAllUsers){
    const people=[allUsers.find(u=>u.name==='Pedro'),allUsers.find(u=>u.name==='Said'),allUsers.find(u=>u.name==='Julian')].filter(Boolean);
    rows=people.map(user=>({user,acts:nonFixed.filter(a=>a.assigned_to===user.id)}));
  }else{
    rows=[{user:currentUser,acts:nonFixed}];
  }

  let html=`<table class="week-table"><thead><tr>
    <th style="min-width:55px">${showAllUsers?'Persona':'D\u00eda'}</th>
    ${days.map((d,i)=>{const date=dateByDow[dowMap[i]];const isToday=date===today;return`<th style="${isToday?'background:rgba(255,255,255,.2)':''}"><div class="wt-day-header" style="color:${isToday?'#fff':'rgba(255,255,255,.9)'}">${d}</div><div class="wt-day-date" style="color:rgba(255,255,255,.7)">${date?date.slice(5).replace('-','/'):'\u2014'}</div></th>`;}).join('')}
  </tr></thead><tbody>`;

  rows.forEach(({user,acts:userActs})=>{
    const color=user.name==='Pedro'?'var(--pedro)':user.name==='Said'?'var(--said)':'var(--julian)';
    html+=`<tr><td style="padding:8px 6px;vertical-align:top"><div style="font-family:'Bebas Neue';font-size:.9rem;letter-spacing:1px;color:${color}">${user.name}</div></td>`;
    dowMap.forEach((dow,idx)=>{
      const date=dateByDow[dow];
      const isToday=date===today;
      const dayActs=userActs.filter(a=>a.scheduled_date===date);
      html+=`<td style="padding:5px;vertical-align:top;background:${isToday?'rgba(26,111,212,.03)':''}">`;
      if(dayActs.length===0){
        html+=`<div style="font-size:.6rem;color:var(--border2);text-align:center;padding:6px 0">\u2014</div>`;
      }else{
        dayActs.forEach(a=>{
          const isDone=a.status==='completada';
          html+=`<div class="wt-act type-${a.type} ${isDone?'done':''}">
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.title.length>25?a.title.substring(0,23)+'\u2026':a.title}</span>
            ${!isDone&&date&&date!==today?`<button class="wt-add-btn" onclick="agregarAHoyDesdeTabla('${a.id}',event)">+Hoy</button>`:''}
            ${!isDone&&date===today?`<button class="wt-add-btn" onclick="agregarAHoyDesdeTabla('${a.id}',event)">\u25b6</button>`:''}
          </div>`;
        });
      }
      html+=`</td>`;
    });
    html+=`</tr>`;
  });
  html+=`</tbody></table>`;
  wrap.innerHTML=html;
}

// \u2500\u2500 SUPERVISOR SEMANA \u2500\u2500
async function loadSupSemana(){
  const week=allWeeks.find(w=>w.id===selectedWeekId);
  const el=document.getElementById('week-selector-semana-sup');
  if(el) el.innerHTML=allWeeks.map(w=>`<div class="week-chip ${w.id===selectedWeekId?'active':''}" onclick="selectWeekSup('${w.id}',this,'week-selector-semana-sup')">${w.label}</div>`).join('');
  if(!week)return;
  const {data:acts}=await sb.from('activities').select('*').eq('week_id',selectedWeekId).eq('is_fixed',false);
  buildWeeklyTable(acts||[],week,'sup-semana-table',true);
}

// \u2500\u2500 SUPERVISOR LISTA \u2500\u2500
async function loadSupLista(){
  const el=document.getElementById('sup-lista-content');
  // Load all non-fixed pending activities grouped by month
  const {data:acts}=await sb.from('activities').select('*').eq('is_fixed',false).in('status',['pendiente','revisar']).order('scheduled_month').order('created_at');
  if(!acts||acts.length===0){el.innerHTML='<div class="empty-state"><div class="empty-icon">\u2705</div><div class="empty-text">Sin actividades pendientes</div></div>';return;}

  const monthNames={
    '2026-05':'Mayo 2026','2026-06':'Junio 2026','2026-07':'Julio 2026',
    '2026-08':'Agosto 2026','2026-09':'Septiembre 2026','2026-10':'Octubre 2026',
    '2026-11':'Noviembre 2026','2026-12':'Diciembre 2026'
  };
  const currentMonth=new Date().toISOString().substring(0,7);

  // Group: extras (no month or current week), preventivos by month
  const preventivos=acts.filter(a=>a.type==='preventivo');
  const extras=acts.filter(a=>a.type!=='preventivo');

  let html='';
  if(extras.length>0){
    html+=`<div class="month-group"><div class="month-header" onclick="toggleMonth(this)"><span>Actividades extra y pendientes</span><span class="month-count">${extras.length}</span></div><div class="month-body">${extras.map(a=>renderActCardSup(a)).join('')}</div></div>`;
  }

  const byMonth={};
  preventivos.forEach(a=>{
    const key=a.scheduled_month||'sin-mes';
    if(!byMonth[key])byMonth[key]=[];
    byMonth[key].push(a);
  });

  Object.keys(byMonth).sort().forEach(key=>{
    const group=byMonth[key];
    const isCurrent=key===currentMonth;
    const label=monthNames[key]||key;
    const unassigned=group.filter(a=>!a.assigned_to).length;
    html+=`<div class="month-group">
      <div class="month-header" onclick="toggleMonth(this)" style="${isCurrent?'background:rgba(26,111,212,.1);border-color:rgba(26,111,212,.3)':''}">
        <span>${label}${isCurrent?' \ud83d\udccc':''}</span>
        <span class="month-count">${unassigned>0?`\u26a0 ${unassigned} sin asignar \u00b7 `:''}${group.length} total</span>
      </div>
      <div class="month-body ${isCurrent?'':'collapsed'}">${group.map(a=>renderActCardSup(a)).join('')}</div>
    </div>`;
  });
  el.innerHTML=html;
}

// \u2500\u2500 SUPERVISOR CARD \u2500\u2500
function renderActCardSup(a){
  const timeStr=a.scheduled_start?`${a.scheduled_start.slice(0,5)}\u2013${(a.scheduled_end||'').slice(0,5)}`:'';
  const who=allUsers.find(u=>u.id===a.assigned_to)?.name||'Sin asignar';
  const ageClass=(a.type==='pendiente'||a.type==='correctivo')?getAgeClass(a.created_at):'';
  const ageLabel=(a.type==='pendiente'||a.type==='correctivo')&&ageClass?getAgeLabel(a.created_at):'';
  let badge='';
  if(a.status==='en_progreso')badge=`<span class="live-badge" style="font-size:.55rem"><span class="live-dot"></span>En progreso</span>`;
  else if(a.status==='completada'){const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';badge=`<span style="color:var(--green);font-size:.72rem;font-family:'DM Mono';font-weight:600">\u2713 ${dur}</span>`;}
  else if(a.status==='revisar')badge=`<span style="color:var(--orange);font-size:.72rem;font-family:'DM Mono';font-weight:600">\u26a0 Revisar</span>`;
  return `<div class="act-card ${a.status==='revisar'?'revisar':''} ${ageClass}" id="sup-card-${a.id}">
    <div class="act-card-header" onclick="toggleSupCard('${a.id}')">
      <div class="act-status-dot dot-${a.status}"></div>
      <div class="act-card-info">
        <div class="act-card-title">${a.title}</div>
        <div class="act-card-meta">
          <span class="act-type-pill type-${a.type}">${a.type}</span>
          ${timeStr?`<span class="act-time">${timeStr}</span>`:''}
          <span style="font-size:.6rem;color:var(--muted)">${who}</span>
          ${ageLabel?`<span class="act-age">${ageLabel}</span>`:''}
        </div>
      </div>
      ${badge}<span class="act-card-arrow">\u203a</span>
    </div>
    <div class="act-card-body">
      ${a.description?`<p style="font-size:.8rem;color:var(--muted2);margin-bottom:10px;line-height:1.5">${a.description}</p>`:''}
      <div style="font-family:'DM Mono';font-size:.58rem;color:var(--muted);margin-bottom:8px">Agregada: ${new Date(a.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn btn-outline btn-sm" onclick="openEdit('${a.id}',event)">\u270f\ufe0f Editar</button>
      </div>
      <div class="images-section">
        <div class="comments-title">Im\u00e1genes</div>
        <div class="images-grid" id="sup-imgs-${a.id}"></div>
      </div>
      <div class="comments-section">
        <div class="comments-title">Comentarios</div>
        <div id="sup-cmts-${a.id}"></div>
        <div class="comment-input-wrap">
          <input class="comment-input" id="sup-cmt-${a.id}" placeholder="Agregar comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}','sup-cmt-${a.id}','sup-cmts-${a.id}')">
          <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}','sup-cmt-${a.id}','sup-cmts-${a.id}')">Enviar</button>
        </div>
      </div>
    </div>
  </div>`;
}
function toggleSupCard(id){
  const card=document.getElementById('sup-card-'+id);
  if(card.classList.toggle('open')){loadComments(id,'sup-cmts-'+id);loadImages(id,'sup-imgs-'+id);}
}

// \u2500\u2500 EDIT \u2500\u2500
async function openEdit(id,e){
  if(e)e.stopPropagation();
  const {data:a}=await sb.from('activities').select('*').eq('id',id).single();if(!a)return;
  populateUserSelects();
  document.getElementById('edit-act-id').value=id;
  document.getElementById('edit-title').value=a.title||'';
  document.getElementById('edit-type').value=a.type||'pendiente';
  document.getElementById('edit-assigned').value=a.assigned_to||'';
  document.getElementById('edit-date').value=a.scheduled_date||'';
  document.getElementById('edit-start').value=a.scheduled_start?a.scheduled_start.slice(0,5):'';
  document.getElementById('edit-end').value=a.scheduled_end?a.scheduled_end.slice(0,5):'';
  document.getElementById('edit-notes').value=a.description||'';
  document.getElementById('edit-overlay').classList.add('open');
}
async function saveEdit(){
  const id=document.getElementById('edit-act-id').value;
  const assigned=document.getElementById('edit-assigned').value||null;
  const date=document.getElementById('edit-date').value||null;
  // Find week for the date
  let weekId=selectedWeekId;
  if(date){const mw=allWeeks.find(w=>date>=w.start_date&&date<=w.end_date);if(mw)weekId=mw.id;}
  const {error}=await sb.from('activities').update({
    title:document.getElementById('edit-title').value.trim(),
    type:document.getElementById('edit-type').value,
    assigned_to:assigned,week_id:weekId,
    scheduled_date:date,
    scheduled_start:document.getElementById('edit-start').value||null,
    scheduled_end:document.getElementById('edit-end').value||null,
    description:document.getElementById('edit-notes').value.trim()||null,
    is_fixed:document.getElementById('edit-type').value==='fija'
  }).eq('id',id);
  if(error){showToast('Error al guardar','error');return;}
  document.getElementById('edit-overlay').classList.remove('open');
  showToast('Actualizada \u2713','success');loadDashboard();
}
async function deleteActivity(){
  const id=document.getElementById('edit-act-id').value;
  if(!confirm('\u00bfEliminar esta actividad?'))return;
  await sb.from('activity_images').delete().eq('activity_id',id);
  await sb.from('comments').delete().eq('activity_id',id);
  const {error}=await sb.from('activities').delete().eq('id',id);
  if(error){showToast('Error','error');return;}
  document.getElementById('edit-overlay').classList.remove('open');
  showToast('Eliminada','success');loadDashboard();
}
function closeEditOverlay(e){if(e.target===document.getElementById('edit-overlay'))document.getElementById('edit-overlay').classList.remove('open');}

// \u2500\u2500 STATS \u2500\u2500
async function loadStats(){
  const {data:acts}=await sb.from('activities').select('*').eq('week_id',selectedWeekId);
  const cards=document.getElementById('person-stats-cards');
  const tl=document.getElementById('activity-time-list');
  cards.innerHTML='';tl.innerHTML='';
  if(!acts||acts.length===0){tl.innerHTML='<div class="empty-state"><div class="empty-text">Sin datos</div></div>';return;}
  const pedro=allUsers.find(u=>u.name==='Pedro'),said=allUsers.find(u=>u.name==='Said');
  [pedro,said].forEach(person=>{
    if(!person)return;
    const pa=acts.filter(a=>a.assigned_to===person.id&&a.status==='completada'&&!a.is_fixed);
    const totalMins=pa.reduce((s,a)=>s+(a.duration_minutes||0),0);
    const h=Math.floor(totalMins/60),m=totalMins%60;
    const pAll=acts.filter(a=>a.assigned_to===person.id&&!a.is_fixed);
    const pct=pAll.length?Math.round(pa.length/pAll.length*100):0;
    cards.innerHTML+=`<div class="person-stats-card"><div class="psc-name ${person.name.toLowerCase()}">${person.name}</div>
      <div class="psc-stat"><span class="psc-label">Completadas</span><span class="psc-val">${pa.length}</span></div>
      <div class="psc-stat"><span class="psc-label">Tiempo total</span><span class="psc-val">${h}h ${m}m</span></div>
      <div class="psc-stat"><span class="psc-label">Eficiencia</span><span class="psc-val">${pct}%</span></div></div>`;
  });
  tl.innerHTML=acts.filter(a=>a.status==='completada'&&!a.is_fixed&&a.duration_minutes).sort((a,b)=>(b.duration_minutes||0)-(a.duration_minutes||0)).map(a=>{
    const h=Math.floor(a.duration_minutes/60),m=a.duration_minutes%60;
    const who=allUsers.find(u=>u.id===a.assigned_to);
    return `<div class="atl-item"><div class="atl-name">${a.title}<br><span style="font-size:.62rem;color:var(--muted)">${who?.name||''}</span></div><div class="atl-time">${h}h ${m}m</div></div>`;
  }).join('')||'<div class="empty-state"><div class="empty-text">Sin actividades con tiempo registrado</div></div>';
}

// \u2500\u2500 ADD ACTIVITY \u2500\u2500
async function addActivity(){
  const title=document.getElementById('new-title').value.trim();
  const type=document.getElementById('new-type').value;
  const assigned=document.getElementById('new-assigned').value||null;
  const weekId=document.getElementById('new-week').value;
  const date=document.getElementById('new-date').value||null;
  const start=document.getElementById('new-start').value||null;
  const end=document.getElementById('new-end').value||null;
  const notes=document.getElementById('new-notes').value.trim()||null;
  if(!title){showToast('Escribe un t\u00edtulo','error');return;}
  if(!weekId){showToast('Selecciona una semana','error');return;}
  const month=date?date.substring(0,7):new Date().toISOString().substring(0,7);
  const {error}=await sb.from('activities').insert({title,type,assigned_to:assigned,week_id:weekId,scheduled_date:date,scheduled_start:start,scheduled_end:end,description:notes,is_fixed:type==='fija',status:'pendiente',created_by:currentUser.id,scheduled_month:month});
  if(error){showToast('Error: '+error.message,'error');return;}
  showToast('Actividad agregada \u2713','success');
  document.getElementById('new-title').value='';document.getElementById('new-notes').value='';
  loadDashboard();
}
async function addActivityModal(){
  const title=document.getElementById('m-title').value.trim();
  const type=document.getElementById('m-type').value;
  const assigned=document.getElementById('m-assigned').value||null;
  const weekId=document.getElementById('m-week').value||selectedWeekId;
  const date=document.getElementById('m-date').value||null;
  const notes=document.getElementById('m-notes').value.trim()||null;
  if(!title){showToast('Escribe un t\u00edtulo','error');return;}
  const month=date?date.substring(0,7):new Date().toISOString().substring(0,7);
  const {error}=await sb.from('activities').insert({title,type,assigned_to:assigned,week_id:weekId,scheduled_date:date,description:notes,is_fixed:type==='fija',status:'pendiente',created_by:currentUser.id,scheduled_month:month});
  if(error){showToast('Error','error');return;}
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('m-title').value='';document.getElementById('m-notes').value='';
  showToast('Actividad agregada \u2713','success');loadDashboard();
}

// \u2500\u2500 JULIAN DAY \u2500\u2500
function cambiarDiaJulian(delta){selectedDayJulian=new Date(selectedDayJulian);selectedDayJulian.setDate(selectedDayJulian.getDate()+delta);loadJulianDay();}
async function loadJulianDay(){
  const julian=allUsers.find(u=>u.name==='Julian');if(!julian)return;
  const dayNames=['Domingo','Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes','S\u00e1bado'];
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const today=new Date();today.setHours(0,0,0,0);
  const sel=new Date(selectedDayJulian);sel.setHours(0,0,0,0);
  const diff=Math.round((sel-today)/86400000);
  const prefix=diff===0?'HOY \u00b7 ':diff===1?'MA\u00d1ANA \u00b7 ':diff===-1?'AYER \u00b7 ':'';
  document.getElementById('julian-day-name').textContent=prefix+dayNames[selectedDayJulian.getDay()].toUpperCase();
  document.getElementById('julian-day-date').textContent=selectedDayJulian.getDate()+' de '+monthNames[selectedDayJulian.getMonth()]+' '+selectedDayJulian.getFullYear();
  const viewDate=selectedDayJulian.toISOString().split('T')[0];
  const isToday=diff===0;
  const matchWeek=allWeeks.find(w=>viewDate>=w.start_date&&viewDate<=w.end_date);
  const weekId=matchWeek?.id||selectedWeekId;
  const {data:acts}=await sb.from('activities').select('*').eq('assigned_to',julian.id).eq('week_id',weekId).eq('is_fixed',false).eq('scheduled_date',viewDate);
  const listEl=document.getElementById('acts-julian-day');if(!listEl)return;
  if(!acts||acts.length===0){listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">\ud83d\udccb</div><div class="empty-text">${isToday?'Sin actividades para hoy':'Sin actividades este d\u00eda'}</div></div>`;return;}
  listEl.innerHTML=acts.map(a=>renderActCardJulian(a,isToday)).join('');
}
function renderActCardJulian(a,isToday){
  const ageClass=(a.type==='pendiente'||a.type==='correctivo')?getAgeClass(a.created_at):'';
  const ageLabel=(a.type==='pendiente'||a.type==='correctivo')&&ageClass?getAgeLabel(a.created_at):'';
  let actionBtns='';
  if(!isToday){
    if(a.status==='completada'){const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';actionBtns=`<span style="color:var(--green);font-size:.78rem;font-family:'DM Mono';font-weight:600">\u2713 Completada ${dur?'\u00b7 '+dur:''}</span>`;}
    else actionBtns=`<span style="color:var(--muted);font-size:.78rem;font-family:'DM Mono'">${a.status}</span>`;
  }else{
    if(a.status==='pendiente')actionBtns=`<button class="btn btn-start btn-sm" onclick="startAct('${a.id}',event,'julian')">\u25b6 Iniciar</button>`;
    else if(a.status==='en_progreso')actionBtns=`<div class="timer-display" id="timer-${a.id}">00:00:00</div><button class="btn btn-finish btn-sm" onclick="finishAct('${a.id}',event,'julian')">\u2713 Finalizar</button>`;
    else if(a.status==='completada'){const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';actionBtns=`<span style="color:var(--green);font-size:.78rem;font-family:'DM Mono';font-weight:600">\u2713 Completada ${dur?'\u00b7 '+dur:''}</span>`;}
  }
  const needsPhoto=(a.type==='preventivo'||a.type==='pendiente')&&a.status==='completada'&&isToday;
  return `<div class="act-card ${ageClass}" id="jcard-${a.id}">
    <div class="act-card-header" onclick="toggleJCard('${a.id}')">
      <div class="act-status-dot dot-${a.status}"></div>
      <div class="act-card-info"><div class="act-card-title">${a.title}</div>
        <div class="act-card-meta"><span class="act-type-pill type-${a.type}">${a.type}</span>${ageLabel?`<span class="act-age">${ageLabel}</span>`:''}</div>
      </div><span class="act-card-arrow">\u203a</span>
    </div>
    <div class="act-card-body">
      ${a.description?`<p style="font-size:.8rem;color:var(--muted2);margin-bottom:10px;line-height:1.5">${a.description}</p>`:''}
      <div style="font-family:'DM Mono';font-size:.58rem;color:var(--muted);margin-bottom:8px">Agregada: ${new Date(a.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</div>
      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">${actionBtns}</div>
      <div class="images-section">
        <div class="comments-title">Im\u00e1genes${needsPhoto?' <span style="color:var(--red)">*obligatorio</span>':''}</div>
        ${needsPhoto?'<div class="photo-required-banner">\ud83d\udcf7 Sube al menos una foto de evidencia</div>':''}
        <div class="images-grid" id="imgs-j${a.id}"></div>
        <input type="file" class="img-file-input" id="file-j${a.id}" accept="image/*" multiple onchange="handleImageUpload('${a.id}',this,'imgs-j${a.id}')">
        <button class="img-upload-btn ${needsPhoto?'required':''}" onclick="document.getElementById('file-j${a.id}').click()">\ud83d\udcf7 Subir im\u00e1genes</button>
      </div>
      <div class="comments-section"><div class="comments-title">Comentarios</div>
        <div id="jcmts-${a.id}"></div>
        <div class="comment-input-wrap">
          <input class="comment-input" id="jcmt-${a.id}" placeholder="Comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}','jcmt-${a.id}','jcmts-${a.id}')">
          <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}','jcmt-${a.id}','jcmts-${a.id}')">Enviar</button>
        </div>
      </div>
    </div>
  </div>`;
}
function toggleJCard(id){const card=document.getElementById('jcard-'+id);if(card.classList.toggle('open')){loadComments(id,'jcmts-'+id);loadImages(id,'imgs-j'+id);if(document.getElementById('timer-'+id))startTimerDisplay(id);}}

// \u2500\u2500 TECNICO \u2500\u2500
function setupTecnico(){
  document.getElementById('sup-tabs').style.display='none';
  document.getElementById('tec-view').style.display='block';
  document.getElementById('fab').classList.add('hidden');
  document.getElementById('tec-name-title').textContent='Hola, '+currentUser.name;
  document.getElementById('bottom-nav').innerHTML=`
    <button class="bnav-btn active" id="bn-tec-hoy" onclick="tecTab('hoy')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/></svg>Hoy</button>
    <button class="bnav-btn" id="bn-tec-semana" onclick="tecTab('semana');loadTecSemana()">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke-width="2"/><line x1="3" y1="10" x2="21" y2="10" stroke-width="2"/><line x1="8" y1="2" x2="8" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="2" x2="16" y2="6" stroke-width="2" stroke-linecap="round"/></svg>Semana</button>
    <button class="bnav-btn" id="bn-tec-lista" onclick="tecTab('lista')">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="12" x2="21" y2="12" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="18" x2="21" y2="18" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>Lista</button>`;
  // Start on hoy and load
  loadTecnicoHoy();loadTecnicoLista();
}
function tecTab(t){
  document.querySelectorAll('#tec-view .tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tec-'+t).classList.add('active');
  document.getElementById('bn-tec-'+t).classList.add('active');
}

// \u2500\u2500 DAY NAVIGATION \u2500\u2500
function cambiarDia(delta){
  selectedDay=new Date(selectedDay);selectedDay.setDate(selectedDay.getDate()+delta);
  const d=selectedDay.toISOString().split('T')[0];
  const mw=allWeeks.find(w=>d>=w.start_date&&d<=w.end_date);
  if(mw)selectedWeekId=mw.id;
  loadTecnicoHoy();
}
function updateDayHeader(){
  const dayNames=['Domingo','Lunes','Martes','Mi\u00e9rcoles','Jueves','Viernes','S\u00e1bado'];
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const today=new Date();today.setHours(0,0,0,0);
  const sel=new Date(selectedDay);sel.setHours(0,0,0,0);
  const diff=Math.round((sel-today)/86400000);
  const prefix=diff===0?'HOY \u00b7 ':diff===1?'MA\u00d1ANA \u00b7 ':diff===-1?'AYER \u00b7 ':'';
  const dn=document.getElementById('tec-day-name');const dd=document.getElementById('tec-day-date');
  if(dn)dn.textContent=prefix+dayNames[selectedDay.getDay()].toUpperCase();
  if(dd)dd.textContent=selectedDay.getDate()+' de '+monthNames[selectedDay.getMonth()]+' '+selectedDay.getFullYear();
  const week=allWeeks.find(w=>w.id===selectedWeekId);
  const wl=document.getElementById('tec-week-label');if(wl&&week)wl.textContent=week.label;
}

// \u2500\u2500 LOAD TECNICO HOY \u2500\u2500
async function loadTecnicoHoy(){
  updateDayHeader();
  const viewDate=selectedDay.toISOString().split('T')[0];
  const today=localDateStr();
  const isToday=viewDate===today;
  const viewDow=selectedDay.getDay();
  const fijasEl=document.getElementById('tec-fijas');
  const listEl=document.getElementById('tec-acts-hoy');
  const actsLabel=document.getElementById('tec-acts-label');
  if(viewDow===0){
    if(fijasEl)fijasEl.innerHTML='<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Domingo \u2013 d\u00eda de descanso \ud83c\udf05</div>';
    if(listEl)listEl.innerHTML='<div class="empty-state"><div class="empty-icon">\ud83c\udf05</div><div class="empty-text">Domingo \u00b7 D\u00eda de descanso</div></div>';
    return;
  }
  const matchWeek=allWeeks.find(w=>viewDate>=w.start_date&&viewDate<=w.end_date)||allWeeks.find(w=>w.id===selectedWeekId);
  const weekId=matchWeek?.id||selectedWeekId;
  const {data:weekActs}=await sb.from('activities').select('*').eq('assigned_to',currentUser.id).eq('week_id',weekId);
  const nonFixed=(weekActs||[]).filter(a=>!a.is_fixed);
  const done=nonFixed.filter(a=>a.status==='completada').length;
  const total=nonFixed.length;
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('tec-pct').textContent=pct+'%';
  document.getElementById('tec-bar').style.width=pct+'%';

  // Fixed by DOW
  const {data:allFixed}=await sb.from('activities').select('*').eq('assigned_to',currentUser.id).eq('is_fixed',true);
  const fixedByTitle={};
  (allFixed||[]).forEach(a=>{
    if(!a.scheduled_date)return;
    const d=new Date(a.scheduled_date+'T12:00:00');
    if(d.getDay()!==viewDow)return;
    if(!fixedByTitle[a.title])fixedByTitle[a.title]=a;
  });
  const fixedForDay=Object.values(fixedByTitle).sort((a,b)=>(a.scheduled_start||'').localeCompare(b.scheduled_start||''));
  if(!fijasEl)return;
  const now=new Date();const timeStr=now.toTimeString().slice(0,5);
  if(fixedForDay.length===0){
    fijasEl.innerHTML='<div style="color:var(--muted);font-size:.8rem;padding:8px 0">Sin actividades fijas este d\u00eda</div>';
  }else{
    fijasEl.innerHTML=fixedForDay.map(a=>{
      let statusLabel='Programada',statusClass='frs-pend';
      if(isToday&&a.scheduled_start&&a.scheduled_end){
        if(timeStr>=a.scheduled_start&&timeStr<a.scheduled_end){statusLabel='En progreso';statusClass='frs-prog';}
        else if(timeStr>=a.scheduled_end){statusLabel='Completada';statusClass='frs-done';}
      }
      const t=a.scheduled_start?a.scheduled_start.slice(0,5)+'\u2013'+(a.scheduled_end||'').slice(0,5):'';
      return `<div class="act-card" id="tcard-${a.id}" style="margin-bottom:6px">
        <div class="act-card-header" onclick="toggleTCard('${a.id}')">
          <div class="act-status-dot" style="background:${statusClass==='frs-prog'?'var(--accent)':statusClass==='frs-done'?'var(--green)':'#c8d0e4'};${statusClass==='frs-prog'?'box-shadow:0 0 6px rgba(26,111,212,.4)':''}"></div>
          <div class="act-card-info">
            <div class="act-card-title">${a.title}</div>
            <div class="act-card-meta"><span class="act-type-pill type-fija">fija</span>${t?`<span class="act-time">${t}</span>`:''}</div>
          </div>
          <span class="fixed-row-status ${statusClass}" style="margin-right:6px">${statusLabel}</span>
          <span class="act-card-arrow">\u203a</span>
        </div>
        <div class="act-card-body">
          <div class="images-section">
            <div class="comments-title">Im\u00e1genes de evidencia</div>
            <div class="images-grid" id="imgs-t${a.id}"></div>
            <input type="file" class="img-file-input" id="file-t${a.id}" accept="image/*" multiple onchange="handleImageUpload('${a.id}',this,'imgs-t${a.id}')">
            <button class="img-upload-btn" onclick="document.getElementById('file-t${a.id}').click()">\ud83d\udcf7 Subir im\u00e1genes</button>
          </div>
          <div class="comments-section"><div class="comments-title">Comentarios</div>
            <div id="tcmts-${a.id}"></div>
            <div class="comment-input-wrap">
              <input class="comment-input" id="tcmt-${a.id}" placeholder="Agregar comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}','tcmt-${a.id}','tcmts-${a.id}')">
              <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}','tcmt-${a.id}','tcmts-${a.id}')">Enviar</button>
            </div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  const dayActs=(weekActs||[]).filter(a=>!a.is_fixed&&a.scheduled_date===viewDate);
  if(!listEl)return;
  if(actsLabel)actsLabel.textContent=isToday?'Actividades de hoy':'Actividades del d\u00eda';
  if(dayActs.length===0){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">\ud83d\udccb</div><div class="empty-text">${isToday?'Sin actividades asignadas hoy.<br>Ve a <strong>Lista</strong> para agregar una.':'Sin actividades este d\u00eda.'}</div></div>`;
  }else{
    listEl.innerHTML=dayActs.map(a=>renderActCardTec(a,isToday?'hoy':'readonly')).join('');
  }
}

// \u2500\u2500 TECNICO SEMANA \u2500\u2500
async function loadTecSemana(){
  const week=allWeeks.find(w=>w.id===selectedWeekId);
  const ws=document.getElementById('week-selector-semana');
  // Newest first
  if(ws)ws.innerHTML=allWeeks.map(w=>`<div class="week-chip ${w.id===selectedWeekId?'active':''}" onclick="tecSemanaSelectWeek('${w.id}',this)">${w.label}</div>`).join('');
  if(!week)return;
  const {data:acts}=await sb.from('activities').select('*').eq('assigned_to',currentUser.id).eq('week_id',selectedWeekId).eq('is_fixed',false);
  buildWeeklyTable(acts||[],week,'tec-weekly-table',false);
}
function tecSemanaSelectWeek(id,el){
  selectedWeekId=id;
  document.querySelectorAll('#week-selector-semana .week-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');loadTecSemana();
}

// \u2500\u2500 TECNICO LISTA \u2500\u2500
async function loadTecnicoLista(){
  const {data:acts}=await sb.from('activities').select('*')
    .eq('assigned_to',currentUser.id).eq('is_fixed',false)
    .in('status',['pendiente','revisar']).order('scheduled_month').order('created_at');
  const listEl=document.getElementById('tec-acts-lista');
  const all=acts||[];
  const today=localDateStr();
  const currentMonth=new Date().toISOString().substring(0,7);
  const lista=all.filter(a=>!(a.scheduled_date===today&&a.status==='pendiente'&&a.type!=='revisar'));
  if(lista.length===0){listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">\u2705</div><div class="empty-text">Sin actividades pendientes</div></div>`;return;}

  const preventivos=lista.filter(a=>a.type==='preventivo');
  const extras=lista.filter(a=>a.type!=='preventivo');
  const monthNames={'2026-05':'Mayo 2026','2026-06':'Junio 2026','2026-07':'Julio 2026','2026-08':'Agosto 2026','2026-09':'Septiembre 2026','2026-10':'Octubre 2026','2026-11':'Noviembre 2026','2026-12':'Diciembre 2026'};

  let html='';
  if(extras.length>0){
    html+=`<div class="month-group"><div class="month-header" onclick="toggleMonth(this)"><span>Actividades extra y pendientes</span><span class="month-count">${extras.length}</span></div><div class="month-body">${extras.map(a=>renderActCardTec(a,'lista')).join('')}</div></div>`;
  }
  const byMonth={};
  preventivos.forEach(a=>{const key=a.scheduled_month||'sin-mes';if(!byMonth[key])byMonth[key]=[];byMonth[key].push(a);});
  Object.keys(byMonth).sort().forEach(key=>{
    const group=byMonth[key];
    const isCurrent=key===currentMonth;
    const label=monthNames[key]||key;
    html+=`<div class="month-group"><div class="month-header" onclick="toggleMonth(this)" style="${isCurrent?'background:rgba(26,111,212,.1);border-color:rgba(26,111,212,.3)':''}">
      <span>${label}${isCurrent?' \ud83d\udccc':''}</span><span class="month-count">${group.length} mttos</span>
    </div><div class="month-body ${isCurrent?'':'collapsed'}">${group.map(a=>renderActCardTec(a,'lista')).join('')}</div></div>`;
  });
  listEl.innerHTML=html||'<div class="empty-state"><div class="empty-text">Sin actividades</div></div>';
}
function toggleMonth(header){header.nextElementSibling.classList.toggle('collapsed');}
function loadTecnico(){loadTecnicoHoy();loadTecnicoLista();}

// \u2500\u2500 TECNICO CARD \u2500\u2500
function renderActCardTec(a,context){
  const timeStr=a.scheduled_start?`${a.scheduled_start.slice(0,5)}\u2013${(a.scheduled_end||'').slice(0,5)}`:'';
  const needsPhoto=(a.type==='preventivo'||a.type==='pendiente')&&a.status==='completada'&&context==='hoy';
  const ageClass=(a.type==='pendiente'||a.type==='correctivo')?getAgeClass(a.created_at):'';
  const ageLabel=(a.type==='pendiente'||a.type==='correctivo')&&ageClass?getAgeLabel(a.created_at):'';
  let actionBtns='';
  if(context==='readonly'){
    if(a.status==='completada'){const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';actionBtns=`<span style="color:var(--green);font-size:.78rem;font-family:'DM Mono';font-weight:600">\u2713 ${dur}</span>`;}
    else if(a.status==='en_progreso')actionBtns=`<span class="live-badge"><span class="live-dot"></span>En progreso</span>`;
    else actionBtns=`<span style="color:var(--muted);font-size:.78rem;font-family:'DM Mono'">${a.status}</span>`;
  }else if(context==='lista'){
    if(a.status==='revisar')actionBtns=`<div class="revisar-banner">\u26a0 Esta actividad no fue realizada. Revisa los comentarios.</div><button class="btn btn-start btn-sm" onclick="agregarAHoy('${a.id}',event)">+ Agregar a mi d\u00eda</button>`;
    else actionBtns=`<button class="btn btn-start btn-sm" onclick="agregarAHoy('${a.id}',event)">+ Agregar a mi d\u00eda</button>`;
  }else{
    if(a.status==='pendiente'){
      actionBtns=`<button class="btn btn-start btn-sm" onclick="startAct('${a.id}',event,'tec')">\u25b6 Iniciar</button>
        <button class="btn btn-outline btn-sm" onclick="regresarALista('${a.id}',event)">\u21a9 Regresar a lista</button>`;
    }else if(a.status==='en_progreso'){
      actionBtns=`<div class="timer-display" id="timer-${a.id}">00:00:00</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-finish btn-sm" onclick="finishAct('${a.id}',event,'tec')">\u2713 Finalizar</button>
          <button class="btn btn-outline btn-sm" onclick="regresarALista('${a.id}',event)">\u21a9 Regresar a lista</button>
        </div>`;
    }else if(a.status==='completada'){
      const dur=a.duration_minutes?`${Math.floor(a.duration_minutes/60)}h ${a.duration_minutes%60}m`:'';
      actionBtns=`<span style="color:var(--green);font-size:.78rem;font-family:'DM Mono';font-weight:600">\u2713 Completada ${dur?'\u00b7 '+dur:''}</span>`;
    }else if(a.status==='revisar'){
      actionBtns=`<span style="color:var(--orange);font-size:.78rem;font-family:'DM Mono';font-weight:600">\u26a0 No realizada \u2013 en lista</span>`;
    }
  }
  const noRealizoSection=(context==='hoy'&&(a.status==='pendiente'||a.status==='en_progreso'))?`
    <div class="nr-wrap" id="nr-${a.id}" style="display:none">
      <div class="nr-label">Motivo por el que no se realiz\u00f3</div>
      <div class="comment-input-wrap">
        <input class="comment-input" id="nr-input-${a.id}" placeholder="Escribe el motivo...">
        <button class="btn btn-danger btn-sm" onclick="marcarNoRealizado('${a.id}',event)">Confirmar</button>
      </div>
    </div>
    <button class="btn btn-warn btn-sm" onclick="toggleNR('${a.id}',event)" style="margin-top:4px">\u26a0 No se realiz\u00f3</button>`:'';

  const showImages=(context==='hoy'&&(a.status==='completada'||a.status==='en_progreso'))||(context==='lista');
  const imagesSection=showImages?`
    <div class="images-section">
      <div class="comments-title">Im\u00e1genes${needsPhoto?' <span style="color:var(--red)">*obligatorio</span>':''}</div>
      ${needsPhoto?'<div class="photo-required-banner">\ud83d\udcf7 Sube al menos una foto de evidencia</div>':''}
      <div class="images-grid" id="imgs-t${a.id}"></div>
      <input type="file" class="img-file-input" id="file-t${a.id}" accept="image/*" multiple onchange="handleImageUpload('${a.id}',this,'imgs-t${a.id}')">
      <button class="img-upload-btn ${needsPhoto?'required':''}" onclick="document.getElementById('file-t${a.id}').click()">\ud83d\udcf7 Subir im\u00e1genes</button>
    </div>`:'';

  return `<div class="act-card ${a.status==='revisar'?'revisar':''} ${ageClass}" id="tcard-${a.id}">
    <div class="act-card-header" onclick="toggleTCard('${a.id}')">
      <div class="act-status-dot dot-${a.status}"></div>
      <div class="act-card-info">
        <div class="act-card-title">${a.title}</div>
        <div class="act-card-meta"><span class="act-type-pill type-${a.type}">${a.type}</span>${timeStr?`<span class="act-time">${timeStr}</span>`:''}${ageLabel?`<span class="act-age">${ageLabel}</span>`:''}</div>
      </div><span class="act-card-arrow">\u203a</span>
    </div>
    <div class="act-card-body">
      ${a.description?`<p style="font-size:.8rem;color:var(--muted2);margin-bottom:10px;line-height:1.5">${a.description}</p>`:''}
      <div style="font-family:'DM Mono';font-size:.58rem;color:var(--muted);margin-bottom:8px">Agregada: ${new Date(a.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">${actionBtns}</div>
      ${noRealizoSection}
      ${imagesSection}
      <div class="comments-section"><div class="comments-title">Comentarios</div>
        <div id="tcmts-${a.id}"></div>
        <div class="comment-input-wrap">
          <input class="comment-input" id="tcmt-${a.id}" placeholder="Agregar comentario..." onkeydown="if(event.key==='Enter')addComment('${a.id}','tcmt-${a.id}','tcmts-${a.id}')">
          <button class="btn btn-outline btn-sm" onclick="addComment('${a.id}','tcmt-${a.id}','tcmts-${a.id}')">Enviar</button>
        </div>
      </div>
    </div>
  </div>`;
}
function toggleTCard(id){const card=document.getElementById('tcard-'+id);if(card.classList.toggle('open')){loadComments(id,'tcmts-'+id);loadImages(id,'imgs-t'+id);if(document.getElementById('timer-'+id))startTimerDisplay(id);}}
function toggleNR(id,e){if(e)e.stopPropagation();const el=document.getElementById('nr-'+id);if(el)el.style.display=el.style.display==='none'?'block':'none';}

// \u2500\u2500 ACTIVITY ACTIONS \u2500\u2500
async function startAct(id,e,source){
  if(e)e.stopPropagation();
  const {error}=await sb.from('activities').update({status:'en_progreso',started_at:new Date().toISOString()}).eq('id',id);
  if(error){showToast('Error al iniciar','error');return;}
  showToast('Actividad iniciada \u25b6','success');
  if(source==='julian'){loadJulianDay();loadDashboard();}else{loadTecnicoHoy();loadTecnicoLista();}
}
async function finishAct(id,e,source){
  if(e)e.stopPropagation();
  const {data:act}=await sb.from('activities').select('type,started_at').eq('id',id).single();
  if(act&&(act.type==='preventivo'||act.type==='pendiente')){
    const {data:imgs}=await sb.from('activity_images').select('id').eq('activity_id',id);
    if(!imgs||imgs.length===0){showToast('\ud83d\udcf7 Sube al menos una foto antes de finalizar','error');return;}
  }
  const started=act?.started_at?new Date(act.started_at):new Date();
  const mins=Math.round((new Date()-started)/60000);
  const {error}=await sb.from('activities').update({status:'completada',finished_at:new Date().toISOString(),duration_minutes:mins}).eq('id',id);
  if(error){showToast('Error','error');return;}
  if(timers[id]){clearInterval(timers[id]);delete timers[id];}
  showToast(`Completada en ${Math.floor(mins/60)}h ${mins%60}m \u2713`,'success');
  if(source==='julian'){loadJulianDay();loadDashboard();}else{loadTecnicoHoy();loadTecnicoLista();}
}
async function agregarAHoy(id,e){
  if(e)e.stopPropagation();
  const today=localDateStr();
  const todayWeek=allWeeks.find(w=>today>=w.start_date&&today<=w.end_date);
  const weekId=todayWeek?.id||selectedWeekId;
  const {error}=await sb.from('activities').update({scheduled_date:today,status:'pendiente',week_id:weekId}).eq('id',id);
  if(error){showToast('Error','error');return;}
  showToast('Agregada a tu d\u00eda de hoy \u2713','success');
  tecTab('hoy');await loadTecnicoHoy();await loadTecnicoLista();
}
async function agregarAHoyDesdeTabla(id,e){
  if(e)e.stopPropagation();
  const today=localDateStr();
  const todayWeek=allWeeks.find(w=>today>=w.start_date&&today<=w.end_date);
  const weekId=todayWeek?.id||selectedWeekId;
  const {error}=await sb.from('activities').update({scheduled_date:today,status:'pendiente',week_id:weekId}).eq('id',id);
  if(error){showToast('Error','error');return;}
  showToast('Agregada a tu d\u00eda \u2713','success');
  if(currentUser.role==='supervisor'){loadDashboard();}else{tecTab('hoy');await loadTecnicoHoy();await loadTecSemana();}
}
async function regresarALista(id,e){
  if(e)e.stopPropagation();
  if(timers[id]){clearInterval(timers[id]);delete timers[id];}
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const {error}=await sb.from('activities').update({scheduled_date:tomorrow.toISOString().split('T')[0],status:'pendiente',started_at:null}).eq('id',id);
  if(error){showToast('Error','error');return;}
  showToast('Regresada a la lista \u21a9','success');loadTecnicoHoy();loadTecnicoLista();
}
async function marcarNoRealizado(id,e){
  if(e)e.stopPropagation();
  const input=document.getElementById('nr-input-'+id);
  const motivo=input?input.value.trim():'';
  if(!motivo){showToast('Escribe el motivo','error');return;}
  if(timers[id]){clearInterval(timers[id]);delete timers[id];}
  await sb.from('comments').insert({activity_id:id,user_id:currentUser.id,body:'\u26a0 No realizada: '+motivo});
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const {error}=await sb.from('activities').update({status:'revisar',scheduled_date:tomorrow.toISOString().split('T')[0],started_at:null}).eq('id',id);
  if(error){showToast('Error','error');return;}
  showToast('Marcada para revisar \u26a0','success');loadTecnicoHoy();loadTecnicoLista();
}

// \u2500\u2500 TIMER \u2500\u2500
function startTimerDisplay(id){
  const el=document.getElementById('timer-'+id);if(!el||timers[id])return;
  sb.from('activities').select('started_at').eq('id',id).single().then(({data})=>{
    if(!data?.started_at)return;
    const start=new Date(data.started_at);
    timers[id]=setInterval(()=>{
      const diff=Math.floor((new Date()-start)/1000);
      const h=String(Math.floor(diff/3600)).padStart(2,'0');
      const m=String(Math.floor((diff%3600)/60)).padStart(2,'0');
      const s=String(diff%60).padStart(2,'0');
      const el2=document.getElementById('timer-'+id);
      if(el2)el2.textContent=`${h}:${m}:${s}`;else{clearInterval(timers[id]);delete timers[id];}
    },1000);
  });
}

// \u2500\u2500 COMMENTS \u2500\u2500
async function loadComments(actId,containerId){
  const {data}=await sb.from('comments').select('*, users!comments_user_id_fkey(name)').eq('activity_id',actId).order('created_at');
  const el=document.getElementById(containerId);if(!el)return;
  if(!data||data.length===0){el.innerHTML='<div style="color:var(--muted);font-size:.75rem;margin-bottom:6px">Sin comentarios a\u00fan</div>';return;}
  const whoColors={Pedro:'var(--pedro)',Said:'var(--said)',Julian:'var(--julian)'};
  el.innerHTML=data.map(c=>`<div class="comment-item">
    <div class="comment-meta">
      <span class="comment-author" style="color:${whoColors[c.users?.name]||'var(--muted2)'}">${c.users?.name||'?'}</span>
      <span class="comment-time">${new Date(c.created_at).toLocaleString('es-MX',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</span>
    </div>
    <div class="comment-body">${c.body}</div>
  </div>`).join('');
}
async function addComment(actId,inputId,containerId){
  const input=document.getElementById(inputId);
  const body=input?.value.trim();if(!body)return;
  const {error}=await sb.from('comments').insert({activity_id:actId,user_id:currentUser.id,body});
  if(error){showToast('Error','error');return;}
  input.value='';loadComments(actId,containerId);showToast('Comentario enviado','success');
}

// \u2500\u2500 IMAGES \u2500\u2500
async function loadImages(actId,containerId){
  const {data}=await sb.from('activity_images').select('*').eq('activity_id',actId);
  const el=document.getElementById(containerId);if(!el)return;
  if(!data||data.length===0){el.innerHTML='';return;}
  el.innerHTML=data.map(img=>`<a class="img-thumb" href="${img.drive_file_url}" target="_blank">${img.filename||'Ver'}</a>`).join('');
}

async function handleImageUpload(actId,input,containerId){
  const files=Array.from(input.files);if(!files.length)return;
  const {data:act}=await sb.from('activities').select('title,week_id').eq('id',actId).single();
  const week=allWeeks.find(w=>w.id===act?.week_id);
  const weekLabel=week?week.label:'Semana sin etiqueta';
  const actTitle=act?.title||'Actividad';
  const safeName=actTitle.replace(/[^a-zA-Z\u00e1\u00e9\u00ed\u00f3\u00fa\u00c1\u00c9\u00cd\u00d3\u00da\u00f1\u00d10-9 ]/g,'').trim().substring(0,50).replace(/ +/g,'_');
  let uploaded=0,failed=0;
  for(let i=0;i<files.length;i++){
    const file=files[i];
    showToast(`Subiendo ${i+1} de ${files.length}...`,'success');
    try{
      const compressed=await compressImage(file,1200,0.75);
      const base64=compressed.split(',')[1];
      const timestamp=new Date().getTime()+i;
      const fileName=`${safeName}_${timestamp}.jpg`;
      const res=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({activityTitle:actTitle,weekLabel,fileName,fileBase64:base64,mimeType:'image/jpeg',uploadedBy:currentUser.name})});
      const text=await res.text();
      let result;try{result=JSON.parse(text);}catch(e){result={success:false,error:text};}
      if(result.success){
        await sb.from('activity_images').insert({activity_id:actId,drive_file_url:result.fileUrl,filename:fileName,uploaded_by:currentUser.id});
        if(result.folderUrl)await sb.from('activities').update({drive_folder_url:result.folderUrl}).eq('id',actId);
        uploaded++;
      }else{failed++;console.error('Drive error:',result.error);}
    }catch(err){failed++;console.error('Upload error:',err);}
  }
  if(uploaded>0){showToast(`${uploaded} de ${files.length} imagen(es) subida(s) a Drive \u2713`,'success');loadImages(actId,containerId);}
  if(failed>0)showToast(`${failed} imagen(es) no se pudieron subir`,'error');
}

function compressImage(file,maxWidth,quality){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        let w=img.width,h=img.height;
        if(w>maxWidth){h=Math.round(h*maxWidth/w);w=maxWidth;}
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg',quality));
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// \u2500\u2500 MODALS \u2500\u2500
function openModal(){populateUserSelects();document.getElementById('modal-overlay').classList.add('open');}
function closeModal(e){if(e.target===document.getElementById('modal-overlay'))document.getElementById('modal-overlay').classList.remove('open');}

// \u2500\u2500 TOAST \u2500\u2500
function showToast(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className=`toast ${type} show`;
  setTimeout(()=>t.classList.remove('show'),3500);
}

function localDateStr(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

function localISOStr(){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString();}

function fmtLocalTime(s){if(!s)return'--:--';return new Date(s).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});}

function pinClear(){pinBuffer='';updatePinDots();}

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
window.addEventListener('load', function() {
  if(typeof supabase === 'undefined') {
    var el = document.getElementById('login-error');
    if(el) el.textContent = 'Error: recarga la pagina';
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  init();
});

async function autoUpdateFixedActivities() {
  const now = new Date();
  const today = localDateStr();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const { data: fixedActs } = await sb.from('activities')
    .select('*').eq('is_fixed', true).eq('scheduled_date', today);
  if(!fixedActs) return;
  const seen = {};
  const unique = [];
  fixedActs.forEach(function(a) {
    var key = a.title+'|'+a.assigned_to+'|'+(a.scheduled_start||'');
    if(!seen[key]) { seen[key]=true; unique.push(a); }
  });
  for(const act of unique) {
    const start = (act.scheduled_start||'').slice(0,5);
    const end2 = (act.scheduled_end||'').slice(0,5);
    if(!start||!end2) continue;
    if(act.status==='pendiente' && timeStr>=start && timeStr<end2) {
      await sb.from('activities').update({status:'en_progreso',started_at:localISOStr()}).eq('id',act.id);
    } else if(act.status==='en_progreso' && timeStr>=end2) {
      const started = act.started_at ? new Date(act.started_at) : now;
      const mins = Math.max(0, Math.round((now-started)/60000));
      await sb.from('activities').update({status:'completada',finished_at:localISOStr(),duration_minutes:mins}).eq('id',act.id);
    }
  }
}
