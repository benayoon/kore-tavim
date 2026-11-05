'use strict';
/* זיהוי תווים: שורות של צלילים בודדים, תשובה בשמות או בנגינה */
const QuizMode = (() => {
  const USER_KEYS = { staff: 'treble', perRow: 4, answer: 'names', exact: false, timeLimit: 0, focusWeak: true, autoLevel: true, sound: true, notes: 1, spread: 4 };
  const LETTER_KEYS = { KeyC: 0, KeyD: 1, KeyE: 2, KeyF: 3, KeyG: 4, KeyA: 5, KeyB: 6 };
  let sh, s, refresh, row = [], idx = 0, sub = 0, layout, piece, acc = 0, tStart = 0, locked = false, active = false;
  const played = new Set();
  let sess, recent = [], timerRaf = 0;
  const ui = {};

  const range = (clef, label) => ({ type: 'noteRange', clef, label, show: v => v.staff === clef || (v.staff === 'grand' && (clef === 'treble' || clef === 'bass')) });
  const schema = [
    { type: 'level', key: 'level' },
    { type: 'select', key: 'staff', label: 'מפתח', options: [['treble', 'מפתח סול'], ['bass', 'מפתח פה'], ['grand', 'שני המפתחות (מערכת כפולה)'], ['alto', 'מפתח דו – אלט'], ['tenor', 'מפתח דו – טנור']] },
    { type: 'heading', label: 'שליטה ברמת הקושי' },
    { type: 'chips', key: 'notes', single: true, label: 'כמה צלילים בכל פעם', options: [[1, 'תו בודד'], [2, 'שני צלילים'], [3, 'שלושה צלילים']] },
    { type: 'chips', key: 'spread', single: true, label: 'מרווח בין הצלילים (עד)', show: v => v.notes > 1, options: [[2, 'טרצה'], [4, 'קווינטה'], [5, 'סקסטה'], [7, 'אוקטבה']] },
    { type: 'range', key: 'accProb', label: 'סימנים מקריים', min: 0, max: 0.4, step: 0.02, fmt: UI.pct },
    { type: 'chips', key: 'answer', single: true, label: 'דרך התשובה', options: [['names', 'שמות התווים'], ['piano', 'נגינה']] },
    { type: 'toggle', key: 'exact', label: 'דרוש גם אוקטבה נכונה', show: v => v.answer === 'piano' },
    { type: 'select', key: 'perRow', label: 'תווים בשורה', num: true, options: [[1, 'תו אחד'], [4, '4 תווים'], [8, '8 תווים']] },
    { type: 'select', key: 'timeLimit', label: 'הגבלת זמן לתו', num: true, options: [[0, 'ללא'], [5, '5 שניות'], [3, '3 שניות'], [2, '2 שניות'], [1.5, '1.5 שניות']] },
    { type: 'toggle', key: 'focusWeak', label: 'התמקד בתווים שבהם טעיתי' },
    { type: 'toggle', key: 'autoLevel', label: 'התאמת רמה אוטומטית' },
    { type: 'toggle', key: 'sound', label: 'השמע את הצליל אחרי תשובה' },
    { type: 'group', label: 'סימני היתק', fields: [
      { type: 'keys', key: 'keys', label: 'סולמות' },
    ] },
    { type: 'group', label: 'טווח', fields: [
      range('treble', 'מפתח סול'), range('bass', 'מפתח פה'), range('alto', 'מפתח דו – אלט'), range('tenor', 'מפתח דו – טנור'),
    ] },
  ];

  function init(view) {
    sh = UI.shell(view, 'זיהוי תווים', 'קראו כל צליל מהר ככל האפשר. המערכת זוכרת באילו תווים טעיתם ומחזירה אותם יותר.');
    s = Store.load('quiz', Levels.apply(Object.assign({}, USER_KEYS, { staff: Curriculum.defaultStaff('treble') }), Levels.quiz(2)));
    resetSession();
    buildSettings();
    ui.stats = h('div', { class: 'quiz-stats' });
    sh.toolbar.append(
      h('div', { class: 'tb-group' }, UI.btn('שורה חדשה', () => newRow(), '', 'dice'), UI.btn('סיום ושמירה', () => endSession(), '')),
      ui.stats);
    ui.timer = h('div', { class: 'timer' }, h('i'));
    ui.feedback = h('div', { class: 'feedback' }, ' ');
    ui.pad = h('div', { class: 'answer-pad' });
    sh.below.append(ui.timer, ui.feedback, ui.pad);
    buildPad();
    updateStats();
  }
  const save = () => Store.save('quiz', s);
  function buildSettings() {
    refresh = UI.settingsForm(sh.settings, schema, s, (key, val) => {
      if (key === 'level') Levels.apply(s, Levels.quiz(val)); else Levels.onEdit(s, key, Levels.quiz);
      buildSettings();
      save();
      if (key === 'answer') { buildPad(); Input.setKeyboard(s.answer === 'piano'); }
      if (['level', 'staff', 'perRow', 'keys', 'accProb', 'ranges', 'notes', 'spread'].includes(key)) newRow();
    });
  }
  function resetSession() { sess = { n: 0, ok: 0, streak: 0, best: 0, time: 0, t0: Date.now() }; recent = []; }

  function buildPad() {
    ui.pad.innerHTML = '';
    const naming = App.prefs.naming;
    if (s.answer === 'piano') {
      ui.pad.append(h('p', { class: 'pad-hint' }, Mic.enabled() ? 'נגנו את הצליל בכלי. המיקרופון מקשיב.' : 'נגנו את הצליל במקלדת שלמטה, במקשי המחשב (A–L) או במקלדת MIDI.'));
      return;
    }
    ui.accBtns = [[-1, '♭'], [0, '♮'], [1, '♯']].map(([a, l]) => h('button', { class: 'acc-btn', onclick: () => setAcc(a) }, l));
    ui.pad.append(
      h('div', { class: 'acc-row' }, ui.accBtns),
      h('div', { class: 'name-row' }, Theory.LETTERS.map((L, i) => h('button', { class: 'name-btn', onclick: () => answerName(i) },
        h('b', {}, Theory.letterName(i, naming)), h('small', {}, naming === 'letters' ? Theory.SOLFEGE[i] : L)))),
      h('p', { class: 'pad-hint' }, 'מקלדת: C D E F G A B או 1–7 · חץ למעלה = ♯ · חץ למטה = ♭'));
    setAcc(0);
  }
  function setAcc(a) {
    acc = a;
    if (ui.accBtns) ui.accBtns.forEach((b, i) => b.classList.toggle('on', i - 1 === a));
  }

  function weight(clef, step) {
    if (!s.focusWeak) return 1;
    const r = Store.item('notes', `${clef}:${step}`);
    if (!r) return 1.6;
    const err = 1 - r.c / r.a, slow = r.t / r.a > 3000 ? 0.6 : 0;
    return 1 + err * 5 + slow;
  }

  function newRow() {
    if (!sh) return;
    clearTimeout(ui.nextT);
    const clefs = s.staff === 'grand' ? ['treble', 'bass'] : [s.staff];
    const fifths = Gen.pick(s.keys);
    row = [];
    let prev = null;
    for (let i = 0; i < s.perRow; i++) {
      const part = clefs.length > 1 ? Gen.randInt(0, 1) : 0;
      const clef = clefs[part];
      const [lo, hi] = s.ranges[clef];
      const n = s.notes || 1;
      const top = Math.max(lo, hi - (n - 1) * 2);
      const cands = [];
      for (let x = lo; x <= top; x++) if (x !== prev) cands.push(x);
      const step = Gen.pick(cands.length ? cands : [lo], x => weight(clef, x));
      const steps = [step];
      for (let j = 1; j < n; j++) {
        const last = steps[steps.length - 1], opts = [];
        for (let g = 1; g <= s.spread; g++) if (last + g <= hi + 2) opts.push(g);
        steps.push(last + (opts.length ? Gen.pick(opts, g => (g === 1 ? 0.4 : g === 2 ? 3 : 1.5)) : 2));
      }
      const pitches = steps.map(st => {
        const l = Theory.letterOf(st);
        let alter = Theory.keyAlter(fifths, l);
        if (Math.random() < s.accProb / n) {
          const o = [alter - 1, alter + 1].filter(a => a >= -1 && a <= 1 && !Theory.weird(l, a));
          if (o.length) alter = Gen.pick(o);
        }
        return { step: st, alter };
      });
      row.push({ part, clef, pitches });
      prev = step;
    }
    piece = Gen.rowPiece(row, clefs, fifths);
    draw();
    idx = 0; locked = false;
    focus();
  }
  function draw() {
    const narrow = s.perRow === 1;
    layout = Render.score(sh.score, piece, {
      showTime: false, endBar: false, maxPerLine: s.perRow, minMeasureW: 64,
      width: narrow ? Math.min(340, sh.score.clientWidth) : undefined,
    });
    row.forEach((it, i) => it.res && Render.mark(layout.onsets[i].notes, it.res));
  }
  function focus() {
    UI.placeCursor(sh, layout, idx, 'quiz');
    tStart = performance.now();
    sub = 0;
    played.clear();
    setAcc(0);
    if (row[idx] && row[idx].pitches.length > 1) {
      ui.feedback.className = 'feedback hint';
      ui.feedback.textContent = s.answer === 'names'
        ? `נקבו בשמות ${row[idx].pitches.length} הצלילים, מלמטה למעלה (1/${row[idx].pitches.length})`
        : `נגנו את ${row[idx].pitches.length} הצלילים יחד או בזה אחר זה`;
    }
    startTimer();
  }
  function startTimer() {
    cancelAnimationFrame(timerRaf);
    const bar = ui.timer.firstChild;
    ui.timer.hidden = !s.timeLimit;
    if (!s.timeLimit) return;
    const lim = s.timeLimit * 1000;
    const tick = () => {
      const f = (performance.now() - tStart) / lim;
      bar.style.width = Math.max(0, 100 - f * 100) + '%';
      bar.classList.toggle('late', f > 0.7);
      if (f >= 1) { if (!locked) finish(false, true); return; }
      timerRaf = requestAnimationFrame(tick);
    };
    timerRaf = requestAnimationFrame(tick);
  }

  // בשמות: צליל אחרי צליל מלמטה למעלה; טעות אחת פוסלת את כל הקבוצה
  function answerName(letter) {
    if (locked || !row[idx]) return;
    const it = row[idx], p = it.pitches[sub];
    const ok = letter === Theory.letterOf(p.step) && acc === p.alter;
    if (ok && sub < it.pitches.length - 1) {
      sub++;
      setAcc(0);
      ui.feedback.className = 'feedback ok';
      ui.feedback.textContent = `✓ ${Theory.pitchName(p, App.prefs.naming, true)} · עכשיו הצליל הבא (${sub + 1}/${it.pitches.length})`;
      return;
    }
    finish(ok);
  }
  // בנגינה: אוספים צלילים עד שמספרם שווה לקבוצה, ואז משווים
  function answerMidi(m) {
    if (locked || !row[idx]) return;
    const targets = row[idx].pitches.map(p => Theory.midiOf(p));
    const norm = x => (s.exact ? x : Theory.mod(x, 12));
    if (targets.length === 1) return finish(norm(m) === norm(targets[0]));
    played.add(norm(m));
    const want = new Set(targets.map(norm));
    if (!want.has(norm(m))) return finish(false);
    if ([...want].every(x => played.has(x))) finish(true);
  }

  function finish(ok, timeout) {
    locked = true;
    cancelAnimationFrame(timerRaf);
    const it = row[idx];
    const ms = performance.now() - tStart;
    const naming = App.prefs.naming;
    // סטטיסטיקה לכל צליל: בקבוצה – הצלילים שזוהו לפני הטעות נחשבים נכונים
    it.pitches.forEach((p, j) => {
      const good = ok || (s.answer === 'names' && j < sub);
      Store.noteResult(`${it.clef}:${p.step}`, good, ms / it.pitches.length);
      // סימן היתק וסימן מקרי נמדדים בנפרד מקריאת המיקום על החמשה
      const inKey = Theory.keyAlter(piece.key.fifths, Theory.letterOf(p.step));
      if (p.alter !== inKey) Store.record('acc', p.alter > inKey ? 'up' : 'down', good, ms);
      else if (inKey !== 0) Store.record('keys', String(piece.key.fifths), good, ms);
    });
    sess.n++; sess.time += ms;
    if (ok) { sess.ok++; sess.streak++; sess.best = Math.max(sess.best, sess.streak); } else sess.streak = 0;
    it.res = ok ? 'ok' : 'bad';
    Render.mark(layout.onsets[idx].notes, it.res);
    const name = it.pitches.map(p => Theory.pitchName(p, naming, true)).join(' · ');
    ui.feedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
    ui.feedback.textContent = ok ? `✓ ${name}` : `${timeout ? 'נגמר הזמן' : '✗'} · התשובה: ${name}`;
    if (s.sound || !ok) it.pitches.forEach(p => AudioEng.piano(Theory.midiOf(p), AudioEng.now() + 0.02, 0.8, 0.5));
    updateStats();
    recent.push({ ok, ms });
    autoLevel();
    ui.nextT = setTimeout(() => {
      locked = false;
      idx++;
      if (idx >= row.length) newRow(); else focus();
    }, ok ? 280 : 1200);
  }

  function autoLevel() {
    if (!s.autoLevel || recent.length < 20) return;
    const okN = recent.filter(r => r.ok).length / recent.length;
    const avg = recent.reduce((a, r) => a + r.ms, 0) / recent.length;
    recent = [];
    let to = s.level;
    if (okN >= 0.9 && avg < 2500 && s.level < 10) to++;
    else if (okN < 0.6 && s.level > 1) to--;
    if (to === s.level) return;
    const up = to > s.level;
    Levels.apply(s, Levels.quiz(to));
    save(); buildSettings();
    UI.toast(up ? `כל הכבוד! עליתם לרמה ${to}` : `ירדנו לרמה ${to} כדי לחזק את הבסיס`, up ? 'ok' : '');
  }

  function updateStats() {
    const avg = sess.n ? (sess.time / sess.n / 1000).toFixed(1) : '–';
    ui.stats.innerHTML = '';
    ui.stats.append(
      h('div', {}, h('b', {}, `${sess.ok}/${sess.n}`), h('small', {}, 'נכונות')),
      h('div', {}, h('b', {}, sess.n ? UI.pct(sess.ok / sess.n) : '–'), h('small', {}, 'דיוק')),
      h('div', {}, h('b', {}, sess.streak), h('small', {}, `רצף (שיא ${sess.best})`)),
      h('div', {}, h('b', {}, avg), h('small', {}, 'שניות לתו')));
  }

  function endSession(silent) {
    if (!sess.n) return;
    const score = sess.ok / sess.n;
    Store.session('quiz', { n: sess.n, ok: sess.ok, score, level: s.level, avgMs: Math.round(sess.time / sess.n) });
    if (!silent) {
      UI.resultCard(sh, {
        title: 'סיכום הסשן', score,
        lines: [['תשובות', sess.n], ['נכונות', sess.ok], ['רצף שיא', sess.best], ['זמן ממוצע לתו', `${(sess.time / sess.n / 1000).toFixed(1)} שנ׳`]],
        actions: [['סשן חדש', () => { sh.results.innerHTML = ''; newRow(); }, 'primary'], ['לתווים החלשים שלי', () => App.show('progress'), '']],
      });
    }
    resetSession();
    updateStats();
  }

  function onKey(e) {
    if (s.answer !== 'names' || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.code in LETTER_KEYS) { answerName(LETTER_KEYS[e.code]); return true; }
    const d = /^Digit([1-7])$/.exec(e.code);
    if (d) { answerName(+d[1] - 1); return true; }
    if (e.code === 'ArrowUp') { setAcc(Math.min(1, acc + 1)); return true; }
    if (e.code === 'ArrowDown') { setAcc(Math.max(-1, acc - 1)); return true; }
    return false;
  }

  return {
    init,
    enter() { active = true; Input.setKeyboard(s.answer === 'piano'); if (!row.length) newRow(); else draw(), focus(); },
    leave() { active = false; cancelAnimationFrame(timerRaf); clearTimeout(ui.nextT); locked = false; Input.setKeyboard(false); endSession(true); },
    onInput(e) { if (e.type === 'on' && s.answer === 'piano') answerMidi(e.midi); },
    onKey,
    onResize() { if (piece) { draw(); UI.placeCursor(sh, layout, idx, 'quiz'); } },
    onPrefs() { buildSettings(); buildPad(); draw(); },
    focusWeak(clef) { s.focusWeak = true; if (clef) s.staff = clef; save(); buildSettings(); newRow(); },
  };
})();
