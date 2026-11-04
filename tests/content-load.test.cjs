const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync('public/content-load.js','utf8');
function environment(extra = {}) {
  const ctx = {window:{},Promise,setTimeout,clearTimeout,AbortController,Date,console,...extra};
  vm.createContext(ctx); vm.runInContext(source,ctx); return ctx;
}
async function main() {
  const {window:{GoTABLoad:loader}}=environment();
  let attempts=0, renders=[],states=[],aborts=0;
  const stuck=loader.catalog({key:'x',timeout:5,fetchRows:signal=>{
    attempts++;signal.addEventListener('abort',()=>aborts++);return new Promise(()=>{});
  },renderRows:r=>renders.push(r),status:s=>states.push(s)});
  assert.equal(await stuck.load(),false);
  assert.equal(attempts,2);assert.equal(aborts,2);assert.equal(states.at(-1),'error');assert.equal(renders.length,0);
  let fail=true;
  const retry=loader.catalog({key:'x',fetchRows:async()=>fail?{error:Error('offline')}:{data:[]},renderRows:r=>renders.push(r),status:s=>states.push(s)});
  await retry.load();assert.equal(states.at(-1),'error');
  fail=false;assert.equal(await retry.load(),true);assert.equal(states.at(-1),'ready');assert.equal(renders.at(-1).length,0);
  let networkResolve;
  const rows=[{lesson_num:7,title:'Seventh'}];
  renders=[];
  const cache=loader.catalog({key:'user_grade_subject',storage:{getItem:()=>JSON.stringify({at:Date.now(),rows}),setItem(){throw Error('quota')}},fetchRows:()=>new Promise(r=>networkResolve=r),renderRows:r=>renders.push(r),status:s=>states.push(s)});
  assert.equal(renders.length,1,'cached catalog renders before the request');
  const request=cache.load();await Promise.resolve();networkResolve({data:rows});await request;
  assert.equal(renders.length,1,'unchanged rows must not restart all videos');
  assert.equal(states.at(-1),'ready','storage quota does not break rendering');

  // Exercise the actual page bootstrap: a stalled billing RPC cannot hold up lesson rendering.
  const html=fs.readFileSync('public/content.html','utf8');
  const script=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const GRADES_LABEL'));
  let billingResolve, fetched=0,shown=[];
  const elements=new Map();
  const element=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,style:{},setAttribute(){},addEventListener(){},classList:{add(){},remove(){}}});return elements.get(id)};
  const query={select(){return this},eq(){return this},order(){return this},abortSignal(){fetched++;return Promise.resolve({data:rows})}};
  const ctx=environment({document:{getElementById:element,addEventListener(){}},location:{search:'?grade=9&subject=algebra'},URLSearchParams,
    requireAuth:async()=>({id:'paid-teacher',email:'teacher@example.com',user_metadata:{name:'Teacher'}}),ADMIN_EMAIL:'admin@example.com',
    sb:{rpc:()=>new Promise(r=>billingResolve=r),from:()=>query},GoTABExtras:{files:()=>[]},shown});
  ctx.GoTABLoad=ctx.window.GoTABLoad;
  vm.runInContext(script+'\nrender = rows => shown.push(rows);',ctx);
  await new Promise(r=>setImmediate(r));
  assert.equal(fetched,1);assert.equal(shown.length,1);assert.equal(shown[0][0].lesson_num,7);
  assert.equal(element('catalogStatus').hidden,true);
  billingResolve({data:true});await new Promise(r=>setImmediate(r));

  let onIntersect, played=0,paused=0;
  const video={dataset:{src:'lesson.mp4'},getAttribute(){return this.src||null},play(){played++;return Promise.resolve()},pause(){paused++}};
  const media=environment({document:{hidden:false},IntersectionObserver:class{constructor(fn){onIntersect=fn}observe(){}disconnect(){}}});
  media.window.GoTABLoad.visibleVideos({querySelectorAll:()=>[video]});
  assert.equal(video.src,undefined,'offscreen video does not start a network request');
  onIntersect([{target:video,isIntersecting:true}]);assert.equal(video.src,'lesson.mp4');assert.equal(played,1);
  onIntersect([{target:video,isIntersecting:false}]);assert.equal(paused,1);
  assert(!html.includes('preload="auto"'),'catalog must not eagerly download every video');
  console.log('PASS: bounded hangs, abort/retry, honest error vs empty state, fast cached return, quota handling, billing independence, visible-only videos');
}
main().catch(error=>{console.error(error);process.exitCode=1});
