// Admin only: makes a short, silent, small preview of each animation right in the browser
// (plays the private video, records its first seconds from a canvas) and puts it in the public
// "animation-previews" bucket, so teachers without a subscription can watch it on the animations page.
window.GoTABPreview = (() => {
  const SECONDS = 8, MAX_SIDE = 640;
  const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const once = (el, ev) => new Promise((ok, no) => { el.addEventListener(ev, ok, { once: true }); el.addEventListener('error', () => no(Error('Видео ашылмады')), { once: true }); });

  async function make(item) {
    const mime = window.MediaRecorder && TYPES.find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) throw Error('Бұл браузер превью жаза алмайды. Chrome немесе Safari-ді қолданыңыз.');
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
    let running = true;
    const draw = () => { if (!running) return; g.drawImage(v, 0, 0, cv.width, cv.height); requestAnimationFrame(draw); };
    g.drawImage(v, 0, 0, cv.width, cv.height);
    rec.start(500); await v.play(); draw();
    await new Promise(ok => { const t = () => (v.currentTime >= length || v.ended) ? ok() : setTimeout(t, 100); t(); });
    running = false; v.pause(); rec.stop(); await stopped;
    v.removeAttribute('src'); v.load();
    const base = mime.split(';')[0], ext = base === 'video/mp4' ? 'mp4' : 'webm';
    const blob = new Blob(parts, { type: base }), path = item.id + '.' + ext;
    if (blob.size < 1000) throw Error('Превью бос шықты');
    const up = await sb.storage.from('animation-previews').upload(path, blob, { contentType: base, upsert: true });
    if (up.error) throw Error('Превью сақталмады: ' + up.error.message);
    const url = sb.storage.from('animation-previews').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
    const res = await sb.rpc('set_animation_preview', { p_id: item.id, p_url: url });
    if (res.error) throw Error('Превью тіркелмеді: ' + res.error.message);
    return url;
  }

  // makes previews for every animation that has none yet (or for all of them when redo is true)
  async function makeMissing(status, redo = false) {
    const { data, error } = await sb.from('animation_library').select('id,name,storage_path,preview_url').order('created_at', { ascending: false });
    if (error) { status.textContent = 'Тізім ашылмады: ' + error.message; return; }
    const todo = data.filter(r => redo || !r.preview_url);
    if (!todo.length) { status.textContent = 'Барлық анимацияның превьюі дайын.'; return; }
    let done = 0;
    for (const r of todo) {
      status.textContent = `Превью жасалуда ${done + 1}/${todo.length}: ${r.name}. Бұл бетті ашық ұстаңыз…`;
      try { await make(r); done++; } catch (e) { status.textContent = r.name + ': ' + e.message; return; }
    }
    status.textContent = `${done} превью дайын. Жазылымы жоқ мұғалімдер енді оларды көреді.`;
  }
  return { make, makeMissing };
})();
