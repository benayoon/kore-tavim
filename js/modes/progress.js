'use strict';
/* הפרופיל שלי: מה קורא טוב, מה צריך שיפור, ואיך זה משתנה לאורך זמן */
const ProgressMode = (() => {
  let root, tip;
  const MODE_NAMES = { path: 'אימון יומי', sight: 'קריאה מהדף', quiz: 'זיהוי תווים', rhythm: 'קצב', chords: 'אקורדים' };
  const CLEF_NAMES = { treble: 'סול', bass: 'פה', alto: 'דו אלט', tenor: 'דו טנור', percussion: '' };
  const LINES = { treble: [38, 30], bass: [26, 18], alto: [32, 24], tenor: [30, 22] };
  const STATUS = {
    new: { label: 'חדש', cls: 's-new' }, weak: { label: 'לחזק', cls: 's-weak' }, learning: { label: 'בלמידה', cls: 's-learning' },
    solid: { label: 'יציב', cls: 's-solid' }, mastered: { label: 'שולט', cls: 's-mastered' },
  };

  function init(view) {
    root = h('div', { class: 'progress' });
    tip = h('div', { class: 'chart-tip', hidden: true });
    view.append(root);
    document.body.append(tip);
  }
  function showTip(e, text) {
    tip.textContent = text; tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, e.clientX - tip.offsetWidth / 2));
    tip.style.left = x + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 12) + 'px';
  }
  const hideTip = () => { tip.hidden = true; };
  const hover = (el, text) => {
    el.addEventListener('pointermove', e => showTip(e, text));
    el.addEventListener('pointerleave', hideTip);
    return el;
  };

  // ---- תובנות ----
  function insights() {
    const it = Store.stats.items, out = [], n = App.prefs.naming;
    const notes = Object.entries(it.notes).map(([id, r]) => { const [clef, step] = id.split(':'); return { clef, step: +step, ...r }; }).filter(x => LINES[x.clef]);
    const seen = notes.filter(x => x.a >= 5);
    const avg = list => { const a = list.reduce((s, x) => s + x.a, 0); return a ? list.reduce((s, x) => s + x.c, 0) / a : null; };
    const weak = seen.filter(x => x.ema < 0.7).sort((a, b) => a.ema - b.ema).slice(0, 3);
    if (weak.length) out.push(['bad', 'תווים לחיזוק', weak.map(x => `${Theory.pitchName({ step: x.step, alter: 0 }, n, true)} (${CLEF_NAMES[x.clef]})`).join(', ')]);
    const ledger = seen.filter(x => x.step > LINES[x.clef][0] || x.step < LINES[x.clef][1]);
    const inside = seen.filter(x => !ledger.includes(x));
    const la = avg(ledger), ia = avg(inside);
    if (la != null && ia != null && ia - la >= 0.1) out.push(['warn', 'קווי עזר', `${UI.pct(la)} בקווי עזר מול ${UI.pct(ia)} בתוך החמשה.`]);
    const clefs = [...new Set(seen.map(x => x.clef))];
    if (clefs.length > 1) {
      const c = clefs.map(k => [k, avg(seen.filter(x => x.clef === k))]).sort((a, b) => a[1] - b[1]);
      if (c[c.length - 1][1] - c[0][1] >= 0.1) out.push(['warn', 'פער בין מפתחות', `מפתח ${CLEF_NAMES[c[0][0]]}: ${UI.pct(c[0][1])}. מפתח ${CLEF_NAMES[c[c.length - 1][0]]}: ${UI.pct(c[c.length - 1][1])}.`]);
    }
    const slow = seen.filter(x => x.ema >= 0.8 && x.rt > 3000).sort((a, b) => b.rt - a.rt).slice(0, 3);
    if (slow.length) out.push(['warn', 'נכון אבל לאט', `${slow.map(x => Theory.pitchName({ step: x.step, alter: 0 }, n, true)).join(', ')}: מעל 3 שניות לתו.`]);
    const rhythm = Object.entries(it.rhythms).filter(([, r]) => r.a >= 3 && r.ema < 0.7).sort((a, b) => a[1].ema - b[1].ema).slice(0, 3);
    if (rhythm.length) out.push(['bad', 'מקצבים לשיפור', rhythm.map(([id]) => Cells.label(id)).join(', ')]);
    const t = Store.stats.timing;
    if (t.n >= 20) {
      const ms = Math.round(t.sum / t.n * 1000);
      if (Math.abs(ms) >= 25) out.push(['warn', 'נטיית קצב', `בממוצע ${Math.abs(ms)}ms ${ms > 0 ? 'אחרי הפעמה' : 'לפני הפעמה'}.${ms > 0 ? ' אם זה קבוע, אולי זו השהיית ציוד: אפשר לכייל בהעדפות.' : ''}`]);
    }
    const keys = Object.entries(it.keys).filter(([, r]) => r.a >= 5 && r.ema < 0.7);
    if (keys.length) out.push(['warn', 'סימני היתק', `קשה ב: ${keys.map(([f]) => Theory.keyName(+f, 'major', n)).join(', ')}.`]);
    const strong = notes.filter(x => Store.mastery(x) === 'mastered').length + Object.values(it.rhythms).filter(r => Store.mastery(r) === 'mastered').length;
    if (strong) out.push(['ok', 'נקודות חוזק', `${strong} תווים ומקצבים ברמת שליטה, שהחזיקו לאורך כמה ימים.`]);
    return out;
  }

  // ---- גרף מגמה שבועי: סדרה אחת לכל גרף ----
  function weeks(cats, count = 8) {
    const out = [];
    for (let w = count - 1; w >= 0; w--) {
      let a = 0, c = 0;
      for (let d = 0; d < 7; d++) {
        const t = Store.stats.trend[Store.today(w * 7 + d)];
        if (!t) continue;
        cats.forEach(k => { if (t[k]) { a += t[k].a; c += t[k].c; } });
      }
      out.push({ w, a, c, v: a ? c / a : null, label: w === 0 ? 'השבוע' : `לפני ${w} שב׳` });
    }
    return out;
  }
  // הזמן בגרפים זורם משמאל לימין, גם בממשק בעברית. הכיתוב מבהיר את זה.
  const timeAxis = (old, now) => h('div', { class: 'time-axis' }, h('span', {}, old), h('span', {}, now));
  let trendId = 0;
  function trendChart(title, cats) {
    const data = weeks(cats);
    const W = 260, H = 96, P = 8, X = i => P + i * (W - 2 * P) / (data.length - 1), Y = v => H - 8 - v * (H - 20);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    const last = [...data].reverse().find(d => d.v != null);
    svg.setAttribute('aria-label', `${title}: ${last ? UI.pct(last.v) + ' דיוק בשבוע האחרון עם נתונים' : 'אין נתונים'}`);
    const add = (tag, attrs, parent = svg) => { const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); parent.append(e); return e; };
    [0, 0.5, 1].forEach(v => add('line', { x1: P, x2: W - P, y1: Y(v), y2: Y(v), class: 'tr-grid' }));
    const pts = data.map((d, i) => (d.v == null ? null : [X(i), Y(d.v)])).filter(Boolean);
    if (pts.length > 1) {
      const gid = 'ta' + (trendId++);
      const grad = add('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, add('defs', {}));
      add('stop', { offset: 0, class: 'tr-stop-a' }, grad);
      add('stop', { offset: 1, class: 'tr-stop-b' }, grad);
      const flat = H - 8;
      add('polygon', { points: `${pts[0][0]},${flat} ${pts.map(q => q.join(',')).join(' ')} ${pts[pts.length - 1][0]},${flat}`, fill: `url(#${gid})` });
    }
    if (pts.length > 1) add('polyline', { points: pts.map(p => p.join(',')).join(' '), class: 'tr-line' });
    data.forEach((d, i) => {
      if (d.v == null) return;
      add('circle', { cx: X(i), cy: Y(d.v), r: 4, class: 'tr-dot' });
      const hit = add('circle', { cx: X(i), cy: Y(d.v), r: 14, fill: 'transparent' });
      hover(hit, `${d.label}: ${UI.pct(d.v)} (${d.a} ניסיונות)`);
    });
    return h('div', { class: 'trend' }, h('div', { class: 'trend-head' }, h('b', {}, title), h('span', {}, last ? `${UI.pct(last.v)} נכון` : 'אין נתונים')), svg, timeAxis('לפני 8 שבועות', 'השבוע'));
  }

  // ---- מפת תווים ----
  function noteMap() {
    const groups = {};
    Object.entries(Store.stats.items.notes).forEach(([id, r]) => { const [c, s] = id.split(':'); if (LINES[c]) (groups[c] = groups[c] || []).push({ step: +s, r }); });
    const p = Store.active(), inst = p ? Curriculum.INSTRUMENTS[p.instrument] : null;
    const st = p ? Curriculum.load(p) : null;
    if (inst) inst.clefs.forEach(c => { if (!groups[c]) groups[c] = []; });
    const keys = Object.keys(groups);
    if (!keys.length) return [empty('עוד אין נתונים. אחרי תרגול זיהוי תווים תופיע כאן מפה של כל תו.')];
    return keys.map(c => {
      const list = groups[c];
      let lo = Math.min(...list.map(x => x.step), Infinity), hi = Math.max(...list.map(x => x.step), -Infinity);
      if (st && st.pitch[c] != null) { const r = Curriculum.rangeAt(c, st.pitch[c]); lo = Math.min(lo, r.lo); hi = Math.max(hi, r.hi); }
      const by = new Map(list.map(x => [x.step, x.r]));
      const tiles = [];
      for (let s = lo; s <= hi; s++) {
        const r = by.get(s), m = STATUS[Store.mastery(r)];
        const name = Theory.pitchName({ step: s, alter: 0 }, App.prefs.naming, true);
        const el = h('div', { class: 'note-tile ' + m.cls }, h('b', {}, name), h('small', {}, r && r.a ? `${UI.pct(r.c / r.a)} נכון` : 'עוד לא תורגל'), r && r.a ? h('small', {}, `${r.a} ניסיונות`) : null, h('i', {}, m.label));
        hover(el, r && r.a ? `${name}: ${r.c}/${r.a} נכון · ${(r.rt / 1000 || 0).toFixed(1)} שנ׳ לתו` : `${name}: עוד לא תורגל`);
        tiles.push(el);
      }
      const counts = {};
      for (let s = lo; s <= hi; s++) { const k = Store.mastery(by.get(s)); counts[k] = (counts[k] || 0) + 1; }
      const parts = ['mastered', 'solid', 'learning', 'weak', 'new'].filter(k => counts[k]).map(k => `${counts[k]} ${STATUS[k].label}`);
      return h('div', {}, h('h4', {}, `מפתח ${CLEF_NAMES[c]}: ${hi - lo + 1} תווים`), h('p', { class: 'map-summary' }, parts.join(' · ')), h('div', { class: 'note-map' }, tiles));
    });
  }

  // ---- מקצבים: כל תא מצויר בתווים ----
  function rhythmGrid() {
    const list = Object.entries(Store.stats.items.rhythms).sort((a, b) => a[1].ema - b[1].ema);
    if (!list.length) return [empty('עוד אין נתונים. אחרי תרגול קצב יופיע כאן כל מקצב, מהחלש לחזק.')];
    const cards = list.map(([id, r]) => {
      const m = STATUS[Store.mastery(r)];
      const staff = h('div', { class: 'cell-card' });
      setTimeout(() => { try { Cells.drawOne(staff, id); } catch (e) { staff.textContent = Cells.label(id); } }, 0);
      const dev = r.devN ? Math.round(r.dev / r.devN * 1000) : null;
      return h('div', { class: 'rhythm-card ' + m.cls }, staff,
        h('b', {}, Cells.label(id)),
        h('div', { class: 'meter' }, h('i', { style: `width:${r.a ? r.c / r.a * 100 : 0}%` })),
        h('small', {}, `${r.c} נכונים מתוך ${r.a} ניסיונות (${UI.pct(r.a ? r.c / r.a : 0)})${dev != null && Math.abs(dev) >= 15 ? ` · ${Math.abs(dev)}ms ${dev > 0 ? 'מאחרים' : 'מקדימים'}` : ''}`),
        h('i', { class: 'status-chip' }, m.label));
    });
    return [h('div', { class: 'rhythm-grid' }, cards)];
  }
  const empty = t => h('p', { class: 'empty' }, t);
  const section = (title, ...body) => h('section', { class: 'panel' }, h('h3', {}, title), ...body);

  function render() {
    hideTip();
    const stats = Store.stats, it = stats.items, p = Store.active();
    root.innerHTML = '';
    const inst = p ? Curriculum.INSTRUMENTS[p.instrument] : null;
    root.append(h('div', { class: 'profile-head' },
      h('span', { class: 'avatar big' }, h('span', {}, p ? p.avatar : '🎵')),
      h('div', {}, h('h1', {}, p ? p.name : 'אורח'), h('p', {}, `${inst ? inst.name + ' · ' : ''}${p ? Curriculum.INPUTS[p.input].name : ''}`)),
      UI.btn('החלפת נגן', () => Profiles.manager(), 'ghost')));

    const mins = Math.round(stats.totals.seconds / 60);
    root.append(h('div', { class: 'cards' },
      card(Store.streak(), 'ימים ברצף'), card(stats.days.length, 'ימי אימון'),
      card(stats.totals.bars, 'תיבות שנקראו'), card(mins, 'דקות באימון היומי')));

    const ins = insights();
    root.append(section('מה רואים בנתונים', ins.length
      ? h('ul', { class: 'insights' }, ins.map(([k, t, b]) => h('li', { class: 'ins-' + k }, h('b', {}, t), h('span', {}, b))))
      : empty('אחרי כמה אימונים יופיעו כאן תובנות על נקודות החוזק והתורפה.')));

    root.append(section('מגמה ב־8 השבועות האחרונים',
      h('div', { class: 'trends' }, trendChart('תווים', ['notes']), trendChart('קצב', ['rhythms']), trendChart('קריאה', ['read']), trendChart('אקורדים ושמיעה', ['chords', 'ear', 'patterns'])),
      h('details', { class: 'table-view' }, h('summary', {}, 'הצגה כטבלה'),
        h('table', { class: 'hist' }, h('tr', {}, ['שבוע', 'תווים', 'קצב', 'קריאה', 'אקורדים ושמיעה'].map(x => h('th', {}, x))),
          weeks(['notes']).map((_, i) => {
            const v = cats => { const d = weeks(cats)[i]; return d.v == null ? '–' : `${UI.pct(d.v)} (${d.a})`; };
            return h('tr', {}, h('td', {}, weeks(['notes'])[i].label), h('td', {}, v(['notes'])), h('td', {}, v(['rhythms'])), h('td', {}, v(['read'])), h('td', {}, v(['chords', 'ear', 'patterns'])));
          })))));

    const days = [];
    for (let i = 27; i >= 0; i--) days.push([Store.today(i), stats.daily[Store.today(i)] || 0]);
    const max = Math.max(1, ...days.map(d => d[1]));
    root.append(section('פעילות ב־28 הימים האחרונים', h('div', { class: 'bars' }, days.map(([d, n]) =>
      hover(h('div', { class: 'bar-col' }, h('div', { class: 'bar' + (n ? '' : ' zero'), style: `height:${Math.max(3, n / max * 100)}%` })), `${d.split('-').reverse().join('.')}: ${n} ניסיונות`))), timeAxis('לפני 4 שבועות', 'היום')));

    const statusKey = h('div', { class: 'status-key' }, [['weak', 'פחות מ־60% לאחרונה'], ['learning', 'בתהליך'], ['solid', 'החזיק לפחות יום אחד'], ['mastered', 'החזיק לאורך כמה ימים'], ['new', 'פחות מ־3 ניסיונות']]
      .map(([k, d]) => h('span', { class: STATUS[k].cls }, h('i', {}, STATUS[k].label), ` ${d}`)));
    root.append(section('מפת התווים', h('p', { class: 'section-help' }, 'כל משבצת היא תו. האחוז הוא כמה פעמים קראתם אותו נכון. התווים מסודרים כמו בפסנתר: הנמוך משמאל, הגבוה מימין.'), statusKey, ...noteMap()));
    root.append(section('מקצבים, מהחלש לחזק', h('p', { class: 'section-help' }, 'רק מקצבים שכבר תרגלתם. ניסיון הוא כל פעם שהמקצב הופיע בתרגיל.'), ...rhythmGrid()));

    const keyList = Object.entries(it.keys);
    if (keyList.length) {
      root.append(section('סימני היתק', h('div', { class: 'note-map' }, keyList.sort((a, b) => +a[0] - +b[0]).map(([f, r]) => {
        const m = STATUS[Store.mastery(r)];
        return h('div', { class: 'note-tile ' + m.cls }, h('b', {}, Theory.keyShort(+f, App.prefs.naming)), h('small', {}, `${UI.pct(r.c / r.a)} נכון`), h('small', {}, `${r.a} ניסיונות`), h('i', {}, m.label));
      }))));
    }
    const ch = Object.entries(it.chords);
    if (ch.length) {
      root.append(section('אקורדים', h('div', { class: 'mode-rows' }, ch.map(([q, r]) => h('div', { class: 'mode-row' },
        h('span', {}, Theory.QUALITIES[q] ? Theory.QUALITIES[q].name : q), h('div', { class: 'meter' }, h('i', { style: `width:${r.c / r.a * 100}%` })), h('b', {}, `${r.c} מתוך ${r.a} נכון`))))));
    }

    const last = stats.history.slice(-12).reverse();
    root.append(section('תרגילים אחרונים', last.length ? h('table', { class: 'hist' },
      h('tr', {}, h('th', {}, 'תאריך'), h('th', {}, 'מה'), h('th', {}, 'תוצאה')),
      last.map(e => h('tr', {}, h('td', {}, e.d.split('-').reverse().join('.')), h('td', {}, (MODE_NAMES[e.m] || e.m) + (e.kind === 'perform' ? ' (ביצוע)' : e.kind === 'wait' ? ' (המתנה)' : '')), h('td', {}, h('b', {}, UI.pct(e.score))))))
      : empty('עדיין אין תרגילים שמורים.')));

    root.append(h('div', { class: 'reset-row' }, UI.btn('איפוס הנתונים של הנגן', async () => {
      if (await UI.confirmAlert('לאפס את הנתונים?', 'כל ההתקדמות של הנגן הזה תימחק. אי אפשר לבטל.', 'איפוס')) { Store.reset(); render(); UI.toast('הנתונים אופסו'); }
    }, 'ghost danger')));
  }
  const card = (v, l) => h('div', { class: 'stat-card' }, h('b', {}, v), h('small', {}, l));

  return { init, enter() { App.dock(false); render(); }, leave() { hideTip(); App.dock(null); }, onResize() {}, onPrefs: render };
})();
