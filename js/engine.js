/* 두근두근 도키도키 인외 오피스 — visual novel engine */
(() => {
  const $ = s => document.querySelector(s);
  const A = window.ASSETS;
  const SAVE_KEY = 'dokidoki_inoe_save_v1', META_KEY = 'dokidoki_inoe_meta_v1';

  const SPEAKERS = {
    여주: { key: 'me', name: '김여주' }, 계산기: { key: 'cal', name: '계산기 본부장' }, 호치키스: { key: 'sta', name: '호치키스 대리' },
    복사기: { key: 'cop', name: '복사기' }, 정수기: { key: 'suki', name: '정수기 팀장' }, 시계: { key: 'clock', name: '시계 과장' },
    용지: { key: 'yong', name: '용지' }, 마우스: { key: 'mouse', name: '마우스' },
  };
  const AFF_NAME = { CAL: '계산기', STA: '호치키스', COP: '복사기' };
  const POS = { left: 22, l: 30, center: 50, c: 50, r: 70, right: 78 };
  const ENDINGS = [
    { id: 'H1', kind: '♡ HAPPY 01', title: '계산 불가 ♡', love: 'CALCULATOR LOVE' },
    { id: 'H2', kind: '♡ HAPPY 02', title: '우리 사이, 단단히 고정 ♡', love: 'STAPLER LOVE' },
    { id: 'H3', kind: '♡ HAPPY 03', title: '복사 완료! 너와 나의 사랑 ♡', love: 'COPIER LOVE' },
    { id: 'B0', kind: 'BAD END 00', title: '사랑보다 무서운 카드값' },
    { id: 'B1', kind: 'BAD END 01', title: '완벽한 상사' },
    { id: 'B2', kind: 'BAD END 02', title: '옆자리' },
    { id: 'B3', kind: 'BAD END 03', title: '복사할 수 없는 마음' },
  ];

  // ---------------------------------------------------------------- storage
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const meta = Object.assign({ endings: [], cleared: false, opts: { speed: 28, bgm: 0.5, sfx: 0.7 } }, store.get(META_KEY) || {});
  delete meta.opts.auto;
  const AUTO_WAIT = 1400;   // x2/x4 의 기준 대기 시간(ms) — 배속으로 나눔
  const saveMeta = () => store.set(META_KEY, meta);
  AUDIO.setVol('bgm', meta.opts.bgm); AUDIO.setVol('sfx', meta.opts.sfx);

  // ---------------------------------------------------------------- parse
  const cmds = [], labels = {};
  (() => {
    const lines = window.STORY.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || t.startsWith('//')) continue;
      if (t.startsWith('# ')) { labels[t.slice(2).trim()] = cmds.length; continue; }
      if (t.startsWith('@choice')) {
        const opts = [];
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
          const [text, eff, to] = lines[++i].trim().slice(2).split('|').map(s => s.trim());
          opts.push({ text, eff: eff === '-' ? [] : eff.split(/\s+/), to });
        }
        cmds.push({ op: 'choice', major: t.includes('major'), opts }); continue;
      }
      if (t.startsWith('@')) { const [op, ...args] = t.slice(1).split(/\s+/); cmds.push({ op, args, raw: t.slice(op.length + 2) }); continue; }
      if (t.startsWith('(') && t.endsWith(')')) { cmds.push({ op: 'think', text: t }); continue; }
      if (t.startsWith('>')) { cmds.push({ op: 'narr', text: t.slice(1).trim() }); continue; }
      const m = /^([^\s:\[「]+)(?:\[([^\]]+)\])?:\s?(.*)$/.exec(t);
      if (m && SPEAKERS[m[1]]) { cmds.push({ op: 'say', who: m[1], expr: m[2], text: m[3] }); continue; }
      cmds.push({ op: 'narr', text: t });
    }
  })();

  // ---------------------------------------------------------------- state
  const fresh = () => ({
    pc: 0, aff: { CAL: 0, STA: 0, COP: 0 }, flags: {}, route: null,
    st: { bg: null, chars: {}, bgm: null, phone: null, msgs: [], cg: null, fx: null },
  });
  let S = fresh();
  let mode = 'title';           // title | line | choice | card | busy
  let typing = null, fullText = '', mul = 1, autoTimer = null, ctrlHeld = false;   // mul: 1 = 수동, 2 = x2 자동, 4 = x4 자동

  // ---------------------------------------------------------------- assets
  const url = path => 'assets/' + path.split('/').map(encodeURIComponent).join('/');
  function plainImg(path) { const el = new Image(); el.alt = ''; el.draggable = false; el.decoding = 'async'; el.src = url(path); return el; }

  // 캐릭터 webp 의 흰 배경을 가장자리부터 flood fill 로 지움 (결과는 캐시)
  const spriteCache = new Map();
  function cleanSprite(path) {
    if (spriteCache.has(path)) return spriteCache.get(path);
    const p = new Promise(resolve => {
      const im = new Image();
      im.onload = () => {
        try {
          const w = im.naturalWidth, h = im.naturalHeight, cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
          const d = cx.getImageData(0, 0, w, h), px = d.data;
          if (px[3] < 200) { resolve(im.src); return; } // 이미 투명 배경
          // 가장자리 검은 테두리선 제거 — 거의 전부 어두운 줄을 바깥쪽부터 찾아서 지움 (두께 무관)
          const dark = i => (px[i] + px[i + 1] + px[i + 2]) < 300;
          const rowDark = y => { let n = 0; for (let x = 0; x < w; x++) if (dark((y * w + x) * 4)) n++; return n / w > 0.9; };
          const colDark = x => { let n = 0; for (let y = 0; y < h; y++) if (dark((y * w + x) * 4)) n++; return n / h > 0.9; };
          const lim = Math.round(Math.min(w, h) * 0.05);
          let bot = 0, top = 0, lef = 0, rig = 0;
          while (bot < lim && rowDark(h - 1 - bot)) bot++;
          while (top < lim && rowDark(top)) top++;
          while (lef < lim && colDark(lef)) lef++;
          while (rig < lim && colDark(w - 1 - rig)) rig++;
          const M = 3; // 선 바로 옆 번진 픽셀까지 여유
          const B = bot ? bot + M : M, T = top ? top + M : M, Lf = lef ? lef + M : M, Rt = rig ? rig + M : M;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < Lf || y < T || x >= w - Rt || y >= h - B) px[(y * w + x) * 4 + 3] = 0;
          const isBg = i => px[i + 3] === 0 || px[i] > 226 && px[i + 1] > 226 && px[i + 2] > 226 &&
            Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) < 20;
          const seen = new Uint8Array(w * h), stack = [];
          for (let x = 0; x < w; x++) stack.push(T * w + x, (h - 1 - B) * w + x);
          for (let y = 0; y < h; y++) stack.push(y * w + Lf, y * w + w - 1 - Rt);
          while (stack.length) {
            const q = stack.pop(); if (seen[q]) continue; seen[q] = 1;
            if (!isBg(q * 4)) continue;
            px[q * 4 + 3] = 0;
            const x = q % w;
            if (x > 0) stack.push(q - 1); if (x < w - 1) stack.push(q + 1);
            if (q >= w) stack.push(q - w); if (q < w * (h - 1)) stack.push(q + w);
          }
          // 경계의 밝은 잔테두리 한 겹 정리
          for (let q = 0; q < w * h; q++) {
            const i = q * 4; if (px[i + 3] === 0 || !(px[i] > 200 && px[i + 1] > 200 && px[i + 2] > 200)) continue;
            const x = q % w;
            if ((x > 0 && px[i - 1] === 0) || (x < w - 1 && px[i + 7] === 0) || (q >= w && px[i - w * 4 + 3] === 0) || (q < w * (h - 1) && px[i + w * 4 + 3] === 0)) px[i + 3] = 90;
          }
          cx.putImageData(d, 0, 0);
          cv.toBlob(b => resolve(b ? URL.createObjectURL(b) : im.src), 'image/png');
        } catch { resolve(im.src); }
      };
      im.onerror = () => resolve(null);
      im.src = url(path);
    });
    spriteCache.set(path, p); return p;
  }
  function charPath(k, pose) {
    const c = A.chars[k]; if (!c) return null;
    const f = (c.poses[pose]) || c.poses['기본'];
    return c.dir + f;
  }
  function spriteImg(k, pose) {
    const el = new Image(); el.alt = ''; el.draggable = false;
    const path = charPath(k, pose); if (!path) return el;
    if (A.chars[k].temp) { el.src = url(path); return el; }
    el.style.visibility = 'hidden';
    cleanSprite(path).then(u => { if (u) el.src = u; el.onload = () => { el.style.visibility = ''; }; });
    return el;
  }
  function preloadSprites() {
    const all = [];
    for (const [k, c] of Object.entries(A.chars)) if (!c.temp) for (const f of Object.values(c.poses)) if (f) all.push(c.dir + f);
    const next = () => { const p = all.shift(); if (p) cleanSprite(p).then(() => setTimeout(next, 30)); };
    next();
  }

  // ---------------------------------------------------------------- screen sizing
  const screen = $('#screen');
  function fit() {
    const g = $('#game').getBoundingClientRect();
    const was = screen.classList.contains('portrait');
    screen.classList.toggle('portrait', g.width / g.height < 0.82);
    if (was !== screen.classList.contains('portrait') && mode !== 'title') renderChars();
    screen.style.setProperty('--u', Math.min(g.width, g.height * 4 / 3) / 100 + 'px');
  }
  addEventListener('resize', fit); fit();

  // ---------------------------------------------------------------- stage renderers
  let bgSeq = 0;
  function renderBg(instant) {
    const key = S.st.bg; if (!key) return;
    let [file, loc, fb] = A.bgs[key] || [null, key];
    if (!file && fb && A.bgs[fb]) file = A.bgs[fb][0];
    $('#hLoc').textContent = loc;
    const cur = $('#bg'), nxt = $('#bgNext');
    if (cur.dataset.k === key) return;
    const el = file ? plainImg(file) : document.createElement('div');
    el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    if (instant) { bgSeq++; nxt.replaceChildren(); nxt.classList.remove('show'); cur.replaceChildren(el); cur.dataset.k = key; return; }
    const seq = ++bgSeq;
    nxt.replaceChildren(el); nxt.classList.remove('show');
    requestAnimationFrame(() => requestAnimationFrame(() => nxt.classList.add('show')));
    setTimeout(() => { if (seq !== bgSeq) return; cur.replaceChildren(el); nxt.classList.remove('show'); }, 600);
    cur.dataset.k = key;
  }

  // 화면에 보이는 인물 수: 데스크탑 최대 2명, 모바일(세로 화면) 1명.
  // 무대(S.st.chars)에 더 많이 있으면 말하는 사람 + 최근에 말하거나 등장한 사람 순으로 보여줌.
  let tick = 0, lastSpeaker;
  const PAIR_GAP = 20;   // 2인일 때 화면 중앙에서 좌우로 떨어지는 거리 (--u 단위)
  function renderChars(speakerKey) {
    if (speakerKey !== undefined) lastSpeaker = speakerKey;
    const box = $('#chars'), want = S.st.chars;
    const max = screen.classList.contains('portrait') ? 1 : 2;
    const sp = speakerKey ?? lastSpeaker;
    const shown = Object.keys(want)
      .sort((x, y) => (y === sp) - (x === sp) || (want[y].t || 0) - (want[x].t || 0))
      .slice(0, max)
      .sort((x, y) => (POS[want[x].pos] ?? 50) - (POS[want[y].pos] ?? 50) || (want[x].t || 0) - (want[y].t || 0));
    box.querySelectorAll('.ch').forEach(d => { if (!shown.includes(d.dataset.k)) { d.classList.add('enter'); setTimeout(() => d.remove(), 300); d.dataset.k = '_gone'; } });
    shown.forEach((k, idx) => {
      const c = want[k];
      let d = box.querySelector(`.ch[data-k="${k}"]`);
      if (!d) {
        d = document.createElement('div'); d.className = 'ch enter'; d.dataset.k = k;
        if (A.chars[k] && A.chars[k].small) d.classList.add('small');
        d.appendChild(spriteImg(k, c.expr)); d.dataset.e = c.expr; box.appendChild(d);
        requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('enter')));
      } else if (d.dataset.e !== c.expr) {
        swapSprite(d, k, c.expr);
      }
      d.style.left = shown.length === 1 ? '50%' : `calc(50% ${idx === 0 ? '-' : '+'} ${PAIR_GAP} * var(--u))`;
      d.style.zIndex = k === speakerKey ? 3 : 1;
      d.classList.toggle('dim', shown.length > 1 && speakerKey !== undefined && speakerKey !== k && speakerKey !== 'me');
    });
  }
  function swapSprite(d, k, pose) {
    d.dataset.e = pose;
    const old = d.querySelector('img'), path = charPath(k, pose);
    if (A.chars[k].temp) { old.src = url(path); return; }
    cleanSprite(path).then(u => { if (u && d.dataset.e === pose) old.src = u; });
  }
  function bounce(k) { const d = $(`#chars .ch[data-k="${k}"]`); if (!d) return; d.classList.remove('speak'); void d.offsetWidth; d.classList.add('speak'); }

  // 우측 상단 호감도 상태창 — 호감도가 처음 바뀐 순서대로 한 명씩 추가
  function meet(K) {
    S.met = S.met || [];
    if (!S.met.includes(K)) S.met.push(K);
  }
  function renderNums() {
    const el = $('#status'), met = S.met || [];
    el.hidden = !met.length || mode === 'title';
    for (const K of met) {
      let row = el.querySelector(`[data-k="${K}"]`);
      if (!row) {
        row = document.createElement('div'); row.className = 'st-row'; row.dataset.k = K;
        row.innerHTML = `<span class="st-name"><b>♥</b>${AFF_NAME[K]}</span><span class="st-bar"><i></i></span><span class="st-num"></span>`;
        el.appendChild(row);
      }
      const v = S.aff[K], num = row.querySelector('.st-num');
      row.querySelector('.st-bar i').style.width = Math.max(0, Math.min(100, v)) + '%';
      if (num.textContent !== String(v)) {
        if (num.textContent !== '') { row.classList.remove('bump'); void row.offsetWidth; row.classList.add('bump'); }
        num.textContent = v;
      }
    }
    el.querySelectorAll('.st-row').forEach(r => { if (!met.includes(r.dataset.k)) r.remove(); });
    // 호감도 높은 순으로 정렬 (같으면 지금 순서 유지), 자리 바뀌면 미끄러지듯 이동
    const rows = [...el.querySelectorAll('.st-row')];
    const sorted = rows.slice().sort((x, y) => S.aff[y.dataset.k] - S.aff[x.dataset.k] || rows.indexOf(x) - rows.indexOf(y));
    if (sorted.some((r, i) => r !== rows[i])) {
      const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
      sorted.forEach(r => el.appendChild(r));
      sorted.forEach(r => {
        const dy = before.get(r) - r.getBoundingClientRect().top; if (!dy) return;
        r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.3,1.2,.5,1)' });
      });
    }
  }


  function renderPhone() {
    const p = S.st.phone, el = $('#phone');
    el.hidden = !p; if (!p) return;
    $('#phoneWho').textContent = p;
    $('#phoneMsgs').innerHTML = S.st.msgs.slice(-7).map(m => `<div class="bub${m.me ? ' me' : ''}">${esc(m.t)}</div>`).join('');
  }

  function renderCg() {
    const el = $('#cg'), k = S.st.cg, file = k && S.st.cgf;
    el.hidden = !file; if (!file) { el.replaceChildren(); el.dataset.k = ''; return; }
    if (el.dataset.k === k && el.dataset.f === file && el.firstChild) return;
    el.dataset.k = k; el.dataset.f = file;
    const i = plainImg(file); i.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'; el.replaceChildren(i);
  }

  let fxTimer = null;
  function renderFx() {
    clearInterval(fxTimer); fxTimer = null;
    const k = S.st.fx; if (!k) return;
    fxTimer = setInterval(() => {
      const p = document.createElement('span');
      p.className = 'pt' + (k === 'snow' ? ' snow' : '');
      p.textContent = k === 'snow' ? '·' : (Math.random() < .5 ? '♥' : '♡');
      p.style.left = Math.random() * 100 + '%';
      p.style.fontSize = `calc(${k === 'snow' ? 3 + Math.random() * 3 : 1.6 + Math.random() * 2.4} * var(--u))`;
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      $('#particles').appendChild(p); setTimeout(() => p.remove(), 8200);
    }, k === 'snow' ? 140 : 420);
  }

  function renderAll() {
    $('#bg').dataset.k = ''; renderBg(true); renderChars(); renderNums(); renderPhone(); renderCg(); renderFx();
    if (S.st.bgm) AUDIO.bgm(S.st.bgm);
  }

  // ---------------------------------------------------------------- text
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  function showText(text, from = 0) {
    stopTyping(); fullText = text;
    const el = $('#text'); el.textContent = text.slice(0, from); $('#star').classList.remove('on');
    if (meta.opts.speed <= 0) { el.textContent = text; doneTyping(); return; }
    let i = from;
    typing = setInterval(() => {
      i++; el.textContent = text.slice(0, i);
      if (i >= text.length) { stopTyping(); doneTyping(); }
    }, meta.opts.speed / mul);
  }
  function scheduleNext(len) {
    clearTimeout(autoTimer); if (mul === 1) return;
    autoTimer = setTimeout(() => { if (mode === 'line' && !typing) advance(); }, (AUTO_WAIT + len * 35) / mul);
  }
  function stopTyping() { if (typing) { clearInterval(typing); typing = null; } }
  function doneTyping() {
    $('#star').classList.add('on');
    scheduleNext(fullText.length);
  }

  function setBox({ name = null, think = false, narr = false, me = false, text }) {
    const box = $('#box'); box.hidden = false;
    box.classList.toggle('think', think); box.classList.toggle('narr', narr);
    const np = $('#nameplate'); np.hidden = !name; $('#nameText').textContent = name || '';
    np.classList.toggle('yeoju', me);
    showText(text);
  }


  // ---------------------------------------------------------------- run loop
  function save() { store.set(SAVE_KEY, { ...S, pc: S.pc - 1 }); }

  function run() {
    mode = 'busy';
    while (true) {
      const c = cmds[S.pc];
      if (!c) { finish(); return; }
      S.pc++;
      if (exec(c)) return;
    }
  }

  function jump(label) { if (!(label in labels)) { console.warn('missing label', label); return; } S.pc = labels[label]; }

  function exec(c) {
    const a = c.args || [];
    switch (c.op) {
      case 'bg': S.st.bg = a[0]; renderBg(); return false;
      case 'show': S.st.chars[a[0]] = { expr: a[1] || 'normal', pos: a[2] || 'center', t: ++tick }; renderChars(a[0]); AUDIO.sfx('blip'); return false;
      case 'hide': if (a[0] === 'all') S.st.chars = {}; else delete S.st.chars[a[0]]; renderChars(); return false;
      case 'bgm': S.st.bgm = a[0] === 'stop' ? null : a[0]; AUDIO.bgm(S.st.bgm); return false;
      case 'sfx': AUDIO.sfx(a[0]); return false;
      case 'quake': { screen.classList.remove('quake'); void screen.offsetWidth; screen.classList.add('quake'); } return false;
      case 'flash': { screen.classList.remove('flash'); void screen.offsetWidth; screen.classList.add('flash'); } return false;
      case 'fx': S.st.fx = a[0] === 'off' ? null : a[0]; renderFx(); return false;
      case 'cg': {
        // @cg 키 [차분]  — 차분 그림이 없으면 지금 그림 유지, CG 자체가 없으면 건너뜀
        if (a[0] === 'off') { S.st.cg = null; S.st.cgf = null; renderCg(); return false; }
        const entry = A.cgs[a[0]] || {}, same = S.st.cg === a[0];
        const file = entry[a[1] || '기본'] || (!same ? Object.values(entry).find(v => v) : null);
        if (same) { if (file) { S.st.cgf = file; renderCg(); } return false; }
        if (!file) return false;
        S.st.cg = a[0]; S.st.cgf = file; renderCg();
        save(); cgReveal(); return true;
      }
      case 'transition': save(); transitionCard(c.raw); return true;
      case 'phone':
        if (a[0] === 'open') { S.st.phone = a[1] || ''; S.st.msgs = []; } else { S.st.phone = null; S.st.msgs = []; }
        renderPhone(); return false;
      case 'set': S.flags[a[0]] = true; return false;
      case 'unset': delete S.flags[a[0]]; return false;
      case 'aff': applyEff(a); return false;
      case 'jump': jump(a[0]); return false;
      case 'if': { const neg = a[0].startsWith('!'), f = !!S.flags[a[0].replace('!', '')]; if (neg ? !f : f) jump(a[1]); return false; }
      case 'route': jump(judge()); return false;
      case 'routeinit': S.route = a[0]; S.aff[a[0]] = 70; meet(a[0]); renderNums(); return false;
      case 'check': jump(S.aff[a[0]] >= +a[1] ? a[2] : a[3]); return false;
      case 'wait': mode = 'busy'; setTimeout(run, +a[0] / mul); return true;
      case 'chapter': save(); chapterCard(c.raw); return true;
      case 'ending': save(); endingCard(a[0]); return true;
      case 'finish': finish(); return true;
      case 'choice': save(); showChoice(c); return true;
      case 'say': save(); say(c); return true;
      case 'think': save(); mode = 'line'; setBox({ name: '김여주', think: true, me: true, text: c.text }); renderChars('me'); return true;
      case 'narr': save(); mode = 'line'; setBox({ narr: true, text: c.text }); renderChars(); return true;
      default: console.warn('unknown op', c.op); return false;
    }
  }

  function say(c) {
    mode = 'line';
    const sp = SPEAKERS[c.who];
    if (c.expr && S.st.chars[sp.key]) S.st.chars[sp.key].expr = c.expr;
    if (S.st.chars[sp.key]) S.st.chars[sp.key].t = ++tick;
    const onStage = !!S.st.chars[sp.key];
    renderChars(onStage ? sp.key : undefined);
    if (onStage) bounce(sp.key);
    // phone bubble
    if (S.st.phone && /^「/.test(c.text)) {
      const t = c.text.replace(/^「|」$/g, '');
      S.st.msgs.push({ me: sp.key === 'me', t }); renderPhone();
      AUDIO.sfx(sp.key === 'me' ? 'tap' : 'kakao');
     
      $('#box').hidden = true; fullText = t; $('#star').classList.add('on');
      scheduleNext(0);
      return;
    }
    setBox({ name: sp.name, me: sp.key === 'me', text: c.text });
   
  }

  function advance() {
    if (mode !== 'line') return;
    if (typing) { stopTyping(); $('#text').textContent = fullText; doneTyping(); return; }
    clearTimeout(autoTimer);
    AUDIO.init();
    run();
  }

  // ---------------------------------------------------------------- affection
  function applyEff(list) {
    for (const t of list) {
      const m = /^(CAL|STA|COP)([+-]\d+)$/.exec(t);
      if (m) { const d = +m[2]; S.aff[m[1]] += d; meet(m[1]); if (d > 0) affPop(m[1], d); continue; }
      if (t.startsWith('!')) delete S.flags[t.slice(1)]; else if (t) S.flags[t] = true;
    }
    renderNums();
  }
  function affPop(k, d) {
    const el = document.createElement('div'); el.className = 'aff';
    const hearts = d >= 15 ? '♡♡♡' : d >= 10 ? '♡♡' : '♡';
    el.innerHTML = `<b>${hearts}</b>${AFF_NAME[k]} +${d}`;
    $('#affPop').appendChild(el); setTimeout(() => el.remove(), 1700);
    AUDIO.sfx(d >= 10 ? 'heart2' : 'heart');
  }

  function judge() {
    // 최고 호감도 캐릭터 루트. 20 미만이면 솔로 배드엔딩. 동점이면 마지막으로 선택한 남주 우선.
    const v = S.aff, max = Math.max(v.CAL, v.STA, v.COP);
    if (max < 20) return 'bad00';
    const route = { CAL: 'route_cal', STA: 'route_sta', COP: 'route_cop' };
    const tied = ['CAL', 'STA', 'COP'].filter(k => v[k] === max);
    const picks = S.picks || [];
    for (let i = picks.length - 1; i >= 0; i--) if (tied.includes(picks[i])) return route[picks[i]];
    return route[tied[0]];
  }

  // ---------------------------------------------------------------- choice
  function showChoice(c) {
    mode = 'choice'; clearTimeout(autoTimer);
    const wrap = $('#choices'), list = $('#choiceList');
    list.replaceChildren();
    const build = () => {
      screen.classList.remove('freeze');
      wrap.classList.toggle('major', c.major); $('#majorTag').hidden = !c.major; wrap.hidden = false;
      c.opts.forEach(o => {
        const b = document.createElement('button'); b.className = 'choice'; b.textContent = o.text.replace(/^"|"$/g, '“').replace(/“$/, '”');
        b.onclick = e => { e.stopPropagation(); pick(c, o); };
        list.appendChild(b);
      });
    };
    if (c.major) {
      AUDIO.duck(0.25, 0.3); AUDIO.sfx('major'); screen.classList.add('freeze');
      setTimeout(build, 600);
    } else build();
  }
  function pick(c, o) {
    if (mode !== 'choice') return;
    AUDIO.sfx('select'); AUDIO.duck(1, 0.6);
    $('#choices').hidden = true; screen.classList.remove('freeze');
   
    // 이 선택지로 호감도가 가장 많이 오른 남주를 '마지막으로 선택한 남주'로 기록
    let best = null, bestD = 0;
    for (const t of o.eff) { const m = /^(CAL|STA|COP)\+(\d+)$/.exec(t); if (m && +m[2] > bestD) { best = m[1]; bestD = +m[2]; } }
    if (best) (S.picks = S.picks || []).push(best);
    applyEff(o.eff);
    if (o.to) jump(o.to);
    run();
  }

  // ---------------------------------------------------------------- cards
  // CG 가 처음 뜰 때는 대화창 없이 그림만 보여주고, 클릭하면 다음 대사로
  function cgReveal() {
    mode = 'line'; fullText = ''; clearTimeout(autoTimer);
    $('#box').hidden = true;
    if (mul > 1) autoTimer = setTimeout(() => { if (mode === 'line') advance(); }, 2400 / mul);
  }

  // 날짜 전환 등 짧은 전환 화면 ("다음 날")
  function transitionCard(text) {
    mode = 'card';
    const el = $('#transit'); $('#transitText').textContent = text; el.hidden = false; $('#box').hidden = true;
    el.classList.remove('play'); void el.offsetWidth; el.classList.add('play');
    let done = false;
    const go = () => { if (done) return; done = true; el.hidden = true; el.onclick = null; run(); };
    el.onclick = e => { e.stopPropagation(); go(); };
    setTimeout(go, 1800 / mul);
  }

  function chapterCard(raw) {
    mode = 'card';
    const [no, title] = raw.split('|').map(s => s.trim());
    $('#chapNo').textContent = no; $('#chapTitle').textContent = title || '';
    const el = $('#chapter'); el.hidden = false; $('#box').hidden = true;
    AUDIO.sfx('door');
    let done = false;
    const go = () => { if (done) return; done = true; el.hidden = true; el.onclick = null; run(); };
    el.onclick = e => { e.stopPropagation(); go(); };
    setTimeout(go, 3380 / mul);   // 챕터 카드 표시 시간 (2600ms × 1.3)
  }

  function endingCard(id) {
    mode = 'card'; setSpeed(1);
    const E = ENDINGS.find(e => e.id === id);
    if (!meta.endings.includes(id)) meta.endings.push(id);
    meta.cleared = true; saveMeta();
    const el = $('#ending'), happy = id.startsWith('H');
    el.className = happy ? 'happy' : 'bad'; el.hidden = false; $('#box').hidden = true;
    $('#endKind').textContent = E.kind; $('#endTitle').textContent = E.title;
    $('#loveMeter').hidden = !happy;
    S.st.fx = happy ? 'hearts' : null; renderFx();
    AUDIO.bgm(happy ? 'ending' : 'sad');
    if (happy) {
      const k = id === 'H1' ? 'CAL' : id === 'H2' ? 'STA' : 'COP';
      $('#loveName').textContent = '♡ ' + E.love;
      const from = Math.min(S.aff[k], 100); const fill = $('#loveFill'), num = $('#loveNum');
      fill.style.transition = 'none'; fill.style.width = from + '%'; num.textContent = '♡ ' + from;
      setTimeout(() => {
        fill.style.transition = ''; fill.style.width = '100%';
        let n = from; const t = setInterval(() => { n++; num.textContent = '♡ ' + Math.min(n, 100); if (n >= 100) { clearInterval(t); AUDIO.sfx('heart2'); } }, 80);
      }, 700);
      S.aff[k] = 100; renderNums();
    }
    el.onclick = e => {
      e.stopPropagation(); el.hidden = true; el.onclick = null;
      S.st.fx = null; renderFx();
      if (happy) { S.st.bgm = 'daily'; run(); } else finish();
    };
  }

  function finish() {
    mode = 'title'; setSpeed(1); store.del(SAVE_KEY);
    if (meta.endings.length >= ENDINGS.length && !meta.bonusShown) {
      meta.bonusShown = true; saveMeta();
      const el = $('#ending'); el.className = 'happy'; el.hidden = false;
      $('#loveMeter').hidden = true; $('#endKind').textContent = 'ALL ENDINGS ♡ 7 / 7';
      $('#endTitle').innerHTML = '축하합니다! 연애도 하고 출근도 했습니다.<br><small style="font-size:.55em">하지만 내일도 출근입니다.</small>';
      el.onclick = e => { e.stopPropagation(); el.hidden = true; el.onclick = null; toTitle(); };
      return;
    }
    toTitle();
  }

  // ---------------------------------------------------------------- title & menus
  function toTitle() {
    mode = 'title';
    ['#box', '#hud', '#status', '#choices', '#phone', '#chapter', '#transit', '#ending', '#cg'].forEach(s => $(s).hidden = true);
    $('#chars').replaceChildren(); S.st.fx = null; renderFx();
    $('#title').hidden = false;
    $('#btnContinue').disabled = !store.get(SAVE_KEY);
    AUDIO.bgm('title');
  }
  function buildTitleChars() {
    const tc = $('#titleChars'); tc.replaceChildren();
    [['cal', '다정2'], ['sta', '기본']].forEach(([k, e]) => {
      const d = document.createElement('div'); d.className = 'tc'; d.appendChild(spriteImg(k, e)); tc.appendChild(d);
    });
  }

  function startGame(data) {
    AUDIO.init();
    S = data || fresh();
    S.met = S.met || [];
    $('#status').replaceChildren();
    tick = Math.max(0, ...Object.values(S.st.chars).map(c => c.t || 0)); lastSpeaker = undefined;
    $('#title').hidden = true; $('#hud').hidden = false; $('#box').hidden = true; mode = 'busy';
    $('#chars').replaceChildren(); $('#bg').replaceChildren(); $('#bg').dataset.k = '';
    renderAll();
    if (!data) AUDIO.bgm(null);
    run();
  }

  function openModal(title, html, onMount) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html; $('#modal').hidden = false;
    if (onMount) onMount($('#modalBody'));
  }
  function closeModal() { $('#modal').hidden = true; }

  function endingsModal() {
    const got = new Set(meta.endings);
    const cards = ENDINGS.map(e => got.has(e.id)
      ? `<div class="end-card ${e.id[0] === 'B' ? 'bad' : ''}"><small>${e.kind}</small><b>${esc(e.title)}</b></div>`
      : `<div class="end-card locked"><small>${e.kind}</small><b>? ? ?</b></div>`).join('');
    const bonus = got.size >= ENDINGS.length ? '<p class="end-bonus">《축하합니다! 연애도 하고 출근도 했습니다.》<br>《하지만 내일도 출근입니다.》</p>' : '';
    openModal('ENDING', `<p class="end-count">수집한 엔딩 ${got.size} / ${ENDINGS.length}</p><div class="end-grid">${cards}</div>${bonus}`);
  }

  function optionsModal() {
    const o = meta.opts;
    openModal('OPTION', `<div class="opt">
      <label for="oSpeed">글자 속도</label><input id="oSpeed" type="range" min="0" max="70" step="2" value="${70 - o.speed}">
      <label for="oBgm">배경음악</label><input id="oBgm" type="range" min="0" max="1" step="0.05" value="${o.bgm}">
      <label for="oSfx">효과음</label><input id="oSfx" type="range" min="0" max="1" step="0.05" value="${o.sfx}">
    </div>`, body => {
      body.querySelector('#oSpeed').oninput = e => { o.speed = 70 - +e.target.value; saveMeta(); };
      body.querySelector('#oBgm').oninput = e => { o.bgm = +e.target.value; AUDIO.init(); AUDIO.setVol('bgm', o.bgm); saveMeta(); };
      body.querySelector('#oSfx').oninput = e => { o.sfx = +e.target.value; AUDIO.init(); AUDIO.setVol('sfx', o.sfx); AUDIO.sfx('heart'); saveMeta(); };
    });
  }

  function gameMenu() {
    openModal('MENU', `<div class="menu-list">
      <button data-m="resume">이어서 하기</button>
      <button data-m="options">옵션</button>
      <button data-m="title">타이틀로 (자동 저장됨)</button></div>`, b => {
      b.querySelector('[data-m=resume]').onclick = closeModal;
      b.querySelector('[data-m=options]').onclick = optionsModal;
      b.querySelector('[data-m=title]').onclick = () => { closeModal(); stopTyping(); toTitle(); };
    });
  }

  function setSpeed(m) {
    mul = m;
    $('#btnX2').classList.toggle('on', m === 2); $('#btnX4').classList.toggle('on', m === 4);
    if (typing) showText(fullText, $('#text').textContent.length);
    else if (mode === 'line') scheduleNext(fullText.length);
  }

  // ---------------------------------------------------------------- input
  document.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation(); AUDIO.init();
      const a = act.dataset.act;
      if (a === 'start') { store.del(SAVE_KEY); startGame(); }
      else if (a === 'continue') { const d = store.get(SAVE_KEY); if (d) startGame(d); }
      else if (a === 'endings') endingsModal();
      else if (a === 'options') optionsModal();
      else if (a === 'close') closeModal();
      else if (a === 'menu') gameMenu();
      else if (a === 'x2') setSpeed(mul === 2 ? 1 : 2);
      else if (a === 'x4') setSpeed(mul === 4 ? 1 : 4);
      return;
    }
    if (!$('#modal').hidden) { if (e.target.id === 'modal') closeModal(); return; }
    if (e.target.closest('#title')) { AUDIO.init(); AUDIO.bgm('title'); return; }
    if (mode === 'line') advance();
  });
  document.addEventListener('keydown', e => {
    if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (mode === 'title') return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (mode === 'line') { e.preventDefault(); advance(); }
      else if (mode === 'card') { e.preventDefault(); ['#chapter', '#transit', '#ending'].map($).find(x => !x.hidden)?.click(); }
    }
    else if (e.key === 'Control' && !ctrlHeld) { ctrlHeld = true; setSpeed(4); }
    else if (e.key === 'a' || e.key === 'A') setSpeed(mul === 2 ? 1 : 2);
    else if (e.key === 'Escape') gameMenu();
  });
  document.addEventListener('keyup', e => { if (e.key === 'Control') { ctrlHeld = false; setSpeed(1); } });

  // ---------------------------------------------------------------- boot
  function boot(data) {
    buildTitleChars(); preloadSprites();
    if (data && data.S && data.mode !== 'title') { startGame(data.S); return; }
    toTitle();
  }
  window.claude?.hot?.snapshot?.(() => ({ S: { ...S, pc: Math.max(0, S.pc - 1) }, mode }));
  window.claude?.hot?.ready ? window.claude.hot.ready(boot) : boot(window.claude?.hot?.data ?? {});
})();
