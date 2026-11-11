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
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function convert(file, onProgress = () => {}, signal) {
    if (!/\.pptx$/i.test(file.name || '')) throw Error('Автоматты алдын ала қарау үшін PPTX таңдаңыз. Ескі PPT файлын PowerPoint-та PPTX түрінде сақтаңыз.');
    if (!file.size || file.size > 30 * 1024 * 1024) throw Error('PPTX файлы 30 МБ-тан аспауы керек.');
    const check = () => { if (signal?.aborted) throw new DOMException('Болдырылмады', 'AbortError'); };
    check(); onProgress('Презентация оқылуда…');
    const [{ parseZip, buildPresentation, renderSlide, RECOMMENDED_ZIP_LIMITS }, image] = await loadDependencies();
    check();
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
          await frame();
          const width = handle.element.offsetWidth;
          const height = handle.element.offsetHeight;
          if (!width || !height) throw Error('Слайд өлшемі анықталмады.');
          const scale = Math.min(1600 / width, 1200 / height, 2);
          const canvas = await image.toCanvas(handle.element, {
            width, height, pixelRatio: scale,
            fontEmbedCSS: '', skipAutoScale: false,
            filter: node => !['AUDIO', 'VIDEO'].includes(node.tagName)
          });
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
