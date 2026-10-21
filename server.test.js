import {test,after} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.DB_PATH=':memory:';
const {server}=await import('./server.js');
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
after(()=>server.close());
async function request(url,method='GET',data){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};}
test('create, share, persist, move and isolate messages',async()=>{
 const a=await request('/api/boards','POST',{title:'초록빛 응원',recipient:'친구'});assert.equal(a.status,201);
 const b=await request('/api/boards','POST',{title:'다른 정원',recipient:'나'});
 const endpoint=`/api/boards/${a.data.id}`;
 for(const shape of ['leaf','heart','star','clover','rabbit'])assert.equal((await request(endpoint+'/messages','POST',{name:'친구',body:'오늘도 응원해요 <script>alert(1)</script>',shape,x:.3,y:.4})).status,201);
 const read=await request(endpoint);assert.equal(read.data.messages.length,5);
 const id=read.data.messages[0].id;
 assert.equal((await request(`/api/boards/${b.data.id}/messages/${id}`,'PATCH',{x:.8,y:.9})).status,404);
 assert.equal((await request(endpoint+'/messages/'+id,'PATCH',{x:.8,y:.9})).status,200);
 assert.equal((await request(endpoint)).data.messages[0].x,.8);
 assert.equal((await request('/api/boards/'+b.data.id)).data.messages.length,0);
 assert.equal((await request(endpoint+'/messages','POST',{name:' ',body:'test',shape:'leaf',x:0,y:0})).status,400);
 assert.equal((await request(endpoint+'/messages/'+id,'PATCH',{x:5,y:0})).status,400);
 assert.equal((await request('/api/boards/missing')).status,404);
});
