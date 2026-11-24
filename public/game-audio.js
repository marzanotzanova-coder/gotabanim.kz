// GoTAB game audio: a small Web Audio engine shared by the ready-made games.
// Music is generated live (no files): pads, bass, arpeggio and drums on a look-ahead sequencer,
// with a reverb and an echo, through a compressor. Two styles:
//   'space' — bright synthwave (Тамыр аңшысы)
//   'tense' — dark, driving, cinematic (СЕКТОР)
// setIntensity(0..2) adds layers: 0 = pads + bass (menus), 1 = + arpeggio and hats, 2 = full drums.
// Browsers only allow sound after a tap or key press, so call unlock() from the first user gesture.
(function () {
  'use strict';
  const store = { get: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  const STYLES = {
    space: { bpm: 104, swing: 0,
      chords: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]],
      kick: [0, 8, 10], snare: [4, 12], hat: [2, 6, 10, 14], arp: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2], arpOct: 12, arpWave: 'square', bassSteps: [0, 3, 6, 8, 11, 14], padCut: 1400, bell: false },
    tense: { bpm: 96, swing: 0,
      chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 55], [45, 49, 52, 57]],
      kick: [0, 6, 8, 14], snare: [12], hat: [0, 2, 4, 6, 8, 10, 12, 14], arp: [0, -1, 2, -1, 1, -1, 3, -1, 0, -1, 2, -1, 1, 3, -1, 2], arpOct: 12, arpWave: 'sawtooth', bassSteps: [0, 2, 4, 6, 8, 10, 12, 14], padCut: 900, bell: true }
  };

  function create(styleName) {
    const st = STYLES[styleName] || STYLES.space, key = 'gaMusic', fkey = 'gaFx';
    let ctx = null, master, comp, musicBus, fxBus, verb, verbSend, delay, delaySend, noiseBuf = null;
    let musicOn = store.get(key) !== 'off', fxOn = store.get(fkey) !== 'off', playing = false, intensity = 0;
    let timer = null, nextTime = 0, step = 0;

    function build() {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return false;
      ctx = new C();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .2;
      master = ctx.createGain(); master.gain.value = .9; master.connect(comp); comp.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      fxBus = ctx.createGain(); fxBus.gain.value = fxOn ? .8 : 0; fxBus.connect(master);
      // reverb from a decaying noise impulse
      verb = ctx.createConvolver(); const len = ctx.sampleRate * 2.6, imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      verb.buffer = imp; verbSend = ctx.createGain(); verbSend.gain.value = .55; verbSend.connect(verb); verb.connect(master);
      // tempo-synced echo
      delay = ctx.createDelay(1); delay.delayTime.value = 60 / st.bpm * .75; const fb = ctx.createGain(); fb.gain.value = .32; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
      delaySend = ctx.createGain(); delaySend.gain.value = .3; delaySend.connect(delay); delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(musicBus);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      return true;
    }
    function A() { if (!ctx && !build()) return null; if (ctx.state === 'suspended') ctx.resume(); return ctx; }

    // ---- voices ----
    function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
    function osc(type, f, t, dur, out, peak, a = .005, opts = {}) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
      if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + (opts.glide || dur * .9)); if (opts.det) o.detune.value = opts.det;
      let node = o; if (opts.cut) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(opts.cut, t); if (opts.cutTo) fl.frequency.exponentialRampToValueAtTime(opts.cutTo, t + dur); fl.Q.value = opts.q || .7; o.connect(fl); node = fl; }
      node.connect(g); env(g, t, a, peak, dur); g.connect(out); if (opts.verb) { const s = ctx.createGain(); s.gain.value = opts.verb; g.connect(s); s.connect(verbSend); } if (opts.echo) { const s = ctx.createGain(); s.gain.value = opts.echo; g.connect(s); s.connect(delaySend); }
      o.start(t); o.stop(t + a + dur + .05);
    }
    function noise(t, dur, out, peak, type = 'bandpass', f = 1000, q = .8, opts = {}) {
      const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); if (opts.fTo) fl.frequency.exponentialRampToValueAtTime(opts.fTo, t + dur); fl.Q.value = q;
      s.connect(fl); fl.connect(g); env(g, t, opts.a || .002, peak, dur); g.connect(out); if (opts.verb) { const v = ctx.createGain(); v.gain.value = opts.verb; g.connect(v); v.connect(verbSend); }
      s.start(t, Math.random() * .5); s.stop(t + dur + .1);
    }
    const kick = (t, v = 1) => { osc('sine', 150, t, .42, musicBus, .9 * v, .002, { to: 42, glide: .12 }); noise(t, .03, musicBus, .25 * v, 'highpass', 3000); };
    const snare = t => { noise(t, .22, musicBus, .45, 'bandpass', 1900, .6, { verb: .35 }); osc('triangle', 190, t, .12, musicBus, .25, .001, { to: 140 }); };
    const hat = (t, v) => noise(t, .045, musicBus, .14 * v, 'highpass', 8000, .7);

    // ---- sequencer ----
    function schedule(t, s) {
      const bar = Math.floor(s / 16), i = s % 16, ch = st.chords[bar % st.chords.length], sp = 60 / st.bpm / 4;
      if (i === 0) ch.forEach((m, k) => [-9, 9].forEach(det => osc('sawtooth', hz(m), t, sp * 16, musicBus, .045, .9, { det, cut: st.padCut, verb: .6 })));
      if (st.bassSteps.includes(i)) { osc('sawtooth', hz(ch[0] - 24), t, sp * (st.bell ? 1.6 : 1.9), musicBus, .22, .004, { cut: 900, cutTo: 160, q: 4 }); }
      if (intensity >= 1) {
        const a = st.arp[i]; if (a >= 0) osc(st.arpWave, hz(ch[a % ch.length] + st.arpOct), t, sp * .9, musicBus, st.bell ? .05 : .045, .003, { cut: st.bell ? 1800 : 3200, cutTo: 700, echo: .6 });
        if (st.hat.includes(i)) hat(t, i % 4 === 2 ? 1 : .55);
        if (st.bell && i === 0 && bar % 2 === 0) osc('sine', hz(ch[3] + 24), t, 2.4, musicBus, .06, .01, { verb: .8, echo: .5 });
      }
      if (intensity >= 2) { if (st.kick.includes(i)) kick(t); if (st.snare.includes(i)) snare(t); if (!st.bell && i % 2 === 1 && Math.random() < .3) hat(t, .35); }
    }
    function tick() { const sp = 60 / st.bpm / 4; while (nextTime < ctx.currentTime + .12) { schedule(nextTime, step); nextTime += sp; step++; } }
    function startMusic() { if (!A() || timer) return; nextTime = ctx.currentTime + .08; timer = setInterval(tick, 25);
      musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value, ctx.currentTime); musicBus.gain.linearRampToValueAtTime(.62, ctx.currentTime + 1.2); }
    function stopMusic(fade = .6) { if (!ctx || !timer) return; const t = ctx.currentTime; musicBus.gain.cancelScheduledValues(t); musicBus.gain.setValueAtTime(musicBus.gain.value, t); musicBus.gain.linearRampToValueAtTime(0, t + fade);
      clearInterval(timer); timer = null; }

    // ---- effects ----
    const FX = {
      click: t => osc('square', 1400, t, .03, fxBus, .12),
      type: t => noise(t, .018, fxBus, .12, 'highpass', 4500, .8),
      select: t => { osc('square', 880, t, .06, fxBus, .12, .002, { cut: 3000 }); osc('square', 1320, t + .06, .1, fxBus, .12, .002, { cut: 3000, verb: .3 }); },
      confirm: t => { [0, 7, 12].forEach((s, k) => osc('sawtooth', hz(62 + s), t + k * .02, .5, fxBus, .07, .005, { cut: 2600, cutTo: 600, verb: .5 })); },
      lock: t => { osc('sawtooth', 220, t, .35, fxBus, .12, .005, { to: 880, cut: 3000, verb: .3 }); osc('sine', 1760, t + .3, .4, fxBus, .1, .002, { verb: .6 }); },
      laser: t => osc('sawtooth', 1900, t, .2, fxBus, .14, .002, { to: 260, cut: 5000, echo: .3 }),
      hit: (t, k = 1) => { kickFx(t); [0, 4, 7].forEach((s, i) => osc('triangle', hz(76 + Math.min(k, 9) + s), t + .04 + i * .05, .25, fxBus, .14, .003, { verb: .4 })); },
      boom: t => { noise(t, 1.4, fxBus, .9, 'lowpass', 900, .5, { fTo: 80, verb: .5 }); osc('sine', 90, t, 1.1, fxBus, .7, .003, { to: 28 }); [72, 76, 79, 84].forEach((m, i) => osc('triangle', hz(m), t + .3 + i * .08, .4, fxBus, .12, .003, { verb: .5 })); },
      miss: t => { osc('sawtooth', 220, t, .22, fxBus, .2, .003, { to: 110, cut: 1600 }); osc('square', 165, t + .12, .3, fxBus, .14, .003, { to: 82, cut: 1200 }); },
      error: t => { osc('square', 300, t, .12, fxBus, .14, .002, { cut: 1800 }); osc('square', 210, t + .14, .25, fxBus, .14, .002, { cut: 1500 }); noise(t, .3, fxBus, .2, 'lowpass', 500, .7); },
      shield: t => { osc('sine', 300, t, .7, fxBus, .2, .01, { to: 1300, verb: .7 }); osc('triangle', 450, t + .05, .7, fxBus, .12, .01, { to: 1700, verb: .7 }); },
      impact: t => { noise(t, 1.6, fxBus, 1, 'lowpass', 400, .4, { fTo: 40, verb: .4 }); osc('sine', 60, t, 1.2, fxBus, .8, .002, { to: 22 }); },
      move: t => osc('square', 900, t, .03, fxBus, .06, .001, { cut: 2500 }),
      warn: t => { [0, .28].forEach(d => { osc('square', 880, t + d, .12, fxBus, .12, .002, { cut: 2500 }); osc('square', 660, t + d + .14, .12, fxBus, .12, .002, { cut: 2500 }); }); },
      tick: t => osc('square', 1700, t, .025, fxBus, .08, .001),
      sweep: t => { noise(t, 1.3, fxBus, .4, 'bandpass', 300, 2.5, { fTo: 5000, a: .3, verb: .5 }); osc('sine', 110, t, 1.3, fxBus, .15, .2, { to: 220 }); },
      boot: t => { osc('sawtooth', 55, t, 2.4, fxBus, .25, 1.2, { to: 110, cut: 300, cutTo: 2400, verb: .6 }); noise(t + 1.5, 1.2, fxBus, .3, 'bandpass', 600, 1.5, { fTo: 6000, a: .4, verb: .6 }); },
      win: t => { [60, 64, 67, 72, 67, 72, 76].forEach((m, i) => osc('triangle', hz(m + 12), t + i * .11, i === 6 ? 1.1 : .32, fxBus, .16, .004, { verb: .5 })); kickFx(t + .66); },
      lose: t => { [67, 66, 65, 60].forEach((m, i) => osc('sawtooth', hz(m - 12), t + i * .28, .5, fxBus, .12, .01, { cut: 1200, verb: .5 })); },
      star: t => { osc('square', 988, t, .08, fxBus, .14, .002, { cut: 4000 }); osc('square', 1319, t + .07, .3, fxBus, .14, .002, { cut: 4000, verb: .4 }); }
    };
    function kickFx(t) { osc('sine', 160, t, .4, fxBus, .7, .002, { to: 45, glide: .12 }); noise(t, .25, fxBus, .4, 'bandpass', 600, .7); }

    return {
      unlock() { if (!A()) return; if (musicOn && playing) startMusic(); },
      play() { playing = true; if (musicOn && A()) startMusic(); },
      stop(fade) { playing = false; stopMusic(fade); },
      setIntensity(n) { intensity = n; },
      sfx(name, arg) { if (!fxOn || !A()) return; try { FX[name]?.(ctx.currentTime + .005, arg); } catch (_) {} },
      get musicOn() { return musicOn; }, get fxOn() { return fxOn; },
      toggleMusic() { musicOn = !musicOn; store.set(key, musicOn ? 'on' : 'off'); if (musicOn && playing) startMusic(); else stopMusic(.3); return musicOn; },
      toggleFx() { fxOn = !fxOn; store.set(fkey, fxOn ? 'on' : 'off'); if (ctx) fxBus.gain.value = fxOn ? .8 : 0; return fxOn; },
      pause() { stopMusic(.2); }, resume() { if (musicOn && playing) startMusic(); }
    };
  }
  window.GameAudio = { create };
})();
