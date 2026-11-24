// GoTAB quiz player: every teacher quiz type is played as a real game.
//   quiz      → boss battle: a right answer hits the boss, a wrong one hits you
//   lightning → speed marathon: 10 s per question, faster = more points, combo streaks
//   target    → shooting gallery: shoot the balloon carrying the right answer
//   match     → memory cards: flip cards and find each question with its answer
//   carousel  → flashcards: flip, then swipe right (I know) or left (I don't); misses come back
//   sort      → conveyor: send the falling item to the right box before it hits the floor
// Shared: hearts, combo multiplier, score pop-ups, particles, Web Audio effects and music, results with stars.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const css = n => getComputedStyle(document.body).getPropertyValue(n).trim() || '#fff';

  const MODES = {
    quiz: { badge: 'ВИКТОРИНА', icon: '⚔️', name: 'Бастықпен шайқас', rule: 'Дұрыс жауап — бастыққа соққы. Қате немесе кешіксең — бастық саған соғады. Жүректерің таусылмай тұрып жең!', hearts: true },
    lightning: { badge: 'НАЙЗАҒАЙ', icon: '⚡', name: 'Найзағай марафоны', rule: 'Әр сұраққа 10 секунд. Неғұрлым жылдам жауап берсең, соғұрлым көп ұпай. Қатарынан дұрыс жауап — комбо!', hearts: true },
    target: { badge: 'НЫСАНА', icon: '🎯', name: 'Тир', rule: 'Ұшып жүрген шарлардың ішінен дұрыс жауапты көздеп ат. Қате атсаң — бір жүрек кетеді.', hearts: true },
    match: { badge: 'СӘЙКЕСТЕНДІРУ', icon: '🃏', name: 'Жады ойыны', rule: 'Карталарды аударып, сұрақ пен оның жауабын тап. Неғұрлым аз жүріс — соғұрлым көп жұлдыз!', hearts: false },
    carousel: { badge: 'КАРУСЕЛЬ', icon: '🎴', name: 'Флэш-карталар', rule: 'Картаны аударып, жауабыңды тексер. Білсең — оңға, білмесең — солға сырғыт. Білмегендерің қайта келеді.', hearts: false },
    sort: { badge: 'СҰРЫПТАУ', icon: '📦', name: 'Сұрыптау конвейері', rule: 'Элемент жоғарыдан құлап келеді — ол еденге түспей тұрып дұрыс қорапшаны бас!', hearts: true }
  };
  const BOSSES = { underwater: '🦑', cave: '🐉', space: '👾', forest: '🐺', steppe: '🦂', cyberpunk: '🤖', volcano: '🐲', arctic: '🦣', retro: '👻', magic: '🧙' };

  // ---------------- sound: Web Audio, no files ----------------
  const AU = (() => {
    let ctx = null, fxG, muG, seq = null, step = 0;
    let fxOn = store.get('qFx') !== 'off', muOn = store.get('qMusic') !== 'off';
    function A() {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        ctx = new AC(); fxG = ctx.createGain(); fxG.gain.value = .5; fxG.connect(ctx.destination);
        muG = ctx.createGain(); muG.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; muG.connect(lp); lp.connect(ctx.destination); }
      if (ctx.state === 'suspended') ctx.resume(); return ctx;
    }
    function tone(f, at, d, v, type = 'sine', out = fxG, to = 0) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d * .9);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + Math.min(.015, d / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + d + .05);
    }
    let nbuf = null;
    function noise(at, d, v, freq = 1500, q = 1, out = fxG) {
      if (!nbuf) { nbuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
      const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = nbuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + d + .05);
    }
    const semi = (f, k) => f * Math.pow(2, k / 12);
    const S = {
      correct: s => { const b = semi(523, Math.min((s || 1) - 1, 9)); [0, 4, 7].forEach((k, i) => tone(semi(b, k), i * .055, .22, .17, 'triangle')); },
      wrong: () => { tone(210, 0, .2, .2, 'sawtooth', fxG, 110); tone(150, .12, .28, .16, 'square', fxG, 80); },
      pop: () => { noise(0, .14, .45, 2200, .7); tone(900, 0, .09, .14, 'sine', fxG, 250); },
      flip: () => noise(0, .09, .22, 3200, .8),
      hit: () => { noise(0, .3, .6, 380, .7); tone(110, 0, .3, .35, 'sine', fxG, 40); },
      shoot: () => tone(1300, 0, .2, .1, 'sawtooth', fxG, 260),
      tick: () => tone(1600, 0, .04, .09, 'square'),
      count: () => tone(660, 0, .16, .2, 'square'),
      go: () => { tone(990, 0, .4, .2, 'square'); tone(1485, .04, .35, .1, 'triangle'); },
      combo: m => { [0, 4, 7, 12].forEach((k, i) => tone(semi(660, k + m * 2), i * .05, .16, .13, 'square')); },
      coin: () => { tone(988, 0, .08, .14, 'square'); tone(1319, .07, .28, .14, 'square'); },
      thud: () => { tone(160, 0, .18, .25, 'sine', fxG, 60); noise(0, .12, .25, 600, .8); },
      win: () => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * .11, i === 6 ? .9 : .3, .18, 'triangle')); [1568, 2093].forEach((f, i) => tone(f, .8 + i * .1, .6, .06)); },
      lose: () => { [392, 370, 349, 262].forEach((f, i) => tone(f, i * .26, .45, .18, 'triangle', fxG, i === 3 ? 180 : 0)); }
    };
    // background loop: Am – F – C – G, bass + arpeggio + soft hats
    const CH = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    function beat() {
      const c = CH[Math.floor(step / 16) % 4], s = step % 16;
      if (s % 8 === 0) tone(c[0] / 2, 0, .9, .1, 'triangle', muG);
      if (s % 2 === 0) tone(c[(s / 2) % 3] * (s % 8 < 4 ? 2 : 1), 0, .22, .045, 'sine', muG);
      if (s % 4 === 2) noise(0, .05, .05, 7000, 1.5, muG);
      step++;
    }
    return {
      play(n, a) { if (!fxOn || !A()) return; try { S[n]?.(a); } catch (_) {} },
      music(on) { if (!A()) return; if (on && muOn) { if (!seq) { muG.gain.cancelScheduledValues(ctx.currentTime); muG.gain.linearRampToValueAtTime(1, ctx.currentTime + 1); seq = setInterval(beat, 150); } }
        else if (seq) { clearInterval(seq); seq = null; muG.gain.cancelScheduledValues(ctx.currentTime); muG.gain.value = 0; } },
      get fxOn() { return fxOn; }, get muOn() { return muOn; },
      toggleFx() { fxOn = !fxOn; store.set('qFx', fxOn ? 'on' : 'off'); return fxOn; },
      toggleMusic(playing) { muOn = !muOn; store.set('qMusic', muOn ? 'on' : 'off'); this.music(muOn && playing); return muOn; }
    };
  })();

  // ---------------- particles, pop-ups, banners ----------------
  const FX = (() => {
    const c = $('fx'), g = c.getContext('2d'); let P = [], run = false, W = 0, H = 0;
    function size() { const d = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * d; c.height = H * d; g.setTransform(d, 0, 0, d, 0, 0); }
    addEventListener('resize', size); size();
    function loop() { g.clearRect(0, 0, W, H);
      P = P.filter(p => p.life > 0);
      for (const p of P) { p.vy += p.gr; p.vx *= p.dr; p.vy *= p.dr; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.dec;
        g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); g.translate(p.x, p.y); g.rotate(p.rot); g.fillStyle = p.col;
        if (p.rect) g.fillRect(-p.s, -p.s * .45, p.s * 2, p.s * .9); else { g.beginPath(); g.arc(0, 0, p.s, 0, 7); g.fill(); } g.restore(); }
      if (P.length) requestAnimationFrame(loop); else { run = false; g.clearRect(0, 0, W, H); } }
    const go = () => { if (!run) { run = true; requestAnimationFrame(loop); } };
    return {
      burst(x, y, cols, n = 28, sp = 7) { cols = [].concat(cols);
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = sp * (.35 + Math.random());
          P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, gr: .18, dr: .97, s: 2 + Math.random() * 4, col: cols[i % cols.length], life: 1, dec: .018 + Math.random() * .02, rot: 0, vr: 0, rect: i % 3 === 0 }); } go(); },
      confetti(n = 170) { const cols = ['#ffd447', '#ff5d8f', '#4ade80', '#38bdf8', '#c084fc', '#fb923c'];
        for (let i = 0; i < n; i++) P.push({ x: Math.random() * W, y: -20 - Math.random() * H * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, gr: .05, dr: .995, s: 4 + Math.random() * 5, col: cols[i % cols.length], life: 1.6, dec: .004 + Math.random() * .004, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, rect: true }); go(); },
      pop(x, y, text, bad) { const d = document.createElement('div'); d.className = 'pop' + (bad ? ' bad' : ''); d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 1000); },
      banner(text) { const b = $('banner'); b.textContent = text; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); },
      flash(kind) { const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = kind; },
      shake() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 420); }
    };
  })();

  // ---------------- game state ----------------
  let quiz = null, QS = [], mode = 'quiz', G = null, gen = 0, keyFn = null, timers = [];
  const later = (fn, ms) => { const my = gen; const t = setTimeout(() => { if (my === gen) fn(); }, ms); timers.push(t); return t; };
  const alive = my => my === gen;
  const heartsFor = n => Math.max(3, Math.ceil(n * .3));
  const mult = () => 1 + Math.min(4, Math.floor(G.streak / 3));

  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    $('hud').classList.toggle('active', !['sLoad', 'sIntro', 'sEnd'].includes(id)); }
  function renderHearts(lostNow) { const h = $('hearts'); if (!MODES[mode].hearts) { h.innerHTML = ''; return; }
    h.innerHTML = Array.from({ length: G.maxHearts }, (_, i) => `<span class="${i >= G.hearts ? 'lost' : ''}${lostNow && i === G.hearts ? ' pop' : ''}">❤️</span>`).join(''); }
  function progress(done, total) { $('hudProg').style.width = (total ? Math.min(100, done / total * 100) : 0) + '%'; }
  let scoreAnim = null;
  function setScore() { const el = $('score'), from = +el.textContent || 0, to = G.score, t0 = performance.now();
    cancelAnimationFrame(scoreAnim); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    const f = t => { const k = Math.min(1, (t - t0) / 450); el.textContent = Math.round(from + (to - from) * k); if (k < 1) scoreAnim = requestAnimationFrame(f); }; scoreAnim = requestAnimationFrame(f); }
  function comboUI() { const c = $('combo'), m = mult(); c.textContent = m > 1 ? `×${m} 🔥` : ''; c.classList.toggle('on', m > 1); if (m > 1) { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; } }

  // right answer: streak, multiplier, points, effects
  function good(x, y, base = 100, bonus = 0) {
    const before = mult(); G.right++; G.streak++; G.best = Math.max(G.best, G.streak);
    const m = mult(), pts = Math.round(base * m + bonus); G.score += pts; setScore(); comboUI();
    FX.pop(x, y - 10, '+' + pts); FX.burst(x, y, [css('--ok'), css('--acc'), '#fff', '#ffd447']); AU.play('correct', G.streak);
    if (m > before) { later(() => { FX.banner(m >= 5 ? 'МЕГА КОМБО ×5!' : `КОМБО ×${m}!`); AU.play('combo', m); }, 250); }
    return pts;
  }
  // wrong answer / timeout: returns true when the last heart is gone
  function bad(x, y, item, quiet) {
    G.wrong++; G.streak = 0; comboUI(); if (item) G.mistakes.push(item);
    if (x != null) FX.pop(x, y, quiet ? '✗' : '−❤', true);
    AU.play('wrong'); if (quiet) return false; FX.shake(); FX.flash('bad');
    if (MODES[mode].hearts) { G.hearts = Math.max(0, G.hearts - 1); renderHearts(true); if (!G.hearts) { G.dead = true; return true; } }
    return false;
  }
  // per-question countdown bar
  function timer(sec, bar, num, onEnd) {
    const t0 = performance.now(), my = gen; let stop = false, last = null; bar.classList.remove('low');
    const f = () => { if (stop || !alive(my)) return; const left = Math.max(0, sec - (performance.now() - t0) / 1000);
      bar.firstElementChild.style.width = (left / sec * 100) + '%'; const w = Math.ceil(left);
      if (num) { num.textContent = w; num.classList.toggle('low', left <= 3); }
      if (left <= 3 && w !== last && left > 0) { AU.play('tick'); bar.classList.add('low'); } last = w;
      if (left <= 0) { stop = true; onEnd(); return; } requestAnimationFrame(f); };
    f(); return { stop() { stop = true; }, left: () => Math.max(0, sec - (performance.now() - t0) / 1000) };
  }
  function wrongsFor(q, i) {
    const own = (q.wrong || []).map(w => String(w).trim()).filter(w => w && w !== q.a);
    const pool = shuffle(QS.filter((_, j) => j !== i).map(x => x.a).filter(a => a !== q.a && !own.includes(a)));
    return [...new Set([...own, ...pool])].slice(0, 3);
  }
  function choices(box, q, i, onPick) {
    box.innerHTML = ''; const opts = shuffle([q.a, ...wrongsFor(q, i)]);
    opts.forEach((o, j) => { const b = document.createElement('button'); b.className = 'ch'; b.dataset.ok = o === q.a ? '1' : '';
      b.innerHTML = `<span class="ltr">${'ABCD'[j]}</span><span class="tx"></span>`; b.querySelector('.tx').textContent = o;
      b.onclick = () => { if (b.disabled) return; lock(box); onPick(b, o === q.a); }; box.appendChild(b); });
    keyFn = e => { const k = '1234'.indexOf(e.key) + 1 || 'abcd'.indexOf(e.key.toLowerCase()) + 1; const b = box.children[k - 1]; if (k && b && !b.disabled) b.click(); };
  }
  const lock = box => box.querySelectorAll('.ch').forEach(b => b.disabled = true);
  const reveal = box => box.querySelectorAll('.ch').forEach(b => { b.disabled = true; if (b.dataset.ok) b.classList.add('ok'); });
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keyFn?.(e); });

  // ---------------- 1. boss battle (quiz) ----------------
  function shot(from, to, ch, cb) {
    const [x1, y1] = center(from), [x2, y2] = center(to), s = document.createElement('div'); s.className = 'shot'; s.textContent = ch; document.body.appendChild(s);
    const a = s.animate([{ left: x1 + 'px', top: y1 + 'px', transform: 'translate(-50%,-50%) scale(.5)' }, { left: (x1 + x2) / 2 + 'px', top: Math.min(y1, y2) - 60 + 'px', transform: 'translate(-50%,-50%) scale(1.3) rotate(180deg)', offset: .5 }, { left: x2 + 'px', top: y2 + 'px', transform: 'translate(-50%,-50%) scale(1) rotate(360deg)' }], { duration: 480, easing: 'ease-in' });
    a.onfinish = () => { s.remove(); cb?.(); };
  }
  function hitFx(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); const [x, y] = center(el.querySelector('.body')); FX.burst(x, y, ['#fff', '#ffd447', '#ff6b35'], 34, 9); AU.play('hit'); }
  let bossHp = 0;
  function startBoss() { show('sBoss'); bossHp = QS.length; $('bossBody').textContent = BOSSES[quiz.theme] || '👾'; $('boss').classList.remove('dead', 'hit');
    $('heroName').textContent = (G.name || 'БАТЫР').toUpperCase(); $('bossHp').style.width = '100%'; bossQ(0); }
  function bossQ(i) {
    if (G.dead) return later(() => end(false), 600);
    if (i >= QS.length) return bossFinale();
    const q = QS[i], my = gen; progress(i, QS.length); $('bNum').textContent = `${i + 1} / ${QS.length}`; $('bText').textContent = q.q;
    const card = $('bText').parentElement; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    const T = timer(20, $('bBar'), null, () => { if (!alive(my)) return; reveal($('bCh')); bossAttack(q, i, null); });
    choices($('bCh'), q, i, (b, ok) => { T.stop(); keyFn = null;
      if (ok) { b.classList.add('ok'); const [x, y] = center(b); good(x, y, 100, Math.round(T.left() * 5)); AU.play('shoot');
        shot($('hero'), $('boss'), G.streak >= 3 ? '☄️' : '⚡', () => { if (!alive(my)) return; hitFx($('boss')); bossHp--; $('bossHp').style.width = (bossHp / QS.length * 100) + '%'; });
        later(() => bossQ(i + 1), 1300); }
      else { b.classList.add('no'); reveal($('bCh')); bossAttack(q, i, b); } });
  }
  function bossAttack(q, i, btn) { const my = gen; keyFn = null; AU.play('shoot');
    shot($('boss'), $('hero'), '🔥', () => { if (!alive(my)) return; hitFx($('hero')); const [x, y] = center($('hero')); bad(x, y - 40, { q: q.q, a: q.a }); later(() => bossQ(i + 1), 1500); }); }
  function bossFinale() { progress(1, 1); keyFn = null; FX.banner('СОҢҒЫ СОҚҚЫ!'); let k = 0; const my = gen;
    const fire = () => { if (!alive(my)) return; AU.play('shoot'); shot($('hero'), $('boss'), ['⚡', '☄️', '💥'][k % 3], () => { if (!alive(my)) return; hitFx($('boss')); });
      if (++k < 4) later(fire, 180); else later(() => { $('bossHp').style.width = '0%'; $('boss').classList.add('dead'); AU.play('hit'); later(() => end(true), 1300); }, 600); };
    later(fire, 700); }

  // ---------------- 2. lightning marathon ----------------
  function startLight() { show('sLight'); lightQ(0); }
  function lightQ(i) {
    if (G.dead) return later(() => end(false), 600);
    if (i >= QS.length) return later(() => end(true), 300);
    const q = QS[i], my = gen; progress(i, QS.length); $('lNum').textContent = `${i + 1} / ${QS.length}`; $('lText').textContent = q.q;
    const card = $('lCard'); card.classList.toggle('fire', G.streak >= 3); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    const T = timer(10, $('lBar'), $('lSec'), () => { if (!alive(my)) return; keyFn = null; reveal($('lCh')); const [x, y] = center(card); bad(x, y, { q: q.q, a: q.a }); FX.banner('⏰ ТЫМ БАЯУ!'); later(() => lightQ(i + 1), 1400); });
    choices($('lCh'), q, i, (b, ok) => { T.stop(); keyFn = null; const [x, y] = center(b);
      if (ok) { b.classList.add('ok'); FX.flash('good'); good(x, y, 100, Math.round(T.left() * 25)); later(() => lightQ(i + 1), 800); }
      else { b.classList.add('no'); reveal($('lCh')); bad(x, y, { q: q.q, a: q.a }); later(() => lightQ(i + 1), 1500); } });
  }

  // ---------------- 3. shooting gallery (target) ----------------
  let balloons = [], tRaf = 0;
  const BCOL = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
  function startTarget() { show('sTarget'); const f = $('field');
    f.onpointermove = e => { const r = f.getBoundingClientRect(); $('cross').style.left = e.clientX - r.left + 'px'; $('cross').style.top = e.clientY - r.top + 'px'; };
    targetQ(0); }
  function targetQ(i) {
    cancelAnimationFrame(tRaf); const f = $('field'); f.querySelectorAll('.bl,.hole').forEach(b => b.remove()); balloons = [];
    if (G.dead) return later(() => end(false), 600);
    if (i >= QS.length) return later(() => end(true), 300);
    const q = QS[i], my = gen; let done = false; progress(i, QS.length); $('tNum').textContent = `${i + 1} / ${QS.length}`; $('tText').textContent = q.q;
    const opts = shuffle([q.a, ...wrongsFor(q, i)]), n = opts.length, W = f.clientWidth, H = f.clientHeight, cols = shuffle(BCOL.slice());
    opts.forEach((o, j) => { const b = document.createElement('div'); b.className = 'bl'; b.textContent = o; b.style.background = `radial-gradient(circle at 32% 28%, ${cols[j]}cc, ${cols[j]})`; f.appendChild(b);
      const bw = b.offsetWidth, bh = b.offsetHeight, laneH = (H - 40) / n, dir = j % 2 ? -1 : 1;
      balloons.push({ el: b, ok: o === q.a, x: Math.random() * Math.max(1, W - bw), y: 10 + j * laneH + Math.max(0, (laneH - bh) / 2), w: bw, h: bh, vx: dir * (40 + Math.random() * 50 + i * 3), ph: Math.random() * 6, live: true });
      b.onpointerdown = e => { e.preventDefault(); shoot(b, e); }; });
    const t0 = performance.now(); let last = t0;
    const move = now => { if (!alive(my) || done) return; const dt = Math.min(.05, (now - last) / 1000); last = now; const W2 = f.clientWidth;
      for (const B of balloons) { if (!B.live) continue; B.x += B.vx * dt; if (B.x < -B.w) B.x = W2; if (B.x > W2) B.x = -B.w;
        const tf = `translate(${B.x}px,${B.y + Math.sin(now / 500 + B.ph) * 8}px)`; B.el.style.transform = tf; B.el.style.setProperty('--tf', tf); }
      tRaf = requestAnimationFrame(move); };
    tRaf = requestAnimationFrame(move);
    const T = timer(12, $('tBar'), null, () => { if (!alive(my) || done) return; done = true; balloons.find(B => B.ok)?.el.classList.add('ok'); const [x, y] = center(f); bad(x, y, { q: q.q, a: q.a }); FX.banner('⏰ УАҚЫТ БІТТІ!'); later(() => targetQ(i + 1), 1500); });
    function shoot(el, e) { if (done) return; const B = balloons.find(b => b.el === el); if (!B || !B.live) return; done = true; T.stop();
      const r = f.getBoundingClientRect(), h = document.createElement('div'); h.className = 'hole'; h.style.left = e.clientX - r.left + 'px'; h.style.top = e.clientY - r.top + 'px'; f.appendChild(h);
      const [x, y] = center(el); B.live = false; AU.play('pop');
      if (B.ok) { el.classList.add('popd'); good(x, y, 100, Math.round(T.left() * 10)); later(() => targetQ(i + 1), 900); }
      else { el.classList.add('no'); FX.burst(x, y, ['#666', '#999'], 20, 6); balloons.find(b => b.ok)?.el.classList.add('ok'); bad(x, y, { q: q.q, a: q.a }); later(() => targetQ(i + 1), 1500); } }
    f.onpointerdown = e => { if (e.target === f && !done) { const r = f.getBoundingClientRect(), h = document.createElement('div'); h.className = 'hole'; h.style.left = e.clientX - r.left + 'px'; h.style.top = e.clientY - r.top + 'px'; f.appendChild(h); AU.play('thud'); } };
  }

  // ---------------- 4. memory cards (match) ----------------
  let mOpen = [], mLock = false, mRounds = [], mRound = 0, mFound = 0, mClock = 0;
  function startMemory() { show('sMemory'); const ids = shuffle(QS.map((_, i) => i)); mRounds = []; for (let i = 0; i < ids.length; i += 8) mRounds.push(ids.slice(i, i + 8));
    if (mRounds.length > 1 && mRounds[mRounds.length - 1].length < 3) { const t = mRounds.pop(); mRounds[mRounds.length - 1].push(...t); }
    mFound = 0; G.moves = 0; $('mMoves').textContent = 0; clearInterval(mClock); const my = gen;
    mClock = setInterval(() => { if (!alive(my)) return clearInterval(mClock); const s = Math.floor((performance.now() - G.t0) / 1000); $('mTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
    memoryRound(0); }
  function memoryRound(r) { mRound = r; mOpen = []; mLock = false; const ids = mRounds[r];
    $('mRound').textContent = mRounds.length > 1 ? `Раунд: ${r + 1}/${mRounds.length}` : '';
    const cards = shuffle(ids.flatMap(id => [{ id, s: 'q', t: QS[id].q }, { id, s: 'a', t: QS[id].a }]));
    const grid = $('grid'); grid.innerHTML = '';
    cards.forEach((c, k) => { const d = document.createElement('div'); d.className = 'mc ' + c.s; d.style.animationDelay = (k * .04) + 's'; d.dataset.id = c.id; d.dataset.s = c.s;
      d.innerHTML = `<div class="in"><div class="f bk"><i>${c.s === 'q' ? '?' : '!'}</i><small>${c.s === 'q' ? 'СҰРАҚ' : 'ЖАУАП'}</small></div><div class="f fr"></div></div>`;
      d.querySelector('.fr').textContent = c.t; d.onclick = () => flipMem(d); grid.appendChild(d); });
    if (r) FX.banner(`${r + 1}-РАУНД`); }
  function flipMem(d) {
    if (mLock || d.classList.contains('open') || d.classList.contains('done')) return;
    d.classList.add('open'); AU.play('flip'); mOpen.push(d); if (mOpen.length < 2) return;
    const [a, b] = mOpen; G.moves++; $('mMoves').textContent = G.moves; mOpen = [];
    if (a.dataset.id === b.dataset.id && a.dataset.s !== b.dataset.s) {
      later(() => { a.classList.add('done'); b.classList.add('done'); const [x, y] = center(b); good(x, y, 100); mFound++; progress(mFound, QS.length);
        if (!$('grid').querySelector('.mc:not(.done)')) { if (mRound + 1 < mRounds.length) later(() => memoryRound(mRound + 1), 900); else later(() => end(true), 900); } }, 350);
    } else { mLock = true; later(() => { a.classList.add('miss'); b.classList.add('miss'); const [x, y] = center(b); bad(x, y, null, true); }, 450);
      later(() => { a.classList.remove('open', 'miss'); b.classList.remove('open', 'miss'); mLock = false; }, 1100); }
  }

  // ---------------- 5. flashcards (carousel) ----------------
  let deck = [], retry = [], cRound = 1, cFlipped = false, cBusy = false;
  function startCards() { show('sCards'); deck = shuffle(QS.map((_, i) => i)); retry = []; cRound = 1; G.known = 0; renderDeck(); }
  function renderDeck() {
    const box = $('deck'); box.innerHTML = ''; cFlipped = false; cBusy = false; $('kNo').disabled = $('kYes').disabled = true;
    $('cRound').textContent = cRound === 1 ? `${QS.length - deck.length + 1} / ${QS.length}` : `ҚАЙТАЛАУ · ${deck.length} карта қалды`;
    $('cHint').textContent = '👆 Картаны басып (немесе бос орын пернесі), жауапты аш';
    if (!deck.length) { if (retry.length) { deck = shuffle(retry); retry = []; cRound++; FX.banner('ҚАЙТАЛАУ РАУНДЫ'); return later(renderDeck, 700); } return later(() => end(true), 300); }
    [2, 1].forEach(k => { if (deck.length > k) { const g = document.createElement('div'); g.className = 'fc ' + (k === 2 ? 'ghost2' : 'ghost'); g.innerHTML = '<div class="in"><div class="f"></div></div>'; box.appendChild(g); } });
    const q = QS[deck[0]], c = document.createElement('div'); c.className = 'fc'; c.style.animation = 'cardIn .35s';
    c.innerHTML = '<div class="stamp y">БІЛЕМІН</div><div class="stamp n">БІЛМЕДІМ</div><div class="in"><div class="f front"><small>СҰРАҚ</small><span></span></div><div class="f back"><small>ЖАУАП</small><span></span></div></div>';
    c.querySelector('.front span').textContent = q.q; c.querySelector('.back span').textContent = q.a; box.appendChild(c);
    let sx = null, dx = 0, moved = false;
    c.onpointerdown = e => { sx = e.clientX; dx = 0; moved = false; c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (sx === null || !cFlipped) return; dx = e.clientX - sx; if (Math.abs(dx) > 6) moved = true;
      c.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; c.querySelector('.stamp.y').style.opacity = Math.max(0, dx / 120); c.querySelector('.stamp.n').style.opacity = Math.max(0, -dx / 120); };
    c.onpointerup = () => { if (sx === null) return; sx = null;
      if (cFlipped && Math.abs(dx) > 110) return mark(dx > 0);
      c.style.transition = 'transform .25s'; c.style.transform = ''; c.querySelectorAll('.stamp').forEach(s => s.style.opacity = 0); setTimeout(() => c.style.transition = '', 260);
      if (!moved) flipCard(); };
    keyFn = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); } else if (cFlipped && e.key === 'ArrowRight') mark(true); else if (cFlipped && e.key === 'ArrowLeft') mark(false); };
  }
  function flipCard() { const c = $('deck').querySelector('.fc:not(.ghost):not(.ghost2)'); if (!c || cBusy) return; cFlipped = !cFlipped; c.classList.toggle('flip', cFlipped); AU.play('flip');
    $('kNo').disabled = $('kYes').disabled = !cFlipped; if (cFlipped) $('cHint').textContent = 'Білдің бе? Оңға → білемін · Солға ← білмедім'; }
  function mark(yes) {
    if (cBusy || !cFlipped) return; cBusy = true; const c = $('deck').querySelector('.fc:not(.ghost):not(.ghost2)'), id = deck.shift(), [x, y] = center(c);
    c.querySelector('.stamp.' + (yes ? 'y' : 'n')).style.opacity = 1;
    c.style.transition = 'transform .45s ease-in, opacity .45s'; c.style.transform = `translateX(${(yes ? 1 : -1) * innerWidth}px) rotate(${yes ? 30 : -30}deg)`; c.style.opacity = 0;
    if (yes) { good(x, y, cRound === 1 ? 100 : 50); if (cRound === 1) G.known++; }
    else { G.streak = 0; comboUI(); AU.play('wrong'); FX.pop(x, y, 'Қайта келеді ↺', true); if (cRound === 1) { G.wrong++; G.mistakes.push({ q: QS[id].q, a: QS[id].a }); } retry.push(id); }
    progress(QS.length - deck.length - retry.length, QS.length); later(renderDeck, 480);
  }
  $('kYes').onclick = () => mark(true); $('kNo').onclick = () => mark(false);

  // ---------------- 6. sort conveyor ----------------
  let sItems = [], sCats = [], sRaf = 0, sCur = null;
  function startSort() { show('sSort'); sCats = [...new Set(QS.map(q => q.a))]; sItems = shuffle(QS.map((q, i) => i));
    const bx = $('baskets'); bx.innerHTML = '';
    sCats.forEach((c, k) => { const b = document.createElement('button'); b.className = 'bk2'; b.dataset.cat = c; b.innerHTML = `<span class="k">${k < 9 ? k + 1 : ''}</span><b></b><small>0</small>`; b.querySelector('b').textContent = c; b.onclick = () => sendTo(b); bx.appendChild(b); });
    keyFn = e => { const k = +e.key; if (k >= 1 && k <= 9 && bx.children[k - 1]) sendTo(bx.children[k - 1]); };
    sortNext(0); }
  function sortNext(i) {
    cancelAnimationFrame(sRaf); $('drop').innerHTML = ''; sCur = null;
    if (G.dead) return later(() => end(false), 600);
    if (i >= sItems.length) return later(() => end(true), 300);
    progress(i, sItems.length); const q = QS[sItems[i]], my = gen, drop = $('drop'), el = document.createElement('div'); el.className = 'item'; el.textContent = q.q; drop.appendChild(el);
    const dur = Math.max(4.5, 9 - i * .3) * 1000, t0 = performance.now(), x = 20 + Math.random() * 60;
    sCur = { i, q, el, t0, dur, done: false };
    const fall = now => { if (!alive(my) || sCur?.el !== el || sCur.done) return; const k = Math.min(1, (now - t0) / dur), H = drop.clientHeight - el.offsetHeight - 8;
      el.style.transform = `translate(-50%, ${k * H}px) translateX(${(x - 50) * drop.clientWidth / 100 * Math.min(1, (1 - k) * 1.2)}px) rotate(${Math.sin(now / 300) * 3}deg)`;
      if (k >= 1) { sCur.done = true; const [cx, cy] = center(el); FX.burst(cx, cy, ['#888', css('--bad')], 24, 6); el.remove(); AU.play('thud'); bad(cx, cy - 20, { q: q.q, a: q.a }); FX.banner('ҮЛГЕРМЕДІҢ!'); flyHint(q.a); later(() => sortNext(i + 1), 1300); return; }
      sRaf = requestAnimationFrame(fall); };
    sRaf = requestAnimationFrame(fall); }
  function flyHint(cat) { const b = [...$('baskets').children].find(x => x.dataset.cat === cat); if (b) { b.classList.remove('good'); void b.offsetWidth; b.classList.add('good'); setTimeout(() => b.classList.remove('good'), 700); } }
  function flyItem(el, b, cb) { const [x1, y1] = center(el), [x2, y2] = center(b), r = el.getBoundingClientRect(), c = el.cloneNode(true);
    c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;margin:0;transform:none;z-index:57`; document.body.appendChild(c); el.remove();
    c.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${x2 - x1}px,${y2 - y1}px) scale(.3)`, opacity: .2 }], { duration: 380, easing: 'ease-in' }).onfinish = () => { c.remove(); cb?.(); }; }
  function sendTo(b) {
    const cur = sCur; if (!cur || cur.done) return; cur.done = true; cancelAnimationFrame(sRaf); const { i, q, el, t0, dur } = cur;
    if (b.dataset.cat === q.a) { const left = Math.max(0, 1 - (performance.now() - t0) / dur), [x, y] = center(b);
      flyItem(el, b, () => { b.classList.remove('good'); void b.offsetWidth; b.classList.add('good'); const s = b.querySelector('small'); s.textContent = +s.textContent + 1; good(x, y - 30, 100, Math.round(left * 80)); setTimeout(() => b.classList.remove('good'), 500); });
      later(() => sortNext(i + 1), 700); }
    else { const [x, y] = center(b); b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); el.classList.add('no'); bad(x, y - 30, { q: q.q, a: q.a });
      const right = [...$('baskets').children].find(x => x.dataset.cat === q.a); later(() => { if (right && el.isConnected) flyItem(el, right); flyHint(q.a); }, 500);
      later(() => { b.classList.remove('bad'); sortNext(i + 1); }, 1400); }
  }

  // ---------------- flow ----------------
  const STARTERS = { quiz: startBoss, lightning: startLight, target: startTarget, match: startMemory, carousel: startCards, sort: startSort };
  function begin() {
    gen++; timers.forEach(clearTimeout); timers = []; keyFn = null; cancelAnimationFrame(tRaf); cancelAnimationFrame(sRaf); clearInterval(mClock);
    const H = heartsFor(QS.length), name = $('pName').value.trim(); store.set('qName', name);
    G = { score: 0, streak: 0, best: 0, right: 0, wrong: 0, hearts: H, maxHearts: H, mistakes: [], dead: false, t0: 0, name, moves: 0, known: 0 };
    $('score').textContent = '0'; comboUI(); renderHearts(); progress(0, 1); $('hudTitle').textContent = quiz.title;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $('hud').classList.add('active');
    const cnt = $('count'), my = gen; cnt.classList.add('on'); AU.music(false);
    ['3', '2', '1', 'GO!'].forEach((t, k) => later(() => { cnt.innerHTML = `<b>${t}</b>`; AU.play(k < 3 ? 'count' : 'go'); }, k * 650));
    later(() => { if (!alive(my)) return; cnt.classList.remove('on'); cnt.innerHTML = ''; G.t0 = performance.now(); AU.music(true); STARTERS[mode](); }, 4 * 650);
  }
  function end(win) {
    gen++; timers.forEach(clearTimeout); timers = []; keyFn = null; cancelAnimationFrame(tRaf); cancelAnimationFrame(sRaf); clearInterval(mClock); AU.music(false);
    const secs = Math.round((performance.now() - G.t0) / 1000), n = QS.length;
    let acc; if (mode === 'match') acc = G.moves ? Math.min(1, n / G.moves) : 1; else if (mode === 'carousel') acc = n ? G.known / n : 0; else acc = (G.right + G.wrong) ? G.right / (G.right + G.wrong) : 0;
    const flawless = win && !G.mistakes.length && !G.wrong && mode !== 'match' && mode !== 'carousel'; if (flawless) G.score += 500;
    const stars = !win ? 0 : acc >= .9 ? 3 : acc >= .65 ? 2 : 1;
    const key = 'gotab_qbest_' + (quiz.id || 'x'), best = +store.get(key) || 0, rec = G.score > best; if (rec) store.set(key, G.score);
    const who = G.name ? `, ${G.name}` : '';
    const lose = { quiz: ['💀', 'Бастық жеңді!'], lightning: ['⛈️', 'Жүректер таусылды!'], target: ['💨', 'Оқ-дәрі бітті!'], sort: ['📦', 'Конвейер тоқтады!'] };
    $('eIco').textContent = win ? (stars === 3 ? '🏆' : stars === 2 ? '🥈' : '🎖️') : (lose[mode] || ['😵'])[0];
    $('eTitle').textContent = win ? (stars === 3 ? `Керемет${who}!` : stars === 2 ? `Жарайсың${who}!` : `Аяқтадың${who}!`) : (lose[mode] || ['', 'Ойын аяқталды'])[1];
    $('eSub').textContent = !win ? 'Тағы бір рет тырысып көр — сен міндетті түрде жеңесің!' : flawless ? 'Бірде-бір қатесіз! +500 бонус 💎' : mode === 'quiz' ? 'Бастық жеңілді! ⚔️' : quiz.title;
    const sp = $('eStars').children; [...sp].forEach(s => s.classList.remove('on')); for (let k = 0; k < stars; k++) setTimeout(() => { sp[k].classList.add('on'); AU.play('coin'); }, 500 + k * 350);
    const el = $('eScore'), t0 = performance.now(); const f = t => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(G.score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f);
    $('eRec').innerHTML = rec && G.score ? '<span class="rec">🏅 ЖАҢА РЕКОРД!</span>' : best ? `<div class="end-sub">Рекорд: ${best}</div>` : '';
    const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const cells = mode === 'match' ? [[G.right, 'жұп'], [G.moves, 'жүріс'], [Math.round(acc * 100) + '%', 'дәлдік'], [mm, 'уақыт']]
      : mode === 'carousel' ? [[G.known + '/' + n, 'бірден білдім'], [Math.round(acc * 100) + '%', 'дәлдік'], [G.best, 'үздік комбо'], [mm, 'уақыт']]
      : [[G.right + '/' + n, 'дұрыс'], [Math.round(acc * 100) + '%', 'дәлдік'], [G.best, 'үздік комбо'], [mm, 'уақыт']];
    $('eStats').innerHTML = cells.map(([v, l]) => `<div><b>${v}</b>${l}</div>`).join('');
    const rv = $('eReview'); rv.open = false; rv.style.display = G.mistakes.length ? '' : 'none';
    rv.querySelector('summary').textContent = `📖 Қателерді қарау (${G.mistakes.length})`;
    const ul = rv.querySelector('ul'); ul.innerHTML = ''; G.mistakes.forEach(m => { const li = document.createElement('li'); li.append(m.q, document.createElement('br'), '→ '); const b = document.createElement('b'); b.textContent = m.a; li.append(b); ul.append(li); });
    show('sEnd'); AU.play(win ? 'win' : 'lose'); if (win) { FX.confetti(); if (stars === 3) setTimeout(() => FX.confetti(120), 900); }
  }
  function quit() { gen++; timers.forEach(clearTimeout); timers = []; keyFn = null; cancelAnimationFrame(tRaf); cancelAnimationFrame(sRaf); clearInterval(mClock); AU.music(false); $('count').classList.remove('on'); intro(); }
  function intro() { const M = MODES[mode];
    $('introIco').textContent = M.icon; $('introBadge').textContent = M.badge; $('introTitle').textContent = quiz.title; $('modeName').textContent = M.name; $('modeRule').textContent = M.rule;
    $('introMeta').textContent = [window.quizScenes?.[quiz.theme], quiz.grade, quiz.subject, QS.length + ' сұрақ', M.hearts ? heartsFor(QS.length) + ' ❤️' : ''].filter(Boolean).join(' · ');
    const best = +store.get('gotab_qbest_' + (quiz.id || 'x')) || 0; $('bestLine').textContent = best ? `🏅 Рекорд: ${best} ұпай` : '';
    $('pName').value = store.get('qName') || ''; show('sIntro'); }

  $('btnStart').onclick = () => { AU.play('go'); begin(); };
  $('pName').onkeydown = e => { if (e.key === 'Enter') $('btnStart').click(); };
  $('bAgain').onclick = begin; $('bQuit').onclick = quit;
  $('bShare').onclick = () => { navigator.clipboard?.writeText(location.href).then(() => FX.banner('Сілтеме көшірілді!'), () => prompt('Сілтемені көшіріңіз:', location.href)); };
  const syncBtns = () => { $('bFx').classList.toggle('off', !AU.fxOn); $('bFx').textContent = AU.fxOn ? '🔊' : '🔇'; $('bMusic').classList.toggle('off', !AU.muOn); };
  $('bFx').onclick = () => { AU.toggleFx(); syncBtns(); }; $('bMusic').onclick = () => { AU.toggleMusic(G && $('hud').classList.contains('active')); syncBtns(); }; syncBtns();
  document.addEventListener('visibilitychange', () => { if (document.hidden) AU.music(false); else if (G && $('hud').classList.contains('active') && !$('count').classList.contains('on')) AU.music(true); });

  function showError(msg) { $('sLoad').innerHTML = '<div style="text-align:center"><div style="font-size:40px;margin-bottom:16px">⚠️</div><div style="font-size:16px;font-weight:700;margin-bottom:8px" id="errMsg"></div><a href="games.html" style="color:var(--acc);font-size:14px;text-decoration:none">← Ойындарға оралу</a></div>'; $('errMsg').textContent = msg; show('sLoad'); }

  // load the quiz
  (async () => {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) return showError('Сілтемеде викторина ID жоқ');
    try {
      const { data, error } = await sb.from('quizzes').select('*').eq('id', id).single();
      if (error || !data) throw new Error('Табылмады');
      quiz = data; QS = (data.questions || []).filter(q => q && String(q.q || '').trim() && String(q.a || '').trim()).map(q => ({ ...q, q: String(q.q).trim(), a: String(q.a).trim() }));
      if (!QS.length) return showError('Бұл викторинада сұрақ жоқ');
      mode = MODES[data.game_type] ? data.game_type : 'quiz';
      document.title = `GoTAB — ${quiz.title}`; document.body.setAttribute('data-theme', quiz.theme);
      if (window.quizSceneMarkup) $('themeLayer').innerHTML = quizSceneMarkup(quiz.theme);
      intro();
      sb.from('quizzes').update({ play_count: (quiz.play_count || 0) + 1 }).eq('id', id).then(() => {}, () => {});
    } catch (e) { showError('Викторина табылмады: ' + e.message); }
  })();
  if (location.hostname === 'localhost') window.__game = { get G() { return G; }, get mode() { return mode; }, end, begin };
})();
