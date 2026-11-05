'use strict';
/* יצירת נגן חדש, החלפה בין נגנים, גיבוי ושחזור */
const Profiles = (() => {
  const AVATARS = ['🎹', '🎻', '🎷', '🎺', '🎸', '🪕', '🥁', '🎼', '🎵', '🦉', '🦊', '🌟'];

  // בחירת כלי מטרנספז: קודם משפחה (C, B♭, E♭, F), ואז הכלי עם קפיצת האוקטבה שלו
  function tuningPicker(getId, onPick, asList) {
    const box = h('div', { class: 'tuning-picker' });
    const cur = () => Curriculum.TRANSPOSERS.find(t => t.id === getId()) || Curriculum.TRANSPOSERS[0];
    const draw = () => {
      box.innerHTML = '';
      const fam = cur().fam;
      const seg = h('div', { class: 'seg-control', role: 'group', 'aria-label': 'משפחת הכיוון' }, Curriculum.FAMILIES.map(([k, l]) => h('button', {
        type: 'button', class: k === fam ? 'on' : '', 'aria-pressed': String(k === fam), dir: 'ltr',
        onclick: () => { if (k !== fam) { onPick(Curriculum.TRANSPOSERS.find(t => t.fam === k)); draw(); } },
      }, l)));
      UI.segThumb(seg, Curriculum.FAMILIES.length, Curriculum.FAMILIES.findIndex(([k]) => k === fam), 'tuning-family');
      const items = Curriculum.TRANSPOSERS.filter(t => t.fam === fam);
      box.append(seg);
      if (asList) {
        const list = {};
        items.forEach(t => { list[t.id] = { name: t.name, sub: `${t.sub ? t.sub + '. ' : ''}${Curriculum.intervalText(t.semis)}` }; });
        box.append(choiceList(list, () => getId(), id => { onPick(Curriculum.TRANSPOSERS.find(t => t.id === id)); }));
      } else {
        const sel = h('select', { 'aria-label': 'הכלי', onchange: e => { onPick(Curriculum.TRANSPOSERS.find(t => t.id === e.target.value)); draw(); } },
          items.map(t => h('option', { value: t.id, selected: t.id === getId() }, t.name)));
        box.append(sel, h('p', { class: 'help' }, Curriculum.intervalText(cur().semis)));
      }
    };
    draw();
    return box;
  }

  function choiceList(options, value, onPick) {
    const box = h('div', { class: 'choice-list' });
    const draw = () => {
      box.innerHTML = '';
      Object.entries(options).forEach(([k, o]) => box.append(h('button', {
        class: 'choice' + (k === value() ? ' on' : ''), type: 'button',
        onclick: () => { onPick(k); draw(); },
      }, h('b', {}, o.name), o.sub ? h('small', {}, o.sub) : null)));
    };
    draw();
    return box;
  }

  // אשף נגן חדש
  function wizard(root, onCancel) {
    const d = { name: '', avatar: AVATARS[0], instrument: 'piano', start: 'zero', input: 'keys', minutes: 10, transpose: 0, transposeId: 'none' };
    let step = 0;
    const feature = (g, t, sub) => h('div', { class: 'feature' }, UI.sq(g), h('div', {}, h('b', {}, t), h('small', {}, sub)));
    const steps = [
      () => [null, null, h('div', { class: 'welcome' },
        h('span', { class: 'app-icon xl', 'aria-hidden': 'true' }, '𝄞'),
        h('h1', {}, 'קורא תווים'),
        feature('sight', 'חומר חדש בכל יום', 'קטעים שנוצרים במיוחד לרמה שלכם, בכל מפתח, ביד אחת או בשתיים.'),
        feature('rhythm', 'קצב, גבהים ואקורדים', 'כמה דקות ביום, בבלוקים קצרים ומתחלפים.'),
        feature('progress', 'רואים מה משתפר', 'מפה של כל תו ומקצב, כדי לדעת בדיוק על מה לעבוד.'))],
      () => {
        const inp = h('input', { class: 'text-input', type: 'text', maxlength: 24, placeholder: 'השם שלכם', value: d.name, oninput: e => { d.name = e.target.value; } });
        const av = h('div', { class: 'avatars' });
        const drawAv = () => {
          av.innerHTML = '';
          AVATARS.forEach(a => av.append(h('button', { class: 'avatar-btn' + (a === d.avatar ? ' on' : ''), type: 'button', 'aria-label': 'בחירת סמל ' + a, onclick: () => { d.avatar = a; drawAv(); } }, a)));
        };
        drawAv();
        setTimeout(() => inp.focus(), 30);
        return ['מי מנגן?', 'לכל נגן יש פרופיל נפרד עם ההתקדמות והסטטיסטיקה שלו.', inp, h('p', { class: 'flabel wiz-label' }, 'סמל'), av];
      },
      () => ['על מה אתם מנגנים?', 'זה קובע באילו מפתחות נתרגל.', choiceList(Curriculum.INSTRUMENTS, () => d.instrument, v => { d.instrument = v; d.input = v === 'piano' ? 'keys' : 'mic'; })],
      () => ['מאיפה מתחילים?', 'אפשר לבחור בערך. האימון ממשיך להתאים את עצמו לתוצאות שלכם.', choiceList(Curriculum.START_POINTS, () => d.start, v => { d.start = v; })],
      () => ['איך תנגנו באימון?', d.instrument === 'piano' ? 'אפשר לשנות את זה אחר כך. בפסנתר אקוסטי המיקרופון שומע צליל אחד בכל פעם, ולכן נתרגל יד אחת בלי אקורדים.' : 'אפשר לשנות את זה אחר כך.', choiceList(Curriculum.INPUTS, () => d.input, v => { d.input = v; })],
      () => ['באיזה כיוון הכלי שלכם?', 'כדי שתו כתוב ייחשב נכון, והקטע יישמע בגובה האמיתי של הכלי.', tuningPicker(() => d.transposeId, t => { d.transposeId = t.id; d.transpose = t.semis; }, true)],
    ];
    const lastStep = () => (d.input === 'mic' || d.input === 'acoustic' ? steps.length - 1 : steps.length - 2);
    // מי שכבר יש לו נגן לא צריך לראות שוב את מסך הפתיחה
    if (Store.profiles().length) step = 1;
    function draw() {
      const [title, sub, ...body] = steps[step]();
      root.innerHTML = '';
      root.append(h('div', { class: 'wizard' },
        step > 0 ? h('div', { class: 'wiz-dots', 'aria-label': `שלב ${step} מתוך ${lastStep()}` }, steps.slice(1, lastStep() + 1).map((_, i) => h('i', { class: i < step ? 'on' : '' }))) : null,
        title ? h('h1', {}, title) : null, sub ? h('p', { class: 'wiz-sub' }, sub) : null, ...body,
        h('div', { class: 'wiz-actions' },
          step > 1 ? UI.btn('חזרה', () => { step--; draw(); }, 'ghost') : (onCancel ? UI.btn('ביטול', onCancel, 'ghost') : h('span')),
          UI.btn(step === lastStep() ? 'יוצאים לדרך' : 'המשך', next, 'primary'))));
    }
    function next() {
      if (step === 1 && !d.name.trim()) { UI.toast('כתבו שם כדי שנדע של מי הנתונים'); return; }
      if (step < lastStep()) { step++; draw(); return; }
      Store.createProfile({ ...d, name: d.name.trim() });
      location.hash = '#path';
      location.reload();
    }
    draw();
  }

  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // חלון ניהול הנגנים
  function manager() {
    const dlg = document.getElementById('players-dlg');
    const body = dlg.querySelector('.players-body');
    const me = Store.active();
    body.innerHTML = '';
    const list = h('div', { class: 'players' });
    Store.profiles().forEach(p => {
      const isMe = p.id === me?.id;
      list.append(h('div', { class: 'player-row' + (isMe ? ' on' : '') },
        h('button', {
          class: 'player-main', type: 'button', disabled: isMe,
          onclick: () => { Store.flush(); Store.setActive(p.id); location.reload(); },
        }, h('span', { class: 'avatar' }, p.avatar), h('span', {}, h('b', {}, p.name), h('small', {}, Curriculum.INSTRUMENTS[p.instrument].name + (isMe ? ' · פעיל עכשיו' : '')))),
        h('button', {
          class: 'icon-mini', type: 'button', 'aria-label': 'מחיקת ' + p.name, title: 'מחיקה',
          onclick: async () => {
            if (!await UI.confirmAlert(`למחוק את ${p.name}?`, 'כל הנתונים של הנגן יימחקו. אי אפשר לבטל.', 'מחיקה')) return;
            Store.deleteProfile(p.id);
            location.reload();
          },
        }, '✕')));
    });
    const inputSel = h('select', {
      onchange: e => { Store.updateProfile({ input: e.target.value }); Store.flush(); location.reload(); },
    }, Object.entries(Curriculum.INPUTS).map(([k, o]) => h('option', { value: k, selected: me?.input === k }, o.name)));
    const fileInp = h('input', {
      type: 'file', accept: 'application/json', hidden: true,
      onchange: async e => {
        try {
          Store.importProfile(JSON.parse(await e.target.files[0].text()));
          location.reload();
        } catch (err) { UI.toast('הקובץ לא נראה כמו גיבוי של האפליקציה'); }
      },
    });
    body.append(list,
      UI.btn('נגן חדש', () => { dlg.close(); openWizard(); }, 'primary'),
      me ? h('div', { class: 'form-group' }, h('label', { class: 'field' }, h('span', { class: 'flabel' }, `דרך הנגינה של ${me.name}`), inputSel)) : null,
      me && (me.input === 'mic' || me.input === 'acoustic') ? h('div', { class: 'form-group' }, h('div', { class: 'field' }, h('span', { class: 'flabel' }, 'כיוון הכלי'),
        tuningPicker(() => Curriculum.transposer(Store.active()).id, t => Store.updateProfile({ transposeId: t.id, transpose: t.semis })))) : null,
      me && me.input === 'mic' ? UI.btn('בדיקת מיקרופון', () => { dlg.close(); micCheck(); }, '') : null,
      h('div', { class: 'data-actions' },
        me ? UI.btn('גיבוי לקובץ', () => { Store.flush(); download(`kore-tavim-${me.name}.json`, JSON.stringify(Store.exportProfile())); }, 'ghost') : null,
        UI.btn('שחזור מקובץ', () => fileInp.click(), 'ghost'), fileInp),
      h('p', { class: 'help' }, 'הנתונים נשמרים רק בדפדפן הזה. כדאי לגבות מדי פעם, או כדי לעבור למחשב אחר.'));
    dlg.showModal();
  }
  // בדיקת מיקרופון: רואים מה הוא שומע, קובעים סף רעש וכיוון הכלי
  function micCheck(then) {
    const old = document.getElementById('mic-dlg');
    if (old) old.remove();
    const me = Store.active();
    const note = h('div', { class: 'mic-big' }, '–');
    const needle = h('i');
    const tuner = h('div', { class: 'mic-tuner', 'aria-hidden': 'true' }, needle);
    const level = h('i');
    const status = h('p', { class: 'help mic-status' }, 'מתחברים למיקרופון…');
    const tuning = tuningPicker(() => Curriculum.transposer(Store.active()).id, t => Store.updateProfile({ transposeId: t.id, transpose: t.semis }));
    const sw = (label, checked, onChange) => {
      const inp = h('input', { type: 'checkbox', checked, onchange: () => onChange(inp.checked) });
      return h('label', { class: 'field toggle' }, h('span', {}, label), inp, h('span', { class: 'switch' }));
    };
    const finish = () => {
      Store.updateProfile({ micChecked: true });
      Mic.onFrame(null);
      Mic.stop();
      dlg.close(); dlg.remove();
      if (then) then();
    };
    const calibrate = async () => {
      status.textContent = 'רגע של שקט: מודדים את רעש החדר…';
      await Mic.measureNoise();
      status.textContent = 'עכשיו נגנו תו אחד ארוך. השם שלו אמור להופיע למעלה.';
    };
    const dlg = h('dialog', { id: 'mic-dlg', class: 'sheet' },
      h('div', { class: 'prefs' },
        h('div', { class: 'sheet-head' }, h('h2', {}, 'בדיקת מיקרופון'), h('button', { class: 'nav-done', type: 'button', onclick: finish }, then ? 'המשך' : 'סיום')),
        h('div', { class: 'mic-panel' }, note, tuner, h('div', { class: 'meter mic-meter' }, level)),
        status,
        h('div', { class: 'form-group' },
          h('div', { class: 'field' }, h('span', { class: 'flabel' }, 'כיוון הכלי'), tuning),
          sw('אוזניות: מטרונום בקול', !!me.headphones, v => Store.updateProfile({ headphones: v })),
          sw('אוקטבה לא משנה (שירה, כלי לא ברשימה)', me.octaveFree !== false, v => Store.updateProfile({ octaveFree: v }))),
        h('p', { class: 'help footnote' }, 'בלי אוזניות המטרונום מהבהב במקום להישמע, כדי שהמיקרופון לא יקלוט אותו. השם שמוצג למעלה הוא התו הכתוב אחרי התאמה לכלי שבחרתם.'),
        UI.btn('מדידת רעש מחדש', calibrate, 'ghost')));
    dlg.addEventListener('cancel', e => { e.preventDefault(); finish(); });
    document.body.append(dlg);
    dlg.showModal();
    Mic.onFrame(fr => {
      level.style.width = Math.min(100, Math.sqrt(fr.rms) * 220) + '%';
      if (fr.written == null) { needle.style.opacity = 0.25; return; }
      note.textContent = Theory.midiName(fr.written, App.prefs.naming);
      needle.style.opacity = 1;
      needle.style.insetInlineStart = (50 + fr.cents) + '%';
    });
    Mic.start().then(ok => {
      if (ok) calibrate();
      else status.textContent = 'אין גישה למיקרופון. אשרו אותה בדפדפן ונסו שוב. אם פתחתם את הקובץ ישירות, ייתכן שתצטרכו לפתוח את האפליקציה דרך כתובת אינטרנט.';
    });
  }

  function openWizard() {
    const ov = document.getElementById('wizard-overlay');
    ov.hidden = false;
    wizard(ov, Store.active() ? () => { ov.hidden = true; ov.innerHTML = ''; } : null);
  }
  return { wizard, manager, openWizard, micCheck };
})();
