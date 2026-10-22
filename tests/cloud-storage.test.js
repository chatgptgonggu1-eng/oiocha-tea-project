import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createCloudApi} from '../public/cloud-storage.js';

let db;
const sql = await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
before(async()=>{
 db = new PGlite();
 await db.exec('create role anon; create role authenticated;');
 await db.exec(sql);
 await db.exec(sql); // Safe to rerun after the user's initial table setup, too.
});
after(async()=>{await db?.close();});
async function anon(query,args=[]){
 await db.exec('set role anon');
 try{return await db.query(query,args);}finally{await db.exec('reset role');}
}
const rpc=async(name,args=[])=>{
 const call=args.map((_,i)=>'$'+(i+1)).join(',');
 const result=await anon(`select public.${name}(${call}) as value`,args);
 return result.rows[0].value;
};

test('shared boards persist across API clients, stay isolated, and retain positions',async()=>{
 const bridge=async(url,options)=>{
  assert.equal(options.headers.apikey,'public-key');
  assert.equal(options.method,'POST');
  const name=url.split('/').at(-1),args=Object.values(JSON.parse(options.body));
  try{return new Response(JSON.stringify(await rpc(name,args)),{status:200});}
  catch(e){return new Response(JSON.stringify({code:e.code,message:e.message}),{status:400});}
 };
 const a=createCloudApi({url:'https://example.supabase.co',publishableKey:'public-key'},bridge);
 const b=createCloudApi({url:'https://example.supabase.co',publishableKey:'public-key'},bridge);
 const post=(data)=>({method:'POST',body:JSON.stringify(data)});
 const first=await a('/api/boards',post({title:'첫 찻잔',recipient:'친구'}));
 const second=await b('/api/boards',post({title:'다른 찻잔',recipient:'나'}));
 const endpoint='/api/boards/'+first.id;
 const m=await b(endpoint+'/messages',post({name:'방문자',body:'<script>alert(1)</script>',shape:'heart',x:.3,y:.4}));
 const restored=await a(endpoint);
 assert.equal(restored.messages[0].body,'<script>alert(1)</script>');
 assert.equal((await b('/api/boards/'+second.id)).messages.length,0);
 await b(endpoint+'/messages/'+m.id,{method:'PATCH',body:JSON.stringify({x:.7,y:.8})});
 assert.equal((await a(endpoint)).messages[0].x,.7);
 await assert.rejects(b('/api/boards/'+second.id+'/messages/'+m.id,{method:'PATCH',body:JSON.stringify({x:.2,y:.3})}),/찾을 수/);
 await assert.rejects(a(endpoint+'/messages',post({name:' ',body:'invalid',shape:'leaf',x:.5,y:.5})),/확인/);
 await assert.rejects(a(endpoint+'/messages',post({name:'name',body:'invalid',shape:'other',x:.5,y:.5})),/확인/);
 await assert.rejects(a(endpoint+'/messages',post({name:'name',body:'invalid',shape:'leaf',x:1,y:.5})),/확인/);
});

test('anonymous access cannot list, insert, update, or delete underlying tables',async()=>{
 for(const query of [
  'select * from public.oiocha_boards',
  'select * from public.oiocha_messages',
  "insert into public.oiocha_boards(title,recipient) values('bad','bad')",
  "update public.oiocha_messages set body='bad'",
  'delete from public.oiocha_messages'
 ])await assert.rejects(anon(query),e=>e.code==='42501');
 await db.exec('set role authenticated');
 try{await assert.rejects(db.query('select * from public.oiocha_boards'),e=>e.code==='42501');}
 finally{await db.exec('reset role');}
 await assert.rejects(rpc('oiocha_get_board',['00000000-0000-4000-8000-000000000000']),e=>e.code==='P0002');
});

test('message spam quotas are enforced per board without blocking another board',async()=>{
 const a=await rpc('oiocha_create_board',['limit','friend']);
 const b=await rpc('oiocha_create_board',['other','friend']);
 for(let i=0;i<20;i++)await rpc('oiocha_add_message',[a.id,'writer','hello','leaf',.5,.5]);
 await assert.rejects(rpc('oiocha_add_message',[a.id,'writer','too many','leaf',.5,.5]),/1분/);
 await rpc('oiocha_add_message',[b.id,'writer','works','leaf',.5,.5]);
 await db.exec("update public.oiocha_messages set created_at=now()-interval '2 minutes'");
 await rpc('oiocha_add_message',[a.id,'writer','works again','leaf',.5,.5]);
});

test('board creation is throttled and there is no enumeration function',async()=>{
 await db.exec('delete from public.oiocha_messages;delete from public.oiocha_boards');
 for(let i=0;i<60;i++)await rpc('oiocha_create_board',['board','friend']);
 await assert.rejects(rpc('oiocha_create_board',['one more','friend']),/1분/);
 await assert.rejects(anon('select public.oiocha_get_board()'),e=>e.code==='42883');
});

test('adapter reports setup and network errors without claiming a local save',async()=>{
 const config={url:'https://example.supabase.co',publishableKey:'public-key'};
 const missing=createCloudApi(config,async()=>new Response(JSON.stringify({code:'PGRST202'}),{status:404}));
 await assert.rejects(missing('/api/boards',{method:'POST',body:'{}'}),/설정/);
 const offline=createCloudApi(config,async()=>{throw Error('offline')});
 await assert.rejects(offline('/api/boards',{method:'POST',body:'{}'}),/연결/);
 await assert.rejects(offline('/api/boards/not-a-uuid'),/링크/);
});


test('reapplying setup preserves already stored cups and messages',async()=>{
 const before=(await db.query('select count(*)::int as n from public.oiocha_boards')).rows[0].n;
 await db.exec(sql);
 assert.equal((await db.query('select count(*)::int as n from public.oiocha_boards')).rows[0].n,before);
});
