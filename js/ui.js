'use strict';
/* רכיבי ממשק משותפים */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const UI = (() => {
  const ICON = {
    play: '<svg viewBox="0 0 24 24" width="17" height="17"><path d="M7.5 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2a1 1 0 0 0-1.5.86z" fill="currentColor"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="17" height="17"><rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor"/></svg>',
    dice: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l10 9h3M4 17h3l3-2.7M14 10.700 17 8h3M18 5.500 20.500 8 18 10.500M18 14.500 20.500 17 18 19.500"/></svg>',
    keys: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M8.500 5v14M12 5v14M15.500 5v14"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.300 3h5.400L19 21H5z"/><path d="M12 16.500l5.600-8.500"/></svg>',
    ear: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>',
    tap: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5a2 2 0 1 1 4 0v6M13 10a2 2 0 1 1 4 0v3a7 7 0 0 1-7 7h-.5A5.500 5.500 0 0 1 5 15l-1-3a1.700 1.700 0 0 1 3-1.500L9 13"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.500l4.500 4.500L19 7"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="17" r="2"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="17" height="17"><circle cx="5" cy="12" r="1.900" fill="currentColor"/><circle cx="12" cy="12" r="1.900" fill="currentColor"/><circle cx="19" cy="12" r="1.900" fill="currentColor"/></svg>',
  };
  // סמלים בסגנון SF: חלק מלא (fa) וחלק חתוך (cut, dot)
  const GLYPH = {
    path: '<circle class="fa" cx="12" cy="12" r="9"/><circle class="cut" cx="12" cy="12" r="5"/><circle class="dot" cx="12" cy="12" r="1.6"/>',
    sight: '<rect class="fa" x="4.5" y="2.5" width="15" height="19" rx="3"/><path class="cut" d="M10 16.5V8.5l5.5-1.2v7.6"/><circle class="dot" cx="8.6" cy="16.5" r="1.5"/><circle class="dot" cx="14.1" cy="15" r="1.5"/>',
    quiz: '<path class="fa" d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7-10-7-10-7z"/><circle class="cut" cx="12" cy="12" r="3"/>',
    rhythm: '<path class="fa" d="M9.3 3h5.4L19 21H5z"/><path class="cut" d="M12 16.5l5.6-8.5"/>',
    chords: '<rect class="fa" x="3" y="4.5" width="18" height="15" rx="3"/><path class="cut" d="M8.5 4.5v15M15.5 4.5v15M12 4.5v15"/>',
    progress: '<circle class="fa" cx="12" cy="8" r="4"/><path class="fa" d="M4 21c.7-4.4 4-6.5 8-6.5s7.3 2.1 8 6.5z"/>',
    practice: '<path class="cut" d="M9 18V6l11-2v12"/><circle class="fa" cx="6.5" cy="18" r="2.5"/><circle class="fa" cx="17.5" cy="16" r="2.5"/>',
    ear: '<path class="fa" d="M3 9.5h3.5L12 5v14l-5.500-4.500H3z"/><path class="line" d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>',
    shapes: '<path class="line" d="M3 18l5-7 4 4 7-10"/><circle class="fa" cx="3.500" cy="18" r="1.800"/><circle class="fa" cx="19" cy="5" r="1.800"/>',
    keys: '<path class="fa" d="M6 3h12l3.500 6.500L12 21 2.500 9.500z"/><path class="cut" d="M2.500 9.500h19M9 9.500L12 21l3-11.500M9 9.500 11 3M15 9.500 13 3"/>',
  };
  const glyph = k => `<svg class="nav-ic" viewBox="0 0 24 24" aria-hidden="true">${GLYPH[k] || GLYPH.practice}</svg>`;
  const sq = k => h('span', { class: 'sq', 'data-sq': k, html: glyph(k) });

  const icon = name => h('span', { class: 'ic', html: ICON[name] });
  const btn = (label, onclick, cls = '', ic) => h('button', { class: 'btn ' + cls, onclick }, ic ? icon(ic) : null, h('span', {}, label));
  const pct = v => Math.round(v * 100) + '%';

  function toast(msg, kind = '') {
    const box = document.getElementById('toast');
    const d = h('div', { class: 'toast ' + kind, role: 'status' }, h('span', {}, msg));
    box.append(d);
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3100);
  }

  // טבעות התקדמות. values: [{ v: 0..1, from, to }]
  let ringId = 0;
  function rings(values, size = 160, stroke = 0) {
    const sw = stroke || Math.round(size * 0.115), gap = Math.max(1, Math.round(sw * 0.14));
    const c = size / 2, id = ++ringId;
    let defs = '', body = '';
    values.forEach((r, i) => {
      const rad = c - sw / 2 - i * (sw + gap), len = 2 * Math.PI * rad;
      defs += `<linearGradient id="rg${id}-${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.from}"/><stop offset="1" stop-color="${r.to}"/></linearGradient>`;
      body += `<circle cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="${r.from}" stroke-opacity=".18" stroke-width="${sw}"/>`;
      body += `<circle class="ring-arc" style="transition-delay:${i * 90}ms" data-len="${len}" data-v="${Math.max(0, Math.min(1, r.v))}" cx="${c}" cy="${c}" r="${rad}" fill="none" stroke="url(#rg${id}-${i})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}" transform="rotate(-90 ${c} ${c})"/>`;
    });
    const el = h('div', { class: 'rings', html: `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><defs>${defs}</defs>${body}</svg>` });
    setTimeout(() => el.querySelectorAll('.ring-arc').forEach(a => {
      // טבעת ריקה בלי נקודה מיותרת בגלל הקצה המעוגל
      if (+a.dataset.v > 0) a.style.strokeDashoffset = a.dataset.len * (1 - a.dataset.v);
    }), 60);
    return el;
  }
  const RING = {
    notes: ['#FF2D55', '#FF7A9A'], rhythm: ['#30D158', '#A6EE4A'], read: ['#0A84FF', '#5AC8FA'],
    good: ['#30D158', '#A6EE4A'], mid: ['#FF9500', '#FFCC00'], low: ['#FF3B30', '#FF7A9A'],
  };
  const ringOf = (k, v) => ({ v, from: RING[k][0], to: RING[k][1] });
  function countUp(el, to) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = Math.round(to * 100) + '%'; return; }
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const f = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - f, 3);
      el.textContent = Math.round(to * e * 100) + '%';
      if (f < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // בורר מקוטע עם סמן שגולש בין האפשרויות, גם אחרי בנייה מחדש של הטופס
  const thumbs = {};
  function segThumb(row, n, i, key) {
    const prev = thumbs[key];
    const el = h('i', { class: 'seg-thumb', style: `--n:${n};--i:${prev != null && prev >= 0 ? prev : i}` });
    row.prepend(el);
    if (i < 0) el.hidden = true;
    if (prev != null && prev !== i && i >= 0) requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--i', i)));
    thumbs[key] = i;
  }

  // מעטפת אחידה לכל מצב תרגול
  function shell(view, title, subtitle) {
    const settings = h('div', { class: 'settings' });
    // בשולחן עבודה: פאנל קבוע בצד. במסך צר: גיליון שעולה מלמטה.
    const backdrop = h('div', { class: 'sheet-backdrop', onclick: () => closeSheet() });
    const doneBtn = h('button', { class: 'nav-done', type: 'button', onclick: () => closeSheet() }, 'סיום');
    const aside = h('aside', { class: 'inspector', 'aria-label': 'הגדרות התרגול' },
      h('div', { class: 'grabber', 'aria-hidden': 'true' }),
      h('div', { class: 'sheet-head' }, h('h2', {}, 'הגדרות'), doneBtn),
      settings);
    const settingsBtn = btn('הגדרות', () => openSheet(), 'settings-btn', 'sliders');
    const onEsc = e => { if (e.key === 'Escape') closeSheet(); };
    function openSheet() { aside.classList.add('open'); backdrop.classList.add('on'); document.addEventListener('keydown', onEsc); doneBtn.focus(); }
    // משיכה מטה סוגרת את הגיליון
    const grip = aside.querySelector('.grabber');
    let dragY = null, dy = 0;
    grip.addEventListener('pointerdown', e => { dragY = e.clientY; dy = 0; grip.setPointerCapture(e.pointerId); aside.classList.add('dragging'); });
    grip.addEventListener('pointermove', e => { if (dragY == null) return; dy = Math.max(0, e.clientY - dragY); aside.style.transform = `translateY(${dy}px)`; });
    const endDrag = () => {
      if (dragY == null) return;
      dragY = null; aside.classList.remove('dragging'); aside.style.transform = '';
      if (dy > 110) closeSheet();
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    function closeSheet() {
      if (!aside.classList.contains('open')) return;
      aside.classList.remove('open'); backdrop.classList.remove('on');
      document.removeEventListener('keydown', onEsc);
      settingsBtn.focus();
    }
    const toolbar = h('div', { class: 'toolbar' });
    const info = h('div', { class: 'info' });
    const score = h('div', { class: 'score' });
    const cursor = h('div', { class: 'cursor', hidden: true });
    const overlay = h('div', { class: 'overlay' });
    const paper = h('div', { class: 'paper' }, score, cursor, overlay);
    const below = h('div', { class: 'below' });
    const results = h('div', { class: 'results' });
    const work = h('section', { class: 'work' },
      h('div', { class: 'work-head has-action' }, h('div', {}, h('h1', {}, title), h('p', {}, subtitle)), settingsBtn),
      toolbar, info, paper, below, results);
    view.append(h('div', { class: 'mode' }, work, aside, backdrop));
    return { settings, toolbar, info, paper, score, cursor, overlay, below, results, aside };
  }

  function placeCursor(sh, layout, i, cls = '') {
    const on = layout && layout.onsets[i];
    if (!on) { sh.cursor.hidden = true; return; }
    const sys = layout.systems[on.sys];
    const pr = sh.paper.getBoundingClientRect(), sr = layout.svg.getBoundingClientRect();
    const ox = sr.left - pr.left + sh.paper.scrollLeft, oy = sr.top - pr.top + sh.paper.scrollTop;
    const top = oy + sys.top + 6, height = sys.bottom - sys.top - 12;
    Object.assign(sh.cursor.style, { left: (ox + on.x - 8) + 'px', top: top + 'px', height: height + 'px', width: '30px' });
    sh.cursor.className = 'cursor ' + cls;
    sh.cursor.hidden = false;
    const vt = sh.paper.scrollTop, vh = sh.paper.clientHeight;
    if (top < vt || top + height > vt + vh) sh.paper.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
  }
  // היסט ה־SVG בתוך הדף, לציור שכבות מעל התווים
  function svgOffset(sh, layout) {
    const pr = sh.paper.getBoundingClientRect(), sr = layout.svg.getBoundingClientRect();
    return { x: sr.left - pr.left + sh.paper.scrollLeft, y: sr.top - pr.top + sh.paper.scrollTop };
  }
  // מסיכת "קריאה קדימה": מסתירה את מה שעומד להתנגן עכשיו, כדי שהעיניים יקדימו את הידיים.
  // המרחק קטן בכוונה: הטווח הטבעי של העין קטן גם אצל מומחים.
  function readingMask(sh, layout, i, look) {
    const on = layout.onsets[i];
    if (!on) return clearMask(sh);
    let j = i;
    while (j < layout.onsets.length && layout.onsets[j].t < on.t + look) j++;
    const target = layout.onsets[j];
    const { x, y } = svgOffset(sh, layout);
    const sysN = target ? target.sys : layout.systems.length;
    layout.systems.forEach((s, k) => {
      let m = sh.paper.querySelector(`.rmask[data-s="${k}"]`);
      if (!m) { m = h('div', { class: 'rmask', 'data-s': k }); sh.paper.append(m); }
      const w = k < sysN ? layout.width : k === sysN && target ? Math.max(0, target.x - 10) : 0;
      Object.assign(m.style, { left: x + 'px', top: (y + s.top) + 'px', width: w + 'px', height: (s.bottom - s.top) + 'px' });
    });
  }
  function clearMask(sh) { sh.paper.querySelectorAll('.rmask').forEach(m => m.remove()); }
  // סימון תיבה (למשל הקשה ביותר, בשלב הסריקה)
  function markMeasure(sh, layout, m, label) {
    clearMeasureMark(sh);
    const ms = layout.measures[m];
    if (!ms) return;
    const { x, y } = svgOffset(sh, layout);
    const s = layout.systems[ms.sys];
    sh.paper.append(h('div', { class: 'measure-mark', style: `left:${x + ms.x}px;top:${y + s.top + 4}px;width:${ms.width}px;height:${s.bottom - s.top - 8}px` },
      label ? h('span', {}, label) : null));
  }
  function clearMeasureMark(sh) { sh.paper.querySelectorAll('.measure-mark').forEach(m => m.remove()); }

  function flashCursor(sh, cls) {
    sh.cursor.classList.add(cls);
    setTimeout(() => sh.cursor.classList.remove(cls), 300);
  }
  function countIn(sh, n) {
    sh.overlay.innerHTML = '';
    if (n > 0) sh.overlay.append(h('span', { class: 'count' }, n));
    sh.overlay.classList.toggle('on', n > 0);
  }

  function resultCard(sh, { title, score, lines = [], note, actions = [] }) {
    sh.results.innerHTML = '';
    const tier = score >= 0.85 ? 'good' : score >= 0.6 ? 'mid' : 'low';
    const num = h('b', { class: 'ring-num' }, '0%');
    const ring = rings([ringOf(tier, score)], 124, 13);
    ring.append(num);
    sh.results.append(h('div', { class: 'result-card' }, ring,
      h('div', { class: 'result-body' },
        h('h3', {}, title),
        h('div', { class: 'result-lines' }, lines.map(([k, v]) => h('div', {}, h('b', {}, v), h('span', {}, k)))),
        note ? h('p', { class: 'result-note' }, note) : null,
        h('div', { class: 'result-actions' }, actions.map(([l, f, c]) => btn(l, f, c))))));
    countUp(num, score);
    sh.results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // טופס הגדרות דינמי לפי סכמה
  const openGroups = new Set();
  let formId = 0;
  function settingsForm(root, fields, vals, onChange) {
    if (!root.dataset.form) root.dataset.form = ++formId;
    root.innerHTML = '';
    const refs = [];
    const naming = App.prefs.naming;
    const lab = f => (typeof f.label === 'function' ? f.label(vals) : f.label);
    const stepOptions = (sel, from, to, value) => {
      for (let s = from; s <= to; s++) sel.append(h('option', { value: s, selected: s === value }, Theory.stepLabel(s, naming)));
    };
    function chips(f, options) {
      const row = h('div', { class: f.single ? 'seg-control' : 'chips', role: 'group' });
      const draw = () => {
        row.innerHTML = '';
        options.forEach(([v, l]) => {
          const on = f.single ? vals[f.key] === v : vals[f.key].includes(v);
          row.append(h('button', {
            class: 'chip' + (on ? ' on' : ''), type: 'button', 'aria-pressed': String(on),
            onclick: () => {
              if (f.single) vals[f.key] = v;
              else {
                const a = vals[f.key];
                if (a.includes(v)) { if (a.length > 1) a.splice(a.indexOf(v), 1); else return UI.toast('צריך לבחור לפחות אפשרות אחת'); }
                else a.push(v);
              }
              draw(); onChange(f.key);
            },
          }, l));
        });
        if (f.single) segThumb(row, options.length, options.findIndex(([v]) => vals[f.key] === v), root.dataset.form + ':' + f.key);
      };
      draw();
      return row;
    }
    function field(f, parent) {
      let el;
      switch (f.type) {
        case 'level': {
          const row = h('div', { class: 'level-row' });
          segThumb(row, 10, vals.level - 1, root.dataset.form + ':level');
          for (let i = 1; i <= 10; i++) row.append(h('button', { class: 'lvl' + (i === vals.level ? ' on' : ''), type: 'button', 'aria-pressed': String(i === vals.level), 'aria-label': `רמה ${i}`, onclick: () => onChange('level', i) }, i));
          el = h('div', { class: 'field level-field' },
            h('div', { class: 'level-title' }, h('span', {}, 'רמה'), h('b', {}, `${vals.level} · ${Levels.NAMES[vals.level]}`),
              vals.custom ? h('span', { class: 'custom-badge' }, 'מותאם אישית') : null),
            row, h('p', { class: 'help' }, vals.custom
              ? 'שיניתם הגדרות ידנית. לחיצה על מספר רמה תחזיר את ערכת ההגדרות שלה.'
              : 'בחירת רמה טוענת ערכת הגדרות מלאה. אפשר לכוונן כל פרט בהמשך.'));
          break;
        }
        case 'heading':
          el = h('div', { class: 'heading' }, h('b', {}, f.label), f.help ? h('p', { class: 'help' }, f.help) : null);
          break;
        case 'select': {
          const sel = h('select', { onchange: () => { vals[f.key] = f.num ? Number(sel.value) : sel.value; onChange(f.key); } },
            f.options.map(([v, l]) => h('option', { value: v, selected: String(vals[f.key]) === String(v) }, l)));
          el = h('label', { class: 'field row' }, h('span', { class: 'flabel' }, lab(f)), sel);
          break;
        }
        case 'chips':
          el = h('div', { class: 'field' }, h('span', { class: 'flabel' }, lab(f)), chips(f, f.options));
          break;
        case 'keys': {
          const opts = [];
          for (let k = -7; k <= 7; k++) opts.push([k, Theory.keyShort(k, naming)]);
          const all = h('button', { class: 'link', onclick: () => { vals[f.key] = Levels.keysUpTo(7); onChange(f.key); rebuild(); } }, 'הכול');
          const none = h('button', { class: 'link', onclick: () => { vals[f.key] = [0]; onChange(f.key); rebuild(); } }, 'רק דו');
          el = h('div', { class: 'field' }, h('span', { class: 'flabel' }, lab(f), h('span', { class: 'links' }, all, none)), chips(f, opts));
          break;
        }
        case 'range': {
          const out = h('b', { class: 'val' });
          const show = () => { out.textContent = f.fmt ? f.fmt(vals[f.key]) : vals[f.key]; };
          const inp = h('input', {
            type: 'range', min: f.min, max: f.max, step: f.step, value: vals[f.key],
            oninput: () => { vals[f.key] = Number(inp.value); show(); f.live && onChange(f.key, null, true); },
            onchange: () => onChange(f.key),
          });
          show();
          el = h('label', { class: 'field' }, h('span', { class: 'flabel' }, lab(f), out), inp);
          break;
        }
        case 'toggle': {
          const inp = h('input', { type: 'checkbox', checked: !!vals[f.key], onchange: () => { vals[f.key] = inp.checked; onChange(f.key); } });
          el = h('label', { class: 'field toggle' }, h('span', {}, lab(f)), inp, h('span', { class: 'switch' }));
          break;
        }
        case 'noteRange': {
          const r = vals.ranges[f.clef];
          const a = h('select'), b = h('select');
          stepOptions(a, 7, 49, r[0]); stepOptions(b, 7, 49, r[1]);
          const upd = () => {
            let lo = +a.value, hi = +b.value;
            if (hi - lo < 2) { hi = lo + 2; b.value = hi; }
            vals.ranges[f.clef] = [lo, hi]; onChange('ranges');
          };
          a.onchange = upd; b.onchange = upd;
          el = h('div', { class: 'field' }, h('span', { class: 'flabel' }, lab(f)), h('div', { class: 'range2' }, h('span', {}, 'מ־'), a, h('span', {}, 'עד'), b));
          break;
        }
        case 'group': {
          const body = h('div', { class: 'form-group group-body' });
          f.fields.forEach(x => field(x, body));
          el = h('details', { class: 'group', open: openGroups.has(f.label) }, h('summary', {}, f.label), body);
          el.addEventListener('toggle', () => { el.open ? openGroups.add(f.label) : openGroups.delete(f.label); });
          break;
        }
      }
      if (f.show) { const upd = () => { el.hidden = !f.show(vals); }; upd(); refs.push(upd); }
      if (f.labelFn) refs.push(() => {});
      parent.append(el);
    }
    function rebuild() { settingsForm(root, fields, vals, onChange); }
    // שדות רגילים עוברים לרשימה מקובצת; כותרת, רמה וקבוצה מתקפלת סוגרות אותה
    let cur = null;
    fields.forEach(f => {
      if (['heading', 'level', 'group'].includes(f.type)) { cur = null; field(f, root); return; }
      if (!cur) { cur = h('div', { class: 'form-group' }); root.append(cur); }
      field(f, cur);
    });
    return () => refs.forEach(u => u());
  }

  // חלון אישור במקום confirm של הדפדפן, עם שם פעולה ברור
  function confirmAlert(title, message, action) {
    return new Promise(resolve => {
      const dlg = h('dialog', { class: 'alert' },
        h('div', { class: 'alert-body' }, h('h2', {}, title), h('p', {}, message)),
        h('div', { class: 'alert-actions' },
          h('button', { type: 'button', onclick: () => done(false) }, 'ביטול'),
          h('button', { type: 'button', class: 'destructive', onclick: () => done(true) }, action)));
      const done = v => { dlg.close(); dlg.remove(); resolve(v); };
      dlg.addEventListener('cancel', e => { e.preventDefault(); done(false); });
      document.body.append(dlg);
      dlg.showModal();
    });
  }

  // תפריט נפתח: פריטי בחירה עם סימון, בלי להעמיס על סרגל הכלים
  function menu(label, ic, getItems) {
    let pop = null;
    const b = btn(label, () => (pop ? close() : open()), 'menu-btn', ic);
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    const outside = e => { if (pop && !pop.contains(e.target) && !b.contains(e.target)) close(); };
    function close() {
      if (!pop) return;
      pop.remove(); pop = null;
      b.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside);
      b.focus();
    }
    function draw() {
      pop.innerHTML = '';
      getItems().forEach(it => {
        if (it.section) { pop.append(h('div', { class: 'menu-title' }, it.section)); return; }
        const on = it.checked();
        pop.append(h('button', {
          type: 'button', class: 'menu-item', role: it.radio ? 'menuitemradio' : 'menuitemcheckbox', 'aria-checked': String(on),
          onclick: () => { it.act(); draw(); },
        }, h('span', { class: 'menu-check', html: on ? ICON.check : '' }), h('span', {}, it.label)));
      });
    }
    function open() {
      pop = h('div', { class: 'menu', role: 'menu', 'aria-label': label });
      document.body.append(pop);
      draw();
      const r = b.getBoundingClientRect(), W = pop.offsetWidth, H = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left)) + 'px';
      pop.style.top = (r.bottom + H + 8 > window.innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6) + 'px';
      b.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', outside);
      pop.addEventListener('keydown', e => {
        const list = [...pop.querySelectorAll('.menu-item')], i = list.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      });
      const first = pop.querySelector('.menu-item');
      if (first) first.focus();
    }
    return b;
  }

  function tempoControl(get, set) {
    const out = h('b', {}, get());
    const inp = h('input', { type: 'range', 'aria-label': 'טמפו', min: 30, max: 200, step: 2, value: get(), oninput: () => { set(+inp.value); out.textContent = inp.value; } });
    const wrap = h('label', { class: 'tempo' }, icon('clock'), h('span', {}, 'טמפו'), inp, out);
    wrap.sync = () => { inp.value = get(); out.textContent = get(); };
    return wrap;
  }
  function toggleBtn(label, get, set, ic) {
    const b = btn(label, () => { set(!get()); b.classList.toggle('on', get()); }, 'ghost toggle-btn', ic);
    b.classList.toggle('on', get());
    return b;
  }

  return { icon, btn, pct, toast, shell, placeCursor, readingMask, clearMask, markMeasure, clearMeasureMark, flashCursor, countIn, resultCard, settingsForm, tempoControl, toggleBtn, confirmAlert, menu, glyph, sq, rings, ringOf, countUp, segThumb };
})();
