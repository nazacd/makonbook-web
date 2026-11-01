// The landing page. The markup, styles and the WebGL scene are the designed
// page as delivered (docs/handoff.md section 8); this file only changes how
// it loads: the hero and its buttons are plain HTML and show at once, and
// the scene's libraries (three.js, then MathJax) are fetched from /vendor
// after the first paint, so a phone on mobile data sees the page before
// downloading 2.7 MB of scripts.

// Where the buttons go: the practice site, made for laptops.
var PRACTICE_URL = 'https://sat.makonbook.uz';
// The app on Google Play, once it is published. On an Android phone the
// buttons offer the app instead of the practice site. Empty until then.
var PLAY_URL = '';

// MathJax reads this when it loads; it must exist before the script does. The
// page only converts formulas to images, so no context menu: its stylesheets
// are inline styles the page's CSP refuses.
window.MathJax = { svg: { fontCache: 'none' }, startup: { typeset: false }, options: { enableMenu: false } };

(function links(){
  var phone = PLAY_URL && /Android/i.test(navigator.userAgent) && matchMedia('(pointer: coarse)').matches;
  document.querySelectorAll('[data-practice]').forEach(function(a){
    a.href = phone ? PLAY_URL : PRACTICE_URL;
    if (phone) a.firstChild.nodeValue = 'Get the app ';
  });
})();

function loadScript(src){
  return new Promise(function(resolve, reject){
    var s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = function(){ reject(new Error('failed to load ' + src)); };
    document.head.appendChild(s);
  });
}

// No WebGL (or no three.js): the page is the hero alone, as designed.
function noScene(){
  document.documentElement.classList.add('nogl');
  var canvas = document.getElementById('scene');
  if (canvas) canvas.remove();
}

// After the first paint (two frames in), fetch three.js and start the scene.
requestAnimationFrame(function(){
  requestAnimationFrame(function(){
    loadScript('/vendor/three-r128.min.js').then(startScene, noScene);
  });
});

