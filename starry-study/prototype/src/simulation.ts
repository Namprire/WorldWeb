// Original, simplified mechanics. Parameters are prototype design choices.
export interface Input {throttle:number; brake:number; steer:number; jump:boolean; leap:boolean; trick:boolean}
export interface Block {x:number; z:number; w:number; d:number; h:number}
export interface Rider {x:number;z:number;y:number;yaw:number;speed:number;vy:number;walking:boolean;flying:boolean;grounded:boolean;spin:number;trickActive:boolean;points:number;banked:number;collected:Set<number>;distance:number}
export const orbPositions=Array.from({length:20},(_,i)=>({x:Math.sin(i*.55)*1.8,z:-8-i*4}));
export const delivery={x:0,z:-89,radius:5};
export const createRider=():Rider=>({x:0,z:4,y:0,yaw:0,speed:0,vy:0,walking:false,flying:false,grounded:true,spin:0,trickActive:false,points:0,banked:0,collected:new Set(),distance:0});
export function step(s:Rider,i:Input,dt:number,blocks:Block[]=[]):string[] {
  const events:string[]=[];
  const top=s.walking?3.5:s.flying?12:10;
  s.speed+=i.throttle*(s.walking?7:6)*dt;
  s.speed*=Math.exp(-(i.brake?5:i.throttle?.3:1.1)*dt);
  s.speed=Math.max(0,Math.min(top,s.speed));
  s.yaw-=i.steer*(s.walking?2.6:1.6)*Math.min(1,.25+s.speed/3)*dt;
  const dx=-Math.sin(s.yaw)*s.speed*dt,dz=-Math.cos(s.yaw)*s.speed*dt;
  const nx=s.x+dx,nz=s.z+dz;
  const hit=blocks.some(b=>Math.abs(nx-b.x)<b.w/2+.5&&Math.abs(nz-b.z)<b.d/2+.5&&s.y<b.h);
  if(!hit){s.x=Math.max(-90,Math.min(90,nx));s.z=Math.max(-125,Math.min(50,nz));s.distance+=Math.hypot(dx,dz);}else{s.speed*=.6;}
  if(i.leap&&s.grounded){s.vy=6;s.grounded=false;events.push('leap');}
  if(s.flying){s.vy+=(i.jump?13:-4)*dt;s.vy=Math.max(-5,Math.min(6,s.vy));}
  else s.vy-=15*dt;
  s.y+=s.vy*dt;
  if(i.trick&&!s.grounded&&!s.walking&&!s.flying)s.trickActive=true;
  if(s.trickActive)s.spin+=7*dt;
  if(s.y<=0){s.y=0;s.vy=0;if(!s.grounded){events.push('land');if(s.trickActive&&s.spin>Math.PI){s.points+=50;events.push('trick');}}s.grounded=true;s.flying=false;s.spin=0;s.trickActive=false;}
  if(s.y>24){s.y=24;s.vy=Math.min(0,s.vy);}
  orbPositions.forEach((o,n)=>{if(!s.collected.has(n)&&Math.hypot(s.x-o.x,s.z-o.z)<2.2&&s.y<2.5){s.collected.add(n);s.points+=10;events.push('orb');}});
  if(Math.hypot(s.x-delivery.x,s.z-delivery.z)<delivery.radius&&s.y<2&&s.points>0){s.banked+=s.points;s.points=0;events.push('delivery');}
  return events;
}
