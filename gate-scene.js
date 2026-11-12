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

const OPEN = 1.57;            // rad: each half stands open edge-on to the viewer (90deg), out of sight at the screen edge
const OUT = 2.3;              // rad: how far they swing when they open for good: past edge-on, out of the frame entirely
const OUT_SWING = 1.7;        // s: that swing
const SWING = 2.6;            // s from open to the moment the halves meet: slow and heavy
const SETTLE = 0.9;           // s of rebound after they meet
const UNLOCK_S = 1.9;         // s the padlock takes to spring open, fall to the floor and settle before the gates start to swing
const CAM_Z = 14, FOV = 38;

// Sprite sheet: 8 columns of 240x280 cells, as many rows as the image has (read when it loads, because the sheet grows); the run cycle is cells 13-20 at 11fps (as in companion.js).
const COLS = 8, CELL_H = 280, RUN = [13, 14, 15, 16, 17, 18, 19, 20], RUN_FPS = 11, IDLE = 0;
const FALL = [28, 29], LAND = [30, 31, 32, 33], LAND_FPS = 17, GRAVITY_PX = 1650;   // the page companion's clips and gravity

export function start(host, opts = {}) {
  const reduced = !!opts.reduced;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;                           // the bars, rails and straps throw real shadows on each other and on the light behind
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
  const envRT = pmrem.fromScene(goldStudio(), 0.03);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  // ── light ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xfff1d6, 0.25));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  key.position.set(-1.3, 13, 6.5);                               // high: a shadow thrown by a tall gate lies squashed on the floor, not stretched across it
  key.castShadow = true;
  const SHADOW_PX = Math.min(4096, renderer.capabilities.maxTextureSize || 2048, (window.innerWidth < 700 ? 2048 : 4096));
  key.shadow.mapSize.set(SHADOW_PX, SHADOW_PX);
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.012; key.shadow.radius = 2.5;
  key.shadow.camera.near = 1; key.shadow.camera.far = 70;
  scene.add(key);
  scene.add(key.target);
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
  let parX = 0, parY = 0, parTX = 0, parTY = 0;                // the camera drifts a little toward the pointer: the bars slide over the light behind them, which is what gives the gap its depth
  function onPointer(e) {
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (!reduced) { parTX = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.6; parTY = -(((e.clientY - r.top) / r.height) * 2 - 1) * 0.12; }
    ray.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera).sub(camera.position).normalize();
    const k = (HEAT_Z - camera.position.z) / ray.z;                 // where the pointer's ray meets the heat plane
    heatTX = camera.position.x + ray.x * k; heatTY = camera.position.y + ray.y * k;
    if (!heatSeen) { heatX = heatTX; heatY = heatTY; heatSeen = true; }
    heatWant = 1;
  }
  const offPointer = () => { heatWant = 0; parTX = parTY = 0; };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('pointerleave', offPointer);
  window.addEventListener('blur', offPointer);

  // ── materials ──────────────────────────────────────────────────────
  // Polished gold that is not perfectly polished: a fine grain along each bar breaks the roughness up (so the highlights
  // are not uniform plastic-smooth), anisotropy stretches them along the bar the way brushed metal does, and a clear coat
  // gives the lacquered edge-glint real gilded ironwork has.
  const grain = grainTexture();
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xd99a3e, metalness: 1, roughness: 0.3, roughnessMap: grain, clearcoat: 0.4, clearcoatRoughness: 0.16, anisotropy: 0.35 });   // rich, warm gold
  const goldDeep = new THREE.MeshPhysicalMaterial({ color: 0xb47628, metalness: 1, roughness: 0.38, roughnessMap: grain, anisotropy: 0.25 });
  // A warm cream, not white: a white base blew out to a flat white disc under the lights, and the sheen and the
  // pink-green play of colour (iridescence) are what make it read as pearl rather than as a white ball.
  const pearl = new THREE.MeshPhysicalMaterial({
    color: 0xcdbea8, metalness: 0, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.85,
    sheen: 0.7, sheenColor: new THREE.Color(0xffd9c2), sheenRoughness: 0.4,
    iridescence: 1, iridescenceIOR: 1.4, iridescenceThicknessRange: [260, 480]
  });
  const disposables = [gold, goldDeep, pearl, envRT, pmrem, grain];
  /* The ground. A flat floor under the gates that shows nothing but the shadow the gates throw on it: with the light in front
     and above, the bars' shadows fall back and to the right along the floor, getting fainter with distance. */
  const shadowMat = new THREE.ShadowMaterial({ color: 0x120a02, opacity: 0, transparent: true, depthWrite: false });
  shadowMat.onBeforeCompile = (sh) => {
    const NL = String.fromCharCode(10);
    sh.vertexShader = 'varying float vGz;' + NL + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + NL + '  vGz = (modelMatrix * vec4(transformed, 1.0)).z;');
    sh.fragmentShader = 'varying float vGz;' + NL + sh.fragmentShader.replace('gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );',
      'gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * smoothstep(-26.0, -2.0, vGz) );');
  };
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMat);
  shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.receiveShadow = true; shadowCatch.renderOrder = 1;
  scene.add(shadowCatch);
  disposables.push(shadowCatch.geometry, shadowCatch.material);
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
  /* The spades (the finials along the arch and the big one on the medallion) are flat-faced, and a flat face reflects one
     single patch of the room: a dead flat colour. So their material bends the normal over each face as if the face were
     pillowed (a gradient map of a spade-shaped dome, read by the vertex's own x, y). The bevel and the rim are not touched. */
  const domeTex = domeTexture(spadeOutline(), 2.2, 0.11);
  const lockDomeTex = domeTexture(roundRectOutline(0.7, 0.56, 0.14), 1.0, 0.12);
  const domed = (mat, tex, span) => {
    molten(mat);
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh) => {
      prev(sh);
      sh.uniforms.uDome = { value: tex }; sh.uniforms.uDomeSpan = { value: span };
      const NL = String.fromCharCode(10);
      sh.vertexShader = 'varying vec2 vDomeP; varying vec3 vDomeN; varying vec3 vDomeX; varying vec3 vDomeY;' + NL + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>' + NL + '  vDomeP = position.xy; vDomeN = normal; vDomeX = normalMatrix * vec3(1.0, 0.0, 0.0); vDomeY = normalMatrix * vec3(0.0, 1.0, 0.0);');
      sh.fragmentShader = 'uniform sampler2D uDome; uniform float uDomeSpan; varying vec2 vDomeP; varying vec3 vDomeN; varying vec3 vDomeX; varying vec3 vDomeY;' + NL + sh.fragmentShader.replace('#include <normal_fragment_maps>', [
        '#include <normal_fragment_maps>',
        '{',
        '  float cap = smoothstep(0.82, 0.97, abs(normalize(vDomeN).z));',
        '  vec2 gg = (texture2D(uDome, vDomeP / uDomeSpan + 0.5).rg - 0.5) * 1.6;',
        '  normal = normalize(normal - (vDomeX * gg.x + vDomeY * gg.y) * cap);',
        '}'
      ].join(NL));
    };
    mat.customProgramCacheKey = () => 'domed' + span;
    mat.needsUpdate = true;
    return mat;
  };
  const goldSpade = domed(new THREE.MeshPhysicalMaterial({ color: 0xd8962e, metalness: 1, roughness: 0.34, envMapIntensity: 0.7 }), domeTex, 2.2);
  disposables.push(domeTex, lockDomeTex, goldSpade);

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
  let aceTex = null, aceMat = null, aceShadow = null, ROWS = 13;
  if (opts.atlasUrl) {
    new THREE.TextureLoader().load(opts.atlasUrl, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      ROWS = Math.round(t.image.height / CELL_H);
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
    }, undefined, () => {});                                  // no atlas, or it fails to load: the gates simply run without him
  }
  function setCell(i) {
    if (!aceTex) return;
    const c = i % COLS, r = Math.floor(i / COLS);
    aceTex.offset.set(c / COLS, 1 - (r + 1) / ROWS);
  }

  // ── the gates ───────────────────────────────────────────────────────
  const left = new THREE.Group(), right = new THREE.Group();
  scene.add(left, right);
  let built = [];
  let medal = { R: 0.9, cy: 0, w: 1, n: 5, step: 0.5, r: 0.04 };

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
    [left, right].forEach((p) => p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));
    layoutLock();
    buildShafts(half, H);
    buildWalls(half, H);
  }

  /* The walls either side of the gate. Each is a stone face that runs back from just behind the gate along the edge of what the
     camera sees, a hair outside it, so with the pointer in the middle nothing of it shows; as the camera drifts toward the pointer
     (the parallax), the frustum slides over and a sliver of stone comes into view on that side, lit by the same light and
     carrying the bars' shadows. They fade in and out with the world behind the gates. */
  const wallTex = stoneTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 2.2, color: 0x8e7d68, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, transparent: true, opacity: 0 });
  disposables.push(wallTex, wallMat);
  const walls = new THREE.Group(); scene.add(walls);
  let wallGeos = [];
  function buildWalls(half, H) {
    wallGeos.forEach((g) => g.dispose()); wallGeos = [];
    while (walls.children.length) walls.remove(walls.children[0]);
    const zw = -8.5, EPS = 0.06, yy = H * 2.2, WW = 8;
    for (const sd of [-1, 1]) {
      const edge = half * (CAM_Z - zw) / CAM_Z + EPS;                  // where the camera's view ends at the wall's depth
      const g = new THREE.PlaneGeometry(WW, yy * 2);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * WW / 1.4, uv.getY(k) * yy * 2 / 0.7);
      const m = new THREE.Mesh(g, wallMat); m.position.set(sd * (edge + WW / 2), 0, zw); m.receiveShadow = true; walls.add(m); wallGeos.push(g);
    }
  }

  // ── the lock ────────────────────────────────────────────────────────
  /* A padlock hung from a rod across the seam, from a ring, so the two halves are chained shut. It appears as the
     halves meet (the shackle drops closed with a glint), and when someone joins it springs open, falls to the floor,
     bounces and settles there, and only then do the gates swing. Its own materials, so it can be faded if it ever has to. */
  const lockMat = (m) => { m.transparent = true; return m; };
  const lGold = lockMat(new THREE.MeshPhysicalMaterial({ color: 0xeab04f, metalness: 1, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.12 }));
  const lBody = lockMat(domed(new THREE.MeshPhysicalMaterial({ color: 0xeab04f, metalness: 1, roughness: 0.2, clearcoat: 0.55, clearcoatRoughness: 0.1 }), lockDomeTex, 1.0));
  const lDeep = lockMat(new THREE.MeshPhysicalMaterial({ color: 0xb47628, metalness: 1, roughness: 0.36, roughnessMap: grain }));
  const lDark = lockMat(new THREE.MeshPhysicalMaterial({ color: 0x1c1409, metalness: 0.9, roughness: 0.45 }));
  molten(lGold); molten(lDeep);
  const lock = new THREE.Group(); lock.visible = false;
  const lockFall = new THREE.Group(), shackle = new THREE.Group();   // lockFall: the padlock itself (body + shackle), the part that drops; shackle pivots on its left leg, so it swings out sideways
  const lockGeos = [];
  const lockAdd = (parent, geo, mat, x, y, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); lockGeos.push(geo); return m; };
  {
    lockAdd(lock, new THREE.CylinderGeometry(0.04, 0.04, 1.0, 40), lDeep, 0, 0, 0, 0, 0, Math.PI / 2);        // the rod across the seam
    lockAdd(lock, new THREE.SphereGeometry(0.075, 40, 28), lGold, -0.5, 0, 0);
    lockAdd(lock, new THREE.SphereGeometry(0.075, 40, 28), lGold, 0.5, 0, 0);
    lockAdd(lock, new THREE.TorusGeometry(0.13, 0.03, 28, 96), lGold, 0, -0.06, 0, 0, Math.PI / 2, 0);        // the ring hung on the rod (its plane faces sideways)
    const bodyGeo = roundedBoxGeometry(0.64, 0.5, 0.2, 0.1);
    lockAdd(lockFall, bodyGeo, lBody, 0, 0, 0);
    const spade = finialGeometry();
    const sp = lockAdd(lockFall, spade, lDark, 0, -0.02, 0.115); sp.scale.setScalar(0.1);                      // a spade stamped into the face
    lockFall.position.set(0, -0.55, 0);
    lock.add(lockFall);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 32, 96, Math.PI), lDeep);               // the shackle: an arch whose legs sink into the body
    arc.position.set(0.17, 0, 0);                                // shackle group origin = its left leg
    lockGeos.push(arc.geometry);
    shackle.add(arc);
    lockAdd(shackle, new THREE.CylinderGeometry(0.04, 0.04, 0.3, 40), lDeep, 0, -0.15, 0);      // the long leg: stays in the body even when the loop is lifted
    lockAdd(shackle, new THREE.CylinderGeometry(0.04, 0.04, 0.08, 40), lDeep, 0.34, -0.04, 0);  // the short leg: its tip comes out of the body, so the ring can slide off it
    shackle.position.set(-0.17, 0.25, 0);                        // on top of the body (body centre is lockFall's origin)
    lockFall.add(shackle);
  }
  lock.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(lock);
  disposables.push(lGold, lBody, lDeep, lDark);
  /* The padlock turns about the centre of its loop (the loop's top sits in the ring, on the ring's own circle), so the ring
     slides along the loop. lockA is that turn: 0 is hanging upright, HOOK_A is turned far enough that the short leg's tip has
     cleared the ring. lockLift is how far the loop stands up out of the body (the body hangs lower while it is): 0 is locked. */
  const LOCK_LIFT = 0.16, HOOK_A = 2.2;
  let lockA = 0, lockLift = 0, lockDrop = 0, lockAlpha = 0, lockLand = -1;   // lockLand: when it first touches the floor
  /* The fall. Gravity pulls it down to the foot of the gate (the bottom rail), it bounces
     twice, smaller each time, and settles there with a lean. lockFallAt(s) is how far it has dropped, in the padlock's own
     units, s seconds after it was let go; lockDropMax is where the floor is. */
  const LOCK_G = 26, LOCK_REST = 0.28, LOCK_LEAN = 0.5;
  let lockDropMax = 3;
  function measureLockFall() {
    const s = lock.scale.x, floor = -H / 2 + 0.28 + 0.06;       // the foot of the gate: the bottom rail, not the line Little Ace runs on
    lockDropMax = Math.max(0.6, (lock.position.y - floor) / s - 0.4 - 0.30 - (0.25 + LOCK_LIFT) * Math.cos(LOCK_LEAN));   // 0.4: its half-height lying at an angle
  }
  function lockFallAt(s) {
    const D = lockDropMax, t1 = Math.sqrt(2 * D / LOCK_G);
    if (s < t1) return 0.5 * LOCK_G * s * s;
    let vb = LOCK_G * t1 * LOCK_REST, at = t1;
    for (let i = 0; i < 2; i++) {
      const tb = 2 * vb / LOCK_G;
      if (s < at + tb) { const dt = s - at; return D - (vb * dt - 0.5 * LOCK_G * dt * dt); }
      at += tb; vb *= LOCK_REST;
    }
    return D;
  }
  function layoutLock() {
    lock.position.set(0, medal.cy - medal.R + 0.1, 0.2);          // hung from the foot of the medallion ring
    lock.scale.setScalar(Math.min(1.1, 0.55 + medal.w * 0.2));
  }
  function applyLock() {
    const h = 0.25 + lockLift;                                   // the loop's centre, up from the body's centre
    lockFall.rotation.z = lockA;
    lockFall.position.set(h * Math.sin(lockA), -0.30 - h * Math.cos(lockA) - lockDrop, 0);   // turning about the loop's centre, which sits at (0, -0.30)
    shackle.position.set(-0.17, h, 0);
    [lGold, lBody, lDeep, lDark].forEach((m) => { m.opacity = lockAlpha; });
    lock.visible = lockAlpha > 0.01;
  }
  applyLock();

  // ── light through the bars ──────────────────────────────────────────
  /* Soft shafts of warm light slipping through every gap between the bars, fanning out from the bright bank behind: they
     fall across Little Ace as he runs, so the bars throw their stripes on him. One additive mesh; each shaft is a strip
     that is brightest in the upper middle and gone at both ends. Laid on a plane behind the gates, so their x is scaled to
     line up with the gaps as the camera sees them. */
  const shafts = new THREE.Group(); scene.add(shafts);
  const SHAFT_Z = -3.0;
  const shaftMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  disposables.push(shaftMat);
  let shaftGeo = null;
  function buildShafts(half, H) {
    if (shaftGeo) { shafts.remove(shafts.children[0]); shaftGeo.dispose(); shaftGeo = null; }
    const { w, n, step, r } = medal;
    const gaps = [];                                          // [x0, x1] in a half's own coordinates (hinge at 0, meeting stile at w)
    const bars = [0.2 - r];
    for (let i = 1; i < n; i++) bars.push(0.15 + i * step);
    bars.push(w - 0.135 + r);
    for (let i = 0; i + 1 < bars.length; i++) { const a = bars[i] + r, b = bars[i + 1] - r; if (b - a > 0.05) gaps.push([a, b]); }
    const k = (CAM_Z - SHAFT_Z) / CAM_Z;                      // the plane is further away: x grows so a shaft still sits in its gap on screen
    const pos = [], col = [], idx = [];
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const rows = [[H * 0.62, 0.0], [H * 0.22, 1.0], [-H * 0.5, 0.0]];    // [y, brightness]: brightest high up, gone at the floor
    const spread = [0.0, 0.0, 0.5];                           // the shafts fan wider toward the floor
    const addShaft = (xa, xb) => {
      const cx = (xa + xb) / 2, wd = (xb - xa) * k;
      const gain = 0.55 + 0.45 * rnd();
      const base = pos.length / 3;
      rows.forEach(([y, a], j) => {                           // three points across: clear at both edges, brightest down the middle, so a shaft has no hard edge
        const sx = cx * k * (1 + spread[j] * 0.14), sw = wd * (0.9 + spread[j] * 1.1);
        pos.push(sx - sw, y, SHAFT_Z, sx, y, SHAFT_Z, sx + sw, y, SHAFT_Z);
        const c = [1.0, 0.8 + 0.06 * a, 0.5 + 0.25 * a];
        col.push(...c, 0, ...c, a * 0.3 * gain, ...c, 0);
      });
      for (let j = 0; j < 2; j++) { const a0 = base + j * 3; idx.push(a0, a0 + 1, a0 + 4, a0, a0 + 4, a0 + 3, a0 + 1, a0 + 2, a0 + 5, a0 + 1, a0 + 5, a0 + 4); }
    };
    for (const [xa, xb] of gaps) { addShaft(-half + xa, -half + xb); addShaft(half - xb, half - xa); }
    shaftGeo = new THREE.BufferGeometry();
    shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shaftGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    shaftGeo.setIndex(idx);
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.frustumCulled = false; m.renderOrder = 2;
    shafts.add(m);
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
    add(new THREE.CylinderGeometry(0.1, 0.1, topY(0) - bottom + 0.2, 48), gold, 0.1, (topY(0) + bottom) / 2);
    add(new THREE.CylinderGeometry(0.075, 0.075, topY(w) - bottom + 0.1, 48), gold, w - 0.06, (topY(w) + bottom) / 2);
    // rails
    for (const y of [bottom, railLow, railMid, railHigh]) {
      const rail = add(new THREE.CylinderGeometry(0.055, 0.055, w - 0.1, 40), goldDeep, w / 2, y, 0, Math.PI / 2);
      rail.material = y === railMid ? gold : goldDeep;
    }
    // the arch, a tube along the top
    const pts = [];
    for (let i = 0; i <= 24; i++) { const x = 0.1 + (w - 0.16) * (i / 24); pts.push(new THREE.Vector3(x, topY(x), 0)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.07, 28, false), gold, 0, 0);
    // hinge straps: forged plates riveted across the hinge stile at three rails, which is how a gate this size is really hung
    const strapGeo = strapGeometry(0.66, 0.15), rivetGeo = new THREE.SphereGeometry(0.03, 24, 16);
    geos.push(strapGeo, rivetGeo);
    for (const y of [bottom, railMid, railHigh]) {
      const sp = new THREE.Mesh(strapGeo, goldDeep); sp.position.set(0.0, y, 0.06); g.add(sp);
      for (const x of [0.1, 0.34, 0.58]) { const rv = new THREE.Mesh(rivetGeo, gold); rv.position.set(x, y, 0.135); rv.scale.z = 0.7; g.add(rv); }
    }
    // bars, with spade ornaments mounted on the front of the arch
    const n = Math.max(5, Math.round((w - 0.3) / 0.46));
    const step = (w - 0.3) / n;
    const spadeGeo = finialGeometry();
    geos.push(spadeGeo);
    const pearlSmall = new THREE.SphereGeometry(0.085, 48, 32);
    geos.push(pearlSmall);
    // Collars: a rounded gold knuckle wrapping every joint, as forged ironwork has, so no bar is seen cutting
    // straight through a rail (the bare cylinder-through-cylinder seams are what read as parts pushed together).
    const knuckleGeo = new THREE.SphereGeometry(1, 32, 20);
    geos.push(knuckleGeo);
    const bobbinGeo = latheShape([[0, -2.6], [1.25, -2.6], [1.5, -2.4], [1.2, -2.15], [1.0, -1.95], [1.3, -1.35], [1.85, -0.65], [2.15, 0], [1.85, 0.65], [1.3, 1.35], [1.0, 1.95], [1.2, 2.15], [1.5, 2.4], [1.25, 2.6], [0, 2.6]]);
    geos.push(bobbinGeo);
    const knuckle = (x, y, rad) => { const k = new THREE.Mesh(knuckleGeo, gold); k.position.set(x, y, 0); k.scale.set(rad, rad, rad * 0.85); g.add(k); };
    const rails = [bottom, railLow, railMid, railHigh];
    for (let i = 1; i < n; i++) {
      const x = 0.15 + i * step, top = topY(x);
      add(new THREE.CylinderGeometry(r, r, top - bottom, 32), gold, x, (top + bottom) / 2);
      // turned bobbins: a swelling bead with a ring at each end, mid-way between every pair of rails, as on forged balusters
      const spans = [bottom, railLow, railMid, railHigh, top];
      for (let q = 0; q < 4; q++) { const yy = (spans[q] + spans[q + 1]) / 2; if (spans[q + 1] - spans[q] < 0.35) continue; const bb = new THREE.Mesh(bobbinGeo, gold); bb.position.set(x, yy, 0); bb.scale.set(r, r, r); g.add(bb); }
      const f = new THREE.Mesh(spadeGeo, goldSpade); f.position.set(x, top + 0.03, 0.1); f.scale.setScalar(0.2); g.add(f);   // on the arch's face, not on top of it
      for (const y of rails) knuckle(x, y, 0.074);
      knuckle(x, top, 0.088);
    }
    // where the rails and the arch meet the stiles, and a gold knob capping the hinge stile
    for (const y of rails) { knuckle(0.1, y, 0.12); knuckle(w - 0.06, y, 0.095); }
    knuckle(0.1, topY(0.1), 0.12);
    knuckle(w - 0.06, topY(w - 0.06), 0.1);
    const fin = new THREE.Mesh(finialLathe(), gold); fin.position.set(0.1, topY(0) + 0.08, 0); g.add(fin); geos.push(fin.geometry);   // a turned finial capping the hinge stile
    // rings between the high rail and the arch, every other gap, each holding a pearl
    for (let i = 0; i < n; i += 2) {
      const x = 0.15 + (i + 0.5) * step;
      const y = (railHigh + Math.min(topY(x), railHigh + 1.4)) / 2;
      const rad = Math.min(step * 0.42, 0.42);
      add(new THREE.TorusGeometry(rad, 0.03, 18, 100), gold, x, y);
      add(new THREE.TorusGeometry(0.115, 0.024, 16, 56), gold, x, y, 0.02);     // the pearl's bezel
      const p = new THREE.Mesh(pearlSmall, pearl); p.position.set(x, y, 0.02); p.scale.setScalar(1.15); g.add(p);
    }
    // half of the centre medallion: when the halves meet they make a full ring around a full spade
    // On a phone (portrait) the card sits at the top, over this medallion; raised to the high rail it stays hidden
    // behind the card instead of its bottom peeking out underneath.
    const R = Math.min(0.95, w * 0.3), cy = camera.aspect < 0.8 ? railHigh : (railMid + railHigh) / 2;
    medal = { R, cy, w, n, step, r };                           // where the lock hangs, and where the gaps between the bars are (for the light through them)
    const arc = add(new THREE.TorusGeometry(R, 0.075, 30, 140, Math.PI), gold, w - 0.02, cy, 0.04, Math.PI / 2);
    arc.rotation.y = 0;
    add(new THREE.TorusGeometry(R * 0.8, 0.028, 16, 100, Math.PI), gold, w - 0.02, cy, 0.04, Math.PI / 2);   // a second, finer ring inside it
    const stud = new THREE.SphereGeometry(0.095, 32, 20); geos.push(stud);
    for (const k of [1, 2, 4, 5]) { const th = Math.PI / 2 + k * Math.PI / 6; const sm = new THREE.Mesh(stud, gold); sm.position.set(w - 0.02 + R * Math.cos(th), cy + R * Math.sin(th), 0.05); g.add(sm); }   // studs round the ring
    const hs = new THREE.Mesh(halfSpadeGeometry(), goldSpade); hs.position.set(w, cy, 0.05); hs.scale.setScalar(R * 0.62); g.add(hs);
    geos.push(hs.geometry);
    const pc = new THREE.Mesh(pearlSmall, pearl); pc.position.set(w - 0.02 - R, cy, 0.06); pc.scale.setScalar(1.3); g.add(pc);
    // half of a spade crowning the peak where the halves meet, its foot on the arch
    const S2 = Math.min(0.34, w * 0.11) * 0.62, cy2 = topY(w) + S2 * 0.95;
    const hs2 = new THREE.Mesh(halfSpadeGeometry(), goldSpade); hs2.position.set(w, cy2, 0.05); hs2.scale.setScalar(S2); g.add(hs2);
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
    const ext = Math.max(W, H) * 0.85 + 6, sc = key.shadow.camera;
    const groundY = -H / 2 + 0.18;                             // the foot of the posts
    shadowCatch.position.set(0, groundY, -19); shadowCatch.scale.set(W * 5, 44, 1);
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    const dAce = CAM_Z - ACE_Z, visAce = 2 * dAce * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    aceFloor = ace.position.y = groundY;                        // he runs on the same ground the shadows fall on
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
    shadowCatch.material.opacity = 0.55 * v;
    wallMat.opacity = v;
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
  let hitAt = -1, unlockStart = 0, clankT = -1;
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
      const tt = t - closeStart;
      pose(closeAngle(tt));
      setVeil(Math.max(0, Math.min(1, tt / (SWING * 0.85))));
      if (tt >= SWING && hitAt < 0) { hitAt = t; }
      if (tt >= SWING + SETTLE) { mode = 'idle'; pose(0); resolveClosed(); }
    } else if (mode === 'opening') {
      // they swing all the way open, out past the screen edges, and are gone: nothing fades
      const p = Math.min(1, Math.max(0, (t - openStart) / OUT_SWING));
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      pose(OUT * e);
      setVeil(1 - Math.min(1, e * 1.25));
      if (p >= 1) { mode = 'done'; resolveOpen(); }
    }

    // the glint when they meet, and a breath of light on the gold the rest of the time
    const since = hitAt < 0 ? 99 : t - hitAt;
    flash.intensity = since < 1.2 ? 22 * Math.exp(-since * 4.5) : 0;
    key.position.x = -1.3 + Math.sin(t * 0.35) * 0.6;
    glow.intensity = 6 + Math.sin(t * 0.8) * 0.6;
    parX += (parTX - parX) * 0.05; parY += (parTY - parY) * 0.05;
    const shake = since < 0.25 && !reduced ? Math.sin(since * 90) * 0.035 * (1 - since / 0.25) : 0;
    camera.position.set(parX + shake, parY, CAM_Z);
    camera.lookAt(0, 0, 0);

    // The padlock. Locking (it appears as the halves meet): it turns in from the side, the free end of the loop passing through
    // the ring and the ring sliding round the loop until the padlock hangs upright; then the body is drawn up into the loop and
    // it locks, with a glint. Unlocking (someone joins): the loop stands up out of the body, the padlock turns until the free
    // end slips out of the ring, then it falls to the foot of the gate, bounces, settles and fades with the gates.
    const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    if (mode === 'opening' || mode === 'done') {
      const lt = t - unlockStart, d2 = lt - 0.6;
      const po = Math.min(1, Math.max(0, (t - openStart) / OUT_SWING)), eo = po < 0.5 ? 2 * po * po : 1 - Math.pow(-2 * po + 2, 2) / 2;
      lockAlpha = 1 - Math.min(1, eo * 1.7);                    // it fades with the gate, a little ahead of it (the gate's own light is gone at eo * 1.25)
      lockLift = LOCK_LIFT * ease(lt / 0.2);
      if (d2 > 0) {
        measureLockFall();
        const t1 = Math.sqrt(2 * lockDropMax / LOCK_G);
        lockDrop = lockFallAt(d2);
        lockA = HOOK_A + (LOCK_LEAN - HOOK_A) * Math.min(1, d2 / t1);   // it settles to its resting lean as it falls
        if (d2 >= t1 && lockLand < 0) lockLand = t;             // it touches the floor: a glint
      } else { lockDrop = 0; lockA = HOOK_A * ease((lt - 0.2) / 0.38); }
    } else if (hitAt >= 0) {
      lockAlpha = Math.min(1, since / 0.12);
      lockDrop = 0; lockLand = -1;
      lockA = HOOK_A * (1 - ease((since - 0.12) / 0.5));        // turns in: the free end through the ring, then round to upright
      lockLift = LOCK_LIFT * (1 - ease((since - 0.72) / 0.2));  // then the body is drawn up into the loop: it locks
      if (since >= 0.92 && clankT < 0) clankT = t;              // locked: one more glint
    } else if (startShut) { lockA = 0; lockLift = 0; lockAlpha = 1; lockDrop = 0; lockLand = -1; }
    else lockAlpha = 0;
    if (lockLand >= 0) flash.intensity += 9 * Math.exp(-(t - lockLand) * 10);
    if (clankT >= 0) flash.intensity += 10 * Math.exp(-(t - clankT) * 9);
    applyLock();
    // the light through the bars, stronger the moment the gates close
    shaftMat.opacity = veil * (0.78 + 0.22 * Math.sin(t * 0.8)) * (1 + (since < 0.8 ? 0.7 * Math.exp(-since * 4) : 0));

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
    stats() { const r = renderer.info.render; return { triangles: r.triangles, calls: r.calls, geometries: renderer.info.memory.geometries }; },
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
      return new Promise((r) => { resolveOpen = r; unlockStart = (performance.now() - t0) / 1000; openStart = unlockStart + UNLOCK_S; mode = 'opening'; });
    },
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);                              // a resize just before the gate is taken down must not rebuild a disposed scene
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('pointerleave', offPointer);
      window.removeEventListener('blur', offPointer);
      document.removeEventListener('visibilitychange', onVis);
      built.forEach((g) => g.dispose());
      lockGeos.forEach((g) => g.dispose());
      if (shaftGeo) shaftGeo.dispose();
      wallGeos.forEach((g) => g.dispose());
      disposables.forEach((d) => d && d.dispose && d.dispose());
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) {}
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    }
  };
}

