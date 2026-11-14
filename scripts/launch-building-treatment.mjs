// Runs inside the capture browser only. No remote or game-source writes.
export function applyVideoBuildingTreatment() {
  const s = window.__startupCity.scene;
  const root = s.e.scene.getObjectByName('Helsinki · OpenStreetMap');
  if (!root) throw new Error('Helsinki geometry is unavailable');
  const replacements = new Map();
  root.traverse(object => {
    const original = object.material;
    if (!original?.fragmentShader?.includes('float kind = floor(vData.x')) return;
    if (!replacements.has(original)) {
      const material = original.clone();
      // Preserve the engine's live sun, fog, lamp and time bindings.
      material.uniforms = { ...original.uniforms };
      let shader = original.fragmentShader;
      shader = shader.replace('float wob = (vnoise(w * 5.0 + seed * 13.0) - 0.5) * 0.22;', 'float wob = 0.0;');
      shader = shader.replace('float trim = smoothstep(1.52, 1.38, box)', 'float trim = smoothstep(1.28, 1.18, box)');
      shader = shader.replace('float flick = 1.0 + 0.07 * sin(uTime * (2.0 + 5.0 * r1) + r2 * 40.0) + 0.04 * sin(uTime * 11.0 * r3 + r1 * 9.0);', 'float flick = 1.0;');
      const marker = '  // ───────────── lay the dabs:';
      if (!shader.includes(marker)) throw new Error('Unsupported facade shader');
      shader = shader.replace(marker, `
  // Video-only architectural finish: smooth plaster, glass and metal roofing.
  if (kind == 1.0 || kind == 2.0) {
    vec3 diffuseLight, reflectedLight;
    shade(vPos, vWorld, N, N, V, kind == 2.0 ? 48.0 : 40.0, spill, diffuseLight, reflectedLight);
    vec3 finish = base;
    float grain = vnoise(vUv * 90.0 + seed * 23.0);
    finish *= .98 + grain * .04;
    float contact = mix(.66, 1.0, smoothstep(0.0, 2.6, vPos.y));
    if (kind == 1.0) {
      vec2 f = fract(vUv);
      // Fine stone courses at the ground floor, darker joints under ledges.
      float joint = 1.0 - smoothstep(.012, .025, min(f.y, 1.0-f.y));
      finish *= 1.0 - joint * .10;
      vec2 c = (f - vec2(.5,.52)) / vec2(.19,.27);
      float sillWidth = 1.0 - smoothstep(1.12, 1.30, abs(c.x));
      float sill = sillWidth * (1.0 - smoothstep(.025,.065,abs(c.y + 1.12)));
      float recess = sillWidth * (1.0 - smoothstep(.03,.12,abs(c.y - 1.12)));
      finish *= 1.0 - recess * .26;
      finish = mix(finish, base * 1.18 + .025, sill * .65);
    } else {
      float seam = 1.0 - smoothstep(.012,.033,min(fract(vUv.x*1.6),1.0-fract(vUv.x*1.6)));
      finish *= 1.0 - seam * .23;
    }
    vec3 architectural = finish * diffuseLight * contact;
    architectural += reflectedLight * (kind == 2.0 ? .18 : gloss * .18);
    architectural += base * uWarmCol * halo * .35 * uGlow;
    float fog = pow(smoothstep(uFogRange.x,uFogRange.y,vDist),1.5);
    architectural = mix(architectural,uFogColor,fog*.97);
    architectural += emis * uGlow * .62 * (1.0-fog*.86);
    gl_FragColor = vec4(max(architectural,vec3(0.0)),1.0);
    return;
  }
  // ───────────── lay the dabs:`);
      material.fragmentShader = shader;
      material.name = 'Capture only / architectural facade finish';
      material.needsUpdate = true;
      replacements.set(original, material);
    }
    object.material = replacements.get(original);
  });
  return { materials: replacements.size, scope: 'capture browser only', treatment: 'architectural facades; original map geometry' };
}
