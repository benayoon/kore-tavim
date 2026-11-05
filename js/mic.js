'use strict';
/* מיקרופון: זיהוי גובה (YIN) לכלים של קול אחד, והפיכת הצליל לאירועי תווים כמו ב־MIDI */
const Mic = (() => {
  // הטווח כולל כלים נמוכים (טובה, סקסופון בס) וגבוהים (פיקולו)
  const MIN_F = 30, MAX_F = 4400, FRAME_MS = 20, YIN_TH = 0.15, MIN_CLARITY = 0.75;
  const STABLE_FRAMES = 3, SILENCE_FRAMES = 5;
  // חלון הניתוח מאחר את זיהוי ההתחלה; מפצים על כך בחותמת הזמן
  const ONSET_COMP = 0.03;

  // ---- YIN ----
  function yin(x, sr) {
    const tauMax = Math.floor(sr / MIN_F), tauMin = Math.max(2, Math.floor(sr / MAX_F));
    const W = x.length - tauMax;
    if (W < 64) return { f: 0, clarity: 0 };
    const d = new Float32Array(tauMax + 1);
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = x[j] - x[j + tau]; s += v * v; }
      d[tau] = s;
    }
    d[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau];
      d[tau] = run > 0 ? d[tau] * tau / run : 1;
    }
    let t = -1;
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (d[tau] < YIN_TH) {
        while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++;
        t = tau;
        break;
      }
    }
    if (t < 0) {
      let best = 1;
      for (let tau = tauMin; tau < tauMax; tau++) if (d[tau] < best) { best = d[tau]; t = tau; }
      if (t < 0) return { f: 0, clarity: 0 };
    }
    const a = d[t - 1], b = d[t], c = d[t + 1] ?? b, den = a - 2 * b + c;
    const shift = den !== 0 ? Math.max(-1, Math.min(1, (a - c) / (2 * den))) : 0;
    return { f: sr / (t + shift), clarity: 1 - b };
  }
  const toMidi = f => 69 + 12 * Math.log2(f / 440);

  // ---- מרצף של פריימים לאירועי תווים ----
  function segmenter(emit, gate) {
    let cur = null, cand = null, candN = 0, candT = 0, quiet = 0, lastOn = 0, lo = 0, pendT = null, pendN = 0;
    function reset(t) {
      if (cur != null) emit('off', cur, t);
      cur = null; cand = null; candN = 0; pendT = null;
    }
    return {
      reset,
      frame({ t, f, clarity, rms }) {
        const voiced = rms >= gate() && f > 0 && clarity >= MIN_CLARITY;
        if (!voiced) {
          candN = 0; cand = null; pendT = null;
          if (++quiet >= SILENCE_FRAMES) reset(t);
          return;
        }
        quiet = 0;
        const m = toMidi(f), near = Math.round(m);
        // היסטרזיס: כיוון לא מושלם או ויברטו לא נחשבים תו חדש
        if (cur != null && Math.abs(m - cur) < 0.7) {
          cand = null; candN = 0;
          const age = t - lastOn;
          if (age < 0.18) { lo = rms; pendT = null; return; }
          // נשיפה או הקשה חדשה על אותו צליל: העוצמה קופצת אחרי ירידה.
          // מאשרים רק אם הגובה נשאר, כי גם תו חדש שנכנס מקפיץ את העוצמה לפני שהגובה מתעדכן.
          if (pendT != null) {
            if (++pendN >= STABLE_FRAMES) { emit('on', cur, pendT - ONSET_COMP); lastOn = t; lo = rms; pendT = null; }
            return;
          }
          if (rms > lo * 2.2 && rms > gate() * 2) { pendT = t; pendN = 1; return; }
          lo = Math.min(rms, lo * 1.01);
          return;
        }
        pendT = null;
        if (near === cand) candN++;
        else { cand = near; candN = 1; candT = t; }
        if (candN >= STABLE_FRAMES) {
          if (cur != null) emit('off', cur, t);
          cur = cand; cand = null; candN = 0; lastOn = t; lo = rms;
          emit('on', cur, candT - ONSET_COMP);
        }
      },
    };
  }

  // ---- הגדרות הנגן ----
  const me = () => Store.active() || {};
  const enabled = () => me().input === 'mic';
  const transpose = () => Curriculum.transposer(me()).semis;
  // בכלי אקוסטי ההשמעה נשמעת בגובה האמיתי של הכלי, לא בגובה הכתוב
  const soundShift = () => { const i = me().input; return i === 'mic' || i === 'acoustic' ? transpose() : 0; };
  const headphones = () => !!me().headphones;
  const gate = () => me().micGate ?? 0.01;

  // ---- חיבור לשמע ----
  let analyser = null, source = null, stream = null, timer = 0, wanted = false, holdUntil = 0, releaseT = 0, sink = null;
  let raw = null, down = null, factor = 2, frameCb = null, liveTick = 0;
  const seg = segmenter((type, midi, t) => {
    const written = midi + transpose();
    if (type === 'on') Input.noteOn(written, 'mic', t);
    else Input.noteOff(written, 'mic');
    last = type === 'on' ? written : null;
  }, gate);
  let last = null;

  function useNode(node) {
    const ctx = AudioEng.ctx();
    if (!analyser) {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      // חיבור דרך עוצמה אפס, כי יש דפדפנים שלא מעבדים צומת שאינו מחובר ליציאה
      sink = ctx.createGain(); sink.gain.value = 0;
      analyser.connect(sink); sink.connect(ctx.destination);
      raw = new Float32Array(analyser.fftSize);
      factor = Math.max(1, Math.round(ctx.sampleRate / 24000));
      const sr = ctx.sampleRate / factor, need = Math.floor(sr / MIN_F) + Math.floor(sr * 0.0214);
      down = new Float32Array(need);
    }
    if (source) { try { source.disconnect(analyser); } catch (e) { /* כבר נותק */ } }
    source = node;
    node.connect(analyser);
    if (!timer) timer = setInterval(frame, FRAME_MS);
  }
  function frame() {
    if (!analyser) return;
    const ctx = AudioEng.ctx(), t = ctx.currentTime;
    analyser.getFloatTimeDomainData(raw);
    let e = 0;
    const R = Math.min(1024, raw.length);
    for (let i = raw.length - R; i < raw.length; i++) e += raw[i] * raw[i];
    const rms = Math.sqrt(e / R);
    // האפליקציה עצמה מנגנת ברמקול: לא להקשיב לעצמנו
    if (t < holdUntil) { seg.reset(t); publish(rms, 0, 0, t); return; }
    let f = 0, clarity = 0;
    if (rms >= gate() * 0.7) {
      const n = down.length, start = raw.length - n * factor;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = 0; k < factor; k++) s += raw[start + i * factor + k];
        down[i] = s / factor;
      }
      const r = yin(down, ctx.sampleRate / factor);
      f = r.f; clarity = r.clarity;
    }
    seg.frame({ t, f, clarity, rms });
    publish(rms, f, clarity, t);
  }
  function publish(rms, f, clarity, t) {
    const voiced = f > 0 && clarity >= MIN_CLARITY && rms >= gate();
    const m = voiced ? toMidi(f) : null;
    if (frameCb) frameCb({ rms, midi: m, written: m == null ? null : Math.round(m) + transpose(), cents: m == null ? 0 : Math.round((m - Math.round(m)) * 100) });
    if (++liveTick % 4 === 0) paintLive(rms);
  }

  // קפסולה קטנה שמראה שהמיקרופון מקשיב ומה הוא שומע
  function paintLive(rms) {
    const el = document.getElementById('mic-live');
    if (!el) return;
    el.querySelector('.mic-note').textContent = last == null ? '' : Theory.midiName(last, App.prefs.naming);
    el.querySelector('.mic-level i').style.width = Math.min(100, Math.sqrt(rms) * 220) + '%';
  }
  function setLive(on) {
    const el = document.getElementById('mic-live');
    if (el) el.hidden = !on;
  }

  async function start() {
    wanted = true;
    clearTimeout(releaseT);
    setLive(true);
    if (stream) { if (source) useNode(source); return true; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      wanted = false; setLive(false);
      UI.toast('הדפדפן לא מאפשר מיקרופון כאן. נסו דרך כתובת https או בכרום');
      return false;
    }
    try {
      // עיבוד הקול של הדפדפן נועד לדיבור, והוא פוגע בצלילים מוזיקליים
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!wanted) { s.getTracks().forEach(tr => tr.stop()); return false; }
      stream = s;
      useNode(AudioEng.ctx().createMediaStreamSource(stream));
      return true;
    } catch (err) {
      wanted = false; setLive(false);
      UI.toast('אין גישה למיקרופון. אפשר לאשר אותה בהגדרות הדפדפן');
      return false;
    }
  }
  function stop() {
    wanted = false;
    setLive(false);
    clearInterval(timer); timer = 0;
    if (analyser) seg.reset(AudioEng.now());
    last = null;
    // משהים את שחרור המיקרופון, כדי לא לבקש הרשאה שוב בין בלוקים
    clearTimeout(releaseT);
    releaseT = setTimeout(() => {
      if (wanted || !stream) return;
      stream.getTracks().forEach(tr => tr.stop());
      if (source) source.disconnect();
      stream = null; source = null;
    }, 15000);
  }

  // מדידת רעש הרקע וקביעת סף הקשבה
  function measureNoise(ms = 1200) {
    return new Promise(resolve => {
      const prev = frameCb;
      let sum = 0, n = 0, peak = 0;
      frameCb = fr => { sum += fr.rms; n++; peak = Math.max(peak, fr.rms); if (prev) prev(fr); };
      setTimeout(() => {
        frameCb = prev;
        const avg = n ? sum / n : 0.004;
        const g = Math.max(0.004, Math.min(0.08, Math.max(avg * 2.5, peak * 1.3)));
        Store.updateProfile({ micGate: g });
        resolve(g);
      }, ms);
    });
  }

  return {
    yin, segmenter, toMidi, enabled, headphones, transpose, soundShift, gate, start, stop, useNode, measureNoise,
    running: () => wanted,
    onFrame(fn) { frameCb = fn; },
    // האפליקציה עומדת להשמיע צליל עד לזמן הזה; עם אוזניות אין מה להסתיר
    hold(until) { if (!headphones() && until > holdUntil) holdUntil = until; },
  };
})();
