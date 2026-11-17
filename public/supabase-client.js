const SUPABASE_URL = 'https://eknjslyvcwtusbqvygxx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4AKv-8WUdjo_ZdYvlHPC4w_v-aNINNL';
const ADMIN_EMAIL  = 'admingotab.kz@gmail.com';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function requireAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  // Remember last visited page for auto-return (admin pages excluded)
  const here = location.pathname.split('/').pop() + location.search;
  const excluded = ['login.html', 'index.html', 'register.html', 'admin.html', 'games.html'];
  if (here && !excluded.includes(here.split('?')[0])) {
    try { localStorage.setItem('gotab_last_page', here); } catch (_) {}
  }
  return session.user;
}

// For index/login pages: if session exists, skip login and go to last page
async function redirectIfLoggedIn() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    window.location.href = 'dashboard.html';
  }
}

// A paid teacher must never get the pay window because of a slow or broken connection.
// GoTABMarkPaid unlocks the page; GoTABPayGate re-checks the server (with retries) before showing the pay window.
window.GoTABMarkPaid=function(){try{userIsPaid=true;}catch(_){}document.body.classList.add('is-paid');const pb=document.getElementById('payBar');if(pb)pb.style.display='none';};
window.GoTABRecheckPaid=async function(){
  try{const {data:{session}}=await sb.auth.getSession();if(!session)return false;if(session.user.email===ADMIN_EMAIL){GoTABMarkPaid();return true;}
    for(let i=0;i<4;i++){try{const r=await sb.rpc('check_paid_user',{check_id:session.user.id});if(!r.error){if(r.data===true)GoTABMarkPaid();return r.data===true;}}catch(_){}await new Promise(ok=>setTimeout(ok,1000+i*1000));}
  }catch(_){}
  return null;
};
window.GoTABPayGate=async function(){
  const t=document.createElement('div');t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;background:#0f172ae6;color:#fff;padding:12px 18px;border-radius:12px;font:700 14px Inter,sans-serif;box-shadow:0 8px 24px #0003;max-width:92vw;text-align:center';
  t.textContent='Жазылым тексерілуде…';document.body.append(t);
  const ok=await GoTABRecheckPaid();
  if(ok===true){t.textContent='✓ Жазылымыңыз белсенді. Батырманы қайта басыңыз.';t.style.background='#047857f2';setTimeout(()=>t.remove(),3500);return;}
  if(ok===null){t.textContent='Интернет байланысы әлсіз — жазылымды тексеру мүмкін болмады. Біраздан кейін қайта басыңыз.';t.style.background='#b45309f2';setTimeout(()=>t.remove(),5000);return;}
  t.remove();if(typeof openModal==='function')openModal();
};

