'use strict';
/* מצב קריאה מהדף: קטע מלא, השמעה, מצב המתנה וביצוע בזמן אמת */
const SightMode = (() => {
  const USER_KEYS = { staff: 'grand', measures: 8, showNames: false, hands: 'both', metronome: true, hint: false, hearPerform: false, lookAhead: false, markHard: false };
  let sh, s, piece, layout, statuses = {};
  let waitSt = null, perfSt = null, refresh, tempoCtl, genTimer = 0;
  const btns = {};

  const range = (clef, label, cond) => ({ type: 'noteRange', clef, label, show: cond });
  const isGrand = v => v.staff === 'grand';
  const schema = [
    { type: 'level', key: 'level' },
    { type: 'select', key: 'staff', label: 'מפתח וידיים', options: Levels.STAFF_OPTS },
    { type: 'select', key: 'measures', label: 'אורך הקטע', num: true, options: [[4, '4 תיבות'], [8, '8 תיבות'], [12, '12 תיבות'], [16, '16 תיבות']] },
    { type: 'toggle', key: 'showNames', label: 'הצג שמות תווים (עזר למתחילים)' },

    { type: 'heading', label: 'שליטה ברמת הקושי', help: 'כל שינוי כאן יוצר קטע חדש מיד.' },
    { type: 'chips', key: 'res', single: true, label: 'רזולוציית קצב – הערך הקצר ביותר', options: Levels.RES_OPTS },
    { type: 'toggle', key: 'dots', label: 'כולל ערכים מנוקדים' },
    { type: 'toggle', key: 'trip', label: 'כולל טריולות', show: v => v.res === '8' || v.res === '16' },
    { type: 'chips', key: 'density', single: true, label: 'צפיפות קצבית', options: Levels.DENSITY_OPTS },
    { type: 'chips', key: 'rhMax', single: true, label: v => (isGrand(v) ? 'צלילים בו־זמנית – יד ימין' : 'צלילים בו־זמנית'), options: Levels.SIMUL_OPTS },
    { type: 'range', key: 'rhChord', label: 'באיזו תדירות יופיעו צלילים כפולים', min: 0.05, max: 0.6, step: 0.05, fmt: UI.pct, show: v => v.rhMax > 1 },
    { type: 'chips', key: 'lhMax', single: true, label: 'צלילים בו־זמנית – יד שמאל', show: isGrand, options: Levels.SIMUL_OPTS },
    { type: 'select', key: 'lhStyle', label: 'סגנון יד שמאל', show: isGrand, options: [['long', 'תווים ארוכים'], ['blocks', 'אקורדים בקצב'], ['broken', 'אקורד שבור (אלברטי)'], ['independent', 'קו מלודי עצמאי'], ['mixed', 'מעורב']] },
    { type: 'select', key: 'maxInt', label: 'גודל הקפיצות בין צלילים (עד)', num: true, options: Levels.INTERVALS },
    { type: 'range', key: 'accProb', label: 'סימנים מקריים (♯ ♭ ♮)', min: 0, max: 0.25, step: 0.01, fmt: UI.pct },
    { type: 'range', key: 'restProb', label: 'הפסקים', min: 0, max: 0.3, step: 0.02, fmt: UI.pct },

    { type: 'group', label: 'סולמות ומשקל', fields: [
      { type: 'keys', key: 'keys', label: 'סולמות (לפי סימני היתק)' },
      { type: 'chips', key: 'mode', single: true, label: 'אופי', options: [['major', "מז'ור"], ['minor', 'מינור'], ['both', 'שניהם']] },
      { type: 'chips', key: 'times', label: 'משקל', options: Levels.TIMES.map(t => [t, t]) },
    ] },
    { type: 'group', label: 'ערכי תווים – בחירה מפורטת', fields: [
      { type: 'chips', key: 'rhythm', label: 'ערכים שיופיעו בקטע', options: Levels.RHYTHM_OPTS },
      { type: 'toggle', key: 'sync', label: 'סינקופות' },
    ] },
    { type: 'group', label: 'טווח הצלילים', fields: [
      range('treble', 'טווח יד ימין (סול)', v => v.staff === 'grand' || v.staff === 'treble'),
      range('bass', 'טווח יד שמאל (פה)', v => v.staff === 'grand' || v.staff === 'bass'),
      range('alto', 'טווח (דו אלט)', v => v.staff === 'alto'),
      range('tenor', 'טווח (דו טנור)', v => v.staff === 'tenor'),
    ] },
  ];

  function init(view) {
    sh = UI.shell(view, 'קריאה מהדף', 'קטע חדש בכל פעם, לפי הרמה וההגדרות שלך. האזינו, נגנו במצב המתנה, או בצעו בזמן אמת מול מטרונום.');
    s = Levels.upgrade(Store.load('sight', Levels.apply(Object.assign({}, USER_KEYS, { staff: Curriculum.defaultStaff('grand') }), Levels.sight(2))));
    buildSettings();
    btns.gen = UI.btn('קטע חדש', () => generate(), 'primary', 'dice');
    btns.play = UI.btn('האזנה', () => (Player.isPlaying() && !perfSt ? stopAll() : play()), '', 'play');
    btns.wait = UI.btn('מצב המתנה', () => (waitSt ? stopAll() : startWait()), '', 'keys');
    btns.perf = UI.btn('ביצוע', () => (perfSt ? stopAll() : startPerform()), '', 'clock');
    tempoCtl = UI.tempoControl(() => s.tempo, v => { s.tempo = v; save(); });
    const options = UI.menu('אפשרויות', 'more', () => [
      { section: 'בזמן התרגול' },
      { label: 'מטרונום', checked: () => s.metronome, act: () => { s.metronome = !s.metronome; save(); } },
      { label: 'רמז במקלדת', checked: () => s.hint, act: () => { s.hint = !s.hint; save(); if (waitSt) focusWait(); } },
      { label: 'קריאה קדימה', checked: () => s.lookAhead, act: () => { s.lookAhead = !s.lookAhead; save(); } },
      { label: 'סימון התיבה הקשה', checked: () => s.markHard, act: () => { s.markHard = !s.markHard; save(); showHard(); } },
      { section: 'בהאזנה להשמיע' },
      ...[['both', 'שתי הידיים'], ['right', 'יד ימין'], ['left', 'יד שמאל']].map(([v, l]) => (
        { label: l, radio: true, checked: () => s.hands === v, act: () => { s.hands = v; save(); } })),
    ]);
    sh.toolbar.append(
      h('div', { class: 'tb-group' }, btns.gen, btns.play, btns.wait, btns.perf),
      h('div', { class: 'tb-group' }, tempoCtl, options));
    sh.below.append(h('p', { class: 'tip' },
      'טיפ: במצב המתנה הסמן מתקדם רק כשמנגנים את הצלילים הנכונים – ב־MIDI, במקלדת שעל המסך או במקשי המחשב (A S D F… ו־W E T Y U לקלידים השחורים).'));
    generate();
  }

  function buildSettings() {
    refresh = UI.settingsForm(sh.settings, schema, s, (key, val) => {
      if (key === 'level') {
        Levels.apply(s, Levels.sight(val));
        tempoCtl && tempoCtl.sync();
      } else Levels.onEdit(s, key, Levels.sight);
      buildSettings();
      save();
      clearTimeout(genTimer);
      genTimer = setTimeout(generate, 150);
    });
  }
  const save = () => Store.save('sight', s);

  function generate() {
    stopAll();
    piece = Gen.piece(s);
    statuses = {};
    sh.results.innerHTML = '';
    draw();
    const naming = App.prefs.naming;
    sh.info.innerHTML = '';
    sh.info.append(
      h('span', { class: 'tag strong' }, Theory.keyName(piece.key.fifths, piece.key.mode, naming)),
      soundTag(naming),
      h('span', { class: 'tag' }, `משקל ${piece.time.num}/${piece.time.den}`),
      h('span', { class: 'tag' }, `${s.measures} תיבות`),
      h('span', { class: 'tag' }, `רמה ${s.level} · ${Levels.NAMES[s.level]}`),
      h('span', { class: 'status', id: 'sight-status' }));
  }
  function soundTag(naming) {
    const t = Curriculum.soundingText(Store.active(), piece.key.fifths, piece.key.mode, naming);
    return t ? h('span', { class: 'tag' }, t) : null;
  }
  function setStatus(t) { const el = sh.info.querySelector('.status'); if (el) el.textContent = t || ''; }

  function draw() {
    if (!piece) return;
    layout = Render.score(sh.score, piece, { showNames: s.showNames, naming: App.prefs.naming });
    Object.entries(statuses).forEach(([i, st]) => layout.onsets[i] && Render.mark(layout.onsets[i].notes, st));
    if (waitSt) focusWait();
    else sh.cursor.hidden = true;
    showHard();
  }
  function showHard() {
    if (s.markHard && layout) UI.markMeasure(sh, layout, Scoring.hardestMeasure(piece), 'הכי צפוף');
    else UI.clearMeasureMark(sh);
  }

  function clearMarks() {
    statuses = {};
    layout.onsets.forEach(o => Render.mark(o.notes, null));
    sh.results.innerHTML = '';
  }
  function setButtons() {
    const playing = Player.isPlaying() && !perfSt;
    btns.play.querySelector('span:last-child').textContent = playing ? 'עצירה' : 'האזנה';
    btns.play.querySelector('.ic').innerHTML = playing ? UI.icon('stop').innerHTML : UI.icon('play').innerHTML;
    btns.wait.classList.toggle('active', !!waitSt);
    btns.wait.querySelector('span:last-child').textContent = waitSt ? 'סיום תרגול' : 'מצב המתנה';
    btns.perf.classList.toggle('active', !!perfSt);
    btns.perf.querySelector('span:last-child').textContent = perfSt ? 'עצירה' : 'ביצוע';
  }

  function stopAll() {
    Player.stop();
    waitSt = null; perfSt = null;
    if (sh) { sh.cursor.hidden = true; UI.countIn(sh, 0); UI.clearMask(sh); }
    Piano.clear('hint');
    Input.setKeyboard(false);
    App.inputSound = true;
    setStatus('');
    if (btns.play) setButtons();
  }

  function play() {
    stopAll();
    Player.start(piece, layout, {
      tempo: s.tempo, metronome: s.metronome, hands: s.hands,
      onOnset: i => UI.placeCursor(sh, layout, i, 'play'),
      onCount: n => UI.countIn(sh, n),
      onEnd: () => { sh.cursor.hidden = true; setButtons(); },
    });
    setButtons();
  }

  // ---- מצב המתנה ----
  function startWait() {
    stopAll();
    clearMarks();
    const list = layout.onsets.map((o, i) => (o.midis.length ? i : -1)).filter(i => i >= 0);
    waitSt = { list, k: 0, got: new Set(), err: false, errors: 0, clean: 0, t0: performance.now(), tf: performance.now() };
    Input.setKeyboard(true);
    setStatus('נגנו את הצלילים המסומנים – הסמן יתקדם רק כשהם נכונים');
    setButtons();
    focusWait();
  }
  function focusWait() {
    const i = waitSt.list[waitSt.k];
    UI.placeCursor(sh, layout, i, 'wait');
    Piano.clear('hint');
    const on = layout.onsets[i];
    waitSt.tf = performance.now();
    if (s.hint) Piano.mark(on.midis, 'hint');
    Piano.scrollTo(on.midis[0]);
  }
  function waitInput(e) {
    const i = waitSt.list[waitSt.k];
    const on = layout.onsets[i];
    const matched = Scoring.hit(on, e);
    if (matched != null) {
      waitSt.got.add(matched);
      if (e.src === 'mic' || on.midis.every(m => waitSt.got.has(m))) {
        statuses[i] = waitSt.err ? 'warn' : 'ok';
        if (!waitSt.err) waitSt.clean++;
        Render.mark(on.notes, statuses[i]);
        on.evs.forEach(ev => { if (!ev.rest) ev.pitches.forEach(p => Store.record('notes', `${ev.clef}:${p.step}`, !waitSt.err, (performance.now() - waitSt.tf) / ev.pitches.length)); });
        waitSt.k++; waitSt.got.clear(); waitSt.err = false;
        if (waitSt.k >= waitSt.list.length) finishWait();
        else focusWait();
      }
    } else {
      // במיקרופון הצליל הקודם עוד מהדהד רגע אחרי המעבר
      if (e.src === 'mic' && performance.now() - waitSt.tf < 150) return;
      waitSt.errors++; waitSt.err = true;
      Render.mark(on.notes, 'bad');
      Piano.flash(e.midi, 'badkey');
      UI.flashCursor(sh, 'bad');
    }
  }
  function finishWait() {
    const st = waitSt;
    const total = st.list.length, score = total ? st.clean / total : 0;
    const secs = Math.round((performance.now() - st.t0) / 1000);
    stopAll();
    Store.session('sight', { kind: 'wait', n: total, ok: st.clean, score, level: s.level });
    Store.addBars(s.measures);
    Store.record('read', 'reading', score >= 0.7);
    resultFor('סיימתם את הקטע!', score, [
      ['נוגנו נכון בניסיון הראשון', `${st.clean} מתוך ${total}`],
      ['טעויות', st.errors],
      ['זמן', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`],
    ], startWait);
  }

  // ---- ביצוע בזמן אמת ----
  function startPerform() {
    stopAll();
    clearMarks();
    perfSt = { rec: [] };
    Input.setKeyboard(true);
    Player.start(piece, layout, {
      tempo: s.tempo, metronome: true, mute: !s.hearPerform, tail: 0.6,
      onOnset: i => { UI.placeCursor(sh, layout, i, 'play'); if (s.lookAhead) UI.readingMask(sh, layout, i, 2 * piece.ti.group); },
      onCount: n => UI.countIn(sh, n),
      onEnd: finishPerform,
    });
    setStatus('נגנו יחד עם הסמן והמטרונום');
    setButtons();
  }
  function finishPerform() {
    const st = perfSt;
    if (!st) return;
    const r = Scoring.perform(layout, st.rec, Player.secPerQuarter(piece, s.tempo));
    statuses = r.statuses;
    Object.entries(statuses).forEach(([i, x]) => Render.mark(layout.onsets[i].notes, x));
    stopAll();
    Store.session('sight', { kind: 'perform', n: r.total, ok: r.ok, score: r.score, level: s.level });
    Store.addBars(s.measures);
    Store.record('read', 'reading', r.score >= 0.7);
    resultFor('תוצאות הביצוע', r.score, [
      ['מדויק', r.ok], ['כמעט (קצב/חלקי)', r.warn], ['הוחמצו', r.bad], ['צלילים מיותרים', r.extra],
      ['עצירות', r.stops],
      ['נטייה ממוצעת', r.avgMs === 0 ? 'מדויק' : `${Math.abs(r.avgMs)}ms ${r.avgMs > 0 ? 'מאחר' : 'מקדים'}`],
    ], startPerform);
  }

  function resultFor(title, score, lines, again) {
    let note = null;
    const acts = [['שוב', again, ''], ['קטע חדש', () => generate(), 'primary']];
    if (score >= 0.9 && s.level < 10) {
      note = 'מצוין! נראה שאתם מוכנים לרמה הבאה.';
      acts.push([`לרמה ${s.level + 1}`, () => { Levels.apply(s, Levels.sight(s.level + 1)); save(); buildSettings(); tempoCtl.sync(); generate(); }, '']);
    } else if (score < 0.5) note = 'נסו להאט את הטמפו או להפעיל את "רמז במקלדת".';
    UI.resultCard(sh, { title, score, lines, note, actions: acts });
  }

  function onInput(e) {
    if (e.type !== 'on') return;
    if (waitSt) waitInput(e);
    else if (perfSt) perfSt.rec.push({ m: e.midi, t: e.time, used: false, src: e.src });
  }

  return {
    init,
    enter() { if (piece && sh.score.clientWidth && Math.abs(layout.width - sh.score.clientWidth) > 20) draw(); },
    leave() { stopAll(); },
    onInput,
    onResize() { if (piece && Math.abs(layout.width - sh.score.clientWidth) > 20) draw(); },
    onPrefs() { buildSettings(); generate(); },
  };
})();
