import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {makeWorld,makeRider} from './world';
import {createRider,step,orbPositions,delivery} from './simulation';
import './style.css';
const el=(id:string)=>document.getElementById(id)!;
try{init();}catch(error){el('error').hidden=false;el('error').textContent=`This prototype needs WebGL 2. ${String(error)}`;throw error;}
function init(){
  const renderer=new T.WebGLRenderer({canvas:el('scene'),antialias:true,powerPreference:'high-performance'});
  renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const scene=new T.Scene();scene.fog=new T.FogExp2('#1b2d52',.007);
  const camera=new T.PerspectiveCamera(66,innerWidth/innerHeight,.1,700);camera.position.set(4,3.8,12);
  const world=makeWorld(scene),rider=makeRider(scene);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.28,.5,1.1));composer.addPass(new OutputPass());
  const orbMat=new T.MeshBasicMaterial({color:new T.Color(3,2,.6)}),orbGeo=new T.IcosahedronGeometry(.14,1);
  const orbs=orbPositions.map(o=>{const m=new T.Mesh(orbGeo,orbMat);m.position.set(o.x,1.1,o.z);scene.add(m);return m;});
  const keys=new Set<string>();let state=createRider(),started=false,paused=false,theater=false,leap=false,look=0,pitch=.12,zoom=1,drag=false,lastX=0,lastY=0,elapsed=0,acc=0,last=performance.now(),lastHud=0,toastUntil=0;
  let taps:number[]=[];const frames:number[]=[];let audio:AudioContext|undefined,sound=false;
  const target=new T.Vector3(),desired=new T.Vector3(),ray=new T.Raycaster();
  // Camera collision proxies are separate from render geometry.
  const collisionMeshes=world.blocks.map(b=>{const m=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d));m.position.set(b.x,b.h/2,b.z);m.updateMatrixWorld();return m;});
  function toast(text:string){el('toast').textContent=text;el('toast').classList.add('on');toastUntil=elapsed+3;}
  function ping(f:number){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(f,audio.currentTime);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.35);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.36);}
  function toggleSound(){sound=!sound;if(sound){audio??=new AudioContext();void audio.resume();}el('sound').textContent=sound?'Sound on':'Sound off';ping(330);}
  function reset(){state=createRider();taps=[];look=0;pitch=.12;camera.position.set(0,3.8,12);toast('A new ride. Follow the lights to the steeple.');}
  function pause(){paused=!paused;keys.clear();el('pause').textContent=paused?'Resume':'Pause';}
  el('start').onclick=()=>{started=true;el('intro').style.display='none';document.body.classList.add('riding');el('start').blur();toast('W to pedal. Bring your light to the steeple.');};
  el('sound').onclick=toggleSound;el('reset').onclick=reset;el('pause').onclick=pause;
  addEventListener('keydown',e=>{
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;
    if(e.code==='KeyP')pause();if(e.code==='KeyM')toggleSound();if(e.code==='KeyR')reset();
    if(!started||paused)return;
    if(e.code==='KeyF'&&state.grounded){state.walking=!state.walking;state.speed=0;toast(state.walking?'On foot':'Back on the bicycle');}
    if(e.code==='KeyT'){theater=!theater;document.body.classList.toggle('theater',theater);}
    if(e.code==='Space'){leap=true;taps.push(performance.now());taps=taps.filter(t=>performance.now()-t<1100);if(taps.length>=3&&!state.walking){state.flying=true;state.grounded=false;state.vy=5;state.y=Math.max(.1,state.y);taps=[];toast('Flight · hold Space to climb, release to descend');}}
  });addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();leap=false;});
  const canvas=renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(drag){look-=(e.clientX-lastX)*.005;pitch=T.MathUtils.clamp(pitch+(e.clientY-lastY)*.003,-.25,.8);lastX=e.clientX;lastY=e.clientY;}});
  canvas.addEventListener('pointerup',()=>drag=false);canvas.addEventListener('pointercancel',()=>drag=false);
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=T.MathUtils.clamp(zoom+e.deltaY*.001,.6,2);},{passive:false});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
  const map=(el('map') as HTMLCanvasElement).getContext('2d')!;
  function hud(){
    el('carried').textContent=String(state.points);el('banked').textContent=String(state.banked);el('distance').textContent=`${Math.round(Math.hypot(state.x-delivery.x,state.z-delivery.z))} m`;
    el('mode').textContent=state.flying?'FLIGHT':state.walking?'ON FOOT':'BICYCLE';
    el('stats').textContent=`${Math.round(1000/(frames.slice(-60).reduce((a,b)=>a+b,0)/Math.min(frames.length,60)||16.7))} fps · ${(state.speed*3.6).toFixed(0)} km/h`;
    map.clearRect(0,0,160,160);map.fillStyle='#112b36';map.fillRect(0,0,160,160);map.strokeStyle='#899275';map.lineWidth=6;map.beginPath();map.moveTo(80,0);map.lineTo(80,160);for(const z of [35,75,115]){map.moveTo(0,z);map.lineTo(160,z);}map.stroke();
    map.fillStyle='#53647c';for(const b of world.blocks)map.fillRect(80+b.x*.9-b.w*.45,25+(b.z+100)*.9,b.w*.9,b.d*.9);
    map.fillStyle='#ffdd85';map.beginPath();map.arc(80,35,4,0,Math.PI*2);map.fill();map.save();map.translate(80+state.x*.9,25+(state.z+100)*.9);map.rotate(-state.yaw);map.fillStyle='#faf2d1';map.beginPath();map.moveTo(0,-6);map.lineTo(-4,5);map.lineTo(4,5);map.closePath();map.fill();map.restore();
  }
  function frame(now:number){requestAnimationFrame(frame);const raw=(now-last)/1000;last=now;frames.push(raw*1000);if(frames.length>3600)frames.shift();const dt=Math.min(raw,.05);elapsed+=dt;
    if(started&&!paused){acc+=dt;while(acc>=1/60){const events=step(state,{throttle:+(keys.has('KeyW')||keys.has('ArrowUp')),brake:+(keys.has('KeyS')||keys.has('ArrowDown')),steer:+(keys.has('KeyD')||keys.has('ArrowRight'))-+(keys.has('KeyA')||keys.has('ArrowLeft')),jump:keys.has('Space'),leap,trick:keys.has('KeyE')},1/60,world.blocks);leap=false;acc-=1/60;for(const e of events){if(e==='orb')ping(550+state.collected.size*22);if(e==='delivery'){ping(880);toast(`Delivered ${state.banked} light. Reset to ride again.`);}if(e==='trick'){ping(660);toast('Air trick +50');}}}}
    rider.root.position.set(state.x,state.y,state.z);rider.root.rotation.set(0,state.yaw+state.spin,0);rider.bike.visible=!state.walking;rider.body.position.y=state.walking?-.4:0;
    rider.legs.forEach((l,n)=>l.rotation.x=Math.sin(state.distance*(state.walking?4:3)+n*Math.PI)*.55);
    rider.root.rotation.z=-(keys.has('KeyA')?-.1:keys.has('KeyD')?.1:0)*Math.min(1,state.speed/4);
    orbs.forEach((m,i)=>{m.visible=!state.collected.has(i)&&!theater;m.position.y=1.1+Math.sin(elapsed*2+i)*.1;});
    target.set(state.x,state.y+2.05,state.z);const yaw=state.yaw+look,dist=(5.8+state.speed*.1+(state.flying?3:0))*zoom;
    desired.set(state.x+Math.sin(yaw)*dist,state.y+3+pitch*dist,state.z+Math.cos(yaw)*dist);
    const direction=desired.clone().sub(target);ray.set(target,direction.clone().normalize());ray.far=direction.length();const hits=ray.intersectObjects(collisionMeshes);if(hits.length)desired.copy(target).addScaledVector(direction.normalize(),Math.max(1,hits[0].distance-.5));
    camera.position.lerp(desired,1-Math.exp(-6*dt));camera.lookAt(target);camera.fov=T.MathUtils.lerp(camera.fov,66+state.speed*.8,1-Math.exp(-3*dt));camera.updateProjectionMatrix();
    world.sky.position.copy(camera.position);world.skyMat.uniforms.time.value=elapsed;world.dust.position.y=Math.sin(elapsed*.4)*.2;
    if(elapsed>toastUntil)el('toast').classList.remove('on');if(elapsed-lastHud>.15){hud();lastHud=elapsed;}
    renderer.info.reset();composer.render();
  }
  requestAnimationFrame(frame);
  // Read-only telemetry for local reproducible tests. No original runtime internals used.
  Object.defineProperty(window,'__prototype',{value:{snapshot:()=>({...state,collected:[...state.collected],paused,started,look,pitch,zoom,camera:camera.position.toArray(),frames:[...frames],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures})}});
}
