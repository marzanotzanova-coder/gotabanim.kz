(()=>{
let rows=[];
const money=n=>Number(n).toLocaleString('ru-RU')+' ₸';
const date=d=>d?new Date(d).toLocaleDateString('kk-KZ',{timeZone:'Asia/Almaty'}):'Күні сақталмаған';
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(r){return r.refunded_amount===r.amount?'Толық қайтарылды':r.refunded_amount?'Ішінара қайтарылды':'Төленген'}
function current(r){const u=allUsers.find(u=>u.id===r.user_id);return {banned:!!u?.is_banned,until:u?(r.subject==='math'?u.paid_until:u.paid_informatics_until):r.expires_at};}
function cells(r){const c=current(r),left=c.until?Math.max(0,Math.ceil((new Date(c.until)-Date.now())/86400000)):0;return [r.teacher_name,r.teacher_email,r.subject==='math'?'Математика':'Информатика',money(r.amount),money(r.refunded_amount),money(r.amount-r.refunded_amount),date(r.paid_at)+(r.date_estimated?' (шамамен)':''),date(c.until),r.refunded_amount===r.amount?'Қайтарылды':c.banned?'Блокталған':left?left+' күн':'Мерзімі бітті',status(r),r.note];}
window.openPaymentReport=async()=>{
 document.getElementById('paymentReport').hidden=false;
 document.getElementById('paymentReport').scrollIntoView({block:'start'});
 await loadPaymentReport();
};
window.loadPaymentReport=async()=>{
 const body=document.getElementById('paymentReportBody'),summary=document.getElementById('paymentSummary');
 const {data,error}=await sb.from('teacher_payments').select('*').order('paid_at',{ascending:false});
 if(error){rows=[];summary.textContent='';body.innerHTML='<tr><td colspan="12">Есеп жүктелмеді. Қайта ашып көріңіз.</td></tr>';return;}
 rows=data||[];
 const gross=rows.reduce((s,r)=>s+r.amount,0),refund=rows.reduce((s,r)=>s+r.refunded_amount,0);
 summary.innerHTML=[['Төлем саны',rows.length],['Жалпы түскен',money(gross)],['Қайтарылған',money(refund)],['Таза түсім',money(gross-refund)]].map(([k,v])=>`<div class="stat-card"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join('');
 body.innerHTML=rows.map(r=>'<tr>'+cells(r).map(v=>'<td>'+safe(v)+'</td>').join('')+`<td>${r.refunded_amount===0?'<button class="btn-ban" data-refund="'+safe(r.id)+'">Қайтарымды белгілеу</button>':''}</td></tr>`).join('')||'<tr><td colspan="12">Төлемдер жоқ</td></tr>';
};
document.getElementById('paymentReportBody').addEventListener('click',async e=>{
 const btn=e.target.closest('[data-refund]');if(!btn)return;
 const r=rows.find(r=>r.id===btn.dataset.refund);if(!r||!confirm(r.teacher_name+' — '+money(r.amount)+' толық қайтарылғанын есепке енгізесіз бе? Бұл батырма банк арқылы ақша аудармайды және доступты өзгертпейді.'))return;
 btn.disabled=true;try{const {error}=await sb.rpc('record_teacher_refund',{payment_id:r.id});if(error)throw error;await loadPaymentReport();}catch(e){alert('Қате: '+e.message);btn.disabled=false;}
});
window.exportPaymentReport=()=>{
 if(!rows.length)return;
 const headers=['Аты-жөні','Email','Пән','Төлем','Қайтарым','Таза түсім','Төлем күні','Жазылым соңы','Қалған күн / доступ','Төлем күйі','Ескерту'];
 const totals=rows.reduce((s,r)=>[s[0]+r.amount,s[1]+r.refunded_amount],[0,0]);
 const data=[headers,...rows.map(cells),['ЖАЛПЫ','','',money(totals[0]),money(totals[1]),money(totals[0]-totals[1])]];
 const csv='\ufeff'+data.map(row=>row.map(v=>'"'+String(/^[=+\-@\t\r]/.test(String(v))?'\''+v:v).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='GoTAB-tolem-esebi-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
})();
