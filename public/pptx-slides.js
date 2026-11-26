// Local-only PPTX → JPEG previews. Loaded by the administrator, never by the catalog.
(function () {
  let dependencies;
  function loadDependencies() {
    if (!dependencies) dependencies = Promise.all([
      import('./vendor/pptx-renderer-1.4.0/renderer.js'),
      new Promise((resolve, reject) => {
        if (window.htmlToImage) return resolve(window.htmlToImage);
        const script = document.createElement('script');
        script.src = 'vendor/html-to-image-1.11.13/html-to-image.js';
        script.onload = () => resolve(window.htmlToImage);
        script.onerror = () => { script.remove(); reject(Error('Слайд құралын жүктеу мүмкін болмады. Қайталап көріңіз.')); };
        document.head.appendChild(script);
      })
    ]).catch(error => { dependencies = null; throw error; });
    return dependencies;
  }
  // Safari never finishes drawing a slide whose SVG <image> points at a blob: URL, so every picture is turned into a data: URL first
  const toDataUrl = url => fetch(url).then(r => r.blob()).then(b => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = no; fr.readAsDataURL(b); }));
  // a picture is stored at the size it is shown (×2), not at camera resolution: Safari cannot draw a slide whose snapshot carries multi-MB pictures
  async function shrunkDataUrl(src, boxW, boxH) {
    const blob = await fetch(src).then(r => r.blob());
    const pic = new Image(); const url = URL.createObjectURL(blob); pic.src = url;
    try { await pic.decode(); } catch (_) { URL.revokeObjectURL(url); return toDataUrl(src); }
    const k = Math.min(1, Math.max(boxW, 1) * 2 / pic.naturalWidth, Math.max(boxH, 1) * 2 / pic.naturalHeight, 1600 / Math.max(pic.naturalWidth, pic.naturalHeight));
    if (k >= 0.95 && blob.size < 600 * 1024) { URL.revokeObjectURL(url); return toDataUrl(src); }
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(pic.naturalWidth * k)); cv.height = Math.max(1, Math.round(pic.naturalHeight * k));
    cv.getContext('2d').drawImage(pic, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    const opaque = /jpe?g/i.test(blob.type);
    const data = cv.toDataURL(opaque ? 'image/jpeg' : 'image/png', 0.9); cv.width = cv.height = 0;
    return data;
  }
  async function inlineImages(root) {
    // an <svg> that holds a picture is flattened into a plain PNG <img> first: Safari cannot draw such SVGs inside the page snapshot
    for (const svg of Array.from(root.querySelectorAll('svg')).filter(s => s.querySelector('image'))) {
      const box = svg.getBoundingClientRect(); if (!box.width || !box.height) continue;
      await Promise.all(Array.from(svg.querySelectorAll('image')).map(async el => { const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'); if (!href) return; const ib = el.getBoundingClientRect(); const data = await shrunkDataUrl(href, ib.width || box.width, ib.height || box.height).catch(() => null); if (data) { if (el.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', data); el.setAttribute('href', data); } }));
      const clone = svg.cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      // clip paths used inside this svg may be defined in another svg on the slide: copy them in
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      clone.querySelectorAll('[clip-path],[mask],[fill^="url("]').forEach(el => ['clip-path', 'mask', 'fill'].forEach(at => { const m = /url\(#([^)]+)\)/.exec(el.getAttribute(at) || ''); if (!m || clone.querySelector('#' + CSS.escape(m[1]))) return; const src = root.querySelector('#' + CSS.escape(m[1])) || document.getElementById(m[1]); if (src) defs.appendChild(src.cloneNode(true)); }));
      if (defs.childNodes.length) clone.insertBefore(defs, clone.firstChild); clone.setAttribute('width', box.width); clone.setAttribute('height', box.height);
      const pic = new Image(); pic.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
      try { await pic.decode(); } catch (_) { continue; }
      const k = 2, cv = document.createElement('canvas'); cv.width = Math.ceil(box.width * k); cv.height = Math.ceil(box.height * k); cv.getContext('2d').drawImage(pic, 0, 0, cv.width, cv.height);
      const img = document.createElement('img'); img.src = cv.toDataURL('image/png'); img.style.cssText = svg.getAttribute('style') || ''; img.className = svg.getAttribute('class') || '';
      img.style.width = box.width + 'px'; img.style.height = box.height + 'px'; img.style.display = 'block'; await img.decode().catch(() => {}); svg.replaceWith(img);
    }
    const svgImgs = Array.from(root.querySelectorAll('image')), imgs = Array.from(root.querySelectorAll('img'));
    await Promise.all([...svgImgs.map(async el => { const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'); if (!href || href.startsWith('data:')) return;
      const box = el.getBoundingClientRect(); const data = await shrunkDataUrl(href, box.width, box.height).catch(() => null); if (data) { if (el.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', data); el.setAttribute('href', data); } }),
      ...imgs.map(async el => { const src = el.getAttribute('src'); if (!src) return; const box = el.getBoundingClientRect(); const data = await shrunkDataUrl(src, box.width, box.height).catch(() => null); if (data && data !== src) { el.src = data; await el.decode().catch(() => {}); } })]);
  }
  // a background tab gets no animation frames: waiting for one froze the conversion when the admin switched tabs
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const safeFrame = cb => { let done = false; const run = t => { if (!done) { done = true; cb(t); } }; const id = nativeFrame(run); setTimeout(() => run(performance.now()), 100); return id; };
  const frame = () => new Promise(resolve => safeFrame(resolve));
  // Most presentations are set in Calibri, which Macs and phones do not have: a wider fallback font made lines wrap
  // and the extra line was cut off. Carlito has exactly Calibri's metrics, so it is loaded under the name Calibri,
  // both for the layout and inside each slide snapshot.
  const FONT_BASE = new URL('vendor/carlito-5.3.0/', document.currentScript?.src || location.href).href;
  let fontFaces;
  function loadSlideFonts() {
    if (!fontFaces) fontFaces = (async () => {
      const faces = await fetch(FONT_BASE + 'faces.json').then(r => { if (!r.ok) throw Error('fonts'); return r.json(); });
      return Promise.all(faces.map(async f => {
        const data = await toDataUrl(FONT_BASE + f.file);
        for (const family of SLIDE_FAMILIES) {
          const face = new FontFace(family, `url(${data}) format('woff2')`, { weight: String(f.weight), style: f.style, unicodeRange: f.range });
          document.fonts.add(face); face.load().catch(() => {});
        }
        const ranges = f.range.split(',').map(r => r.trim().replace(/^U\+/i, '').split('-').map(h => parseInt(h, 16))).map(([a, b]) => [a, b ?? a]);
        return { ...f, data, ranges };
      }));
    })().catch(error => { fontFaces = null; throw error; });
    return fontFaces;
  }
  const SLIDE_FAMILIES = ['Calibri', 'Calibri Light', 'Carlito'];
  // Only the font pieces a slide really uses go into its snapshot: all of them made every snapshot several MB,
  // and Safari then drew the slide as a blank white page.
  function slideFontCss(root, faces) {
    if (!faces?.length) return '';
    const used = new Map(), chars = new Set();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      const text = node.nodeValue; if (!text.trim() || !node.parentElement) continue;
      const style = getComputedStyle(node.parentElement);
      const family = SLIDE_FAMILIES.find(name => style.fontFamily.split(',').some(f => f.trim().replace(/['"]/g, '').toLowerCase() === name.toLowerCase()));
      if (!family) continue;
      const key = `${family}|${Number(style.fontWeight) >= 600 ? 700 : 400}|${/italic|oblique/.test(style.fontStyle) ? 'italic' : 'normal'}`;
      if (!used.has(key)) used.set(key, new Set());
      for (const ch of text) { const code = ch.codePointAt(0); used.get(key).add(code); chars.add(code); }
    }
    const rules = [];
    for (const [key, codes] of used) {
      const [family, weight, style] = key.split('|');
      for (const f of faces) {
        if (String(f.weight) !== weight || f.style !== style) continue;
        if (![...codes].some(c => f.ranges.some(([a, b]) => c >= a && c <= b))) continue;
        rules.push(`@font-face{font-family:'${family}';src:url(${f.data}) format('woff2');font-weight:${f.weight};font-style:${f.style};unicode-range:${f.range}}`);
      }
    }
    return rules.join('\n');
  }
  // a snapshot that came out as one flat colour although the slide has text or pictures failed to draw
  function looksBlank(canvas, root) {
    if (!(root.textContent.trim() || root.querySelector('img,image,svg,canvas'))) return false;
    const small = document.createElement('canvas'); small.width = 32; small.height = 18;
    const ctx = small.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0, 32, 18);
    const px = ctx.getImageData(0, 0, 32, 18).data; let min = 255, max = 0;
    for (let k = 0; k < px.length; k += 4) for (let c = 0; c < 3; c++) { min = Math.min(min, px[k + c]); max = Math.max(max, px[k + c]); }
    small.width = small.height = 0;
    return max - min < 6;
  }
  const isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  // Safari leaves pictures and fonts out of a snapshot the first times it draws it, so it is drawn again until it is complete
  async function drawSlide(image, element, options) {
    const small = { ...options, pixelRatio: Math.min(options.pixelRatio, 1.2) }, plain = { ...small, fontEmbedCSS: '' };
    const attempts = isSafari ? [options, options, options, small, small, plain, plain] : [options, options, small, plain];
    let last;
    for (let k = 0; k < attempts.length; k++) {
      if (last) last.width = last.height = 0;
      last = await image.toCanvas(element, attempts[k]);
      // Safari's first draw is only a warm-up
      if (isSafari && k === 0) { await pause(120); continue; }
      if (!looksBlank(last, element)) return last;
      await pause(250);
    }
    if (last) last.width = last.height = 0;
    return null;
  }
  async function convert(file, onProgress = () => {}, signal) {
    if (!/\.pptx$/i.test(file.name || '')) throw Error('Автоматты алдын ала қарау үшін PPTX таңдаңыз. Ескі PPT файлын PowerPoint-та PPTX түрінде сақтаңыз.');
    if (!file.size || file.size > 30 * 1024 * 1024) throw Error('PPTX файлы 30 МБ-тан аспауы керек.');
    const check = () => { if (signal?.aborted) throw new DOMException('Болдырылмады', 'AbortError'); };
    check(); onProgress('Презентация оқылуда…');
    const [{ parseZip, buildPresentation, renderSlide, RECOMMENDED_ZIP_LIMITS }, image] = await loadDependencies();
    check();
    const faces = await loadSlideFonts().catch(() => null);
    const files = await parseZip(await file.arrayBuffer(), RECOMMENDED_ZIP_LIMITS);
    check();
    const presentation = buildPresentation(files);
    const total = presentation.slides.length;
    if (!total || total > 200) throw Error('Презентацияда 1–200 слайд болуы керек.');
    const host = document.createElement('div');
    // Keep the native layout size while rendering one page at a time.
    host.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;background:white;z-index:-1;';
    document.body.appendChild(host);
    const blobs = [];
    const mediaUrlCache = new Map();
    // the snapshot library also waits for animation frames
    const pageFrame = window.requestAnimationFrame; window.requestAnimationFrame = safeFrame;
    try {
      for (let i = 0; i < total; i++) {
        check(); onProgress(`Слайд ${i + 1}/${total} дайындалуда…`);
        let nodeError = false;
        const handle = renderSlide(presentation, presentation.slides[i], {
          externalMedia: 'block', mediaUrlCache,
          onNodeError: () => { nodeError = true; }
        });
        host.appendChild(handle.element);
        try {
          await handle.ready; 
          await document.fonts.ready;
          await Promise.all(Array.from(handle.element.querySelectorAll('img')).map(img => img.decode().catch(() => { nodeError = true; })));
          check();
          if (nodeError) throw Error(`${i + 1}-слайдтағы элементті оқу мүмкін болмады. Бұл презентация үшін PDF немесе слайд суреттерін қолдануға болады.`);
          await inlineImages(handle.element);
          await frame();
          const width = handle.element.offsetWidth;
          const height = handle.element.offsetHeight;
          if (!width || !height) throw Error('Слайд өлшемі анықталмады.');
          const scale = Math.min(1600 / width, 1200 / height, 2);
          // a slide that never finishes drawing must not freeze the whole upload
          const options = { width, height, pixelRatio: scale, fontEmbedCSS: slideFontCss(handle.element, faces), skipAutoScale: false, filter: node => !['AUDIO', 'VIDEO'].includes(node.tagName) };
          const failed = `${i + 1}-слайдты суретке айналдыру мүмкін болмады. Chrome браузерінде қайталап көріңіз немесе PDF жүктеңіз.`;
          let stuck; const canvas = await Promise.race([drawSlide(image, handle.element, options), new Promise((_, no) => { stuck = setTimeout(() => no(Error(failed)), 45000); })]).finally(() => clearTimeout(stuck));
          // a white page is never uploaded
          if (!canvas) throw Error(failed);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          canvas.width = canvas.height = 0;
          if (!blob) throw Error('Слайд суретін дайындау мүмкін болмады.');
          check(); blobs.push(blob);
        } finally { handle.dispose(); handle.element.remove(); }
      }
      return blobs;
    } finally {
      window.requestAnimationFrame = pageFrame;
      host.remove();
      for (const url of mediaUrlCache.values()) if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }
  async function upload(sb, lesson, blobs, onProgress = () => {}) {
    const paths = [], urls = [], batch = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    try {
      for (let i = 0; i < blobs.length; i++) {
        onProgress(`Слайдтар жүктелуде… ${i + 1}/${blobs.length}`);
        const path = `grade${lesson.grade}/${lesson.subject}/lesson${lesson.lesson_num}/slides/${batch}_${String(i + 1).padStart(3, '0')}.jpg`;
        const { error } = await sb.storage.from('lesson-videos').upload(path, blobs[i], { contentType: 'image/jpeg', upsert: false });
        if (error) throw Error(error.message);
        paths.push(path);
        urls.push(sb.storage.from('lesson-videos').getPublicUrl(path).data.publicUrl);
      }
      return { urls, discard: () => sb.storage.from('lesson-videos').remove(paths) };
    } catch (error) {
      if (paths.length) await sb.storage.from('lesson-videos').remove(paths);
      throw error;
    }
  }
  window.GoTABPptx = { convert, upload, imageTools: async () => (await loadDependencies())[1] };
})();
