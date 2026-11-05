'use strict';
/* קלט: מקלדת על המסך, מקלדת מחשב כפסנתר, ו־Web MIDI */
const Piano = (() => {
  const LO = 36, HI = 96, WW = 34, BW = 22;
  const BLACK = [1, 3, 6, 8, 10];
  let root, keys = {};
  function build(el) {
    root = el; root.innerHTML = ''; keys = {};
    let wi = 0;
    for (let m = LO; m <= HI; m++) {
      const black = BLACK.includes(m % 12);
      const k = document.createElement('div');
      k.className = black ? 'bk' : 'wk';
      k.dataset.midi = m;
      if (black) k.style.left = (8 + wi * WW - BW / 2) + 'px';
      else {
        wi++;
        if (m % 12 === 0) { const lab = document.createElement('span'); lab.className = 'klabel'; k.append(lab); }
      }
      const down = e => { e.preventDefault(); k.setPointerCapture?.(e.pointerId); Input.noteOn(m, 'screen'); };
      const up = () => { if (k.classList.contains('down')) Input.noteOff(m, 'screen'); };
      k.addEventListener('pointerdown', down);
      k.addEventListener('pointerup', up);
      k.addEventListener('pointercancel', up);
      root.append(k);
      keys[m] = k;
    }
    relabel();
  }
  function relabel() {
    Object.entries(keys).forEach(([m, k]) => {
      const lab = k.querySelector('.klabel');
      if (lab) lab.textContent = Theory.midiName(+m, App.prefs.naming);
    });
  }
  const press = (m, on) => keys[m] && keys[m].classList.toggle('down', on);
  function mark(midis, cls) { midis.forEach(m => keys[m] && keys[m].classList.add(cls)); }
  function clear(cls) { Object.values(keys).forEach(k => k.classList.remove(cls)); }
  function flash(m, cls) {
    const k = keys[m]; if (!k) return;
    k.classList.add(cls); setTimeout(() => k.classList.remove(cls), 350);
  }
  function scrollTo(midi) {
    const k = keys[midi]; if (!k || !root) return;
    const sc = root.parentElement;
    const target = k.offsetLeft - sc.clientWidth / 2;
    sc.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }
  return { build, press, mark, clear, flash, scrollTo, relabel };
})();

const Input = (() => {
  const subs = new Set();
  const KEYMAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11,
    KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17,
  };
  let kb = false, oct = 4, midiCount = 0;
  const held = new Map();
  const emit = e => subs.forEach(f => f(e));
  const on = f => { subs.add(f); return () => subs.delete(f); };

  function noteOn(midi, src, time) {
    emit({ type: 'on', midi, src, time: time ?? AudioEng.now() });
    Piano.press(midi, true);
  }
  function noteOff(midi, src) { emit({ type: 'off', midi, src }); Piano.press(midi, false); }

  function setKeyboard(v) {
    kb = v; updateLabel();
    // נגן במיקרופון: בכל מקום שמצפה לנגינה מקשיבים לכלי
    if (Mic.enabled()) { if (v) Mic.start(); else Mic.stop(); }
    else if (App.isPhone()) App.dock(v);
  }
  function updateLabel() {
    const el = document.getElementById('kb-oct');
    if (el) el.textContent = kb ? `מקשי המחשב פעילים · אוקטבה ${oct}` : '';
  }
  const typing = t => t && t.matches && t.matches('input, select, textarea');

  document.addEventListener('keydown', e => {
    if (!kb || typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyZ') { oct = Math.max(1, oct - 1); updateLabel(); return; }
    if (e.code === 'KeyX') { oct = Math.min(6, oct + 1); updateLabel(); return; }
    const off = KEYMAP[e.code];
    if (off == null) return;
    e.preventDefault();
    if (e.repeat || held.has(e.code)) return;
    const m = (oct + 1) * 12 + off;
    held.set(e.code, m);
    noteOn(m, 'kb');
  });
  document.addEventListener('keyup', e => {
    if (!held.has(e.code)) return;
    noteOff(held.get(e.code), 'kb');
    held.delete(e.code);
  });

  async function initMidi() {
    const pill = document.getElementById('midi-status');
    const setPill = (txt, ok) => { pill.textContent = txt; pill.classList.toggle('ok', !!ok); };
    if (!navigator.requestMIDIAccess) { setPill('MIDI לא נתמך'); pill.title = 'השתמשו בכרום או אדג׳ כדי לחבר מקלדת MIDI'; return; }
    try {
      const access = await navigator.requestMIDIAccess();
      const bind = () => {
        midiCount = 0;
        access.inputs.forEach(inp => { inp.onmidimessage = onMsg; midiCount++; });
        setPill(midiCount ? `MIDI מחובר (${midiCount})` : 'אין MIDI', midiCount > 0);
      };
      access.onstatechange = bind;
      bind();
    } catch (err) { setPill('MIDI חסום'); }
  }
  function onMsg(msg) {
    const [st, d1, d2] = msg.data;
    const cmd = st & 0xf0;
    if (cmd === 0x90 && d2 > 0) {
      const lag = Math.max(0, performance.now() - msg.timeStamp) / 1000;
      noteOn(d1, 'midi', AudioEng.now() - Math.min(lag, 0.05));
    } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) noteOff(d1, 'midi');
  }
  return { on, noteOn, noteOff, setKeyboard, initMidi, get keyboard() { return kb; } };
})();
