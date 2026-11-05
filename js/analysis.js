'use strict';
/* תאים קצביים (יחידות הקצב שהנגן קורא כיחידה אחת) וחישוב תוצאות הקשה וביצוע */
const Cells = (() => {
  const EPS = 1e-4;
  const LABELS = {
    'w': 'שלם', 'h': 'חצי', 'h.': 'חצי מנוקד', 'q': 'רבע', 'rq': 'הפסק רבע', 'rh': 'הפסק חצי', 'rw': 'הפסק שלם', 'rh.': 'הפסק חצי מנוקד',
    '8,8': 'שתי שמיניות', 'q.,8': 'רבע מנוקד ושמינית', 'r8,8': 'שמינית אחרי הפעמה', '8,r8': 'שמינית ואז הפסק',
    '16,16,16,16': 'ארבע שש־עשריות', '8,16,16': 'שמינית ושתי שש־עשריות', '16,16,8': 'שתי שש־עשריות ושמינית',
    '8.,16': 'שמינית מנוקדת ושש־עשרית', '16,8.': 'שש־עשרית ושמינית מנוקדת', '16,8,16': 'שש־עשרית, שמינית, שש־עשרית',
    'trip,trip,trip': 'טריולה', '8,q,8': 'סינקופה',
    'c|q.': 'פעמה מורכבת: רבע מנוקד', 'c|h.': 'שתי פעמות מורכבות', 'c|8,8,8': 'שלוש שמיניות', 'c|q,8': 'רבע ושמינית', 'c|8,q': 'שמינית ורבע',
    'c|rq.': 'הפסק רבע מנוקד', 'c|8,16,16,8': 'שמינית, שתי שש־עשריות, שמינית', 'c|16,16,8,8': 'שתי שש־עשריות ושתי שמיניות',
  };
  const compound = id => id.startsWith('c|');
  const tokens = id => (compound(id) ? id.slice(2) : id).split(',');
  const parseToken = t => (t.startsWith('r') ? { key: t.slice(1), rest: true } : { key: t, rest: false });
  const tokenQ = key => (key === 'trip' ? 1 / 3 : Gen.DUR[key].q);
  const lengthOf = id => tokens(id).reduce((a, t) => a + tokenQ(parseToken(t).key), 0);
  const label = id => LABELS[id] || tokens(id).map(t => {
    const { key, rest } = parseToken(t);
    return (rest ? 'הפסק ' : '') + ({ w: 'שלם', h: 'חצי', 'h.': 'חצי מנוקד', q: 'רבע', 'q.': 'רבע מנוקד', 8: 'שמינית', '8.': 'שמינית מנוקדת', 16: 'שש־עשרית', trip: 'טריולה' }[key] || key);
  }).join(', ');

  // מחלק תיבה ליחידות המינימליות שמתחילות ונגמרות על פעמה
  function splitMeasure(evs, ti) {
    const out = [];
    let cur = [];
    const aligned = p => { const x = p / ti.group; return Math.abs(x - Math.round(x)) < EPS; };
    evs.forEach(ev => {
      if (ev.ghost) return;
      cur.push(ev);
      if (aligned(ev.pos + ev.q)) { out.push(cur); cur = []; }
    });
    if (cur.length) out.push(cur);
    return out;
  }
  function idOf(group, ti) {
    const body = group.map(e => (e.rest ? 'r' : '') + e.key).join(',');
    return (ti.compound ? 'c|' : '') + body;
  }
  // מסמן על כל אירוע לאיזה תא הוא שייך
  function annotate(piece) {
    piece.parts.forEach(p => p.measures.forEach(m => {
      splitMeasure(m, piece.ti).forEach((g, gi) => {
        const id = idOf(g, piece.ti);
        g.forEach(ev => { ev.cellId = id; ev.cellKey = `${ev.m}:${gi}:${p.hand || ''}`; ev.clef = p.clef; });
      });
    }));
    return piece;
  }
  // אירועים לציור תא בודד על חמשה
  function toEvents(id, m = 0, start = 0) {
    let pos = 0;
    return tokens(id).map((t, i) => {
      const { key, rest } = parseToken(t);
      const d = Gen.DUR[key], q = tokenQ(key);
      const ev = {
        key, code: d.code, dots: d.dots, q, pos, start: start + pos, m, rest,
        pitches: rest ? [] : [{ step: 34, alter: 0 }], triplet: key === 'trip', tripStart: key === 'trip' && i === 0,
      };
      pos += q;
      return ev;
    });
  }
  function drawOne(el, id) {
    const piece = {
      key: { fifths: 0, mode: 'major' }, time: { num: 4, den: 4 }, ti: { group: compound(id) ? 1.5 : 1, compound: compound(id), L: 4 },
      parts: [{ clef: 'percussion', measures: [toEvents(id)] }],
    };
    return Render.score(el, piece, { showTime: false, endBar: false, hideClef: true, width: 44 + tokens(id).length * 34, minMeasureW: 30 });
  }
  const keysOf = ids => [...new Set(ids.flatMap(id => tokens(id).map(t => parseToken(t).key)))];

  return { annotate, splitMeasure, idOf, toEvents, drawOne, label, lengthOf, tokens, parseToken, compound, keysOf };
})();

