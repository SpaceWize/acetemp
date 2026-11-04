/* ACE SPADERS — the waitlist gate's 3D scene: pearly golden gates.

   Loaded by gate.js (dynamic import) only for a visitor who has not joined
   yet, so nobody else downloads three.js. If anything here fails (no WebGL,
   the CDN is unreachable) gate.js shows the plain gate instead.

   The sequence: the two gate halves stand open, swung out toward the viewer
   from hinges at the screen edges; they swing shut, meet in the middle with a
   small rebound and a flash of light off the gold, and only then does the
   waitlist card appear over them. Behind the bars, on a bank of light, Little
   Ace runs back and forth using the run cycle from his sprite sheet. When the
   visitor joins, the gates swing open again and the page is revealed.

   start(host, opts) -> { closed: Promise, open(): Promise, dispose() }
     host     the element the canvas goes into (fills it)
     opts     { reduced: bool, atlasUrl: string } */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/environments/RoomEnvironment.js/+esm';

const OPEN = 1.57;            // rad: each half stands open edge-on to the viewer (90deg), out of sight at the screen edge
const OUT = 2.3;              // rad: how far they swing when they open for good: past edge-on, out of the frame entirely
const OUT_SWING = 1.7;        // s: that swing
const SWING = 2.6;            // s from open to the moment the halves meet: slow and heavy
const SETTLE = 0.9;           // s of rebound after they meet
const DELAY = 0;              // s before the swing starts (the gates stand out of sight, so there is nothing to wait for)
const CAM_Z = 14, FOV = 38;

// Sprite sheet: 8 columns x 9 rows of 240x280 cells; the run cycle is cells 13-20 at 11fps (as in companion.js).
const COLS = 8, ROWS = 9, RUN = [13, 14, 15, 16, 17, 18, 19, 20], RUN_FPS = 11, IDLE = 0;
const FALL = [28, 29], LAND = [30, 31, 32, 33], LAND_FPS = 17, GRAVITY_PX = 1650;   // the page companion's clips and gravity

