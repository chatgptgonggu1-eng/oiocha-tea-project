// Run explicitly: node tests/cloud-browser.cjs (requires Playwright + Chromium).
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
(async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const db=new PGlite();
 await db.exec('create role anon;create role authenticated');
 await db.exec(await readFile(path.join(__dirname,'../supabase/setup.sql'),'utf8'));
 const html=await readFile(path.join(__dirname,'../index.html'));
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/oiocha-tea-project/`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 let calls=0;
 async function client(width){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<700});
  await context.route('https://gdrdfhrqclbandeopqge.supabase.co/**',async route=>{
   calls++; const request=route.request(); const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,content-type','content-type':'application/json'};
   if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers,body:''});return;}
   const rpc=request.url().split('/').at(-1),args=Object.values(request.postDataJSON());
   assert.equal(request.headers().apikey,'sb_publishable_987MvvpOiICZ5tMm5AhcfQ_ZsLqa6rK');
   try{
    const data=await db.transaction(async tx=>{
     await tx.exec('set local role anon');
     return(await tx.query(`select public.${rpc}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;
    });
    await route.fulfill({status:200,headers,body:JSON.stringify(data)});
   }catch(e){await route.fulfill({status:400,headers,body:JSON.stringify({code:e.code,message:e.message})});}
  });
  const page=await context.newPage();page.on('pageerror',e=>{throw e});return {context,page};
 }
 try{
  const {context:a,page:pa}=await client(1440);await pa.goto(url);
  await pa.locator('#create').click();await pa.locator('[name=recipient]').fill('민지');await pa.locator('[name=title]').fill('공유 테스트');await pa.locator('#create-form .submit').click();
  await pa.locator('#write-dialog').waitFor({state:'visible'});
  await pa.locator('#write-form [name=name]').fill('친구 A');await pa.locator('#write-form [name=body]').fill('오래 남는 마음');await pa.locator('#write-form .submit').click();
  await pa.locator('.note:not(.demo)').waitFor();const shareUrl=pa.url();assert(shareUrl.includes('/oiocha-tea-project/#garden/'));
  await pa.locator('#share').click();assert.equal(await pa.locator('#share-url').inputValue(),shareUrl);await pa.locator('#share-dialog .close').click();
  const {context:b,page:pb}=await client(390);await pb.goto(shareUrl);await pb.getByText('오래 남는 마음',{exact:true}).waitFor();
  await pb.locator('#write').click();await pb.locator('#write-form [name=name]').fill('친구 B');await pb.locator('#write-form [name=body]').fill('<img src=x onerror=alert(1)>');await pb.locator('#write-form label').filter({has:pb.locator('[value=clover]')}).click();await pb.locator('#write-form .submit').click();
  await pb.locator('#count').filter({hasText:'2개의 마음'}).waitFor();await pa.locator('#count').filter({hasText:'2개의 마음'}).waitFor({timeout:10000});
  const note=pb.locator('.note[data-shape=clover]');const previousX=await note.evaluate(e=>parseFloat(e.style.left));await note.focus();
  const moved=pb.waitForResponse(r=>r.url().endsWith('/oiocha_move_message')&&r.request().method()==='POST');
  await pb.keyboard.press('ArrowRight');assert((await moved).ok());await pb.reload();await pb.locator('#count').filter({hasText:'2개의 마음'}).waitFor();assert.equal(await pb.locator('.note img').count(),0);assert(Math.abs(await pb.locator('.note[data-shape=clover]').evaluate(e=>parseFloat(e.style.left))-previousX-2.5)<0.01);
  await pb.locator('#new-board').click();await pb.locator('#create-form [name=recipient]').fill('다른 사람');await pb.locator('#create-form [name=title]').fill('분리된 찻잔');await pb.locator('#create-form .submit').click();await pb.locator('#write-dialog').waitFor({state:'visible'});await pb.locator('#write-dialog .close').click();assert.equal(await pb.locator('.note:not(.demo)').count(),0);
  await a.close();await b.close();
  const {context:c,page:pc}=await client(360);await pc.goto(shareUrl);await pc.locator('#count').filter({hasText:'2개의 마음'}).waitFor();assert.equal(await pc.locator('#board-title').innerText(),'공유 테스트');await c.close();
  console.log(`PASS: two independent browsers, online RPC + real SQL, copyable share link, cross-device messages, polling, reload, movement, HTML escaping, isolated boards, fresh-browser restoration (${calls} RPC requests)`);
 }finally{await browser.close();await new Promise(r=>server.close(r));await db.close();}
})().catch(e=>{console.error(e);process.exit(1)});
