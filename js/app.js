'use strict';
/* ניתוב בין מצבים, העדפות וחיבור הקלט */
const App = (() => {
  const prefs = Store.load('prefs', { naming: 'solfege', volume: 0.8, midiSound: false, latency: 0, piano: true, theme: 'auto', lastFree: 'sight' });
  const modes = { path: PathMode, sight: SightMode, quiz: QuizMode, rhythm: RhythmMode, chords: ChordMode, progress: ProgressMode };
  const inited = new Set();
  const FREE = ['sight', 'quiz', 'rhythm', 'chords'];
  let current = null, curName = null;

  const api = {
    prefs, inputSound: true,
    show,
    // הצגה זמנית של המקלדת בלי לשנות את העדפת הנגן; null מחזיר להעדפה
    dock(on) { applyDock(on == null ? prefs.piano && !isPhone() : on); },
    isPhone,
    savePrefs() { Store.save('prefs', prefs); },
  };

  // בטלפון המקלדת מסתירה את התווים, ולכן היא מופיעה רק כשמנגנים בה
  function isPhone() { return window.innerWidth <= 760; }

  function show(name) {
    if (!modes[name]) name = 'path';
    if (curName === name) return;
    if (current) current.leave();
    document.querySelectorAll('[data-mode]').forEach(b => {
      const on = b.dataset.mode === name;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    const free = FREE.includes(name);
    if (free && prefs.lastFree !== name) { prefs.lastFree = name; api.savePrefs(); }
    document.querySelector('[data-practice]').classList.toggle('on', free);
    const seg = document.getElementById('practice-seg');
    seg.hidden = !free;
    if (free) seg.querySelector('.seg-thumb').style.setProperty('--i', FREE.indexOf(name));
    document.querySelector('.tab-thumb').style.setProperty('--i', name === 'path' ? 0 : free ? 1 : 2);
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'view-' + name));
    curName = name;
    current = modes[name];
    if (!inited.has(name)) { current.init(document.getElementById('view-' + name)); inited.add(name); }
    current.enter();
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
    window.scrollTo({ top: 0 });
  }

  function applyDock(on) {
    const dock = document.getElementById('piano-dock');
    dock.classList.toggle('hidden', !on);
    document.getElementById('btn-piano').classList.toggle('on', on);
    document.body.style.setProperty('--dock-h', on ? dock.offsetHeight + 'px' : '0px');
  }
  function setPiano(on) {
    prefs.piano = on;
    applyDock(on);
    api.savePrefs();
  }

  function applyTheme() {
    if (prefs.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = prefs.theme;
  }
  function bindPrefs() {
    const dlg = document.getElementById('prefs-dlg');
    const theme = document.getElementById('pref-theme');
    const naming = document.getElementById('pref-naming'), vol = document.getElementById('pref-volume');
    const ms = document.getElementById('pref-midisound'), lat = document.getElementById('pref-latency');
    document.getElementById('btn-prefs').onclick = () => {
      theme.value = prefs.theme; naming.value = prefs.naming; vol.value = prefs.volume; ms.checked = prefs.midiSound; lat.value = prefs.latency;
      dlg.showModal();
    };
    theme.onchange = () => { prefs.theme = theme.value; applyTheme(); api.savePrefs(); };
    naming.onchange = () => {
      prefs.naming = naming.value; api.savePrefs(); Piano.relabel();
      inited.forEach(n => modes[n].onPrefs && modes[n].onPrefs());
    };
    vol.oninput = () => { prefs.volume = +vol.value; AudioEng.setVolume(prefs.volume); api.savePrefs(); };
    ms.onchange = () => { prefs.midiSound = ms.checked; api.savePrefs(); };
    lat.onchange = () => { prefs.latency = Math.max(-300, Math.min(300, +lat.value || 0)); api.savePrefs(); };
  }

  // כותרת קומפקטית: הכותרת הגדולה נעלמת בגלילה ועוברת לקפסולה למעלה
  function bindCompactTitle() {
    const pill = document.getElementById('compact-title');
    let tick = false;
    const update = () => {
      tick = false;
      const big = document.querySelector('.view.on h1');
      const show = !!big && big.getBoundingClientRect().bottom < 8;
      if (show) pill.textContent = big.textContent;
      pill.classList.toggle('on', show);
    };
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  }

  // ---- התקנה בטלפון ----
  function setupInstall() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    // בהתקנה הראשונה אין מה לרענן: רק גרסה שמחליפה גרסה קודמת צריכה טעינה מחדש
    let reloading = !navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then(reg => {
      // גרסה חדשה שהורדה בפעם הקודמת נכנסת בפתיחה, לפני שמתחילים לתרגל
      if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('skipWaiting');
      // אפליקציה שנשארת פתוחה ברקע בודקת עדכון כשחוזרים אליה
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => { /* בפיתוח אין sw.js */ });
    // בקשה מהדפדפן לא למחוק את הנתונים כשחסר מקום
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  // בטלפון המסך לא נכבה באמצע קריאה
  function setupWakeLock() {
    if (!('wakeLock' in navigator)) return;
    let lock = null;
    const grab = async () => {
      if (lock || !isPhone() || document.hidden) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch (e) { /* לא נתמך במצב הזה */ }
    };
    window.addEventListener('pointerdown', grab);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) grab(); });
  }

  function bindPlayerChip() {
    const chip = document.getElementById('player-chip'), me = Store.active();
    chip.innerHTML = '';
    chip.append(h('span', { class: 'avatar' }, me ? me.avatar : '🎵'), h('span', { class: 'chip-name' }, me ? me.name : 'נגן חדש'));
    chip.onclick = () => (me ? Profiles.manager() : null);
  }

  function boot() {
    if (!window.Vex || !Vex.Flow) {
      document.getElementById('views').innerHTML = '<div class="panel load-error"><h2>לא ניתן לטעון את ספריית התווים</h2><p>הקובץ vendor/vexflow.js חסר או לא נטען. רעננו את הדף, ואם זה חוזר, העלו מחדש את כל הקבצים.</p></div>';
      return;
    }
    applyTheme();
    setupInstall();
    setupWakeLock();
    document.querySelectorAll('[data-glyph]').forEach(el => { el.innerHTML = UI.glyph(el.dataset.glyph); });
    bindPlayerChip();
    // אין עדיין נגן: קודם יוצרים פרופיל
    if (!Store.active()) { Profiles.openWizard(); return; }
    AudioEng.setVolume(prefs.volume);
    Piano.build(document.getElementById('piano'));
    Input.initMidi();
    Input.on(e => {
      if (e.type === 'on' && api.inputSound && (e.src === 'screen' || e.src === 'kb' || (e.src === 'midi' && prefs.midiSound))) AudioEng.piano(e.midi, AudioEng.now(), 0.9, 0.6);
      current && current.onInput && current.onInput(e);
    });
    document.addEventListener('keydown', e => {
      if (e.target && e.target.matches && e.target.matches('input, select, textarea')) return;
      if (document.querySelector('dialog[open], .menu, .inspector.open')) return;
      if (current && current.onKey && current.onKey(e)) e.preventDefault();
    });
    document.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => show(b.dataset.mode); });
    document.querySelector('[data-practice]').onclick = () => show(FREE.includes(curName) ? curName : prefs.lastFree);
    document.getElementById('btn-piano').onclick = () => setPiano(document.getElementById('piano-dock').classList.contains('hidden'));
    // הפעלת השמע בנגיעה הראשונה (מדיניות דפדפנים)
    const unlock = () => { AudioEng.ctx(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
    bindPrefs();
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => current && current.onResize && current.onResize(), 200); });
    bindCompactTitle();
    window.addEventListener('hashchange', () => show(location.hash.slice(1)));
    api.dock(null);
    show(location.hash.slice(1) || 'path');
    setTimeout(() => Piano.scrollTo(60), 50);
  }

  document.addEventListener('DOMContentLoaded', boot);
  return api;
})();