// ── shapes and textures ──────────────────────────────────────────────

// The studio the gold reflects. Polished metal looks real because it reflects CONTRAST: dark room, hard bright light
// sources. So this is a dark box with a few very bright panels in it (tall strips left, right and front-left/right, a
// broad warm box overhead, a dim warm bounce below and a faint panel behind). On a round bar each strip becomes a long
// crisp highlight with true dark reflection between them, the way real gilded ironwork reads.
function goldStudio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(60, 40, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.03, 0.015), side: THREE.BackSide, toneMapped: false }));
  s.add(room);
  const panel = (w, h, x, y, z, rgb) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(22, 12, 0, 16, 0, [7, 5.6, 3.4]);          // overhead softbox, warm
  panel(1.6, 22, -14, 3, 5, [11, 8.6, 5.2]);      // tall strip, left: hot warm
  panel(1.6, 22, 14, 3, 5, [6, 6.8, 9]);            // tall strip, right: cool white
  panel(0.9, 20, -5.5, 4, 15, [13, 10.5, 7]);       // two thin hot strips in front, either side of the viewer
  panel(0.9, 20, 5.5, 4, 15, [8, 8, 8]);
  panel(36, 20, 0, 3, 17, [1.9, 1.3, 0.7]);        // a broad dim warm panel behind the viewer: flat faces turn gold, not dark brown
  panel(26, 3, 0, -9, 12, [1.6, 1.1, 0.6]);        // dim warm bounce from below
  panel(18, 10, 0, 3, -18, [3.2, 2.5, 1.5]);       // faint panel behind: lights the backs of things and gives edges a rim
  panel(2, 20, -17, 2, -6, [6, 4.6, 2.6]);         // warm rim strips, left and right behind
  panel(2, 20, 17, 2, -6, [4, 4.4, 5.5]);
  return s;
}

