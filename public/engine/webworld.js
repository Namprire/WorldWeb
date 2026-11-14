import { installCitizens } from "./helsinki-citizens.js";
/* WEBWORLD scene additions. Uses the original renderer, terrain and frame loop. */
import { installHelsinki } from "./helsinki.js";
import { installHelsinkiMap } from "./helsinki-real-map.js";
import { project } from "./helsinki-geography.js";
import { installStudent } from "./student-scooter.js";
import { installOilPaint } from "./oil-paint/surface.js";

export function installWebworld(engine) {
  engine.state.titleStillReady = false;
  const oilPaint = installOilPaint(engine);
  const visuals = installHelsinki(engine, oilPaint);
  const district = installHelsinkiMap(engine, visuals.helpers, oilPaint.atlas);
  const citizens = installCitizens(engine, visuals.helpers);
  const updateStudent = installStudent(engine, visuals.helpers);
  const { Group, Mesh, Geometry, Attribute, Material, Texture, scene, shared } =
    engine;
  const subscribers = new Set();
  const world = new Group();
  world.name = "WEBWORLD Helsinki discovery exhibition";
  scene.add(world);
  const positions = district.locations;
  const point = (gx, gz, lift = 0) => [
    engine.worldX(gx, gz),
    engine.ground(gx, gz) + lift,
    engine.worldZ(gx, gz),
  ];
  const vertexShader = `
    uniform float uBend; uniform vec3 uBendCenter;
    attribute vec3 color; varying vec3 vColor; varying vec2 vUv; varying float vDistance;
    void main(){
      vec4 world = modelMatrix * vec4(position, 1.0);
      vec2 delta = world.xz-uBendCenter.xz;
      world.y += uBend*dot(delta,delta);
      vec3 n = normalize(mat3(modelMatrix)*normal);
      vColor = color * (0.55+0.45*max(dot(n,normalize(vec3(-0.45,0.72,0.38))),0.0));
      vUv=uv; vDistance=length(delta);
      gl_Position=projectionMatrix*viewMatrix*world;
    }`;
  function material(texture = null) {
    if (!texture) return engine.paintMaterial();
    return new Material({
      uniforms: {
        uBend: shared.uBend,
        uBendCenter: shared.uBendCenter,
        uFogColor: shared.uFogColor,
        picture: { value: texture },
        hasPicture: { value: texture ? 1 : 0 },
      },
      vertexShader,
      fragmentShader: `uniform vec3 uFogColor; uniform sampler2D picture; uniform float hasPicture;
        varying vec3 vColor; varying vec2 vUv; varying float vDistance;
        void main(){vec3 c=vColor;
          if(hasPicture>0.5)c=pow(texture2D(picture,vUv).rgb,vec3(2.2))*1.6;
          float brush=sin(vUv.x*110.+sin(vUv.y*42.)*3.)*sin(vUv.y*200.);
          c*=1.+.035*brush*(1.-hasPicture);
          gl_FragColor=vec4(mix(c,uFogColor,smoothstep(120.0,370.0,vDistance)),1.0);
        }`,
      side: 2,
    });
  }
  const paint = material();
  function geometry(boxes) {
    const points = [],
      normals = [],
      colors = [],
      uvs = [];
    const faces = [
      [
        [1, 0, 0],
        [1, -1, -1],
        [1, 1, -1],
        [1, 1, 1],
        [1, -1, 1],
      ],
      [
        [-1, 0, 0],
        [-1, -1, 1],
        [-1, 1, 1],
        [-1, 1, -1],
        [-1, -1, -1],
      ],
      [
        [0, 1, 0],
        [-1, 1, -1],
        [-1, 1, 1],
        [1, 1, 1],
        [1, 1, -1],
      ],
      [
        [0, -1, 0],
        [-1, -1, 1],
        [-1, -1, -1],
        [1, -1, -1],
        [1, -1, 1],
      ],
      [
        [0, 0, 1],
        [-1, -1, 1],
        [-1, 1, 1],
        [1, 1, 1],
        [1, -1, 1],
      ],
      [
        [0, 0, -1],
        [1, -1, -1],
        [1, 1, -1],
        [-1, 1, -1],
        [-1, -1, -1],
      ],
    ];
    for (const [x, y, z, w, h, d, color] of boxes) {
      for (const [normal, ...corners] of faces) {
        for (const index of [0, 1, 2, 0, 2, 3]) {
          const v = corners[index];
          points.push(
            x + (v[0] * w) / 2,
            y + (v[1] * h) / 2,
            z + (v[2] * d) / 2,
          );
          normals.push(...normal);
          colors.push(...color);
          uvs.push(
            ...[
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
            ][index],
          );
        }
      }
    }
    const result = new Geometry();
    for (const [name, data, size] of [
      ["position", points, 3],
      ["normal", normals, 3],
      ["color", colors, 3],
      ["uv", uvs, 2],
    ]) {
      result.setAttribute(name, new Attribute(new Float32Array(data), size));
    }
    // Actors use the same surface paint as the city and student. Keep billboard
    // text on its own readable material; only its casing and supports are painted.
    const count = points.length / 3;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++)
      data.set([engine.kinds.FIGURE, 0.43, 1.4, 0], i * 4);
    result.setAttribute("aData", new Attribute(data, 4));
    result.setAttribute("aLamp", new Attribute(new Float32Array(count * 4), 4));
    result.setAttribute(
      "aLamp2",
      new Attribute(new Float32Array(count * 4), 4),
    );
    result.computeBoundingSphere();
    return result;
  }
  const dark = [0.06, 0.14, 0.12],
    steel = [0.32, 0.4, 0.33];
  const boards = [];
  function board(gx, gz, label, subtitle) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const texture = new Texture(canvas);
    texture.needsUpdate = true;
    const mesh = new Mesh(
      geometry([[0, 0, 0, 4.8, 2.4, 0.1, [1, 1, 1]]]),
      material(texture),
    );
    const [x, y, z] = point(gx, gz, 3.5);
    mesh.position.set(x, y, z);
    world.add(mesh);
    const supports = new Mesh(
      geometry([
        [x - 2.1, y - 2.0, z, 0.1, 4.0, 0.12, steel],
        [x + 2.1, y - 2.0, z, 0.1, 4.0, 0.12, steel],
        [x, y + 1.24, z, 4.95, 0.12, 0.18, dark],
      ]),
      paint,
    );
    world.add(supports);
    const record = { canvas, texture, label, subtitle, mesh };
    boards.push(record);
    drawBoard(record, label, subtitle);
    return record;
  }
  function drawBoard(record, title, subtitle) {
    const ctx = record.canvas.getContext("2d");
    ctx.fillStyle = "#f0e5c9";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = "#997b43";
    ctx.lineWidth = 7;
    ctx.strokeRect(8, 8, 1008, 496);
    ctx.fillStyle = "#456553";
    ctx.font = "600 30px sans-serif";
    ctx.fillText("HELSINKI  /  CITY NETWORK", 50, 66);
    ctx.fillStyle = "#284a40";
    ctx.font = "700 70px sans-serif";
    const words = title.split(" ");
    let line = "",
      y = 190;
    for (const word of words) {
      const next = line + word + " ";
      if (ctx.measureText(next).width > 920) {
        ctx.fillText(line, 50, y);
        y += 85;
        line = word + " ";
      } else line = next;
    }
    ctx.fillText(line, 50, y);
    ctx.fillStyle = "#647064";
    ctx.font = "32px sans-serif";
    ctx.fillText(subtitle.slice(0, 52), 50, 440);
    record.texture.needsUpdate = true;
  }
  // Exhibition positions are curated game props, never asserted office addresses.
  let companies = [],
    matches = new Set(),
    selected = null,
    mapOpen = false,
    mapBlend = 0;
  let records = [],
    videos = new Map(),
    changedSources = new Set();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mapCamera = engine.camera.clone();
  const { near: rideNear, far: rideFar } = engine.camera;
  const officePoints = new Map();
  const ringGeometry = geometry(
    Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return [
        Math.cos(a) * 4.4,
        0,
        Math.sin(a) * 4.4,
        0.35,
        0.1,
        0.35,
        [0.3, 1.5, 1.2],
      ];
    }),
  );
  const artworkMaterial = () =>
    new Material({
      uniforms: {
        clock: { value: 0 },
        tone: { value: new engine.Color(0.2, 0.8, 0.65) },
        variant: { value: 0 },
        video: { value: null },
        hasVideo: { value: 0 },
      },
      vertexShader:
        "varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec2 v; uniform float clock; uniform vec3 tone; uniform float variant;
      uniform sampler2D video; uniform float hasVideo;
      void main(){
        vec2 p=(v-.5)*vec2(1.8,1.); float t=clock*.22; float glow=0.;
        for(int i=0;i<7;i++){float k=float(i);float y=sin(p.x*4.+t+k*.4)*.19+sin(p.x*9.-t*.7+k)*.06;
          float d=abs(p.y-y); glow+=.005/(d+.008)*( .55+.45*sin(k+t));}
        float orb=length(p-vec2(sin(t*.5)*.20,cos(t*.8)*.1));
        float halo=.012/(abs(orb-(.25+variant*.035))+.012);
        vec3 c=vec3(.007,.018,.035)+tone*glow*.42+mix(tone,vec3(.8,.55,1.),.6)*halo;
        c*=smoothstep(.9,.3,length(v-.5));
        if(hasVideo>.5)c=pow(texture2D(video,v).rgb,vec3(2.2));
        gl_FragColor=vec4(c,1.);
      }`,
      side: 2,
    });
  function configure(items) {
    engine.state.titleStillReady = false;
    if (records.length) return; // Immutable placement for this curated collection.
    companies = items;
    for (const { id, office } of items) {
      if (!office) continue;
      const [gx, gz] = project(office.lon, office.lat);
      officePoints.set(id, new engine.Vector(gx, office.markerHeight, gz));
    }
    matches = new Set(items.map((c) => c.id));
    board(
      0,
      -103,
      "IDEAS AFTER DARK",
      "Rautatientori / A curated company exhibition",
    );
    records = items.map((c, i) => {
      const { gx, gz } = c.placement;
      const sign = board(gx, gz, c.name, c.sector + " / Discovery exhibition");
      const ctx = sign.canvas.getContext("2d");
      ctx.fillStyle = "#101e2b";
      ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = c.color;
      ctx.fillRect(48, 55, 60, 5);
      ctx.font = "28px sans-serif";
      ctx.fillText(
        String(i + 1).padStart(2, "0") + " / " + c.sector.toUpperCase(),
        48,
        110,
      );
      ctx.fillStyle = "#f5f0e7";
      ctx.font = "bold 92px sans-serif";
      ctx.fillText(c.name, 48, 270, 925);
      ctx.font = "24px sans-serif";
      ctx.fillStyle = "#b9c7c7";
      ctx.fillText("DISCOVERY EXHIBITION · NOT AN OFFICE", 48, 445);
      sign.texture.needsUpdate = true;
      const ring = new Mesh(ringGeometry, paint);
      ring.position.set(gx, 0.12, gz);
      world.add(ring);
      const art = c.exhibit
        ? new Mesh(
            geometry([[0, 0, 0, 9, 5, 0.1, [1, 1, 1]]]),
            artworkMaterial(),
          )
        : null;
      if (art) {
        art.position.set(gx, 8.1, gz);
        art.material.uniforms.tone.value.set(c.color);
        art.material.uniforms.variant.value = i;
        world.add(art);
      }
      return { id: c.id, sign, ring, art, phase: i };
    });
  }
  const snapshot = () => ({
    state: engine.state.state,
    presentation: `helsinki-${visuals.getEnvironment()}`,
    environment: visuals.getEnvironment(),
    district: district.name,
    buildings: district.buildings.length,
    pedestrians: citizens.count,
    vehicle: "student-scooter",
    gx: engine.player.gx,
    gz: engine.player.gz,
    y: engine.player.y,
    speed: engine.player.speed,
    walking: engine.player.walking,
    flying: engine.player.flying,
    mapOpen,
    camera: {
      x: engine.camera.position.x,
      y: engine.camera.position.y,
      z: engine.camera.position.z,
      fov: engine.camera.fov,
    },
    drawCalls: engine.renderer.info.render.calls,
  });
  function projectCompany(id) {
    const c = companies.find((c) => c.id === id);
    if (!c) return null;
    const office = mapOpen && officePoints.get(id);
    const p = (office
      ? office.clone()
      : new engine.Vector(c.placement.gx, 5, c.placement.gz)
    ).project(engine.camera);
    return {
      x: (p.x + 1) / 2,
      y: (1 - p.y) / 2,
      visible:
        p.z > -1 && p.z < 1 && Math.abs(p.x) < 0.95 && Math.abs(p.y) < 0.9,
    };
  }
  const api = {
    getGraphics: oilPaint.getStats,
    setEnvironment(mode) {
      if (!visuals.setEnvironment(mode)) return false;
      for (const fn of subscribers) fn(snapshot());
      return true;
    },
    getSnapshot: snapshot,
    locations: positions,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    configureCompanies: configure,
    setMatches(ids) {
      matches = new Set(ids);
    },
    setSourceChanges(ids) {
      changedSources = new Set(ids);
    },
    selectCompany(id) {
      selected = id;
    },
    projectCompany,
    setUIFocus(value) {
      engine.state.uiFocused = value;
    },
    setMap(value) {
      mapOpen = value;
    },
    setExhibitMedia(items) {
      for (const item of items) {
        if (
          !item.url ||
          !/^\/media\/exhibits\/[a-z0-9-]+\.mp4$/.test(item.url) ||
          videos.has(item.id)
        )
          continue;
        const record = records.find((r) => r.id === item.id && r.art);
        if (!record) continue;
        const video = document.createElement("video");
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "none";
        video.src = item.url;
        const texture = new Texture(video);
        texture.generateMipmaps = false;
        texture.minFilter = 1006;
        texture.magFilter = 1006;
        videos.set(item.id, { video, texture, record });
        video.addEventListener("error", () => {
          record.art.material.uniforms.hasVideo.value = 0;
        });
      }
    },
  };
  let lastNotifiedState = null;
  let lastNotify = 0,
    lastVideo = 0;
  engine.state.director = (dt) => {
    const t = reduced ? 0 : engine.state.time;
    visuals.update();
    engine.hideLegacyMapDecorations();
    citizens.update(dt);
    updateStudent(dt);
    if (engine.state.state !== "ride") {
      mapOpen = false;
      mapBlend = 0;
      engine.state.uiFocused = false;
    }
    mapBlend +=
      ((mapOpen ? 1 : 0) - mapBlend) * (reduced ? 1 : 1 - Math.exp(-dt * 3));
    if (mapBlend > 0.001 && engine.state.state === "ride") {
      const halfFov = (engine.camera.fov * Math.PI) / 360;
      const height = Math.max(1030, 615 / (Math.tan(halfFov) * engine.camera.aspect));
      mapCamera.position.set(-185, height, 350 + height * 0.39);
      mapCamera.lookAt(-185, 0, 350);
      engine.camera.position.lerp(mapCamera.position, mapBlend);
      engine.camera.quaternion.slerp(mapCamera.quaternion, mapBlend);
    }
    // A raised near plane preserves depth precision between roads and the
    // ground at atlas altitude. Ease it back down as the rider comes into view.
    const near = Math.max(rideNear, (engine.camera.position.y - 100) * 0.055 * mapBlend);
    const far = rideFar + 1700 * mapBlend;
    if (engine.camera.near !== near || engine.camera.far !== far) {
      engine.camera.near = near;
      engine.camera.far = far;
      engine.camera.updateProjectionMatrix();
    }
    engine.camera.updateMatrixWorld();
    const [fogNear, fogFar] = visuals.getFogRange();
    shared.uFogRange.value.set(fogNear + mapBlend * 2400, fogFar + mapBlend * 3450);
    shared.uCityMap.value = mapBlend;
    district.update(mapBlend);
    let nearest = null,
      nearestDistance = 110;
    for (const record of records) {
      const match = matches.has(record.id),
        chosen = selected === record.id;
      const scale =
        (chosen ? 1.1 : match ? 1 : 0.65) +
        (changedSources.has(record.id) && !reduced
          ? 0.12 * (1 + Math.sin(t * 2))
          : 0);
      record.ring.scale.setScalar(
        scale * (1 + (reduced ? 0 : 0.025 * Math.sin(t * 1.5 + record.phase))),
      );
      record.ring.visible = match || chosen;
      if (record.art) {
        record.art.material.uniforms.clock.value = t;
        const d = record.art.position.distanceTo(engine.camera.position);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = record.id;
        }
      }
    }
    for (const [id, v] of videos) {
      const playing =
        id === nearest &&
        engine.state.state === "ride" &&
        !mapOpen &&
        !reduced &&
        !document.hidden;
      if (playing) {
        if (v.video.paused && !v.video.error && !v.playPending && !v.blocked) {
          v.playPending = true;
          void v.video
            .play()
            .catch(() => {
              v.blocked = true;
            })
            .finally(() => {
              v.playPending = false;
            });
        }
        if (v.video.readyState >= 2 && engine.state.time - lastVideo > 0.08) {
          v.texture.needsUpdate = true;
          v.record.art.material.uniforms.video.value = v.texture;
          v.record.art.material.uniforms.hasVideo.value = 1;
        }
      } else {
        v.video.pause();
        v.blocked = false;
        v.record.art.material.uniforms.hasVideo.value = 0;
      }
    }
    if (engine.state.time - lastVideo > 0.08) lastVideo = engine.state.time;
    if (engine.state.state !== lastNotifiedState || engine.state.time - lastNotify > 0.08) {
      lastNotifiedState = engine.state.state;
      lastNotify = engine.state.time;
      for (const fn of subscribers) fn(snapshot());
    }
  };
  window.__webworldEngine = api;
  window.dispatchEvent(new Event("webworld-ready"));
}