export function start(host, opts = {}) {
  const reduced = !!opts.reduced;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);                         // see-through: the page shows until the gates close
  const cv = renderer.domElement;
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  host.appendChild(cv);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // ── light ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xfff1d6, 0.25));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-6, 7, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd3ff, 0.45);
  fill.position.set(7, -2, 6);
  scene.add(fill);
  const glow = new THREE.PointLight(0xffcf7a, 6, 30, 1.6);      // the light beyond the gates: a soft rim on the bars
  glow.position.set(0, 1.2, -3.5);
  scene.add(glow);
  const flash = new THREE.PointLight(0xfff4d6, 0, 14, 1.4);     // the glint when the halves meet
  flash.position.set(0, 0.6, 2.5);
  scene.add(flash);

  /* A shine under the cursor. It lives IN the gold: every gold surface within a small radius of the pointer
     catches a pale light (a few lines added to the gold materials' shader, below), so the light stays on the bars
     and the gaps between them stay dark. A small pale light at the same spot adds a glint. It eases after the
     pointer and fades in and out with it. */
  const HEAT_Z = 0.9;
  const heat = new THREE.PointLight(0xfff0d8, 0, 2.6, 2);
  heat.position.set(0, 0, HEAT_Z);
  scene.add(heat);
  let heatX = 0, heatY = 0, heatTX = 0, heatTY = 0, heatOn = 0, heatWant = 0, heatSeen = false;
  const ray = new THREE.Vector3();
  function onPointer(e) {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    ray.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    const k = (HEAT_Z - camera.position.z) / ray.z;                 // where the pointer's ray meets the heat plane
    heatTX = camera.position.x + ray.x * k; heatTY = camera.position.y + ray.y * k;
    if (!heatSeen) { heatX = heatTX; heatY = heatTY; heatSeen = true; }
    heatWant = 1;
  }
  const offPointer = () => { heatWant = 0; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('pointerleave', offPointer);
  window.addEventListener('blur', offPointer);

  // ── materials ──────────────────────────────────────────────────────
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd99a3e, metalness: 1, roughness: 0.26, clearcoat: 0.3, clearcoatRoughness: 0.25 });   // rich, warm gold
  const goldDeep = new THREE.MeshPhysicalMaterial({ color: 0xb47628, metalness: 1, roughness: 0.34 });
  // A warm cream, not white: a white base blew out to a flat white disc under the lights, and the sheen and the
  // pink-green play of colour (iridescence) are what make it read as pearl rather than as a white ball.
  const pearl = new THREE.MeshPhysicalMaterial({
    color: 0xe6dac4, metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06,
    sheen: 0.7, sheenColor: new THREE.Color(0xffd9c2), sheenRoughness: 0.4,
    iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [260, 480]
  });
  const disposables = [gold, goldDeep, pearl, envRT, pmrem];
  // The shine is laid on after tone mapping, in screen colour (through the tone mapper it washed into the gold). It
  // adds pale light in proportion to how lit each bit of bar already is, so the bars' own highlights flare and their
  // shaded sides stay dark: polished metal catching the light, not hot metal. uHeatGain: how bright it gets.
  const heatU = { uHeatPos: { value: new THREE.Vector3() }, uHeatAmt: { value: 0 }, uHeatR: { value: 1.6 }, uTime: { value: 0 }, uHeatGain: { value: 0.75 } };
  function molten(mat) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, heatU);
      const NL = String.fromCharCode(10);
      sh.vertexShader = 'varying vec3 vHeatW;' + NL + sh.vertexShader.replace('#include <project_vertex>',
        '#include <project_vertex>' + NL + '  vHeatW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform vec3 uHeatPos; uniform float uHeatAmt; uniform float uHeatR; uniform float uTime; uniform float uHeatGain; varying vec3 vHeatW;' + NL +
        sh.fragmentShader.replace('#include <colorspace_fragment>', [
          '#include <colorspace_fragment>',
          '{',
          '  float d = distance(vHeatW.xy, uHeatPos.xy);',
          '  float k = max(0.0, 1.0 - d / uHeatR);',
          '  float h = clamp(uHeatAmt * uHeatGain * smoothstep(0.0, 1.0, k), 0.0, 1.0);',
          '  vec3 sheen = mix(vec3(1.0, 0.91, 0.72), vec3(1.0, 0.99, 0.95), smoothstep(0.45, 0.95, k));',   // pale champagne, white at the centre
          '  float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));',
          '  gl_FragColor.rgb = min(vec3(1.0), gl_FragColor.rgb + sheen * h * (0.12 + 0.88 * lum * lum));',   // rides each bar's own highlight, so they stay round',
          '}'
        ].join(NL));
    };
    mat.needsUpdate = true;
  }
  molten(gold);
  molten(goldDeep);

  let veil = 0;                                               // see setVeil() below
  // ── the world behind the gates: a bank of light, drifting motes, Little Ace ──
  const back = new THREE.Group();
  scene.add(back);
  const skyTex = new THREE.CanvasTexture(paintSky());
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: skyTex, toneMapped: false, depthWrite: false, transparent: true, opacity: 0 }));
  sky.position.z = -9;
  back.add(sky);
  disposables.push(skyTex, sky.geometry, sky.material);

  const MOTES = 60;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(MOTES * 3), moteSeed = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 22;
    motePos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    motePos[i * 3 + 2] = -2 - Math.random() * 5;
    moteSeed[i] = Math.random() * 10;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({ color: 0xffd98a, size: 0.06, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const motes = new THREE.Points(moteGeo, moteMat);
  back.add(motes);
  disposables.push(moteGeo, moteMat);

  // Little Ace: a sprite-sheet plane, run cycle, back and forth on the light bank
  const ACE_Z = -4.2, ACE_H = 2.3;
  const ace = new THREE.Group();
  back.add(ace);
  let aceTex = null, aceMat = null, aceShadow = null;
  const aceReady = new Promise((resolve) => {
    if (!opts.atlasUrl) return resolve(false);
    new THREE.TextureLoader().load(opts.atlasUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(1 / COLS, 1 / ROWS);
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.anisotropy = 4;
      aceTex = t;
      aceMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.04, toneMapped: false, depthWrite: false, opacity: veil });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ACE_H * 240 / 280, ACE_H), aceMat);
      m.position.y = ACE_H / 2 - 0.06;                       // feet on the group origin
      ace.add(m);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), new THREE.MeshBasicMaterial({ color: 0x3a2a12, transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false }));
      sh.scale.set(1, 0.18, 1);
      sh.position.set(0, 0.02, -0.01);
      ace.add(sh);
      aceShadow = sh;
      disposables.push(t, m.geometry, aceMat, sh.geometry, sh.material);
      resolve(true);
    }, undefined, () => resolve(false));
  });
  function setCell(i) {
    if (!aceTex) return;
    const c = i % COLS, r = Math.floor(i / COLS);
    aceTex.offset.set(c / COLS, 1 - (r + 1) / ROWS);
  }

  // ── the gates ───────────────────────────────────────────────────────
  const left = new THREE.Group(), right = new THREE.Group();
  scene.add(left, right);
  let built = [];

  function build(W, H) {
    built.forEach((g) => g.dispose());
    built = [];
    [left, right].forEach((p) => { while (p.children.length) p.remove(p.children[0]); });
    const half = W / 2;
    left.position.set(-half, 0, 0);
    right.position.set(half, 0, 0);
    left.add(gateHalf(half, H));
    const r = gateHalf(half, H);
    r.scale.x = -1;                                           // mirror: hinge on the right edge
    right.add(r);
  }

  function gateHalf(w, H) {
    const g = new THREE.Group();
    const geos = [];
    const add = (geo, mat, x, y, z = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; g.add(m); geos.push(geo); return m; };
    const bottom = -H / 2 + 0.28;
    const railLow = -H / 2 + 0.75, railMid = -H * 0.06, railHigh = H * 0.2;
    const topY = (x) => H * 0.28 + H * 0.13 * Math.pow(Math.min(1, x / w), 2);     // the arch rises to the meeting stile
    const r = Math.max(0.03, Math.min(0.05, w / 160));

    // stiles
    add(new THREE.CylinderGeometry(0.1, 0.1, topY(0) - bottom + 0.2, 20), gold, 0.1, (topY(0) + bottom) / 2);
    add(new THREE.CylinderGeometry(0.075, 0.075, topY(w) - bottom + 0.1, 20), gold, w - 0.06, (topY(w) + bottom) / 2);
    // rails
    for (const y of [bottom, railLow, railMid, railHigh]) {
      const rail = add(new THREE.CylinderGeometry(0.055, 0.055, w - 0.1, 16), goldDeep, w / 2, y, 0, Math.PI / 2);
      rail.material = y === railMid ? gold : goldDeep;
    }
    // the arch, a tube along the top
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = 0.1 + (w - 0.16) * (i / 24); pts.push(new THREE.Vector3(x, topY(x), 0)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.07, 12, false), gold, 0, 0);
    // bars, with spade ornaments mounted on the front of the arch
    const n = Math.max(5, Math.round((w - 0.3) / 0.46));
    const step = (w - 0.3) / n;
    const spadeGeo = finialGeometry();
    geos.push(spadeGeo);
    const pearlSmall = new THREE.SphereGeometry(0.085, 32, 24);
    geos.push(pearlSmall);
    // Collars: a rounded gold knuckle wrapping every joint, as forged ironwork has, so no bar is seen cutting
    // straight through a rail (the bare cylinder-through-cylinder seams are what read as parts pushed together).
    const knuckleGeo = new THREE.SphereGeometry(1, 20, 14);
    geos.push(knuckleGeo);
    const knuckle = (x, y, rad) => { const k = new THREE.Mesh(knuckleGeo, gold); k.position.set(x, y, 0); k.scale.set(rad, rad, rad * 0.85); g.add(k); };
    const rails = [bottom, railLow, railMid, railHigh];
    for (let i = 1; i < n; i++) {
      const x = 0.15 + i * step, top = topY(x);
      add(new THREE.CylinderGeometry(r, r, top - bottom, 10), gold, x, (top + bottom) / 2);
      const f = new THREE.Mesh(spadeGeo, gold); f.position.set(x, top + 0.03, 0.1); f.scale.setScalar(0.2); g.add(f);   // on the arch's face, not on top of it
      for (const y of rails) knuckle(x, y, 0.074);
      knuckle(x, top, 0.088);
    }
    // where the rails and the arch meet the stiles, and a gold knob capping the hinge stile
    for (const y of rails) { knuckle(0.1, y, 0.12); knuckle(w - 0.06, y, 0.095); }
    knuckle(0.1, topY(0.1), 0.12);
    knuckle(w - 0.06, topY(w - 0.06), 0.1);
    knuckle(0.1, topY(0) + 0.2, 0.15);
    // rings between the high rail and the arch, every other gap, each holding a pearl
    for (let i = 0; i < n; i += 2) {
      const x = 0.15 + (i + 0.5) * step;
      const y = (railHigh + Math.min(topY(x), railHigh + 1.4)) / 2;
      const rad = Math.min(step * 0.42, 0.42);
      add(new THREE.TorusGeometry(rad, 0.03, 10, 40), gold, x, y);
      const p = new THREE.Mesh(pearlSmall, pearl); p.position.set(x, y, 0.02); p.scale.setScalar(1.15); g.add(p);
    }
    // half of the centre medallion: when the halves meet they make a full ring around a full spade
    // On a phone (portrait) the card sits at the top, over this medallion; raised to the high rail it stays hidden
    // behind the card instead of its bottom peeking out underneath.
    const R = Math.min(0.95, w * 0.3), cy = camera.aspect < 0.8 ? railHigh : (railMid + railHigh) / 2;
    const arc = add(new THREE.TorusGeometry(R, 0.075, 14, 48, Math.PI), gold, w - 0.02, cy, 0.04, Math.PI / 2);
    arc.rotation.y = 0;
    const hs = new THREE.Mesh(halfSpadeGeometry(), gold); hs.position.set(w, cy, 0.05); hs.scale.setScalar(R * 0.62); g.add(hs);
    geos.push(hs.geometry);
    const pc = new THREE.Mesh(pearlSmall, pearl); pc.position.set(w - 0.02 - R, cy, 0.06); pc.scale.setScalar(1.3); g.add(pc);
    // half of a spade crowning the peak where the halves meet, its foot on the arch
    const S2 = Math.min(0.34, w * 0.11) * 0.62, cy2 = topY(w) + S2 * 0.95;
    const hs2 = new THREE.Mesh(halfSpadeGeometry(), gold); hs2.position.set(w, cy2, 0.05); hs2.scale.setScalar(S2); g.add(hs2);
    geos.push(hs2.geometry);
    g.dispose = () => geos.forEach((x) => x.dispose());
    built.push(g);
    return g;
  }

  // ── sizing ──────────────────────────────────────────────────────────
  let W = 1, H = 1, visH0 = 1;
  function resize() {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    visH0 = 2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    H = visH0 * 0.98;
    W = visH0 * camera.aspect;
    build(W, H);
    const dSky = CAM_Z - sky.position.z, visSky = 2 * dSky * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    sky.scale.set(visSky * camera.aspect * 1.08, visSky * 1.08, 1);
    const dAce = CAM_Z - ACE_Z, visAce = 2 * dAce * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    aceFloor = ace.position.y = -visAce * 0.31;
    ace.userData.range = visAce * camera.aspect * 0.42;
    pose(lastAngle);
  }
  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); };
  window.addEventListener('resize', onResize);

  // ── motion ──────────────────────────────────────────────────────────
  let lastAngle = reduced ? 0 : OPEN;
  // The veil: how much of the world behind the gates (glow, motes, Little Ace) is showing. 0 while the page is
  // visible, rising to 1 as the gates swing shut, back to 0 as they open again.
  function setVeil(v) {
    veil = v;
    sky.material.opacity = v;
    moteMat.opacity = 0.3 * v;
    if (handT < 0) { if (aceMat) aceMat.opacity = v; if (aceShadow) aceShadow.material.opacity = 0.35 * v; }
  }
  function pose(a) { lastAngle = a; left.rotation.y = -a; right.rotation.y = a; }   // + a = swung toward the viewer

  // The swing: accelerating like a heavy gate pushed shut, a hit, a small bounce back, settled.
  // Slow to get going, like something heavy, gathering speed all the way in; then one rebound and a smaller one.
  function closeAngle(t) {
    if (t <= 0) return OPEN;
    if (t < SWING) { const p = t / SWING; return OPEN * (1 - Math.pow(p, 2.4)); }
    const s = (t - SWING) / SETTLE;
    if (s >= 1) return 0;
    return 0.045 * Math.abs(Math.sin(2 * Math.PI * s)) * Math.pow(1 - s, 2);      // rebounds off the other half
  }

  let raf = 0, t0 = 0, mode = reduced ? 'idle' : 'waiting', openStart = 0, closeStart = 0, alive = true;
  let resolveClosed, resolveOpen;
  const closed = new Promise((r) => { resolveClosed = r; });
  let hitAt = -1;
  let aceX = 0, aceDir = 1, aceT = 0, aceS = 1, handT = -1;   // aceS: size to match the page's Little Ace; handT: hand-off time
  // Still in the air when handed over: he finishes the fall (height above the floor and its speed, world units),
  // plays the landing, and only then runs. airG is the page's gravity in world units; landT the touchdown time.
  let airY = 0, airVy = 0, airVx = 0, airG = 0, airborne = false, landT = -1, aceFloor = 0;

  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;

    if (mode === 'waiting') return;                            // gates edge-on at the screen edges: nothing to draw
    if (mode === 'closing') {
      const tt = t - closeStart - DELAY;
      pose(closeAngle(tt));
      setVeil(Math.max(0, Math.min(1, tt / (SWING * 0.85))));
      if (tt >= SWING && hitAt < 0) { hitAt = t; }
      if (tt >= SWING + SETTLE) { mode = 'idle'; pose(0); resolveClosed(); }
    } else if (mode === 'opening') {
      // they swing all the way open, out past the screen edges, and are gone: nothing fades
      const p = Math.min(1, (t - openStart) / OUT_SWING);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      pose(OUT * e);
      setVeil(1 - Math.min(1, e * 1.25));
      if (p >= 1) { mode = 'done'; resolveOpen(); }
    }

    // the glint when they meet, and a breath of light on the gold the rest of the time
    const since = hitAt < 0 ? 99 : t - hitAt;
    flash.intensity = since < 1.2 ? 22 * Math.exp(-since * 4.5) : 0;
    key.position.x = -6 + Math.sin(t * 0.35) * 2.5;
    glow.intensity = 6 + Math.sin(t * 0.8) * 0.6;
    if (since < 0.25 && !reduced) camera.position.x = Math.sin(since * 90) * 0.035 * (1 - since / 0.25);
    else camera.position.x = 0;

    // the shine follows the pointer, eased
    heatX += (heatTX - heatX) * 0.22; heatY += (heatTY - heatY) * 0.22;
    heatOn += (heatWant - heatOn) * 0.1;
    heat.position.set(heatX, heatY, HEAT_Z);
    const heatAmt = heatOn * Math.max(veil, 0.2);
    heat.intensity = 8 * heatAmt;
    heatU.uHeatPos.value.set(heatX, heatY, 0);
    heatU.uHeatAmt.value = heatAmt;
    heatU.uTime.value = t;

    // motes rise slowly and wrap
    const pa = moteGeo.attributes.position.array;
    for (let i = 0; i < MOTES; i++) {
      pa[i * 3 + 1] += (reduced ? 0 : 0.004) + 0.0015 * Math.sin(t + moteSeed[i]);
      if (pa[i * 3 + 1] > 6.5) pa[i * 3 + 1] = -6.5;
    }
    moteGeo.attributes.position.needsUpdate = true;

    // Little Ace runs back and forth (stands still for reduced motion)
    if (aceTex) {
      const range = ace.userData.range || 5;
      if (reduced) { setCell(IDLE); ace.position.x = range * 0.35; }
      else {
        const dt = Math.min(0.05, t - aceT); aceT = t;
        const landing = landT >= 0 && t - landT < LAND.length / LAND_FPS;
        let face = aceDir;
        if (airborne) {                                      // finishing the jump he was handed over in
          airVy -= airG * dt; airY += airVy * dt; aceX += airVx * dt;
          if (Math.abs(airVx) > 0.05) face = Math.sign(airVx);
          if (airY <= 0) { airY = 0; airborne = false; landT = t; }
        } else if (!landing) {
          aceX += aceDir * 2.1 * dt;
        }
        if (aceX > range) { aceX = range; aceDir = -1; }
        if (aceX < -range) { aceX = -range; aceDir = 1; }
        ace.position.x = aceX;
        ace.position.y = aceFloor + airY;
        ace.scale.set(face * aceS, aceS, 1);                 // the art faces right; mirror for left
        if (aceShadow) {                                     // the shadow stays on the floor, smaller the higher he is
          const s = 1 / (1 + airY * 0.8);
          aceShadow.position.y = 0.02 - airY / aceS;
          aceShadow.scale.set(s, 0.18 * s, 1);
        }
        if (handT >= 0) {                                    // handed over from the page: in at full size, quickly
          const o = Math.min(1, (t - handT) / 0.25);
          if (aceMat) aceMat.opacity = o;
          if (aceShadow) aceShadow.material.opacity = 0.35 * o;
        }
        let bob = 0;
        if (airborne) setCell(FALL[Math.floor(t * 9) % FALL.length]);
        else if (landT >= 0 && t - landT < LAND.length / LAND_FPS) setCell(LAND[Math.min(LAND.length - 1, Math.floor((t - landT) * LAND_FPS))]);
        else { setCell(RUN[Math.floor(t * RUN_FPS) % RUN.length]); bob = Math.abs(Math.sin(t * Math.PI * RUN_FPS / 4)) * 0.05; }
        ace.children[0] && (ace.children[0].position.y = ACE_H / 2 - 0.06 + bob);
      }
      ace.position.z = ACE_Z;
    }

    renderer.render(scene, camera);
  }

  resize();
  // opts.closed: start shut, the world behind them showing (a returning visitor, who only sees them open)
  const startShut = reduced || !!opts.closed;
  pose(startShut ? 0 : OPEN);
  setVeil(startShut ? 1 : 0);
  renderer.clear();
  if (startShut) { mode = 'idle'; resolveClosed(); }
  raf = requestAnimationFrame(frame);

  const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (alive) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);

  return {
    closed,
    aceReady,
    /* The floor he runs on, as a y in the host's px: where the page's Little Ace is handed over. */
    floorY() {
      const visAce = 2 * (CAM_Z - ACE_Z) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      return (1 - ace.position.y / (visAce / 2)) / 2 * (host.clientHeight || window.innerHeight);
    },
    /* Take over from the page's Little Ace: start at his screen x, at his drawn height. If he is still in the air
       (screenY above the floor, falling at vy px/s, drifting at vx px/s) he finishes the fall, lands, then runs left. */
    handoff(screenX, screenH, screenY, vy, vx) {
      const W = host.clientWidth || window.innerWidth, Hh = host.clientHeight || window.innerHeight;
      const visAce = 2 * (CAM_Z - ACE_Z) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      aceS = Math.max(0.4, Math.min(2.5, (screenH / Hh) * visAce / ACE_H));
      const range = ace.userData.range || 5;
      aceX = Math.max(-range, Math.min(range, (screenX / W * 2 - 1) * (visAce / 2) * camera.aspect));
      aceDir = -1;
      const k = visAce / Hh;                                 // world units per screen px at his depth
      const up = screenY == null ? 0 : (this.floorY() - screenY) * k;
      if (up > 0.02 && !reduced) {
        airborne = true; airY = up; airVy = -(vy || 0) * k; airVx = (vx || 0) * k; airG = GRAVITY_PX * k;
      }
      handT = t0 ? (performance.now() - t0) / 1000 : 0;
      aceT = handT;
    },
    /* Swing shut now (gate.js calls this once the page's intro has played). Safe to call more than once. */
    close() {
      if (mode !== 'waiting') return;
      closeStart = t0 ? (performance.now() - t0) / 1000 : 0;
      mode = 'closing';
      // He comes in from the right, where the page's own Little Ace was standing when the intro ended, running left.
      aceX = (ace.userData.range || 5) * 0.8; aceDir = -1; aceT = closeStart;
    },
    open() {
      if (reduced || mode === 'done') return Promise.resolve();
      return new Promise((r) => { resolveOpen = r; openStart = (performance.now() - t0) / 1000; mode = 'opening'; });
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointerleave', offPointer);
      window.removeEventListener('blur', offPointer);
      document.removeEventListener('visibilitychange', onVis);
      built.forEach((g) => g.dispose());
      disposables.forEach((d) => d && d.dispose && d.dispose());
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) {}
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
  };
}

