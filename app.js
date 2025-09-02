/* Tomato Pomodoro - Professional Tomato-Themed Pomodoro Timer
   Pure JS implementation with tasks, stats, PWA hooks, and accessibility.
*/
(function(){
  'use strict';

  // ---------- DOM ----------
  const modeLabel = document.getElementById('modeLabel');
  const timeLabel = document.getElementById('timeLabel');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const skipBtn = document.getElementById('skipBtn');
  const sessionCounterEl = document.getElementById('sessionCounter');
  const progressRing = document.getElementById('progressRing');
  const themeToggle = document.getElementById('themeToggle');
  const openSettings = document.getElementById('openSettings');
  const settingsDialog = document.getElementById('settingsDialog');
  const settingsForm = document.getElementById('settingsForm');
  const workInput = document.getElementById('workInput');
  const shortInput = document.getElementById('shortInput');
  const longInput = document.getElementById('longInput');
  const longEveryInput = document.getElementById('longEveryInput');
  const autoStartBreaks = document.getElementById('autoStartBreaks');
  const autoStartWork = document.getElementById('autoStartWork');
  const desktopAlerts = document.getElementById('desktopAlerts');
  const focusModeBtn = document.getElementById('focusModeBtn');
  const tomatoContainer = document.getElementById('tomatoContainer');
  const onboarding = document.getElementById('onboarding');
  const dismissOnboarding = document.getElementById('dismissOnboarding');
  const volumeSlider = document.getElementById('volumeSlider');
  const muteBtn = document.getElementById('muteBtn');
  const importInput = document.getElementById('importInput');
  const exportBtn = document.getElementById('exportBtn');

  // Tasks
  const taskForm = document.getElementById('taskForm');
  const taskTitle = document.getElementById('taskTitle');
  const taskEst = document.getElementById('taskEst');
  const taskListEl = document.getElementById('taskList');
  const clearCompletedBtn = document.getElementById('clearCompleted');

  // Stats
  const statToday = document.getElementById('statToday');
  const statWeek = document.getElementById('statWeek');
  const statMonth = document.getElementById('statMonth');
  const statTotal = document.getElementById('statTotal');
  const statFocus = document.getElementById('statFocus');
  const statStreak = document.getElementById('statStreak');

  // Audio: Web Audio beeps primary; Howler/<audio> fallback
  const useHowler = typeof Howl !== 'undefined';
  let howl = null;
  let audioSet = [];
  let audioCtx = null;
  function ensureAudioCtx(){ audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
  function playBeep(frequency, durationMs){
    try{
      if(settings.muted || settings.volume<=0) return;
      const ctx = ensureAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = frequency; osc.type = 'sine';
      const now = ctx.currentTime;
      const vol = Math.max(0.0001, Math.min(1, settings.volume));
      gain.gain.setValueAtTime(0.35*vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + durationMs/1000);
      osc.start(now); osc.stop(now + durationMs/1000);
    }catch{}
  }
  if(useHowler){
    const sources = {
      start: 'assets/start.mp3',
      pause: 'assets/pause.mp3',
      workDone: 'assets/work_done.mp3',
      breakDone: 'assets/break_done.mp3',
      transition: 'assets/transition.mp3'
    };
    howl = {
      start: new Howl({ src:[sources.start], preload:true, html5:true }),
      pause: new Howl({ src:[sources.pause], preload:true, html5:true }),
      workDone: new Howl({ src:[sources.workDone], preload:true, html5:true }),
      breakDone: new Howl({ src:[sources.breakDone], preload:true, html5:true }),
      transition: new Howl({ src:[sources.transition], preload:true, html5:true })
    };
  } else {
    const sndStart = document.getElementById('sndStart');
    const sndPause = document.getElementById('sndPause');
    const sndWorkDone = document.getElementById('sndWorkDone');
    const sndBreakDone = document.getElementById('sndBreakDone');
    const sndTransition = document.getElementById('sndTransition');
    audioSet = [sndStart, sndPause, sndWorkDone, sndBreakDone, sndTransition];
  }
  let audioUnlocked = false;

  // ---------- Storage helpers ----------
  const storage = {
    get(key, fallback){
      try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch{return fallback}
    },
    set(key, value){
      localStorage.setItem(key, JSON.stringify(value));
    }
  };

  // ---------- State ----------
  const MODES = { WORK:'work', SHORT:'short', LONG:'long' };
  const DEFAULT_SETTINGS = {
    work:25, short:5, long:15, longEvery:4,
    autoStartBreaks:true, autoStartWork:true, dark:true, volume:0.6, muted:false, notifications:false
  };
  let settings = Object.assign({}, DEFAULT_SETTINGS, storage.get('settings', {}));
  let tasks = storage.get('tasks', []);
  let stats = storage.get('stats', { sessions:[], total:0, focusMinutes:0, streak:0, lastDay:'' });

  let mode = MODES.WORK;
  let isRunning = false;
  let completedWorkSessions = storage.get('completedWorkSessions', 0);
  let sessionStartTs = 0; // ms
  let targetEndTs = 0; // ms
  let durationMs = minutesToMs(settings.work);
  let rafId = 0;

  // ---------- Initialization ----------
  applyThemeFromSettings();
  initSettingsUI();
  loadTasksUI();
  updateStatsUI();
  updateModeUI();
  updateTimeLabel(durationMs);
  setupA11y();
  applyVolume();
  setupAudioUnlock();
  if(!storage.get('onboardingDismissed', false)) onboarding.hidden = false;

  // ---------- Event Listeners ----------
  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', nextPhase);

  document.addEventListener('keydown', (e)=>{
    if(e.code === 'Space' && !isInputFocused()){
      e.preventDefault();
      isRunning ? pauseTimer() : startTimer();
    }
  });

  themeToggle.addEventListener('click', ()=>{
    settings.dark = !document.body.classList.toggle('light');
    storage.set('settings', settings);
  });
  focusModeBtn.addEventListener('click', async ()=>{
    try{
      if(!document.fullscreenElement){
        await (tomatoContainer.requestFullscreen?.() || document.documentElement.requestFullscreen());
        focusModeBtn.setAttribute('aria-pressed','true');
      }else{
        await document.exitFullscreen();
        focusModeBtn.setAttribute('aria-pressed','false');
      }
    }catch{}
  });
  openSettings.addEventListener('click', ()=>settingsDialog.showModal());
  settingsForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    settings.work = clamp(parseInt(workInput.value||'25',10),5,120);
    settings.short = clamp(parseInt(shortInput.value||'5',10),3,30);
    settings.long = clamp(parseInt(longInput.value||'15',10),10,60);
    settings.longEvery = clamp(parseInt(longEveryInput.value||'4',10),2,8);
    settings.autoStartBreaks = autoStartBreaks.checked;
    settings.autoStartWork = autoStartWork.checked;
    settings.notifications = desktopAlerts.checked;
    storage.set('settings', settings);
    durationMs = mode === MODES.WORK ? minutesToMs(settings.work) : mode === MODES.SHORT ? minutesToMs(settings.short) : minutesToMs(settings.long);
    updateTimeLabel(durationMs);
    settingsDialog.close();
  });
  volumeSlider.addEventListener('input', ()=>{ settings.volume = parseFloat(volumeSlider.value); applyVolume(); storage.set('settings', settings); });
  muteBtn.addEventListener('click', ()=>{ settings.muted = !settings.muted; applyVolume(); storage.set('settings', settings); muteBtn.setAttribute('aria-pressed', String(settings.muted)); });

  dismissOnboarding?.addEventListener('click', ()=>{ onboarding.hidden = true; storage.set('onboardingDismissed', true); });

  // Tasks
  taskForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const title = taskTitle.value.trim();
    const est = clamp(parseInt(taskEst.value||'1',10),1,20);
    if(!title) return;
    const task = { id: uid(), title, est, done:false, spent:0 };
    tasks.push(task); storage.set('tasks', tasks);
    addTaskRow(task);
    taskTitle.value=''; taskEst.value='1';
  });
  clearCompletedBtn.addEventListener('click', ()=>{
    tasks = tasks.filter(t=>!t.done);
    storage.set('tasks', tasks);
    renderTaskList();
  });
  exportBtn.addEventListener('click', ()=>{
    const data = { settings, tasks, stats, completedWorkSessions };
    const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'tomato-pomodoro-backup.json'; a.click(); URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0]; if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(data.settings) { settings = Object.assign({}, DEFAULT_SETTINGS, data.settings); storage.set('settings', settings); initSettingsUI(); applyThemeFromSettings(); applyVolume(); }
      if(Array.isArray(data.tasks)) { tasks = data.tasks; storage.set('tasks', tasks); renderTaskList(); }
      if(data.stats) { stats = data.stats; storage.set('stats', stats); updateStatsUI(); }
      if(typeof data.completedWorkSessions === 'number'){ completedWorkSessions = data.completedWorkSessions; storage.set('completedWorkSessions', completedWorkSessions); sessionCounterEl.textContent = String(completedWorkSessions); }
      alert('Import successful');
    }catch(err){ alert('Invalid file'); }
  });

  // ---------- Timer Core ----------
  function startTimer(){
    if(isRunning) return;
    isRunning = true;
    sessionStartTs = Date.now();
    if(targetEndTs <= Date.now()) targetEndTs = Date.now() + durationMs;
    sndPlay(useHowler ? 'start' : audioSet[0]);
    tick();
  }
  function pauseTimer(){
    if(!isRunning) return;
    isRunning = false;
    durationMs = Math.max(0, targetEndTs - Date.now());
    cancelAnimationFrame(rafId);
    sndPlay(useHowler ? 'pause' : audioSet[1]);
    updateTabTitle();
  }
  function resetTimer(){
    cancelAnimationFrame(rafId);
    isRunning = false;
    durationMs = getModeDuration(mode);
    targetEndTs = 0;
    updateTimeLabel(durationMs);
    updateProgress(0);
    updateTabTitle();
  }

  function nextPhase(){
    // complete current phase
    if(mode === MODES.WORK){
      completedWorkSessions += 1; storage.set('completedWorkSessions', completedWorkSessions);
      sessionCounterEl.textContent = String(completedWorkSessions);
      incrementStats(minutesFromMs(getModeDuration(MODES.WORK)));
      sndPlay(useHowler ? 'workDone' : audioSet[2]);
      const isLong = completedWorkSessions % settings.longEvery === 0;
      setMode(isLong ? MODES.LONG : MODES.SHORT);
      if(settings.autoStartBreaks) startTimer();
    } else {
      sndPlay(useHowler ? 'breakDone' : audioSet[3]);
      setMode(MODES.WORK);
      if(settings.autoStartWork) startTimer();
    }
    notifyPhaseChange();
  }

  function tick(){
    const now = Date.now();
    const remaining = Math.max(0, targetEndTs - now);
    updateTimeLabel(remaining);
    const elapsed = getModeDuration(mode) - remaining;
    updateProgress(Math.max(0, Math.min(1, elapsed / getModeDuration(mode))));
    updateTabTitle();
    if(remaining <= 0){ isRunning = false; nextPhase(); return; }
    rafId = requestAnimationFrame(tick);
  }

  function setMode(next){
    mode = next;
    document.body.classList.remove('break-short','break-long');
    if(mode === MODES.SHORT) document.body.classList.add('break-short');
    if(mode === MODES.LONG) document.body.classList.add('break-long');
    modeLabel.textContent = mode === MODES.WORK ? 'Work' : (mode === MODES.SHORT ? 'Short Break' : 'Long Break');
    durationMs = getModeDuration(mode);
    targetEndTs = Date.now() + durationMs;
    updateTimeLabel(durationMs);
    updateProgress(0);
    sndPlay(useHowler ? 'transition' : audioSet[4]);
  }

  function updateModeUI(){ setMode(mode); pauseTimer(); }

  function updateTimeLabel(ms){ timeLabel.textContent = formatTime(ms); }

  function updateProgress(ratio){
    const circumference = 2 * Math.PI * 120; // r=120 in SVG
    const dash = Math.round(circumference * ratio);
    progressRing.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
  }

  function updateTabTitle(){
    const prefix = mode === MODES.WORK ? '🍅' : (mode === MODES.SHORT ? '🍊' : '🍇');
    const time = isRunning ? timeLabel.textContent : `${timeLabel.textContent} • paused`;
    document.title = `${prefix} ${time} — Tomato Pomodoro`;
  }

  // ---------- Tasks UI ----------
  function loadTasksUI(){
    renderTaskList();
  }
  function renderTaskList(){
    taskListEl.innerHTML = '';
    tasks.forEach(addTaskRow);
  }
  function addTaskRow(task){
    const li = document.createElement('li'); li.className='task-item'; li.draggable=true; li.dataset.id=task.id;
    // checkbox
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked=task.done; cb.setAttribute('aria-label','Mark task done');
    cb.addEventListener('change',()=>{ task.done = cb.checked; storage.set('tasks', tasks); li.classList.toggle('done', task.done); });
    // title
    const titleBox = document.createElement('div'); titleBox.className='task-title';
    const input = document.createElement('input'); input.type='text'; input.value=task.title; input.setAttribute('aria-label','Task title');
    input.addEventListener('input',()=>{ task.title = input.value; storage.set('tasks', tasks); });
    const meta = document.createElement('div'); meta.className='pill'; meta.textContent = `${task.spent}/${task.est} pomo`;
    titleBox.append(input, meta);
    // actions
    const actions = document.createElement('div'); actions.style.display='flex'; actions.style.gap='6px';
    const inc = document.createElement('button'); inc.className='ghost'; inc.textContent='＋'; inc.title='Add spent pomodoro';
    inc.addEventListener('click',()=>{ task.spent++; meta.textContent = `${task.spent}/${task.est} pomo`; storage.set('tasks', tasks); });
    const del = document.createElement('button'); del.className='ghost'; del.textContent='🗑'; del.title='Delete';
    del.addEventListener('click',()=>{ tasks = tasks.filter(t=>t.id!==task.id); storage.set('tasks', tasks); li.remove(); });
    actions.append(inc, del);

    li.append(cb, titleBox, actions);
    // drag events
    li.addEventListener('dragstart',()=>{ li.classList.add('dragging'); });
    li.addEventListener('dragend',()=>{ li.classList.remove('dragging'); saveOrder(); });
    li.addEventListener('dragover',(e)=>{ e.preventDefault(); const after = getDragAfterElement(taskListEl, e.clientY); if(after==null){ taskListEl.appendChild(li);} else { taskListEl.insertBefore(li, after);} });

    taskListEl.appendChild(li);
  }
  function getDragAfterElement(container, y){
    const els = [...container.querySelectorAll('.task-item:not(.dragging)')];
    return els.reduce((closest, child)=>{
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if(offset < 0 && offset > closest.offset){ return { offset, element: child }; }
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
  function saveOrder(){
    const ids = [...taskListEl.children].map(li=>li.dataset.id);
    tasks.sort((a,b)=> ids.indexOf(a.id) - ids.indexOf(b.id));
    storage.set('tasks', tasks);
  }

  // ---------- Settings ----------
  function initSettingsUI(){
    workInput.value = String(settings.work);
    shortInput.value = String(settings.short);
    longInput.value = String(settings.long);
    longEveryInput.value = String(settings.longEvery);
    autoStartBreaks.checked = !!settings.autoStartBreaks;
    autoStartWork.checked = !!settings.autoStartWork;
    desktopAlerts.checked = !!settings.notifications;
    sessionCounterEl.textContent = String(completedWorkSessions);
  }
  function applyThemeFromSettings(){ document.body.classList.toggle('light', !settings.dark); }

  function applyVolume(){
    if(useHowler){
      Howler.mute(!!settings.muted);
      Howler.volume(settings.muted ? 0 : settings.volume);
    } else {
      audioSet.forEach(a=>{ a.muted = !!settings.muted; a.volume = settings.muted ? 0 : settings.volume; });
    }
    volumeSlider.value = String(settings.volume);
    muteBtn.setAttribute('aria-pressed', String(settings.muted));
    muteBtn.textContent = settings.muted ? '🔇' : '🔊';
    muteBtn.title = settings.muted ? 'Unmute' : 'Mute';
  }
  // Tone patterns
  const toneMap = {
    start: ()=>playBeep(1000, 300),
    pause: ()=>playBeep(400, 300),
    workDone: ()=>{ playBeep(700, 160); setTimeout(()=>playBeep(900, 160), 170); },
    breakDone: ()=>{ playBeep(450, 160); setTimeout(()=>playBeep(350, 160), 170); },
    transition: ()=>playBeep(850, 180)
  };
  function sndPlay(keyOrEl){
    const key = typeof keyOrEl === 'string' ? keyOrEl : null;
    if(key && toneMap[key]){ toneMap[key](); return; }
    try{
      if(settings.muted || settings.volume<=0) return;
      if(useHowler && key){ howl[key]?.play(); }
      else { const el = keyOrEl; el.currentTime=0; el.play().catch(()=>{}); }
    }catch{}
  }

  function setupAudioUnlock(){
    let ctx;
    const unlock = async ()=>{
      if(audioUnlocked) return;
      try{
        if(!useHowler){
          for(const a of audioSet){
            a.load();
            await a.play().then(()=>a.pause()).catch(()=>{});
          }
        }
        ctx = ensureAudioCtx();
        if(ctx.state === 'suspended'){ await ctx.resume(); }
        const buffer = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start(0);
        audioUnlocked = true;
        applyVolume();
        ['pointerdown','keydown','touchstart','click'].forEach(ev=>document.removeEventListener(ev, unlock));
        // Also bind to control buttons in case user interacts there first
        [startBtn,pauseBtn,resetBtn,skipBtn,muteBtn].forEach(b=>b?.removeEventListener('click', unlock));
      }catch{}
    };
    ['pointerdown','keydown','touchstart','click'].forEach(ev=>document.addEventListener(ev, unlock, { once:false }));
    [startBtn,pauseBtn,resetBtn,skipBtn,muteBtn].forEach(b=>b?.addEventListener('click', unlock, { once:false }));
  }

  // ---------- Stats ----------
  function incrementStats(workMinutes){
    const today = new Date().toISOString().slice(0,10);
    stats.sessions.push({ day: today, mins: workMinutes });
    stats.total += 1;
    stats.focusMinutes += workMinutes;
    // streak
    if(stats.lastDay){
      const prev = new Date(stats.lastDay);
      const cur = new Date(today);
      const diff = Math.round((cur - prev)/86400000);
      stats.streak = diff === 1 ? (stats.streak+1) : (diff === 0 ? stats.streak : 1);
    } else { stats.streak = 1; }
    stats.lastDay = today;
    storage.set('stats', stats);
    updateStatsUI();
  }
  function updateStatsUI(){
    const today = new Date().toISOString().slice(0,10);
    const weekAgo = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
    const dayCount = stats.sessions.filter(s=>s.day===today).length;
    const weekCount = stats.sessions.filter(s=>s.day>=weekAgo).length;
    const monthCount = stats.sessions.filter(s=>s.day>=monthStart).length;
    statToday.textContent = String(dayCount);
    statWeek.textContent = String(weekCount);
    statMonth.textContent = String(monthCount);
    statTotal.textContent = String(stats.total||0);
    const hours = (stats.focusMinutes||0)/60; statFocus.textContent = `${hours.toFixed(1)}h`;
    statStreak.textContent = `${stats.streak||0}🔥`;
  }

  // ---------- Notifications ----------
  function notifyPhaseChange(){
    if(!settings.notifications) return;
    if(Notification && Notification.permission === 'granted'){
      const title = mode === MODES.WORK ? 'Focus time' : 'Break time';
      const body = mode === MODES.WORK ? 'Let\'s get to work!' : 'Relax a bit.';
      new Notification(title, { body });
    } else if(Notification && Notification.permission !== 'denied'){
      Notification.requestPermission();
    }
  }

  // ---------- Utilities ----------
  function minutesToMs(m){ return m*60*1000; }
  function minutesFromMs(ms){ return Math.round(ms/60000); }
  function getModeDuration(m){ return m===MODES.WORK?minutesToMs(settings.work):m===MODES.SHORT?minutesToMs(settings.short):minutesToMs(settings.long); }
  function formatTime(ms){ const t=Math.max(0,Math.round(ms/1000)); const mm=String(Math.floor(t/60)).padStart(2,'0'); const ss=String(t%60).padStart(2,'0'); return `${mm}:${ss}`; }
  function clamp(n,min,max){ return Math.min(max, Math.max(min, n)); }
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function isInputFocused(){ const el=document.activeElement; return el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.isContentEditable); }
  function setupA11y(){
    document.body.addEventListener('keydown',(e)=>{ if(e.key==='Escape' && settingsDialog.open) settingsDialog.close(); });
  }

})();