// Server-clock subscription deadline, including tabs left open overnight.
(async function watchSubscription(){
  const page=location.pathname.split('/').pop();
  if(!['content.html','visuals.html','games.html','quiz-maker.html','quiz-play.html','labs.html','lab-pyramid.html','lab-cube.html','lab-polyhedra.html','lab-distance.html'].includes(page))return;
  const {data:{session}}=await sb.auth.getSession();
  if(!session || session.user.email===ADMIN_EMAIL)return;
  const catalogPage=['content.html','games.html','labs.html'].includes(page);
  let deadline=0,timer,pending=false,known=null,current=null,retry=null;
  const info=new URLSearchParams(location.search).get('subject')==='informatics';
  const gate=document.createElement('div');gate.id='subscriptionGate';
  gate.style.cssText='position:fixed;inset:68px 0 0;z-index:9000;background:#f4f7fbf5;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center';
  const card=document.createElement('div');card.style.cssText='background:white;border:1px solid #dfe7f2;border-radius:20px;padding:32px;max-width:440px;box-shadow:0 12px 40px #17365d12';
  const title=document.createElement('h2'),text=document.createElement('p'),button=document.createElement('button'),back=document.createElement('a');
  title.textContent='Қолжетімділікті тексеру';text.textContent='Бір сәт күтіңіз…';text.style.cssText='line-height:1.7;color:#617590;margin:16px 0';
  button.textContent='Төлем жасау';button.className='btn-primary';button.style.cssText='padding:12px 20px;border-radius:10px;border:0;background:#2864df;color:#fff;cursor:pointer;font:inherit';
  button.hidden=true;button.onclick=()=>{if(typeof openModal==='function'){const modal=document.getElementById('payModal');if(modal)modal.style.zIndex='10000';openModal();}else location.href='dashboard.html';};
  back.href='dashboard.html';back.textContent='Кабинетке оралу';back.style.cssText='display:block;margin-top:20px;color:#2858a6';
  card.append(title,text,button,back);gate.append(card);if(!catalogPage)document.body.append(gate);

  if(page==='visuals.html'){
    const preview=document.createElement('button');preview.type='button';preview.textContent='Алдын ала қарау';preview.className='btn-preview material-preview-button';preview.onclick=()=>window.openMaterialPreviewPicker?.();card.insertBefore(preview,button);
  }
  function closeAccess(message){deadline=0;clearTimeout(timer);if(page==='games.html')document.body.classList.add('games-locked');if(page==='labs.html')document.body.classList.add('labs-locked');if(catalogPage){gate.remove();const payBar=document.getElementById('payBar');if(payBar)payBar.style.display='flex';return;}document.body.append(gate);title.textContent='Материалдарға доступ жабық';text.textContent=message;button.hidden=false;document.querySelectorAll('video').forEach(v=>v.pause());}
  function refresh(){if(pending)return current;pending=true;current=check();return current;}
  async function check(){
    try{
      const {data:paid,error:paidError}=await sb.rpc(info?'check_paid_informatics':'check_paid_user',{check_id:session.user.id});
      if(paidError)throw paidError;
      const active=paid===true;
      let data=null;
      try{const result=await sb.rpc('get_my_access');if(!result.error){data=Array.isArray(result.data)?result.data[0]:result.data;if(typeof data==='string')data=JSON.parse(data);}}catch(_){}
      const until=info?data?.informatics_until:data?.math_until;
      const serverRemaining=info?data?.informatics_remaining_ms:data?.math_remaining_ms;
      const parsed=serverRemaining!=null?Number(serverRemaining):new Date(until)-new Date(data?.server_now);
      const validDeadline=Number.isFinite(parsed)&&parsed>0;
      const remaining=active?(validDeadline?parsed:15000):0;
      if(!active||!(remaining>0)){known=false;closeAccess(data?.is_banned?'Аккаунт блокталған. Әкімшіге хабарласыңыз.':'Жазылым белсенді емес немесе мерзімі аяқталған. Келесі айға төлем расталғаннан кейін материалдар қайта ашылады.');return;}
      known=true;clearTimeout(retry);window.GoTABMarkPaid();deadline=performance.now()+remaining;if(page==='games.html')document.body.classList.remove('games-locked');if(page==='labs.html')document.body.classList.remove('labs-locked');gate.remove();clearTimeout(timer);timer=setTimeout(()=>{if(remaining>2147483647||!validDeadline)refresh();else closeAccess('Жазылым мерзімі аяқталды. Келесі айға төлем расталғаннан кейін материалдар қайта ашылады.');},Math.min(remaining,2147483647));
    }catch(e){
      // connection problem: keep whatever access the teacher already has and quietly try again
      clearTimeout(retry);retry=setTimeout(refresh,5000);
      if(known===null&&!catalogPage){title.textContent='Қолжетімділікті тексеру';text.textContent='Интернет байланысы әлсіз — қайта тексерілуде…';}
    }finally{pending=false;}
  }
  function guardAction(e){
    if(e.target.closest('#subscriptionGate,.top-nav,.pay-modal-overlay,.modal-overlay'))return;
    const action=e.target.closest('[data-dl-ppt],[data-dl-qmj],[data-dl-vid],[data-dl-all],[data-extra-file],.sticker-item,.btn-dl-set');
    const gameAction=page==='games.html'&&e.target.closest('.btn-fgplay,.btn-qgplay,.qgcard,.gtype-mini,.btn-create-big');
    const labAction=page==='labs.html'&&e.target.closest('.btn-lab-use');
    if((action||gameAction||labAction) && known===null){
      // the check has not answered yet: wait for it, then repeat the click
      e.preventDefault();e.stopImmediatePropagation();const el=e.target;refresh()?.then(()=>{if(known===true)el.click();else if(known===false&&catalogPage&&typeof openModal==='function')openModal();});return;
    }
    if((action||gameAction||labAction) && (known===false||!deadline||performance.now()>=deadline)){
      e.preventDefault();e.stopImmediatePropagation();closeAccess('Жазылым мерзімі аяқталған. Төлем расталғаннан кейін қайта ашылады.');if(catalogPage&&typeof openModal==='function')openModal();
    }
  }
  document.addEventListener('click',guardAction,true);
  document.addEventListener('auxclick',guardAction,true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  await refresh();setInterval(refresh,30000);
})();
