'use strict';
/* האימון שלי: תכנית יומית מותאמת לנגן, בלוקים קצרים מתחלפים והתקדמות הדרגתית */
const PathMode = (() => {
  const LETTER_KEYS = { KeyC: 0, KeyD: 1, KeyE: 2, KeyF: 3, KeyG: 4, KeyA: 5, KeyB: 6 };
  const TIPS = [
    'טעיתם? ממשיכים. לא עוצרים לתקן.',
    'עדיף לשמור על הפעמה ולהחמיץ תו מאשר לעצור.',
    'קשה מדי? אפשר להוריד צלילים, והעיקר להמשיך.',
    'עיניים על התווים, לא על הידיים.',
    'נצלו צלילים ארוכים כדי להציץ קדימה.',
  ];
  let root, profile, inst, st, session = null;
  const on = { input: null, key: null };

  const naming = () => App.prefs.naming;
  const minutes = () => profile.minutes || 10;

  function init(view) {
    root = h('div', { class: 'path' });
    view.append(root);
    profile = Store.active();
    if (!profile) return;
    inst = Curriculum.INSTRUMENTS[profile.instrument];
    st = Curriculum.load(profile);
  }

  // ---- דף הבית ----
  // מטרות היום לפי אורך האימון
  const GOALS = { 5: { notes: 12, rhythm: 6, read: 1 }, 10: { notes: 28, rhythm: 12, read: 2 }, 20: { notes: 56, rhythm: 24, read: 4 } };
  function dayRings(date, size, stroke) {
    const t = Store.stats.trend[date] || {}, g = GOALS[minutes()] || GOALS[10];
    const n = k => (t[k] ? t[k].a : 0);
    return { vals: { notes: n('notes'), rhythm: n('rhythms'), read: n('read') }, goal: g,
      el: () => UI.rings([UI.ringOf('notes', n('notes') / g.notes), UI.ringOf('rhythm', n('rhythms') / g.rhythm), UI.ringOf('read', n('read') / g.read)], size, stroke) };
  }
  function ringLegend(r) {
    // ברור מה נספר: כמה עשיתם היום, ומה היעד
    const row = (cls, label, v, goal) => h('div', { class: 'legend-row ' + cls }, h('small', {}, label), h('b', {}, String(v)),
      h('span', { class: 'legend-goal' }, v >= goal ? `✓ היעד של ${goal} הושג` : `היעד להיום: ${goal}`));
    return h('div', { class: 'ring-legend' },
      row('c-notes', 'תווים שזיהיתם היום', r.vals.notes, r.goal.notes), row('c-rhythm', 'מקצבים שתרגלתם היום', r.vals.rhythm, r.goal.rhythm), row('c-read', 'קטעים שקראתם היום', r.vals.read, r.goal.read));
  }
  function weekStrip() {
    const names = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
    const box = h('div', { class: 'week' });
    for (let i = 6; i >= 0; i--) {
      const date = Store.today(i), d = new Date(Date.now() - i * 864e5);
      box.append(h('div', { class: 'week-day' + (i === 0 ? ' today' : '') }, h('small', {}, names[d.getDay()]), dayRings(date, 38, 4).el()));
    }
    return box;
  }

  // ---- דף הבית ----
  function home() {
    App.dock(false);
    root.innerHTML = '';
    const plan = Curriculum.plan(st, inst, minutes());
    const streak = Store.streak();
    const doneToday = Store.stats.history.some(e => e.m === 'path' && e.d === Store.today());
    const dateText = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    root.append(h('header', { class: 'hero' },
      h('p', { class: 'eyebrow' }, dateText),
      h('h1', {}, `${doneToday ? 'יפה' : 'שלום'}, ${profile.name}`),
      h('p', { class: 'hero-sub' }, doneToday ? 'האימון של היום מאחוריכם. התקדמות נבנית בעיקר מיום ליום.' : 'כמה דקות ביום, קצת מכל דבר, חומר חדש בכל פעם.')));

    const mins = [5, 10, 20];
    const minSeg = h('div', { class: 'seg-control', role: 'group', 'aria-label': 'אורך האימון' }, mins.map(m => h('button', {
      type: 'button', class: m === minutes() ? 'on' : '', 'aria-pressed': String(m === minutes()),
      onclick: () => { Store.updateProfile({ minutes: m }); profile.minutes = m; home(); },
    }, `${m} דק׳`)));
    UI.segThumb(minSeg, 3, mins.indexOf(minutes()), 'minutes');
    const today = dayRings(Store.today(), 188, 21);
    root.append(h('div', { class: 'bento' },
      h('section', { class: 'tile tile-today' },
        h('div', { class: 'today-rings' }, today.el(), ringLegend(today)),
        h('div', { class: 'today-cta' }, minSeg, UI.btn(doneToday ? 'עוד אימון' : 'מתחילים', start, 'primary big', 'play'))),
      h('section', { class: 'tile tile-streak' },
        h('p', { class: 'eyebrow' }, 'רצף'),
        h('div', { class: 'streak-num' }, h('b', {}, streak), h('span', {}, streak === 1 ? 'יום' : 'ימים')),
        weekStrip())));

    root.append(h('section', { class: 'panel' },
      h('h3', {}, 'התכנית להיום'),
      h('ol', { class: 'plan' }, plan.map((b, i) => h('li', {}, UI.sq(BLOCK_GLYPH[b.type] || 'practice'), h('div', {}, h('b', {}, b.title),
        plan.findIndex(x => x.type === b.type) === i ? h('small', {}, b.why) : null)))),
      h('p', { class: 'help' }, 'הבלוקים מתחלפים בכוונה. זה מרגיש קשה יותר מלתרגל דבר אחד ברצף, וזה בסדר גמור.')));

    root.append(h('section', { class: 'panel' }, h('h3', {}, 'איפה אתם עכשיו'), h('div', { class: 'tracks' }, trackCards())));
    root.append(researchBox());
  }
  const BLOCK_GLYPH = { notes: 'quiz', rhythm: 'rhythm', shapes: 'shapes', ear: 'ear', chords: 'chords', read: 'sight' };

  function trackCards() {
    const cards = [];
    inst.clefs.forEach(c => {
      const r = Curriculum.rangeAt(c, st.pitch[c]);
      const next = Curriculum.rangeAt(c, st.pitch[c] + 1).added;
      cards.push(track('quiz', `מפתח ${Curriculum.CLEF_NAMES[c]}`, `פתוחים ${r.hi - r.lo + 1} מתוך ${Curriculum.totalNotes(c)} תווים`, `מ־${Theory.stepLabel(r.lo, naming())} עד ${Theory.stepLabel(r.hi, naming())}`,
        next != null && st.pitch[c] < Curriculum.maxPitchStage(c) ? `התו הבא: ${Theory.stepLabel(next, naming())}` : 'כל התווים נפתחו', `pitch:${c}`));
    });
    const nextR = Curriculum.RHYTHM_STAGES[st.rhythm + 1];
    cards.push(track('rhythm', 'קצב', `פתוחים ${Curriculum.cellsAt(st).length} מתוך ${Curriculum.totalCells()} מקצבים`, `טמפו ${st.rtempo}`, nextR ? `המקצב הבא: ${Cells.label(nextR.cells[0])}` : 'כל המקצבים נפתחו', 'rhythm'));
    const ks = Curriculum.keysAt(st);
    const nextK = Curriculum.KEY_ORDER[st.keys + 1];
    cards.push(track('keys', 'סולמות', `פתוחים ${ks.length} מתוך ${Curriculum.KEY_ORDER.length} סולמות`, null, nextK != null ? `הסולם הבא: ${Theory.keyName(nextK, 'major', naming())}` : 'כל הסולמות נפתחו', 'keys'));
    const back = st.readBack || 0;
    const sc = Curriculum.readScope(st, inst), c0 = inst.clefs[0];
    const size = stage => { const r = Curriculum.rangeAt(c0, stage); return r.hi - r.lo + 1; };
    const scopeTxt = back ? `בקריאה עכשיו: ${size(sc.pitch[c0])} מתוך ${size(st.pitch[c0])} התווים הפתוחים` : 'בקריאה: כל החומר שפתחתם';
    cards.push(track('sight', 'קריאה', `טמפו ${st.tempo}`, inst.grand ? `${scopeTxt} · ${Curriculum.TEXTURES[sc.texture].name}` : scopeTxt,
      back ? 'קריאה נקייה מחזירה תווים ומקצבים, באותו טמפו' : 'כשקשה, מצמצמים תווים ומקצבים ולא מאטים', null));
    return cards;
  }
  function track(glyph, title, big, now, next, tr) {
    const a = tr ? Curriculum.acc(st, tr) : null;
    const fill = tr ? Math.round(Math.min(100, (a == null ? 0 : a) / Curriculum.TARGET * 100 * ((st.recent[tr] || []).length / Curriculum.WINDOW))) : 0;
    return h('div', { class: 'track' },
      h('div', { class: 'track-head' }, UI.sq(glyph), h('span', {}, title)),
      h('b', {}, big), now ? h('span', {}, now) : null, h('small', {}, next),
      tr ? h('div', { class: 'meter', 'aria-hidden': 'true' }, h('i', { style: `width:${fill}%` })) : null,
      tr ? h('small', { class: 'meter-cap' }, `הדרך לפריט הבא: ${fill}%`) : null);
  }

  function researchBox() {
    const rows = [
      ['תרגול קריאה יומי של חומר חדש', 'תרגול הסביר כ־45% מהשונות במיומנות הקריאה', 'מתאמי', 'https://www.psychologicalscience.org/news/releases/musical-skill-reflects-working-memory-capacity-in-addition-to-practice-time.html'],
      ['בלוק שמיעה ומסיכת קריאה', 'אימון שמיעתי וקריאה מבוקרת הועילו, באפקט קטן', 'מטא־אנליזה', 'https://profiles.umsl.edu/en/publications/improving-sightreading-accuracy-a-meta-analysis/'],
      ['בלוק קצב בכל מחזור', 'תכנית עם אימון קצב שיפרה קריאה', 'ניסוי', 'https://research.monash.edu/en/publications/sight-reading-for-advanced-pianists/'],
      ['תרגול צורות ותאים קצביים', 'תרגול תבניות לפני קריאה הועיל', 'ניסוי קטן, 43 נבדקים', 'https://repository.lsu.edu/music_pubs/40'],
      ['בלוקים מתחלפים', 'ערבוב נטה לטובה, רוב ההבדלים לא מובהקים', 'ניסוי קטן, 10 נבדקים', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027/'],
      ['התקדמות סביב 85% הצלחה', 'נגזר ממודלים ומשימות פשוטות, כאן רק כלל אצבע', 'הכללה זהירה', 'https://experts.arizona.edu/en/publications/the-eighty-five-percent-rule-for-optimal-learning/'],
      ['הצצה קדימה קטנה בלבד', 'הטווח קטן גם אצל מומחים, וגמישות חשובה יותר ממרחק', 'סקירה', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8612695/'],
    ];
    return h('details', { class: 'panel research' }, h('summary', {}, 'על מה התכנית מבוססת'),
      h('p', { class: 'help' }, 'רמת הראיות לא אחידה, ורוב האפקטים קטנים. קראתי בעיקר תקצירים. החזרה המרווחת על תווים היא היסק מספרות למידה כללית, ולא מחקר על תווים.'),
      h('table', { class: 'hist' }, h('tr', {}, h('th', {}, 'באפליקציה'), h('th', {}, 'מה נמצא'), h('th', {}, 'ראיות')),
        rows.map(([a, b, c, u]) => h('tr', {}, h('td', {}, a), h('td', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, b)), h('td', {}, c)))));
  }

  // ---- ניהול אימון ----
  function start() {
    // פעם ראשונה במיקרופון: קודם בודקים שהוא שומע את הכלי
    if (profile.input === 'mic' && !Store.active().micChecked) { Profiles.micCheck(start); return; }
    session = { blocks: Curriculum.plan(st, inst, minutes()), i: -1, results: [], unlocked: [], t0: Date.now() };
    next();
  }
  function next() {
    cleanup();
    session.i++;
    if (session.i >= session.blocks.length) return finish();
    const b = session.blocks[session.i];
    const sh = stageShell(b);
    const done = res => { session.results.push({ ...res, type: b.type, title: b.title }); Curriculum.save(st); next(); };
    BLOCKS[b.type](sh, b, done);
  }
  function cleanup() {
    Player.stop();
    on.input = null; on.key = null;
    Input.setKeyboard(false);
    App.inputSound = true;
    Piano.clear('hint');
    clearTimeout(cleanup.t);
  }
  function stageShell(b) {
    root.innerHTML = '';
    const toolbar = h('div', { class: 'toolbar' }), info = h('div', { class: 'info' });
    const score = h('div', { class: 'score' }), cursor = h('div', { class: 'cursor', hidden: true }), overlay = h('div', { class: 'overlay' });
    const paper = h('div', { class: 'paper' }, score, cursor, overlay);
    const below = h('div', { class: 'below' }), results = h('div', { class: 'results' });
    root.append(h('div', { class: 'stage' },
      h('div', { class: 'stage-top' },
        h('div', { class: 'stage-dots', 'aria-label': `בלוק ${session.i + 1} מתוך ${session.blocks.length}` }, session.blocks.map((x, i) => h('i', { class: i < session.i ? 'done' : i === session.i ? 'on' : '' }))),
        UI.btn('סיום מוקדם', () => { cleanup(); finish(); }, 'ghost small')),
      h('div', { class: 'work-head block-head' }, UI.sq(BLOCK_GLYPH[b.type] || 'practice'), h('div', {}, h('h1', {}, b.title), h('p', {}, b.why))),
      toolbar, info, paper, below, results));
    return { toolbar, info, paper, score, cursor, overlay, below, results };
  }
  function advance(track, ok) {
    Curriculum.push(st, track, ok);
    const msg = Curriculum.tryAdvance(st, track);
    if (msg) { session.unlocked.push(msg); UI.toast(msg.text, 'ok'); Curriculum.save(st); }
  }

  // ---- פקדים משותפים ----
  function namePad(onName, showAcc) {
    const n = naming();
    let acc = 0;
    let accBtns = [];
    const setAcc = a => { acc = a; accBtns.forEach((b, i) => b.classList.toggle('on', i - 1 === a)); };
    accBtns = [[-1, '♭'], [0, '♮'], [1, '♯']].map(([a, l]) => h('button', { class: 'acc-btn', 'aria-label': l, onclick: () => setAcc(a) }, l));
    const pad = h('div', { class: 'answer-pad' },
      showAcc ? h('div', { class: 'acc-row' }, accBtns) : null,
      h('div', { class: 'name-row' }, Theory.LETTERS.map((L, i) => h('button', { class: 'name-btn', onclick: () => onName(i, acc) },
        h('b', {}, Theory.letterName(i, n)), h('small', {}, n === 'letters' ? Theory.SOLFEGE[i] : L)))));
    setAcc(0);
    return {
      el: pad, reset: () => setAcc(0),
      key(e) {
        if (e.code in LETTER_KEYS) { onName(LETTER_KEYS[e.code], acc); return true; }
        const d = /^Digit([1-7])$/.exec(e.code);
        if (d) { onName(+d[1] - 1, acc); return true; }
        if (showAcc && e.code === 'ArrowUp') { setAcc(Math.min(1, acc + 1)); return true; }
        if (showAcc && e.code === 'ArrowDown') { setAcc(Math.max(-1, acc - 1)); return true; }
        return false;
      },
    };
  }
  function introCard(sh, title, text, drawFn, onGo, extra) {
    sh.below.innerHTML = '';
    sh.below.append(h('div', { class: 'intro-card' }, h('h3', {}, title), h('p', {}, text), extra || null, UI.btn('הבנתי', onGo, 'primary')));
    drawFn();
    on.key = e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onGo(); return true; } return false; };
  }
  const rowOpts = n => ({ showTime: false, endBar: false, maxPerLine: n, minMeasureW: 64, width: n === 1 ? 320 : undefined });

  const BLOCKS = {};

  // ---- זיהוי תווים ----
  BLOCKS.notes = (sh, b, done) => {
    const clef = b.clef;
    const { lo, hi, added } = Curriculum.rangeAt(clef, st.pitch[clef]);
    const useKeys = st.keys > 0, useAcc = st.keys >= 4;
    let row = [], idx = 0, piece, layout, tStart = 0, locked = false, ok = 0, total = 0;
    const fb = h('div', { class: 'feedback' }, ' ');
    const pad = namePad((l, a) => answer(l, a), useKeys || useAcc);
    const count = h('span', { class: 'tag strong' });

    function run() {
      sh.below.innerHTML = '';
      sh.below.append(fb, pad.el);
      sh.info.append(h('span', { class: 'tag' }, `מפתח ${Curriculum.CLEF_NAMES[clef]}`), count);
      on.input = e => { if (e.type === 'on') answerMidi(e.midi); };
      on.key = e => pad.key(e);
      if (Mic.enabled()) {
        Mic.start();
        sh.below.append(h('p', { class: 'pad-hint' }, 'נגנו את התו שעל החמשה, או לחצו על השם שלו.'));
      }
      newRow();
    }
    function newRow() {
      const fifths = useKeys ? Curriculum.pickKey(st) : 0;
      let prev = null;
      row = [];
      for (let i = 0; i < 4; i++) {
        const c = Curriculum.noteWeights(st, clef).filter(w => w[0] !== prev);
        const step = Gen.pick(c.length ? c : [[lo, 1]], w => w[1])[0];
        const l = Theory.letterOf(step);
        let alter = Theory.keyAlter(fifths, l);
        if (useAcc && Math.random() < 0.08) {
          const o = [alter - 1, alter + 1].filter(a => a >= -1 && a <= 1 && !Theory.weird(l, a));
          if (o.length) alter = Gen.pick(o);
        }
        row.push({ part: 0, step, alter, pitches: [{ step, alter }], fifths });
        prev = step;
      }
      piece = Gen.rowPiece(row, [clef], fifths);
      layout = Render.score(sh.score, piece, rowOpts(4));
      idx = 0; focus();
    }
    function focus() {
      UI.placeCursor(sh, layout, idx, 'quiz');
      tStart = performance.now();
      pad.reset();
      count.textContent = `${Math.min(total + 1, b.count)} מתוך ${b.count}`;
    }
    function answer(letter, acc) {
      if (locked) return;
      const it = row[idx];
      settle(letter === Theory.letterOf(it.step), acc === it.alter);
    }
    function answerMidi(m) {
      if (locked) return;
      const it = row[idx], same = Theory.mod(m - Theory.midiOf(it), 12) === 0;
      settle(same, same);
    }
    function settle(letterOk, alterOk) {
      locked = true;
      const it = row[idx], ms = performance.now() - tStart, full = letterOk && alterOk;
      total++; if (full) ok++;
      Store.record('notes', `${clef}:${it.step}`, letterOk, ms);
      const inKey = Theory.keyAlter(it.fifths, Theory.letterOf(it.step));
      if (it.alter !== inKey) Store.record('acc', it.alter > inKey ? 'up' : 'down', full, ms);
      else if (inKey !== 0) { Store.record('keys', String(it.fifths), full, ms); advance('keys', full); }
      // נכון אבל איטי לא מקדם: המטרה היא זיהוי מיידי
      advance(`pitch:${clef}`, letterOk && ms < 6000);
      Render.mark(layout.onsets[idx].notes, full ? 'ok' : 'bad');
      const name = Theory.pitchName(it, naming(), true);
      fb.className = 'feedback ' + (full ? 'ok' : 'bad');
      fb.textContent = full ? `✓ ${name}` : `✗ התשובה: ${name}`;
      if (!full) AudioEng.piano(Theory.midiOf(it), AudioEng.now() + 0.02, 0.7, 0.55);
      cleanup.t = setTimeout(() => {
        locked = false;
        if (total >= b.count) return done({ total, ok, score: ok / total });
        idx++;
        if (idx >= row.length) newRow(); else focus();
      }, full ? 240 : 1200);
    }
    // תו חדש: מציגים אותו עם השם והמיקום לפני התרגול
    const unseen = s => { const r = Store.item('notes', `${clef}:${s}`); return !r || r.a === 0; };
    let intro = [];
    if (added != null && unseen(added)) intro = [added];
    else if (st.pitch[clef] === 0) { for (let s = lo; s <= hi; s++) if (unseen(s)) intro.push(s); }
    if (!intro.length) return run();
    const p = Gen.rowPiece(intro.map(s => ({ part: 0, pitches: [{ step: s, alter: 0 }] })), [clef], 0);
    introCard(sh, intro.length === 1 ? 'תו חדש' : 'התווים הראשונים',
      intro.map(s => `${Theory.pitchName({ step: s, alter: 0 }, naming(), true)}: ${Curriculum.placeText(clef, s)}`).join(' · '),
      () => {
        Render.score(sh.score, p, { ...rowOpts(intro.length), showNames: true, naming: naming() });
        intro.forEach((s, i) => AudioEng.piano(Theory.midiOf({ step: s, alter: 0 }), AudioEng.now() + 0.05 + i * 0.5, 0.45, 0.55));
      },
      () => { on.key = null; run(); });
  };

  // ---- קצב ----
  BLOCKS.rhythm = (sh, b, done) => {
    let n = 0, pts = 0, totalNotes = 0, okNotes = 0, piece, layout, rec = null, phase = 'idle';
    const pad = h('button', { class: 'tap-pad', onpointerdown: e => { e.preventDefault(); tap(AudioEng.now()); } }, h('b', {}, 'הקישו כאן'), h('small', {}, 'או מקש רווח'));
    const startBtn = UI.btn('הקישו', () => go(), 'primary', 'tap');
    const listenBtn = UI.btn('האזנה', () => listen(), '', 'ear');
    const nextBtn = UI.btn('הבא', () => after(), 'primary');
    const line = h('div', { class: 'feedback' }, ' ');

    function setup() {
      App.inputSound = false;
      sh.toolbar.innerHTML = '';
      sh.toolbar.append(h('div', { class: 'tb-group' }, listenBtn, startBtn, nextBtn));
      sh.below.innerHTML = '';
      sh.below.append(line, pad);
      on.input = e => { if (e.type === 'on') onTap(e.time); };
      on.key = e => {
        if (e.code !== 'Space') return false;
        e.preventDefault();
        if (e.repeat) return true;
        if (phase === 'idle') go(); else if (phase === 'done') after(); else onTap(AudioEng.now());
        return true;
      };
      newOne();
    }
    function newOne() {
      const time = Curriculum.pickTime(st), ti = Gen.timeInfo(time);
      piece = Gen.rhythmPiece({
        times: [time], measures: ti.L >= 4 ? 2 : 3, cells: Curriculum.cellsFor(st, ti), cellWeight: id => Curriculum.cellWeight(st, id),
      });
      layout = Render.score(sh.score, piece, { maxPerLine: 4 });
      sh.info.innerHTML = '';
      sh.info.append(h('span', { class: 'tag strong' }, `משקל ${time}`), h('span', { class: 'tag' }, `טמפו ${st.rtempo}${ti.compound ? ' (ברבעים מנוקדים)' : ''}`), h('span', { class: 'tag' }, `${n + 1} מתוך ${b.count}`));
      line.className = 'feedback'; line.textContent = 'רווח כדי להתחיל';
      phase = 'idle';
      startBtn.hidden = false; listenBtn.hidden = false; nextBtn.hidden = true;
      pad.classList.remove('live');
    }
    function listen() {
      Player.start(piece, layout, {
        tempo: st.rtempo, metronome: true, sound: 'wood',
        onOnset: i => UI.placeCursor(sh, layout, i, 'play'), onCount: c => UI.countIn(sh, c),
        onEnd: () => { sh.cursor.hidden = true; },
      });
    }
    function go() {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      phase = 'rec'; rec = []; startBtn.hidden = true; listenBtn.hidden = true;
      pad.classList.add('live'); line.textContent = ' ';
      Player.start(piece, layout, {
        tempo: st.rtempo, metronome: true, mute: true, tail: 0.5,
        onOnset: i => UI.placeCursor(sh, layout, i, 'play'), onCount: c => UI.countIn(sh, c),
        onEnd: evaluate,
      });
    }
    function onTap(t) {
      if (phase !== 'rec') return;
      pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90);
      AudioEng.wood(AudioEng.now());
      rec.push({ t, used: false });
    }
    function tap(t) { if (phase === 'rec') onTap(t); else if (phase === 'idle') go(); }
    function evaluate() {
      const r = Scoring.taps(layout, rec);
      sh.cursor.hidden = true;
      Object.entries(r.statuses).forEach(([i, s]) => Render.mark(layout.onsets[i].notes, s));
      Scoring.logCells(layout);
      r.res.forEach(x => { totalNotes++; if (x.st === 'ok') okNotes++; advance('rhythm', x.st !== 'bad'); });
      pts += r.score;
      if (r.score >= 0.9) st.rtempo = Math.min(160, st.rtempo + 3);
      if (r.score < 0.5) st.rtempo = Math.max(40, st.rtempo - 4);
      const ms = Math.round(Math.abs(r.avg) * 1000);
      line.className = 'feedback ' + (r.score >= 0.7 ? 'ok' : 'bad');
      line.textContent = `${UI.pct(r.score)} · ${r.missed ? `${r.missed} הוחמצו · ` : ''}${ms < 15 ? 'בזמן' : `${ms}ms ${r.avg > 0 ? 'מאחרים' : 'מקדימים'}`}`;
      phase = 'done'; nextBtn.hidden = false; pad.classList.remove('live');
    }
    function after() {
      n++;
      if (n >= b.count) return done({ total: totalNotes, ok: okNotes, score: pts / b.count });
      newOne();
    }
    const fresh = Curriculum.newestCells(st).filter(id => { const r = Store.item('rhythms', id); return !r || r.a === 0; });
    if (!fresh.length) return setup();
    const box = h('div', { class: 'cell-row' });
    fresh.forEach(id => {
      const one = h('div', { class: 'cell-card' }), lab = h('small', {}, Cells.label(id));
      box.append(h('div', { class: 'cell-wrap' }, one, lab));
      setTimeout(() => Cells.drawOne(one, id), 0);
    });
    introCard(sh, fresh.length === 1 ? 'מקצב חדש' : 'המקצבים שמתחילים איתם', 'נקראים כיחידה אחת. שימו לב איך הם נראים, ונסו להגיד אותם בקול לפני שמקישים.',
      () => { sh.paper.hidden = true; }, () => { on.key = null; sh.paper.hidden = false; setup(); }, box);
  };

  // ---- צורות: זיהוי תבנית בלי לקרוא תו־תו ----
  const SHAPES = {
    up: { name: 'צעדים עולים', mk: s => [s, s + 1, s + 2, s + 3], span: 3 },
    down: { name: 'צעדים יורדים', mk: s => [s + 3, s + 2, s + 1, s], span: 3 },
    triUp: { name: 'אקורד שבור עולה', mk: s => [s, s + 2, s + 4, s + 2], span: 4 },
    triDown: { name: 'אקורד שבור יורד', mk: s => [s + 4, s + 2, s, s + 2], span: 4 },
    wave: { name: 'שכן ובחזרה', mk: s => [s, s + 1, s, s + 1], span: 1 },
    jump: { name: 'קפיצה ובחזרה', mk: s => [s, s + 4, s, s + 4], span: 4 },
  };
  BLOCKS.shapes = (sh, b, done) => {
    const clef = inst.clefs[session.i % inst.clefs.length];
    const { lo, hi } = Curriculum.rangeAt(clef, st.pitch[clef]);
    const usable = Object.keys(SHAPES).filter(k => SHAPES[k].span <= hi - lo);
    let n = 0, ok = 0, cur, locked = false, tStart = 0, layout;
    const fb = h('div', { class: 'feedback' }, ' ');
    const opts = h('div', { class: 'q-row' });
    sh.below.append(fb, opts);
    function ask() {
      cur = Gen.pick(usable, k => Curriculum.weight('patterns', k, false));
      const shape = SHAPES[cur], s = Gen.randInt(lo, hi - shape.span);
      const fifths = st.keys > 0 ? Curriculum.pickKey(st) : 0;
      const evs = shape.mk(s).map((x, i) => ({
        key: 'q', code: 'q', dots: 0, q: 1, pos: i, start: i, m: 0, rest: false, pitches: [{ step: x, alter: Theory.keyAlter(fifths, Theory.letterOf(x)) }],
      }));
      const piece = { key: { fifths, mode: 'major' }, time: { num: 4, den: 4 }, ti: Gen.timeInfo('4/4'), parts: [{ clef, measures: [evs] }] };
      layout = Render.score(sh.score, piece, { showTime: false, endBar: false, width: 380 });
      const dist = usable.filter(k => k !== cur).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [cur, ...dist].sort(() => Math.random() - 0.5);
      opts.innerHTML = '';
      options.forEach((k, i) => opts.append(h('button', { class: 'q-btn', onclick: () => pick(k) }, h('b', {}, SHAPES[k].name), h('small', {}, String(i + 1)))));
      on.key = e => { const d = /^Digit([1-4])$/.exec(e.code); if (d && options[+d[1] - 1]) { pick(options[+d[1] - 1]); return true; } return false; };
      tStart = performance.now();
      fb.className = 'feedback'; fb.textContent = `מה הצורה? ${n + 1} מתוך ${b.count}`;
    }
    function pick(k) {
      if (locked) return;
      locked = true;
      const good = k === cur, ms = performance.now() - tStart;
      n++; if (good) ok++;
      Store.record('patterns', cur, good, ms);
      fb.className = 'feedback ' + (good ? 'ok' : 'bad');
      fb.textContent = good ? '✓ בדיוק' : `✗ זו הייתה: ${SHAPES[cur].name}`;
      layout.onsets.forEach(o => Render.mark(o.notes, good ? 'ok' : 'bad'));
      cleanup.t = setTimeout(() => {
        locked = false;
        if (n >= b.count) return done({ total: n, ok, score: ok / n });
        ask();
      }, good ? 450 : 1300);
    }
    ask();
  };

  // ---- מצאו את השינוי: מקשיבים ומשווים לכתוב ----
  BLOCKS.ear = (sh, b, done) => {
    let n = 0, ok = 0, piece, layout, audio, changed = null, phase = 'listen';
    const fb = h('div', { class: 'feedback' }, ' ');
    const playBtn = UI.btn('השמע שוב', () => play(), '', 'ear');
    const nextBtn = UI.btn('הבא', () => { n++; if (n >= b.count) done({ total: n, ok, score: ok / n }); else make(); }, 'primary');
    sh.toolbar.append(h('div', { class: 'tb-group' }, playBtn, nextBtn));
    sh.below.append(fb);
    sh.paper.classList.add('clickable');
    sh.paper.addEventListener('click', onClick);
    function make() {
      const clef = inst.clefs[(session.i + n) % inst.clefs.length];
      const s = Curriculum.readSettings(st, { clefs: inst.clefs }, { staff: clef, measures: 2, rhChord: 0, rhMax: 1, accProb: 0, cellWeight: id => Curriculum.cellWeight(st, id) });
      s.keys = [Curriculum.pickKey(st)]; s.mode = 'major';
      piece = Gen.piece(s);
      layout = Render.score(sh.score, piece, {});
      const notes = piece.parts[0].measures.flat().filter(e => !e.rest);
      const target = notes[Gen.randInt(1, Math.max(1, notes.length - 1))] || notes[0];
      const orig = target.pitches[0];
      const shift = Gen.pick([-2, -1, 1, 2]);
      // ההשמעה משתמשת בעותק, כדי שהכתוב יישאר כמות שהוא
      const step = orig.step + shift;
      changed = target;
      audio = { ...piece, parts: [{ ...piece.parts[0], measures: piece.parts[0].measures.map(m => m.map(e => (e === target ? { ...e, pitches: [Theory.pitchInKey(step, piece.key, e.deg)] } : e))) }] };
      phase = 'listen'; nextBtn.hidden = true; playBtn.hidden = false;
      fb.className = 'feedback'; fb.textContent = `הקשיבו: צליל אחד שונה מהכתוב. לחצו עליו. (${n + 1} מתוך ${b.count})`;
      play();
    }
    function play() {
      Player.start(audio, layout, {
        tempo: Math.max(50, st.tempo - 6), metronome: false, onCount: c => UI.countIn(sh, c),
        onOnset: i => UI.placeCursor(sh, layout, i, 'play'),
        onEnd: () => { sh.cursor.hidden = true; if (phase === 'listen') phase = 'answer'; },
      });
      phase = phase === 'done' ? 'done' : 'listen';
    }
    function onClick(ev) {
      if (phase === 'done') return;
      const r = layout.svg.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const sys = layout.systems.findIndex(s => y >= s.top && y <= s.bottom);
      const cands = layout.onsets.filter(o => o.midis.length && (sys < 0 || o.sys === sys));
      if (!cands.length) return;
      const near = cands.reduce((a, o) => (Math.abs(o.x + 6 - x) < Math.abs(a.x + 6 - x) ? o : a));
      Player.stop(); UI.countIn(sh, 0); sh.cursor.hidden = true;
      const good = near.evs.includes(changed);
      if (good) ok++;
      Store.record('ear', 'error', good);
      Render.mark(near.notes, good ? 'ok' : 'bad');
      if (!good) { const right = layout.onsets.find(o => o.evs.includes(changed)); if (right) Render.mark(right.notes, 'ok'); }
      fb.className = 'feedback ' + (good ? 'ok' : 'bad');
      fb.textContent = good ? '✓ שמעתם נכון' : '✗ השינוי היה בתו שמסומן בירוק';
      phase = 'done'; nextBtn.hidden = false;
    }
    const prevDone = done;
    done = res => { sh.paper.removeEventListener('click', onClick); prevDone(res); };
    nextBtn.hidden = true;
    make();
  };

  // ---- אקורדים ----
  BLOCKS.chords = (sh, b, done) => {
    const types = Curriculum.chordsAt(st);
    let n = 0, ok = 0, cur, layout, locked = false;
    const fb = h('div', { class: 'feedback' }, ' ');
    const opts = h('div', { class: 'q-row' });
    sh.below.append(fb, opts);
    const titleOf = c => Theory.chordName(c.letter, c.alter, c.q, naming());
    function mk(q) {
      for (let a = 0; a < 40; a++) {
        const letter = Gen.randInt(0, 6), alter = st.chords >= 4 ? Gen.pick([-1, 0, 0, 1]) : 0;
        if (Theory.weird(letter, alter)) continue;
        const ps = Theory.spellChord(28 + letter, alter, q);
        if (ps.some(p => Math.abs(p.alter) > 1)) continue;
        return { q, letter, alter, pitches: ps };
      }
      return { q: 'maj', letter: 0, alter: 0, pitches: Theory.spellChord(28, 0, 'maj') };
    }
    function ask() {
      cur = mk(Gen.pick(types, q => Curriculum.weight('chords', q, q === types[types.length - 1])));
      const piece = Gen.rowPiece([{ part: 0, pitches: cur.pitches }], ['treble'], 0);
      layout = Render.score(sh.score, piece, { showTime: false, showKey: false, endBar: false, width: 280 });
      const wrong = new Map();
      for (let a = 0; a < 40 && wrong.size < 3; a++) {
        const q = types.length > 1 && Math.random() < 0.6 ? Gen.pick(types) : cur.q;
        const c = Math.random() < 0.5 ? { ...cur, q } : mk(q);
        const t = titleOf(c);
        if (t !== titleOf(cur)) wrong.set(t, c);
      }
      const options = [titleOf(cur), ...wrong.keys()].sort(() => Math.random() - 0.5);
      const right = titleOf(cur);
      opts.innerHTML = '';
      options.forEach((t, i) => opts.append(h('button', { class: 'q-btn', onclick: () => pick(t === right) }, h('b', {}, t), h('small', {}, String(i + 1)))));
      on.key = e => { const d = /^Digit([1-4])$/.exec(e.code); if (d && options[+d[1] - 1]) { pick(options[+d[1] - 1] === right); return true; } return false; };
      fb.className = 'feedback'; fb.textContent = `איזה אקורד? ${n + 1} מתוך ${b.count}`;
    }
    function pick(good) {
      if (locked) return;
      locked = true;
      n++; if (good) ok++;
      Store.record('chords', cur.q, good);
      advance('chords', good);
      Render.mark(layout.onsets[0].notes, good ? 'ok' : 'bad');
      fb.className = 'feedback ' + (good ? 'ok' : 'bad');
      fb.textContent = good ? `✓ ${titleOf(cur)}` : `✗ התשובה: ${titleOf(cur)}`;
      cur.pitches.forEach(p => AudioEng.piano(Theory.midiOf(p), AudioEng.now() + 0.02, 0.9, 0.45));
      cleanup.t = setTimeout(() => {
        locked = false;
        if (n >= b.count) return done({ total: n, ok, score: ok / n });
        ask();
      }, good ? 700 : 1600);
    }
    ask();
  };

  // ---- קריאה מהדף: סריקה ואז נגינה בלי לעצור ----
  BLOCKS.read = (sh, b, done) => {
    const mode = profile.input || 'keys';
    // במיקרופון מקשיבים לצליל אחד בכל פעם, גם בפסנתר: יד אחת בלי אקורדים
    const readInst = mode === 'mic' ? { ...inst, grand: false, mono: !!inst.grand } : inst;
    const s = Curriculum.readSettings(st, readInst, { cellWeight: id => Curriculum.cellWeight(st, id) });
    const piece = Gen.piece(s);
    const layout = Render.score(sh.score, piece, {});
    const barsN = piece.parts[0].measures.length;
    const hard = Scoring.hardestMeasure(piece);
    UI.markMeasure(sh, layout, hard, 'הכי צפוף');
    const shortest = Math.min(...piece.parts.flatMap(p => p.measures.flat().filter(e => !e.ghost).map(e => e.q)));
    const shortLabel = shortest <= 0.25 ? 'שש־עשרית' : shortest < 0.5 ? 'טריולה' : shortest <= 0.5 ? 'שמינית' : shortest <= 1 ? 'רבע' : 'חצי';
    sh.info.append(
      h('span', { class: 'tag strong' }, Theory.keyName(piece.key.fifths, piece.key.mode, naming())),
      Curriculum.soundingText(Store.active(), piece.key.fifths, piece.key.mode, naming()) ? h('span', { class: 'tag' }, Curriculum.soundingText(Store.active(), piece.key.fifths, piece.key.mode, naming())) : null,
      h('span', { class: 'tag' }, `משקל ${piece.time.num}/${piece.time.den}`),
      h('span', { class: 'tag' }, `הערך הקצר: ${shortLabel}`),
      h('span', { class: 'tag' }, `טמפו ${st.tempo}`),
      st.readBack ? h('span', { class: 'tag' }, 'חומר מצומצם') : null);
    const tip = Gen.pick(TIPS);
    const bar = h('div', { class: 'timer' }, h('i'));
    // מסתירה תווים בכוונה, ולכן רק בבחירה מפורשת ובנגינה בזמן אמת
    const lookInp = h('input', { type: 'checkbox', checked: !!st.lookAhead, onchange: () => { st.lookAhead = lookInp.checked; Curriculum.save(st); } });
    const realTime = mode === 'midi' || mode === 'acoustic' || (mode === 'mic' && Math.min(...inst.clefs.map(c => st.pitch[c])) >= 4);
    const lookRow = realTime ? h('label', { class: 'field toggle look-row' }, h('span', {}, h('b', {}, 'קריאה קדימה'), h('small', {}, 'אתגר: התווים נעלמים רגע לפני שמנגנים אותם.')), lookInp, h('span', { class: 'switch' })) : null;
    const startRead = UI.btn(mode === 'keys' ? 'מתחילים' : 'מתחילים לנגן', () => begin(), 'primary big', 'play');
    sh.below.append(h('div', { class: 'intro-card' },
      h('h3', {}, 'סריקה לפני שמתחילים'),
      h('p', {}, 'בדקו את הסולם, המשקל והתיבה המסומנת. נסו לשמוע את הפתיחה בראש.'),
      h('p', { class: 'tip-line' }, tip), lookRow, bar, startRead));
    const lim = (8 + barsN) * 1000, t0 = performance.now();
    const tick = () => {
      const f = (performance.now() - t0) / lim;
      bar.firstChild.style.width = Math.max(0, 100 - f * 100) + '%';
      if (f < 1 && bar.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    on.key = e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(); return true; } return false; };

    function begin() {
      on.key = null;
      UI.clearMeasureMark(sh);
      sh.below.innerHTML = '';
      if (mode === 'midi') perform();
      // מתחילים במיקרופון בלי לחץ של זמן, ועוברים לזמן אמת כשיש כמה תווים ביד
      else if (mode === 'mic') { if (Math.min(...inst.clefs.map(c => st.pitch[c])) < 4) waitMode(); else perform(); }
      else if (mode === 'keys') waitMode();
      else acoustic();
    }
    function wrap(score, lines, note) {
      UI.clearMask(sh); sh.cursor.hidden = true; UI.countIn(sh, 0);
      Store.addBars(barsN);
      Store.record('read', 'reading', score >= 0.7);
      Mic.stop();
      const ups = Curriculum.afterRead(st, score, readInst);
      ups.forEach(u => { session.unlocked.push(u); UI.toast(u.text, 'ok'); });
      if (ups.change) note = note ? `${note} ${ups.change.text}` : ups.change.text;
      Curriculum.save(st);
      App.dock(false);
      UI.resultCard(sh, {
        title: 'סיימתם את הקטע', score, lines, note,
        actions: [['ממשיכים', () => done({ total: 1, ok: score >= 0.7 ? 1 : 0, score }), 'primary']],
      });
      on.key = e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); done({ total: 1, ok: score >= 0.7 ? 1 : 0, score }); return true; } return false; };
    }
    function perform() {
      const rec = [];
      if (mode === 'mic') Mic.start();
      on.input = e => { if (e.type === 'on') rec.push({ m: e.midi, t: e.time, used: false, src: e.src }); };
      sh.below.append(h('p', { class: 'tip' }, st.lookAhead ? 'קריאה קדימה פעילה: התווים נעלמים רגע לפני שמנגנים אותם.' : 'נגנו עם הסמן. טעיתם? ממשיכים.'));
      Player.start(piece, layout, {
        tempo: st.tempo, metronome: true, mute: true, tail: 0.6,
        onOnset: i => { UI.placeCursor(sh, layout, i, 'play'); if (st.lookAhead) UI.readingMask(sh, layout, i, 2 * piece.ti.group); },
        onCount: c => UI.countIn(sh, c),
        onEnd: () => {
          on.input = null;
          const r = Scoring.perform(layout, rec, Player.secPerQuarter(piece, st.tempo));
          UI.clearMask(sh);
          Object.entries(r.statuses).forEach(([i, x]) => Render.mark(layout.onsets[i].notes, x));
          wrap(r.score, [['מדויק', r.ok], ['כמעט', r.warn], ['הוחמצו', r.bad], ['עצירות', r.stops],
            ['נטייה', Math.abs(r.avgMs) < 15 ? 'בזמן' : `${Math.abs(r.avgMs)}ms ${r.avgMs > 0 ? 'מאחרים' : 'מקדימים'}`]],
          r.stops ? 'היו עצירות באמצע. בפעם הבאה נסו לשמור על הפעמה, גם אם תווים נופלים בדרך.' : null);
        },
      });
    }
    function waitMode() {
      if (mode !== 'mic') App.dock(true);
      Input.setKeyboard(true);
      const list = layout.onsets.map((o, i) => (o.midis.length ? i : -1)).filter(i => i >= 0);
      let k = 0, err = false, errors = 0, clean = 0, tf = performance.now();
      const got = new Set();
      const focus = () => {
        const onsetI = list[k];
        UI.placeCursor(sh, layout, onsetI, 'wait');
        Piano.scrollTo(layout.onsets[onsetI].midis[0]);
        tf = performance.now();
      };
      on.input = e => {
        if (e.type !== 'on') return;
        const i = list[k], o = layout.onsets[i];
        const matched = Scoring.hit(o, e);
        if (matched != null) {
          got.add(matched);
          if (e.src !== 'mic' && !o.midis.every(m => got.has(m))) return;
          const ms = performance.now() - tf;
          Render.mark(o.notes, err ? 'warn' : 'ok');
          if (!err) clean++;
          o.evs.forEach(ev => { if (!ev.rest) ev.pitches.forEach(p => Store.record('notes', `${ev.clef}:${p.step}`, !err, ms / ev.pitches.length)); });
          k++; got.clear(); err = false;
          if (k >= list.length) {
            on.input = null;
            Input.setKeyboard(false);
            const score = clean / list.length;
            wrap(score, [['נכון בניסיון הראשון', `${clean} מתוך ${list.length}`], ['טעויות', errors]],
              mode === 'mic' ? 'במצב המתנה מודדים רק גובה. בהמשך תעברו לנגינה בזמן אמת, ואז יימדד גם הקצב.' : 'במצב המתנה מודדים רק גובה. עם מקלדת MIDI נמדוד גם קצב ורציפות.');
          } else focus();
        } else {
          // במיקרופון הצליל הקודם עוד מהדהד רגע אחרי המעבר
          if (e.src === 'mic' && performance.now() - tf < 150) return;
          errors++; err = true;
          Render.mark(o.notes, 'bad');
          Piano.flash(e.midi, 'badkey');
          UI.flashCursor(sh, 'bad');
        }
      };
      focus();
    }
    function acoustic() {
      Player.start(piece, layout, {
        tempo: st.tempo, metronome: true, mute: true, tail: 0.3,
        onOnset: i => { UI.placeCursor(sh, layout, i, 'play'); if (st.lookAhead) UI.readingMask(sh, layout, i, 2 * piece.ti.group); },
        onCount: c => UI.countIn(sh, c),
        onEnd: () => {
          sh.cursor.hidden = true; UI.clearMask(sh);
          const box = h('div', { class: 'intro-card' }, h('h3', {}, 'איך היה?'), h('p', {}, 'הקשיבו איך זה היה אמור להישמע, ודרגו בכנות. הדירוג קובע את הקושי הבא.'),
            UI.btn('השמע', () => Player.start(piece, layout, { tempo: st.tempo, metronome: false, countIn: false, onOnset: i => UI.placeCursor(sh, layout, i, 'play'), onEnd: () => { sh.cursor.hidden = true; } }), '', 'ear'),
            h('div', { class: 'q-row rate' }, [['כמעט בלי טעויות', 0.95], ['כמה טעויות', 0.75], ['הרבה טעויות או עצירות', 0.4]].map(([l, v]) => h('button', {
              class: 'q-btn', onclick: () => { Player.stop(); box.remove(); wrap(v, [['הדירוג שלכם', l]], 'דירוג עצמי לא נכנס למפת התווים ולמפת הקצב, כי אי אפשר למדוד כל תו בנפרד.'); },
            }, h('b', {}, l)))));
          sh.below.innerHTML = '';
          sh.below.append(box);
        },
      });
    }
  };

  // ---- סיכום ----
  function finish() {
    const s = session;
    session = null;
    App.dock(false);
    const secs = Math.round((Date.now() - s.t0) / 1000);
    Store.addSeconds(secs);
    if (s.results.length) {
      const score = s.results.reduce((a, r) => a + r.score, 0) / s.results.length;
      st.sessions++;
      Store.session('path', { n: s.results.length, ok: s.results.filter(r => r.score >= 0.7).length, score, level: null, secs });
    }
    Curriculum.save(st);
    root.innerHTML = '';
    const weak = Object.entries(Store.stats.items.notes).filter(([, r]) => r.a >= 3 && r.ema < 0.7).length;
    const today = dayRings(Store.today(), 220, 25);
    root.append(h('header', { class: 'finish-hero' }, today.el(),
      h('h1', {}, 'סיימתם להיום'),
      h('p', { class: 'hero-sub' }, `${Math.max(1, Math.round(secs / 60))} דקות. ההתקדמות מתבססת בעיקר בין האימונים, אז נתראה מחר.`),
      ringLegend(today)));
    if (s.unlocked.length) root.append(h('section', { class: 'panel unlocked' }, h('h3', {}, 'נפתח לכם'), h('ul', {}, s.unlocked.map(u => h('li', {}, u.text)))));
    if (s.results.length) {
      root.append(h('section', { class: 'panel' }, h('h3', {}, 'מה עשינו'), h('div', { class: 'mode-rows' }, s.results.map(r =>
        h('div', { class: 'mode-row' }, h('span', {}, r.title), h('div', { class: 'meter' }, h('i', { style: `width:${r.score * 100}%` })), h('b', {}, UI.pct(r.score)))))));
    }
    root.append(h('section', { class: 'panel' }, h('h3', {}, 'למחר'),
      h('p', {}, `${Store.dueWithin(1)} פריטים יחזרו לתרגול${weak ? `, ${weak} מהם תווים שעדיין דורשים חיזוק` : ''}.`),
      h('div', { class: 'result-actions' }, UI.btn('לדף הבית', home, 'primary'), UI.btn('לפרופיל שלי', () => App.show('progress'), ''))));
  }

  return {
    init,
    enter() { if (!session && profile) home(); },
    leave() { if (session) { cleanup(); const s = session; finishSilently(s); } App.dock(null); },
    onInput(e) { on.input && on.input(e); },
    onKey(e) { return on.key ? on.key(e) : false; },
    onResize() {},
    onPrefs() { if (!session) home(); },
  };
  function finishSilently(s) {
    session = null;
    Store.addSeconds(Math.round((Date.now() - s.t0) / 1000));
    if (s.results.length) Store.session('path', { n: s.results.length, ok: s.results.filter(r => r.score >= 0.7).length, score: s.results.reduce((a, r) => a + r.score, 0) / s.results.length, level: null });
    Curriculum.save(st);
  }
})();
