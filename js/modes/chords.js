'use strict';
/* זיהוי אקורדים: שורש + סוג (+ היפוך), או נגינת האקורד */
const ChordMode = (() => {
  const USER_KEYS = { staff: 'treble', answer: 'names', sound: true };
  const LOWEST = { treble: [28, 33], bass: [16, 21], alto: [23, 27], tenor: [20, 24] };
  const INV_NAMES = ['מצב יסודי', 'היפוך ראשון', 'היפוך שני', 'היפוך שלישי'];
  let sh, s, refresh, chord = null, layout, piece, sel = {}, locked = false, tStart = 0, sess, collected = new Set();
  const ui = {};

  const schema = [
    { type: 'level', key: 'level' },
    { type: 'select', key: 'staff', label: 'מפתח', options: [['treble', 'מפתח סול'], ['bass', 'מפתח פה'], ['grand', 'שני המפתחות'], ['alto', 'מפתח דו – אלט'], ['tenor', 'מפתח דו – טנור']] },
    { type: 'chips', key: 'types', label: 'סוגי אקורדים', options: Object.entries(Theory.QUALITIES).map(([k, q]) => [k, q.name]) },
    { type: 'toggle', key: 'inversions', label: 'כולל היפוכים' },
    { type: 'toggle', key: 'askInv', label: 'זהה גם את ההיפוך', show: v => v.inversions },
    { type: 'toggle', key: 'rootAcc', label: 'שורשים עם ♯ / ♭' },
    { type: 'chips', key: 'answer', single: true, label: 'דרך התשובה', options: [['names', 'בחירת שם'], ['piano', 'נגינת האקורד']] },
    { type: 'toggle', key: 'sound', label: 'השמע את האקורד אחרי תשובה' },
  ];

  function init(view) {
    sh = UI.shell(view, 'אקורדים', 'זהו את האקורד שעל החמשה: שורש, סוג ולפעמים גם ההיפוך. אפשר גם לנגן אותו.');
    s = Store.load('chords', Object.assign(Levels.chords(2), USER_KEYS, { staff: Curriculum.defaultStaff('treble') }));
    sess = { n: 0, ok: 0, streak: 0 };
    buildSettings();
    ui.stats = h('div', { class: 'quiz-stats' });
    sh.toolbar.append(h('div', { class: 'tb-group' },
      UI.btn('אקורד חדש', () => next(), '', 'dice'),
      UI.btn('השמע', () => playChord(), '', 'ear'),
      UI.btn('סיום ושמירה', () => endSession(), '')), ui.stats);
    ui.feedback = h('div', { class: 'feedback' }, ' ');
    ui.pad = h('div', { class: 'answer-pad' });
    sh.below.append(ui.feedback, ui.pad);
    buildPad();
    updateStats();
  }
  const save = () => Store.save('chords', s);
  function buildSettings() {
    refresh = UI.settingsForm(sh.settings, schema, s, (key, val) => {
      if (key === 'level') { Levels.apply(s, Levels.chords(val)); buildSettings(); } else refresh();
      save();
      buildPad();
      Input.setKeyboard(s.answer === 'piano');
      next();
    });
  }

  function buildPad() {
    ui.pad.innerHTML = '';
    sel = { letter: null, alter: 0, q: null, inv: s.askInv && s.inversions ? null : 0 };
    collected.clear();
    const naming = App.prefs.naming;
    if (s.answer === 'piano') {
      ui.collected = h('div', { class: 'collected' });
      ui.pad.append(h('p', { class: 'pad-hint' }, Mic.enabled() ? 'נגנו את צלילי האקורד בזה אחר זה, בכל סדר. המיקרופון מקשיב.' : 'נגנו את כל צלילי האקורד (בכל קול ובכל סדר). אפשר ללחוץ על הקלידים אחד אחרי השני.'),
        ui.collected, UI.btn('נקה', () => { collected.clear(); showCollected(); }, 'ghost'));
      showCollected();
      return;
    }
    ui.rootBtns = Theory.LETTERS.map((L, i) => h('button', { class: 'name-btn sm', onclick: () => choose('letter', i) },
      h('b', {}, Theory.letterName(i, naming)), h('small', {}, naming === 'letters' ? Theory.SOLFEGE[i] : L)));
    ui.accBtns = [[-1, '♭'], [0, '♮'], [1, '♯']].map(([a, l]) => h('button', { class: 'acc-btn', onclick: () => choose('alter', a) }, l));
    ui.qBtns = s.types.map(q => h('button', { class: 'q-btn', 'data-q': q, onclick: () => choose('q', q) },
      h('b', {}, Theory.QUALITIES[q].name), h('small', {}, 'C' + Theory.QUALITIES[q].sym)));
    ui.pad.append(
      h('div', { class: 'pad-label' }, 'שורש'),
      h('div', { class: 'acc-row' }, ui.accBtns), h('div', { class: 'name-row' }, ui.rootBtns),
      h('div', { class: 'pad-label' }, 'סוג'), h('div', { class: 'q-row' }, ui.qBtns));
    if (s.askInv && s.inversions) {
      const maxInv = Math.max(...s.types.map(q => Theory.QUALITIES[q].iv.length));
      ui.invBtns = INV_NAMES.slice(0, maxInv).map((l, i) => h('button', { class: 'q-btn', onclick: () => choose('inv', i) }, h('b', {}, l)));
      ui.pad.append(h('div', { class: 'pad-label' }, 'היפוך'), h('div', { class: 'q-row' }, ui.invBtns));
    }
    paintSel();
  }
  function paintSel() {
    if (s.answer === 'piano') return;
    ui.rootBtns.forEach((b, i) => b.classList.toggle('on', sel.letter === i));
    ui.accBtns.forEach((b, i) => b.classList.toggle('on', sel.alter === i - 1));
    ui.qBtns.forEach(b => b.classList.toggle('on', sel.q === b.dataset.q));
    if (ui.invBtns) ui.invBtns.forEach((b, i) => b.classList.toggle('on', sel.inv === i));
  }
  function choose(k, v) {
    if (locked) return;
    sel[k] = v;
    paintSel();
    if (sel.letter != null && sel.q && sel.inv != null) {
      const ok = sel.letter === chord.letter && sel.alter === chord.alter && sel.q === chord.q && (!(s.askInv && s.inversions) || sel.inv === chord.inv);
      finish(ok);
    }
  }

  function genChord() {
    for (let a = 0; a < 60; a++) {
      const q = Gen.pick(s.types);
      const letter = Gen.randInt(0, 6);
      const alter = s.rootAcc ? Gen.pick([-1, 0, 0, 1]) : 0;
      if (Theory.weird(letter, alter)) continue;
      let pitches = Theory.spellChord(28 + letter, alter, q);
      if (pitches.some(p => Math.abs(p.alter) > 1)) continue;
      const inv = s.inversions ? Gen.randInt(0, pitches.length - 1) : 0;
      for (let i = 0; i < inv; i++) { const p = pitches.shift(); pitches.push({ step: p.step + 7, alter: p.alter }); }
      const clefs = s.staff === 'grand' ? ['treble', 'bass'] : [s.staff];
      const part = clefs.length > 1 ? Gen.randInt(0, 1) : 0;
      const [lo, hi] = LOWEST[clefs[part]];
      let shift = 0;
      while (pitches[0].step + shift > hi) shift -= 7;
      while (pitches[0].step + shift < lo) shift += 7;
      pitches = pitches.map(p => ({ step: p.step + shift, alter: p.alter }));
      return { q, letter, alter, inv, pitches, part, clefs };
    }
    return { q: 'maj', letter: 0, alter: 0, inv: 0, pitches: Theory.spellChord(28, 0, 'maj'), part: 0, clefs: ['treble'] };
  }

  function next() {
    if (!sh) return;
    clearTimeout(ui.nextT);
    chord = genChord();
    piece = Gen.rowPiece([{ part: chord.part, pitches: chord.pitches }], chord.clefs, 0);
    draw();
    locked = false;
    tStart = performance.now();
    sel = { letter: null, alter: 0, q: null, inv: s.askInv && s.inversions ? null : 0 };
    collected.clear();
    showCollected();
    paintSel();
    ui.feedback.className = 'feedback';
    ui.feedback.textContent = ' ';
  }
  function draw() {
    layout = Render.score(sh.score, piece, { showTime: false, showKey: false, endBar: false, width: Math.min(300, sh.score.clientWidth) });
    if (chord && chord.res) Render.mark(layout.onsets[0].notes, chord.res);
  }
  function playChord(arp) {
    const t = AudioEng.now() + 0.03;
    chord.pitches.forEach((p, i) => AudioEng.piano(Theory.midiOf(p), t + (arp ? i * 0.12 : 0), 1.4, 0.5));
  }

  function finish(ok) {
    locked = true;
    sess.n++;
    if (ok) { sess.ok++; sess.streak++; } else sess.streak = 0;
    Store.chordResult(chord.q, ok);
    chord.res = ok ? 'ok' : 'bad';
    Render.mark(layout.onsets[0].notes, chord.res);
    const naming = App.prefs.naming;
    const name = `${Theory.chordName(chord.letter, chord.alter, chord.q, naming)} (${Theory.chordSymbol(chord.letter, chord.alter, chord.q)})` +
      (s.inversions ? ` · ${INV_NAMES[chord.inv]}` : '');
    ui.feedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
    ui.feedback.textContent = (ok ? '✓ ' : '✗ התשובה: ') + name;
    if (s.sound || !ok) playChord(true);
    updateStats();
    ui.nextT = setTimeout(next, ok ? 900 : 2200);
  }

  function showCollected() {
    if (!ui.collected || s.answer !== 'piano') return;
    const naming = App.prefs.naming;
    ui.collected.textContent = collected.size ? [...collected].sort((a, b) => a - b).map(m => Theory.midiName(m, naming)).join('  ·  ') : 'עדיין לא נוגנו צלילים';
  }
  function onInput(e) {
    if (e.type !== 'on' || s.answer !== 'piano' || locked || !chord) return;
    collected.add(e.midi);
    showCollected();
    const want = new Set(chord.pitches.map(p => Theory.mod(Theory.midiOf(p), 12)));
    const got = new Set([...collected].map(m => Theory.mod(m, 12)));
    if (got.size < want.size) return;
    let ok = got.size === want.size && [...want].every(x => got.has(x));
    if (ok && s.askInv && s.inversions) ok = Theory.mod(Math.min(...collected), 12) === Theory.mod(Theory.midiOf(chord.pitches[0]), 12);
    finish(ok);
  }

  function updateStats() {
    ui.stats.innerHTML = '';
    ui.stats.append(
      h('div', {}, h('b', {}, `${sess.ok}/${sess.n}`), h('small', {}, 'נכונות')),
      h('div', {}, h('b', {}, sess.n ? UI.pct(sess.ok / sess.n) : '–'), h('small', {}, 'דיוק')),
      h('div', {}, h('b', {}, sess.streak), h('small', {}, 'רצף')));
  }
  function endSession(silent) {
    if (!sess.n) return;
    const score = sess.ok / sess.n;
    Store.session('chords', { n: sess.n, ok: sess.ok, score, level: s.level });
    if (!silent) UI.resultCard(sh, { title: 'סיכום אקורדים', score, lines: [['תשובות', sess.n], ['נכונות', sess.ok]], actions: [['המשך', () => { sh.results.innerHTML = ''; }, 'primary']] });
    sess = { n: 0, ok: 0, streak: 0 };
    updateStats();
  }

  return {
    init,
    enter() { Input.setKeyboard(s.answer === 'piano'); if (!chord) next(); else draw(); },
    leave() { clearTimeout(ui.nextT); Input.setKeyboard(false); endSession(true); if (chord && locked) next(); },
    onInput,
    onResize() { if (piece) draw(); },
    onPrefs() { buildSettings(); buildPad(); paintSel(); },
  };
})();
