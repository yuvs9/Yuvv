// ====== Core Game Data ======
const DEFAULT = {
  level: 1,
  xp: 0,
  hardMode: false,
  streakDays: 0,
  weeklyClears: 0,
  lastDay: dayKey(new Date()),
  bossStatus: 'Idle',
  titlesUnlocked: [],
  passives: [],
  stats: {
    Power: 1, Stamina: 1, Strength: 1, Focus: 1, Discipline: 1, Charisma: 1, Willpower: 1
  },
  dailies: {},
  custom: []
};

const STORAGE_KEY = 'solo_leveling_save_v1';

const DAILY_DECK = [
  {id:'no_smoke', name:'No Smoking Today', xp: 30, gains:{Stamina:2, Strength:1, Willpower:2}, tags:['Health','Addiction']},
  {id:'no_jerk',  name:'No Jerking', xp: 28, gains:{Discipline:3, Focus:1, Willpower:2}, tags:['Control']},
  {id:'limit_scroll', name:'Under 60m Scrolling', xp: 20, gains:{Focus:2, Discipline:1}, tags:['Digital']},
  {id:'workout',  name:'20+ min Workout / Trek', xp: 24, gains:{Strength:3, Stamina:2}, tags:['Body']},
  {id:'read_journal', name:'Read 10p or Journal 3 lines', xp: 18, gains:{Focus:2, Willpower:1}, tags:['Mind']},
  {id:'cold_shower', name:'Cold Shower', xp: 12, gains:{Discipline:1, Willpower:1}, tags:['Fortitude']}
];

const TITLES = [
  {lvl:1,  title:'Novice Hunter', perk:'—'},
  {lvl:5,  title:'Impulse Breaker', perk:'+5% XP on No Jerking days'},
  {lvl:10, title:'Smoke Slayer', perk:'No Smoking gives +10% XP'},
  {lvl:20, title:'Scroll Reaper', perk:'Under 60m Scrolling gives +10% XP'},
  {lvl:30, title:'Iron Mind', perk:'+1 Willpower on daily full clear'},
  {lvl:40, title:'Momentum Master', perk:'+1 Discipline per 7-day streak'},
  {lvl:50, title:'Cold Aura', perk:'-10% XP needed to level'},
  {lvl:60, title:'Hunter’s Focus', perk:'+1 Focus on every 3rd day'},
  {lvl:70, title:'Unyielding', perk:'Hard Mode penalties -25%'},
  {lvl:80, title:'Relentless', perk:'+1 Stamina on weekly boss clear'},
  {lvl:90, title:'Transcendent', perk:'+1 to all stats on full week clears'}
];

// ====== Utilities ======
function $(id){ return document.getElementById(id); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, n)); }
function dayKey(d){ return d.toISOString().slice(0,10); }

function xpNeeded(level, state){
  const base = 50 + Math.floor((level-1) * 12);
  const hasColdAura = state.titlesUnlocked.includes(50);
  return hasColdAura ? Math.floor(base*0.9) : base;
}
function rankFromLevel(lv){
  if(lv>=95) return 'SSS';
  if(lv>=85) return 'SS';
  if(lv>=70) return 'S';
  if(lv>=50) return 'A';
  if(lv>=35) return 'B';
  if(lv>=20) return 'C';
  if(lv>=10) return 'D';
  return 'E';
}
function nextTitleInfo(level){
  const next = TITLES.find(t=>t.lvl>level);
  return next ? `${next.title} (Lv.${next.lvl})` : 'Maxed';
}
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }

// ====== State ======
let state = load();

function load(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    const s = deepClone(DEFAULT);
    bootstrapDay(s);
    return s;
  }
  let s = JSON.parse(raw);
  bootstrapDay(s, true);
  return s;
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function bootstrapDay(s, preserve=false){
  const today = dayKey(new Date());
  if(!preserve || s.lastDay !== today){
    s.dailies = {};
    DAILY_DECK.forEach(q=>s.dailies[q.id] = {done:false});
    s.custom = (s.custom||[]).map(c=>({...c, done:false}));
    s.lastDay = today;
  }
}

const STATS = ["Power","Stamina","Strength","Focus","Discipline","Charisma","Willpower"];

