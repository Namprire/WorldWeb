import {instrument} from './instrument.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root = new URL('../evidence/', import.meta.url);
await fs.mkdir(new URL('raw/', root), {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
const page = await context.newPage();
const network=[], blocked=[], errors=[], tasks=[], sockets=[];
await context.route('**/*', async route=>{
  const r=route.request(), url=r.url();
  if(!['GET','HEAD'].includes(r.method()) || /vercel-insights|vercel-scripts|analytics/.test(url)) {
    blocked.push({url,method:r.method(),reason:'study blocks writes and analytics'}); return route.abort();
  }
  return route.continue();
});
await page.routeWebSocket('**/*', ws=>{sockets.push({url:ws.url(),policy:'connection not forwarded; no server traffic'});});
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>tasks.push((async()=>{
  const url=r.url(), headers=await r.allHeaders(), row={url,status:r.status(),type:r.request().resourceType(),mime:headers['content-type'],contentLength:headers['content-length']??null};
  if(url.startsWith('https://starrynightrider.com/') && !url.includes('/api/') && r.status()===200) {
    try {const b=await r.body(); row.decodedBytes=b.length; row.sha256=crypto.createHash('sha256').update(b).digest('hex');
    const name=new URL(url).pathname.split('/').pop()||'index.html'; row.local='raw/'+name; await fs.writeFile(new URL(row.local,root),b);}catch(e){row.bodyError=String(e);}
  }
  network.push(row);
})()));
await page.addInitScript(instrument);
const started=new Date().toISOString();
await page.goto('https://starrynightrider.com/',{waitUntil:'networkidle',timeout:60000});
await page.locator('#loading.done').waitFor({timeout:60000});
await page.screenshot({path:new URL('original-title.png',root).pathname});
await fs.writeFile(new URL('runtime-dom.html',root),await page.content());
await page.getByRole('button',{name:'Step into the painting',exact:true}).click();
await page.waitForTimeout(10000);
const observations=[];
async function sample(label){observations.push({label,...await page.evaluate(()=>({t:performance.now(),hud:document.querySelector('#hud')?.innerText,heap:performance.memory?.usedJSHeapSize}))}); await page.screenshot({path:new URL(`original-${label}.png`,root).pathname});}
await sample('ride');
await page.keyboard.down('w');await page.waitForTimeout(3000);await page.keyboard.up('w');await sample('pedal');
await page.keyboard.down('d');await page.waitForTimeout(1000);await page.keyboard.up('d');await sample('turn');
await page.keyboard.press('Space');await page.waitForTimeout(300);await sample('jump');
await page.waitForTimeout(1500);await page.keyboard.press('f');await sample('walk');
await page.keyboard.press('f');for(let i=0;i<3;i++){await page.keyboard.press('Space');await page.waitForTimeout(150);}await page.keyboard.down('Space');await page.waitForTimeout(1800);await page.keyboard.up('Space');await sample('flight');
await page.keyboard.press('t');await sample('theater');
const runtime=await page.evaluate(()=>({capture:window.__study,navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>e.toJSON()),userAgent:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize,limit:performance.memory.jsHeapSizeLimit}:null}));
await Promise.all(tasks);
await fs.writeFile(new URL('network.json',root),JSON.stringify({started,network,blocked,sockets,errors},null,2));
await fs.writeFile(new URL('runtime.json',root),JSON.stringify(runtime,null,2));
await fs.writeFile(new URL('observations.json',root),JSON.stringify(observations,null,2));
await browser.close();
console.log(JSON.stringify({resources:network.length,blocked:blocked.length,sockets,errors,shaderCount:runtime.capture.shaders.length,heap:runtime.heap}));