/* חישוב תוצאות: משותף למצבים החופשיים ולאימון */
const Scoring = (() => {
  const TOL = { strict: 0.045, normal: 0.075, loose: 0.11 };

  // מיקרופון: כלי של קול אחד, ולפי בחירת הנגן גם בלי תלות באוקטבה (שירה, גיטרה)
  const octaveFree = () => { const p = Store.active(); return !p || p.octaveFree !== false; };
  const same = (src, played, target) => played === target || (src === 'mic' && octaveFree() && Theory.mod(played - target, 12) === 0);
  function hit(on, e) {
    for (const m of on.midis) if (same(e.src, e.midi, m)) return m;
    return null;
  }

  // הקשות מול התווים. כותב סטטיסטיקה לכל תא קצבי.
  function taps(layout, tapList, opts = {}) {
    const lat = AudioEng.latency() + (App.prefs.latency || 0) / 1000;
    const tol = TOL[opts.tolerance || 'normal'];
    const notes = layout.onsets.map((o, i) => ({ o, i })).filter(x => x.o.midis.length);
    const res = [], statuses = {}, devs = [];
    let pts = 0;
    notes.forEach((x, k) => {
      const T = x.o.time + lat;
      const prevGap = k ? T - (notes[k - 1].o.time + lat) : 1;
      const nextGap = k < notes.length - 1 ? notes[k + 1].o.time + lat - T : 1;
      const win = Math.min(0.4, Math.max(0.08, Math.min(prevGap, nextGap) * 0.5));
      let best = null;
      tapList.forEach(tp => { if (!tp.used && Math.abs(tp.t - T) <= win && (!best || Math.abs(tp.t - T) < Math.abs(best.t - T))) best = tp; });
      let st = 'bad', d = null;
      if (best) {
        best.used = true; d = best.t - T; devs.push(d);
        st = Math.abs(d) <= tol ? 'ok' : Math.abs(d) <= tol * 2 ? 'warn' : 'bad';
        pts += st === 'ok' ? 1 : st === 'warn' ? 0.6 : 0.2;
      }
      statuses[x.i] = st;
      x.o.evs.forEach(ev => { ev._st = st; ev._dev = d; });
      res.push({ T, d, st, i: x.i });
    });
    const extras = tapList.filter(t => !t.used);
    const n = notes.length;
    const score = n ? Math.max(0, Math.min(1, pts / n - extras.length * 0.05)) : 0;
    const avg = devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : 0;
    const spread = devs.length ? Math.sqrt(devs.reduce((a, b) => a + (b - avg) ** 2, 0) / devs.length) : 0;
    const okN = res.filter(r => r.st === 'ok').length;
    return { res, statuses, extras, n, score, avg, spread, okN, missed: res.filter(r => r.d === null).length, lat };
  }

  // כותב תוצאה לכל תא קצבי לפי מצב התווים שבו
  function logCells(layout, skipHand) {
    const cells = new Map();
    layout.onsets.forEach(o => o.evs.forEach(ev => {
      if (!ev.cellId || ev.ghost) return;
      if (!cells.has(ev.cellKey)) cells.set(ev.cellKey, { id: ev.cellId, evs: [] });
      cells.get(ev.cellKey).evs.push(ev);
    }));
    const out = [];
    cells.forEach(c => {
      const played = c.evs.filter(e => !e.rest);
      if (!played.length) return;
      const ok = played.every(e => e._st === 'ok' || e._st === 'warn');
      const ds = played.map(e => e._dev).filter(d => d != null);
      const dev = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
      Store.record('rhythms', c.id, ok, 0, { dev });
      out.push({ id: c.id, ok });
    });
    return out;
  }

  // ביצוע בזמן אמת: צלילים מול התווים. לא עוצרים, ולכן מודדים גם רציפות.
  function perform(layout, rec, spq) {
    const lat = AudioEng.latency() + (App.prefs.latency || 0) / 1000;
    const usesMic = rec.some(r => r.src === 'mic');
    // לכלי אקוסטי יש התחלה הדרגתית, ולכן סף הדיוק במיקרופון רחב יותר
    const good = usesMic ? Math.max(0.13, Math.min(0.16, spq * 0.25)) : Math.min(0.09, spq * 0.2);
    const win = Math.min(0.35, Math.max(usesMic ? 0.2 : 0.15, spq * 0.45));
    let ok = 0, warn = 0, bad = 0, total = 0, devSum = 0, devN = 0, missRun = 0, stops = 0;
    const statuses = {};
    layout.onsets.forEach((on, i) => {
      if (!on.midis.length) return;
      total++;
      const T = on.time + lat;
      let hit = 0, worst = 0, dsum = 0;
      const hits = new Map();
      // במיקרופון מספיק צליל אחד מאקורד
      const need = usesMic ? 1 : on.midis.length;
      on.midis.forEach(m => {
        if (usesMic && hit >= 1) return;
        let best = null;
        rec.forEach(r => { if (!r.used && same(r.src, r.m, m) && Math.abs(r.t - T) <= win && (!best || Math.abs(r.t - T) < Math.abs(best.t - T))) best = r; });
        if (best) { best.used = true; hit++; const d = best.t - T; worst = Math.max(worst, Math.abs(d)); dsum += d; devSum += d; devN++; hits.set(m, true); }
      });
      const st = hit >= need ? (worst <= good ? 'ok' : 'warn') : hit > 0 ? 'warn' : 'bad';
      statuses[i] = st;
      if (st === 'ok') ok++; else if (st === 'warn') warn++; else bad++;
      // עצירה = לפחות שלושה אירועים ברצף בלי אף צליל
      if (hit > 0) missRun = 0;
      else if (++missRun === 3) stops++;
      on.evs.forEach(ev => {
        ev._st = st; ev._dev = hit ? dsum / hit : null;
        if (ev.rest) return;
        ev.pitches.forEach(p => {
          const good1 = !!hits.get(Theory.midiOf(p));
          if (usesMic && !good1 && hit >= 1) return;
          Store.record('notes', `${ev.clef}:${p.step}`, good1, 0);
        });
      });
    });
    const extra = rec.filter(r => !r.used).length;
    const score = total ? Math.max(0, (ok + warn * 0.5) / total - extra * 0.01) : 0;
    logCells(layout);
    return { ok, warn, bad, total, extra, score, statuses, stops, avgMs: devN ? Math.round(devSum / devN * 1000) : 0 };
  }

  // התיבה הקשה ביותר, לשלב הסריקה: הרבה תווים, סימנים מקריים, קפיצות
  function hardestMeasure(piece) {
    const n = piece.parts[0].measures.length;
    let best = 0, bestV = -1;
    for (let m = 0; m < n; m++) {
      let v = 0;
      piece.parts.forEach(p => {
        let prev = null;
        p.measures[m].forEach(ev => {
          if (ev.rest || ev.ghost) return;
          v += 1 + (ev.pitches.length - 1) * 0.7 + (ev.q < 0.5 ? 0.5 : 0) + (ev.triplet ? 0.5 : 0);
          ev.pitches.forEach(pt => {
            if (pt.alter !== Theory.keyAlter(piece.key.fifths, Theory.letterOf(pt.step))) v += 1.5;
          });
          const s = ev.pitches[ev.pitches.length - 1].step;
          if (prev != null && Math.abs(s - prev) >= 4) v += 1;
          prev = s;
        });
      });
      if (v > bestV) { bestV = v; best = m; }
    }
    return best;
  }

  return { taps, logCells, perform, hardestMeasure, hit, TOL };
})();
