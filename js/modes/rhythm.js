'use strict';
/* קריאת קצב: הקשה אחרי ספירה ומדידת סטייה לכל תו */
const RhythmMode = (() => {
  const USER_KEYS = { measures: 2, tolerance: 'normal', metronome: true, tapSound: true, focusWeak: false };
  let sh, s, refresh, piece, layout, rec = null, tempoCtl, statuses = {};
  const ui = {};

  const schema = [
    { type: 'level', key: 'level' },
    { type: 'select', key: 'measures', label: 'אורך', num: true, options: [[1, 'תיבה אחת'], [2, '2 תיבות'], [4, '4 תיבות']] },
    { type: 'chips', key: 'times', label: 'משקל', options: Levels.TIMES.map(t => [t, t]) },
    { type: 'heading', label: 'שליטה ברמת הקושי' },
    { type: 'chips', key: 'res', single: true, label: 'רזולוציית קצב – הערך הקצר ביותר', options: Levels.RES_OPTS },
    { type: 'toggle', key: 'dots', label: 'כולל ערכים מנוקדים' },
    { type: 'toggle', key: 'trip', label: 'כולל טריולות', show: v => v.res === '8' || v.res === '16' },
    { type: 'chips', key: 'density', single: true, label: 'צפיפות קצבית', options: Levels.DENSITY_OPTS },
    { type: 'range', key: 'restProb', label: 'הפסקים', min: 0, max: 0.35, step: 0.02, fmt: UI.pct },
    { type: 'toggle', key: 'sync', label: 'סינקופות' },
    { type: 'toggle', key: 'focusWeak', label: 'התמקד במקצבים שלי שצריכים שיפור' },
    { type: 'group', label: 'ערכי תווים – בחירה מפורטת', fields: [
      { type: 'chips', key: 'rhythm', label: 'ערכים שיופיעו', options: Levels.RHYTHM_OPTS },
    ] },
    { type: 'heading', label: 'הקשה' },
    { type: 'chips', key: 'tolerance', single: true, label: 'רמת דיוק נדרשת', options: [['loose', 'סלחני'], ['normal', 'רגיל'], ['strict', 'קפדני']] },
    { type: 'toggle', key: 'metronome', label: 'מטרונום בזמן ההקשה' },
    { type: 'toggle', key: 'tapSound', label: 'צליל בכל הקשה' },
  ];

  function init(view) {
    sh = UI.shell(view, 'קריאת קצב', 'הקישו את הקצב אחרי תיבת ספירה – במקש הרווח, בכפתור, או בכל קליד MIDI. כל תו נמדד במילישניות.');
    s = Levels.upgrade(Store.load('rhythm', Levels.apply(Object.assign({}, USER_KEYS), Levels.rhythm(2))));
    buildSettings();
    ui.listen = UI.btn('האזנה', () => listen(), '', 'ear');
    ui.go = UI.btn('הקישו!', () => (rec ? stop() : startTap()), 'primary', 'tap');
    tempoCtl = UI.tempoControl(() => s.tempo, v => { s.tempo = v; save(); });
    sh.toolbar.append(h('div', { class: 'tb-group' }, UI.btn('קצב חדש', () => generate(), '', 'dice'), ui.listen, ui.go), h('div', { class: 'tb-group' }, tempoCtl));
    ui.pad = h('button', { class: 'tap-pad', onpointerdown: e => { e.preventDefault(); tap(AudioEng.now()); } }, h('b', {}, 'הקישו כאן'), h('small', {}, 'או מקש רווח'));
    ui.timeline = h('div', { class: 'timeline' });
    sh.below.append(ui.pad, ui.timeline);
    generate();
  }
  const save = () => Store.save('rhythm', s);
  function buildSettings() {
    refresh = UI.settingsForm(sh.settings, schema, s, (key, val) => {
      if (key === 'level') { Levels.apply(s, Levels.rhythm(val)); tempoCtl && tempoCtl.sync(); } else Levels.onEdit(s, key, Levels.rhythm);
      buildSettings();
      save();
      if (!['tolerance', 'metronome', 'tapSound'].includes(key)) generate();
    });
  }

  function generate() {
    stop();
    piece = Gen.rhythmPiece(s.focusWeak ? { ...s, cellsFor: weakCells, cellWeight: id => Curriculum.weight('rhythms', id, false) } : s);
    statuses = {};
    ui.timeline.innerHTML = '';
    sh.results.innerHTML = '';
    draw();
    sh.info.innerHTML = '';
    sh.info.append(h('span', { class: 'tag strong' }, `משקל ${piece.time.num}/${piece.time.den}`),
      h('span', { class: 'tag' }, piece.ti.compound ? 'הטמפו נספר ברבעים מנוקדים' : 'הטמפו נספר ברבעים'),
      h('span', { class: 'tag' }, `רמה ${s.level} · ${Levels.NAMES[s.level]}`));
  }
  // מקצבים שתורגלו, בלי הפסקה בלבד: מספיק כדי שהתיבה תתמלא
  function weakCells(ti) {
    const ids = Object.entries(Store.stats.items.rhythms)
      .filter(([id, r]) => r.a >= 3 && r.ema < 0.85 && Cells.compound(id) === !!ti.compound && Cells.lengthOf(id) <= ti.L + 1e-6)
      .map(([id]) => id);
    if (!ids.length) { UI.toast('עוד אין מקצבים שצריכים שיפור. נתרגל כרגיל.'); return null; }
    return [...new Set([...ids, ti.compound ? 'c|q.' : 'q'])];
  }
  function draw() {
    layout = Render.score(sh.score, piece, { maxPerLine: 4 });
    Object.entries(statuses).forEach(([i, st]) => layout.onsets[i] && Render.mark(layout.onsets[i].notes, st));
  }

  function listen() {
    stop();
    Player.start(piece, layout, {
      tempo: s.tempo, metronome: true, sound: 'wood',
      onOnset: i => UI.placeCursor(sh, layout, i, 'play'),
      onCount: n => UI.countIn(sh, n),
      onEnd: () => { sh.cursor.hidden = true; },
    });
  }

  function startTap() {
    stop();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    statuses = {};
    layout.onsets.forEach(o => Render.mark(o.notes, null));
    sh.results.innerHTML = '';
    ui.timeline.innerHTML = '';
    rec = { taps: [] };
    App.inputSound = false;
    ui.go.querySelector('span:last-child').textContent = 'עצירה';
    ui.pad.classList.add('live');
    Player.start(piece, layout, {
      tempo: s.tempo, metronome: s.metronome, mute: true, tail: 0.5,
      onOnset: i => UI.placeCursor(sh, layout, i, 'play'),
      onCount: n => UI.countIn(sh, n),
      onEnd: evaluate,
    });
  }
  function stop() {
    Player.stop();
    rec = null;
    App.inputSound = true;
    if (!sh) return;
    sh.cursor.hidden = true;
    UI.countIn(sh, 0);
    ui.go.querySelector('span:last-child').textContent = 'הקישו!';
    ui.pad.classList.remove('live');
  }
  function tap(t) {
    ui.pad.classList.add('hit');
    setTimeout(() => ui.pad.classList.remove('hit'), 90);
    if (s.tapSound) AudioEng.wood(AudioEng.now());
    if (rec) rec.taps.push({ t, used: false });
  }

  function evaluate() {
    const spq = Player.secPerQuarter(piece, s.tempo);
    const r = Scoring.taps(layout, rec ? rec.taps : [], { tolerance: s.tolerance });
    statuses = r.statuses;
    Object.entries(statuses).forEach(([i, x]) => Render.mark(layout.onsets[i].notes, x));
    Scoring.logCells(layout);
    stop();
    drawTimeline(r.res, r.extras, r.lat, spq);
    Store.session('rhythm', { n: r.n, ok: r.okN, score: r.score, level: s.level });
    const ms = v => Math.round(v * 1000), tol = Scoring.TOL[s.tolerance];
    let note = null;
    if (Math.abs(r.avg) > tol * 0.8) note = r.avg > 0 ? 'אתם נוטים לאחר. אם זה קורה תמיד, אפשר לכייל השהיה בהעדפות.' : 'אתם נוטים להקדים – נסו להקשיב לפעמה.';
    else if (r.score >= 0.9) note = 'קצב מצוין! נסו טמפו מהיר יותר או רמה גבוהה יותר.';
    UI.resultCard(sh, {
      title: 'תוצאות הקצב', score: r.score, note,
      lines: [
        ['מדויק', r.okN + ' / ' + r.n], ['הוחמצו', r.missed], ['הקשות מיותרות', r.extras.length],
        ['סטייה ממוצעת', `${ms(Math.abs(r.avg))}ms ${r.avg > 0.005 ? 'מאחר' : r.avg < -0.005 ? 'מקדים' : ''}`],
        ['יציבות (פיזור)', `±${ms(r.spread)}ms`],
      ],
      actions: [['שוב', startTap, ''], ['קצב חדש', () => { generate(); }, 'primary']],
    });
  }

  function drawTimeline(res, extras, lat, spq) {
    const t0 = layout.onsets[0].time + lat;
    const total = piece.parts[0].measures.length * piece.ti.L * spq;
    const W = 1000, H = 64, X = t => 10 + (t - t0) / total * (W - 20);
    const svg = [`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`, `<line x1="10" y1="32" x2="${W - 10}" y2="32" class="tl-axis"/>`];
    for (let b = 0; b <= piece.parts[0].measures.length * piece.ti.L + 1e-6; b += piece.ti.group) {
      const bar = Math.abs(b % piece.ti.L) < 1e-6;
      svg.push(`<line x1="${X(t0 + b * spq)}" x2="${X(t0 + b * spq)}" y1="${bar ? 12 : 24}" y2="${bar ? 52 : 40}" class="tl-beat"/>`);
    }
    res.forEach(r => {
      svg.push(`<rect x="${X(r.T) - 2}" y="18" width="4" height="28" rx="2" class="tl-exp"/>`);
      if (r.d !== null) svg.push(`<line x1="${X(r.T)}" x2="${X(r.T + r.d)}" y1="32" y2="32" class="tl-dev ${r.st}"/><circle cx="${X(r.T + r.d)}" cy="32" r="6" class="tl-tap ${r.st}"/>`);
    });
    extras.forEach(e => svg.push(`<circle cx="${X(e.t)}" cy="32" r="5" class="tl-extra"/>`));
    svg.push('</svg>');
    ui.timeline.innerHTML = `<div class="tl-legend"><span><i class="lg exp"></i>התו הנכון</span><span><i class="lg ok"></i>מדויק</span><span><i class="lg warn"></i>קרוב</span><span><i class="lg bad"></i>רחוק / הוחמץ</span><span><i class="lg extra"></i>מיותר</span></div>` + svg.join('');
  }

  function onKey(e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      if (e.target && e.target.closest && e.target.closest('button') && e.code === 'Enter') return false;
      e.preventDefault();
      if (!e.repeat) tap(AudioEng.now());
      return true;
    }
    return false;
  }

  return {
    init,
    enter() { if (layout && Math.abs(layout.width - sh.score.clientWidth) > 20) draw(); },
    leave() { stop(); },
    onInput(e) { if (e.type === 'on') tap(e.time); },
    onKey,
    onResize() { if (piece) draw(); },
    onPrefs() { buildSettings(); },
  };
})();
