'use strict';
/* שמע: פסנתר סינתטי, מטרונום, ונגן מתוזמן לפי שעון השמע */
const AudioEng = (() => {
  let c = null, master = null, vol = 0.8;
  function ctx() {
    if (!c) {
      c = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      master = c.createGain(); master.gain.value = vol;
      master.connect(comp); comp.connect(c.destination);
    }
    // באייפון הקשר נקטע (interrupted) אחרי שיחה או מעבר לרקע
    if (c.state !== 'running') c.resume().catch(() => {});
    return c;
  }
  const now = () => ctx().currentTime;
  const latency = () => { const x = ctx(); return (x.outputLatency || 0) + (x.baseLatency || 0); };
  function setVolume(v) { vol = v; if (master) master.gain.value = v; }
  function bus() { const g = ctx().createGain(); g.connect(master); return g; }
  function killBus(g) {
    try {
      const t = c.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.03);
      setTimeout(() => g.disconnect(), 150);
    } catch (e) { /* כבר מנותק */ }
  }

  function piano(m, t, dur = 0.8, vel = 0.6, dest) {
    const x = ctx(); dest = dest || master; t = Math.max(t, x.currentTime);
    Mic.hold(t + Math.max(dur, 0.12) + 0.35);
    const f = 440 * Math.pow(2, (m - Mic.soundShift() - 69) / 12);
    const out = x.createGain(), flt = x.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(Math.min(f * 9, 14000), t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 500), t + 1.5);
    const partials = [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.12], [1, 'sawtooth', 0.05]];
    const end = t + Math.max(dur, 0.12);
    const oscs = partials.map(([mul, type, g]) => {
      const o = x.createOscillator(), gg = x.createGain();
      o.type = type; o.frequency.value = f * mul; o.detune.value = (mul === 1 && type === 'sawtooth') ? 4 : 0;
      gg.gain.value = g; o.connect(gg); gg.connect(out); o.start(t); o.stop(end + 0.8);
      return o;
    });
    const peak = vel * 0.32 * (m > 76 ? 0.75 : 1);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    out.gain.setTargetAtTime(peak * 0.25, t + 0.01, 0.45);
    out.gain.setTargetAtTime(0.0001, end, 0.09);
    out.connect(flt); flt.connect(dest);
    oscs[0].onended = () => { out.disconnect(); };
  }
  function click(t, accent, dest) {
    const x = ctx(); t = Math.max(t, x.currentTime);
    Mic.hold(t + 0.09);
    const o = x.createOscillator(), g = x.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1240;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.13, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + 0.06);
  }
  function wood(t, dest, accent) {
    const x = ctx(); t = Math.max(t, x.currentTime);
    Mic.hold(t + 0.16);
    const o = x.createOscillator(), g = x.createGain(), flt = x.createBiquadFilter();
    o.type = 'triangle'; o.frequency.setValueAtTime(accent ? 980 : 820, t); o.frequency.exponentialRampToValueAtTime(420, t + 0.08);
    flt.type = 'bandpass'; flt.frequency.value = 900; flt.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(flt); flt.connect(g); g.connect(dest || master); o.start(t); o.stop(t + 0.15);
  }
  return { ctx, now, latency, setVolume, bus, killBus, piano, click, wood };
})();

/* נגן: מתזמן את כל הקטע מראש ומזיז סמן לפי שעון השמע */
const Player = (() => {
  const EPS = 1e-6;
  let bus = null, raf = 0, active = null;
  // טמפו = פעימות לדקה של יחידת הפעמה (רבע, או רבע מנוקד במשקל מורכב)
  const secPerQuarter = (piece, tempo) => 60 / tempo / piece.ti.group;

  function start(piece, layout, o) {
    stop();
    document.body.classList.add('performing');
    const x = AudioEng.ctx();
    bus = AudioEng.bus();
    const spq = secPerQuarter(piece, o.tempo);
    const { L, group } = piece.ti;
    const total = piece.parts[0].measures.length * L;
    const countIn = o.countIn === false ? 0 : 1;
    const t0 = x.currentTime + 0.25 + countIn * L * spq;
    // מיקרופון בלי אוזניות: המטרונום הופך לחזותי, כדי שלא ייכנס להקלטה
    const quiet = Mic.running() && !Mic.headphones();
    const pulse = document.getElementById('beat-pulse');
    if (pulse) pulse.hidden = !quiet;
    if (!quiet) {
      for (let b = 0; countIn && b < L - EPS; b += group) AudioEng.click(t0 - (L - b) * spq, b < EPS, bus);
      if (o.metronome) for (let b = 0; b < total - EPS; b += group) AudioEng.click(t0 + b * spq, Math.abs(b % L) < EPS, bus);
    }
    if (!o.mute) {
      piece.parts.forEach(p => {
        if (piece.grand && ((o.hands === 'right' && p.hand === 'L') || (o.hands === 'left' && p.hand === 'R'))) return;
        p.measures.flat().forEach(ev => {
          if (ev.rest || ev.ghost) return;
          const t = t0 + ev.start * spq;
          if (o.sound === 'wood') AudioEng.wood(t, bus, Math.abs(ev.pos) < EPS);
          else ev.pitches.forEach(pt => AudioEng.piano(Theory.midiOf(pt), t, ev.q * spq * 0.92, p.hand === 'L' ? 0.45 : 0.6, bus));
        });
      });
    }
    layout.onsets.forEach(on => { on.time = t0 + on.t * spq; });
    const end = t0 + total * spq;
    active = { t0, end, spq, cur: -1, count: null, beat: null };
    const lat = AudioEng.latency();
    const tick = () => {
      if (!active) return;
      const t = x.currentTime - lat;
      if (quiet && pulse) {
        const b = Math.floor((t - t0) / (group * spq) + 1e-6);
        if (b !== active.beat && t < end) {
          active.beat = b;
          const inBar = Math.round(L / group), bar = ((b % inBar) + inBar) % inBar === 0;
          pulse.animate([{ transform: `scale(${bar ? 1.9 : 1.4})`, opacity: 1 }, { transform: 'scale(1)', opacity: 0.35 }], { duration: Math.min(380, group * spq * 800), easing: 'ease-out' });
        }
      }
      if (t < t0) {
        const left = Math.ceil((t0 - t) / (group * spq) - 1e-3);
        if (left !== active.count) { active.count = left; o.onCount && o.onCount(left); }
      } else if (active.count !== 0) { active.count = 0; o.onCount && o.onCount(0); }
      let i = active.cur;
      while (i + 1 < layout.onsets.length && layout.onsets[i + 1].time <= t + 0.015) i++;
      if (i !== active.cur && i >= 0) { active.cur = i; o.onOnset && o.onOnset(i); }
      if (t > end + (o.tail ?? 0.2)) { const cb = o.onEnd; stop(); cb && cb(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return active;
  }
  function stop() {
    cancelAnimationFrame(raf);
    document.body.classList.remove('performing');
    const pulse = document.getElementById('beat-pulse');
    if (pulse) pulse.hidden = true;
    if (bus) AudioEng.killBus(bus);
    bus = null; active = null;
  }
  return { start, stop, secPerQuarter, isPlaying: () => !!active };
})();
