const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function api() { const context={window:{}, setTimeout, clearTimeout, DOMException}; vm.runInNewContext(fs.readFileSync('public/pptx-slides.js','utf8'),context); return context.window.GoTABPptx; }
function storage(failAt=-1) {
 const uploaded=[], removed=[];
 const sb={storage:{from(bucket){assert.equal(bucket,'lesson-videos');return {
 async upload(path,blob,options){ if(uploaded.length===failAt) return {error:{message:'storage unavailable'}}; uploaded.push(path); assert.equal(options.upsert,false); return {error:null}; },
 getPublicUrl(path){return {data:{publicUrl:'https://test.invalid/'+path}};},
 async remove(paths){removed.push(...paths);return {error:null};}
 };}}};
 return {sb,uploaded,removed};
}
test('PPTX input validates file type and size before loading tools',async()=>{
 await assert.rejects(api().convert({name:'old.ppt',size:10}),/PPTX/);
 await assert.rejects(api().convert({name:'test.pptx',size:31*1024*1024}),/30 МБ/);
 await assert.rejects(api().convert({name:'test.pptx',size:0}),/30 МБ/);
});
test('slide upload preserves page order and offers cleanup before publication',async()=>{
 const {sb,uploaded,removed}=storage();
 const result=await api().upload(sb,{grade:7,subject:'geometry',lesson_num:2},['first','second']);
 assert.equal(result.urls.length,2); assert.match(result.urls[0],/grade7\/geometry\/lesson2\/slides\/.*_001.jpg$/);
 assert.match(result.urls[1],/_002.jpg$/); assert.equal(removed.length,0);
 await result.discard(); assert.deepEqual(removed,uploaded);
});
test('partial upload failure removes only the new batch; no partial preview is returned',async()=>{
 const {sb,uploaded,removed}=storage(1);
 await assert.rejects(api().upload(sb,{grade:8,subject:'algebra',lesson_num:1},['first','second']),/storage unavailable/);
 assert.equal(uploaded.length,1);assert.deepEqual(removed,uploaded);
});
