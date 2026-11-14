// Admin only: makes a short, silent, small preview of each animation right in the browser
// (plays the private video, records its first seconds from a canvas) and puts it in the public
// "animation-previews" bucket, so teachers without a subscription see it playing on the animations page.
// It runs by itself: right after an upload, and quietly whenever the admin panel is open and some
// animation still has no preview. No button to press.
window.GoTABPreview = (() => {
  const SECONDS = 8, MAX_SIDE = 640;
  const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const once = (el, ev) => new Promise((ok, no) => { el.addEventListener(ev, ok, { once: true }); el.addEventListener('error', () => no(Error('Видео ашылмады')), { once: true }); });
  // browsers slow pages down in a hidden tab, which spoils the recording, so record only while visible
  const visible = () => document.hidden ? new Promise(ok => { const f = () => { if (!document.hidden) { document.removeEventListener('visibilitychange', f); ok(); } }; document.addEventListener('visibilitychange', f); }) : Promise.resolve();

  async function record(item, mime) {
    const { data, error } = await sb.storage.from('animation-library').createSignedUrl(item.storage_path, 600);
    if (error || !data?.signedUrl) throw Error('Видеоны ашу мүмкін болмады');
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = data.signedUrl;
    await once(v, 'loadeddata');
    const k = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(v.videoWidth * k / 2) * 2; cv.height = Math.round(v.videoHeight * k / 2) * 2;
    const g = cv.getContext('2d');
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 900000 });
    const parts = []; rec.ondataavailable = e => e.data.size && parts.push(e.data);
    const stopped = new Promise(ok => { rec.onstop = ok; });
    const length = Math.min(SECONDS, (v.duration || SECONDS) - .1);
    let frames = 0, hidden = false;
    const onHide = () => { if (document.hidden) hidden = true; };
    document.addEventListener('visibilitychange', onHide);
    // a timer, not animation frames: those stop whenever the window is covered or minimised
    const draw = () => { g.drawImage(v, 0, 0, cv.width, cv.height); frames++; };
    g.drawImage(v, 0, 0, cv.width, cv.height);
    rec.start(500); await v.play(); const tick = setInterval(draw, 33);
    await new Promise(ok => { const t = () => (hidden || v.currentTime >= length || v.ended) ? ok() : setTimeout(t, 100); t(); });
    clearInterval(tick); v.pause(); rec.stop(); await stopped;
    document.removeEventListener('visibilitychange', onHide);
    v.removeAttribute('src'); v.load();
    // a hidden tab or a stalled video gives a jerky, short clip: try again
    if (hidden || frames < length * 12) return null;
    return new Blob(parts, { type: mime.split(';')[0] });
  }

  async function make(item) {
    const mime = window.MediaRecorder && TYPES.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) throw Error('Бұл браузер превью жаза алмайды. Chrome немесе Safari-ді қолданыңыз.');
    let blob = null;
    for (let tries = 0; !blob && tries < 4; tries++) { await visible(); blob = await record(item, mime); }
    if (!blob || blob.size < 1000) throw Error('Превью жазылмады');
    const base = blob.type, path = item.id + '.' + (base === 'video/mp4' ? 'mp4' : 'webm');
    const up = await sb.storage.from('animation-previews').upload(path, blob, { contentType: base, upsert: true });
    if (up.error) throw Error('Превью сақталмады: ' + up.error.message);
    const url = sb.storage.from('animation-previews').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const res = await sb.rpc('set_animation_preview', { p_id: item.id, p_url: url });
    if (res.error) throw Error('Превью тіркелмеді: ' + res.error.message);
    return url;
  }

  let busy = null;
  // makes previews for every animation that has none yet; one run at a time
  function makeMissing(status) {
    if (busy) return busy;
    const say = t => { if (status) status.textContent = t; };
    busy = (async () => {
      const { data, error } = await sb.from('animation_library').select('id,name,storage_path,preview_url').order('created_at', { ascending: false });
      if (error) return say('Превью: тізім ашылмады');
      const todo = data.filter(r => !r.preview_url);
      let done = 0;
      for (const r of todo) {
        say(`Превью жасалуда ${done + 1}/${todo.length}: ${r.name}`);
        try { await make(r); done++; } catch (e) { say(r.name + ': ' + e.message); }
      }
      if (todo.length) say(`Превью дайын: ${done}/${todo.length}`);
    })().finally(() => { busy = null; });
    return busy;
  }

  // the admin panel quietly makes the missing previews in the background
  if (/admin\.html$/.test(location.pathname)) {
    const start = async () => {
      const { data } = await sb.auth.getSession();
      if (data?.session?.user?.email === ADMIN_EMAIL) makeMissing(document.getElementById('previewStatus'));
    };
    document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : setTimeout(start, 1500);
  }
  return { make, makeMissing };
})();
