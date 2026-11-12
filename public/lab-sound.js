// Lab sounds (built with Web Audio, no files): short effects for building steps and a quiet background tune.
// Two round buttons in the 3D view switch the tune and the effects on/off; the choice is remembered.
(function () {
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  let musicOn = store.get('labMusic') !== 'off', fxOn = store.get('labFx') !== 'off';
  let ctx = null, fxBus = null, musicBus = null, musicTimer = null, step = 0;

  function audio() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC(); fxBus = ctx.createGain(); fxBus.gain.value = .5; fxBus.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; musicBus.connect(lp); lp.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // one soft note: frequency, start offset (s), length (s), volume, wave, output, optional glide target
  function note(f, at, dur, vol, type = 'sine', out = fxBus, to = 0) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur * .8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur / 4)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
  }
  const fx = play => () => { if (!fxOn || !audio()) return; play(); };
  window.labSound = {
    tap: fx(() => { note(880, 0, .12, .25, 'sine', fxBus, 660); }),                                           // a point is placed
    fold: fx(() => { note(330, 0, .32, .18, 'triangle', fxBus, 620); note(990, .05, .2, .05); }),           // a face folds up
    unfold: fx(() => { note(620, 0, .3, .15, 'triangle', fxBus, 330); }),                                    // a face lies back down
    ok: fx(() => { [523, 659, 784].forEach((f, i) => note(f, i * .09, .35, .2)); }),                         // a step is right
    no: fx(() => { note(240, 0, .16, .18, 'triangle'); note(190, .13, .22, .16, 'triangle'); }),             // wrong place
    done: fx(() => { [523, 659, 784, 1047].forEach((f, i) => note(f, i * .11, .6, .2)); [1568, 2093].forEach((f, i) => note(f, .5 + i * .08, .5, .06)); }) // shape finished
  };

  // background tune: slow chords with a few bell notes on top, kept very quiet
  const CHORDS = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392]];
  const BELLS = [523.3, 587.3, 659.3, 784, 880];
  function bar() {
    const c = CHORDS[step++ % CHORDS.length];
    c.forEach((f, i) => { note(f / 2, i * .04, 4.6, .05, 'sine', musicBus); note(f, .1 + i * .04, 4.2, .025, 'triangle', musicBus); });
    for (let k = 0; k < 3; k++) if (Math.random() < .6) note(BELLS[Math.floor(Math.random() * BELLS.length)], .6 + k * 1.3 + Math.random() * .3, 1.6, .03, 'sine', musicBus);
  }
  function startMusic() { if (!musicOn || musicTimer || !audio()) return; musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.linearRampToValueAtTime(1, ctx.currentTime + 2); bar(); musicTimer = setInterval(bar, 4000); }
  function stopMusic() { if (!musicTimer) return; clearInterval(musicTimer); musicTimer = null; musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + .8); }
  // browsers allow sound only after the first tap or click on the page
  const kick = () => { audio(); if (musicOn) startMusic(); };
  addEventListener('pointerdown', kick, { once: true, capture: true }); addEventListener('keydown', kick, { once: true, capture: true });
  document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });

  const ICON = {
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    fx: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    off: '<line x1="3" y1="3" x2="21" y2="21"/>' };
  function mount() {
    const view = document.getElementById('view'); if (!view || document.getElementById('labSoundBar')) return;
    document.head.insertAdjacentHTML('beforeend', `<style>#labSoundBar{position:absolute;top:14px;right:14px;z-index:5;display:flex;gap:8px}
#labSoundBar button{width:48px;height:48px;border-radius:50%;border:1.5px solid var(--border,#dbe3ef);background:#fffffff0;color:var(--primary,#1a56db);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 14px rgba(26,86,219,.12)}
#labSoundBar button.off{color:#94a3b8}#labSoundBar svg{width:22px;height:22px}</style>`);
    view.insertAdjacentHTML('beforeend', '<div id="labSoundBar"><button type="button" id="labMusicBtn"></button><button type="button" id="labFxBtn"></button></div>');
    const paint = () => [['labMusicBtn', musicOn, 'music', 'Әуен'], ['labFxBtn', fxOn, 'fx', 'Дыбыстар']].forEach(([id, on, k, name]) => { const b = document.getElementById(id);
      b.classList.toggle('off', !on); b.title = name + (on ? ': қосулы' : ': өшірулі'); b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', on);
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}${on ? '' : ICON.off}</svg>`; });
    const bar = document.getElementById('labSoundBar');
    // taps on the buttons must not reach the 3D view underneath
    ['pointerdown', 'pointerup'].forEach(t => bar.addEventListener(t, e => e.stopPropagation()));
    document.getElementById('labMusicBtn').onclick = () => { musicOn = !musicOn; store.set('labMusic', musicOn ? 'on' : 'off'); musicOn ? startMusic() : stopMusic(); paint(); };
    document.getElementById('labFxBtn').onclick = () => { fxOn = !fxOn; store.set('labFx', fxOn ? 'on' : 'off'); paint(); if (fxOn) window.labSound.tap(); };
    paint();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', mount) : mount();
})();
