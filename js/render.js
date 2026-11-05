'use strict';
/* ציור תווים עם VexFlow: שבירת שורות, מערכת כפולה, אלומות, טריולות, סימנים מקריים */
const Render = (() => {
  const EPS = 1e-6;
  const V = () => Vex.Flow;
  const LINES = { treble: [38, 30], bass: [26, 18], alto: [32, 24], tenor: [30, 22], percussion: [38, 30] };
  const REST_KEY = { treble: ['b/4', 'd/5'], bass: ['d/3', 'f/3'], alto: ['c/4', 'e/4'], tenor: ['a/3', 'c/4'], percussion: ['b/4', 'd/5'] };
  const ACC = { '-2': 'bb', '-1': 'b', '0': 'n', '1': '#', '2': '##' };
  const BASE = { w: 46, h: 40, q: 34, '8': 28, '16': 24 };

  // אילו סימנים מקריים להציג – לפי סימני ההיתק ומה שכבר הופיע בתיבה
  function prepareAccidentals(piece) {
    piece.parts.forEach(p => p.measures.forEach(meas => {
      const state = {};
      meas.forEach(ev => {
        if (ev.rest || ev.ghost || p.clef === 'percussion') { ev._acc = null; return; }
        ev._acc = ev.pitches.map(pt => {
          const cur = state[pt.step] ?? Theory.keyAlter(piece.key.fifths, Theory.letterOf(pt.step));
          state[pt.step] = pt.alter;
          return pt.alter !== cur ? ACC[pt.alter] : null;
        });
      });
    }));
  }

  function minWidth(piece, m, opts) {
    let w = 0;
    piece.parts.forEach(p => {
      let pw = 22;
      p.measures[m].forEach(ev => {
        pw += BASE[ev.code] + (ev.dots ? 7 : 0);
        if (ev._acc) pw += ev._acc.filter(Boolean).length * 9;
        if (opts.showNames && !ev.rest) pw += 6;
      });
      w = Math.max(w, pw);
    });
    return Math.max(w, opts.minMeasureW || 80);
  }

  function modWidth(piece, first, opts) {
    const Vf = V();
    let w = 0;
    piece.parts.forEach(p => {
      const s = new Vf.Stave(0, 0, 500);
      if (!opts.hideClef) s.addClef(p.clef);
      if (p.clef !== 'percussion' && opts.showKey !== false) s.addKeySignature(Theory.KEY_SPEC[piece.key.fifths]);
      if (first && opts.showTime !== false) s.addTimeSignature(`${piece.time.num}/${piece.time.den}`);
      w = Math.max(w, s.getNoteStartX());
    });
    return w + 4;
  }

  function makeNote(ev, clef, opts) {
    const Vf = V();
    if (ev.ghost) return new Vf.GhostNote({ duration: ev.code });
    const perc = clef === 'percussion';
    const dur = ev.code + 'd'.repeat(ev.dots || 0) + (ev.rest ? 'r' : '');
    const keys = ev.rest ? [REST_KEY[clef][ev.code === 'w' ? 1 : 0]] : ev.pitches.map(p => Theory.vfKey(p.step));
    const n = new Vf.StaveNote({
      keys, duration: dur, clef: perc ? 'treble' : clef,
      auto_stem: !perc, stem_direction: perc ? 1 : undefined,
    });
    if (ev.dots) {
      if (Vf.Dot.buildAndAttach) Vf.Dot.buildAndAttach([n], { all: true });
      else n.addDotToAll();
    }
    if (ev._acc) ev._acc.forEach((a, i) => { if (a) n.addModifier(new Vf.Accidental(a), i); });
    if (opts.showNames && !ev.rest && !perc) {
      ev.pitches.slice().reverse().forEach(p => {
        const ann = new Vf.Annotation(Theory.pitchName(p, opts.naming));
        ann.setFont('-apple-system, "Segoe UI", Arial, sans-serif', 11, 'bold');
        ann.setVerticalJustification(Vf.Annotation.VerticalJustify.BOTTOM);
        n.addModifier(ann, 0);
      });
    }
    return n;
  }

  function score(container, piece, opts = {}) {
    const Vf = V();
    container.innerHTML = '';
    const W = opts.width ? Math.floor(opts.width) : Math.max(280, Math.floor(container.clientWidth || 800));
    prepareAccidentals(piece);
    const parts = piece.parts, n = parts[0].measures.length;
    const group = piece.ti ? piece.ti.group : 1;

    // מרווחים אנכיים לפי התווים בפועל
    const ext = parts.map(p => {
      let mn = Infinity, mx = -Infinity;
      p.measures.forEach(m => m.forEach(ev => {
        if (!ev.rest && !ev.ghost) ev.pitches.forEach(pt => { mn = Math.min(mn, pt.step); mx = Math.max(mx, pt.step); });
      }));
      const [top, bot] = LINES[p.clef];
      if (mn === Infinity) { mn = bot; mx = top; }
      return {
        above: Math.max(0, (mx - top) * 5) + 34,
        below: Math.max(0, (bot - mn) * 5) + 30 + (opts.showNames ? 16 * Math.max(1, maxChord(p)) : 0),
      };
    });
    const offs = [];
    let y = 0;
    parts.forEach((p, i) => { y += ext[i].above; offs.push(y); y += 40 + ext[i].below; });
    const sysH = y + 4;

    const minW = [];
    for (let m = 0; m < n; m++) minW.push(minWidth(piece, m, opts));
    const mod0 = modWidth(piece, true, opts), mod1 = modWidth(piece, false, opts);
    const pad = 4, avail = W - pad * 2 - 2;
    const maxPer = opts.maxPerLine || 4;
    const lines = [];
    let cur = [], cw = 0;
    for (let m = 0; m < n; m++) {
      if (!cur.length) cw = lines.length ? mod1 : mod0;
      else if (cw + minW[m] > avail || cur.length >= maxPer) { lines.push(cur); cur = []; cw = mod1; }
      cur.push(m); cw += minW[m];
    }
    if (cur.length) lines.push(cur);

    const div = document.createElement('div');
    div.className = 'score-svg';
    container.append(div);
    const renderer = new Vf.Renderer(div, Vf.Renderer.Backends.SVG);
    renderer.resize(W, lines.length * sysH + 4);
    const ctx = renderer.getContext();
    const onsetMap = new Map();
    const layout = { systems: [], onsets: [], measures: [], sysH, width: W, el: div };
    const keySpec = Theory.KEY_SPEC[piece.key.fifths];

    lines.forEach((line, li) => {
      const y0 = li * sysH;
      const mod = li === 0 ? mod0 : mod1;
      const sumMin = line.reduce((a, m) => a + minW[m], 0);
      let free = Math.max(0, avail - mod - sumMin);
      if (lines.length > 1 && li === lines.length - 1 && line.length < lines[0].length) free = Math.min(free, sumMin * 0.35);
      if (opts.noStretch) free = Math.min(free, sumMin * 0.5);
      let x = pad;
      line.forEach((m, k) => {
        const width = minW[m] + free * (minW[m] / sumMin) + (k === 0 ? mod : 0);
        const staves = parts.map((p, i) => {
          const s = new Vf.Stave(x, y0 + offs[i] - 40, width);
          if (k === 0) {
            if (!opts.hideClef) s.addClef(p.clef);
            if (p.clef !== 'percussion' && opts.showKey !== false) s.addKeySignature(keySpec);
            if (li === 0 && opts.showTime !== false) s.addTimeSignature(`${piece.time.num}/${piece.time.den}`);
          }
          if (m === n - 1 && opts.endBar !== false) s.setEndBarType(Vf.Barline.type.END);
          return s;
        });
        if (k === 0) {
          const nsx = Math.max(...staves.map(s => s.getNoteStartX()));
          staves.forEach(s => s.setNoteStartX(nsx));
        }
        staves.forEach(s => s.setContext(ctx).draw());
        if (parts.length > 1) {
          const conn = type => new Vf.StaveConnector(staves[0], staves[staves.length - 1]).setType(type).setContext(ctx).draw();
          if (k === 0) { conn(piece.grand ? 'brace' : 'bracket'); conn('singleLeft'); }
          conn(m === n - 1 && opts.endBar !== false ? 'boldDoubleRight' : 'singleRight');
        }

        const voices = [], beams = [], tuplets = [];
        parts.forEach((p, i) => {
          const evs = p.measures[m];
          const notes = evs.map(ev => { ev._vf = makeNote(ev, p.clef, opts); return ev._vf; });
          evs.forEach((ev, j) => {
            if (ev.tripStart && notes[j + 2]) tuplets.push(new Vf.Tuplet(notes.slice(j, j + 3), { num_notes: 3, notes_occupied: 2 }));
          });
          let run = [], runG = null;
          const flush = () => { if (run.length >= 2) beams.push(new Vf.Beam(run, p.clef !== 'percussion')); run = []; };
          evs.forEach((ev, j) => {
            const beamable = !ev.rest && !ev.ghost && (ev.code === '8' || ev.code === '16');
            const g = ev.triplet ? 'T' + Math.floor(ev.pos + EPS) : Math.floor(ev.pos / group + EPS);
            if (!beamable || g !== runG) flush();
            if (beamable) { run.push(notes[j]); runG = g; } else runG = null;
          });
          flush();
          const voice = new Vf.Voice({ num_beats: piece.time.num, beat_value: piece.time.den });
          voice.setMode(Vf.Voice.Mode.SOFT);
          voice.addTickables(notes);
          voices.push(voice);
        });
        const fmt = new Vf.Formatter();
        voices.forEach(v => fmt.joinVoices([v]));
        fmt.format(voices, Math.max(30, staves[0].getNoteEndX() - staves[0].getNoteStartX() - 14));
        voices.forEach((v, i) => v.draw(ctx, staves[i]));
        beams.forEach(b => b.setContext(ctx).draw());
        tuplets.forEach(t => t.setContext(ctx).draw());

        parts.forEach(p => p.measures[m].forEach(ev => {
          if (ev.ghost) return;
          const key = ev.start.toFixed(4);
          let on = onsetMap.get(key);
          if (!on) { on = { t: ev.start, m, sys: li, x: Infinity, notes: [], midis: [], evs: [] }; onsetMap.set(key, on); }
          on.x = Math.min(on.x, ev._vf.getAbsoluteX());
          on.notes.push(ev._vf); on.evs.push(ev);
          if (!ev.rest) ev.pitches.forEach(pt => { const mi = Theory.midiOf(pt); if (!on.midis.includes(mi)) on.midis.push(mi); });
        }));
        layout.measures[m] = { x, width, sys: li, noteX: staves[0].getNoteStartX() };
        x += width;
      });
      layout.systems.push({ top: y0, bottom: y0 + sysH });
    });
    layout.onsets = [...onsetMap.values()].sort((a, b) => a.t - b.t);
    layout.svg = div.querySelector('svg');
    return layout;
  }

  const maxChord = p => p.measures.reduce((a, m) => m.reduce((b, ev) => Math.max(b, ev.ghost ? 0 : ev.pitches.length), a), 1);

  function noteEl(vn) {
    try { if (vn.getSVGElement) { const el = vn.getSVGElement(); if (el) return el; } } catch (e) { /* fallback */ }
    const id = vn.getAttribute && vn.getAttribute('id');
    return id ? document.getElementById('vf-' + id) : null;
  }
  function mark(vns, state) {
    vns.forEach(vn => {
      const el = noteEl(vn);
      if (!el) return;
      el.classList.remove('n-ok', 'n-warn', 'n-bad', 'n-cur');
      if (state) el.classList.add('n-' + state);
    });
  }

  return { score, mark, noteEl };
})();