// Dark warm stone blocks in courses, with a little variation and mortar lines: the wall beside the gate.
function stoneTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#17120d'; x.fillRect(0, 0, 512, 256);
  let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rows = 4, bh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let px = -(r % 2) * 64 - rnd() * 20;
    while (px < 512) {
      const bw = 110 + rnd() * 70, l = 38 + rnd() * 16;
      x.fillStyle = 'hsl(' + (28 + rnd() * 8) + ',' + (16 + rnd() * 10) + '%,' + l + '%)';
      x.fillRect(px + 3, r * bh + 3, bw - 6, bh - 6);
      for (let k = 0; k < 90; k++) { x.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0' : '255,235,200') + ',' + (0.03 + rnd() * 0.05) + ')'; x.fillRect(px + 3 + rnd() * (bw - 8), r * bh + 3 + rnd() * (bh - 8), 2 + rnd() * 5, 1 + rnd() * 3); }
      px += bw;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// A fine grain that runs along the bars (the canvas's x is around a bar, its y along it), as a roughness map: the roughness
// varies a few percent from streak to streak, so no highlight is perfectly even.
function grainTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d'), img = x.createImageData(c.width, c.height);
  let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const col = new Float32Array(c.width);
  for (let i = 0; i < c.width; i++) col[i] = rnd();
  for (let i = 1; i < c.width; i++) col[i] = col[i - 1] * 0.5 + col[i] * 0.5;
  for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
    const k = Math.min(255, Math.round((0.78 + 0.2 * col[xx] + 0.04 * rnd()) * 255)), o = (y * c.width + xx) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = k; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

// The gradient of a pillow over a flat shape: red and green hold the slope in x and y (0.5 = flat). The shape's outline (pts,
// in the shape's own units) is filled, blurred widely (so the swell is smooth, with no ridge down the middle), and read as a
// height; the map covers -span/2 to span/2 and is looked up with the vertex's own x, y.
function domeTexture(pts, span, peak) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  x.fillStyle = '#fff'; x.beginPath();
  pts.forEach((p, k) => { const px = (p[0] / span + 0.5) * N, py = (0.5 - p[1] / span) * N; if (k) x.lineTo(px, py); else x.moveTo(px, py); });
  x.fill();
  const m = x.getImageData(0, 0, N, N).data;
  let h = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) h[k] = m[k * 4] / 255;
  const box = (src, r, horiz) => {                                        // one box-blur pass along a row or a column
    const o = new Float32Array(N * N), w = 2 * r + 1;
    for (let a = 0; a < N; a++) {
      let acc = 0;
      for (let b = -r; b <= r; b++) acc += src[horiz ? a * N + Math.min(N - 1, Math.max(0, b)) : Math.min(N - 1, Math.max(0, b)) * N + a];
      for (let b = 0; b < N; b++) {
        o[horiz ? a * N + b : b * N + a] = acc / w;
        const add = Math.min(N - 1, b + r + 1), sub = Math.max(0, b - r);
        acc += src[horiz ? a * N + add : add * N + a] - src[horiz ? a * N + sub : sub * N + a];
      }
    }
    return o;
  };
  const R = Math.round(N * 0.085);
  for (let k = 0; k < 3; k++) h = box(box(h, R, true), R, false);          // three passes: close to a gaussian
  for (let k = 0; k < N * N; k++) { const t = Math.min(1, Math.max(0, (h[k] - 0.12) / 0.85)); h[k] = peak * t * t * (3 - 2 * t); }
  const out = new Uint8Array(N * N * 4), px = span / N;
  for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
    const xl = h[y * N + Math.max(0, xx - 1)], xr = h[y * N + Math.min(N - 1, xx + 1)];
    const yu = h[Math.max(0, y - 1) * N + xx], yd = h[Math.min(N - 1, y + 1) * N + xx];
    const gx = (xr - xl) / (2 * px), gy = (yu - yd) / (2 * px);            // the shape's y runs up, the canvas's runs down
    const o = ((N - 1 - y) * N + xx) * 4;                                  // texture row 0 is the shape's lowest y
    out[o] = Math.max(0, Math.min(255, Math.round(128 + gx / 0.8 * 127)));
    out[o + 1] = Math.max(0, Math.min(255, Math.round(128 + gy / 0.8 * 127)));
    out[o + 2] = 128; out[o + 3] = 255;
  }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function spadeOutline() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1);
  sh.bezierCurveTo(-0.15, 0.62, -0.95, 0.25, -0.95, -0.2);
  sh.bezierCurveTo(-0.95, -0.62, -0.42, -0.78, -0.12, -0.42);
  sh.lineTo(-0.32, -1); sh.lineTo(0.32, -1); sh.lineTo(0.12, -0.42);
  sh.bezierCurveTo(0.42, -0.78, 0.95, -0.62, 0.95, -0.2);
  sh.bezierCurveTo(0.95, 0.25, 0.15, 0.62, 0, 1);
  return sh.getPoints(48).map((p) => [p.x, p.y]);
}
function roundRectOutline(w, h, r) {
  const o = [];
  [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]].forEach(([cx, cy, a0]) => {
    for (let k = 0; k <= 12; k++) { const a = (a0 + k * 7.5) * Math.PI / 180; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  });
  return o;
}

