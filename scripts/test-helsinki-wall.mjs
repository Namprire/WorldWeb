import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5179/');
 await page.waitForFunction(()=>!!window.__webworldEngine);
 await page.locator('#enter').click();
 await page.waitForFunction(()=>window.__webworldEngine.getSnapshot().state==='ride');
 await page.keyboard.down('w');
 await page.waitForFunction(()=>window.__webworldEngine.getSnapshot().gz < -88,null,{timeout:20000});
 await page.waitForTimeout(1800);
 const state=await page.evaluate(()=>window.__webworldEngine.getSnapshot());
 assert.ok(state.gz>=-92 && state.gz<=-88,`Mapped north-square facade stops the scooter: ${state.gz}`);
 await page.keyboard.up('w');
 await page.screenshot({path:'output/webworld/helsinki-station.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS Keyboard approach stops at the visible mapped north-square facade without crossing it');
} finally {await browser.close();}
