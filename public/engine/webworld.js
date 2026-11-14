import { installCitizens } from "./helsinki-citizens.js";
/* WEBWORLD scene additions. Uses the original renderer, terrain and frame loop. */
import { installHelsinki } from "./helsinki.js";
import { installHelsinkiMap } from "./helsinki-real-map.js";
import { installStudent } from "./student-scooter.js";

export function installWebworld(engine) {
  const visuals = installHelsinki(engine);
  const district = installHelsinkiMap(engine, visuals.helpers);
  const citizens = installCitizens(engine, visuals.helpers);
  const updateStudent = installStudent(engine, visuals.helpers);
  const { Group, Mesh, Geometry, Attribute, Material, Texture, scene, shared } =
    engine;
  const subscribers = new Set();
  const world = new Group();
  world.name = "WEBWORLD Helsinki network district";
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
    result.computeBoundingSphere();
    return result;
  }
  const cyan = [0.09, 0.72, 0.51],
    pink = [0.82, 0.33, 0.16],
    dark = [0.06, 0.14, 0.12],
    steel = [0.32, 0.4, 0.33];
  const staticBoxes = [];
  function gridBox(gx, gz, lift, w, h, d, color) {
    const [x, y, z] = point(gx, gz, lift);
    staticBoxes.push([x, y, z, w, h, d, color]);
  }
  world.add(new Mesh(geometry(staticBoxes), paint));
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
  const newsBoard = board(
    -9,
    25,
    "COMPUTE IS CURRENCY",
    "Ride. Collect. Deliver.",
  );
  board(9, -16, "RAUTATIENTORI", "Map data: OpenStreetMap contributors");
  for (const id of ["exchange", "relay", "arcade"]) {
    const p = positions[id];
    board(
      p.gx,
      p.gz,
      p.name.toUpperCase(),
      "Fictional WEBWORLD mission terminal",
    );
  }
  const actorGroup = new Group();
  world.add(actorGroup);
  const robotGeometry = geometry([
    [0, 0.85, 0, 0.55, 0.65, 0.38, steel],
    [0, 1.35, 0, 0.5, 0.35, 0.4, dark],
    [0, 1.39, 0.22, 0.34, 0.08, 0.04, cyan],
    [-0.18, 0.3, 0, 0.17, 0.6, 0.2, steel],
    [0.18, 0.3, 0, 0.17, 0.6, 0.2, steel],
    [-0.4, 0.9, 0, 0.15, 0.6, 0.17, steel],
    [0.4, 0.9, 0, 0.15, 0.6, 0.17, steel],
  ]);
  const droneGeometry = geometry([
    [0, 0, 0, 0.7, 0.25, 0.7, dark],
    [-0.65, 0, 0, 0.6, 0.07, 0.2, cyan],
    [0.65, 0, 0, 0.6, 0.07, 0.2, cyan],
    [0, 0, -0.65, 0.2, 0.07, 0.6, pink],
    [0, 0, 0.65, 0.2, 0.07, 0.6, pink],
  ]);
  const actors = [];
  const cartGeometry = geometry([
    [0, 0.6, 0, 0.9, 0.45, 1.5, dark],
    [0, 0.95, -0.2, 0.65, 0.3, 0.8, steel],
    [0, 0.38, 0, 1.05, 0.08, 1.6, cyan],
    [0, 0.67, 0.77, 0.7, 0.1, 0.03, pink],
  ]);
  const carts = Array.from({ length: 4 }, () => {
    const mesh = new Mesh(cartGeometry, paint);
    world.add(mesh);
    return mesh;
  });
  function actorsFor(robots, drones) {
    actorGroup.clear();
    actors.length = 0;
    for (let i = 0; i < robots + drones; i++) {
      const drone = i >= robots;
      const mesh = new Mesh(drone ? droneGeometry : robotGeometry, paint);
      actorGroup.add(mesh);
      actors.push({ mesh, drone, index: i });
    }
  }
  const marker = new Group();
  world.add(marker);
  const crystal = new Mesh(geometry([[0, 0, 0, 0.8, 0.8, 0.8, cyan]]), paint);
  const pillar = new Mesh(geometry([[0, 2, 0, 0.05, 4, 0.05, cyan]]), paint);
  marker.add(crystal, pillar);
  marker.visible = false;
  let target = null,
    atmosphere = "breakthrough",
    chaos = false,
    mood = "calm";
  function setAtmosphere(mode) {
    atmosphere = mode;
    visuals.atmosphere(mode);
  }
  setAtmosphere("breakthrough");
  actorsFor(3, 3);
  function snapshot() {
    const p = engine.player;
    return {
      state: engine.state.state,
      presentation: "helsinki-daylight",
      district: district.name,
      buildings: district.buildings.length,
      pedestrians: citizens.count,
      vehicle: "student-scooter",
      camera: {
        x: engine.camera.position.x,
        y: engine.camera.position.y,
        z: engine.camera.position.z,
        fov: engine.camera.fov,
      },
      gx: p.gx,
      gz: p.gz,
      y: p.y,
      speed: p.speed,
      walking: p.walking,
      flying: p.flying,
      points: engine.score.points,
      banked: engine.score.banked,
      caught: engine.score.caught,
      distance: target
        ? Math.hypot(
            p.gx - target.gx,
            p.gz - target.gz,
            p.y - engine.ground(target.gx, target.gz),
          )
        : null,
      bearing: target
        ? Math.atan2(target.gz - p.gz, target.gx - p.gx) - p.heading
        : 0,
      robots: actors.filter((a) => !a.drone).length,
      drones: actors.filter((a) => a.drone).length,
      atmosphere,
      trafficMode: chaos ? "chaos" : "normal",
      npcMood: mood,
      drawCalls: engine.renderer.info.render.calls,
    };
  }
  const api = {
    locations: positions,
    getSnapshot: snapshot,
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    applyScenario(scenario) {
      setAtmosphere(scenario.worldChanges.atmosphere);
      chaos = scenario.worldChanges.trafficMode === "chaos";
      mood = scenario.worldChanges.npcMood;
      actorsFor(
        scenario.worldChanges.spawnRobots,
        scenario.worldChanges.spawnDrones,
      );
      drawBoard(
        newsBoard,
        scenario.worldChanges.billboardText,
        scenario.mission.title,
      );
    },
    setTarget(id) {
      target = positions[id] || null;
      marker.visible = !!target;
      if (target) {
        marker.position.set(...point(target.gx, target.gz, 1.4));
      }
    },
    collect() {
      engine.burst(engine.player.wx, engine.player.y + 1, engine.player.wz);
      engine.toast("Compute packet secured");
    },
    finish() {
      engine.reward(500);
      engine.toast("Delivery complete · +500 compute");
      marker.visible = false;
      target = null;
      chaos = false;
      mood = "calm";
      setAtmosphere("breakthrough");
      actorsFor(2, 3);
      drawBoard(
        newsBoard,
        "NETWORK RESTORED",
        "Delivery confirmed. Ready for your next signal.",
      );
    },
    projectSpeaker() {
      const citizen = citizens.speaker();
      if (citizen) {
        const v = citizen.group.position.clone();
        v.y += 2.2;
        v.project(engine.camera);
        return {
          x: (v.x + 1) / 2,
          y: (1 - v.y) / 2,
          text: citizen.text,
          visible:
            v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.7 && Math.abs(v.y) < 0.7,
        };
      }
      const actor = actors.find(
        (a) =>
          Math.hypot(
            a.mesh.position.x - engine.player.wx,
            a.mesh.position.z - engine.player.wz,
          ) < 18,
      );
      if (!actor) return null;
      const v = actor.mesh.position.clone();
      v.y += actor.drone ? 1 : 2;
      v.project(engine.camera);
      return {
        x: (v.x + 1) / 2,
        y: (1 - v.y) / 2,
        visible:
          v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.7 && Math.abs(v.y) < 0.7,
      };
    },
    projectTarget() {
      if (!target) return null;
      const v = new engine.Vector(...point(target.gx, target.gz, 3));
      v.project(engine.camera);
      return {
        x: (v.x + 1) / 2,
        y: (1 - v.y) / 2,
        visible:
          v.z > -1 && v.z < 1 && Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.9,
      };
    },
  };
  let lastNotify = 0;
  engine.state.director = (dt) => {
    const t = engine.state.time;
    visuals.update();
    engine.hideLegacyMapDecorations();
    district.update();
    citizens.update(dt);
    updateStudent(dt);
    for (const actor of actors) {
      const i = actor.index;
      const gx = actor.drone ? Math.sin(t * 0.17 + i) * 16 : i % 2 ? 3.8 : -3.8;
      const gz =
        12 + Math.sin(t * (mood === "panic" ? 0.4 : 0.16) + i * 2) * 32;
      actor.mesh.position.set(
        ...point(gx, gz, actor.drone ? 8 + Math.sin(t + i) : 0),
      );
      actor.mesh.rotation.y = t * (actor.drone ? 0.3 : 0) + i;
    }
    carts.forEach((cart, index) => {
      const phase = t * (chaos ? 0.45 : 0.16) + (index * Math.PI) / 2;
      cart.position.set(
        ...point(
          index % 2 ? 2.6 : -2.6,
          5 + Math.sin(phase) * 55,
          0.08 * Math.sin(t * 2 + index),
        ),
      );
      cart.rotation.y = Math.cos(phase) > 0 ? 0 : Math.PI;
    });
    crystal.rotation.set(t * 0.5, t, Math.PI / 4);
    crystal.position.y = Math.sin(t * 2) * 0.25;
    if (t - lastNotify > 0.08) {
      lastNotify = t;
      const s = snapshot();
      for (const fn of subscribers) fn(s);
    }
  };
  window.__webworldEngine = api;
  window.dispatchEvent(new Event("webworld-ready"));
}
