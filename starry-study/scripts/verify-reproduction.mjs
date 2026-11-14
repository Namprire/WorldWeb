import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=new URL('../evidence/reproduction/',import.meta.url);await fs.mkdir(root,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
const page=await context.newPage(),errors=[],requests=[],sockets=[],checks=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>requests.push(r.url()));page.on('websocket',ws=>sockets.push(ws.url()));
const check=(name,ok)=>{checks.push({name,pass:!!ok});assert.ok(ok,name);};
try{
 await page.goto('http://127.0.0.1:5178/',{waitUntil:'networkidle'});
 await page.locator('#loading.done').waitFor({state:'attached',timeout:60000});await page.waitForTimeout(500);
 check('Original gallery title present',await page.locator('#plaque h1').innerText()==='STARRY NIGHTRIDER');
 await page.screenshot({path:new URL('title.png',root).pathname});
 await page.getByRole('button',{name:'Step into the painting',exact:true}).click();
 await page.waitForTimeout(10000);check('Original ride transition completed',await page.locator('#hud').evaluate(e=>!e.classList.contains('hidden')));
 await page.screenshot({path:new URL('ride.png',root).pathname});
 await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');
 check('Original orb collection increases score',Number((await page.locator('#star-count').innerText()).replaceAll(',',''))>0);
 await page.screenshot({path:new URL('pedal.png',root).pathname});
 await page.keyboard.down('s');await page.waitForTimeout(1500);await page.keyboard.up('s');
 await page.keyboard.press('f');await page.waitForTimeout(200);check('Original walking toggle active',await page.locator('#btn-walk').evaluate(e=>e.classList.contains('on')));
 await page.screenshot({path:new URL('walk.png',root).pathname});
 await page.keyboard.press('f');await page.waitForTimeout(150);check('Original bicycle mode restored',await page.locator('#btn-walk').evaluate(e=>!e.classList.contains('on')));
 for(let n=0;n<3;n++){await page.keyboard.press('Space');await page.waitForTimeout(140);}await page.keyboard.down('Space');await page.waitForTimeout(1200);await page.keyboard.up('Space');
 check('Original flight cue shown',(await page.locator('#toast').innerText()).includes('Wings'));await page.screenshot({path:new URL('flight.png',root).pathname});
 await page.keyboard.press('t');check('Original theater mode active',await page.locator('#hud').evaluate(e=>e.classList.contains('theater')));await page.keyboard.press('t');
 await page.keyboard.press('Escape');await page.waitForTimeout(6000);
 await page.getByRole('button',{name:'Leaderboard',exact:true}).click();
 check('Local leaderboard opens',await page.locator('#board').evaluate(e=>!e.classList.contains('hidden')));
 const local=await page.evaluate(async()=>{
  const start=await (await fetch('/api/leaderboard',{method:'POST',body:JSON.stringify({action:'start'})})).json();
  const save=await (await fetch('/api/leaderboard',{method:'POST',body:JSON.stringify({handle:'local_test',score:123,token:start.token})})).json();
  const read=await (await fetch('/api/leaderboard')).json();return {start,save,read,diagnostics:window.__localReproduction};
 });
 check('Local scoreboard persists within isolated browser',local.save.ok&&local.read.top.some(r=>r.handle==='local_test'&&r.score===123));
 check('No external HTTP requests',requests.every(u=>u.startsWith('http://127.0.0.1:5178/')));
 check('No live WebSocket connections',sockets.length===0);
 check('No browser errors',errors.length===0);
 await fs.writeFile(new URL('local-api-check.json',root),JSON.stringify(local,null,2));
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const mobile=await mobileContext.newPage();mobile.on('request',r=>requests.push(r.url()));mobile.on('pageerror',e=>errors.push(String(e)));
 await mobile.goto('http://127.0.0.1:5178/',{waitUntil:'networkidle'});await mobile.locator('#loading.done').waitFor({state:'attached'});await mobile.screenshot({path:new URL('mobile-title.png',root).pathname});
 check('Small-device images load locally',requests.some(u=>u.endsWith('/painting-s.webp'))&&requests.some(u=>u.endsWith('/sky-s.webp')));
 check('Mobile context also stays local and error-free',errors.length===0&&requests.every(u=>u.startsWith('http://127.0.0.1:5178/')));
 await mobileContext.close();
 const manifest=JSON.parse(await fs.readFile(new URL('../reproduction/asset-manifest.json',import.meta.url),'utf8'));
 for(const asset of manifest.assets){const bytes=await fs.readFile(new URL('../reproduction/public/'+asset.path,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);}
 check('All 120 public asset hashes match the manifest',manifest.assets.length===120);
}finally{
 await fs.writeFile(new URL('checks.json',root),JSON.stringify({checks,errors,requests,sockets},null,2));await browser.close();
}
console.log(JSON.stringify(checks));