// A smooth turned shape: pts are [radius, height] pairs through which a spline passes, spun round the y axis.
function latheShape(pts, seg = 32) {
  const curve = new THREE.SplineCurve(pts.map((p) => new THREE.Vector2(p[0], p[1])));
  const v = curve.getPoints(pts.length * 4).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  return new THREE.LatheGeometry(v, seg);
}
// The finial on top of the hinge stile: a ring, a neck, a ball, a point: about 0.5 tall.
function finialLathe() {
  return latheShape([[0, 0], [0.1, 0], [0.122, 0.025], [0.124, 0.06], [0.09, 0.09], [0.056, 0.13], [0.052, 0.17], [0.09, 0.22], [0.128, 0.285], [0.134, 0.345], [0.105, 0.415], [0.052, 0.465], [0.014, 0.5], [0, 0.515]], 64);
}

// A hinge strap: a flat plate with a rounded far end, its hinge end at x = 0.
function strapGeometry(len, h) {
  const s = new THREE.Shape(), r = h / 2;
  s.moveTo(0, -r); s.lineTo(len - r, -r); s.absarc(len - r, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(0, r); s.lineTo(0, -r);
  return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 6, curveSegments: 36 });
}

// A rounded slab, centred on the origin, for the padlock's body.
function roundedBoxGeometry(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 8, curveSegments: 28 });
  g.translate(0, 0, -d / 2);
  return g;
}

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
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 6, curveSegments: 24 });
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
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 24 });
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
