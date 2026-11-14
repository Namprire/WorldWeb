// An isolated, video-only replacement material and architectural detail pass.
export async function applyPhotographicBuildings() {
  const s=window.__startupCity.scene, e=s.e;
  // CityScene raises parent heights to cover child parts for picking. Use the
  // original render geometry heights, otherwise trim would float above roofs.
  const sourceMap=await (await fetch('/data/helsinki/map.json')).json();
  const image=new Image();image.src='/__launch/facade.png';await image.decode();
  const texture=new e.Texture(image);texture.wrapS=texture.wrapT=1000;texture.anisotropy=Math.min(8,e.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;
  const root=e.scene.getObjectByName('Helsinki · OpenStreetMap'), materials=new Map();
  root.traverse(o=>{
    const old=o.material;if(!old?.fragmentShader?.includes('float kind = floor(vData.x'))return;
    if(!materials.has(old)) {
      const m=old.clone();m.uniforms={...old.uniforms,tArchitecturalFacade:{value:texture}};
      let shader='uniform sampler2D tArchitecturalFacade;\n'+old.fragmentShader;
      const marker='  if (kind == 15.0) {';
      shader=shader.replace(marker,`
  if(kind==1.0 || kind==2.0) {
    vec3 diffuse, specular;
    shade(vPos,vWorld,N,N,V,kind==1.0?64.0:42.0,0.0,diffuse,specular);
    vec3 surface; float glass=0.0; vec3 emitted=vec3(0.0);
    if(kind==1.0) {
      vec2 tUv=vUv/4.0;
      vec3 photograph=texture2D(tArchitecturalFacade,tUv).rgb;
      glass=smoothstep(.012,.065,photograph.b-photograph.r);
      vec3 tint=mix(vec3(.88,.87,.83),clamp(vColor*1.45,vec3(.45),vec3(1.2)),.42);
      surface=pow(photograph,vec3(2.2))*tint;
      // Recesses hold cool reflections; timber and stone remain matte.
      float fresnel=pow(1.0-max(dot(N,V),0.0),4.0);
      vec3 reflection=mix(vec3(.025,.043,.061),uAmbSky*.32,fresnel);
      surface=mix(surface,reflection,glass*.4);
      float lit=step(hash21(floor(vUv)+seed*71.0),fract(vData.w)*.85);
      vec2 f=fract(vUv);
      float curtain=.75+.25*sin(f.x*52.0);
      emitted=vec3(1.0,.72,.40)*glass*lit*uGlow*curtain*.72;
    } else {
      float seam=1.0-smoothstep(.012,.028,min(fract(vUv.x*1.6),1.0-fract(vUv.x*1.6)));
      float grain=vnoise(vUv*45.0+seed*14.0);
      surface=vColor*(.48+grain*.04)*(1.0-seam*.32);
    }
    float groundAO=mix(.58,1.0,smoothstep(0.0,3.5,vPos.y));
    vec3 col=surface*diffuse*.82*groundAO;
    // A restrained cool cinematic fill keeps the stone detail readable at night.
    col+=surface*vec3(.12,.15,.21)*clamp(uGlow,0.0,1.0)*groundAO;
    col+=specular*mix(.035,.28,glass);
    col+=emitted;
    float fog=pow(smoothstep(uFogRange.x,uFogRange.y,vDist),1.5);
    gl_FragColor=vec4(mix(max(col,vec3(0.0)),uFogColor,fog*.97),1.0);return;
  }
`+marker);
      m.fragmentShader=shader;m.name='Video only / photographic Helsinki facades';m.needsUpdate=true;materials.set(old,m);
    }
    o.material=materials.get(old);
  });
  // Real projecting sills, lintels, cornices, rain pipes and roof chimneys.
  const positions=[], normals=[], colors=[];
  function box(center,tangent,width,height,depth,color) {
    const tx=tangent[0],tz=tangent[1],nx=-tz,nz=tx;
    const corners=[];
    for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])corners.push([center[0]+tx*x*width/2+nx*z*depth/2,center[1]+y*height/2,center[2]+tz*x*width/2+nz*z*depth/2]);
    for(const [indices,n] of [[[0,2,3,1],[tz,0,-tx]],[[4,5,7,6],[-tz,0,tx]],[[0,4,6,2],[-tx,0,-tz]],[[1,3,7,5],[tx,0,tz]],[[0,1,5,4],[0,-1,0]],[[2,6,7,3],[0,1,0]]]) {
      for(const j of [0,1,2,0,2,3]){positions.push(...corners[indices[j]]);normals.push(...n);colors.push(...color);}
    }
  }
  let windows=0, buildings=0;
  for(const b of [...sourceMap.buildings.filter(b=>!b.detailedParts),...sourceMap.parts]) {
    const cx=(b.bounds[0]+b.bounds[2])/2,cz=(b.bounds[1]+b.bounds[3])/2;
    if(Math.hypot(cx,cz)>310 || b.h<6 || b.type==='cathedral')continue;
    buildings++;const top=b.h-(b.roofHeight||0),bottom=b.minHeight||0;
    for(const ring of b.rings) {
      let along=0;
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],d=ring[(i+1)%ring.length];const length=Math.hypot(d[0]-a[0],d[1]-a[1]);if(length<.01)continue;
        const tx=(d[0]-a[0])/length,tz=(d[1]-a[1])/length,nx=tz,nz=-tx;
        const point=(distance,y,out=0)=>[a[0]+tx*distance+nx*out,y,a[1]+tz*distance+nz*out];
        const cream=[.49,.46,.39], stone=[.33,.31,.27];
        // A doubled shallow course produces a visible eave profile.
        box(point(length/2,top-.12,.12),[tx,tz],length,.20,.35,cream);
        box(point(length/2,top-.36,.06),[tx,tz],length,.10,.22,stone);
        if(length>5)box(point(.18,(top+bottom)/2,.10),[tx,tz],.075,top-bottom,.09,[.12,.13,.13]);
        for(let row=0;row<Math.floor((top-bottom)/3.2);row++) {
          const y=bottom+(row+.5)*3.2;
          for(let cell=Math.ceil(along/3-.5);(cell+.5)*3<along+length-.65;cell++) {
            const at=(cell+.5)*3-along;if(at<.65)continue;
            box(point(at,y-1.18,.14),[tx,tz],1.62,.13,.42,cream);
            box(point(at,y+1.21,.08),[tx,tz],1.58,.10,.23,cream);
            // Slim projecting side mouldings catch the moving camera's light.
            for(const side of [-1,1])box(point(at+side*.66,y,.045),[tx,tz],.10,2.25,.13,cream);
            windows++;
          }
        }
        along+=length;
      }
    }
    if(b.h>10 && !b.roof && !(b.roofHeight>0) && b.rings[0]?.length>2) {
      const p=b.rings[0][0],q=b.rings[0][1];
      box([p[0]*.85+cx*.15,b.h+.65,p[1]*.85+cz*.15],[1,0],.9,1.3,.8,[.22,.12,.085]);
      box([p[0]*.85+cx*.15,b.h+1.33,p[1]*.85+cz*.15],[1,0],1.1,.13,1.0,[.12,.13,.13]);
    }
  }
  const geometry=new e.Geometry();geometry.setAttribute('position',new e.Attribute(new Float32Array(positions),3));geometry.setAttribute('normal',new e.Attribute(new Float32Array(normals),3));geometry.setAttribute('color',new e.Attribute(new Float32Array(colors),3));
  const material=new e.Material({vertexShader:`attribute vec3 color;varying vec3 vC;varying vec3 vN;varying vec3 vP;void main(){vC=color;vN=mat3(modelMatrix)*normal;vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}`,
    fragmentShader:`uniform vec3 uMoonDir;uniform vec3 uMoonCol;uniform vec3 uAmbSky;uniform vec3 uFogColor;uniform vec2 uFogRange;varying vec3 vC;varying vec3 vN;varying vec3 vP;void main(){vec3 N=normalize(vN);float sun=max(dot(N,uMoonDir),0.);vec3 c=vC*(uAmbSky*.55+uMoonCol*sun)*.82;float f=pow(smoothstep(uFogRange.x,uFogRange.y,distance(cameraPosition,vP)),1.5);gl_FragColor=vec4(mix(c,uFogColor,f*.97),1.);}`,
    uniforms:{uMoonDir:e.shared.uMoonDir,uMoonCol:e.shared.uMoonCol,uAmbSky:e.shared.uAmbSky,uFogColor:e.shared.uFogColor,uFogRange:e.shared.uFogRange},side:2});
  const details=new e.Mesh(geometry,material);details.name='Video-only physical architectural details';details.frustumCulled=false;e.scene.add(details);
  // Remove the linen finish from the video camera while retaining the same game.
  const post=e.post.composite;post.fragmentShader=post.fragmentShader.replace('col *= 1. + (.6*wx - .8*wy)*.022 + weave*.006;','col *= 1.0;');post.needsUpdate=true;
  return {texture:'AI-generated photographic facade',materials:materials.size,buildingsWithPhysicalDetails:buildings,windowsWithPhysicalDetails:windows};
}
