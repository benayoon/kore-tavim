'use strict';
/* ערכות הגדרות לפי רמה (1–10) ורשימות אפשרויות */
const Levels = (() => {
  const NAMES = ['', 'צעדים ראשונים', 'מתחיל', 'מתחיל+', 'בסיסי', 'בינוני', 'בינוני+', 'מתקדם', 'מתקדם+', 'מומחה', 'וירטואוז'];
  const TIMES = ['2/4', '3/4', '4/4', '5/4', '6/8', '9/8', '12/8'];
  const RHYTHM_OPTS = [
    ['w', 'שלם'], ['h.', 'חצי מנוקד'], ['h', 'חצי'], ['q.', 'רבע מנוקד'], ['q', 'רבע'],
    ['8.', 'שמינית מנוקדת'], ['8', 'שמינית'], ['16', 'שש־עשרית'], ['trip', 'טריולה'],
  ];
  const INTERVALS = [[1, 'סקונדה'], [2, 'טרצה'], [3, 'קוורטה'], [4, 'קווינטה'], [5, 'סקסטה'], [6, 'ספטימה'], [7, 'אוקטבה'], [9, 'דצימה']];
  const STAFF_OPTS = [
    ['grand', 'שתי ידיים – מערכת כפולה'], ['treble', 'יד ימין – מפתח סול'], ['bass', 'יד שמאל – מפתח פה'],
    ['alto', 'מפתח דו – אלט'], ['tenor', 'מפתח דו – טנור'],
  ];
  const at = (arr, L) => arr[Math.max(0, Math.min(arr.length - 1, L - 1))];
  const keysUpTo = n => { const a = []; for (let f = -n; f <= n; f++) a.push(f); return a; };

  // טווחים (step) לפי מפתח ורמה
  const RANGES = {
    treble: [[28, 32], [28, 35], [28, 37], [27, 39], [26, 40], [25, 42], [24, 44], [24, 45], [23, 46], [22, 47]],
    bass:   [[21, 25], [21, 28], [19, 28], [17, 29], [16, 30], [14, 31], [13, 32], [12, 32], [11, 33], [10, 34]],
    alto:   [[26, 30], [24, 31], [24, 32], [23, 33], [22, 34], [21, 35], [20, 36], [19, 37], [18, 38], [17, 39]],
    tenor:  [[24, 28], [22, 29], [22, 30], [21, 31], [20, 32], [19, 33], [18, 34], [17, 35], [16, 36], [15, 37]],
  };
  const ranges = L => Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, at(v, L).slice()]));

  const SIGHT_RHYTHM = [
    ['w', 'h', 'q'], ['w', 'h.', 'h', 'q'], ['w', 'h.', 'h', 'q', '8'], ['w', 'h.', 'h', 'q.', 'q', '8'],
    ['w', 'h.', 'h', 'q.', 'q', '8'], ['w', 'h.', 'h', 'q.', 'q', '8', '16'], ['w', 'h.', 'h', 'q.', 'q', '8.', '8', '16'],
    ['w', 'h.', 'h', 'q.', 'q', '8.', '8', '16', 'trip'],
  ];
  const SIGHT_TIMES = [
    ['4/4'], ['4/4', '3/4'], ['4/4', '3/4', '2/4'], ['4/4', '3/4', '2/4'], ['4/4', '3/4', '2/4', '6/8'],
    ['4/4', '3/4', '2/4', '6/8'], ['4/4', '3/4', '6/8', '12/8'], ['4/4', '3/4', '6/8', '9/8', '12/8', '5/4'],
    TIMES, TIMES,
  ];

  function sight(L) {
    return {
      level: L,
      keys: keysUpTo(at([0, 1, 1, 2, 3, 4, 5, 6, 7, 7], L)),
      mode: L < 5 ? 'major' : 'both',
      times: at(SIGHT_TIMES, L).slice(),
      rhythm: at(SIGHT_RHYTHM, L).slice(),
      restProb: at([0, 0.08, 0.1, 0.12, 0.12, 0.15, 0.15, 0.15, 0.18, 0.2], L),
      sync: L >= 7,
      maxInt: at([2, 3, 4, 4, 5, 7, 7, 7, 9, 9], L),
      accProb: at([0, 0, 0, 0, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15], L),
      rhChord: at([0, 0, 0, 0.08, 0.12, 0.18, 0.22, 0.28, 0.32, 0.38], L),
      rhMax: at([1, 1, 1, 2, 2, 3, 3, 3, 4, 4], L),
      lhStyle: at(['long', 'long', 'blocks', 'blocks', 'mixed'], L),
      lhMax: at([1, 1, 2, 2, 3, 3, 3, 4, 4, 4], L),
      tempo: at([60, 66, 72, 76, 80, 84, 88, 92, 96, 100], L),
      ranges: ranges(L),
    };
  }
  function quiz(L) {
    return {
      level: L,
      keys: keysUpTo(at([0, 0, 1, 2, 3, 4, 5, 6, 7, 7], L)),
      accProb: at([0, 0, 0, 0, 0.08, 0.12, 0.15, 0.2, 0.25, 0.3], L),
      ranges: ranges(L),
    };
  }
  function chords(L) {
    const types = [['maj'], ['maj', 'min'], ['maj', 'min', 'dim', 'aug'], ['maj', 'min', 'dim', 'aug'],
      ['maj', 'min', 'dim', 'aug', 'dom7'], ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7'],
      ['maj', 'min', 'dim', 'aug', 'dom7', 'maj7', 'min7', 'hdim7', 'dim7']];
    return { level: L, types: at(types, L).slice(), inversions: L >= 4, rootAcc: L >= 5, askInv: L >= 9 };
  }
  function rhythm(L) {
    return {
      level: L,
      times: at([['4/4'], ['4/4', '3/4'], ['4/4', '3/4', '2/4'], ['4/4', '3/4', '2/4'], ['4/4', '3/4', '6/8'],
        ['4/4', '3/4', '6/8'], ['4/4', '3/4', '6/8', '12/8'], ['4/4', '3/4', '6/8', '9/8', '5/4'], TIMES], L).slice(),
      rhythm: at(SIGHT_RHYTHM, L).slice(),
      restProb: at([0, 0.1, 0.1, 0.12, 0.15, 0.15, 0.18, 0.2, 0.2, 0.22], L),
      sync: L >= 7,
      tempo: at([60, 66, 70, 76, 80, 84, 88, 92, 96, 100], L),
    };
  }
  // רזולוציית קצב: הערך הקצר ביותר + נקודות + טריולות  <->  רשימת ערכים מפורטת
  const RES_ORDER = ['w', 'h', 'q', '8', '16'];
  const RES_OPTS = [['h', 'חצאים'], ['q', 'רבעים'], ['8', 'שמיניות'], ['16', 'שש־עשריות']];
  const DENSITY_OPTS = [['sparse', 'מעט תווים'], ['mid', 'מאוזן'], ['dense', 'הרבה תווים']];
  const SIMUL_OPTS = [[1, 'תו בודד'], [2, 'עד 2'], [3, 'עד 3'], [4, 'עד 4']];
  function rhythmFrom({ res, dots, trip }) {
    const idx = Math.max(1, RES_ORDER.indexOf(res));
    const a = RES_ORDER.slice(0, idx + 1);
    if (dots) { a.push('h.'); if (idx >= 3) a.push('q.'); if (idx >= 4) a.push('8.'); }
    if (trip && idx >= 3) a.push('trip');
    return a;
  }
  function controlsFrom(rhythm) {
    const res = rhythm.includes('16') || rhythm.includes('8.') ? '16' : rhythm.includes('8') || rhythm.includes('q.') || rhythm.includes('trip') ? '8'
      : rhythm.includes('q') ? 'q' : 'h';
    return { res, dots: ['h.', 'q.', '8.'].some(k => rhythm.includes(k)), trip: rhythm.includes('trip') };
  }
  const withControls = p => (p.rhythm ? Object.assign(p, controlsFrom(p.rhythm), { density: 'mid' }) : p);

  // מחיל ערכת רמה על הגדרות קיימות, ושומר על מה שאינו חלק מהערכה
  const apply = (s, preset) => Object.assign(s, structuredClone(withControls(preset)), { custom: false });

  // שינוי ידני: מסנכרן שדות נגזרים ומסמן "מותאם אישית"
  function onEdit(s, key, presetFn) {
    if (['res', 'dots', 'trip'].includes(key)) s.rhythm = rhythmFrom(s);
    if (key === 'rhythm') Object.assign(s, controlsFrom(s.rhythm));
    if (key === 'rhMax' && s.rhMax > 1 && !(s.rhChord > 0.05)) s.rhChord = 0.25;
    if (['density', 'res', 'dots', 'trip'].includes(key) || key in presetFn(1)) s.custom = true;
  }
  // הגדרות ישנות שנשמרו לפני שהיו פקדי הרזולוציה
  const upgrade = s => { if (s.rhythm && s.res == null) Object.assign(s, controlsFrom(s.rhythm), { density: 'mid' }); return s; };

  return {
    NAMES, TIMES, RHYTHM_OPTS, INTERVALS, STAFF_OPTS, RES_OPTS, DENSITY_OPTS, SIMUL_OPTS,
    ranges, sight, quiz, chords, rhythm, apply, onEdit, upgrade, rhythmFrom, controlsFrom, keysUpTo,
  };
})();
