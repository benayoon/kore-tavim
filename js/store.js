'use strict';
/* שמירה ב־localStorage: פרופילים של נגנים, הגדרות, וסטטיסטיקה לכל פריט שנלמד */
const Store = (() => {
  const P = 'kore-tavim:';
  const LEGACY_KEYS = ['stats', 'sight', 'quiz', 'rhythm', 'chords', 'prefs'];
  const raw = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* מצב פרטי */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* מצב פרטי */ } },
    keys() { try { return Object.keys(localStorage); } catch (e) { return []; } },
  };
  const parse = (s, d) => { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } };

  let activeId = raw.get(P + 'active');
  const nsKey = (id, k) => `${P}p:${id}:${k}`;
  const key = k => (activeId ? nsKey(activeId, k) : P + 'guest:' + k);

  function load(k, def) {
    const v = parse(raw.get(key(k)), null);
    return v ? Object.assign(structuredClone(def), v) : structuredClone(def);
  }
  const save = (k, v) => raw.set(key(k), JSON.stringify(v));

  // ---- פרופילים ----
  const profiles = () => parse(raw.get(P + 'profiles'), []);
  const saveProfiles = list => raw.set(P + 'profiles', JSON.stringify(list));
  const active = () => profiles().find(p => p.id === activeId) || null;

  function createProfile(data) {
    const id = 'n' + Date.now().toString(36);
    const list = profiles();
    // הנגן הראשון יורש נתונים מגרסאות קודמות של האפליקציה
    if (!list.length) {
      LEGACY_KEYS.forEach(k => {
        const v = raw.get(P + k);
        if (v != null) { raw.set(nsKey(id, k), v); raw.del(P + k); }
      });
    }
    list.push({ id, createdAt: Date.now(), ...data });
    saveProfiles(list);
    raw.set(P + 'active', id);
    activeId = id;
    return id;
  }
  function updateProfile(patch) {
    saveProfiles(profiles().map(p => (p.id === activeId ? { ...p, ...patch } : p)));
  }
  function setActive(id) { raw.set(P + 'active', id); activeId = id; }
  function deleteProfile(id) {
    raw.keys().filter(k => k.startsWith(`${P}p:${id}:`)).forEach(raw.del);
    const list = profiles().filter(p => p.id !== id);
    saveProfiles(list);
    if (activeId === id) {
      activeId = list.length ? list[0].id : null;
      if (activeId) raw.set(P + 'active', activeId); else raw.del(P + 'active');
    }
  }
  function exportProfile() {
    const prefix = `${P}p:${activeId}:`, data = {};
    raw.keys().filter(k => k.startsWith(prefix)).forEach(k => { data[k.slice(prefix.length)] = parse(raw.get(k), null); });
    return { app: 'kore-tavim', version: 1, profile: active(), data };
  }
  // ייבוא תמיד יוצר נגן חדש, כך שאי אפשר לדרוס נתונים קיימים
  function importProfile(obj) {
    if (!obj || obj.app !== 'kore-tavim' || !obj.profile || !obj.data) throw new Error('bad file');
    const { id: _old, ...rest } = obj.profile;
    const id = 'n' + Date.now().toString(36);
    saveProfiles([...profiles(), { ...rest, id }]);
    Object.entries(obj.data).forEach(([k, v]) => raw.set(nsKey(id, k), JSON.stringify(v)));
    setActive(id);
    return id;
  }

  // ---- סטטיסטיקה ----
  const CATS = ['notes', 'rhythms', 'chords', 'keys', 'acc', 'patterns', 'ear', 'read'];
  const DEF_STATS = { items: {}, history: [], days: [], daily: {}, trend: {}, totals: { bars: 0, seconds: 0 }, timing: { n: 0, sum: 0 } };
  function loadStats() {
    const s = load('stats', DEF_STATS);
    CATS.forEach(c => { if (!s.items[c]) s.items[c] = {}; });
    // גרסאות קודמות שמרו תווים ואקורדים בשורש
    ['notes', 'chords'].forEach(c => {
      if (s[c]) {
        Object.entries(s[c]).forEach(([id, r]) => {
          s.items[c][id] = { ema: r.a ? r.c / r.a : 0, rt: r.a && r.t ? r.t / r.a : 0, box: 0, due: 0, day: null, dev: 0, devN: 0, t: 0, ...r };
        });
        delete s[c];
      }
    });
    return s;
  }
  let stats = loadStats();
  // הסטטיסטיקה שייכת לנגן שבשבילו נטענה. שמירה בזמן מעבר נגן לא תדרוס את הנתונים של הנגן החדש,
  // ושמירה אחרי מחיקה לא תחזיר נגן שנמחק.
  const statsOwner = activeId;
  function writeStats() {
    if (!statsOwner || !profiles().some(p => p.id === statsOwner)) return;
    raw.set(nsKey(statsOwner, 'stats'), JSON.stringify(stats));
  }
  let timer = 0;
  const saveSoon = () => { clearTimeout(timer); timer = setTimeout(writeStats, 400); };
  const flush = () => { clearTimeout(timer); writeStats(); };
  window.addEventListener('pagehide', flush);

  function today(offset = 0) {
    const d = new Date(Date.now() - offset * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const dayNum = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5); };

  function touch(cat, ok) {
    const t = today();
    if (!stats.days.includes(t)) stats.days.push(t);
    stats.daily[t] = (stats.daily[t] || 0) + 1;
    const tr = stats.trend[t] || (stats.trend[t] = {});
    const c = tr[cat] || (tr[cat] = { a: 0, c: 0 });
    c.a++; if (ok) c.c++;
  }

  // חזרה מרווחת: דרגה עולה לכל היותר פעם ביום, כדי שהשליטה תוכח לאורך ימים ולא בישיבה אחת
  const INTERVALS = [0, 1, 3, 7, 16, 35];
  function record(cat, id, ok, ms = 0, opts = {}) {
    const items = stats.items[cat];
    const r = items[id] || (items[id] = { a: 0, c: 0, t: 0, ema: 0, rt: 0, box: 0, due: 0, day: null, dev: 0, devN: 0 });
    r.a++; if (ok) r.c++;
    r.ema = r.a === 1 ? (ok ? 1 : 0) : r.ema * 0.8 + (ok ? 0.2 : 0);
    if (ms) { const m = Math.min(ms, 15000); r.t += m; r.rt = r.rt ? r.rt * 0.8 + m * 0.2 : m; }
    if (opts.dev != null) { r.dev += opts.dev; r.devN++; stats.timing.sum += opts.dev; stats.timing.n++; }
    const d = dayNum();
    if (!ok) { r.box = Math.max(0, r.box - 1); r.due = d; }
    else if (r.day !== d && r.ema >= 0.7) {
      r.box = Math.min(5, r.box + 1); r.due = d + INTERVALS[r.box]; r.day = d;
    }
    touch(cat, ok);
    saveSoon();
    return r;
  }
  const item = (cat, id) => stats.items[cat][id] || null;
  function mastery(r) {
    if (!r || r.a < 3) return 'new';
    if (r.ema < 0.6) return 'weak';
    if (r.box >= 3 && r.ema >= 0.85) return 'mastered';
    if (r.box >= 1 && r.ema >= 0.75) return 'solid';
    return 'learning';
  }
  const isDue = r => !!r && r.a > 0 && r.due <= dayNum();
  const dueCount = cat => Object.values(stats.items[cat]).filter(isDue).length;
  // עומד לחזרה ב־N הימים הקרובים
  const dueWithin = n => CATS.reduce((a, c) => a + Object.values(stats.items[c]).filter(r => r.a > 0 && r.due <= dayNum() + n).length, 0);

  const noteResult = (id, ok, ms) => record('notes', id, ok, ms);
  const chordResult = (q, ok) => record('chords', q, ok);
  function session(mode, data) {
    stats.history.push({ d: today(), m: mode, ts: Date.now(), ...data });
    if (stats.history.length > 800) stats.history.splice(0, stats.history.length - 800);
    const t = today();
    if (!stats.days.includes(t)) stats.days.push(t);
    flush();
  }
  function addBars(n) { stats.totals.bars += n; saveSoon(); }
  function addSeconds(n) { stats.totals.seconds += n; saveSoon(); }
  function streak() {
    const set = new Set(stats.days);
    let n = 0, off = set.has(today()) ? 0 : 1;
    while (set.has(today(off))) { n++; off++; }
    return n;
  }
  function reset() { stats = loadStatsEmpty(); flush(); }
  const loadStatsEmpty = () => { const s = structuredClone(DEF_STATS); CATS.forEach(c => { s.items[c] = {}; }); return s; };

  return {
    load, save, flush, profiles, active, createProfile, updateProfile, setActive, deleteProfile, exportProfile, importProfile,
    record, item, mastery, isDue, dueCount, dueWithin, noteResult, chordResult, session, addBars, addSeconds, streak, today, dayNum, reset,
    get stats() { return stats; },
  };
})();
