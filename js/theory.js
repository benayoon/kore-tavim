'use strict';
/* תורת המוזיקה: גבהים, סולמות, אקורדים.
   גובה = {step, alter}: step הוא מספר דיאטוני מוחלט (octave*7 + letter), C4 = 28. */
const Theory = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const PC = [0, 2, 4, 5, 7, 9, 11];
  const SOLFEGE = ['דו', 'רה', 'מי', 'פה', 'סול', 'לה', 'סי'];
  const SHARP_ORDER = [3, 0, 4, 1, 5, 2, 6];
  const FLAT_ORDER = [6, 2, 5, 1, 4, 0, 3];
  const KEY_SPEC = {
    '-7': 'Cb', '-6': 'Gb', '-5': 'Db', '-4': 'Ab', '-3': 'Eb', '-2': 'Bb', '-1': 'F', '0': 'C',
    '1': 'G', '2': 'D', '3': 'A', '4': 'E', '5': 'B', '6': 'F#', '7': 'C#',
  };
  const ACC_TEXT = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
  const ACC_ASCII = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };

  const mod = (n, m) => ((n % m) + m) % m;
  const letterOf = s => mod(s, 7);
  const octaveOf = s => Math.floor(s / 7);

  function keyAlter(fifths, letter) {
    if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(letter) ? 1 : 0;
    if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(letter) ? -1 : 0;
    return 0;
  }
  const midiOf = p => (octaveOf(p.step) + 1) * 12 + PC[letterOf(p.step)] + p.alter;
  const vfKey = step => LETTERS[letterOf(step)].toLowerCase() + '/' + octaveOf(step);
  const letterName = (l, naming) => (naming === 'letters' ? LETTERS[l] : SOLFEGE[l]);
  const pitchName = (p, naming, withOct) =>
    letterName(letterOf(p.step), naming) + ACC_TEXT[p.alter] + (withOct ? octaveOf(p.step) : '');
  function stepLabel(step, naming) {
    const l = letterOf(step), o = octaveOf(step);
    return naming === 'letters' ? `${LETTERS[l]}${o}` : `${SOLFEGE[l]}${o} · ${LETTERS[l]}${o}`;
  }
  function midiName(m, naming) {
    const names = naming === 'letters'
      ? ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
      : ['דו', 'דו♯', 'רה', 'מי♭', 'מי', 'פה', 'פה♯', 'סול', 'לה♭', 'לה', 'סי♭', 'סי'];
    return names[mod(m, 12)] + (Math.floor(m / 12) - 1);
  }

  function tonic(fifths, mode) {
    let l = mod(fifths * 4, 7);
    if (mode === 'minor') l = mod(l + 5, 7);
    return { letter: l, alter: keyAlter(fifths, l) };
  }
  function keyName(fifths, mode, naming) {
    const t = tonic(fifths, mode);
    return letterName(t.letter, naming) + ACC_TEXT[t.alter] + ' ' + (mode === 'minor' ? 'מינור' : "מז'ור");
  }
  function keyShort(fifths, naming) {
    const t = tonic(fifths, 'major');
    const sig = fifths === 0 ? '' : ` ${Math.abs(fifths)}${fifths > 0 ? '♯' : '♭'}`;
    return letterName(t.letter, naming) + ACC_TEXT[t.alter] + sig;
  }

  // גובה לפי הסולם; במינור – צליל מוביל מוגבה מעל דרגות V ו־vii
  function pitchInKey(step, key, deg) {
    const l = letterOf(step);
    let alter = keyAlter(key.fifths, l);
    if (key.mode === 'minor' && (deg === 4 || deg === 6)) {
      const t = tonic(key.fifths, 'minor');
      if (l === mod(t.letter + 6, 7)) alter += 1;
    }
    return { step, alter };
  }
  function chordLetters(key, deg) {
    const t = tonic(key.fifths, key.mode).letter;
    return [0, 2, 4].map(i => mod(t + deg + i, 7));
  }
  // סימנים מקריים שנראים משונים מחוץ להקשר
  const weird = (letter, alter) =>
    (alter === 1 && (letter === 2 || letter === 6)) || (alter === -1 && (letter === 0 || letter === 3)) || Math.abs(alter) > 1;

  const QUALITIES = {
    maj:   { name: "מז'ור",       sym: '',     iv: [[0, 0], [2, 4], [4, 7]] },
    min:   { name: 'מינור',       sym: 'm',    iv: [[0, 0], [2, 3], [4, 7]] },
    dim:   { name: 'מוקטן',       sym: '°',    iv: [[0, 0], [2, 3], [4, 6]] },
    aug:   { name: 'מוגדל',       sym: '+',    iv: [[0, 0], [2, 4], [4, 8]] },
    dom7:  { name: 'דומיננט 7',   sym: '7',    iv: [[0, 0], [2, 4], [4, 7], [6, 10]] },
    maj7:  { name: "מז'ור 7",     sym: 'maj7', iv: [[0, 0], [2, 4], [4, 7], [6, 11]] },
    min7:  { name: 'מינור 7',     sym: 'm7',   iv: [[0, 0], [2, 3], [4, 7], [6, 10]] },
    hdim7: { name: 'חצי מוקטן',   sym: 'ø7',   iv: [[0, 0], [2, 3], [4, 6], [6, 10]] },
    dim7:  { name: 'מוקטן 7',     sym: '°7',   iv: [[0, 0], [2, 3], [4, 6], [6, 9]] },
  };
  function spellChord(rootStep, rootAlter, q) {
    const rootMidi = midiOf({ step: rootStep, alter: rootAlter });
    return QUALITIES[q].iv.map(([ds, semi]) => {
      const step = rootStep + ds;
      return { step, alter: rootMidi + semi - midiOf({ step, alter: 0 }) };
    });
  }
  const chordSymbol = (l, alter, q) => LETTERS[l] + ACC_ASCII[alter].replace('#', '♯').replace('b', '♭') + QUALITIES[q].sym;
  const chordName = (l, alter, q, naming) => letterName(l, naming) + ACC_TEXT[alter] + ' ' + QUALITIES[q].name;

  return {
    LETTERS, SOLFEGE, PC, KEY_SPEC, ACC_TEXT, QUALITIES, mod, letterOf, octaveOf, keyAlter, midiOf, vfKey,
    letterName, pitchName, stepLabel, midiName, tonic, keyName, keyShort, pitchInKey, chordLetters, weird,
    spellChord, chordSymbol, chordName,
  };
})();
