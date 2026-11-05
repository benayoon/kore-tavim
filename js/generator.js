'use strict';
/* מחולל קטעים: קצב, הרמוניה, מלודיה וליווי.
   אירוע = {code, dots, q (ברבעים), pos (בתוך התיבה), start (מתחילת הקטע), m, rest, pitches[], triplet, tripStart} */
const Gen = (() => {
  const EPS = 1e-6;
  const DUR = {
    'w': { q: 4, code: 'w', dots: 0 }, 'h.': { q: 3, code: 'h', dots: 1 }, 'h': { q: 2, code: 'h', dots: 0 },
    'q.': { q: 1.5, code: 'q', dots: 1 }, 'q': { q: 1, code: 'q', dots: 0 }, '8.': { q: 0.75, code: '8', dots: 1 },
    '8': { q: 0.5, code: '8', dots: 0 }, '16': { q: 0.25, code: '16', dots: 0 }, 'trip': { q: 1, code: '8', dots: 0 },
  };
  const WEIGHT = { 'w': 1, 'h.': 1.3, 'h': 2.5, 'q.': 2, 'q': 5, '8.': 1.5, '8': 4, '16': 2, 'trip': 1.2 };
  const rnd = Math.random;
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const isInt = x => Math.abs(x - Math.round(x)) < EPS;
  function pick(arr, wf) {
    const ws = arr.map(wf || (() => 1));
    let r = rnd() * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // צפיפות קצבית: מטה את המשקלות לעבר ערכים ארוכים או קצרים
  function densityWeights(d) {
    const w = { ...WEIGHT };
    if (d === 'dense') Object.keys(w).forEach(k => { const q = DUR[k].q; w[k] *= k === 'trip' || q <= 0.5 ? 3.5 : q >= 2 ? 0.35 : 1; });
    if (d === 'sparse') Object.keys(w).forEach(k => { const q = DUR[k].q; w[k] *= k === 'trip' || q < 1 ? 0.3 : q >= 2 ? 2.5 : 1.4; });
    return w;
  }
  // במשקל מורכב הפעמה היא רבע מנוקד – תמיד מותר
  const allowedFor = (rhythm, ti) => {
    const a = rhythm.filter(k => DUR[k]);
    if (ti.compound && !a.includes('q.')) a.push('q.');
    // חצאים בלבד לא ממלאים תיבה של 3/4 או 5/4
    if (!ti.compound && ti.num % 2 === 1 && !a.includes('q') && !a.includes('h.')) a.push('h.');
    return a;
  };

  function timeInfo(sig) {
    const [num, den] = sig.split('/').map(Number);
    const compound = den === 8 && num % 3 === 0;
    return { sig, num, den, L: num * 4 / den, compound, group: compound ? 1.5 : 1 };
  }

  // האם ערך k יכול להתחיל במיקום pos בלי לשבור את חלוקת הפעמות
  function valid(pos, k, ti, sync) {
    const d = DUR[k].q;
    if (pos + d > ti.L + EPS) return false;
    if (k === 'trip') return !ti.compound && isInt(pos);
    const g = ti.group;
    const off = pos - Math.floor(pos / g + EPS) * g;
    const atStart = off < EPS, atHalf = Math.abs(off - 0.5) < EPS;
    if (ti.compound) {
      if (d === 4 || d === 2) return false;
      if (d === 3 || d === 1.5 || d === 0.75) return atStart;
      if (d === 1) return atStart || atHalf;
      return off + d <= g + EPS;
    }
    if (d === 4) return pos < EPS;
    if (d === 3) return pos < EPS || (isInt(pos) && ti.num >= 4 && (sync || Math.round(pos) === 1));
    if (d === 2) return isInt(pos) && (ti.num % 2 === 1 || Math.round(pos) % 2 === 0 || sync);
    if (d === 1.5 || d === 1) return isInt(pos) || (sync && atHalf);
    if (d === 0.75) return atStart;
    return off + d <= 1 + EPS;
  }

  function rhythmMeasure(ti, allowed, opts = {}) {
    const w = opts.weights || WEIGHT;
    for (let a = 0; a < 400; a++) {
      let pos = 0, ok = true;
      const seq = [];
      while (pos < ti.L - EPS) {
        const c = allowed.filter(k => DUR[k] && valid(pos, k, ti, opts.sync));
        if (!c.length) { ok = false; break; }
        const k = pick(c, x => w[x] || 0.5);
        if (k === 'trip') {
          for (let i = 0; i < 3; i++) seq.push({ key: k, pos: pos + i / 3, q: 1 / 3, triplet: true, tripStart: i === 0 });
          pos += 1;
        } else {
          seq.push({ key: k, pos, q: DUR[k].q });
          pos += DUR[k].q;
        }
      }
      if (ok && Math.abs(pos - ti.L) < EPS) return seq;
    }
    const unit = ti.compound ? 'q.' : 'q', seq = [];
    for (let pos = 0; pos < ti.L - EPS; pos += DUR[unit].q) seq.push({ key: unit, pos, q: DUR[unit].q });
    return seq;
  }

  const toEvent = (r, m, ti) => ({
    key: r.key, code: DUR[r.key].code, dots: DUR[r.key].dots, q: r.q, pos: r.pos, start: m * ti.L + r.pos, m,
    rest: !!r.rest, pitches: [], triplet: !!r.triplet, tripStart: !!r.tripStart,
  });

  // תיבה שמורכבת מתאים קצביים שלמים (למסלול הלמידה ולתרגול מקצבים חלשים)
  function cellFits(pos, id, ti) {
    const len = Cells.lengthOf(id);
    if (pos + len > ti.L + EPS) return false;
    const x = pos / ti.group;
    if (Math.abs(x - Math.round(x)) > EPS) return false;
    const toks = Cells.tokens(id);
    if (toks.length === 1) return valid(pos, Cells.parseToken(toks[0]).key, ti, false);
    return true;
  }
  function cellMeasure(ti, cells, wf, o = {}) {
    for (let a = 0; a < 300; a++) {
      let pos = 0, ok = true;
      const seq = [];
      while (pos < ti.L - EPS) {
        let c = cells.filter(id => cellFits(pos, id, ti));
        if (o.noRestStart && pos < EPS) c = c.filter(id => !Cells.tokens(id)[0].startsWith('r'));
        if (!c.length) { ok = false; break; }
        const id = pick(c, x => (wf ? wf(x) : 1));
        Cells.tokens(id).forEach((t, i) => {
          const { key, rest } = Cells.parseToken(t);
          const q = key === 'trip' ? 1 / 3 : DUR[key].q;
          seq.push({ key, pos, q, rest, triplet: key === 'trip', tripStart: key === 'trip' && i === 0 });
          pos += q;
        });
      }
      if (!ok || Math.abs(pos - ti.L) > 1e-4) continue;
      if (o.noRestEnd && seq[seq.length - 1].rest) continue;
      return seq;
    }
    const unit = ti.compound ? 'q.' : 'q', seq = [];
    for (let pos = 0; pos < ti.L - EPS; pos += DUR[unit].q) seq.push({ key: unit, pos, q: DUR[unit].q });
    return seq;
  }
  function cellPart(n, ti, cells, wf, o = {}) {
    const out = [];
    for (let m = 0; m < n; m++) {
      const seq = cellMeasure(ti, cells, wf, { noRestStart: m === 0, noRestEnd: m === n - 1 && o.finalNote !== false });
      out.push(seq.map(r => toEvent(r, m, ti)));
    }
    return out;
  }

  // רצף תיבות קצב עם חזרה על מוטיבים וצליל סיום ארוך
  function rhythmPart(n, ti, allowed, opts = {}) {
    const seqs = [];
    for (let m = 0; m < n; m++) {
      let r = null;
      if (m === n - 1 && opts.finalLong !== false) {
        const k = allowed.find(x => x !== 'trip' && Math.abs(DUR[x].q - ti.L) < EPS);
        if (k && rnd() < 0.75) r = [{ key: k, pos: 0, q: ti.L }];
        else {
          // לפחות שהצליל האחרון יהיה ארוך יחסית
          const longs = allowed.filter(x => x !== 'trip' && DUR[x].q >= ti.group);
          for (let a = 0; a < 30 && !r; a++) {
            const s = rhythmMeasure(ti, allowed, opts);
            if (!longs.length || DUR[s[s.length - 1].key].q >= ti.group) r = s;
          }
        }
      }
      if (!r && m > 0 && m < n - 1 && opts.repeat && rnd() < opts.repeat) {
        const src = seqs[m - (m > 1 && rnd() < 0.5 ? 2 : 1)];
        r = src.map(e => ({ ...e }));
      }
      seqs.push(r || rhythmMeasure(ti, allowed, opts));
    }
    return seqs.map((s, m) => s.map(r => toEvent(r, m, ti)));
  }

  function applyRests(measures, prob) {
    const all = measures.flat();
    all.forEach((e, i) => {
      if (i === 0 || i === all.length - 1 || e.triplet) return;
      if (all[i - 1].rest) return;
      if (rnd() < prob) e.rest = true;
    });
  }

  const PROG = {
    major: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 4, 5, 3], [0, 1, 4, 0], [0, 3, 0, 4], [0, 5, 1, 4], [0, 2, 3, 4], [0, 3, 1, 4]],
    minor: [[0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 4], [0, 3, 6, 2], [0, 5, 1, 4], [0, 3, 4, 4]],
  };
  function progression(n, mode) {
    let p = [];
    while (p.length < n) p = p.concat(pick(PROG[mode]));
    p = p.slice(0, n);
    p[0] = 0;
    if (n >= 2) p[n - 2] = 4;
    p[n - 1] = 0;
    return p;
  }

  const IVW = [0.6, 6, 3.5, 1.8, 1.4, 0.9, 0.5, 0.8, 0.3, 0.3, 0.2];
  const isStrong = (e, group) => Math.abs(e.pos / group - Math.round(e.pos / group)) < EPS;

  function chromatic(p, prob, fifths) {
    if (rnd() >= prob) return p;
    const l = Theory.letterOf(p.step);
    const opts = [p.alter - 1, p.alter + 1].filter(a => a >= -1 && a <= 1 && !(Theory.weird(l, a) && Theory.keyAlter(fifths, l) !== a));
    return opts.length ? { step: p.step, alter: pick(opts) } : p;
  }

  // מלודיה: הליכה אקראית מושכלת סביב צלילי האקורד
  function melody(measures, key, prog, lo, hi, o) {
    const notes = measures.flat().filter(e => !e.rest);
    const tl = Theory.tonic(key.fifths, key.mode).letter;
    let cur = null, prevDir = 0, leapDir = 0;
    notes.forEach((e, i) => {
      const deg = prog[e.m];
      const tones = Theory.chordLetters(key, deg);
      const strong = isStrong(e, o.group);
      let step;
      if (cur === null) {
        const mid = (lo + hi) / 2, c = [];
        for (let x = lo; x <= hi; x++) if (tones.includes(Theory.letterOf(x))) c.push(x);
        step = c.length ? pick(c, x => 1 / (1 + Math.abs(x - mid))) : Math.round(mid);
      } else if (i === notes.length - 1) {
        let best = null;
        for (let x = lo - 2; x <= hi + 2; x++) {
          if (Theory.letterOf(x) === tl && (best === null || Math.abs(x - cur) < Math.abs(best - cur))) best = x;
        }
        step = best ?? cur;
      } else {
        const c = [];
        for (let x = Math.max(lo, cur - o.maxInt); x <= Math.min(hi, cur + o.maxInt); x++) {
          const iv = Math.abs(x - cur), l = Theory.letterOf(x), dir = Math.sign(x - cur);
          let w = IVW[Math.min(iv, 10)];
          if (tones.includes(l)) w *= strong ? (o.bass && l === tones[0] ? 5 : 2.5) : 1.3;
          if (dir && dir === prevDir) w *= 1.25;
          if (leapDir && iv <= 2 && dir === -leapDir) w *= 3;
          if (iv === 0 && e.q < 1) w *= 0.5;
          if (iv === 6) w *= 0.4; // ספטימות פחות שכיחות
          c.push([x, w]);
        }
        step = c.length ? pick(c, a => a[1])[0] : cur;
      }
      let p = Theory.pitchInKey(step, key, deg);
      if (i > 0 && i < notes.length - 1) p = chromatic(p, o.accProb, key.fifths);
      e.pitches = [p];
      e.deg = deg;
      const d = step - (cur ?? step);
      prevDir = Math.sign(d);
      leapDir = Math.abs(d) >= 3 ? prevDir : 0;
      cur = step;
    });
    measures.flat().forEach(e => { if (e.deg == null) e.deg = prog[e.m]; });
  }

  // צלילים כפולים/אקורדים מתחת למלודיה
  function harmonize(measures, key, prob, maxNotes, lo, group) {
    if (maxNotes < 2 || prob <= 0) return;
    measures.flat().forEach(e => {
      if (e.rest || !e.pitches.length) return;
      const p = prob * (isStrong(e, group) ? 1.6 : 0.6) * (e.q >= 1 ? 1.3 : 0.6);
      if (rnd() >= p) return;
      const top = e.pitches[0].step;
      const tones = Theory.chordLetters(key, e.deg);
      let cands = [];
      for (let d = 2; d <= 7; d++) {
        const x = top - d;
        if (x < lo - 3) break;
        if (tones.includes(Theory.letterOf(x))) cands.push(x);
      }
      if (!cands.length && top - 2 >= lo - 3) cands = [top - 2];
      const k = Math.min(cands.length, randInt(1, maxNotes - 1));
      const chosen = [];
      for (let i = 0; i < k; i++) {
        const x = pick(cands.filter(c => !chosen.includes(c)), c => ([2, 3, 5].includes(top - c) ? 3 : 1));
        chosen.push(x);
      }
      e.pitches = [...chosen.map(x => Theory.pitchInKey(x, key, e.deg)), e.pitches[0]].sort((a, b) => a.step - b.step);
    });
  }

  // יד שמאל
  function voicing(key, deg, n, lo, hi, prev, inv) {
    const tones = Theory.chordLetters(key, deg);
    // מרכז קבוע עם משיכה קלה לאקורד הקודם – כדי שהליווי לא "יזחל" למעלה
    const base = lo + (hi - lo) * 0.3;
    const center = prev == null ? base : base * 0.6 + prev * 0.4;
    let r = null;
    for (let x = lo - 3; x <= hi; x++) {
      if (Theory.letterOf(x) === tones[0] && x >= lo - 2 && (r === null || Math.abs(x - center) < Math.abs(r - center))) r = x;
    }
    // טווח צר אצל מתחילים: ייתכן שהשורש מחוצה לו, ואז לוקחים את הקרוב ביותר
    if (r === null) for (let x = lo - 7; x <= hi + 7; x++) if (Theory.letterOf(x) === tones[0] && (r === null || Math.abs(x - center) < Math.abs(r - center))) r = x;
    let steps;
    if (n <= 1) steps = [r];
    else if (n === 2) steps = rnd() < 0.6 ? [r, r + 4] : [r, r + 2];
    else if (n === 3) {
      const forms = [[r, r + 2, r + 4]];
      if (inv) forms.push([r + 2, r + 4, r + 7], [r - 3, r, r + 2]);
      steps = pick(forms, f => (f[0] === r ? 2 : 1));
    } else steps = [r, r + 2, r + 4, r + 7];
    if (steps[steps.length - 1] > hi + 3 && steps[0] - 7 >= lo - 3) steps = steps.map(s => s - 7);
    return { root: r, steps };
  }

  function accompaniment(n, ti, s, key, prog, lo, hi) {
    const allowed = s.rhythm;
    const styles = ['long', 'blocks'];
    if (allowed.includes('8')) styles.push('broken');
    if (s.level >= 7) styles.push('independent');
    const longKeys = allowed.filter(k => k !== 'trip' && DUR[k].q >= ti.group);
    const measures = [];
    let style = null, prevRoot = null;
    const inv = s.level >= 6;
    const indep = [];
    for (let m = 0; m < n; m++) {
      if (m % 4 === 0) style = s.lhStyle === 'mixed' ? pick(styles) : s.lhStyle;
      const deg = prog[m];
      let seq;
      if (m === n - 1) {
        const k = allowed.find(x => x !== 'trip' && Math.abs(DUR[x].q - ti.L) < EPS);
        seq = k ? [{ key: k, pos: 0, q: ti.L }] : rhythmMeasure(ti, longKeys.length ? longKeys : ['q'], { weights: { 'w': 6, 'h.': 5, 'h': 4 } });
        const v = voicing(key, 0, Math.max(1, Math.min(s.lhMax, 3)), lo, hi, prevRoot, false);
        measures.push(seq.map(r => Object.assign(toEvent(r, m, ti), { pitches: v.steps.map(x => Theory.pitchInKey(x, key, 0)), deg: 0 })));
        continue;
      }
      if (style === 'independent') {
        seq = rhythmMeasure(ti, allowed, { sync: s.sync, weights: { ...WEIGHT, '16': 0.5, '8': 2, '8.': 0.5, 'trip': 0.3, 'h': 4, 'q.': 3 } });
        const evs = seq.map(r => toEvent(r, m, ti));
        indep.push(evs);
        measures.push(evs);
        continue;
      }
      if (style === 'broken') {
        seq = [];
        for (let pos = 0; pos < ti.L - EPS; pos += 0.5) seq.push({ key: '8', pos, q: 0.5 });
      } else {
        const keys = longKeys.length ? longKeys : ['q'];
        seq = rhythmMeasure(ti, keys, {
          weights: style === 'long' ? { 'w': 6, 'h.': 5, 'h': 4, 'q.': 1, 'q': 0.6 } : { 'q': 4, 'h': 3, 'q.': 2, 'h.': 2, 'w': 1 },
        });
      }
      const maxN = style === 'long' ? Math.min(s.lhMax, 2) : style === 'broken' ? 1 : s.lhMax;
      const v = voicing(key, deg, Math.max(1, maxN), lo, hi, prevRoot, inv);
      prevRoot = v.root;
      const evs = seq.map(r => toEvent(r, m, ti));
      if (style === 'broken') {
        const base = voicing(key, deg, 3, lo, hi, prevRoot, false).steps.slice(0, 3);
        const pattern = ti.compound ? [base[0], base[2], base[0] + 7] : [base[0], base[2], base[1], base[2]];
        evs.forEach((e, i) => { e.pitches = [Theory.pitchInKey(pattern[i % pattern.length], key, deg)]; });
      } else {
        const oompah = style === 'blocks' && v.steps.length >= 3 && evs.length >= 2 && rnd() < 0.4;
        evs.forEach((e, i) => {
          const st = oompah ? (i === 0 ? [v.root] : v.steps.filter(x => x !== v.root)) : v.steps;
          e.pitches = st.map(x => Theory.pitchInKey(x, key, deg));
        });
      }
      evs.forEach(e => { e.deg = deg; });
      measures.push(evs);
    }
    // קו בס עצמאי לתיבות שסומנו ככאלה
    if (indep.length) {
      applyRests(indep, s.restProb * 0.5);
      melody(indep, key, prog, lo, hi, { group: ti.group, maxInt: Math.min(s.maxInt, 5), accProb: s.accProb * 0.5, bass: true });
      indep.flat().forEach(e => { if (!e.rest && !e.pitches.length) e.rest = true; });
    }
    return measures;
  }

  function sortPitches(measures) {
    measures.flat().forEach(e => e.pitches.sort((a, b) => a.step - b.step));
  }

  function piece(s) {
    const ti = timeInfo(pick(s.times));
    const mode = s.mode === 'both' ? (rnd() < 0.5 ? 'major' : 'minor') : s.mode;
    const key = { fifths: pick(s.keys), mode };
    const n = s.measures;
    const prog = progression(n, mode);
    const allowed = allowedFor(s.rhythm, ti);
    const rOpts = { sync: s.sync, repeat: 0.3, weights: densityWeights(s.density) };
    const mOpts = { group: ti.group, maxInt: s.maxInt, accProb: s.accProb };
    const parts = [];
    if (s.staff === 'grand') {
      const rh = s.cells ? cellPart(n, ti, s.cells, s.cellWeight) : rhythmPart(n, ti, allowed, rOpts);
      applyRests(rh, s.restProb);
      const [lo, hi] = s.ranges.treble;
      melody(rh, key, prog, lo, hi, mOpts);
      harmonize(rh, key, s.rhChord, s.rhMax, Math.max(lo, 30), ti.group);
      const [blo, bhi] = s.ranges.bass;
      const lh = accompaniment(n, ti, s, key, prog, blo, bhi);
      parts.push({ clef: 'treble', hand: 'R', measures: rh }, { clef: 'bass', hand: 'L', measures: lh });
    } else {
      const clef = s.staff;
      const [lo, hi] = s.ranges[clef];
      const ms = s.cells ? cellPart(n, ti, s.cells, s.cellWeight) : rhythmPart(n, ti, allowed, rOpts);
      applyRests(ms, s.restProb);
      melody(ms, key, prog, lo, hi, { ...mOpts, bass: clef === 'bass' });
      harmonize(ms, key, s.rhChord, s.rhMax, lo, ti.group);
      parts.push({ clef, hand: clef === 'bass' ? 'L' : 'R', measures: ms });
    }
    parts.forEach(p => sortPitches(p.measures));
    return Cells.annotate({ key, time: { num: ti.num, den: ti.den }, ti, parts, grand: s.staff === 'grand', prog });
  }

  function rhythmPiece(s) {
    const ti = timeInfo(pick(s.times));
    const cells = s.cells || s.cellsFor && s.cellsFor(ti);
    const ms = cells && cells.length
      ? cellPart(s.measures, ti, cells, s.cellWeight, { finalNote: false })
      : rhythmPart(s.measures, ti, allowedFor(s.rhythm, ti), { sync: s.sync, repeat: 0.15, finalLong: false, weights: densityWeights(s.density) });
    if (!cells) applyRests(ms, s.restProb);
    ms.flat().forEach(e => { e.pitches = e.rest ? [] : [{ step: 34, alter: 0 }]; });
    return Cells.annotate({ key: { fifths: 0, mode: 'major' }, time: { num: ti.num, den: ti.den }, ti, parts: [{ clef: 'percussion', hand: 'R', measures: ms }] });
  }

  // שורת "תיבות" עם צליל/אקורד אחד בכל אחת (לזיהוי תווים ואקורדים)
  function rowPiece(items, clefs, fifths) {
    return {
      key: { fifths, mode: 'major' }, time: { num: 4, den: 4 }, ti: timeInfo('4/4'), grand: clefs.length > 1,
      parts: clefs.map((clef, pi) => ({
        clef,
        measures: items.map((it, k) => [it.part === pi
          ? { code: 'w', dots: 0, q: 4, pos: 0, start: k * 4, m: k, rest: false, pitches: it.pitches.slice().sort((a, b) => a.step - b.step) }
          : { ghost: true, code: 'w', dots: 0, q: 4, pos: 0, start: k * 4, m: k, rest: false, pitches: [] }]),
      })),
    };
  }

  return { DUR, EPS, pick, randInt, timeInfo, rhythmMeasure, piece, rhythmPiece, rowPiece };
})();
