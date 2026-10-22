const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.DEMO_URL||'http://127.0.0.1:3010/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[];
 const make=async(width,height=844,reducedMotion='reduce')=>{
  const context=await browser.newContext({viewport:{width,height},reducedMotion,hasTouch:width<=540,acceptDownloads:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.product-photo .product-cutout').last().waitFor();
  assert.equal(await page.locator('.product-photo .product-cutout').count(),6);assert.equal(await page.locator('.shelf-light').count(),6);
  await page.locator('.product-photo image').evaluateAll(images=>Promise.all(images.map(e=>{const image=new Image();image.src=e.getAttribute('href');return image.decode()})));assert(await page.locator('.product-cutout image').evaluateAll(images=>images.every(e=>e.getAttribute('clip-path')?.startsWith('url(#'))));
  return {page,context};
 };
 try{
  for(const width of [320,360,390,430,768,1440]){
   const{page,context}=await make(width);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.locator('.printer-paper-mask').evaluate(e=>e.getBoundingClientRect().height),0);
   const receipt=await page.locator('.receipt-zone').boundingBox(),tray=await page.locator('.dispense-zone').boundingBox();assert(tray.y>=receipt.y+receipt.height);
   await page.getByRole('button',{name:'뽑기',exact:true}).click();await page.getByRole('alert').waitFor();
   await page.locator('#birth-year').fill('2008');await page.locator('#birth-year').press('Enter');
   await page.getByRole('button',{name:'영수증 확인',exact:false}).waitFor();
   assert.equal(await page.locator('.dispensed-product .product-cutout').getAttribute('aria-label'),'오이오차 녹차');
   const control=await page.locator('.receipt-open').boundingBox(),mouth=await page.locator('.printer-mouth').boundingBox();assert(Math.abs(control.x+control.width/2-receipt.x-receipt.width/2)<2);assert(control.y+control.height<=mouth.y+2);assert.equal(await page.locator('.tray').evaluate(e=>getComputedStyle(e).overflow),'hidden');
   await page.getByRole('button',{name:'영수증 확인',exact:false}).click();
   await page.locator('dialog[open]').waitFor();
   assert((await page.locator('.receipt-copy').innerText()).includes('두 살이 되던 해'));
   assert.equal(await page.locator('.receipt-body').innerText(),JSON.parse(await fs.readFile(path.join(__dirname,'../PRODUCT_DATA.json'),'utf8')).messages_by_brand.oi_ocha_green.replace(/\n/g,'\n\n'));
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'이미지 저장',exact:false}).click();const file=await download;
   const bytes=await fs.readFile(await file.path());assert.equal(bytes.readUInt32BE(16),720);assert(bytes.readUInt32BE(20)>1000);assert(bytes.length>10000);
   if(width===390){await fs.mkdir(path.join(__dirname,'../artifacts'),{recursive:true});await file.saveAs(path.join(__dirname,'../artifacts/receipt-2008.png'));await page.screenshot({path:path.join(__dirname,'../artifacts/mobile-result.png'),fullPage:true});}
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   await page.getByRole('button',{name:'다시 뽑기',exact:true}).first().click();assert.equal(await page.locator('.machine').getAttribute('data-phase'),'idle');
   await context.close();console.log(`PASS ${width}: images, layout, invalid input, Enter, receipt, PNG, Escape, reset`);
  }
  const{page,context}=await make(390,844,'no-preference');
  await page.evaluate(()=>{window.phaseLog=[];new MutationObserver(()=>window.phaseLog.push([document.querySelector('.machine').dataset.phase,performance.now()])).observe(document.querySelector('.machine'),{attributes:true,attributeFilter:['data-phase']});});
  await page.locator('#birth-year').fill('2003');const start=Date.now();await page.getByRole('button',{name:'뽑기',exact:true}).click();
  assert.equal(await page.locator('.machine').getAttribute('data-phase'),'dispensing');assert(await page.locator('.draw-button').isDisabled());
  const frames=await page.locator('.dispensed-product').evaluate(e=>e.getAnimations()[0].effect.getKeyframes());assert(frames[0].transform.includes('translateY(-140%)'));assert.equal(await page.locator('.tray').evaluate(e=>getComputedStyle(e).overflow),'hidden');
  await page.waitForTimeout(500);assert.equal(await page.locator('.machine').getAttribute('data-phase'),'dispensing');
  assert.equal(await page.locator('.printer-paper-mask').evaluate(e=>e.getBoundingClientRect().height),0);
  await page.waitForFunction(()=>document.querySelector('.machine').dataset.phase==='printing');assert.equal(await page.locator('.receipt-copy').count(),0);
  await page.waitForTimeout(500);const partial=await page.locator('.printer-paper-mask').evaluate(e=>e.getBoundingClientRect().height);assert(partial>0&&partial<105);
  await page.getByRole('button',{name:'영수증 확인',exact:false}).waitFor();const duration=Date.now()-start;assert(duration>=2800&&duration<4500);
  const log=await page.evaluate(()=>window.phaseLog);assert.deepEqual(log.map(x=>x[0]),['dispensing','printing','receipt_ready']);
  await page.getByRole('button',{name:'영수증 확인',exact:false}).click();assert((await page.locator('.receipt-product').innerText()).includes('파워오투'));
  await page.getByRole('button',{name:'다시 뽑기',exact:true}).click();await page.locator('#birth-year').fill('2014');await page.getByRole('button',{name:'뽑기',exact:true}).click();
  await page.getByRole('button',{name:'영수증 확인',exact:false}).waitFor();assert.equal(await page.locator('.dispensed-product .product-cutout').count(),0);assert((await page.locator('.text-product').innerText()).includes('카프리썬 멀티비타민'));
  await page.getByRole('button',{name:'영수증 확인',exact:false}).click();assert((await page.locator('.receipt-meta').innerText()).includes('2014'));assert((await page.locator('.receipt-copy').innerText()).includes('같은 해'));
  await context.close();console.log(`PASS motion sequence (${duration}ms), locked input, concealed copy, text-only 2014 fallback`);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
