'use strict';
/* מסלול הלמידה: מה נפתח מתי, מתי מתקדמים, ומה נכנס לאימון של היום */
const Curriculum = (() => {
  const INSTRUMENTS = {
    piano: { name: 'פסנתר / קלידים', clefs: ['treble', 'bass'], grand: true },
    treble: { name: 'כלי במפתח סול', sub: 'כינור, חליל, גיטרה, שירה…', clefs: ['treble'] },
    bass: { name: 'כלי במפתח פה', sub: 'צ׳לו, בס, בסון…', clefs: ['bass'] },
    alto: { name: 'מפתח דו אלט', sub: 'ויולה', clefs: ['alto'] },
    tenor: { name: 'מפתח דו טנור', sub: 'טרומבון, צ׳לו בגבוה', clefs: ['tenor'] },
  };
  const CLEF_NAMES = { treble: 'סול', bass: 'פה', alto: 'דו אלט', tenor: 'דו טנור' };
  const START_POINTS = {
    zero: { name: 'מתחילים מאפס', sub: 'עוד לא קוראים תווים', pitch: 0, rhythm: 0, keys: 0, texture: 0, chords: 0, tempo: 60 },
    basics: { name: 'מכירים את הבסיס', sub: 'קוראים מנגינות פשוטות לאט', pitch: 7, rhythm: 4, keys: 2, texture: 1, chords: 1, tempo: 66 },
    inter: { name: 'קוראים בינוני', sub: 'שתי ידיים, כמה סימני היתק', pitch: 14, rhythm: 8, keys: 5, texture: 3, chords: 3, tempo: 76 },
    adv: { name: 'קוראים מתקדמים', sub: 'רוצים לחדד ולמצוא נקודות תורפה', pitch: 22, rhythm: 13, keys: 10, texture: 5, chords: 6, tempo: 88 },
  };
  const INPUTS = {
    midi: { name: 'מקלדת MIDI מחוברת', sub: 'מדידה מלאה של גובה וקצב בזמן אמת' },
    mic: { name: 'כלי נגינה דרך המיקרופון', sub: 'האפליקציה מקשיבה לתו שמנגנים. לכלים של צליל אחד בכל פעם' },
    keys: { name: 'מקלדת על המסך / מקשי מחשב', sub: 'קריאה במצב המתנה, בלי לחץ של זמן' },
    acoustic: { name: 'כלי נגינה, בדירוג עצמי', sub: 'בלי מיקרופון: מנגנים עם הסמן ומדרגים לבד מול ההשמעה' },
  };

  // טרנספוזיציה: כמה חצאי טונים הכתוב גבוה מהצליל שנשמע (שלילי = הכלי נשמע גבוה מהכתוב).
  // המקורות מפורטים ב־RESEARCH.md
  const TRANSPOSERS = [
    { id: 'none', fam: 'C', semis: 0, name: 'בלי טרנספוזיציה', sub: 'כינור, ויולה, צ׳לו, חליל, אבוב, בסון, פסנתר, טרומבון במפתח פה' },
    { id: 'piccolo', fam: 'C', semis: -12, name: 'פיקולו' },
    { id: 'guitar', fam: 'C', semis: 12, name: 'גיטרה' },
    { id: 'bass', fam: 'C', semis: 12, name: 'קונטרבס, גיטרה בס' },
    { id: 'contrabassoon', fam: 'C', semis: 12, name: 'קונטרבסון' },
    { id: 'bassflute', fam: 'C', semis: 12, name: 'חליל בס' },
    { id: 'xylophone', fam: 'C', semis: -12, name: 'קסילופון, צ׳לסטה, חלילית סופרן' },
    { id: 'glock', fam: 'C', semis: -24, name: 'גלוקנשפיל' },
    { id: 'bb', fam: 'Bb', semis: 2, name: 'קלרינט, חצוצרה, קורנט, פליגלהורן, סקסופון סופרן' },
    { id: 'tenor', fam: 'Bb', semis: 14, name: 'סקסופון טנור' },
    { id: 'basscl', fam: 'Bb', semis: 14, name: 'קלרינט בס, במפתח סול' },
    { id: 'basscl-f', fam: 'Bb', semis: 2, name: 'קלרינט בס, במפתח פה' },
    { id: 'euph', fam: 'Bb', semis: 14, name: 'יופוניום, בריטון, טרומבון, במפתח סול' },
    { id: 'basssax', fam: 'Bb', semis: 26, name: 'סקסופון בס, טובה בסי♭ במפתח סול, קלרינט קונטרבס' },
    { id: 'picctpt', fam: 'Bb', semis: -10, name: 'חצוצרת פיקולו, סקסופון סופריו' },
    { id: 'alto', fam: 'Eb', semis: 9, name: 'סקסופון אלט, קלרינט אלט, קרן טנור' },
    { id: 'bari', fam: 'Eb', semis: 21, name: 'סקסופון בריטון, קלרינט קונטרה־אלט, טובה במי♭ במפתח סול' },
    { id: 'ebcl', fam: 'Eb', semis: -3, name: 'קלרינט במי♭, סקסופון סופרנינו' },
    { id: 'horn', fam: 'F', semis: 7, name: 'קרן יער, קרן אנגלית, קרן באסט' },
  ];
  const FAMILIES = [['C', 'C'], ['Bb', 'B♭'], ['Eb', 'E♭'], ['F', 'F']];
  const INTERVAL_NAMES = { 2: 'סקונדה גדולה', 3: 'טרצה קטנה', 7: 'קווינטה', 9: 'סקסטה גדולה', 10: 'ספטימה קטנה', 12: 'אוקטבה', 14: 'נונה גדולה', 21: 'אוקטבה וסקסטה גדולה', 24: 'שתי אוקטבות', 26: 'שתי אוקטבות וסקונדה גדולה' };
  function intervalText(semis) {
    if (!semis) return 'נשמע כמו שכתוב';
    return `נשמע ${INTERVAL_NAMES[Math.abs(semis)] || `${Math.abs(semis)} חצאי טונים`} ${semis > 0 ? 'מתחת לכתוב' : 'מעל הכתוב'}`;
  }
  // פרופילים ישנים שמרו רק מספר חצאי טונים
  function transposer(p) {
    const list = TRANSPOSERS;
    return (p && list.find(t => t.id === p.transposeId)) || list.find(t => t.semis === ((p && p.transpose) || 0)) || list[0];
  }
  // מה באמת נשמע: הסולם הנשמע, או רק האוקטבה אם הסולם זהה
  function soundingText(p, fifths, mode, naming) {
    const semis = transposer(p).semis;
    if (!semis || (p.input !== 'mic' && p.input !== 'acoustic')) return null;
    if (semis % 12 === 0) return intervalText(semis);
    let d = Theory.mod(-semis * 7, 12);
    if (d > 6) d -= 12;
    let f = fifths + d;
    if (f > 7) f -= 12;
    if (f < -7) f += 12;
    return `נשמע: ${Theory.keyName(f, mode, naming)}`;
  }

  // ---- תווים: תו חדש אחד בכל שלב ----
  const NOTE_PLAN = {
    treble: { start: [28, 30], cap: [22, 47], seq: 'uuuuu' }, // דו4–מי4, ואז עד דו5, ואז לסירוגין
    bass: { start: [21, 23], cap: [10, 34], seq: 'uuuuu' },
    alto: { start: [27, 29], cap: [17, 39], seq: 'uuuu' },
    tenor: { start: [25, 27], cap: [15, 37], seq: 'uuuu' },
  };
  function rangeAt(clef, stage) {
    const pl = NOTE_PLAN[clef];
    let [lo, hi] = pl.start, added = null, dir = 'd';
    for (let i = 0; i < stage; i++) {
      let d = pl.seq[i];
      if (!d) { d = dir === 'd' ? 'u' : 'd'; dir = d; }
      if (d === 'u' && hi >= pl.cap[1]) d = 'd';
      if (d === 'd' && lo <= pl.cap[0]) d = 'u';
      if (d === 'u' && hi >= pl.cap[1]) break;
      if (d === 'u') { hi++; added = hi; } else { lo--; added = lo; }
    }
    return { lo, hi, added };
  }
  const maxPitchStage = clef => { const p = NOTE_PLAN[clef]; return (p.cap[1] - p.cap[0]) - (p.start[1] - p.start[0]); };
  const MAX_INT = [2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 7];

  // ---- קצב: תא חדש בכל שלב (+ משקל חדש לפעמים) ----
  const RHYTHM_STAGES = [
    { cells: ['w', 'h', 'q'], times: ['4/4'] },
    { cells: ['rq'] },
    { cells: ['h.'], times: ['3/4'] },
    { cells: ['8,8'], times: ['2/4'] },
    { cells: ['rh'] },
    { cells: ['q.,8'] },
    { cells: ['c|q.', 'c|8,8,8', 'c|h.'], times: ['6/8'] },
    { cells: ['r8,8'] },
    { cells: ['c|q,8'] },
    { cells: ['8,r8'] },
    { cells: ['16,16,16,16'] },
    { cells: ['8,16,16'] },
    { cells: ['16,16,8'] },
    { cells: ['c|8,q'], times: ['12/8'] },
    { cells: ['8.,16'] },
    { cells: ['trip,trip,trip'] },
    { cells: ['8,q,8'], times: ['5/4'] },
    { cells: ['16,8,16'] },
    { cells: ['c|16,16,8,8'], times: ['9/8'] },
    { cells: ['16,8.'] },
  ];
  // ---- סולמות לפי סדר נפוץ ----
  const KEY_ORDER = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7];
  // ---- אקורדים ----
  const CHORD_ORDER = ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'hdim7', 'dim7'];
  // ---- מרקם: כמה קורה בו־זמנית ----
  const TEXTURES = [
    { name: 'יד אחת בכל פעם', hands: 'one', rhChord: 0, rhMax: 1, lhStyle: 'long', lhMax: 1 },
    { name: 'שתי ידיים, יד שמאל בצלילים ארוכים', hands: 'both', rhChord: 0, rhMax: 1, lhStyle: 'long', lhMax: 1 },
    { name: 'יד שמאל בקצב', hands: 'both', rhChord: 0, rhMax: 1, lhStyle: 'blocks', lhMax: 1 },
    { name: 'צמדי צלילים ביד שמאל', hands: 'both', rhChord: 0, rhMax: 1, lhStyle: 'blocks', lhMax: 2 },
    { name: 'צמדי צלילים בשתי הידיים', hands: 'both', rhChord: 0.12, rhMax: 2, lhStyle: 'blocks', lhMax: 2 },
    { name: 'אקורדים ביד שמאל', hands: 'both', rhChord: 0.15, rhMax: 2, lhStyle: 'mixed', lhMax: 3 },
    { name: 'אקורדים בשתי הידיים', hands: 'both', rhChord: 0.22, rhMax: 3, lhStyle: 'mixed', lhMax: 3 },
    { name: 'מרקם מלא', hands: 'both', rhChord: 0.3, rhMax: 4, lhStyle: 'mixed', lhMax: 4 },
  ];
  // כלי של קול אחד לא מנגן אקורדים: המרקם שלו נשאר קו מלודי
  const SINGLE_LINE_MAX = 0;

  // מפתח ברירת מחדל בתרגול החופשי, לפי הכלי של הנגן
  function defaultStaff(fallback) {
    const p = Store.active(), inst = p && INSTRUMENTS[p.instrument];
    if (!inst) return fallback;
    return inst.grand ? fallback : inst.clefs[0];
  }

  // ---- מצב הנגן ----
  function fresh(profile) {
    const inst = INSTRUMENTS[profile.instrument];
    const sp = START_POINTS[profile.start] || START_POINTS.zero;
    const pitch = {};
    inst.clefs.forEach(c => { pitch[c] = Math.min(sp.pitch, maxPitchStage(c)); });
    return {
      pitch, rhythm: sp.rhythm, keys: sp.keys, chords: sp.chords, texture: inst.grand ? sp.texture : SINGLE_LINE_MAX,
      tempo: sp.tempo, rtempo: sp.tempo, recent: {}, readStreak: 0, mask: false, unlocked: [], lastHand: 'L', sessions: 0,
    };
  }
  const load = profile => Store.load('progress', fresh(profile));
  const save = st => Store.save('progress', st);

  const cellsAt = st => RHYTHM_STAGES.slice(0, st.rhythm + 1).flatMap(s => s.cells);
  const timesAt = st => RHYTHM_STAGES.slice(0, st.rhythm + 1).flatMap(s => s.times || []);
  const keysAt = st => KEY_ORDER.slice(0, st.keys + 1);
  const chordsAt = st => CHORD_ORDER.slice(0, st.chords + 1);
  const newestCells = st => RHYTHM_STAGES[st.rhythm].cells;

  // משקל לפריט: חדש, חלש או שהגיע זמן חזרה עולים יותר; שלוט – פחות
  function weight(cat, id, isNewest) {
    const r = Store.item(cat, id);
    if (isNewest && (!r || r.a < 6)) return 5;
    if (!r || r.a === 0) return 2.5;
    let w = 1;
    if (r.ema < 0.7) w += 4;
    if (Store.isDue(r)) w += 2;
    if (Store.mastery(r) === 'mastered') w *= 0.5;
    return w;
  }

  // ---- התקדמות: כלל אצבע של 85% על 12 ניסיונות אחרונים ----
  const WINDOW = 12, TARGET = 0.85;
  function push(st, track, ok) {
    const a = st.recent[track] || (st.recent[track] = []);
    a.push(ok ? 1 : 0);
    if (a.length > WINDOW) a.shift();
  }
  const acc = (st, track) => { const a = st.recent[track] || []; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
  const full = (st, track) => (st.recent[track] || []).length >= WINDOW;

  function newestOk(cat, id) {
    const r = Store.item(cat, id);
    return !id || (r && r.a >= 3 && r.ema >= 0.6);
  }
  // מחזיר תיאור של מה שנפתח, או null
  function tryAdvance(st, track) {
    if (!full(st, track) || acc(st, track) < TARGET) return null;
    let msg = null;
    if (track.startsWith('pitch:')) {
      const clef = track.slice(6), s = st.pitch[clef];
      if (s >= maxPitchStage(clef)) return null;
      const { added } = rangeAt(clef, s);
      if (added != null && !newestOk('notes', `${clef}:${added}`)) return null;
      st.pitch[clef] = s + 1;
      const next = rangeAt(clef, s + 1).added;
      msg = { track, kind: 'note', clef, step: next, text: `תו חדש במפתח ${CLEF_NAMES[clef]}: ${Theory.stepLabel(next, App.prefs.naming)}` };
    } else if (track === 'rhythm') {
      if (st.rhythm >= RHYTHM_STAGES.length - 1) return null;
      if (!newestCells(st).some(id => newestOk('rhythms', id))) return null;
      st.rhythm++;
      const s = RHYTHM_STAGES[st.rhythm];
      msg = { track, kind: 'rhythm', cell: s.cells[0], text: `מקצב חדש: ${Cells.label(s.cells[0])}${s.times ? ` · משקל ${s.times[0]}` : ''}` };
    } else if (track === 'keys') {
      if (st.keys >= KEY_ORDER.length - 1) return null;
      st.keys++;
      const f = KEY_ORDER[st.keys];
      msg = { track, kind: 'key', text: `סולם חדש: ${Theory.keyName(f, 'major', App.prefs.naming)}` };
    } else if (track === 'chords') {
      if (st.chords >= CHORD_ORDER.length - 1) return null;
      st.chords++;
      msg = { track, kind: 'chord', text: `אקורד חדש: ${Theory.QUALITIES[CHORD_ORDER[st.chords]].name}` };
    }
    if (msg) { st.recent[track] = []; st.unlocked.push({ ...msg, d: Store.today() }); }
    return msg;
  }

  // אחרי קטע קריאה: טמפו ומרקם
  function afterRead(st, score, inst) {
    const out = [];
    if (score >= 0.9) st.tempo = Math.min(160, st.tempo + 4);
    if (score < 0.6) st.tempo = Math.max(40, st.tempo - 6);
    st.mask = score >= 0.85;
    if (score >= 0.85) {
      st.readStreak++;
      const enough = Math.min(...inst.clefs.map(c => st.pitch[c])) >= 4 + st.texture;
      if (st.readStreak >= 2 && inst.grand && enough && st.texture < TEXTURES.length - 1) {
        st.texture++;
        st.readStreak = 0;
        st.tempo = Math.max(40, st.tempo - 6); // מרקם קשה יותר, טמפו נמוך יותר
        const text = `מרקם חדש: ${TEXTURES[st.texture].name}`;
        st.unlocked.push({ track: 'texture', kind: 'texture', text, d: Store.today() });
        out.push({ track: 'texture', kind: 'texture', text });
      }
    } else st.readStreak = 0;
    return out;
  }

  // ---- הגדרות לקטע קריאה ----
  function readSettings(st, inst, overrides = {}) {
    const tx = TEXTURES[st.texture];
    let staff;
    if (inst.grand && !inst.mono && tx.hands === 'both') staff = 'grand';
    else if (inst.grand || inst.mono) { st.lastHand = st.lastHand === 'L' ? 'R' : 'L'; staff = st.lastHand === 'R' ? 'treble' : 'bass'; }
    else staff = inst.clefs[0];
    const ranges = Levels.ranges(5);
    inst.clefs.forEach(c => { const r = rangeAt(c, st.pitch[c]); ranges[c] = [r.lo, r.hi]; });
    const refStage = Math.min(...inst.clefs.map(c => st.pitch[c]));
    const time = pickTime(st);
    const ti = Gen.timeInfo(time);
    const cells = cellsFor(st, ti);
    return {
      level: st.texture >= 6 ? 7 : 3, staff, measures: st.rhythm + refStage >= 6 ? 8 : 4, times: [time], cells,
      rhythm: Cells.keysOf(cells), keys: [pickKey(st)], mode: st.keys >= 3 ? 'both' : 'major',
      restProb: 0, sync: false, maxInt: MAX_INT[Math.min(refStage, MAX_INT.length - 1)],
      accProb: st.keys >= 8 ? 0.1 : st.keys >= 4 ? 0.05 : 0,
      rhChord: inst.grand ? tx.rhChord : 0, rhMax: inst.grand ? tx.rhMax : 1, lhStyle: tx.lhStyle, lhMax: tx.lhMax,
      density: 'mid', ranges, ...overrides,
    };
  }
  function pickTime(st) {
    const ts = timesAt(st);
    return Gen.pick(ts, t => (t === ts[ts.length - 1] ? 2 : 1));
  }
  function pickKey(st) {
    const ks = keysAt(st);
    return Gen.pick(ks, f => weight('keys', String(f), f === ks[ks.length - 1]));
  }
  // התאים שמתאימים למשקל, עם משקולות מהסטטיסטיקה
  function cellsFor(st, ti) {
    const fit = cellsAt(st).filter(id => Cells.compound(id) === !!ti.compound && Cells.lengthOf(id) <= ti.L + 1e-6);
    if (fit.length) return fit;
    return ti.compound ? ['c|q.'] : ['q'];
  }
  const cellWeight = (st, id) => weight('rhythms', id, newestCells(st).includes(id));

  // ---- תור תווים לתרגול ----
  function noteWeights(st, clef) {
    const { lo, hi, added } = rangeAt(clef, st.pitch[clef]);
    const out = [];
    for (let s = lo; s <= hi; s++) out.push([s, weight('notes', `${clef}:${s}`, s === added)]);
    return out;
  }

  // תיאור מיקום התו על החמשה, ללא שם – לעזרה בזיהוי תו חדש
  const LINES = { treble: 30, bass: 18, alto: 24, tenor: 22 };
  function placeText(clef, step) {
    const d = step - LINES[clef];
    if (d >= 0 && d <= 8) return d % 2 === 0 ? `על הקו ה־${d / 2 + 1}` : `ברווח ה־${(d + 1) / 2}`;
    if (d < 0) { const n = Math.ceil(-d / 2); return -d % 2 === 0 ? `על קו עזר ${n} מתחת לחמשה` : (n === 1 ? 'מתחת לקו התחתון' : `מתחת לקו עזר ${n - 1}`); }
    const u = d - 8, n = Math.ceil(u / 2);
    return u % 2 === 0 ? `על קו עזר ${n} מעל החמשה` : (n === 1 ? 'מעל הקו העליון' : `מעל קו עזר ${n - 1}`);
  }

  // ---- תכנית האימון ----
  const BLOCK_INFO = {
    notes: { title: 'זיהוי תווים', why: 'זיהוי מהיר של תווים משחרר קשב לקצב ולמה שמגיע אחר כך. תווים חלשים חוזרים יותר.' },
    rhythm: { title: 'קריאת קצב', why: 'אימון קצב קשור לנגינה רציפה יותר. מקישים תאים קצביים, כדי לקרוא אותם כיחידה אחת.' },
    shapes: { title: 'צורות', why: 'קוראים טובים רואים תבניות ולא תו־תו. תרגול תבניות לפני הקריאה שיפר קריאה בניסוי קטן.' },
    ear: { title: 'מצאו את השינוי', why: 'לשמוע בראש את מה שכתוב. אימון שמיעתי הוא מהטיפולים שהועילו במטא־אנליזה של מחקרי קריאה.' },
    chords: { title: 'אקורדים', why: 'זיהוי אקורד כיחידה אחת חוסך קריאה של כל צליל בנפרד.' },
    read: { title: 'קריאה מהדף', why: 'קריאה של חומר חדש היא העיקר: כמות התרגול היא המנבא החזק ביותר של מיומנות קריאה.' },
  };
  function plan(st, inst, minutes) {
    const shapesOk = Math.min(...inst.clefs.map(c => st.pitch[c])) >= 4;
    const chordsOk = !!inst.grand && Math.min(...inst.clefs.map(c => st.pitch[c])) >= 6;
    const clefAt = i => inst.clefs[i % inst.clefs.length];
    const b = (type, extra) => ({ type, ...BLOCK_INFO[type], ...extra });
    const N = (i, count = 16) => b('notes', { clef: clefAt(i), count });
    const R = (count = 2) => b('rhythm', { count });
    const Read = () => b('read');
    const Ear = (count = 3) => b('ear', { count });
    const Sh = () => (shapesOk ? b('shapes', { count: 8 }) : null);
    const Ch = () => (chordsOk ? b('chords', { count: 8 }) : null);
    let list;
    if (minutes <= 5) list = [N(0, 12), R(1), Read()];
    else if (minutes <= 10) list = [N(0), R(), Sh() || Ear(2), Read(), N(1, 12), Ear(2), Read()];
    else list = [N(0), R(), Sh(), Read(), N(1), Ear(), R(), Ch(), Read(), N(0, 12), Sh(), Read()];
    return list.filter(Boolean);
  }

  return {
    INSTRUMENTS, CLEF_NAMES, START_POINTS, INPUTS, TRANSPOSERS, FAMILIES, intervalText, transposer, soundingText, TEXTURES, RHYTHM_STAGES, KEY_ORDER, CHORD_ORDER, BLOCK_INFO, TARGET, WINDOW,
    defaultStaff, fresh, load, save, rangeAt, maxPitchStage, cellsAt, timesAt, keysAt, chordsAt, newestCells, cellsFor, cellWeight, weight,
    push, acc, full, tryAdvance, afterRead, readSettings, pickTime, pickKey, noteWeights, placeText, plan,
  };
})();