function startScene(){
  var topbar = document.getElementById('topbar');
  var hero = document.getElementById('hero');
  var heroCta = document.getElementById('heroCta');
  var cue = document.getElementById('cue');
  // if the student hasn't scrolled after a few seconds, the scroll cue nudges harder
  setTimeout(function(){ if (scrollY < 10) cue.classList.add('nudge'); }, 3500);
  var finale = document.getElementById('finale');
  var finBrand = document.getElementById('finBrand');
  finBrand.querySelector('img').src = topbar.querySelector('.brand img').src;
  var canvas = document.getElementById('scene');

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  var Q = small ? 0.55 : 1;

  var renderer;
  try {
    if (!window.THREE) throw new Error('no three');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    noScene();
    return;
  }
  // The scene is running: the page gets its scroll track and the cue (styles.css).
  document.documentElement.classList.add('scene');
  // The formulas and symbols in the scene are drawn with MathJax (2 MB):
  // loaded only now, once there is a scene to draw them in.
  loadScript('/vendor/mathjax-3.2.2-tex-svg.js').catch(function(){});

  var BG = 0x07061a;
  var PR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(BG, 1);

  var scene = new THREE.Scene();
  var FOV = 62;
  var camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 220);
  scene.add(camera);

  // ---------- Staircase geometry (sampled into particles) ----------
  var N = 61, D = 1.0, H = 0.32, W = 3.4, Z0 = -1.5, LAND = 9, LW = W * 1.8;
  var sPos = [], sBright = [];
  function pt(x, y, z, b){ sPos.push(x, y, z); sBright.push(b); }
  function line(x1, y1, z1, x2, y2, z2, n, b){
    for (var i = 0; i < n; i++) {
      var t = (i + Math.random() * 0.6) / n;
      pt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t, b);
    }
  }
  function rect(x1, x2, y, z1, z2, n, b){
    for (var i = 0; i < n; i++) pt(x1 + Math.random() * (x2 - x1), y, z1 + Math.random() * (z2 - z1), b);
  }
  function c(n){ return Math.max(2, Math.round(n * Q)); }
  var i;
  for (i = 0; i < N - 1; i++) {
    var top = (i + 1) * H, zf = Z0 - i * D, zb = Z0 - (i + 1) * D + D * 0.05;
    line(-W / 2, top, zf, W / 2, top, zf, c(56), 1);
    line(-W / 2, top, zf, -W / 2, top, zb, c(14), 0.85);
    line(W / 2, top, zf, W / 2, top, zb, c(14), 0.85);
    rect(-W / 2, W / 2, top, zf, zb, c(42), 0.28);
    for (var r = 0; r < c(18); r++) pt(-W / 2 + Math.random() * W, top - Math.random() * H, zf, 0.18);
    if (i % 5 === 0) line(-W / 2 - 0.15, top, zf, -W / 2 - 0.8, top, zf, c(8), 0.9);
  }
  var lt = N * H, lz = Z0 - (N - 1) * D;
  line(-LW / 2, lt, lz, LW / 2, lt, lz, c(110), 1);
  line(-LW / 2, lt, lz, -LW / 2, lt, lz - LAND, c(70), 0.85);
  line(LW / 2, lt, lz, LW / 2, lt, lz - LAND, c(70), 0.85);
  rect(-LW / 2, LW / 2, lt, lz, lz - LAND, c(520), 0.3);
  rect(-W * 0.9, W * 0.9, 0, Z0 + 4, Z0, c(140), 0.15);

  var SC = sPos.length / 3;
  var scatter = new Float32Array(SC * 3), delay = new Float32Array(SC), srnd = new Float32Array(SC);
  var asp0 = Math.max(innerWidth / innerHeight, 0.75);
  for (i = 0; i < SC; i++) {
    var zd = 3 + Math.pow(Math.random(), 0.75) * 26;
    scatter[i * 3] = (Math.random() * 2 - 1) * zd * 0.62 * asp0;
    scatter[i * 3 + 1] = 1.6 + zd * 0.16 + (Math.random() * 2 - 1) * zd * 0.62;
    scatter[i * 3 + 2] = -1 - zd;
    delay[i] = Math.min(1, Math.max(0, (-sPos[i * 3 + 2] - 1) / 70)) * 0.7 + Math.random() * 0.3;
    srnd[i] = Math.random();
  }
  var stairGeo = new THREE.BufferGeometry();
  stairGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  stairGeo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  stairGeo.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  stairGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(sBright, 1));
  stairGeo.setAttribute('aRand', new THREE.BufferAttribute(srnd, 1));
  var stOff = new Float32Array(SC * 2), stVel = new Float32Array(SC * 2);   // cursor surf state, screen units
  var stSurfAttr = new THREE.BufferAttribute(stOff, 2);
  stSurfAttr.setUsage(THREE.DynamicDrawUsage);
  stairGeo.setAttribute('aSurf', stSurfAttr);

  var stairU = {
    uA: { value: 0 }, uTime: { value: 0 },
    uAspect: { value: 1 },
    uPR: { value: PR }, uSize: { value: 0.085 }, uFog: { value: 0.05 },
    uCold: { value: new THREE.Color('#6f86d6') },
    uHot: { value: new THREE.Color('#d6d8ff') },
    uPurple: { value: new THREE.Color('#7c3aed') }
  };
  var stairMat = new THREE.ShaderMaterial({
    uniforms: stairU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute vec3 aScatter; attribute float aDelay; attribute float aBright; attribute float aRand; attribute vec2 aSurf;',
      'uniform float uA; uniform float uTime; uniform float uAspect;',
      'uniform float uPR; uniform float uSize; uniform float uFog;',
      'varying float vB; varying float vFog; varying float vP; varying float vR;',
      'void main(){',
      ' float p = clamp((uA - aDelay * 0.55) / 0.45, 0.0, 1.0);',
      ' p = p * p * (3.0 - 2.0 * p);',
      ' vec3 drift = vec3(sin(uTime * 0.3 + aRand * 40.0), cos(uTime * 0.27 + aRand * 31.0), sin(uTime * 0.2 + aRand * 17.0)) * 0.35;',
      ' vec3 pos = mix(aScatter + drift, position, p);',
      ' pos.y += sin(p * 3.14159) * (0.6 + aRand * 1.4);',
      ' vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
      ' vec4 cp = projectionMatrix * mv;',
      ' cp.xy += vec2(aSurf.x / uAspect, aSurf.y) * cp.w;',   // cursor surf offset (see surfStep)
      ' gl_Position = cp;',
      ' float depth = max(-mv.z, 0.6);',
      ' gl_PointSize = min(uSize * uPR * (0.55 + aBright * 0.7) * (0.6 + aRand * 0.8) * 300.0 / depth, 48.0);',
      ' vFog = exp(-uFog * uFog * depth * depth);',
      ' vB = aBright; vP = p; vR = aRand;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uCold; uniform vec3 uHot; uniform vec3 uPurple;',
      'varying float vB; varying float vFog; varying float vP; varying float vR;',
      'void main(){',
      ' vec2 c = gl_PointCoord - 0.5; float d = length(c);',
      ' float a = smoothstep(0.5, 0.0, d); a *= a;',
      ' float b = mix(0.55, vB, vP);',
      ' vec3 col = mix(uCold, uHot, b * vP);',
      ' col = mix(col, uPurple * 1.3, step(0.78, vR));',
      ' gl_FragColor = vec4(col, a * (0.3 + 0.7 * b) * (0.6 + 0.4 * vR) * vFog);',
      '}'
    ].join('\n')
  });
  var stairs = new THREE.Points(stairGeo, stairMat);
  stairs.frustumCulled = false;
  scene.add(stairs);

  // ---------- Distant star dust ----------
  var DUST = Math.round(1200 * Q);
  var dp = new Float32Array(DUST * 3);
  for (i = 0; i < DUST; i++) {
    dp[i * 3] = (Math.random() - 0.5) * 60;
    dp[i * 3 + 1] = -8 + Math.random() * (N * H + 34);
    dp[i * 3 + 2] = 4 - Math.random() * (N * D + 50);
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  var dustMat = new THREE.PointsMaterial({ color: 0x8aa2ff, size: 0.05, transparent: true, opacity: 0.55, depthWrite: false });
  scene.fog = new THREE.FogExp2(BG, 0.05);
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ---------- Cosmic cloud and comets, far behind everything ----------
  // Both live in a group that follows the camera's position and pitch, so they sit "at infinity".
  var DSKY = 150, TANH = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  var sky = new THREE.Group();
  scene.add(sky);
  // A far galaxy band with dust lanes and faint stars, painted once on the GPU into a 2:1 texture.
  // Colours follow the reference: indigo and purple body, magenta and light pink along the band, lavender wisps.
  var NEB_FRAG = [
    'varying vec2 vUv;',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);',
    ' return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 r = mat2(0.8, 0.6, -0.6, 0.8);',
    ' for (int i = 0; i < 6; i++) { s += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; } return s / 0.984; }',
    'void main(){',
    ' vec2 uv = vUv, p = vec2(uv.x * 2.0, uv.y) * 3.0 + 3.7;',
    // the band: a gentle diagonal across the upper sky, above the stairs
    ' float bandY = 0.64 + 0.16 * (uv.x - 0.5) + 0.05 * sin(uv.x * 5.0 + 1.3);',
    ' vec2 q = vec2(fbm(p + vec2(0.0, 1.7)), fbm(p + vec2(5.2, 1.3)));',
    ' float dy = uv.y - bandY + (fbm(p * 0.7 + 3.0) - 0.5) * 0.2;',
    ' float band = exp(-dy * dy / 0.01), halo = exp(-dy * dy / 0.05);',
    ' float n = fbm(p * 1.7 + 2.2 * q);',                                         // fine filaments
    ' float lanes = smoothstep(0.48, 0.74, fbm(p * 2.6 + 4.0 * q + 7.0));',          // dark dust lanes
    ' float dens = (band * smoothstep(0.35, 0.85, n) + halo * smoothstep(0.45, 0.95, n) * 0.4) * (1.0 - 0.8 * lanes * band);',
    ' dens += smoothstep(0.58, 0.95, fbm(p * 0.9 + 20.0)) * smoothstep(0.5, 0.95, n) * 0.3;',   // a few faint side clouds
    ' vec2 cc = vec2((uv.x - 0.22) * 2.0, uv.y - bandY);',
    ' float core = exp(-dot(cc, cc) / 0.018);',                                   // a soft, restrained core near the left
    ' vec3 indigo = vec3(0.16, 0.18, 0.46), purple = vec3(0.31, 0.18, 0.42), magenta = vec3(0.66, 0.31, 0.56);',
    ' vec3 pink = vec3(0.91, 0.74, 0.91), lav = vec3(0.82, 0.82, 0.94);',
    ' float m = fbm(p * 0.8 + 40.0);',
    ' vec3 col = mix(indigo, purple, smoothstep(0.3, 0.55, m));',
    ' col = mix(col, magenta, clamp(smoothstep(0.42, 0.62, m) * band + 0.35 * band, 0.0, 1.0));',
    ' col = mix(col, lav, smoothstep(0.62, 0.88, n) * (1.0 - band) * 0.6);',
    ' col = mix(col, pink, clamp(core * 0.55 + smoothstep(0.7, 0.95, n) * band * 0.35, 0.0, 1.0));',
    ' vec3 light = col * dens * (1.0 - 0.35 * core) + pink * core * 0.12 * (0.6 + 0.4 * n);',
    // many faint, far stars, denser along the band
    ' vec2 sp = uv * vec2(700.0, 350.0), cell = floor(sp), f = fract(sp) - 0.5;',
    ' float star = step(0.986 - 0.025 * (band + 0.5 * halo), hash(cell + 3.7)) * pow(hash(cell + 9.1), 3.0) * smoothstep(0.5, 0.0, length(f));',
    ' light += vec3(0.86, 0.86, 1.0) * star * 0.9;',
    ' gl_FragColor = vec4(light, 1.0);',
    '}'
  ].join('\n');
  function nebulaTexture(){
    var W = small ? 1024 : 2048;
    var rt = new THREE.WebGLRenderTarget(W, W / 2, { depthBuffer: false });
    var mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: NEB_FRAG, depthTest: false, depthWrite: false
    });
    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat), sc = new THREE.Scene();
    quad.frustumCulled = false;
    sc.add(quad);
    renderer.setRenderTarget(rt);
    renderer.render(sc, new THREE.Camera());
    renderer.setRenderTarget(null);
    mat.dispose(); quad.geometry.dispose();
    return rt.texture;
  }
  var nebU = { uTex: { value: null }, uAspect: { value: 1 }, uTime: { value: 0 }, uOp: { value: 0.7 } };
  var neb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: nebU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D uTex; uniform float uAspect; uniform float uTime; uniform float uOp;',
      'varying vec2 vUv;',
      // cover the plane with the 2:1 texture without stretching it
      'vec2 cover(vec2 uv, float s, vec2 off){ vec2 c = uv - 0.5; if (uAspect > 2.0) c.y *= 2.0 / uAspect; else c.x *= max(uAspect / 2.0, 0.36); return c * s + 0.5 + off; }',
      'void main(){',
      ' vec3 col = texture2D(uTex, cover(vUv, 1.0, vec2(sin(uTime * 0.01) * 0.003, 0.0))).rgb;',   // all but still: it is very far away
      ' vec2 q = vUv - vec2(0.5, 0.42); q.x *= uAspect;',
      ' col *= 0.5 + 0.5 * smoothstep(0.08, 0.5, length(q));',   // keep the stairs' corridor clearer
      ' gl_FragColor = vec4(col * uOp, 1.0);',
      '}'
    ].join('\n')
  }));
  neb.position.z = -DSKY; neb.renderOrder = -10; neb.frustumCulled = false;
  sky.add(neb);
  setTimeout(function(){ nebU.uTex.value = nebulaTexture(); }, 0);   // paint after the first frame is up
  neb.visible = false;

  // comets: a white head with a pink tail, flying only through the upper sky and the side zones
  function cometTexture(){
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 32;
    var g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 236, 0);
    gr.addColorStop(0, 'rgba(244,193,214,0)'); gr.addColorStop(0.7, 'rgba(233,163,198,0.45)'); gr.addColorStop(1, 'rgba(255,240,248,0.95)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 16); g.lineTo(236, 11); g.lineTo(236, 21); g.closePath(); g.fill();
    var hd = g.createRadialGradient(236, 16, 0, 236, 16, 16);
    hd.addColorStop(0, 'rgba(255,255,255,1)'); hd.addColorStop(0.35, 'rgba(244,193,214,0.7)'); hd.addColorStop(1, 'rgba(159,92,192,0)');
    g.fillStyle = hd; g.fillRect(216, 0, 40, 32);
    return new THREE.CanvasTexture(cv);
  }
  var cometTex = cometTexture(), comets = [], nextComet = 2 + Math.random() * 3;
  for (i = 0; i < 3; i++) {
    var cm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cometTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    cm.renderOrder = -9; cm.visible = false; cm.frustumCulled = false;
    sky.add(cm);
    comets.push({ mesh: cm, on: false, t: 0, life: 1, x0: 0, y0: 0, dx: 0, dy: 0, dist: 0, len: 0 });
  }
  // in screen terms (x: -1..1 across, y: -1..1 up): the upper sky, or the sides away from the stairs
  function skyFree(x, y){ return y > 0.55 || (Math.abs(x) > 0.55 && y > -0.35); }
  function launchComet(cmt){
    var asp = camera.aspect;
    for (var tries = 0; tries < 24; tries++) {
      var x0 = (Math.random() * 2 - 1) * asp, y0 = 0.1 + Math.random() * 0.9;              // start, in half-screen-height units
      var ang = 0.25 + Math.random() * 0.6, sx = Math.random() < 0.5 ? 1 : -1;            // heading down and across
      var dx = Math.cos(ang) * sx, dy = -Math.sin(ang), dist = 0.25 + Math.random() * 0.2, len = 0.09 + Math.random() * 0.07, ok = true;
      for (var k = -1; k <= 6 && ok; k++) {                                                // tail at the start, then the head along the path
        var px = x0 + dx * (k < 0 ? -len : dist * k / 6), py = y0 + dy * (k < 0 ? -len : dist * k / 6);
        ok = skyFree(px / asp, py) && Math.abs(px / asp) < 1.05 && py < 1.05;
      }
      if (!ok) continue;
      cmt.on = true; cmt.t = 0; cmt.life = 1.6 + Math.random() * 1.0;
      cmt.x0 = x0; cmt.y0 = y0; cmt.dx = dx; cmt.dy = dy; cmt.dist = dist; cmt.len = len;
      cmt.mesh.rotation.z = Math.atan2(dy, dx);
      cmt.mesh.visible = true;
      return;
    }
  }

  // ---------- Score markers beside the stairs ----------
  var labelMats = [];
  function buildLabels(){
    for (var k = 0; k <= 60; k += 5) {
      var score = 400 + (k / 5) * 100;
      var cv = document.createElement('canvas');
      cv.width = 256; cv.height = 96;
      var g = cv.getContext('2d');
      g.font = '500 62px "Geist Mono", ui-monospace, Menlo, monospace';
      g.fillStyle = score === 1600 ? '#9b6bff' : '#a9addf';
      g.textBaseline = 'middle';
      g.textAlign = 'right';
      g.fillText(String(score), 248, 52);
      var tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      labelMats.push(mat);
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), mat);
      var tp = k === 60 ? N * H : (k + 1) * H;
      mesh.position.set(k === 60 ? -LW / 2 - 1.55 : -W / 2 - 1.6, tp + 0.42, Z0 - k * D);
      scene.add(mesh);
    }
  }

  // ---------- Ambient particles drifting in front of the camera ----------
  var COUNT = small ? 3300 : 7400;
  var DIST = 9, halfH = 1, halfW = 1;
  function measure(){
    halfH = DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    halfW = halfH * camera.aspect;
  }

  var pos = new Float32Array(COUNT * 3), vel = new Float32Array(COUNT * 3), cloudN = new Float32Array(COUNT * 3);
  var phase = new Float32Array(COUNT), prnd = new Float32Array(COUNT);
  var CLOUD_SIZE = 0.08;
  measure();
  for (i = 0; i < COUNT; i++) {
    cloudN[i * 3] = Math.random() * 2 - 1;
    cloudN[i * 3 + 1] = Math.random() * 2 - 1;
    cloudN[i * 3 + 2] = Math.random() * 2 - 1;
    pos[i * 3] = cloudN[i * 3] * halfW * 1.15;
    pos[i * 3 + 1] = cloudN[i * 3 + 1] * halfH * 1.05;
    pos[i * 3 + 2] = cloudN[i * 3 + 2] * 3;
    phase[i] = Math.random() * Math.PI * 2;
    prnd[i] = Math.random();
  }
  var pGeo = new THREE.BufferGeometry();
  var posAttr = new THREE.BufferAttribute(pos, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('position', posAttr);
  pGeo.setAttribute('aRand', new THREE.BufferAttribute(prnd, 1));

  var pMat = new THREE.ShaderMaterial({
    uniforms: {
      uPR: { value: PR }, uSize: { value: CLOUD_SIZE }, uDim: { value: 1 },
      uCloud: { value: new THREE.Color('#7088d8') },
      uPurple: { value: new THREE.Color('#7c3aed') }
    },
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute float aRand;',
      'uniform float uPR; uniform float uSize; uniform float uDim; uniform vec3 uCloud; uniform vec3 uPurple;',
      'varying vec3 vCol; varying float vA;',
      'void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);',
      ' gl_PointSize = min(uSize * uPR * 300.0 / max(-mv.z, 0.6) * (0.55 + aRand), 48.0);',
      ' gl_Position = projectionMatrix * mv;',
      ' vCol = mix(uCloud, uPurple * 1.3, step(0.75, aRand) * 0.85);',
      ' vA = 0.32 * (0.55 + 0.45 * aRand) * uDim; }'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vCol; varying float vA;',
      'void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);',
      ' float a = smoothstep(0.5, 0.0, d); a *= a;',
      ' gl_FragColor = vec4(vCol, a * vA); }'
    ].join('\n')
  });
  var rig = new THREE.Group();
  var points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  points.renderOrder = 4;
  rig.add(points);
  scene.add(rig);

  // ---------- SAT math formulas (rendered from LaTeX) and SAT words ----------
  var FORMULAS = [
    ['x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', 'x = (−b ± √(b²−4ac))/2a'],
    ['a^2+b^2=c^2', 'a² + b² = c²'],
    ['y=mx+b', 'y = mx + b'],
    ['m=\\frac{y_2-y_1}{x_2-x_1}', 'm = (y₂−y₁)/(x₂−x₁)'],
    ['(x-h)^2+(y-k)^2=r^2', '(x−h)² + (y−k)² = r²'],
    ['A=\\pi r^2', 'A = πr²'],
    ['C=2\\pi r', 'C = 2πr'],
    ['V=\\pi r^2 h', 'V = πr²h'],
    ['A=\\tfrac{1}{2}bh', 'A = ½bh'],
    ['V=lwh', 'V = lwh'],
    ['\\sin\\theta=\\frac{\\mathrm{opp}}{\\mathrm{hyp}}', 'sin θ = opp/hyp'],
    ['\\sin^2\\theta+\\cos^2\\theta=1', 'sin²θ + cos²θ = 1'],
    ['\\sin x=\\cos(90^\\circ-x)', 'sin x = cos(90° − x)'],
    ['y=a(x-h)^2+k', 'y = a(x−h)² + k'],
    ['f(x)=ax^2+bx+c', 'f(x) = ax² + bx + c'],
    ['b^2-4ac', 'b² − 4ac'],
    ['y=a(1+r)^t', 'y = a(1+r)ᵗ'],
    ['x^a\\cdot x^b=x^{a+b}', 'xᵃ·xᵇ = xᵃ⁺ᵇ'],
    ['\\bar{x}=\\frac{\\sum x}{n}', 'x̄ = Σx / n'],
    ['180^\\circ=\\pi\\ \\mathrm{rad}', '180° = π rad'],
    ['|x-a|<b', '|x − a| < b'],
    ['s\\sqrt{2}', 's√2'],
    ['\\triangle ABC\\sim\\triangle DEF', '△ABC ∼ △DEF'],
    ['\\frac{a}{b}=\\frac{c}{d}', 'a/b = c/d'],
    ['x_1+x_2=-\\frac{b}{a}', 'x₁ + x₂ = −b/a'],
    ['d=rt', 'd = rt']
  ].map(function(p){ return { tex: p[0], plain: p[1], img: null }; });

  var WORDS = ['ubiquitous','ephemeral','meticulous','tenacious','eloquent','pragmatic','ambivalent','scrupulous','cogent','lucid','enigmatic','prolific','candid','resilient','disparate','mitigate','ostensible','laconic','benevolent','esoteric','pernicious','sagacious','zealous','austere','fortuitous','juxtapose','placate','vindicate','tenuous','incisive','venerate','alacrity','equivocal','perfunctory','quintessential','gregarious','obstinate','candor','lucrative','superfluous'];

  function shuffle(a){ for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  var FAM = '"Bricolage Grotesque",ui-sans-serif,system-ui,"Segoe UI",sans-serif';
  var MATH_FAM = '"Cambria Math","STIX Two Math","Times New Roman",serif';
  var WORD_FAM = '"Times New Roman",Tinos,Times,serif';

  // LaTeX -> SVG image via MathJax; done(img, width, height) runs once the image has loaded.
  function texImage(tex, done){
    try {
      var node = MathJax.tex2svg(tex, { display: false });
      var svg = node.querySelector('svg');
      if (!svg || svg.querySelector('[data-mml-node="merror"]')) return;
      var w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
      if (!w || !h) return;
      var PX = 26;
      svg.setAttribute('width', (w * PX) + 'px');
      svg.setAttribute('height', (h * PX) + 'px');
      svg.setAttribute('color', '#ffffff');
      svg.style.color = '#ffffff';   // through the CSSOM, which the page's CSP allows (a style attribute isn't)
      if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      var str = new XMLSerializer().serializeToString(svg);
      var img = new Image();
      img.onload = function(){ done(img, w * PX, h * PX); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
    } catch (e) {}
  }
  function renderFormulas(){
    FORMULAS.forEach(function(f){
      texImage(f.tex, function(img, iw, ih){ f.img = img; f.iw = iw; f.ih = ih; });
    });
    SYMS.forEach(function(sy, si){
      if (sy[4]) texImage(sy[4], function(img, iw, ih){
        try { setSymbol(si, symPts(sy, img, iw, ih)); } catch (e) {}   // keep the plain-text version if the canvas can't be read
      });
    });
  }
  (function waitForMath(tries){
    if (window.MathJax && MathJax.tex2svg && MathJax.startup && MathJax.startup.promise) {
      MathJax.startup.promise.then(renderFormulas).catch(function(){});
    } else if (tries < 600) setTimeout(function(){ waitForMath(tries + 1); }, 100);
  })(0);

  // Draw the item crisp into a canvas (used both for sampling and as an overlay texture).
  function drawItem(item){
    var cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    var PAD = 14;
    if (item.kind === 'f' && item.f.img) {
      var s = Math.min(620 / item.f.iw, 200 / item.f.ih);
      cv.width = Math.ceil(item.f.iw * s) + PAD * 2;
      cv.height = Math.ceil(item.f.ih * s) + PAD * 2;
      g.drawImage(item.f.img, PAD, PAD, cv.width - PAD * 2, cv.height - PAD * 2);
    } else {
      var txt = item.kind === 'f' ? item.f.plain : item.text;
      var font = item.kind === 'f' ? 'italic 400 96px ' + MATH_FAM : 'italic 400 116px ' + WORD_FAM;
      g.font = font;
      var tw = Math.ceil(g.measureText(txt).width);
      cv.width = tw + PAD * 2 + 24; cv.height = 150;   // extra room for the italic overhang
      g.font = font;
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, cv.width / 2, 78);
    }
    return cv;
  }
  function samplePts(cv){
    var data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, pts = [];
    for (var y = 0; y < cv.height; y += 2)
      for (var x = 0; x < cv.width; x += 2)
        if (data[(y * cv.width + x) * 4 + 3] > 120) pts.push(x, y);
    return pts;
  }

  // ---------- The book on the landing ----------
  // Glowing particles over a dark body. Up close: full detail. Mid-distance: a silhouette
  // against its halo. Far away: only its light.
  var BZ = lz - 6.2, PH = 0.75, BASE = PH + 0.06;   // book position on the landing, stand height, cover top
  var PW = 2.02, PD = 1.32, CW = 2.1, CD = 1.4;     // page and cover half-sizes
  var bs = 1;                                       // book scale (smaller on narrow screens)
  var book = new THREE.Group();
  book.position.set(0, lt, BZ);
  scene.add(book);
  function pageH(x){ var u = Math.min(1, Math.abs(x) / PW); return 0.06 + 0.26 * (1 - Math.exp(-u * 8)) - 0.1 * u; }
  function surf(x){ return BASE + pageH(x); }

  var BCOL = {
    page: new THREE.Color('#ece8ff'), text: new THREE.Color('#bcaeff'), cover: new THREE.Color('#8b5cf6'),
    stand: new THREE.Color('#7d8fdc'), ribbon: new THREE.Color('#7c3aed'), mote: new THREE.Color('#c9b8ff')
  };
  var bPos = [], bBright = [], bCol = [], bKind = [];   // kind: 0 still, 1 rising mote, 2 page (answers the cursor), 3+ ribbon
  function bp(x, y, z, b, cl, kind){ bPos.push(x, y, z); bBright.push(b); bCol.push(cl.r, cl.g, cl.b); bKind.push(kind || 0); }
  function bline(x1, y1, z1, x2, y2, z2, n, b, cl, kind){
    for (var j = 0; j < n; j++) { var tt = (j + Math.random() * 0.6) / n; bp(x1 + (x2 - x1) * tt, y1 + (y2 - y1) * tt, z1 + (z2 - z1) * tt, b, cl, kind); }
  }
  function box(hx, y0, y1, hz, b, cl){
    var j, k, n;
    for (j = 0; j < 2; j++) for (k = 0; k < 2; k++) {
      var yy = j ? y1 : y0, sx = k ? hx : -hx, sz = k ? hz : -hz;
      bline(-hx, yy, sz, hx, yy, sz, c(hx * 60), b, cl);
      bline(sx, yy, -hz, sx, yy, hz, c(hz * 60), b, cl);
      bline(j ? hx : -hx, y0, sz, j ? hx : -hx, y1, sz, c((y1 - y0) * 60 + 3), b, cl);
    }
    for (n = c(hx * (y1 - y0) * 90); n > 0; n--) bp((Math.random() * 2 - 1) * hx, y0 + Math.random() * (y1 - y0), hz, b * 0.25, cl);
    for (n = c(hz * (y1 - y0) * 90); n > 0; n--) bp((Math.random() < 0.5 ? -1 : 1) * hx, y0 + Math.random() * (y1 - y0), (Math.random() * 2 - 1) * hz, b * 0.2, cl);
    for (n = c(hx * hz * 30); n > 0; n--) bp((Math.random() * 2 - 1) * hx, y1, (Math.random() * 2 - 1) * hz, b * 0.15, cl);
  }
  // stand and cover
  box(1.95, 0, 0.18, 1.45, 0.55, BCOL.stand);
  box(1.6, 0.18, 0.62, 1.15, 0.45, BCOL.stand);
  box(1.8, 0.62, PH, 1.3, 0.6, BCOL.stand);
  box(CW, PH, BASE, CD, 0.9, BCOL.cover);
  // pages: curved surface, edges, page stack, spine
  var j, k, x, z, n, sd;
  for (j = c(4200); j > 0; j--) { x = (Math.random() * 2 - 1) * PW; bp(x, surf(x) + 0.004, (Math.random() * 2 - 1) * PD, 0.5, BCOL.page, 2); }
  for (sd = -1; sd <= 1; sd += 2) {
    bline(sd * PW, surf(PW), -PD, sd * PW, surf(PW), PD, c(90), 1, BCOL.page, 2);
    for (k = 1; k <= 5; k++) bline(sd * PW, BASE + pageH(PW) * k / 6, -PD, sd * PW, BASE + pageH(PW) * k / 6, PD, c(50), 0.4, BCOL.page);
  }
  for (sd = -1; sd <= 1; sd += 2) {
    z = sd * PD;
    for (j = c(190); j > 0; j--) { x = (Math.random() * 2 - 1) * PW; bp(x, surf(x), z, 1, BCOL.page, 2); }
    for (k = 1; k <= 5; k++) for (j = c(60); j > 0; j--) { x = (Math.random() * 2 - 1) * PW; bp(x, BASE + pageH(x) * k / 6, z, 0.4, BCOL.page); }
  }
  bline(0, surf(0), -PD, 0, surf(0), PD, c(70), 0.7, BCOL.page, 2);
  // lines of text, broken into words
  for (sd = -1; sd <= 1; sd += 2) for (k = 0; k < 13; k++) {
    if (k === 6) continue;   // paragraph break
    z = -PD + 0.24 + k * (2 * PD - 0.48) / 12;
    var u1 = (k === 5 || k === 12) ? 0.45 + Math.random() * 0.3 : 0.92;
    for (var u = 0.12; u < u1; ) {
      var ue = Math.min(u1, u + 0.04 + Math.random() * 0.12);
      for (j = c((ue - u) * 120); j > 0; j--) { x = sd * (u + (ue - u) * Math.random()) * PW; bp(x, surf(x) + 0.006, z + (Math.random() - 0.5) * 0.02, 0.8, BCOL.text, 2); }
      u = ue + 0.02 + Math.random() * 0.02;
    }
  }
  // ribbon bookmark lying on the page and hanging over the front edge (the hanging part swings: kind 3 + 0.9 * how far down)
  var RIB_X = 0.24, RIB_LEN = 0.36;   // ends at the stand's top ledge, clear of the carving
  for (j = c(260); j > 0; j--) {
    var rt = Math.random(), rx = RIB_X + (Math.random() - 0.5) * 0.09, ry, rz, rk = 0;
    if (rt < 0.3) { ry = surf(rx) + 0.01; rz = PD - 0.5 + rt / 0.3 * 0.5; }
    else { var ra = (rt - 0.3) / 0.7; ry = surf(rx) - ra * RIB_LEN; rz = CD + 0.03 + Math.sin(ra * 2.5) * 0.04; rx += Math.sin(ra * 3) * 0.03; rk = 3 + ra * 0.9; }
    bp(rx, ry, rz, 0.9, BCOL.ribbon, rk);
  }
  // motes rising off the pages
  for (j = c(420); j > 0; j--) { var ma = Math.random() * Math.PI * 2, mr = Math.sqrt(Math.random()) * 1.7; bp(Math.cos(ma) * mr, BASE + 0.15, Math.sin(ma) * mr * 0.75, 0.75, BCOL.mote, 1); }

  var bookGeo = new THREE.BufferGeometry(), bRnd = new Float32Array(bBright.length);
  for (j = 0; j < bRnd.length; j++) bRnd[j] = Math.random();
  bookGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
  bookGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(bBright, 1));
  bookGeo.setAttribute('aCol', new THREE.Float32BufferAttribute(bCol, 3));
  bookGeo.setAttribute('aKind', new THREE.Float32BufferAttribute(bKind, 1));
  bookGeo.setAttribute('aRand', new THREE.BufferAttribute(bRnd, 1));
  var bookU = {
    uVis: { value: 0 }, uTime: { value: 0 }, uPR: { value: PR }, uSize: { value: 0.055 },
    uHover: { value: 0 }, uHit: { value: new THREE.Vector2() }, uPW: { value: PW }, uSwing: { value: new THREE.Vector2() }
  };
  var bookPts = new THREE.Points(bookGeo, new THREE.ShaderMaterial({
    uniforms: bookU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute float aBright; attribute vec3 aCol; attribute float aKind; attribute float aRand;',
      'uniform float uVis; uniform float uTime; uniform float uPR; uniform float uSize;',
      'uniform float uHover; uniform vec2 uHit; uniform float uPW; uniform vec2 uSwing;',
      'varying vec3 vCol; varying float vA;',
      'void main(){',
      ' vec3 p = position; float a = aBright;',
      ' if (aKind > 2.95) {',
      // ribbon: swings from where it bends over the front edge
      '  float h = (aKind - 3.0) / 0.9 * ' + RIB_LEN.toFixed(2) + ', k = h * (1.0 + 0.6 * h);',
      '  p.x += uSwing.x * k; p.z += uSwing.y * k;',
      '  p.y += 0.5 * dot(uSwing, uSwing) * h;',
      ' } else if (aKind > 1.5) {',
      // the hand's small force field: the page gently rises and brightens under the cursor
      '  float d = length(p.xz - uHit), near = exp(-d * d * 3.0);',
      '  p.y += uHover * 0.05 * near;',
      '  a *= 1.0 + uHover * near * 0.7;',
      ' } else if (aKind > 0.5) {',
      '  float h = mod(uTime * (0.16 + aRand * 0.22) + aRand * 9.0, 3.4);',
      '  p.y += h; p.x += sin(uTime * 0.6 + aRand * 20.0) * 0.08;',
      '  a *= sin(3.14159 * h / 3.4);',
      ' }',
      ' a *= 0.8 + 0.2 * sin(uTime * 1.7 + aRand * 40.0);',
      ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      ' gl_Position = projectionMatrix * mv;',
      ' gl_PointSize = min(uSize * uPR * (0.6 + aBright * 0.6) * (0.6 + aRand * 0.8) * 300.0 / max(-mv.z, 0.6), 40.0);',
      ' vCol = aCol; vA = a * uVis;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vCol; varying float vA;',
      'void main(){ float d = length(gl_PointCoord - 0.5);',
      ' float a = smoothstep(0.5, 0.0, d); a *= a;',
      ' gl_FragColor = vec4(vCol, a * vA); }'
    ].join('\n')
  }));
  bookPts.frustumCulled = false;
  bookPts.renderOrder = 1;
  book.add(bookPts);

  // "MakonBook" carved into the front of the stone stand: chiselled edges bright, the inside dimmer.
  // Built again once the display font has loaded.
  var carving = null;
  function buildCarving(){
    var TXT = 'MakonBook', FS = 160, TRACK = FS * 0.1;
    var cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    g.font = '700 ' + FS + 'px ' + FAM;
    var ws = TXT.split('').map(function(ch){ return g.measureText(ch).width; });
    cv.width = Math.ceil(ws.reduce(function(a, b){ return a + b; }, 0) + TRACK * (TXT.length - 1)) + 40; cv.height = 220;
    g.font = '700 ' + FS + 'px ' + FAM;
    g.fillStyle = '#fff'; g.textBaseline = 'middle';
    for (var ci = 0, cx0 = 20; ci < TXT.length; ci++) { g.fillText(TXT[ci], cx0, 115); cx0 += ws[ci] + TRACK; }
    var W = cv.width, Hc = cv.height, data = g.getImageData(0, 0, W, Hc).data, pts = [];
    function on(x, y){ return x >= 0 && y >= 0 && x < W && y < Hc && data[(y * W + x) * 4 + 3] > 120; }
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var y = 0; y < Hc; y += 2) for (var x = 0; x < W; x += 2) if (on(x, y)) {
      pts.push(x, y, on(x + 4, y) && on(x - 4, y) && on(x, y + 4) && on(x, y - 4) ? 0 : 1);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    var n = pts.length / 3;
    if (!n) return;
    // fit on the stand body's front face (x ±1.6, y 0.18 to 0.62, z 1.15)
    var k = Math.min(0.26 / (maxY - minY || 1), 2.7 / (maxX - minX || 1)), mx0 = (minX + maxX) / 2, my0 = (minY + maxY) / 2;
    var cp = [], cb = [], cc = [], ck = [], cr = [], col = new THREE.Color('#c9b8ff');
    for (var j = c(2600); j > 0; j--) {
      var q = ((Math.random() * n) | 0) * 3, edge = pts[q + 2];
      cp.push((pts[q] - mx0) * k, 0.43 - (pts[q + 1] - my0) * k, 1.153);
      cb.push(edge ? 1 : 0.4); cc.push(col.r, col.g, col.b); ck.push(0); cr.push(Math.random());
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    geo.setAttribute('aBright', new THREE.Float32BufferAttribute(cb, 1));
    geo.setAttribute('aCol', new THREE.Float32BufferAttribute(cc, 3));
    geo.setAttribute('aKind', new THREE.Float32BufferAttribute(ck, 1));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(cr, 1));
    if (carving) { book.remove(carving); carving.geometry.dispose(); }
    carving = new THREE.Points(geo, bookPts.material);   // same look and distance fade as the rest of the book
    carving.frustumCulled = false;
    carving.renderOrder = 1;
    book.add(carving);
  }
  buildCarving();

  // the top page on each side, lifted by the cursor (see the page physics in frame())
  var shUV = [], shB = [];
  function sheetPt(u, v, b){ shUV.push(u, v); shB.push(b); }
  for (j = c(1100); j > 0; j--) sheetPt(0.03 + Math.random() * 0.97, Math.random() * 2 - 1, 0.45);
  for (j = c(90); j > 0; j--) sheetPt(1, Math.random() * 2 - 1, 1);
  for (j = c(160); j > 0; j--) sheetPt(0.03 + Math.random() * 0.97, Math.random() < 0.5 ? -1 : 1, 0.9);
  for (k = 0; k < 8; k++) for (j = c(70); j > 0; j--) sheetPt(0.12 + Math.random() * 0.78, -0.8 + k * 0.23, 0.65);
  var sheetGeo = new THREE.BufferGeometry(), shRnd = new Float32Array(shB.length);
  for (j = 0; j < shRnd.length; j++) shRnd[j] = Math.random();
  sheetGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shB.length * 3), 3));
  sheetGeo.setAttribute('aUV', new THREE.Float32BufferAttribute(shUV, 2));
  sheetGeo.setAttribute('aBright', new THREE.Float32BufferAttribute(shB, 1));
  sheetGeo.setAttribute('aRand', new THREE.BufferAttribute(shRnd, 1));
  var SHEET_VERT = [
    'attribute vec2 aUV; attribute float aBright; attribute float aRand;',
    'uniform float uAng; uniform float uDir; uniform float uLag; uniform float uVis; uniform float uPR; uniform float uSize;',
    'uniform float uPW; uniform float uPD; uniform float uBase;',
    'varying float vA;',
    'float pageH(float u){ return 0.06 + 0.26 * (1.0 - exp(-u * 8.0)) - 0.1 * u; }',
    'void main(){',
    ' float u = aUV.x;',
    ' float a = clamp(uAng - (uLag + 0.25 * cos(uAng)) * u * u, 0.0, 3.14159);',   // the free edge trails the motion and droops
    ' vec3 p = vec3(uDir * u * uPW * cos(a), uBase + pageH(u) + u * uPW * sin(a) + 0.012, aUV.y * uPD);',
    ' vec4 mv = modelViewMatrix * vec4(p, 1.0);',
    ' gl_Position = projectionMatrix * mv;',
    ' gl_PointSize = min(uSize * uPR * (0.6 + aBright * 0.6) * (0.6 + aRand * 0.8) * 300.0 / max(-mv.z, 0.6), 40.0);',
    ' vA = aBright * uVis * smoothstep(0.0, 0.08, uAng) * smoothstep(3.14159, 3.0, uAng);',
    '}'
  ].join('\n');
  var SHEET_FRAG = [
    'uniform vec3 uCol; varying float vA;',
    'void main(){ float d = length(gl_PointCoord - 0.5);',
    ' float a = smoothstep(0.5, 0.0, d); a *= a;',
    ' gl_FragColor = vec4(uCol, a * vA); }'
  ].join('\n');
  var pages = [];
  for (j = 0; j < 2; j++) {
    var su = {
      uAng: { value: 0 }, uDir: { value: j ? -1 : 1 }, uLag: { value: 0 }, uVis: bookU.uVis, uPR: { value: PR }, uSize: bookU.uSize,
      uPW: { value: PW }, uPD: { value: PD }, uBase: { value: BASE }, uCol: { value: BCOL.page }
    };
    var so = new THREE.Points(sheetGeo, new THREE.ShaderMaterial({
      uniforms: su, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: SHEET_VERT, fragmentShader: SHEET_FRAG
    }));
    so.frustumCulled = false; so.renderOrder = 1; so.visible = false;
    book.add(so);
    pages.push({ obj: so, u: su, dir: j ? -1 : 1, th: 0, om: 0, armed: false, prevDl: 0, prevPhi: 0 });
  }
  // page: gravity pulls it to whichever side it leans; the hand pushes with a cushion PAGE_F radians deep
  var PAGE_G = 9, PAGE_K = 60, PAGE_F = 0.3;
  // ribbon: a pendulum (x: sideways, y: towards the viewer)
  var rib = new THREE.Vector2(), ribV = new THREE.Vector2(), RIB_K = 22, RIB_R = 0.16;
  var ray = new THREE.Raycaster(), mouseV = new THREE.Vector2(), hitW = new THREE.Vector3();
  var pagePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), midPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hover = 0;

  // dark body: hides what is behind the book, so it reads as a silhouette against the halo
  var shadeMat = new THREE.MeshBasicMaterial({ color: BG });
  function shadeBox(hx, y0, y1, hz){
    var m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 - 0.06, y1 - y0 - 0.03, hz * 2 - 0.06), shadeMat);
    m.position.y = (y0 + y1) / 2;
    book.add(m);
  }
  shadeBox(1.95, 0, 0.18, 1.45); shadeBox(1.6, 0.18, 0.62, 1.15); shadeBox(1.8, 0.62, PH, 1.3); shadeBox(CW, PH, BASE, CD);
  var prof = new THREE.Shape();
  prof.moveTo(-PW + 0.03, BASE - 0.02);
  prof.lineTo(PW - 0.03, BASE - 0.02);
  for (j = 0; j <= 40; j++) { x = PW - 0.03 - j * (2 * PW - 0.06) / 40; prof.lineTo(x, surf(x) - 0.03); }
  var pageGeo = new THREE.ExtrudeGeometry(prof, { depth: 2 * PD - 0.06, bevelEnabled: false });
  pageGeo.translate(0, 0, -PD + 0.03);
  book.add(new THREE.Mesh(pageGeo, shadeMat));

  // glow: a halo behind (gives the silhouette), a soft beam above, and a far light drawn on top
  function glowTex(stops){
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function(s){ gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }
  function beamTex(){
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
    var g = cv.getContext('2d'), gh = g.createLinearGradient(0, 0, 64, 0), gv = g.createLinearGradient(0, 0, 0, 256);
    gh.addColorStop(0, 'rgba(139,92,246,0)'); gh.addColorStop(0.5, 'rgba(205,188,255,0.9)'); gh.addColorStop(1, 'rgba(139,92,246,0)');
    g.fillStyle = gh; g.fillRect(0, 0, 64, 256);
    g.globalCompositeOperation = 'destination-in';
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.8, 'rgba(0,0,0,0.85)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gv; g.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(cv);
  }
  function glowSprite(tex, onTop, order){
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: !onTop, blending: THREE.AdditiveBlending, fog: false }));
    sp.renderOrder = order;
    book.add(sp);
    return sp;
  }
  var halo = glowSprite(glowTex([[0, 'rgba(190,165,255,0.85)'], [0.22, 'rgba(139,92,246,0.5)'], [0.55, 'rgba(91,33,182,0.16)'], [1, 'rgba(91,33,182,0)']]), false, -2);
  halo.position.set(0, BASE + 1.3, -0.6); halo.scale.set(9, 9, 1);
  var beam = glowSprite(beamTex(), false, -1);
  beam.position.set(0, BASE + 3, -0.2); beam.scale.set(1.8, 6, 1);
  var core = glowSprite(glowTex([[0, 'rgba(255,255,255,1)'], [0.07, 'rgba(228,218,255,0.95)'], [0.22, 'rgba(165,128,250,0.45)'], [0.55, 'rgba(109,40,217,0.12)'], [1, 'rgba(91,33,182,0)']]), true, 6);
  core.position.set(0, BASE + 0.9, 0); core.scale.set(7, 7, 1);
  var pageGlow = glowSprite(glowTex([[0, 'rgba(214,200,255,0.7)'], [0.35, 'rgba(139,92,246,0.28)'], [1, 'rgba(91,33,182,0)']]), false, -1);
  pageGlow.position.set(0, BASE + 0.45, 0); pageGlow.scale.set(5.6, 2.4, 1);

  // ---------- Symbols levitating over the book; at the top they gather into "1600" ----------
  // two rows arched over the pages: [name, x, y, z, LaTeX] in book units; the parabola sits mid bottom row
  var SYMS = [
    ['x²', -2.4, 0.98, -0.3, 'x^2'], ['π', -1.2, 1.22, 0.15, '\\pi'], ['parabola', 0, 1.32, -0.5],
    ['θ', 1.2, 1.22, 0.15, '\\theta'], ['triangle', 2.4, 0.98, -0.3],
    ['√x', -1.3, 2.36, -0.4, '\\sqrt{x}'], ['∞', 0, 2.56, -0.6, '\\infty'], ['y', 1.3, 2.36, -0.4, 'y']
  ];
  // Particle points for one symbol, drawn into a 200px box: the LaTeX image when there is one, else a fallback.
  function symPts(sy, img, iw, ih){
    var cv = document.createElement('canvas'); cv.width = cv.height = 200;
    var g = cv.getContext('2d', { willReadFrequently: true }), name = sy[0];
    g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    if (img) {
      var k = Math.min(160 / iw, 150 / ih, 2.6);   // one common size cap so glyphs match
      g.drawImage(img, 100 - iw * k / 2, 100 - ih * k / 2, iw * k, ih * k);
    } else if (name === 'triangle') {
      g.beginPath(); g.moveTo(42, 158); g.lineTo(162, 158); g.lineTo(42, 48); g.closePath(); g.stroke();
      g.lineWidth = 5; g.strokeRect(42, 136, 22, 22);
    } else if (name === 'parabola') {
      g.lineWidth = 4; g.beginPath(); g.moveTo(22, 132); g.lineTo(178, 132); g.moveTo(100, 22); g.lineTo(100, 178); g.stroke();
      g.lineWidth = 8; g.beginPath();
      for (var px = 34; px <= 166; px += 3) { var py = 160 - 130 * Math.pow((px - 100) / 66, 2); if (px === 34) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    } else {
      g.font = (name === 'π' || name === '∞' ? '' : 'italic ') + '400 130px ' + MATH_FAM;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(name, 100, 106);
    }
    return samplePts(cv);
  }
  var BN = small ? 4000 : 9000, PER = Math.floor(BN / SYMS.length);
  BN = PER * SYMS.length;
  var yOff = new Float32Array(BN * 2), yOrb = new Float32Array(BN * 4), yFin = new Float32Array(BN * 2), yRnd = new Float32Array(BN);
  function setSymbol(si, pts){
    var n = pts.length / 2;
    if (!n) return;
    for (var j = 0; j < PER; j++) {
      var p = si * PER + j, q = (Math.random() * n) | 0;
      yOff[p * 2] = (pts[q * 2] - 100) / 150 + (Math.random() - 0.5) * 0.012;
      yOff[p * 2 + 1] = -(pts[q * 2 + 1] - 100) / 150 + (Math.random() - 0.5) * 0.012;
    }
    if (symGeo) symGeo.attributes.aOff.needsUpdate = true;
  }
  SYMS.forEach(function(sy, si){
    var size = 0.8 + Math.random() * 0.1;
    setSymbol(si, symPts(sy));
    for (var j = 0; j < PER; j++) {
      var p = si * PER + j;
      yOrb[p * 4] = sy[1]; yOrb[p * 4 + 1] = sy[2]; yOrb[p * 4 + 2] = sy[3]; yOrb[p * 4 + 3] = size;
      yRnd[p] = Math.random();
    }
  });
  var symGeo = new THREE.BufferGeometry();
  symGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BN * 3), 3));
  symGeo.setAttribute('aOff', new THREE.BufferAttribute(yOff, 2));
  symGeo.setAttribute('aOrb', new THREE.BufferAttribute(yOrb, 4));
  symGeo.setAttribute('aFin', new THREE.BufferAttribute(yFin, 2));
  symGeo.setAttribute('aRand', new THREE.BufferAttribute(yRnd, 1));
  var symOff = new Float32Array(BN * 2), symVel = new Float32Array(BN * 2);   // cursor surf state, screen units
  var symSurfAttr = new THREE.BufferAttribute(symOff, 2);
  symSurfAttr.setUsage(THREE.DynamicDrawUsage);
  symGeo.setAttribute('aSurf', symSurfAttr);
  var finC = new THREE.Vector3();
  var symU = {
    uTime: { value: 0 }, uFinal: { value: 0 }, uVis: { value: 0 }, uScale: { value: 1 }, uFinS: { value: 1 },
    uCenter: { value: new THREE.Vector3() }, uFinC: { value: finC }, uPR: { value: PR },
    uAspect: stairU.uAspect,   // shared with the stairs
    uCol: { value: new THREE.Color('#cfc2ff') }, uPurple: { value: new THREE.Color('#7c3aed') }
  };
  var symPtsObj = new THREE.Points(symGeo, new THREE.ShaderMaterial({
    uniforms: symU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute vec2 aOff; attribute vec4 aOrb; attribute vec2 aFin; attribute float aRand; attribute vec2 aSurf;',
      'uniform float uTime; uniform float uFinal; uniform float uVis; uniform float uScale; uniform float uFinS; uniform float uPR;',
      'uniform vec3 uCenter; uniform vec3 uFinC; uniform vec3 uCol; uniform vec3 uPurple;',
      'uniform float uAspect;',
      'varying vec3 vCol; varying float vA;',
      'void main(){',
      ' float ph = aOrb.x * 1.7 + aOrb.y * 2.3;',
      ' vec3 drift = vec3(sin(uTime * 0.45 + ph) * 0.08, sin(uTime * 0.7 + ph * 3.0) * 0.13, cos(uTime * 0.45 + ph) * 0.08);',
      ' vec3 c = uCenter + (aOrb.xyz + drift) * uScale;',
      ' float tilt = sin(uTime * 0.4 + ph) * 0.14;',
      ' vec2 o = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * aOff;',
      ' vec4 a = modelViewMatrix * vec4(c, 1.0);',
      ' a.xy += o * aOrb.w * uScale;',             // symbols always face the camera
      ' vec4 b = modelViewMatrix * vec4(uFinC, 1.0);',
      ' b.xy += aFin * uFinS;',
      ' float p = clamp((uFinal - aRand * 0.35) / 0.65, 0.0, 1.0);',
      ' p = p * p * (3.0 - 2.0 * p);',
      ' vec4 mv = mix(a, b, p);',
      ' mv.xy += vec2(aRand - 0.5, 0.4) * sin(p * 3.14159) * 0.8;',
      ' vec4 cp = projectionMatrix * mv;',
      ' cp.xy += vec2(aSurf.x / uAspect, aSurf.y) * cp.w;',   // cursor surf offset (see surfStep)
      ' gl_Position = cp;',
      ' gl_PointSize = min(mix(0.034, 0.075, p) * uPR * (0.7 + aRand * 0.6) * 300.0 / max(-mv.z, 0.6), 40.0);',
      ' vCol = mix(uCol, uPurple * 1.3, p);',
      ' vA = mix(uVis * (0.75 + 0.25 * sin(uTime * 2.1 + aRand * 60.0)), 0.95, p);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vCol; varying float vA;',
      'void main(){ float d = length(gl_PointCoord - 0.5);',
      ' float a = smoothstep(0.5, 0.0, d); a *= a;',
      ' gl_FragColor = vec4(vCol, a * vA); }'
    ].join('\n')
  }));
  symPtsObj.frustumCulled = false;
  symPtsObj.renderOrder = 2;
  scene.add(symPtsObj);

  // "1600" target shape (rebuilt once the display font has loaded)
  var finAspect = 3;
  function build1600(){
    var cv = document.createElement('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
    cv.width = 1024; cv.height = 360;
    g.font = '700 300px ' + FAM;
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('1600', 512, 190);
    var pts = samplePts(cv), n = pts.length / 2;
    if (!n) return;
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var j = 0; j < n; j++) {
      var px = pts[j * 2], py = pts[j * 2 + 1];
      if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
    }
    var bw = maxX - minX || 1, bh = maxY - minY || 1, mx0 = (minX + maxX) / 2, my0 = (minY + maxY) / 2;
    finAspect = bw / bh;
    for (var p = 0; p < BN; p++) {
      var q = (Math.random() * n) | 0;
      yFin[p * 2] = (pts[q * 2] - mx0 + (Math.random() - 0.5) * 2) / bw;
      yFin[p * 2 + 1] = -(pts[q * 2 + 1] - my0 + (Math.random() - 0.5) * 2) / bw;
    }
    symGeo.attributes.aFin.needsUpdate = true;
    placeFinal();
  }
  // Size and place "1600" above the book for the camera's final position.
  function placeFinal(){
    var camY = N * H + 1.6, dF = (Z0 + 0.5 * D - N * D) - BZ;
    var tanH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), hh = dF * tanH, hw = hh * camera.aspect;
    symU.uFinS.value = Math.min(hw * 1.3, hh * 2.4, hh * 0.5 * finAspect);
    finC.set(0, camY + dF * Math.tan(0.03 + Math.atan(0.3 * tanH)), BZ);   // 0.03 = final camera pitch
  }
  build1600();

  // ---------- Formulas (left) and words (right), driven by scroll, streamed out of the book ----------
  // One at a time, alternating sides: while one bursts, the next one forms.
  var S = small ? 900 : 1600;                    // particles per formula/word
  var ITEM_COL = new THREE.Color('#d9d0ff');     // formulas and words share one colour
  var ITEM_N = 7, FORM = 1.8, HOLD = 5.2, BURST = 1.8, FIRST = 3.0;   // count, then lengths in steps
  var MATH_Y = [0.56, 0.4, 0.66, 0.46], WORD_Y = [0.3, 0.52, 0.2, 0.42];  // lane heights, fractions of halfH
  var ITEMS = [];
  (function(){
    var fl = shuffle(FORMULAS.slice()), wl = shuffle(WORDS.slice());
    for (var k = 0; k < ITEM_N; k++) {
      var m = k % 2 === 0, n = k >> 1;
      ITEMS.push({
        kind: m ? 'f' : 'w', f: m ? fl[n % fl.length] : null, text: m ? null : wl[n % wl.length],
        start: FIRST + k * (FORM + HOLD), lane: (m ? MATH_Y : WORD_Y)[n % 4], jit: 0.15 + Math.random() * 0.7,
        cv: null, pts: null, hasImg: false
      });
    }
  })();

  var ITEM_VERT = [
    'attribute vec3 aTgt; attribute vec3 aCtl; attribute vec3 aDir; attribute float aDelay; attribute float aRand; attribute vec2 aSurf;',
    'uniform vec3 uSrc; uniform float uForm; uniform float uBurst; uniform float uTime; uniform float uPR; uniform float uAspect;',
    'varying float vA;',
    'void main(){',
    ' float p = clamp((uForm - aDelay * 0.6) / 0.4, 0.0, 1.0);',
    ' float e = 1.0 - (1.0 - p) * (1.0 - p);',
    ' vec3 c = mix(uSrc, aTgt, 0.55) + aCtl;',                 // curved path out of the book
    ' vec3 pos = (1.0 - e) * (1.0 - e) * uSrc + 2.0 * (1.0 - e) * e * c + e * e * aTgt;',
    ' pos.xy += vec2(sin(uTime * 1.3 + aRand * 50.0), cos(uTime * 1.1 + aRand * 37.0)) * 0.01;',
    ' float b = clamp((uBurst - aRand * 0.15) / 0.85, 0.0, 1.0);',
    ' pos += aDir * (1.0 - pow(1.0 - b, 2.2));',
    ' vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    ' vec4 cp = projectionMatrix * mv;',
    ' cp.xy += vec2(aSurf.x / uAspect, aSurf.y) * cp.w;',   // cursor surf offset
    ' gl_Position = cp;',
    ' float sz = mix(mix(0.07, 0.042, e), 0.08, b) * mix(0.55 + aRand, 0.85 + aRand * 0.3, e);',
    ' gl_PointSize = clamp(sz * uPR * 300.0 / max(-mv.z, 0.6), 1.3 * uPR, 48.0);',
    ' vA = smoothstep(0.0, 0.05, p) * mix(0.6, 0.95, e) * (1.0 - smoothstep(0.25, 1.0, b));',
    '}'
  ].join('\n');
  var ITEM_FRAG = [
    'uniform vec3 uCol; varying float vA;',
    'void main(){ float d = length(gl_PointCoord - 0.5);',
    ' float a = smoothstep(0.5, 0.0, d); a *= a;',
    ' gl_FragColor = vec4(uCol, a * vA); }'
  ].join('\n');

  var srcWorld = new THREE.Vector3(), srcLocal = new THREE.Vector3(), bookC = new THREE.Vector3();
  var slots = [];
  for (i = 0; i < 2; i++) {
    var eg = new THREE.BufferGeometry(), er = new Float32Array(S);
    for (j = 0; j < S; j++) er[j] = Math.random();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
    eg.setAttribute('aTgt', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
    eg.setAttribute('aCtl', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
    eg.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
    eg.setAttribute('aDelay', new THREE.BufferAttribute(new Float32Array(S), 1));
    eg.setAttribute('aRand', new THREE.BufferAttribute(er, 1));
    var eOff = new Float32Array(S * 2), eSurf = new THREE.BufferAttribute(eOff, 2);
    eSurf.setUsage(THREE.DynamicDrawUsage);
    eg.setAttribute('aSurf', eSurf);
    var eu = { uSrc: { value: new THREE.Vector3() }, uForm: { value: 0 }, uBurst: { value: 0 }, uTime: { value: 0 }, uPR: { value: PR }, uAspect: stairU.uAspect, uCol: { value: ITEM_COL } };
    var ep = new THREE.Points(eg, new THREE.ShaderMaterial({
      uniforms: eu, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: ITEM_VERT, fragmentShader: ITEM_FRAG
    }));
    ep.frustumCulled = false; ep.renderOrder = 4; ep.visible = false;
    rig.add(ep);
    var sm = new THREE.MeshBasicMaterial({ color: ITEM_COL, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sm);
    mesh.renderOrder = 5; mesh.visible = false;
    rig.add(mesh);
    slots.push({ side: i ? 1 : -1, idx: -1, ok: false, geo: eg, u: eu, pts: ep, mesh: mesh, tex: null, off: eOff, vel: new Float32Array(S * 2), fo: 0, bu: 0, near: 0 });
  }

  function fillSlot(sl, it){
    if (it.kind === 'f' && it.f.img && !it.hasImg) it.cv = null;   // LaTeX arrived after the plain-text fallback was drawn
    if (!it.cv) { it.cv = drawItem(it); it.pts = samplePts(it.cv); it.hasImg = it.kind === 'f' && !!it.f.img; }
    var cv = it.cv, pts = it.pts, n = pts.length / 2;
    if (!n) return false;
    var wide = camera.aspect >= 1.05, isF = it.kind === 'f';
    var inner = halfW * (wide ? 0.14 : 0.06), outer = halfW * 0.94;   // keep clear of the stairs' centre line and the edge
    var maxW = Math.min(halfW * (wide ? (isF ? 0.4 : 0.34) : 0.86), outer - inner);
    var maxH = halfH * (wide ? (isF ? 0.15 : 0.17) : (isF ? 0.1 : 0.11));
    var k = Math.min(maxW / cv.width, maxH / cv.height), w = cv.width * k, h = cv.height * k;
    // formulas stay above the score markers; nothing sits low on the screen
    var lo = (isF || !wide ? 0.3 : 0.1) * halfH + h / 2, hi = 0.86 * halfH - h / 2;
    var y = clamp(it.lane * halfH, lo, Math.max(lo, hi));
    var x = sl.side * (inner + w / 2 + it.jit * Math.max(0, outer - inner - w));

    var A = sl.geo.attributes, tg = A.aTgt.array, ct = A.aCtl.array, dr = A.aDir.array, dl = A.aDelay.array;
    var cx = cv.width / 2, cy = cv.height / 2, speed = Math.max(w, h) * (reduce ? 0.5 : 1.2);
    for (var p = 0; p < S; p++) {
      var q = (Math.random() * n) | 0, px = pts[q * 2], py = pts[q * 2 + 1];
      var tx = x + (px - cx) * k + (Math.random() - 0.5) * k * 2, ty = y - (py - cy) * k + (Math.random() - 0.5) * k * 2;
      tg[p * 3] = tx; tg[p * 3 + 1] = ty; tg[p * 3 + 2] = (Math.random() - 0.5) * 0.06;
      ct[p * 3] = (Math.random() - 0.5) * halfW * 0.5;
      ct[p * 3 + 1] = (0.1 + Math.random() * 0.35) * halfH;
      ct[p * 3 + 2] = (Math.random() - 0.5) * 6;
      var bx = tx - x, by = ty - y, bl = Math.sqrt(bx * bx + by * by) + 0.001, m = (0.5 + Math.random() * 1.3) * speed * 0.55;
      dr[p * 3] = bx / bl * m + (Math.random() - 0.5) * speed * 0.4;
      dr[p * 3 + 1] = by / bl * m + (Math.random() - 0.5) * speed * 0.4;
      dr[p * 3 + 2] = (Math.random() - 0.3) * speed * 0.5;
      dl[p] = 0.55 * (px / cv.width) + 0.45 * Math.random();   // fills in left to right, like writing
    }
    sl.off.fill(0); sl.vel.fill(0);
    A.aTgt.needsUpdate = A.aCtl.needsUpdate = A.aDir.needsUpdate = A.aDelay.needsUpdate = A.aSurf.needsUpdate = true;
    if (sl.tex) sl.tex.dispose();
    sl.tex = new THREE.CanvasTexture(cv);
    sl.tex.anisotropy = 4;
    sl.mesh.material.map = sl.tex;
    sl.mesh.material.needsUpdate = true;
    sl.mesh.scale.set(w, h, 1);
    sl.mesh.position.set(x, y, 0.02);
    return true;
  }
  function safeFill(sl, it){
    try { return fillSlot(sl, it); }
    catch (err) {
      FORMULAS.forEach(function(f){ f.img = null; });
      it.cv = null;
      try { return fillSlot(sl, it); } catch (err2) { return false; }
    }
  }

  // ---------- Cursor "surf" ----------
  // Particles near the cursor are pushed out and dragged along with its motion, keep their momentum,
  // then spring back home. Offsets are in screen units (1 = half the screen height), added in the shaders.
  var SURF_R = 0.22, SURF_R2 = SURF_R * SURF_R, SURF_K = 18, SURF_MAX = 0.22;
  var curX = 0, curY = 0, curVX = 0, curVY = 0, prevCX = 0, prevCY = 0, surfLive = 0;
  var symC = new Float32Array(SYMS.length * 3), symR = new Float32Array(SYMS.length * 2), tmpV = new THREE.Vector3(), tmpM = new THREE.Matrix4();
  // One particle at rest position (sx, sy); w = how strongly the cursor acts on it. Returns its squared distance to the cursor.
  function surfStep(off, vel, j, sx, sy, w, dt, damp){
    var ox = off[j], oy = off[j + 1], vx = vel[j], vy = vel[j + 1];
    var dx = sx + ox - curX, dy = sy + oy - curY, r2 = dx * dx + dy * dy;
    var ax = -SURF_K * ox, ay = -SURF_K * oy;
    if (w > 0 && r2 < SURF_R2) {
      var r = Math.sqrt(r2) + 1e-4, f = 1 - r / SURF_R;
      f *= f * w;
      ax += dx / r * f * 38 + curVX * f * 2.6;
      ay += dy / r * f * 38 + curVY * f * 2.6;
    }
    vx = (vx + ax * dt) * damp; vy = (vy + ay * dt) * damp;
    ox += vx * dt; oy += vy * dt;
    var o2 = ox * ox + oy * oy;
    if (o2 > SURF_MAX * SURF_MAX) { var oc = SURF_MAX / Math.sqrt(o2); ox *= oc; oy *= oc; vx *= 0.5; vy *= 0.5; }   // never carried far
    off[j] = ox; off[j + 1] = oy;
    vel[j] = vx; vel[j + 1] = vy;
    return r2;
  }

  // ---------- Input ----------
  var mx = 0, my = 0, smx = 0, smy = 0, pointerOn = false, lastMove = 0, mouseOn = 0;
  function setPointer(cx, cy){
    mx = (cx / innerWidth) * 2 - 1;
    my = -((cy / innerHeight) * 2 - 1);
    pointerOn = true; lastMove = performance.now();
  }
  addEventListener('pointermove', function(e){ setPointer(e.clientX, e.clientY); }, { passive: true });
  addEventListener('touchmove', function(e){ if (e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  addEventListener('touchend', function(){ pointerOn = false; }, { passive: true });
  document.addEventListener('pointerleave', function(){ pointerOn = false; });

  function resize(){
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    stairU.uAspect.value = camera.aspect;
    measure();
    neb.scale.set(2 * DSKY * TANH * camera.aspect * 1.3, 2 * DSKY * TANH * 1.3, 1);
    nebU.uAspect.value = camera.aspect;
    bs = clamp(camera.aspect, 0.5, 1);
    book.scale.setScalar(bs);
    srcWorld.set(0, lt + (BASE + 0.9) * bs, BZ);
    bookC.set(0, lt + BASE * bs, BZ);
    symU.uScale.value = bs;
    symU.uCenter.value.set(0, lt + (BASE + 0.15) * bs, BZ);
    placeFinal();
    for (var s = 0; s < slots.length; s++) slots[s].idx = -2;   // re-place items for the new size
  }
  addEventListener('resize', resize);
  resize();

  // ---------- Scroll: assemble the stairs, then climb ----------
  var ASSEMBLE_END = 0.08, CLIMB_START = 0.09, CLIMB_LEN = 0.86;
  var sCur = 0, aCur = 0;
  var baseQ = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, 'YXZ'), fwd = new THREE.Vector3();

  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v){ var x = clamp((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function stepY(s){
    var f = Math.floor(s), r = s - f;
    var e = reduce ? r : r * r * (3 - 2 * r);
    return (f + e) * H;
  }

  var clock = new THREE.Clock(), t = 0;
  function frame(){
    var dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    var maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var sy = scrollY, q = sy / maxScroll;
    var aTarget = clamp(q / ASSEMBLE_END, 0, 1);
    var sTarget = clamp((q - CLIMB_START) / CLIMB_LEN, 0, 1) * N;
    aCur += (aTarget - aCur) * Math.min(1, dt * 2.6);
    sCur += (sTarget - sCur) * Math.min(1, dt * 3.2);
    if (Math.abs(sTarget - sCur) < 0.0005) sCur = sTarget;
    stairU.uA.value = aCur;
    stairU.uTime.value = t;

    var lo = clamp((aCur - 0.8) / 0.2, 0, 1);
    for (var li = 0; li < labelMats.length; li++) labelMats[li].opacity = lo;

    // overlays
    var vh = innerHeight;
    var extra = clamp(1 - sy / (vh * 0.12), 0, 1);
    topbar.style.opacity = extra;
    topbar.style.pointerEvents = extra > 0.5 ? 'auto' : 'none';
    topbar.style.transform = 'translateY(' + (-(1 - extra) * 12) + 'px)';
    cue.style.opacity = extra;
    var h1 = clamp(1 - sy / (vh * 0.35), 0, 1);
    hero.style.opacity = h1;
    hero.style.transform = 'translateY(' + (-(1 - h1) * 40) + 'px)';
    heroCta.style.pointerEvents = h1 > 0.5 ? 'auto' : 'none';
    var fin = clamp((sCur - (N - 1.6)) / 1.2, 0, 1);
    finale.style.opacity = fin;
    finale.style.pointerEvents = fin > 0.6 ? 'auto' : 'none';
    finale.style.transform = 'translateY(' + ((1 - fin) * 16) + 'px)';
    finBrand.style.opacity = fin;
    finBrand.style.transform = 'translateY(' + (-(1 - fin) * 12) + 'px)';

    // pointer
    smx += (mx - smx) * Math.min(1, dt * 3);
    smy += (my - smy) * Math.min(1, dt * 3);
    var active = pointerOn && (performance.now() - lastMove < 2500);
    mouseOn += ((active ? 1 : 0) - mouseOn) * Math.min(1, dt * 4);

    // camera: first-person, stepping up
    var pitch = 0.16 - 0.13 * clamp((sCur - (N - 4)) / 4, 0, 1);
    var sway = reduce ? 0 : Math.sin(sCur * Math.PI) * 0.035;
    camera.position.set(sway, stepY(sCur) + 1.6, Z0 + 0.5 * D - sCur * D);
    eul.set(pitch, 0, 0); baseQ.setFromEuler(eul);
    eul.set(pitch + smy * 0.05, -smx * 0.08, 0); camera.quaternion.setFromEuler(eul);
    fwd.set(0, 0, -1).applyQuaternion(baseQ);
    rig.position.copy(camera.position).addScaledVector(fwd, DIST);
    rig.quaternion.copy(baseQ);
    rig.updateMatrixWorld(true);

    // far sky: the cosmic cloud drifts, now and then a comet crosses
    sky.position.copy(camera.position);
    sky.quaternion.copy(baseQ);
    nebU.uTime.value = t;
    neb.visible = !!nebU.uTex.value;
    if (!reduce && (nextComet -= dt) <= 0) {
      for (var cn = 0; cn < comets.length; cn++) if (!comets[cn].on) { launchComet(comets[cn]); break; }
      nextComet = 3 + Math.random() * 6;
    }
    for (cn = 0; cn < comets.length; cn++) {
      var cmt = comets[cn];
      if (!cmt.on) continue;
      cmt.t += dt;
      var ck = cmt.t / cmt.life, U = DSKY * TANH;
      if (ck >= 1) { cmt.on = false; cmt.mesh.visible = false; continue; }
      var hxs = cmt.x0 + cmt.dx * cmt.dist * ck, hys = cmt.y0 + cmt.dy * cmt.dist * ck;
      cmt.mesh.scale.set(cmt.len * U, 0.012 * U, 1);
      cmt.mesh.position.set((hxs - cmt.dx * cmt.len * 0.46) * U, (hys - cmt.dy * cmt.len * 0.46) * U, -DSKY + 1);   // head leads
      cmt.mesh.material.opacity = Math.pow(Math.sin(Math.PI * ck), 0.7) * 0.55;
    }

    // the book: full detail up close, a silhouette from mid-distance, only its light from far away
    var appear = smooth(0.6, 1, aCur), dB = camera.position.distanceTo(bookC);
    var finP = clamp((sCur - (N - 2.4)) / 1.6, 0, 1);
    bookU.uVis.value = appear * smooth(30, 14, dB);
    bookU.uTime.value = t;
    halo.material.opacity = appear * smooth(62, 44, dB) * (0.4 + 0.6 * smooth(8, 22, dB));
    beam.material.opacity = appear * 0.3 * smooth(42, 20, dB);
    // the book answers the cursor like a hand with a small force field
    var hoverT = 0, handOn = false, handX = 0, handY = 0;
    camera.updateMatrixWorld();
    if (active && bookU.uVis.value > 0.3) {
      ray.setFromCamera(mouseV.set(mx, my), camera);
      pagePlane.constant = -(lt + (BASE + 0.2) * bs);
      if (ray.ray.intersectPlane(pagePlane, hitW)) {
        var hx = hitW.x / bs, hz = (hitW.z - BZ) / bs;
        if (Math.abs(hx) < CW + 0.4 && Math.abs(hz) < CD + 0.5) { hoverT = 1; bookU.uHit.value.set(hx, hz); }
      }
      // the hand in the book's middle cross-section, relative to the spine
      midPlane.constant = -BZ;
      if (ray.ray.intersectPlane(midPlane, hitW)) { handOn = true; handX = hitW.x / bs; handY = (hitW.y - lt) / bs - surf(0); }
    }
    hover += (hoverT - hover) * Math.min(1, dt * 4);
    bookU.uHover.value = hover;
    // top pages: a hand coming up from below lifts the page; pushed past upright it falls over, otherwise it falls back
    for (var pi = 0; pi < 2; pi++) {
      var pg = pages[pi], torque = -PAGE_G * Math.cos(pg.th);
      if (handOn) {
        var phi = Math.atan2(handY, pg.dir * handX), rho = Math.sqrt(handX * handX + handY * handY);
        var reach = rho > 0.25 && rho < PW * 1.2 && phi > -1.2, dl = pg.th - phi;
        // a quick flick that passes through the page between two frames still carries it along
        if (pg.armed && reach && dl < -0.05 && pg.prevDl >= -0.05) pg.om = Math.max(pg.om, Math.min(12, (phi - pg.prevPhi) / Math.max(dt, 0.008)));
        if (!reach || dl < -0.05) pg.armed = false;     // the hand is away, or above the page
        else if (dl > PAGE_F) pg.armed = true;           // the hand is well below the page: it can lift it
        if (pg.armed && dl < PAGE_F) torque += PAGE_K * (1 - Math.max(0, dl) / PAGE_F);
        pg.prevDl = dl; pg.prevPhi = phi;
      } else pg.armed = false;
      pg.om = (pg.om + torque * dt) * Math.exp(-2 * dt);
      pg.th += pg.om * dt;
      if (pg.th <= 0) { pg.th = 0; pg.om = pg.om < -0.6 ? -pg.om * 0.18 : 0; }
      if (pg.th >= Math.PI) {
        // landed on the other side: it joins that stack, and the air it pushes shakes the ribbon
        pg.th = 0; pg.om = 0; pg.armed = false;
        ribV.x -= pg.dir * 1.2; ribV.y += 1.4;
      }
      pg.obj.visible = pg.th > 0.004;
      pg.u.uAng.value = pg.th;
      pg.u.uLag.value = clamp(pg.om * 0.06, -0.45, 0.45);
    }
    // ribbon: knocked by the hand passing by, then swings back
    if (active && bookU.uVis.value > 0.3) {
      tmpV.set(RIB_X, surf(RIB_X) - RIB_LEN * 0.5, CD + 0.03);
      book.localToWorld(tmpV).project(camera);
      var rdx = tmpV.x * camera.aspect - curX, rdy = tmpV.y - curY, rd = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rd < RIB_R) {
        var rf = (1 - rd / RIB_R) * dt * 10;
        ribV.x += (curVX * 2.2 + rdx / (rd + 1e-3) * 3) * rf;
        ribV.y += Math.max(0, curVY) * 2.2 * rf;   // an upward swipe swings it out towards you
      }
    }
    ribV.x = (ribV.x - RIB_K * rib.x * dt) * Math.exp(-1.6 * dt);
    ribV.y = (ribV.y - RIB_K * rib.y * dt) * Math.exp(-1.6 * dt);
    rib.x = clamp(rib.x + ribV.x * dt, -1.1, 1.1);
    rib.y = clamp(rib.y + ribV.y * dt, -0.1, 1.1);
    bookU.uSwing.value.copy(rib);
    pageGlow.material.opacity = (0.45 + 0.25 * hover) * bookU.uVis.value;
    core.material.opacity = appear * smooth(28, 46, dB) * (0.9 + 0.1 * Math.sin(t * 1.6));
    symU.uVis.value = appear * smooth(26, 12, dB);
    symU.uTime.value = t;
    symU.uFinal.value = finP;
    pMat.uniforms.uDim.value = 1 - 0.6 * finP;

    // formulas (left) and words (right): scrubbed by scroll, streaming out of the book
    srcLocal.copy(srcWorld);
    rig.worldToLocal(srcLocal);
    var act = [-1, -1];
    for (var e = 0; e < ITEMS.length; e++) {
      var it = ITEMS[e];
      if (sCur >= it.start && sCur < it.start + FORM + HOLD + BURST) act[it.kind === 'f' ? 0 : 1] = e;
    }
    for (var s = 0; s < 2; s++) {
      var sl = slots[s];
      if (act[s] !== sl.idx) { sl.idx = act[s]; sl.ok = sl.idx >= 0 && safeFill(sl, ITEMS[sl.idx]); }
      var on = sl.idx >= 0 && sl.ok;
      sl.pts.visible = sl.mesh.visible = on;
      if (!on) continue;
      var ls = sCur - ITEMS[sl.idx].start;
      var fo = clamp(ls / FORM, 0, 1), bu = clamp((ls - FORM - HOLD) / BURST, 0, 1);
      sl.u.uForm.value = fo;
      sl.u.uBurst.value = bu;
      sl.u.uTime.value = t;
      sl.u.uSrc.value.copy(srcLocal);
      sl.fo = fo; sl.bu = bu;
      // the crisp overlay steps aside while the cursor stirs the particles
      sl.mesh.material.opacity = 0.85 * smooth(0.8, 1, fo) * (1 - smooth(0, 0.2, bu)) * (1 - 0.85 * sl.near);
    }

    // cursor surf on the stairs, symbols, "1600", formulas and words
    var asp = camera.aspect, cvx = 0, cvy = 0;
    curX = mx * asp; curY = my;
    if (active && dt > 0) { cvx = clamp((curX - prevCX) / dt, -8, 8); cvy = clamp((curY - prevCY) / dt, -8, 8); }
    curVX += (cvx - curVX) * Math.min(1, dt * 12); curVY += (cvy - curVY) * Math.min(1, dt * 12);
    prevCX = curX; prevCY = curY;
    surfLive = mouseOn > 0.01 ? 2.5 : surfLive - dt;
    if (surfLive > 0) {
      camera.updateMatrixWorld();
      var P5 = camera.projectionMatrix.elements[5], damp = Math.exp(-4 * dt);
      // stairs (and, before they assemble, the drifting sky): rest positions mirroring the stair shader
      var Ve = camera.matrixWorldInverse.elements, uA = stairU.uA.value;
      for (var st = 0; st < SC; st++) {
        var s3 = st * 3, rs = srnd[st], sp_ = clamp((uA - delay[st] * 0.55) / 0.45, 0, 1);
        sp_ = sp_ * sp_ * (3 - 2 * sp_);
        var gx = scatter[s3] + Math.sin(t * 0.3 + rs * 40) * 0.35, gy = scatter[s3 + 1] + Math.cos(t * 0.27 + rs * 31) * 0.35, gz = scatter[s3 + 2] + Math.sin(t * 0.2 + rs * 17) * 0.35;
        gx += (sPos[s3] - gx) * sp_; gy += (sPos[s3 + 1] - gy) * sp_ + Math.sin(sp_ * Math.PI) * (0.6 + rs * 1.4); gz += (sPos[s3 + 2] - gz) * sp_;
        var wz = Ve[2] * gx + Ve[6] * gy + Ve[10] * gz + Ve[14];
        if (wz > -0.3 || wz < -45) { stOff[st * 2] *= 0.9; stOff[st * 2 + 1] *= 0.9; stVel[st * 2] = stVel[st * 2 + 1] = 0; continue; }   // behind the camera, or lost in the fog
        surfStep(stOff, stVel, st * 2, P5 * (Ve[0] * gx + Ve[4] * gy + Ve[8] * gz + Ve[12]) / -wz, P5 * (Ve[1] * gx + Ve[5] * gy + Ve[9] * gz + Ve[13]) / -wz,
          mouseOn * (1 - 0.45 * sp_) * (0.6 + rs * 0.8), dt, damp);
      }
      stSurfAttr.needsUpdate = true;
      var symW = Math.max(symU.uVis.value, finP);
      if (symW > 0.01) {
        // rest positions, mirroring the symbol shader
        var uC = symU.uCenter.value;
        for (var si = 0; si < SYMS.length; si++) {
          var sd = SYMS[si], ph = sd[1] * 1.7 + sd[2] * 2.3, tl = Math.sin(t * 0.4 + ph) * 0.14;
          tmpV.set(uC.x + (sd[1] + Math.sin(t * 0.45 + ph) * 0.08) * bs, uC.y + (sd[2] + Math.sin(t * 0.7 + ph * 3) * 0.13) * bs, uC.z + (sd[3] + Math.cos(t * 0.45 + ph) * 0.08) * bs).applyMatrix4(camera.matrixWorldInverse);
          symC[si * 3] = tmpV.x; symC[si * 3 + 1] = tmpV.y; symC[si * 3 + 2] = tmpV.z;
          symR[si * 2] = Math.cos(tl); symR[si * 2 + 1] = Math.sin(tl);
        }
        tmpV.copy(finC).applyMatrix4(camera.matrixWorldInverse);
        var fvx = tmpV.x, fvy = tmpV.y, fvz = tmpV.z, finS = symU.uFinS.value;
        for (var sp = 0; sp < BN; sp++) {
          var sk = (sp / PER) | 0, rn = yRnd[sp], ox = yOff[sp * 2], oy = yOff[sp * 2 + 1], cs = symR[sk * 2], sn = symR[sk * 2 + 1], sz = yOrb[sp * 4 + 3] * bs;
          var ax = symC[sk * 3] + (cs * ox - sn * oy) * sz, ay = symC[sk * 3 + 1] + (sn * ox + cs * oy) * sz, az = symC[sk * 3 + 2];
          var pp = clamp((finP - rn * 0.35) / 0.65, 0, 1);
          pp = pp * pp * (3 - 2 * pp);
          if (pp > 0) {
            var arc = Math.sin(pp * Math.PI) * 0.8;
            ax += (fvx + yFin[sp * 2] * finS - ax) * pp + (rn - 0.5) * arc;
            ay += (fvy + yFin[sp * 2 + 1] * finS - ay) * pp + 0.4 * arc;
            az += (fvz - az) * pp;
          }
          if (az > -0.1) continue;
          surfStep(symOff, symVel, sp * 2, P5 * ax / -az, P5 * ay / -az, mouseOn * Math.max(symU.uVis.value, pp) * (0.6 + rn * 0.8), dt, damp);
        }
        symSurfAttr.needsUpdate = true;
      }
      tmpM.multiplyMatrices(camera.matrixWorldInverse, rig.matrixWorld);
      var Me = tmpM.elements;
      for (s = 0; s < 2; s++) {
        sl = slots[s];
        var nearT = 0;
        if (sl.pts.visible) {
          var EA = sl.geo.attributes, tg = EA.aTgt.array, dl = EA.aDelay.array, er = EA.aRand.array, minR2 = 9;
          for (var ep = 0; ep < S; ep++) {
            // only particles that have arrived (and not yet burst) answer the cursor
            var pf = clamp((sl.fo - dl[ep] * 0.6) / 0.4, 0, 1), ee = 1 - (1 - pf) * (1 - pf);
            var bb = clamp((sl.bu - er[ep] * 0.15) / 0.85, 0, 1);
            var lx = tg[ep * 3], ly = tg[ep * 3 + 1], lz = tg[ep * 3 + 2];
            var vx3 = Me[0] * lx + Me[4] * ly + Me[8] * lz + Me[12], vy3 = Me[1] * lx + Me[5] * ly + Me[9] * lz + Me[13], vz3 = Me[2] * lx + Me[6] * ly + Me[10] * lz + Me[14];
            var d2 = surfStep(sl.off, sl.vel, ep * 2, P5 * vx3 / -vz3, P5 * vy3 / -vz3, mouseOn * ee * ee * (1 - bb) * (0.6 + er[ep] * 0.8), dt, damp);
            if (d2 < minR2) minR2 = d2;
          }
          EA.aSurf.needsUpdate = true;
          nearT = mouseOn * smooth(SURF_R * 1.4, SURF_R * 0.4, Math.sqrt(minR2));
        }
        sl.near += (nearT - sl.near) * Math.min(1, dt * 6);
      }
    } else {
      for (s = 0; s < 2; s++) slots[s].near = 0;
    }

    // ambient particles: drift, spring back, move away from the pointer
    var cw = halfW * 1.15, ch = halfH * 1.05;
    var mxL = smx * halfW, myL = smy * halfH, R = halfH * 0.3, R2 = R * R;
    var dC = Math.exp(-2.2 * dt), kk = 1.5;
    for (var i2 = 0; i2 < COUNT; i2++) {
      var i3 = i2 * 3, ph = phase[i2];
      var tx = cloudN[i3] * cw + Math.sin(t * 0.25 + ph) * 0.28;
      var ty = cloudN[i3 + 1] * ch + Math.cos(t * 0.21 + ph * 1.3) * 0.28;
      var tz = cloudN[i3 + 2] * 3;
      var vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2];
      var px = pos[i3], py = pos[i3 + 1], pz = pos[i3 + 2];
      vx += (tx - px) * kk * dt; vy += (ty - py) * kk * dt; vz += (tz - pz) * kk * dt;
      if (active) {
        var dx = px - mxL, dy = py - myL, r2 = dx * dx + dy * dy;
        if (r2 < R2) {
          var rr = Math.sqrt(r2) + 0.0001, f = (1 - rr / R) * 34 * dt;
          vx += dx / rr * f; vy += dy / rr * f;
        }
      }
      vx *= dC; vy *= dC; vz *= dC;
      pos[i3] = px + vx * dt; pos[i3 + 1] = py + vy * dt; pos[i3 + 2] = pz + vz * dt;
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  var fontsReady = document.fonts && document.fonts.load
    ? Promise.all([
        document.fonts.load('700 100px "Bricolage Grotesque"'),
        document.fonts.load('500 60px "Geist Mono"'),
        document.fonts.load('italic 400 100px Tinos')
      ])
    : Promise.resolve();
  Promise.race([fontsReady, new Promise(function(r){ setTimeout(r, 1800); })])
    .catch(function(){})
    .then(function(){ buildLabels(); build1600(); buildCarving(); });

  requestAnimationFrame(frame);
}
