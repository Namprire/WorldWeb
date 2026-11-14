import * as T from 'three';
import type {Block} from './simulation';

// Seeded, original textures and geometry; no downloaded game materials.
let seed=741;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function paintedTexture(kind:'stone'|'roof'|'ground'){
  const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d')!;
  g.fillStyle=kind==='ground'?'#333c59':kind==='stone'?'#333e57':'#243961';g.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=kind==='roof'?14:32)for(let x=0;x<512;x+=kind==='roof'?9:42){
    const xx=x+((y/32)%2)*18,j=random();
    g.save();g.translate(xx,y);g.rotate((random()-.5)*.4);
    g.fillStyle=kind==='roof'?`hsl(${215+j*25} 35% ${22+j*24}%)`:`hsl(${kind==='ground'?240+j*35:210+j*35} ${12+j*14}% ${25+j*22}%)`;
    g.beginPath();g.ellipse(0,0,kind==='roof'?3:15+random()*5,kind==='roof'?17:9+random()*4,0,0,Math.PI*2);g.fill();
    g.strokeStyle='#b6bdd62a';g.lineWidth=2;g.beginPath();g.moveTo(-8,-4);g.lineTo(8,-6);g.stroke();g.restore();
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;
}
const material=(color:T.ColorRepresentation,map?:T.Texture)=>new T.MeshStandardMaterial({color,map,roughness:1});
export function makeWorld(scene:T.Scene){
  const blocks:Block[]=[];
  const stone=material('#b5b7d0',paintedTexture('stone')),roof=material('#a5b9ed',paintedTexture('roof'));
  const groundTex=paintedTexture('ground');groundTex.repeat.set(22,28);
  const ground=new T.Mesh(new T.PlaneGeometry(240,240),material('#9296b8',groundTex));ground.rotation.x=-Math.PI/2;ground.position.z=-40;ground.receiveShadow=true;scene.add(ground);
  const grass=material('#172f35');
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,parent:T.Object3D=scene)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
  const gold=new T.MeshBasicMaterial({color:new T.Color(1.3,.85,.28)});
  for(let row=0;row<9;row++)for(const side of [-1,1]){
    const x=side*(12+random()*2),z=12-row*13,h=4+random()*4,w=7+random()*2,d=8;
    blocks.push({x,z,w,d,h:h+3});box(x,h/2,z,w,h,d,stone);
    const r=new T.Mesh(new T.ConeGeometry(1,1,4),roof);r.position.set(x,h+1.8,z);r.scale.set(w*.79,3.6,d*.79);r.rotation.y=Math.PI/4;r.castShadow=true;scene.add(r);
    box(x+2,h+3,z+1,.65,2,.65,stone);
    for(const level of [1.5,3.4]){if(level>h-.5)continue;for(const off of [-2,1.7]){box(x-side*(w/2+.02),level,z+off,.05,.9,.65,gold);box(x-side*(w/2+.07),level,z+off,.06,1.05,.06,material('#272b42'));}}
    const garden=box(x+side*13,.03,z,16,.05,10,grass);garden.receiveShadow=true;
  }
  // Cross streets and an original church silhouette at the end of the route.
  box(0,5,-102,12,10,13,stone);blocks.push({x:0,z:-102,w:12,d:13,h:10});
  box(0,9,-96,3.8,18,3.8,stone);
  const spire=new T.Mesh(new T.ConeGeometry(3,11,4),roof);spire.position.set(0,23,-96);spire.rotation.y=Math.PI/4;scene.add(spire);
  box(0,2,-95.4,2,4,.2,gold);
  const deliveryRing=new T.Mesh(new T.TorusGeometry(3,.07,8,64),gold);deliveryRing.rotation.x=-Math.PI/2;deliveryRing.position.set(0,.08,-89);scene.add(deliveryRing);
  for(let n=0;n<35;n++){
    const x=(n%2?1:-1)*(24+random()*50),z=35-random()*160,h=6+random()*10;
    const tree=new T.Mesh(new T.ConeGeometry(1.3+random(),h,7),material(n%2?'#153f3c':'#162f39'));tree.position.set(x,h/2,z);tree.scale.z=.8;scene.add(tree);
  }
  for(let n=0;n<14;n++){
    const x=(n%2?1:-1)*5.9,z=4-Math.floor(n/2)*15;
    box(x,1.6,z,.09,3.2,.09,material('#172337'));box(x,3.3,z,.4,.6,.4,gold);
    const lamp=new T.PointLight('#ffd393',15,11,2);lamp.position.set(x,3.2,z);scene.add(lamp);
  }
  for(let n=0;n<16;n++){
    const hill=new T.Mesh(new T.SphereGeometry(1,24,12),material(n%2?'#213f68':'#2a4875'));hill.position.set(-190+n*25,-8,-180-random()*30);hill.scale.set(40,15+random()*17,28);scene.add(hill);
  }
  scene.add(new T.HemisphereLight('#a8c2ff','#252746',2.2));
  const moon=new T.DirectionalLight('#adc9ff',2);moon.position.set(-30,55,-70);scene.add(moon);
  // A bespoke sky shader: flowing strokes and sparse ringed stars.
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time:{value:0}},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`
    precision highp float; varying vec3 direction; uniform float time;
    float hash(vec2 p){return fract(sin(dot(p,vec2(41.31,289.9)))*43758.54);}
    void main(){vec3 d=normalize(direction);vec2 uv=vec2(atan(d.z,d.x),asin(d.y));
      float flow=sin(uv.x*3.2+sin(uv.y*5.0)+time*.015)+cos(uv.y*7.0-uv.x*2.0);
      vec2 curl=uv-vec2(-1.5,.45); float spiral=sin(length(curl)*24.0+atan(curl.y,curl.x)*2.0);
      float brush=pow(.5+.5*sin(uv.y*102.0+flow*9.0+spiral*3.0+sin(uv.x*37.0)*.8),3.0);
      vec3 col=mix(vec3(.025,.055,.17),vec3(.13,.28,.51),clamp(d.y+.35,0.,1.));
      col+=brush*vec3(.05,.105,.15)*(0.5+0.5*sin(uv.x*4.0+uv.y*3.0));
      vec2 grid=uv*vec2(6.,7.);vec2 cell=floor(grid),q=fract(grid)-.5;
      float star=step(.79,hash(cell))*step(.06,d.y);float r=length(q);
      col+=star*(exp(-r*r*140.)*vec3(1.5,1.15,.36)+exp(-r*12.)*(.65+.35*sin(r*80.))*vec3(.4,.42,.18));
      vec3 md=normalize(vec3(-.5,.63,-1.));float m=length(d-md);
      col+=exp(-m*m*700.)*vec3(2.,1.65,.65)+exp(-m*15.)*(.65+.35*sin(m*190.))*vec3(.45,.44,.18);
      gl_FragColor=vec4(col,1.);
    }`});
  const sky=new T.Mesh(new T.SphereGeometry(480,40,24),skyMat);scene.add(sky);
  const pos=new Float32Array(180*3);for(let n=0;n<180;n++){pos[n*3]=(random()-.5)*90;pos[n*3+1]=.5+random()*7;pos[n*3+2]=40-random()*160;}
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.BufferAttribute(pos,3));
  const dust=new T.Points(geom,new T.PointsMaterial({color:'#e2c87b',size:.065,transparent:true,opacity:.65}));scene.add(dust);
  return {blocks,skyMat,sky,dust};
}
export function makeRider(scene:T.Scene){
  const root=new T.Group(),bike=new T.Group(),body=new T.Group();root.add(bike,body);scene.add(root);
  const metal=material('#d7ad67'),rubber=material('#111b2a'),coat=material('#306eb0'),skin=material('#c89463'),pants=material('#293947');
  function rod(a:T.Vector3,b:T.Vector3,r:number,mat:T.Material,parent:T.Object3D){const delta=b.clone().sub(a);const m=new T.Mesh(new T.CylinderGeometry(r,r,delta.length(),7),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());parent.add(m);return m;}
  const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
  const wheels:T.Mesh[]=[];
  for(const z of [-.72,.72]){const wheel=new T.Mesh(new T.TorusGeometry(.43,.055,8,24),rubber);wheel.rotation.y=Math.PI/2;wheel.position.set(0,.46,z);bike.add(wheel);wheels.push(wheel);for(let n=0;n<8;n++){const a=n*Math.PI/4;rod(v(0,.46,z),v(0,.46+Math.sin(a)*.4,z+Math.cos(a)*.4),.008,metal,bike);}}
  for(const [a,b] of [[v(0,.46,.72),v(0,1.05,.2)],[v(0,1.05,.2),v(0,.46,0)],[v(0,.46,0),v(0,.46,.72)],[v(0,.46,0),v(0,1.06,-.55)],[v(0,1.05,.2),v(0,1.06,-.55)],[v(0,1.06,-.55),v(0,.46,-.72)]])rod(a,b,.035,metal,bike);
  rod(v(0,1.06,-.55),v(0,1.28,-.58),.025,metal,bike);rod(v(-.3,1.28,-.58),v(.3,1.28,-.58),.025,metal,bike);
  const torso=new T.Mesh(new T.CapsuleGeometry(.23,.42,5,10),coat);torso.position.set(0,1.5,.06);torso.rotation.x=-.2;body.add(torso);
  const head=new T.Mesh(new T.SphereGeometry(.18,12,10),skin);head.position.set(0,2.04,-.08);body.add(head);
  const hat=new T.Mesh(new T.CylinderGeometry(.32,.32,.055,16),material('#d7b35e'));hat.position.set(0,2.17,-.08);body.add(hat);
  const crown=new T.Mesh(new T.CylinderGeometry(.19,.21,.16,12),hat.material);crown.position.set(0,2.25,-.08);body.add(crown);
  const scarf=new T.Mesh(new T.BoxGeometry(.31,.12,.36),material('#d27542'));scarf.position.set(0,1.87,.13);body.add(scarf);
  const legs:T.Group[]=[];
  for(const s of [-1,1]){rod(v(s*.22,1.7,0),v(s*.3,1.28,-.58),.07,coat,body);const leg=new T.Group();leg.position.set(s*.14,1.21,.12);rod(v(0,0,0),v(0,-.65,.16),.09,pants,leg);body.add(leg);legs.push(leg);}
  return {root,bike,body,wheels,legs};
}
