(()=>{
let libs,controller,serial=0,previousFocus,scale=1,fit=1,documents=[];
const modal=document.createElement('div');modal.id='qmjPreviewModal';modal.className='qmj-modal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','qmjPreviewTitle');
modal.innerHTML='<div class="qmj-modal-box"><header class="qmj-modal-header"><h2 id="qmjPreviewTitle">ҚМЖ алдын ала қарау</h2><div class="qmj-preview-tools"><button type="button" data-qmj-zoom="out" aria-label="Кішірейту">−</button><button type="button" data-qmj-zoom="in" aria-label="Үлкейту">+</button><button type="button" data-qmj-close aria-label="ҚМЖ алдын ала қарауды жабу">✕</button></div></header><p class="preview-watermark-note" style="margin:0;padding:10px 18px;background:#eef4ff;color:#31517c;font-size:12px;line-height:1.5">Алдын ала қарауда GoTAB су белгісі көрсетіледі. Төлем жасап, материалды жүктеп алған кезде GoTAB су белгісі болмайды.</p><p class="qmj-modal-status" role="status" aria-live="polite"></p><div class="qmj-frame-slot"></div><footer>Барлық мазмұнын көру үшін төмен айналдырыңыз.</footer></div>';
document.body.append(modal);const slot=modal.querySelector('.qmj-frame-slot'),status=modal.querySelector('[role=status]');
function script(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('Қарау құралы жүктелмеді. Қайта ашып көріңіз.'));};document.head.append(s);});}
function dependencies(){if(!libs)libs=(async()=>{if(!window.JSZip)await script('vendor/jszip-3.10.1.min.js');if(!window.docx)await script('vendor/docx-preview-0.3.7.min.js');})().catch(e=>{libs=null;throw e;});return libs;}
// Repeated branding stays above every page, including long, continuously rendered Word tables.
const watermarkImage='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="220"><text x="180" y="115" text-anchor="middle" transform="rotate(-28 180 115)" font-family="Arial,sans-serif" font-size="52" font-weight="700" fill="#2858a6" fill-opacity="0.14">GoTAB</text></svg>')+'")';
function addWatermark(target){const layer=target.ownerDocument.createElement('div');layer.className='qmj-watermark';layer.setAttribute('aria-hidden','true');layer.style.cssText='position:absolute;inset:0;z-index:2147483646;pointer-events:none;user-select:none;background-repeat:repeat;';layer.style.backgroundImage=watermarkImage;target.append(layer);}
function preventCopyShortcut(e){if((e.ctrlKey||e.metaKey)&&['a','c','x','s','p'].includes(e.key.toLowerCase()))e.preventDefault();}
function protectDocument(d){
 d.body.style.userSelect='none';d.body.style.webkitUserSelect='none';d.body.style.webkitTouchCallout='none';
 for(const name of ['copy','cut','selectstart','dragstart','contextmenu'])d.addEventListener(name,e=>e.preventDefault());
 d.addEventListener('keydown',e=>{preventCopyShortcut(e);if(e.key==='Escape'){e.preventDefault();close();}});
}
for(const name of ['copy','cut','dragstart','contextmenu'])modal.addEventListener(name,e=>e.preventDefault());
function close(){serial++;controller?.abort();modal.hidden=true;slot.replaceChildren();document.body.classList.remove('qmj-preview-open');previousFocus?.focus();}
function zoom(){const f=slot.querySelector('iframe');if(f?.contentDocument?.body)f.contentDocument.body.style.zoom=String(scale);}
function show(title){previousFocus=document.activeElement;modal.querySelector('h2').textContent=title;modal.hidden=false;document.body.classList.add('qmj-preview-open');slot.replaceChildren();modal.querySelector('[data-qmj-close]').focus();}
modal.querySelector('[data-qmj-close]').onclick=close;modal.addEventListener('click',e=>{if(e.target===modal)close();});modal.querySelectorAll('[data-qmj-zoom]').forEach(b=>b.onclick=()=>{scale=Math.max(fit,Math.min(2,scale+(b.dataset.qmjZoom==='in'?.15:-.15)));zoom();});
document.addEventListener('keydown',e=>{if(modal.hidden)return;preventCopyShortcut(e);if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const bs=Array.from(modal.querySelectorAll('button'));if(e.shiftKey&&document.activeElement===bs[0]){e.preventDefault();bs.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===bs.at(-1)){e.preventDefault();bs[0].focus();}}});
window.setQmjPreviewDocuments=items=>{documents=items;};
window.openQmjPreviewPicker=()=>{controller?.abort();serial++;show('ҚМЖ алдын ала қарау');status.textContent='Қарайтын ҚМЖ-ны таңдаңыз';const list=document.createElement('div');list.className='qmj-picker';documents.forEach(item=>{const b=document.createElement('button');b.type='button';b.textContent=item.title;b.onclick=()=>window.openQmjPreview(item.url,item.title);list.append(b);});if(!documents.length)status.textContent='Бұл сыныпта ҚМЖ әлі қосылмаған';slot.append(list);};
window.openQmjPreview=async(url,title,opts)=>{
 controller?.abort();controller=new AbortController();const id=++serial;show('ҚМЖ · '+title);
 // a free lesson is shown without the GoTAB watermark
 const wm=opts?.watermark!==false;const note=modal.querySelector('.preview-watermark-note');if(note)note.hidden=!wm;status.textContent='ҚМЖ-ның барлық беттері жүктелуде…';
 try{const source=new URL(url,location.href);if(!['http:','https:'].includes(source.protocol))throw Error('ҚМЖ сілтемесі жарамсыз.');
 const frame=document.createElement('iframe');frame.title=title+' — ҚМЖ';frame.setAttribute('sandbox','allow-same-origin');slot.append(frame);
 if(/\.pdf(?:\?|$)/i.test(source.href)){frame.src=source.href+'#toolbar=0';if(wm)addWatermark(slot);status.textContent='';return;}
 const [response]=await Promise.all([fetch(source.href,{signal:controller.signal}),dependencies()]);if(!response.ok)throw Error('ҚМЖ файлы жүктелмеді ('+response.status+').');const bytes=await response.arrayBuffer();if(id!==serial)return;
 const d=frame.contentDocument;d.open();d.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{background:#edf2f8}body{margin:0;overflow:auto}section.docx{position:relative!important;isolation:isolate;box-shadow:0 2px 12px #17365d12!important}.docx-wrapper{padding:16px!important}a{pointer-events:none}.docx-wrapper,.docx-wrapper *{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}img{-webkit-user-drag:none}@media print{body{visibility:hidden!important}}</style></head><body></body></html>');d.close();
 await window.docx.renderAsync(bytes,d.body,d.head,{breakPages:true,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,renderEndnotes:true,renderAltChunks:false,useBase64URL:true});if(id!==serial)return;
 protectDocument(d);const pages=Array.from(d.querySelectorAll('section.docx'));if(wm)pages.forEach(addWatermark);const width=Math.max(1,...pages.map(p=>p.getBoundingClientRect().width))+32;fit=Math.min(1,frame.clientWidth/width);scale=fit;zoom();status.textContent='ҚМЖ толық ашылды';
 }catch(e){if(id!==serial||e.name==='AbortError')return;slot.replaceChildren();status.textContent='ҚМЖ-ны ашу мүмкін болмады. '+e.message;}
};
})();
