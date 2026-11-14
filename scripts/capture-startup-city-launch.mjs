import { chromium } from 'playwright';
import { mkdir, rename, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { applyVideoBuildingTreatment } from './launch-building-treatment.mjs';

const root = 'assets/launch-startup-city';
const base = process.env.STARTUP_CITY_URL || 'http://10.0.40.63:5179/';
for (const sub of ['screenshots','video','source']) await mkdir(`${root}/${sub}`, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const clips=[], screenshots=[], errors=[];
const resume=process.argv.includes('--resume');
if(resume && existsSync(`${root}/manifest.json`)) {
  const previous=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
  clips.push(...previous.clips);screenshots.push(...previous.screenshots);
}
let failure=null;
const wait=(p,ms)=>p.waitForTimeout(ms);
async function open(name,{enhanced=false,day=false}={}) {
  const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,
    recordVideo:{dir:`${root}/source`,size:{width:1920,height:1080}}});
  const p=await context.newPage();const origin=Date.now();
  // Keep Vite hot reload from replacing the scene midway through a take.
  // This isolated recording page needs only HTTP reads, not live sockets.
  await p.routeWebSocket('**/*',socket=>socket.close());
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error' && /shader|WebGL|GL_INVALID/i.test(m.text()))errors.push(m.text());});
  await p.goto(`${base}?nointro&q=1`);
  await p.waitForFunction(()=>window.__startupCity?.scene && window.__startupCity.store.getState().loaded);
  await p.waitForFunction(()=>Number(getComputedStyle(document.getElementById('loading')).opacity)<.01);
  await p.evaluate(()=>document.fonts.ready);
  await p.addStyleTag({content:'#toast {display:none!important} #map-attribution {display:block!important;visibility:visible!important;z-index:9999!important}'});
  await p.evaluate(day=>{
    const s=window.__startupCity.scene;
    s.adaptResolution=()=>{};s.e.state.quality=1;window.dispatchEvent(new Event('resize'));
    window.__startupCity.store.getState().setTime({live:false,minutes:day?17*60:23*60,season:day?'summer':'today',lapse:false});
  },day);
  const treatment=enhanced?await p.evaluate(applyVideoBuildingTreatment):null;
  await wait(p,2000);
  return {p,context,name,origin,segments:[],enhanced,day,treatment};
}
async function shot(s,name,description) {
  await s.p.mouse.move(1910,1050);
  await s.p.screenshot({path:`${root}/screenshots/${name}.png`});
  screenshots.push({file:`screenshots/${name}.png`,description,enhanced:s.enhanced,day:s.day});
  console.log('Screenshot:',name);
}
async function record(s,name,description,action) {
  console.log('Recording:',name);
  const start=(Date.now()-s.origin)/1000;
  await action();
  s.segments.push({file:`video/${name}.mp4`,description,start,duration:(Date.now()-s.origin)/1000-start,enhanced:s.enhanced,day:s.day});
}
async function enter(s) {
  await s.p.click('#enter');
  await s.p.waitForFunction(()=>window.__startupCity.scene.e.state.state==='free',null,{timeout:45000});
  await wait(s.p,3000);
}
async function camera(s,pose,duration=1) {
  await s.p.evaluate(({pose,duration})=>{
    const s=window.__startupCity.scene;s.setCinematic(true);s.flyTo(pose,duration);
  },{pose,duration});
  await wait(s.p,duration*1000+700);
}
async function close(s) {
  const video=s.p.video();await s.context.close();
  const source=`${root}/source/${s.name}.webm`;await rename(await video.path(),source);
  for(const clip of s.segments) {
    const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',clip.start.toFixed(3),'-i',source,'-t',clip.duration.toFixed(3),'-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-r','30','-movflags','+faststart',`${root}/${clip.file}`],{encoding:'utf8'});
    if(r.status!==0)throw new Error(r.stderr);
    clips.push({...clip,source:`source/${s.name}.webm`});console.log('Exported:',clip.file);
  }
}
try {
  if(!resume || !existsSync(`${root}/video/02-original-startup-profile.mp4`)) {
  const original=await open('original-game-night');
  await shot(original,'03-original-night-title','Unmodified Startup City night title.');
  await record(original,'01-original-night-title-to-city','Original running game: night title into the full city explorer.',async()=>{await wait(original.p,1200);await enter(original);});
  await shot(original,'04-original-city-interface','Original city explorer and startup markers.');
  await record(original,'02-original-startup-profile','Original game interface: focus a startup, open its profile, show connections.',async()=>{
    await original.p.evaluate(()=>{const store=window.__startupCity.store.getState();const company=store.startups.find(c=>c.id==='verda'&&c.location)||store.startups.find(c=>c.location);store.select(company.location.buildingId,company.id,false);});
    await wait(original.p,3000);await shot(original,'05-original-startup-profile','Real startup profile in the running game.');
    await original.p.evaluate(()=>window.__startupCity.store.getState().toggleConnections());await wait(original.p,3000);
    await shot(original,'06-original-startup-connections','Real company connections overlay.');await wait(original.p,2000);
  });
  await close(original);
  }

  if(!resume || !existsSync(`${root}/video/05-enhanced-night-building-orbit.mp4`)) {
  const night=await open('enhanced-night',{enhanced:true});
  await shot(night,'07-enhanced-night-title','Night title with video-only architectural facade treatment.');
  await record(night,'03-enhanced-night-title-to-city','Video-only architectural finish: night title-to-city transition.',async()=>{await wait(night.p,1200);await enter(night);});
  await camera(night,{tx:0,tz:-15,dist:440,pitch:.42,yaw:-.5});
  await record(night,'04-enhanced-night-flyover','Night skyline flyover with cleaner facades and northern lights.',async()=>{
    await night.p.evaluate(()=>{const s=window.__startupCity.scene;s.drift={yaw:.055,dist:-.018,pitch:0};});
    await wait(night.p,4000);await shot(night,'08-enhanced-night-skyline','Northern lights above the architectural night skyline.');await wait(night.p,5000);
  });
  await camera(night,{tx:0,tz:-15,dist:150,pitch:.27,yaw:-.4});
  await record(night,'05-enhanced-night-building-orbit','Close night orbit: sharp window frames, roof seams and restrained warm interiors.',async()=>{
    await night.p.evaluate(()=>{window.__startupCity.scene.drift={yaw:.07,dist:0,pitch:0};});
    await wait(night.p,3000);await shot(night,'09-enhanced-night-architecture','Closer view of the video-only night building treatment.');await wait(night.p,5000);
  });
  await close(night);
  }

  if(!resume || !existsSync(`${root}/video/07-enhanced-day-building-orbit.mp4`)) {
  const day=await open('enhanced-summer-afternoon',{enhanced:true,day:true});await enter(day);
  await camera(day,{tx:0,tz:-15,dist:440,pitch:.5,yaw:-.6});
  await record(day,'06-enhanced-day-city-flyover','Summer-afternoon flyover of the new map with architectural facades.',async()=>{
    await day.p.evaluate(()=>{window.__startupCity.scene.drift={yaw:.05,dist:-.018,pitch:0};});
    await wait(day.p,3000);await shot(day,'10-enhanced-day-city','Full city view under summer-afternoon lighting.');await wait(day.p,5000);
  });
  await camera(day,{tx:0,tz:-15,dist:145,pitch:.26,yaw:-.45});
  await record(day,'07-enhanced-day-building-orbit','Architectural close orbit: plaster facades, window detailing and metal roof seams.',async()=>{
    await day.p.evaluate(()=>{window.__startupCity.scene.drift={yaw:.065,dist:0,pitch:0};});
    await wait(day.p,3000);await shot(day,'11-enhanced-day-architecture','Closer architectural building view in afternoon light.');await wait(day.p,5000);
  });
  await close(day);
  }
} catch(error) {
  failure=error.message;
  throw error;
} finally {
  await browser.close();
  await writeFile(`${root}/manifest.json`,JSON.stringify({capturedAt:new Date().toISOString(),source:base,width:1920,height:1080,fps:30,audio:false,
    note:'Original and enhanced shots are explicitly labeled. Enhanced materials exist only in isolated capture browser pages. Remote branch and source files were not modified.',clips,screenshots,errors,failure},null,2));
}
if(errors.length)throw new Error(errors.join('\n'));
console.log(`Complete: ${clips.length} clips and ${screenshots.length} screenshots.`);
