// Coordinates the add form and conversion of already uploaded presentations.
let pptxPreparation = Promise.resolve();
let slidePreparationVersion = 0;
let pptxController;
let pptxPreparationError = '';
const pptxPreviewUrls = [];
function clearPptxPreviewUrls() {
  pptxPreviewUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
}
function cancelPptxPreparation() {
  slidePreparationVersion++;
  pptxController?.abort();
  pptxPreparationError = '';
}
function showPptxBlobs(blobs) {
  clearPptxPreviewUrls();
  const grid = document.getElementById('fSlidesGrid');
  grid.replaceChildren();
  blobs.forEach((blob, i) => {
    const item = document.createElement('div'); item.className = 'slide-thumb-item';
    const img = document.createElement('img'); img.src = URL.createObjectURL(blob); img.loading = 'lazy'; img.alt = `${i + 1}-слайд`;
    pptxPreviewUrls.push(img.src);
    const label = document.createElement('span'); label.className = 'slide-idx'; label.textContent = i + 1;
    item.append(img, label); grid.appendChild(item);
  });
  document.getElementById('fSlidesCount').textContent = `${blobs.length} слайд дайын. Тексеріп, «Сақтау» батырмасын басыңыз.`;
  document.getElementById('fSlidesPreview').style.display = 'block';
}
function preparePptxSlides(file) {
  cancelPptxPreparation();
  const version = slidePreparationVersion;
  pendingSlideBlobs = [];
  clearPptxPreviewUrls();
  document.getElementById('fSlidesPreview').style.display = 'none';
  document.getElementById('fPptThumb').value = '';
  document.getElementById('fPdfSlides').value = '';
  const status = document.getElementById('fPdfStatus');
  status.style.display = file ? 'block' : 'none'; status.style.color = '#0284c7';
  if (!file) { pptxPreparation = Promise.resolve(); return; }
  pptxController = new AbortController();
  const progress = message => { if (version === slidePreparationVersion) status.textContent = message; };
  pptxPreparation = GoTABPptx.convert(file, progress, pptxController.signal).then(blobs => {
    if (version !== slidePreparationVersion) return;
    pendingSlideBlobs = blobs;
    showPptxBlobs(blobs);
    status.style.color = '#16a34a'; status.textContent = `${blobs.length} слайд дайын. Бөлек PDF жүктеу қажет емес.`;
  }).catch(error => {
    if (version !== slidePreparationVersion || error.name === 'AbortError') return;
    pptxPreparationError = error.message;
    status.style.color = '#dc2626'; status.textContent = error.message;
  });
}
async function generateLessonSlides(lessonId) {
  const lesson = allLessons.find(l => l.id === lessonId);
  const button = document.querySelector(`[data-generate-slides="${lessonId}"]`);
  if (!lesson?.ppt_url || button?.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  let uploaded;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    button.textContent = 'Презентация жүктелуде…';
    const response = await fetch(lesson.ppt_url, { signal: controller.signal });
    if (!response.ok) throw Error('PPTX файлын жүктеу мүмкін болмады.');
    const file = new File([await response.blob()], 'presentation.' + (/\.ppt(?:\?|$)/i.test(lesson.ppt_url) ? 'ppt' : 'pptx'));
    clearTimeout(timer);
    const blobs = await GoTABPptx.convert(file, text => { button.textContent = text; });
    uploaded = await GoTABPptx.upload(sb, lesson, blobs, text => { button.textContent = text; });
    const { error } = await sb.from('materials').update({ slides_urls: uploaded.urls, ppt_thumb_url: uploaded.urls[0] }).eq('id', lesson.id);
    if (error) throw Error(error.message);
    uploaded = null;
    await loadLessons();
  } catch (error) {
    if (uploaded) await uploaded.discard();
    alert(error.name === 'AbortError' ? 'Презентацияны жүктеу уақыты аяқталды. Қайталап көріңіз.' : error.message);
  } finally { clearTimeout(timer); button.disabled = false; button.textContent = original; }
}

let qmjPreparation = Promise.resolve(), pendingQmjThumbnail = null, qmjVersion = 0, qmjPreviewUrl, qmjPreparationError = '';
function cancelQmjThumbnail() {
  qmjVersion++; pendingQmjThumbnail = null; qmjPreparationError = '';
  if (qmjPreviewUrl) URL.revokeObjectURL(qmjPreviewUrl);
  qmjPreviewUrl = null;
  document.getElementById('qmjAutoImage').style.display = 'none';
  document.getElementById('qmjAutoStatus').textContent = '';
}
function prepareQmjThumbnail(file) {
  cancelQmjThumbnail();
  document.getElementById('fQmjThumb').value = '';
  const version = qmjVersion, status = document.getElementById('qmjAutoStatus');
  if (!file) { qmjPreparation = Promise.resolve(); return; }
  status.textContent = 'ҚМЖ-ның бірінші беті дайындалуда…';
  qmjPreparation = GoTABQmjThumbnail.convert(file).then(blob => {
    if (version !== qmjVersion) return;
    pendingQmjThumbnail = blob;
    qmjPreviewUrl = URL.createObjectURL(blob);
    const img = document.getElementById('qmjAutoImage'); img.src = qmjPreviewUrl; img.style.display = 'block';
    status.textContent = 'ҚМЖ суреті дайын. «Сақтау» басқанда карточкада көрінеді.';
  }).catch(error => { if (version === qmjVersion) { qmjPreparationError = error.message; status.textContent = error.message; } });
}
async function uploadQmjThumbnail(lesson, blob) {
  const path = `grade${lesson.grade}/${lesson.subject}/lesson${lesson.lesson_num}/qmj_thumb_${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
  const bucket = sb.storage.from('lesson-videos');
  const { error } = await bucket.upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw Error(error.message);
  return { url: bucket.getPublicUrl(path).data.publicUrl, discard: () => bucket.remove([path]) };
}
async function generateQmjThumbnail(id) {
  const lesson = allLessons.find(l => l.id === id), button = document.querySelector(`[data-generate-qmj="${id}"]`);
  if (!lesson?.qmj_url || button?.disabled) return;
  const original = button.textContent; button.disabled = true; button.textContent = 'ҚМЖ суреті дайындалуда…';
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
  let uploaded;
  try {
    const response = await fetch(lesson.qmj_url, { signal: controller.signal });
    if (!response.ok) throw Error('ҚМЖ файлын жүктеу мүмкін болмады.');
    const ext = /\.pdf(?:\?|$)/i.test(lesson.qmj_url) ? 'pdf' : /\.doc(?:\?|$)/i.test(lesson.qmj_url) ? 'doc' : 'docx';
    const file = new File([await response.blob()], 'qmj.' + ext); clearTimeout(timer);
    uploaded = await uploadQmjThumbnail(lesson, await GoTABQmjThumbnail.convert(file));
    const { error } = await sb.from('materials').update({ qmj_thumb_url: uploaded.url }).eq('id', id);
    if (error) throw Error(error.message);
    uploaded = null; await loadLessons();
  } catch (error) {
    if (uploaded) await uploaded.discard();
    alert(error.name === 'AbortError' ? 'ҚМЖ жүктеу уақыты аяқталды. Қайталап көріңіз.' : error.message);
  } finally { clearTimeout(timer); button.disabled = false; button.textContent = original; }
}
