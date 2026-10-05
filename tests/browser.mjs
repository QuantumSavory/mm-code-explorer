import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.APP_URL || 'http://127.0.0.1:5173/';
await mkdir('.artifacts',{recursive:true});
await page.goto(base,{waitUntil:'networkidle'});
await page.waitForSelector('.check-card');
assert.equal(await page.locator('.check-card').count(),2);
assert.equal(await page.locator('#webgl-error').isVisible(),false);
assert.match(await page.locator('#stats').innerText(),/144/);
await page.screenshot({path:'.artifacts/desktop-2d.png',fullPage:true});
for(const [id,cards,slices] of [['tt72',4,4],['mm486',8,24],['mm648',8,32],['toric4',8,16],['haah',2,2],['toric2',2,2]]){
  await page.selectOption('#preset',id);assert.equal(await page.locator('.check-card').count(),cards);assert.equal(await page.locator('.viewport').count(),slices);
  assert.equal(await page.locator('#input-error').isVisible(),false);
  if(id==='mm486'){
    await page.screenshot({path:'.artifacts/desktop-4d.png'});
    await page.locator('.viewport').first().scrollIntoViewIfNeeded();const r=await page.locator('.viewport').first().boundingBox();
    await page.mouse.move(r.x+r.width*.5,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.65,r.y+r.height*.6,{steps:8});await page.mouse.up();
    await page.locator('#spacing').fill('1.4');await page.locator('#block-spacing').fill('1.5');await page.locator('#slice-spacing').fill('48');
    await page.locator('#show-grid').uncheck();await page.locator('#show-links').uncheck();await page.click('#reset-view');
  }
}
await page.selectOption('#preset','tt72');
await page.click('[data-filter="X"]');assert.equal(await page.locator('.check-card').count(),1);
await page.click('[data-filter="Z"]');assert.equal(await page.locator('.check-card').count(),3);
await page.click('[data-filter="all"]');
await page.locator('#polynomials').fill('1 + bogus\n1 + y');await page.click('button[type=submit]');
assert.equal(await page.locator('#input-error').isVisible(),true);assert.equal(await page.locator('.check-card').count(),4);
await page.click('[data-dim="2"]');await page.locator('#ideal').fill('x^3-1,y^3-1');
await page.locator('#polynomials').fill('(1+x)(1+y)\n1+x^-1\n1+y\nx+y');await page.click('button[type=submit]');
assert.equal(await page.locator('#input-error').isVisible(),false);assert.equal(await page.locator('.check-card').count(),8);
assert.match(await page.locator('#stats').innerText(),/54/);
await page.locator('.support-details summary').first().click();assert.ok(await page.locator('.support-table tbody tr').count()>0);
await page.selectOption('#preset','tt72');await page.screenshot({path:'.artifacts/desktop-3d.png'});
await page.setViewportSize({width:390,height:844});
await page.selectOption('#preset','mm486');await page.locator('#check-gallery').scrollIntoViewIfNeeded();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
await page.screenshot({path:'.artifacts/mobile-4d.png'});
await page.setViewportSize({width:1440,height:1080});await page.selectOption('#preset','bb144');
assert.deepEqual(errors,[]);
console.log('Browser checks passed: seven presets; 2D/3D/4D views; filters; camera drag; spacing; validation; custom code; support tables; mobile overflow.');
await browser.close();