function render(){
  $('level').textContent = state.level;
  $('xpNow').textContent = state.xp;
  $('xpNext').textContent = xpNeeded(state.level, state);
  $('xpFill').style.width = `${Math.min(100, (state.xp/xpNeeded(state.level,state))*100)}%`;
  $('rankBadge').textContent = rankFromLevel(state.level);
  $('streakDays').textContent = state.streakDays;
  $('weeklyClears').textContent = state.weeklyClears;
  $('hardMode').checked = state.hardMode;

  const currentTitle = TITLES.slice().reverse().find(t=>state.level>=t.lvl)?.title || 'Novice Hunter';
  $('currentTitle').textContent = currentTitle;
  $('nextTitle').textContent = nextTitleInfo(state.level);

  const grid = $('statsGrid');
  grid.innerHTML = '';
  STATS.forEach(name=>{
    const val = state.stats[name];
    const wrap = document.createElement('div');
    wrap.className = 'stat';
    wrap.innerHTML = `
      <div class="name"><span>${name}</span><span>${val}/100</span></div>
      <div class="bar"><div class="fill" style="width:${val}%"></div></div>
    `;
    grid.appendChild(wrap);
  });
  $('passives').textContent = state.titlesUnlocked.length
    ? `Passives: ${state.titlesUnlocked.map(l=>TITLES.find(t=>t.lvl===l).title).join(', ')}`
    : 'Passives: None yet';

  const dailyWrap = $('dailyQuests');
  dailyWrap.innerHTML = '';
  DAILY_DECK.forEach(q=>{
    const done = state.dailies[q.id]?.done;
    const card = document.createElement('div');
    card.className = 'quest';
    card.innerHTML = `
      <h3>${q.name}</h3>
      <div class="meta">XP: ${displayQuestXP(q)} • Gains: ${gainsLabel(q.gains)}</div>
      <div class="actions">
        ${q.tags.map(t=>`<span class="tag">${t}</span>`).join('')}
        <button data-id="${q.id}" class="${done?'success':''}">${done?'Completed':'Complete'}</button>
      </div>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('click', ()=>toggleDaily(q));
    dailyWrap.appendChild(card);
  });

  const custWrap = $('customList');
  custWrap.innerHTML='';
  state.custom.forEach(c=>{
    const div = document.createElement('div');
    div.className='quest';
    div.innerHTML = `
      <h3>${c.name}</h3>
      <div class="meta">XP: ${c.xp}</div>
      <div class="actions">
        <button data-id="${c.id}" class="${c.done?'success':''}">${c.done?'Completed':'Complete'}</button>
        <button data-del="${c.id}" class="ghost">Delete</button>
      </div>
    `;
    div.querySelector('button[data-id]').addEventListener('click', ()=>toggleCustom(c.id));
    div.querySelector('button[data-del]').addEventListener('click', ()=>deleteCustom(c.id));
    custWrap.appendChild(div);
  });

  $('bossStatus').textContent = `Status: ${state.bossStatus}`;
}

function gainsLabel(g){
  return Object.entries(g).map(([k,v])=>`${k}+${v}`).join(', ');
}

function displayQuestXP(q){
  let xp = q.xp;
  if(q.id==='no_jerk' && state.level>=5) xp = Math.floor(xp*1.05);
  if(q.id==='no_smoke' && state.level>=10) xp = Math.floor(xp*1.10);
  if(q.id==='limit_scroll' && state.level>=20) xp = Math.floor(xp*1.10);
  return xp;
}

function addXP(amount){
  state.xp += amount;
  while(state.xp >= xpNeeded(state.level, state) && state.level < 100){
    state.xp -= xpNeeded(state.level, state);
    state.level++;
    applyTitleUnlocks();
    bumpStat('Power', 1);
    bumpStat('Charisma', 1);
  }
  if(state.level>=100){ state.xp = 0; }
}

function bumpStat(name, by){
  state.stats[name] = clamp(state.stats[name] + by, 1, 100);
}

function applyGains(g){
  for(const [k,v] of Object.entries(g)) bumpStat(k, v);
  bumpStat('Power', 1);
}

function applyTitleUnlocks(){
  TITLES.forEach(t=>{
    if(state.level>=t.lvl && !state.titlesUnlocked.includes(t.lvl)){
      state.titlesUnlocked.push(t.lvl);
      if(t.lvl===30){ bumpStat('Willpower',1); }
      if(t.lvl===40){ bumpStat('Discipline',1); }
      if(t.lvl===80){ bumpStat('Stamina',1); }
      if(t.lvl===90){ STATS.forEach(s=>bumpStat(s,1)); }
    }
  });
}

function toggleDaily(q){
  const cur = state.dailies[q.id]?.done;
  if(cur) return;
  state.dailies[q.id].done = true;
  applyGains(q.gains);
  addXP(displayQuestXP(q));
  if(allDailiesDone()){
    addXP(20);
    if(state.level>=30) bumpStat('Willpower',1);
  }
  save(); render();
}

function allDailiesDone(){
  return DAILY_DECK.every(q=>state.dailies[q.id]?.done);
}

function toggleCustom(id){
  const c = state.custom.find(x=>x.id===id);
  if(!c || c.done) return;
  c.done = true;
  addXP(c.xp);
  bumpStat('Discipline',1);
  save(); render();
}
function deleteCustom(id){
  state.custom = state.custom.filter(x=>x.id!==id);
  save(); render();
}

function newDay(force=false){
  const today = dayKey(new Date());
  const last = state.lastDay;
  if(!force && last===today) return;

  const missed = !allDailiesDone() && last !== today;
  if(missed){
    state.streakDays = 0;
    const penalty = state.hardMode ? 20 : 10;
    state.xp = Math.max(0, state.xp - penalty);
    const statPenalty = state.hardMode ? 2 : 1;
    bumpStat('Focus', -statPenalty);
    bumpStat('Discipline', -statPenalty);
    if(state.level>=70){
      addXP(Math.floor(penalty*0.25));
      bumpStat('Focus', 1);
    }
  } else if (last !== today) {
    state.streakDays += 1;
    if(state.streakDays % 7 === 0 && state.level>=40){ bumpStat('Discipline',1); }
  }
  bootstrapDay(state);
  save(); render();
}

(function checkRollover(){
  const now = new Date();
  if(dayKey(now)!==state.lastDay) newDay(true);
})();

document.getElementById && window.addEventListener('load', ()=>{
  // attach events after DOM ready
  document.getElementById('startBoss').addEventListener('click', ()=>{
    state.bossStatus = 'Running (post 10pm no-relapse night)';
    save(); render();
  });
  document.getElementById('clearBoss').addEventListener('click', ()=>{
    state.bossStatus = 'Cleared';
    state.weeklyClears += 1;
    addXP(40);
    if(state.level>=80) bumpStat('Stamina',1);
    save(); render();
  });

  document.getElementById('panicShield').addEventListener('click', async ()=>{
    const end = Date.now() + 3*60*1000;
    document.getElementById('toolStatus').textContent = 'Shield active: breathe 4-7-8 until the timer ends.';
    disableButtons(true);
    const step = ()=> {
      const remain = Math.max(0, end - Date.now());
      document.getElementById('toolStatus').textContent = `Shield active: ${Math.ceil(remain/1000)}s left — Inhale 4s, Hold 7s, Exhale 8s.`;
      if(remain>0) setTimeout(step, 1000); else {
        document.getElementById('toolStatus').textContent = 'Shield complete. Urge should be lower — do 10 pushups or take a walk.';
        disableButtons(false);
        addXP(6); bumpStat('Willpower',1);
        save(); render();
      }
    }; step();
  });

  document.getElementById('urgeTimerBtn').addEventListener('click', ()=>{
    const end = Date.now() + 10*60*1000;
    document.getElementById('toolStatus').textContent = 'Urge Timer started (10 min). Do not open triggers.';
    const tick = ()=>{
      const remain = Math.max(0, end - Date.now());
      document.getElementById('toolStatus').textContent = `Urge Timer: ${Math.ceil(remain/1000)}s left.`;
      if(remain>0) setTimeout(tick, 1000); else {
        document.getElementById('toolStatus').textContent = 'Urge passed. Log a win — you just trained Willpower.';
        addXP(8); bumpStat('Willpower',1); save(); render();
      }
    }; tick();
  });

  document.getElementById('coldShowerBtn').addEventListener('click', ()=>{
    addXP(5); bumpStat('Discipline',1);
    const daily = state.dailies['cold_shower'];
    if(daily && !daily.done){ daily.done = true; }
    save(); render();
  });

  document.getElementById('hardMode').addEventListener('change', (e)=>{
    state.hardMode = e.target.checked;
    save(); render();
  });

  document.getElementById('resetDayBtn').addEventListener('click', ()=>newDay(true));

  document.getElementById('exportBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `solo_leveling_save_${state.lastDay}.json`;
    a.click();
  });

  document.getElementById('importFile').addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const txt = await f.text();
    try{
      const data = JSON.parse(txt);
      state = {...DEFAULT, ...data};
      save(); render();
    }catch(err){ alert('Invalid save file'); }
  });

  document.getElementById('addCustom').addEventListener('click', ()=>{
    const name = document.getElementById('customName').value.trim();
    const xp = parseInt(document.getElementById('customXp').value,10) || 1;
    if(!name) return;
    state.custom.push({id: crypto.randomUUID(), name, xp: Math.max(1, Math.min(200,xp)), done:false});
    document.getElementById('customName').value='';
    save(); render();
  });

  render();
});

// Export/Import utilities for desktop
function disableButtons(disabled){
  document.querySelectorAll('button').forEach(b=>b.disabled = disabled);
}

function initStatsGrid(){ render(); }
function applyTitleAuto(){ applyTitleUnlocks(); save(); render(); }
