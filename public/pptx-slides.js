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
  async function inlineImages(root) {
    // an <svg> that holds a picture is flattened into a plain PNG <img> first: Safari cannot draw such SVGs inside the page snapshot
    for (const svg of Array.from(root.querySelectorAll('svg')).filter(s => s.querySelector('image'))) {
      const box = svg.getBoundingClientRect(); if (!box.width || !box.height) continue;
      await Promise.all(Array.from(svg.querySelectorAll('image')).map(async el => { const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href'); if (!href || href.startsWith('data:')) return; const data = await toDataUrl(href).catch(() => null); if (data) { if (el.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', data); el.setAttribute('href', data); } }));
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
      const data = await toDataUrl(href).catch(() => null); if (data) { if (el.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', data); el.setAttribute('href', data); } }),
      ...imgs.map(async el => { const src = el.getAttribute('src'); if (!src || src.startsWith('data:')) return; const data = await toDataUrl(src).catch(() => null); if (data) { el.src = data; await el.decode().catch(() => {}); } })]);
  }
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  // Most presentations are set in Calibri, which Macs and phones do not have: a wider fallback font made lines wrap
  // and the extra line was cut off. Carlito has exactly Calibri's metrics, so it is loaded under the name Calibri,
  // both for the layout and inside each slide snapshot.
  const FONT_BASE = new URL('vendor/carlito-5.3.0/', document.currentScript?.src || location.href).href;
  let fontCss;
  function loadSlideFonts() {
    if (!fontCss) fontCss = (async () => {
      const faces = await fetch(FONT_BASE + 'faces.json').then(r => { if (!r.ok) throw Error('fonts'); return r.json(); });
      const rules = [];
      await Promise.all(faces.map(async f => {
        const data = await toDataUrl(FONT_BASE + f.file);
        for (const family of ['Calibri', 'Calibri Light', 'Carlito']) {
          const face = new FontFace(family, `url(${data}) format('woff2')`, { weight: String(f.weight), style: f.style, unicodeRange: f.range });
          document.fonts.add(face); face.load().catch(() => {});
          rules.push(`@font-face{font-family:'${family}';src:url(${data}) format('woff2');font-weight:${f.weight};font-style:${f.style};unicode-range:${f.range}}`);
        }
      }));
      return rules.join('\n');
    })().catch(error => { fontCss = null; throw error; });
    return fontCss;
  }
  // Safari leaves pictures out of a slide snapshot the first time it draws them; drawing the slide twice brings them in
  const isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent);
  async function convert(file, onProgress = () => {}, signal) {
    if (!/\.pptx$/i.test(file.name || '')) throw Error('Автоматты алдын ала қарау үшін PPTX таңдаңыз. Ескі PPT файлын PowerPoint-та PPTX түрінде сақтаңыз.');
    if (!file.size || file.size > 30 * 1024 * 1024) throw Error('PPTX файлы 30 МБ-тан аспауы керек.');
    const check = () => { if (signal?.aborted) throw new DOMException('Болдырылмады', 'AbortError'); };
    check(); onProgress('Презентация оқылуда…');
    const [{ parseZip, buildPresentation, renderSlide, RECOMMENDED_ZIP_LIMITS }, image] = await loadDependencies();
    check();
    const embedCss = await loadSlideFonts().catch(() => '');
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
          const options = { width, height, pixelRatio: scale, fontEmbedCSS: embedCss, skipAutoScale: false, filter: node => !['AUDIO', 'VIDEO'].includes(node.tagName) };
          let stuck; const canvas = await Promise.race([(async () => { if (isSafari) { const first = await image.toCanvas(handle.element, options); first.width = first.height = 0; } return image.toCanvas(handle.element, options); })(), new Promise((_, no) => { stuck = setTimeout(() => no(Error(`${i + 1}-слайдты суретке айналдыру мүмкін болмады. Бұл презентация үшін PDF немесе слайд суреттерін қолдануға болады.`)), 25000); })]).finally(() => clearTimeout(stuck));
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          canvas.width = canvas.height = 0;
          if (!blob) throw Error('Слайд суретін дайындау мүмкін болмады.');
          check(); blobs.push(blob);
        } finally { handle.dispose(); handle.element.remove(); }
      }
      return blobs;
    } finally {
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
