import {chromium} from 'playwright';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {applyPhotographicBuildings} from './launch-photographic-buildings.mjs';

const noUI=process.argv.includes('--no-ui');
const root=`assets/launch-startup-city/night-cinematics${noUI?'-clean':''}`;
const base=process.env.STARTUP_CITY_URL||'http://10.0.40.63:5179/';
for(const dir of ['video','screenshots','source'])await mkdir(`${root}/${dir}`,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:`${root}/source`,size:{width:1920,height:1080}}});
const p=await context.newPage(),origin=Date.now(),clips=[],screenshots=[],errors=[];
await p.routeWebSocket('**/*',s=>s.close());
await p.route('**/__launch/facade.png',r=>r.fulfill({path:'assets/launch-startup-city/materials/helsinki-photographic-facade.png',contentType:'image/png'}));
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text())});
const wait=ms=>p.waitForTimeout(ms);
async function still(name,description){await p.screenshot({path:`${root}/screenshots/${name}.png`});screenshots.push({file:`screenshots/${name}.png`,description});console.log('Screenshot:',name)}
async function take(name,description,action){console.log('Recording:',name);const start=(Date.now()-origin)/1000;await action();clips.push({file:`video/${name}.mp4`,description,start,duration:(Date.now()-origin)/1000-start})}
async function pose(target){await p.evaluate(target=>{const s=window.__startupCity.scene;s.setCinematic(true);s.flyTo(target,1.3);s.drift={yaw:0,dist:0,pitch:0}},target);await wait(2200)}
function command(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr)}
let treatment;
try{
  await p.goto(`${base}?nointro&q=1`);await p.waitForFunction(()=>window.__startupCity?.scene&&window.__startupCity.store.getState().loaded);
  await p.waitForFunction(()=>Number(getComputedStyle(document.getElementById('loading')).opacity)<.01);await p.evaluate(()=>document.fonts.ready);
  await p.addStyleTag({content:'#toast{display:none!important} #map-attribution{display:block!important;visibility:visible!important;z-index:9999!important} body.sc-clean #sc-markers,body.sc-clean #sc-overlay{display:none!important}'});
  await p.evaluate(()=>{const s=window.__startupCity.scene;s.adaptResolution=()=>{};s.e.state.quality=1;window.dispatchEvent(new Event('resize'));window.__startupCity.store.getState().setTime({live:false,minutes:23*60,season:'today',lapse:false})});
  treatment=await p.evaluate(applyPhotographicBuildings);console.log('Treatment:',JSON.stringify(treatment));
  await p.evaluate(()=>{const s=window.__startupCity.scene;s.e.state.titleStillReady=false;});await wait(1800);await p.mouse.move(1910,1050);
  if(noUI){
    await p.click('#enter');await p.waitForFunction(()=>window.__startupCity.scene.e.state.state==='free',null,{timeout:45000});await wait(3000);
    await p.addStyleTag({content:'body > :not(#gl):not(#map-attribution),body > :not(#gl):not(#map-attribution) *{display:none!important;visibility:hidden!important;pointer-events:none!important} #map-attribution{display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;left:8px!important;bottom:6px!important;z-index:99999!important}'});
    await p.evaluate(()=>{document.body.classList.add('sc-clean');window.__startupCity.scene.glowGroup.visible=false});
    await pose({tx:0,tz:-15,dist:260,pitch:.28,yaw:.05});
    await take('01-night-city-reveal','UI-free night city reveal beneath the northern lights.',async()=>{
      await p.evaluate(()=>{window.__startupCity.scene.flyTo({tx:0,tz:-15,dist:330,pitch:.23,yaw:.32},7)});await wait(3500);await still('01-clean-night-city','Night city without title, HUD, labels or controls.');await wait(4500);
    });
  }else{
    await still('01-photographic-night-title','Night title with photographic facade materials and physical architectural details.');
    await take('01-night-title-reveal','The framed night city becomes the live explorer under the northern lights.',async()=>{
      await wait(1500);await p.click('#enter');await p.waitForFunction(()=>window.__startupCity.scene.e.state.state==='free',null,{timeout:45000});await wait(3000);
    });
  }
  await p.evaluate(()=>{document.body.classList.add('sc-clean');const s=window.__startupCity.scene;s.glowGroup.visible=false;});
  await pose({tx:0,tz:50,dist:440,pitch:.22,yaw:-.7});
  await take('02-aurora-skyline-sweep','Slow sweeping skyline shot beneath the animated northern lights.',async()=>{
    await p.evaluate(()=>{window.__startupCity.scene.drift={yaw:.042,dist:-.012,pitch:.002}});await wait(5000);await still('02-aurora-skyline','Northern lights and the photographic city skyline.');await wait(5000);
  });
  await pose({tx:-90,tz:20,dist:85,pitch:.23,yaw:.65});
  await take('03-night-architecture-orbit','Close orbit of the station: photographic plaster, glazing, projecting stone sills and cornices.',async()=>{
    await p.evaluate(()=>{window.__startupCity.scene.drift={yaw:.045,dist:0,pitch:0}});await wait(3500);await still('03-night-architecture-detail','Physical window ledges and photographic facade details at night.');await wait(5500);
  });
  await pose({tx:-80,tz:10,dist:220,pitch:.43,yaw:.05});
  await take('04-night-rooftop-glide','Smooth camera glide across the illuminated buildings and rooftops.',async()=>{
    await p.evaluate(()=>{window.__startupCity.scene.flyTo({tx:130,tz:-100,dist:175,pitch:.32,yaw:.7},8)});await wait(4500);await still('04-night-rooftops','Illuminated facades during the rooftop glide.');await wait(5500);
  });
  await pose({tx:0,tz:-15,dist:160,pitch:.28,yaw:-.4});
  await take('05-night-city-rise','A rising reveal from the architectural square to the whole luminous city.',async()=>{
    await p.evaluate(()=>{window.__startupCity.scene.flyTo({tx:-250,tz:50,dist:1400,pitch:.65,yaw:-.1},9)});await wait(5500);await still('05-night-city-rise','Cinematic rising view over Helsinki.');await wait(5500);await still('06-night-city-panorama','The full night city at the end of the rising reveal.');
  });
  const video=p.video();await context.close();const source=`${root}/source/photographic-night-session.webm`;await rename(await video.path(),source);
  for(const clip of clips){command(['-ss',clip.start.toFixed(3),'-i',source,'-t',clip.duration.toFixed(3),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',`${root}/${clip.file}`]);console.log('Exported:',clip.file)}
  // A launch-ready silent reel, with brief dissolves between the camera moves.
  const inputs=clips.flatMap(c=>['-i',`${root}/${c.file}`]);let filters='',previous='0:v',offset=clips[0].duration;
  for(let i=1;i<clips.length;i++){offset-=.65;filters+=`${previous.startsWith('[')?previous:`[${previous}]`}[${i}:v]xfade=transition=fade:duration=0.65:offset=${offset.toFixed(3)}[v${i}];`;previous=`[v${i}]`;offset+=clips[i].duration;}
  command([...inputs,'-filter_complex',filters.slice(0,-1),'-map',previous,'-an','-c:v','libx264','-preset','fast','-b:v','14M','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',`${root}/night-launch-reel.mp4`]);console.log('Exported: night-launch-reel.mp4');
}finally{
  await browser.close();await writeFile(`${root}/manifest.json`,JSON.stringify({source:base,capturedAt:new Date().toISOString(),width:1920,height:1080,fps:30,audio:false,noUI,treatment,clips,screenshots,errors,note:'Cinematic promotional rendering with AI-generated facade texture and additional physical architectural details; capture-browser only, not current gameplay graphics.'},null,2));
}
if(errors.length)throw new Error(errors.join('\n'));
console.log('Night cinematics complete.');
