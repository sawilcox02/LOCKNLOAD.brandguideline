/* LOCKNLOAD · Target Practice
   A round-based point-and-click range. Canvas 2D, no libraries.
   Logical stage is 1280 × 720 and scales to the frame. */
(function () {
  'use strict';
  const wrap = document.getElementById('tp');
  if (!wrap) return;
  const cv = document.getElementById('tpCanvas');
  const ctx = cv.getContext('2d');
  const W = 1280, H = 720;
  const C = { pulse: '#9C26F0', shadow: '#211F2D', frost: '#EEF1F9', ign: '#FF7514', surge: '#91E829', paper: '#FFFFFF' };
  const DISPLAY = (getComputedStyle(document.documentElement).getPropertyValue('--display') || '"Arial Black",sans-serif').trim();
  const TEXT = (getComputedStyle(document.documentElement).getPropertyValue('--text') || 'sans-serif').trim();
  const F = (px, w = 900) => `${w} ${px}px ${w >= 800 ? DISPLAY : TEXT}`;
  const A = window.ASSETS || (typeof ASSETS !== 'undefined' ? ASSETS : null);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- brand shapes ---------- */
  const emb = A ? A.emblem.map(d => new Path2D(d)) : [];
  const wordL = A ? A.wordL.map(d => new Path2D(d)) : [];
  const wordR = A ? A.wordR.map(d => new Path2D(d)) : [];
  const embLogo = A ? A.emblemInLogo.map(d => new Path2D(d)) : [];
  const EMB_W = 279, EMB_H = 178, LOGO_W = 1343, LOGO_H = 178;
  function drawEmblem(x, y, w, color, split = 0, alpha = 1) {
    if (!emb.length) return;
    const s = w / EMB_W;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x - w / 2, y - EMB_H * s / 2); ctx.scale(s, s); ctx.fillStyle = color;
    ctx.save(); ctx.translate(-split, -split * .62); ctx.fill(emb[0]); ctx.restore();
    ctx.save(); ctx.translate(split, split * .62); ctx.fill(emb[1]); ctx.restore();
    ctx.restore();
  }
  function drawLogo(x, y, w, word, mark, alpha = 1) {
    if (!wordL.length) return;
    const s = w / LOGO_W;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x - w / 2, y - LOGO_H * s / 2); ctx.scale(s, s);
    ctx.fillStyle = word; wordL.forEach(p => ctx.fill(p)); wordR.forEach(p => ctx.fill(p));
    ctx.fillStyle = mark; embLogo.forEach(p => ctx.fill(p));
    ctx.restore();
  }

  /* ---------- textures ---------- */
  const imgs = {};
  ['focus', 'breach', 'adapt', 'blueprint'].forEach(k => { const i = new Image(); i.src = `img/tex-${k}.jpg`; imgs[k] = i; });
  function noiseTile(size, base, spread, seed) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'), d = g.createImageData(size, size);
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < d.data.length; i += 4) {
      const n = base + (rnd() - .5) * spread + (rnd() < .012 ? -28 : 0);
      d.data[i] = n; d.data[i + 1] = n * .98; d.data[i + 2] = n * 1.04; d.data[i + 3] = 255;
    }
    g.putImageData(d, 0, 0);
    // soft trowel blotches for a smooth poured-concrete feel
    for (let k = 0; k < 26; k++) {
      const x = rnd() * size, y = rnd() * size, r = 20 + rnd() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const v = rnd() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)';
      gr.addColorStop(0, v); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }
  const concrete = noiseTile(256, 92, 26, 7);
  const concreteDark = noiseTile(256, 58, 22, 11);

  /* ---------- room geometry (one-point perspective) ---------- */
  const VP = { x: 640, y: 292 };
  const WALL = { x0: 210, y0: 70, x1: 1070, y1: 440 };
  let roomCache = null;
  function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); }
  function buildRoom() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    // ceiling
    poly(g, [[0, 0], [W, 0], [WALL.x1, WALL.y0], [WALL.x0, WALL.y0]]);
    g.fillStyle = g.createPattern(concreteDark, 'repeat'); g.fill();
    g.fillStyle = 'rgba(33,31,45,.55)'; g.fill();
    // light strips on the ceiling
    for (let i = 0; i < 3; i++) {
      const t0 = .18 + i * .26, t1 = t0 + .1;
      const yA = WALL.y0 * (1 - t0), yB = WALL.y0 * (1 - t1);
      const xa = (t) => [WALL.x0 + (0 - WALL.x0) * t + 380 * (1 - t) * 0, 0];
      const L = (t) => WALL.x0 + (0 - WALL.x0) * t, R = (t) => WALL.x1 + (W - WALL.x1) * t;
      const inset = (t, f) => L(t) + (R(t) - L(t)) * f;
      poly(g, [[inset(t0, .32), yA], [inset(t0, .68), yA], [inset(t1, .68), yB], [inset(t1, .32), yB]]);
      g.fillStyle = 'rgba(238,241,249,.85)'; g.shadowColor = 'rgba(238,241,249,.9)'; g.shadowBlur = 30; g.fill(); g.shadowBlur = 0;
    }
    // side walls
    poly(g, [[0, 0], [WALL.x0, WALL.y0], [WALL.x0, WALL.y1], [0, H]]);
    g.fillStyle = g.createPattern(concrete, 'repeat'); g.fill();
    const lg = g.createLinearGradient(0, 0, WALL.x0, 0); lg.addColorStop(0, 'rgba(20,19,28,.78)'); lg.addColorStop(1, 'rgba(20,19,28,.35)');
    g.fillStyle = lg; g.fill();
    poly(g, [[W, 0], [WALL.x1, WALL.y0], [WALL.x1, WALL.y1], [W, H]]);
    g.fillStyle = g.createPattern(concrete, 'repeat'); g.fill();
    const rg = g.createLinearGradient(W, 0, WALL.x1, 0); rg.addColorStop(0, 'rgba(20,19,28,.78)'); rg.addColorStop(1, 'rgba(20,19,28,.35)');
    g.fillStyle = rg; g.fill();
    // panel seams on side walls, converging on the vanishing point
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.5;
    [.35, .7].forEach(f => {
      g.beginPath(); g.moveTo(WALL.x0 * (1 - f), WALL.y0 * (1 - f)); g.lineTo(WALL.x0 * (1 - f), WALL.y1 + (H - WALL.y1) * f); g.stroke();
      g.beginPath(); g.moveTo(WALL.x1 + (W - WALL.x1) * f, WALL.y0 * (1 - f)); g.lineTo(WALL.x1 + (W - WALL.x1) * f, WALL.y1 + (H - WALL.y1) * f); g.stroke();
    });
    // a Pulse stripe running along both side walls toward the range
    g.fillStyle = C.pulse;
    poly(g, [[0, 470], [WALL.x0, WALL.y1 - 64], [WALL.x0, WALL.y1 - 56], [0, 490]]); g.fill();
    poly(g, [[W, 470], [WALL.x1, WALL.y1 - 64], [WALL.x1, WALL.y1 - 56], [W, 490]]); g.fill();
    // back wall: smooth concrete with graffiti
    g.save();
    g.beginPath(); g.rect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0); g.clip();
    g.fillStyle = g.createPattern(concrete, 'repeat'); g.fillRect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0);
    g.globalCompositeOperation = 'screen';
    const ww = WALL.x1 - WALL.x0;
    const draw = (im, x, y, w, h, a, sk) => { if (!im.complete || !im.naturalWidth) return; g.save(); g.globalAlpha = a; g.translate(x, y); g.transform(1, sk, 0, 1, 0, 0); g.drawImage(im, 0, 0, w, h); g.restore(); };
    draw(imgs.adapt, WALL.x0 - 40, WALL.y0 + 30, ww * .62, 150, .95, -.08);
    draw(imgs.focus, WALL.x0 + ww * .45, WALL.y0 + 150, ww * .65, 140, .8, .05);
    draw(imgs.breach, WALL.x0 + ww * .1, WALL.y0 + 230, ww * .5, 120, .55, -.03);
    draw(imgs.blueprint, WALL.x0, WALL.y0, ww, WALL.y1 - WALL.y0, .18, 0);
    g.globalCompositeOperation = 'source-over';
    // big faded LOCK N. painted on the wall
    g.font = F(118); g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(238,241,249,.07)';
    g.fillText('LOCK N.', WALL.x0 + 36, WALL.y1 - 34);
    g.restore();
    // wall/floor edge shadow
    const eg = g.createLinearGradient(0, WALL.y1 - 40, 0, WALL.y1); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = eg; g.fillRect(WALL.x0, WALL.y1 - 40, WALL.x1 - WALL.x0, 40);
    // floor
    poly(g, [[WALL.x0, WALL.y1], [WALL.x1, WALL.y1], [W, H], [0, H]]);
    g.fillStyle = g.createPattern(concreteDark, 'repeat'); g.fill();
    const fg = g.createLinearGradient(0, WALL.y1, 0, H); fg.addColorStop(0, 'rgba(33,31,45,.6)'); fg.addColorStop(1, 'rgba(33,31,45,.1)');
    g.fillStyle = fg; g.fill();
    // lane lines toward the vanishing point
    g.strokeStyle = 'rgba(156,38,240,.35)'; g.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) { const fx = WALL.x0 + (WALL.x1 - WALL.x0) * i / 8; const bx = (fx - VP.x) * ((H - VP.y) / (WALL.y1 - VP.y)) + VP.x; g.beginPath(); g.moveTo(fx, WALL.y1); g.lineTo(bx, H); g.stroke(); }
    for (let k = 1; k < 6; k++) { const t = Math.pow(k / 6, 1.7); const y = WALL.y1 + (H - WALL.y1) * t; const xl = WALL.x0 * (1 - t), xr = WALL.x1 + (W - WALL.x1) * t; g.strokeStyle = 'rgba(238,241,249,.06)'; g.beginPath(); g.moveTo(xl, y); g.lineTo(xr, y); g.stroke(); }
    // vignette
    const vg = g.createRadialGradient(VP.x, VP.y, 200, VP.x, VP.y, 900); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,9,16,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }
  // rebuild once textures arrive
  let texLoaded = 0;
  Object.values(imgs).forEach(i => { i.onload = () => { texLoaded++; roomCache = null; }; });

  /* ---------- depth helpers ---------- */
  // depth d: 0 = at the back wall, 1 = near the bench
  const depthScale = d => .62 + d * .78;
  const floorY = d => WALL.y1 + (600 - WALL.y1) * d;
  const projX = (u, d) => { const xl = WALL.x0 + (60 - WALL.x0) * d, xr = WALL.x1 + (W - 60 - WALL.x1) * d; return xl + (xr - xl) * u; };

  /* ---------- state ---------- */
  const TYPES = {
    focus: { color: C.ign, r: 30, mult: 3, speed: 1.6, label: 'FOCUS' },
    adapt: { color: C.pulse, r: 42, mult: 2, speed: 1.0, label: 'ADAPT' },
    breach: { color: C.surge, r: 54, mult: 1, speed: .55, label: 'BREACH' }
  };
  const MAG = 10;
  let state = 'boot', t0 = performance.now(), last = t0, now = t0;
  let mouse = { x: W / 2, y: H / 2, in: false };
  let score = 0, round = 1, hits = 0, shots = 0, roundHits = 0, quota = 0, timeLeft = 0, combo = 0, bestCombo = 0;
  let ammo = MAG, reloading = 0, spawnT = 0;
  let targets = [], fx = [], decals = [], pops = [], darts = [];
  let shake = 0, muzzle = 0, banner = null, paused = false, hover = null, muted = store.get('lnl-tp-muted') === '1';
  let scores = []; try { scores = JSON.parse(store.get('lnl-tp-scores') || '[]') || []; } catch (e) { scores = []; }
  const best = () => scores.length ? scores[0].score : 0;

  /* ---------- audio (synthesized, starts after first click) ---------- */
  let ac = null;
  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
  function tone(freq, dur, type = 'square', vol = .08, slide = 0) {
    if (muted) return; const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), a.currentTime + dur);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  function pop() {
    if (muted) return; const a = audio(); if (!a) return;
    const n = a.sampleRate * .09, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = .35;
    s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const sfx = {
    shot() { pop(); tone(180, .08, 'triangle', .05, .5); },
    hit(q) { tone(q === 100 ? 1320 : q === 50 ? 990 : 740, .14, 'square', .05, 1.3); },
    miss() { tone(140, .12, 'sawtooth', .025, .7); },
    reload() { tone(420, .05, 'square', .04); setTimeout(() => tone(620, .06, 'square', .04), 120); },
    round() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, .18, 'square', .05), i * 110)); },
    over() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, .25, 'triangle', .06), i * 160)); },
    lock() { tone(220, .12, 'square', .05, 2); }
  };

  /* ---------- game flow ---------- */
  function roundCfg(n) {
    return {
      time: 30,
      quota: 6 + (n - 1) * 2,
      maxOn: Math.min(2 + Math.floor((n - 1) / 1.5), 6),
      spawnEvery: Math.max(.38, 1.25 - (n - 1) * .11),
      life: Math.max(1.7, 4.2 - (n - 1) * .3),
      speed: 1 + (n - 1) * .14,
      mix: n < 2 ? ['adapt', 'adapt', 'breach'] : n < 4 ? ['adapt', 'breach', 'focus'] : ['focus', 'focus', 'adapt', 'breach']
    };
  }
  let cfg = roundCfg(1);
  function newGame() {
    score = 0; round = 1; hits = 0; shots = 0; combo = 0; bestCombo = 0; decals = [];
    startRound();
  }
  function startRound() {
    cfg = roundCfg(round); quota = cfg.quota; roundHits = 0; timeLeft = cfg.time; targets = []; ammo = MAG; reloading = 0; spawnT = .6;
    state = 'intro'; t0 = now; banner = null; sfx.round();
  }
  function endRound() {
    targets.forEach(t => t.leaving = t.leaving || .001);
    if (roundHits >= quota) { state = 'clear'; t0 = now; sfx.round(); score += Math.round(timeLeft * 10); }
    else { state = 'over'; t0 = now; sfx.over(); onGameOver(); }
  }
  function spawn() {
    const type = cfg.mix[Math.floor(Math.random() * cfg.mix.length)];
    const T = TYPES[type];
    const d = type === 'breach' ? .05 + Math.random() * .2 : .1 + Math.random() * .55;
    targets.push({
      type, u: .12 + Math.random() * .76, d, h: 40 + Math.random() * 120,
      dir: Math.random() < .5 ? -1 : 1, v: T.speed * cfg.speed * (.6 + Math.random() * .5),
      age: 0, life: cfg.life * (type === 'focus' ? .8 : 1), phase: Math.random() * 6.28, leaving: 0, hit: 0
    });
  }
  function targetScreen(t) {
    const T = TYPES[t.type], s = depthScale(t.d);
    const rise = Math.min(1, t.age / .22), fall = t.leaving ? Math.max(0, 1 - t.leaving / .22) : 1;
    const up = Math.min(rise, fall);
    const fy = floorY(t.d), x = projX(t.u, t.d);
    const bob = t.type === 'adapt' ? Math.sin(t.age * 3 + t.phase) * 14 * s : 0;
    const cy = fy - (t.h + T.r) * s * up + bob;
    return { x, y: cy, r: T.r * s, s, fy, up };
  }

  /* ---------- input ---------- */
  function toStage(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  const buttons = [];
  function button(id, label, x, y, w, h, primary, fs = 17) {
    buttons.push({ id, x, y, w, h });
    const on = hover === id;
    ctx.save();
    if (primary) { ctx.fillStyle = on ? C.frost : C.pulse; ctx.fillRect(x, y, w, h); ctx.fillStyle = on ? C.shadow : C.paper; }
    else { ctx.strokeStyle = C.frost; ctx.lineWidth = 2; ctx.fillStyle = on ? C.frost : 'rgba(33,31,45,.6)'; ctx.fillRect(x, y, w, h); ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); ctx.fillStyle = on ? C.shadow : C.frost; }
    ctx.font = F(fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }
  function hitButton(p) { return buttons.find(b => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h); }
  function press(id) {
    audio(); sfx.lock();
    if (id === 'start' || id === 'again') newGame();
    else if (id === 'scores') { state = 'scores'; t0 = now; }
    else if (id === 'menu') { state = 'menu'; t0 = now; hideEntry(); }
    else if (id === 'mute') { muted = !muted; store.set('lnl-tp-muted', muted ? '1' : '0'); }
    else if (id === 'resume') paused = false;
  }
  function reload() { if (reloading || ammo === MAG || state !== 'play') return; reloading = .9; sfx.reload(); }
  function fire(p) {
    if (state !== 'play' || paused) return;
    if (reloading) return;
    if (ammo <= 0) { reload(); return; }
    ammo--; shots++; muzzle = .08; shake = Math.max(shake, 3); sfx.shot();
    const muz = muzzlePos();
    darts.push({ x0: muz.x, y0: muz.y, x1: p.x, y1: p.y, t: 0 });
    // nearest-first hit test
    let best = null, bd = 1e9;
    targets.forEach(t => { if (t.leaving || t.hit) return; const s = targetScreen(t); const dd = Math.hypot(p.x - s.x, p.y - s.y); if (dd <= s.r && s.up > .6 && (t.d > (best ? best.d : -1))) { best = t; bd = dd / s.r; } });
    if (best) {
      const q = bd < .26 ? 100 : bd < .6 ? 50 : 25;
      combo++; bestCombo = Math.max(bestCombo, combo);
      const cm = 1 + Math.min(4, Math.floor(combo / 3)) * .5;
      const pts = Math.round(q * TYPES[best.type].mult * cm);
      score += pts; hits++; roundHits++;
      best.hit = 1; best.leaving = .001;
      const s = targetScreen(best);
      burst(s.x, s.y, TYPES[best.type].color, s.s);
      splat(s.x, s.y, TYPES[best.type].color);
      pops.push({ x: s.x, y: s.y - s.r - 10, txt: (q === 100 ? 'BULLSEYE +' : '+') + pts, c: TYPES[best.type].color, t: 0 });
      sfx.hit(q);
      if (combo > 0 && combo % 5 === 0) banner = { txt: `COMBO ×${cm.toFixed(1)}`, t: 0 };
    } else {
      combo = 0; sfx.miss();
      if (p.y < WALL.y1 && p.x > WALL.x0 && p.x < WALL.x1) decals.push({ x: p.x, y: p.y, r: 3, c: 'rgba(238,241,249,.55)', drip: 0, dot: 1 });
    }
    if (ammo === 0) setTimeout(reload, 250);
  }
  cv.addEventListener('pointermove', e => { const p = toStage(e); mouse = { x: p.x, y: p.y, in: true }; const b = hitButton(p); hover = b ? b.id : null; });
  cv.addEventListener('pointerleave', () => { mouse.in = false; hover = null; });
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) { e.preventDefault(); reload(); return; }
    const p = toStage(e); mouse = { x: p.x, y: p.y, in: true };
    const b = hitButton(p);
    if (b) { press(b.id); return; }
    if (paused) { paused = false; return; }
    if (state === 'boot') { state = 'menu'; t0 = now; return; }
    fire(p);
  });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'r') reload();
    else if (k === 'm') press('mute');
    else if (k === 'escape' || k === 'p') { if (state === 'play') paused = !paused; }
    else if ((k === 'enter' || k === ' ') && (state === 'menu' || state === 'boot')) { e.preventDefault(); newGame(); }
    else if ((k === 'enter' || k === ' ') && state === 'over' && !entryOpen()) { e.preventDefault(); newGame(); }
  });

  /* ---------- high-score entry (DOM overlay so it works with any keyboard) ---------- */
  const entry = document.getElementById('tpEntry'), entryInput = document.getElementById('tpInitials');
  const entryOpen = () => !entry.hidden;
  function hideEntry() { entry.hidden = true; }
  let pendingScore = null;
  function onGameOver() {
    const qualifies = score > 0 && (scores.length < 5 || score > scores[scores.length - 1].score);
    if (qualifies) { pendingScore = { score, round, combo: bestCombo, acc: shots ? Math.round(hits / shots * 100) : 0, date: new Date().toISOString().slice(0, 10) }; entry.hidden = false; entryInput.value = store.get('lnl-tp-last') || ''; setTimeout(() => entryInput.focus(), 50); }
  }
  document.getElementById('tpEntryForm').addEventListener('submit', e => {
    e.preventDefault(); if (!pendingScore) return;
    const name = (entryInput.value || 'LNL').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'LNL';
    store.set('lnl-tp-last', name);
    scores.push({ ...pendingScore, name }); scores.sort((a, b) => b.score - a.score); scores = scores.slice(0, 5);
    store.set('lnl-tp-scores', JSON.stringify(scores)); pendingScore = null; hideEntry(); state = 'scores'; t0 = now; cv.focus();
  });
  entryInput.addEventListener('input', () => { entryInput.value = entryInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });

  /* ---------- effects ---------- */
  function burst(x, y, c, s) {
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, sp = (120 + Math.random() * 260) * s; fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, rot: Math.random() * 6, vr: (Math.random() - .5) * 14, size: (6 + Math.random() * 9) * s, c, t: 0, life: .5 + Math.random() * .35 }); }
    shake = Math.max(shake, 6);
  }
  function splat(x, y, c) {
    // paint lands on the back wall behind the target
    const wy = Math.min(WALL.y1 - 10, Math.max(WALL.y0 + 10, VP.y + (y - VP.y) * .55));
    const wx = Math.min(WALL.x1 - 10, Math.max(WALL.x0 + 10, VP.x + (x - VP.x) * .55));
    decals.push({ x: wx, y: wy, r: 10 + Math.random() * 12, c, drip: 10 + Math.random() * 40, seed: Math.random() * 100 });
    if (decals.length > 60) decals.shift();
  }

  /* ---------- drawing ---------- */
  function drawRoom() {
    if (!roomCache) roomCache = buildRoom();
    ctx.drawImage(roomCache, 0, 0);
    // paint decals (on the wall, clipped)
    ctx.save(); ctx.beginPath(); ctx.rect(WALL.x0, WALL.y0, WALL.x1 - WALL.x0, WALL.y1 - WALL.y0); ctx.clip();
    decals.forEach(d => {
      ctx.fillStyle = d.c; ctx.globalAlpha = d.dot ? .7 : .62;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.28); ctx.fill();
      if (!d.dot) {
        for (let k = 0; k < 6; k++) { const a = d.seed + k * 1.1, rr = d.r * (.5 + ((d.seed * (k + 3)) % 1) * .6); ctx.beginPath(); ctx.arc(d.x + Math.cos(a) * d.r * 1.25, d.y + Math.sin(a) * d.r * 1.1, rr * .45, 0, 6.28); ctx.fill(); }
        ctx.fillRect(d.x - 1.5, d.y, 3, d.drip); ctx.beginPath(); ctx.arc(d.x, d.y + d.drip, 2.4, 0, 6.28); ctx.fill();
      }
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function drawTarget(t) {
    const T = TYPES[t.type], p = targetScreen(t);
    if (p.up <= 0) return;
    // floor shadow and post
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.fy, p.r * .9, p.r * .22, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#15141c'; ctx.fillRect(p.x - 3 * p.s, p.y + p.r * .8, 6 * p.s, Math.max(0, p.fy - p.y - p.r * .8));
    ctx.fillStyle = C.shadow; ctx.fillRect(p.x - 14 * p.s, p.fy - 5 * p.s, 28 * p.s, 6 * p.s);
    // face
    ctx.translate(p.x, p.y);
    const r = p.r;
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
    ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(0, 0, r * .5, 0, 6.28); ctx.fill();
    ctx.fillStyle = T.color; ctx.beginPath(); ctx.arc(0, 0, r * .26, 0, 6.28); ctx.fill();
    // angular notches from the emblem's 30° geometry
    ctx.fillStyle = C.shadow;
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2 + Math.PI / 4); ctx.beginPath(); ctx.moveTo(r * .66, -r * .07); ctx.lineTo(r * .92, -r * .16); ctx.lineTo(r * .92, r * .02); ctx.lineTo(r * .66, r * .11); ctx.closePath(); ctx.fill(); ctx.restore(); }
    ctx.restore();
    // emblem at the bullseye
    drawEmblem(p.x, p.y, r * .38, C.paper, 0, 1);
    // lifetime ring
    if (!t.leaving) { const k = 1 - t.age / t.life; ctx.strokeStyle = 'rgba(238,241,249,.8)'; ctx.lineWidth = 2.5 * p.s; ctx.beginPath(); ctx.arc(p.x, p.y, r + 6 * p.s, -Math.PI / 2, -Math.PI / 2 + k * 6.28); ctx.stroke(); }
  }
  function muzzlePos() { const a = Math.max(-2.6, Math.min(-.6, aimAngle())); return { x: 1090 + Math.cos(a) * 255, y: 700 + Math.sin(a) * 255 }; }
  function aimAngle() { return Math.atan2(mouse.y - 700, mouse.x - 1090); }
  function drawBench() {
    // bench top surface in perspective
    ctx.fillStyle = '#2d2b3b'; poly(ctx, [[0, 612], [W, 612], [W, 636], [0, 636]]); ctx.fill();
    ctx.fillStyle = '#3a3850'; ctx.fillRect(0, 608, W, 6);
    ctx.fillStyle = C.shadow; ctx.fillRect(0, 636, W, H - 636);
    ctx.fillStyle = C.pulse; ctx.fillRect(0, 636, W, 4);
    // edge highlight and logo plate on the bench front
    drawLogo(W / 2, 680, 300, C.frost, C.pulse, .9);
    ctx.fillStyle = 'rgba(238,241,249,.35)'; ctx.font = F(11, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('LANE 06 · TARGET PRACTICE · VOLT', 28, 680);
  }
  function drawBlaster() {
    const a = Math.max(-2.6, Math.min(-.6, aimAngle()));
    ctx.save(); ctx.translate(1090, 700); ctx.rotate(a); ctx.scale(1.7, 1.7);
    const recoil = muzzle > 0 ? -12 : 0; ctx.translate(recoil, 0);
    // body
    ctx.fillStyle = '#16151e'; poly(ctx, [[-60, -26], [70, -26], [92, -14], [150, -14], [150, 8], [70, 8], [40, 30], [-60, 30]]); ctx.fill();
    ctx.fillStyle = C.pulse; poly(ctx, [[-30, -20], [60, -20], [72, -10], [-18, -10]]); ctx.fill();
    ctx.fillStyle = '#3a3850'; ctx.fillRect(90, -10, 60, 4);
    ctx.fillStyle = C.frost; ctx.fillRect(146, -14, 6, 22);
    if (muzzle > 0) { ctx.fillStyle = 'rgba(238,241,249,.9)'; ctx.beginPath(); ctx.arc(162, -3, 16 + Math.random() * 6, 0, 6.28); ctx.fill(); }
    ctx.restore();
  }
  function drawCrosshair() {
    if (!mouse.in || !['intro', 'play', 'clear'].includes(state) || paused) return;
    const { x, y } = mouse, g = reloading ? 10 : 7;
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5;
    const ticks = () => { [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(dx * g, dy * g); ctx.lineTo(dx * (g + 12), dy * (g + 12)); ctx.stroke(); }); };
    ticks(); ctx.strokeStyle = reloading ? C.ign : C.frost; ctx.lineWidth = 2.5; ticks();
    ctx.fillStyle = C.pulse; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 6.28); ctx.fill();
    if (reloading) { ctx.strokeStyle = C.ign; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + (1 - reloading / .9) * 6.28); ctx.stroke(); }
    ctx.restore();
  }
  function drawHUD() {
    ctx.save(); ctx.textBaseline = 'top';
    // left block
    ctx.fillStyle = 'rgba(33,31,45,.82)'; ctx.fillRect(20, 18, 400, 78);
    ctx.fillStyle = 'rgba(238,241,249,.6)'; ctx.font = F(11, 600); ctx.textAlign = 'left'; ctx.fillText('SCORE', 34, 28); ctx.fillText(`ROUND ${round}`, 290, 28);
    ctx.fillStyle = C.frost; ctx.font = F(30); ctx.fillText(String(score).padStart(6, '0'), 34, 44);
    // quota bar
    const qx = 290, qy = 50, qw = 116;
    for (let i = 0; i < quota; i++) { const w = (qw - (quota - 1) * 2) / quota; ctx.fillStyle = i < roundHits ? C.pulse : 'rgba(238,241,249,.18)'; ctx.fillRect(qx + i * (w + 2), qy, w, 10); }
    ctx.fillStyle = 'rgba(238,241,249,.6)'; ctx.font = F(11, 600); ctx.fillText(`${Math.min(roundHits, quota)}/${quota} HITS`, qx, qy + 18);
    // timer
    ctx.fillStyle = 'rgba(33,31,45,.82)'; ctx.fillRect(W / 2 - 70, 18, 140, 56);
    ctx.textAlign = 'center'; ctx.fillStyle = timeLeft < 6 ? C.ign : C.frost; ctx.font = F(32); ctx.fillText(Math.max(0, timeLeft).toFixed(1), W / 2, 28);
    // combo
    if (combo >= 2) { ctx.textAlign = 'left'; ctx.font = F(14); ctx.fillStyle = C.surge; ctx.fillText(`COMBO ${combo}`, 34, 106); }
    // ammo pips (magazine)
    ctx.fillStyle = 'rgba(33,31,45,.82)'; ctx.fillRect(W - 250, 18, 230, 56);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(238,241,249,.6)'; ctx.font = F(11, 600); ctx.fillText(reloading ? 'RELOADING' : ammo === 0 ? 'EMPTY · R TO RELOAD' : 'MAGAZINE', W - 236, 28);
    for (let i = 0; i < MAG; i++) { ctx.fillStyle = i < ammo ? C.frost : 'rgba(238,241,249,.15)'; poly(ctx, [[W - 236 + i * 20, 62], [W - 226 + i * 20, 46], [W - 220 + i * 20, 46], [W - 230 + i * 20, 62]]); ctx.fill(); }
    ctx.restore();
    // mute button
    button('mute', muted ? 'SOUND OFF' : 'SOUND ON', W - 250, 82, 160, 30, false, 11);
  }
  function overlay(a = .72) { ctx.fillStyle = `rgba(33,31,45,${a})`; ctx.fillRect(0, 0, W, H); }
  const ease = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  function centerText(txt, y, px, color, w = 900) { ctx.font = F(px, w); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(txt, W / 2, y); }

  function render() {
    buttons.length = 0;
    ctx.save();
    if (shake > 0 && !reduce) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    drawRoom();
    // targets back to front
    targets.slice().sort((a, b) => a.d - b.d).forEach(drawTarget);
    // darts
    darts.forEach(d => { const k = d.t / .09; ctx.strokeStyle = `rgba(238,241,249,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(d.x0 + (d.x1 - d.x0) * k * .6, d.y0 + (d.y1 - d.y0) * k * .6); ctx.lineTo(d.x0 + (d.x1 - d.x0) * Math.min(1, k + .4), d.y0 + (d.y1 - d.y0) * Math.min(1, k + .4)); ctx.stroke(); });
    // shards
    fx.forEach(p => { ctx.save(); ctx.globalAlpha = 1 - p.t / p.life; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; poly(ctx, [[-p.size, -p.size * .3], [p.size * .4, -p.size * .3], [p.size, p.size * .3], [-p.size * .4, p.size * .3]]); ctx.fill(); ctx.restore(); });
    // score pops
    pops.forEach(p => { ctx.globalAlpha = 1 - p.t / .9; ctx.font = F(18); ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = C.shadow; ctx.strokeText(p.txt, p.x, p.y - p.t * 50); ctx.fillStyle = p.c; ctx.fillText(p.txt, p.x, p.y - p.t * 50); ctx.globalAlpha = 1; });
    const playing = ['intro', 'play', 'clear', 'over'].includes(state);
    if (playing) { drawBench(); drawBlaster(); drawHUD(); }
    ctx.restore();

    const k = (now - t0) / 1000;
    if (state === 'boot') {
      overlay(.94);
      const lock = ease(k / 1.1);
      drawEmblem(W / 2, H / 2 - 40, 300, C.pulse, (1 - lock) * 170);
      if (k > 1.1) { const a = Math.min(1, (k - 1.1) / .3); ctx.globalAlpha = a; centerText('LOCK N.', H / 2 + 120, 54, C.frost); ctx.globalAlpha = 1; }
      if (k > 1.05 && !wrap.dataset.locked) { wrap.dataset.locked = '1'; }
      if (k > 2.4) { state = 'menu'; t0 = now; }
    } else if (state === 'menu') {
      overlay(.78);
      const a = ease(k / .4);
      ctx.globalAlpha = a;
      drawLogo(W / 2, 150, 520, C.frost, C.pulse);
      centerText('TARGET PRACTICE', 250, 58, C.frost);
      centerText('Hit the quota before the clock runs out. Every round gets faster.', 312, 18, 'rgba(238,241,249,.72)', 400);
      button('start', 'START GAME', W / 2 - 150, 360, 300, 58, true);
      button('scores', 'HIGH SCORES', W / 2 - 150, 430, 300, 50, false);
      // legend
      const items = [['focus', 'FOCUS', '×3 · small, fast'], ['adapt', 'ADAPT', '×2 · balanced'], ['breach', 'BREACH', '×1 · advances on you']];
      items.forEach(([t, n, d], i) => { const x = W / 2 - 330 + i * 230; drawMiniTarget(x, 560, TYPES[t].color); ctx.textAlign = 'left'; ctx.font = F(15); ctx.fillStyle = TYPES[t].color; ctx.fillText(n, x + 30, 552); ctx.font = F(13, 400); ctx.fillStyle = 'rgba(238,241,249,.7)'; ctx.fillText(d, x + 30, 572); });
      centerText('Click to fire · R or right-click to reload · M sound · Esc pause', 650, 14, 'rgba(238,241,249,.55)', 400);
      if (best()) centerText(`BEST ${best()}`, 690, 14, C.pulse);
      ctx.globalAlpha = 1;
      button('mute', muted ? 'SOUND OFF' : 'SOUND ON', W - 180, 20, 160, 30, false, 11);
    } else if (state === 'scores') {
      overlay(.86);
      centerText('HIGH SCORES', 110, 46, C.frost);
      centerText('Saved in this browser', 150, 14, 'rgba(238,241,249,.6)', 400);
      if (!scores.length) centerText('No scores yet. Lock in and set the first one.', 330, 20, 'rgba(238,241,249,.8)', 400);
      scores.forEach((s, i) => {
        const y = 210 + i * 62;
        ctx.fillStyle = i === 0 ? C.pulse : 'rgba(238,241,249,.08)'; ctx.fillRect(W / 2 - 340, y, 680, 52);
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = C.frost; ctx.font = F(20);
        ctx.fillText(`${i + 1}`, W / 2 - 316, y + 27); ctx.fillText(s.name, W / 2 - 260, y + 27);
        ctx.textAlign = 'right'; ctx.fillText(String(s.score), W / 2 + 80, y + 27);
        ctx.font = F(13, 600); ctx.fillStyle = 'rgba(238,241,249,.75)'; ctx.fillText(`ROUND ${s.round} · ${s.acc}% · ${s.date}`, W / 2 + 316, y + 27);
      });
      button('start', 'PLAY', W / 2 - 230, 560, 220, 52, true);
      button('menu', 'MENU', W / 2 + 10, 560, 220, 52, false);
    } else if (state === 'intro') {
      overlay(.35 * (1 - ease((k - 1.4) / .4)));
      const a = k < 1.5 ? 1 : 1 - (k - 1.5) / .3;
      ctx.globalAlpha = Math.max(0, a);
      centerText(`ROUND ${round}`, H / 2 - 50, 84, C.frost);
      if (k > .55) centerText('LOCK N.', H / 2 + 40, 40, C.pulse);
      centerText(`Hit ${quota} targets in ${cfg.time} seconds`, H / 2 + 100, 18, 'rgba(238,241,249,.8)', 400);
      ctx.globalAlpha = 1;
      if (k > 1.8) { state = 'play'; t0 = now; }
    } else if (state === 'clear') {
      overlay(.6);
      centerText('ROUND CLEAR', H / 2 - 60, 70, C.surge);
      centerText(`Time bonus +${Math.round(Math.max(0, timeLeft) * 10)} · Accuracy ${shots ? Math.round(hits / shots * 100) : 0}%`, H / 2 + 10, 20, C.frost, 400);
      centerText('Next round incoming', H / 2 + 60, 15, 'rgba(238,241,249,.65)', 400);
      if (k > 2.2) { round++; startRound(); }
    } else if (state === 'over') {
      overlay(.8);
      centerText('OUT OF TIME', 150, 70, C.ign);
      centerText(String(score), 250, 76, C.frost);
      centerText(`Reached round ${round} · Accuracy ${shots ? Math.round(hits / shots * 100) : 0}% · Best combo ${bestCombo}`, 318, 18, 'rgba(238,241,249,.8)', 400);
      if (entryOpen()) centerText('NEW HIGH SCORE · ENTER YOUR INITIALS', 380, 18, C.surge);
      else { button('again', 'PLAY AGAIN', W / 2 - 375, 430, 240, 54, true, 15); button('scores', 'HIGH SCORES', W / 2 - 120, 430, 240, 54, false, 15); button('menu', 'MENU', W / 2 + 135, 430, 240, 54, false, 15); }
    }
    if (banner) { const a = 1 - banner.t / 1.1; ctx.globalAlpha = Math.max(0, a); centerText(banner.txt, 170, 36, C.surge); ctx.globalAlpha = 1; }
    if (paused) { overlay(.75); centerText('PAUSED', H / 2 - 30, 60, C.frost); button('resume', 'RESUME', W / 2 - 110, H / 2 + 20, 220, 54, true); }
    drawCrosshair();
    cv.style.cursor = (state === 'play' && !paused && !hover) ? 'none' : (hover ? 'pointer' : 'default');
  }
  function drawMiniTarget(x, y, c) {
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(x, y, 18, 0, 6.28); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 16, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, 11, 0, 6.28); ctx.fill();
    ctx.fillStyle = C.shadow; ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.28); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 6.28); ctx.fill();
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 30);
    if (muzzle > 0) muzzle -= dt;
    fx.forEach(p => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.rot += p.vr * dt; }); fx = fx.filter(p => p.t < p.life);
    pops.forEach(p => p.t += dt); pops = pops.filter(p => p.t < .9);
    darts.forEach(d => d.t += dt); darts = darts.filter(d => d.t < .09);
    if (banner) { banner.t += dt; if (banner.t > 1.1) banner = null; }
    targets.forEach(t => { if (t.leaving) t.leaving += dt; });
    if (state !== 'play' || paused) { targets = targets.filter(t => !t.leaving || t.leaving < .25); return; }
    timeLeft -= dt;
    if (reloading) { reloading -= dt; if (reloading <= 0) { reloading = 0; ammo = MAG; } }
    spawnT -= dt;
    const live = targets.filter(t => !t.leaving).length;
    if (spawnT <= 0 && live < cfg.maxOn) { spawn(); spawnT = cfg.spawnEvery * (.7 + Math.random() * .6); }
    targets.forEach(t => {
      if (t.leaving) return;
      t.age += dt;
      if (t.type === 'breach') { t.d = Math.min(1, t.d + dt * .09 * t.v); t.u += t.dir * dt * .05 * t.v; }
      else t.u += t.dir * dt * (t.type === 'focus' ? .2 : .12) * t.v;
      if (t.u < .06 || t.u > .94) { t.dir *= -1; t.u = Math.min(.94, Math.max(.06, t.u)); }
      if (t.age > t.life || t.d >= 1) { t.leaving = .001; combo = 0; }
    });
    targets = targets.filter(t => !t.leaving || t.leaving < .25);
    if (roundHits >= quota && state === 'play') { endRound(); return; }
    if (timeLeft <= 0) endRound();
  }

  /* ---------- loop, sizing, visibility ---------- */
  let running = false, visible = false;
  function size() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  }
  function loop(ts) {
    if (!running) return;
    now = ts; const dt = Math.min(.05, (ts - last) / 1000); last = ts;
    update(dt); render();
    requestAnimationFrame(loop);
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(loop); }
  function stop() { running = false; if (state === 'play') paused = true; }
  new ResizeObserver(() => { size(); roomCache = null; }).observe(cv);
  new IntersectionObserver(es => es.forEach(e => {
    visible = e.isIntersecting;
    if (visible) { if (state === 'boot') { t0 = performance.now(); } start(); } else stop();
  }), { threshold: .25 }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (visible) start(); });
  document.getElementById('tpFull').addEventListener('click', () => {
    const el = wrap;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { roomCache = null; });
  size();
})();