// ── shapes and textures ──────────────────────────────────────────────

// A full spade, used as the finial on top of each bar.
function finialGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 1);
  s.bezierCurveTo(-0.15, 0.62, -0.95, 0.25, -0.95, -0.2);
  s.bezierCurveTo(-0.95, -0.62, -0.42, -0.78, -0.12, -0.42);
  s.lineTo(-0.32, -1);
  s.lineTo(0.32, -1);
  s.lineTo(0.12, -0.42);
  s.bezierCurveTo(0.42, -0.78, 0.95, -0.62, 0.95, -0.2);
  s.bezierCurveTo(0.95, 0.25, 0.15, 0.62, 0, 1);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3, curveSegments: 14 });
  g.center();
  return g;
}

// The left half of the centre spade (x <= 0); the mirrored right gate supplies the other half.
function halfSpadeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 1);
  s.bezierCurveTo(-0.15, 0.62, -0.95, 0.25, -0.95, -0.2);
  s.bezierCurveTo(-0.95, -0.62, -0.42, -0.78, -0.12, -0.42);
  s.lineTo(-0.32, -1);
  s.lineTo(0, -1);
  s.lineTo(0, 1);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, 0, -0.07);
  return g;
}

// The light beyond the gates: a warm glow over a bank of soft cloud, fading to the site's near-black. No rays.
function paintSky() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 640;
  const x = c.getContext('2d');
  x.fillStyle = '#060505';
  x.fillRect(0, 0, c.width, c.height);
  let g = x.createRadialGradient(512, 250, 10, 512, 300, 620);
  g.addColorStop(0, 'rgba(240,214,160,0.42)');
  g.addColorStop(0.2, 'rgba(200,160,95,0.28)');
  g.addColorStop(0.5, 'rgba(110,78,34,0.16)');
  g.addColorStop(1, 'rgba(6,5,5,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  // cloud bank along the bottom third
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 140; i++) {
    const cx = rnd() * c.width, cy = 430 + rnd() * 170, r = 40 + rnd() * 110;
    const cg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const a = 0.035 + rnd() * 0.045;
    cg.addColorStop(0, `rgba(255,240,210,${a})`);
    cg.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = cg;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  return c;
}
