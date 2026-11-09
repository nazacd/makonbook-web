import * as THREE from 'three';

// The onboarding's globe (three.js, imperative; Globe.tsx wraps it): a night
// Earth rising from the bottom of the page. Land is drawn as dots sampled
// from public/globe/land.png (Natural Earth, public domain), the universities
// as gold points, the chosen one as a beam of light, Tashkent as home, and
// the finale as an arc from home to the dream.

export type GlobePoint = { id: string; lat: number; lng: number };
/** How much of the globe shows: big for choosing, low behind the questions. */
export type GlobeMode = 'welcome' | 'hero' | 'low';

const DEG = Math.PI / 180;
/** The elevation (from the globe's centre) at which a focused point sits: up and towards the viewer. */
const FOCUS_ELEVATION = 38 * DEG;
const HOME = { lat: 41.31, lng: 69.28 }; // Tashkent

const COLORS = {
  ocean: new THREE.Color('#1b1042'),
  oceanRim: new THREE.Color('#5a35b8'),
  land: new THREE.Color('#c9baff'),
  atmosphere: new THREE.Color('#8f6bff'),
  university: new THREE.Color('#f6c343'),
  match: new THREE.Color('#ffffff'),
  home: new THREE.Color('#7fe3d4'),
  beam: new THREE.Color('#ffd76a'),
};

/** A point on the unit sphere: longitude 0 faces +z, north is +y. */
export function toVector(lat: number, lng: number, r = 1): THREE.Vector3 {
  const la = lat * DEG;
  const lo = lng * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Points spread evenly over a sphere (a Fibonacci lattice). */
function fibonacci(n: number): Array<{ lat: number; lng: number }> {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const theta = golden * i;
    out.push({ lat: Math.asin(y) / DEG, lng: wrap(theta) / DEG });
  }
  return out;
}

/** Land dots: the lattice's points that fall on land in the mask. */
async function landDots(n: number): Promise<Float32Array> {
  const img = new Image();
  img.src = '/globe/land.png';
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  const out: number[] = [];
  for (const p of fibonacci(n)) {
    const x = Math.min(width - 1, Math.floor(((p.lng + 180) / 360) * width));
    const y = Math.min(height - 1, Math.floor(((90 - p.lat) / 180) * height));
    if (data[(y * width + x) * 4]! > 127) {
      const v = toVector(p.lat, p.lng, 1.002);
      out.push(v.x, v.y, v.z);
    }
  }
  return new Float32Array(out);
}

// Round, soft dots that dim on the far side of the globe.
const DOT_VERTEX = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  attribute float alpha;
  uniform float pixelRatio;
  uniform float scale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    float facing = dot(normal, toCamera);
    vAlpha = alpha * smoothstep(-0.05, 0.35, facing);
    vColor = color;
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * pixelRatio * scale * (6.0 / -mv.z);
  }
`;
const DOT_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function dotMaterial(pixelRatio: number) {
  return new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: pixelRatio }, scale: { value: 1 } },
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
}

export type SceneOptions = {
  reducedMotion: boolean;
  onPick?: (id: string) => void;
  /** Called once the land has been drawn (the globe is ready to show). */
  onReady?: () => void;
};

export class GlobeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  private globe = new THREE.Group();
  private universities: THREE.Points | null = null;
  private uniData: GlobePoint[] = [];
  private uniIndex = new Map<string, number>();
  private beam = new THREE.Group();
  private ring: THREE.Mesh;
  private ring2: THREE.Mesh;
  private home = new THREE.Group();
  private arc: THREE.Mesh | null = null;
  private arcProgress = 0;
  private stars: THREE.Points;
  private atmosphere: THREE.Mesh;
  private land: THREE.Points | null = null;
  private dpr: number;
  private width = 1;
  private height = 1;
  private frame = 0;
  private clock = new THREE.Clock();
  // Orientation: yaw (around the poles) and pitch (tilt), with targets the animation eases to.
  private yaw = -HOME.lng * DEG;
  private pitch = FOCUS_ELEVATION - HOME.lat * DEG;
  private targetYaw = this.yaw;
  private targetPitch = this.pitch;
  private idle = true;
  private mode: GlobeMode = 'hero';
  private layout = { radius: 1, y: -1 };
  private targetLayout = { radius: 1, y: -1 };
  private drag: { x: number; y: number; yaw: number; pitch: number; moved: boolean; t: number } | null = null;
  private velocity = 0;
  private selected: string | null = null;
  private stopped = false;
  private opts: SceneOptions;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: SceneOptions,
  ) {
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, 6);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.globe);

    // The ocean: a dark sphere, lighter towards its rim.
    const ocean = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 96),
      new THREE.ShaderMaterial({
        uniforms: { deep: { value: COLORS.ocean }, rim: { value: COLORS.oceanRim } },
        vertexShader: /* glsl */ `
          varying float vRim;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vec3 normal = normalize(mat3(modelMatrix) * normal);
            vRim = 1.0 - max(dot(normal, normalize(cameraPosition - world.xyz)), 0.0);
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 deep; uniform vec3 rim; varying float vRim;
          void main() { gl_FragColor = vec4(mix(deep, rim, pow(vRim, 2.2)), 1.0); }`,
      }),
    );
    this.globe.add(ocean);

    // The atmosphere: a glow around the rim, drawn from the inside of a slightly larger sphere.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.13, 64, 64),
      new THREE.ShaderMaterial({
        uniforms: { glow: { value: COLORS.atmosphere } },
        vertexShader: /* glsl */ `
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vNormal = normalize(mat3(modelMatrix) * normal);
            vView = normalize(cameraPosition - world.xyz);
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        // Seen from inside (BackSide): strongest against the globe's edge, nothing at its own.
        fragmentShader: /* glsl */ `
          uniform vec3 glow; varying vec3 vNormal; varying vec3 vView;
          void main() {
            float i = pow(clamp(-dot(vNormal, vView), 0.0, 1.0), 2.2);
            gl_FragColor = vec4(glow, i * 1.1);
          }`,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(atmosphere); // not rotated with the globe: the glow stays put
    this.atmosphere = atmosphere;

    // The chosen university: a beam of light and two rings.
    const beamGeometry = new THREE.CylinderGeometry(0.004, 0.012, 0.42, 16, 1, true);
    beamGeometry.translate(0, 0.21, 0);
    const beamMaterial = new THREE.ShaderMaterial({
      uniforms: { color: { value: COLORS.beam } },
      vertexShader: /* glsl */ `varying float vY; void main() { vY = position.y / 0.42; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform vec3 color; varying float vY; void main() { gl_FragColor = vec4(color, (1.0 - vY) * 0.9); }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beam.add(new THREE.Mesh(beamGeometry, beamMaterial));
    const ringMaterial = () => new THREE.MeshBasicMaterial({ color: COLORS.beam, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 48), ringMaterial());
    this.ring2 = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 48), ringMaterial());
    this.ring.rotation.x = this.ring2.rotation.x = -Math.PI / 2;
    this.beam.add(this.ring, this.ring2);
    this.beam.visible = false;
    this.globe.add(this.beam);

    // Home: Tashkent, a small teal pulse.
    const homeDot = new THREE.Mesh(new THREE.CircleGeometry(0.009, 24), new THREE.MeshBasicMaterial({ color: COLORS.home, side: THREE.DoubleSide }));
    homeDot.rotation.x = -Math.PI / 2;
    const homeRing = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.018, 40), new THREE.MeshBasicMaterial({ color: COLORS.home, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    homeRing.rotation.x = -Math.PI / 2;
    this.home.add(homeDot, homeRing);
    this.placeOnSurface(this.home, HOME.lat, HOME.lng, 1.003);
    this.globe.add(this.home);

    // Stars, far behind.
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const starColors = new Float32Array(starCount * 3);
    const starAlpha = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 20);
      v.z = -Math.abs(v.z) - 8;
      starPositions.set([v.x, v.y, v.z], i * 3);
      starSizes[i] = 0.6 + Math.random() * 1.6;
      const c = new THREE.Color().setHSL(0.72 + Math.random() * 0.1, 0.4, 0.85);
      starColors.set([c.r, c.g, c.b], i * 3);
      starAlpha[i] = 0.25 + Math.random() * 0.6;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('alpha', new THREE.BufferAttribute(starAlpha, 1));
    const starMaterial = new THREE.ShaderMaterial({
      uniforms: { pixelRatio: { value: this.dpr }, time: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float size; attribute vec3 color; attribute float alpha;
        uniform float pixelRatio; uniform float time;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha * (0.65 + 0.35 * sin(time * 1.3 + position.x * 7.0 + position.y * 3.0));
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
          gl_PointSize = size * pixelRatio;
        }`,
      fragmentShader: DOT_FRAGMENT,
      transparent: true,
      depthWrite: false,
    });
    this.stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.stars);

    this.bindPointer();
    this.resize();
    void this.loadLand();
    this.loop();
  }

  private async loadLand() {
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const positions = await landDots(small ? 22000 : 42000);
    if (this.stopped) return;
    const n = positions.length / 3;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n).fill(small ? 2 : 1.9), 1));
    const colors = new Float32Array(n * 3);
    const alpha = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // A little variation, like city lights at night.
      const c = COLORS.land.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      colors.set([c.r, c.g, c.b], i * 3);
      alpha[i] = 0.7 + Math.random() * 0.3;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    this.land = new THREE.Points(g, dotMaterial(this.dpr));
    this.globe.add(this.land);
    this.opts.onReady?.();
  }

  /** Puts an object on the globe's surface at lat/lng, standing on it (its +y along the normal). */
  private placeOnSurface(obj: THREE.Object3D, lat: number, lng: number, r: number) {
    const normal = toVector(lat, lng);
    obj.position.copy(normal).multiplyScalar(r);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }

  /** The universities, drawn as gold points. */
  setUniversities(points: GlobePoint[]) {
    this.uniData = points;
    this.uniIndex = new Map(points.map((p, i) => [p.id, i]));
    if (this.universities) {
      this.globe.remove(this.universities);
      this.universities.geometry.dispose();
    }
    const n = points.length;
    const positions = new Float32Array(n * 3);
    points.forEach((p, i) => {
      const v = toVector(p.lat, p.lng, 1.006);
      positions.set([v.x, v.y, v.z], i * 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n).fill(4.2), 1));
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([COLORS.university.r, COLORS.university.g, COLORS.university.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n).fill(0.95), 1));
    this.universities = new THREE.Points(g, dotMaterial(this.dpr));
    this.universities.renderOrder = 2;
    this.globe.add(this.universities);
    this.paintUniversities(new Set());
  }

  /** Brightens the universities a search matches (others dim); an empty set shows all alike. */
  highlight(ids: Set<string>) {
    this.paintUniversities(ids);
  }

  private paintUniversities(matches: Set<string>) {
    if (!this.universities) return;
    const size = this.universities.geometry.getAttribute('size') as THREE.BufferAttribute;
    const color = this.universities.geometry.getAttribute('color') as THREE.BufferAttribute;
    const alpha = this.universities.geometry.getAttribute('alpha') as THREE.BufferAttribute;
    const any = matches.size > 0;
    this.uniData.forEach((p, i) => {
      const on = matches.has(p.id);
      const chosen = p.id === this.selected;
      size.setX(i, chosen ? 9 : on ? 6.5 : any ? 3 : 4.2);
      const c = chosen || on ? COLORS.match : COLORS.university;
      color.setXYZ(i, c.r, c.g, c.b);
      alpha.setX(i, chosen || on || !any ? 0.95 : 0.4);
    });
    size.needsUpdate = color.needsUpdate = alpha.needsUpdate = true;
  }

  /** Turns the globe so lat/lng faces the viewer, up near the globe's top. */
  focus(lat: number, lng: number) {
    this.idle = false;
    const yaw = -lng * DEG;
    this.targetYaw = this.yaw + wrap(yaw - this.yaw);
    this.targetPitch = FOCUS_ELEVATION - lat * DEG;
    if (this.opts.reducedMotion) {
      this.yaw = this.targetYaw;
      this.pitch = this.targetPitch;
    }
  }

  /** The chosen university: a beam of light on it, and the globe turned to it. */
  select(id: string | null) {
    this.selected = id;
    const i = id == null ? undefined : this.uniIndex.get(id);
    const p = i == null ? null : this.uniData[i]!;
    this.beam.visible = !!p;
    if (p) {
      this.placeOnSurface(this.beam, p.lat, p.lng, 1.004);
      this.focus(p.lat, p.lng);
    }
    this.paintUniversities(new Set());
  }

  /** Lets the globe drift on its own again (nothing chosen). */
  release() {
    this.idle = true;
  }

  /** The finale: an arc from Tashkent to the chosen university, drawn out. */
  flyTo(id: string | null) {
    if (this.arc) {
      this.globe.remove(this.arc);
      this.arc.geometry.dispose();
      this.arc = null;
    }
    const i = id == null ? undefined : this.uniIndex.get(id);
    if (i == null) return;
    const p = this.uniData[i]!;
    const a = toVector(HOME.lat, HOME.lng);
    const b = toVector(p.lat, p.lng);
    const lift = 1 + Math.min(0.2, Math.max(0.06, a.angleTo(b) * 0.1));
    const points: THREE.Vector3[] = [];
    for (let k = 0; k <= 64; k++) {
      const t = k / 64;
      const v = a.clone().lerp(b, t).normalize();
      if (v.lengthSq() < 0.5) v.copy(a); // (antipodes: never in practice)
      points.push(v.multiplyScalar(1 + (lift - 1) * Math.sin(Math.PI * t)));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 128, 0.0045, 8, false);
    this.arc = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: COLORS.beam, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.arcProgress = this.opts.reducedMotion ? 1 : 0;
    geometry.setDrawRange(0, this.opts.reducedMotion ? Infinity : 0);
    this.globe.add(this.arc);
    // Frame both ends: turn to the middle of the way.
    const mid = a.clone().add(b).normalize();
    this.focus(Math.asin(mid.y) / DEG, Math.atan2(mid.x, mid.z) / DEG);
  }

  setMode(mode: GlobeMode) {
    this.mode = mode;
    this.targetLayout = this.layoutFor(mode);
    if (this.opts.reducedMotion) this.layout = { ...this.targetLayout };
  }

  /** Where the globe sits: its radius and centre height, in world units, for the canvas's shape. */
  private layoutFor(mode: GlobeMode) {
    const halfH = 6 * Math.tan((this.camera.fov / 2) * DEG);
    const aspect = this.width / this.height;
    const halfW = halfH * aspect;
    const narrow = aspect < 0.8;
    const radius = narrow ? halfW * (mode === 'low' ? 1.15 : 1.25) : Math.min(halfW * 0.78, halfH * (mode === 'low' ? 1.4 : 1.55));
    // The globe's top, as a share of the height from the top of the canvas.
    const top = mode === 'hero' ? (narrow ? 0.52 : 0.4) : mode === 'welcome' ? (narrow ? 0.62 : 0.6) : narrow ? 0.74 : 0.66;
    return { radius, y: halfH * (1 - 2 * top) - radius };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.targetLayout = this.layoutFor(this.mode);
    if (this.frame === 0 || this.opts.reducedMotion) this.layout = { ...this.targetLayout };
  }

  private bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }

  private onDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch, moved: false, t: performance.now() };
    this.velocity = 0;
  };

  private onMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    this.idle = false;
    const k = (1.6 / Math.max(240, this.width)) * (2 / this.layout.radius);
    const yaw = d.yaw + dx * k;
    const now = performance.now();
    this.velocity = (yaw - this.yaw) / Math.max(8, now - d.t);
    d.t = now;
    this.yaw = this.targetYaw = yaw;
    this.pitch = this.targetPitch = Math.max(-50 * DEG, Math.min(95 * DEG, d.pitch + dy * k));
  };

  private onUp = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.moved) {
      if (!this.opts.reducedMotion) this.targetYaw = this.yaw + this.velocity * 260;
      return;
    }
    const id = this.pick(e.clientX, e.clientY);
    if (id) this.opts.onPick?.(id);
  };

  /** The university drawn nearest a click (within 16 px), on the near side only. */
  private pick(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const v = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    let best: string | null = null;
    let bestD = 16 * 16;
    this.globe.updateMatrixWorld();
    for (const p of this.uniData) {
      v.copy(toVector(p.lat, p.lng, 1.006)).applyMatrix4(this.globe.matrixWorld);
      toCamera.copy(this.camera.position).sub(v);
      const normal = v.clone().sub(this.globe.position).normalize();
      if (normal.dot(toCamera.normalize()) < 0.1) continue;
      v.project(this.camera);
      const sx = ((v.x + 1) / 2) * this.width;
      const sy = ((1 - v.y) / 2) * this.height;
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  private loop = () => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const ease = this.opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.2);

    if (this.idle && !this.drag && !this.opts.reducedMotion) this.targetYaw -= dt * 0.035;
    if (!this.drag) {
      this.yaw += (this.targetYaw - this.yaw) * ease;
      this.pitch += (this.targetPitch - this.pitch) * ease;
    }
    this.layout.radius += (this.targetLayout.radius - this.layout.radius) * ease;
    this.layout.y += (this.targetLayout.y - this.layout.y) * ease;

    this.globe.position.set(0, this.layout.y, 0);
    this.globe.scale.setScalar(this.layout.radius);
    this.globe.rotation.set(this.pitch, this.yaw, 0, 'XYZ');
    this.atmosphere.position.copy(this.globe.position);
    this.atmosphere.scale.setScalar(this.layout.radius);
    const scale = this.layout.radius / 1.6;
    for (const o of [this.universities, this.land]) if (o) (o.material as THREE.ShaderMaterial).uniforms.scale!.value = scale;

    if (!this.opts.reducedMotion) {
      (this.stars.material as THREE.ShaderMaterial).uniforms.time!.value = t;
      if (this.beam.visible) {
        const pulse = (k: number) => {
          const s = (t * 0.7 + k) % 1;
          return { scale: 1 + s * 3.2, opacity: 0.85 * (1 - s) };
        };
        for (const [ring, k] of [[this.ring, 0], [this.ring2, 0.5]] as const) {
          const p = pulse(k);
          ring.scale.setScalar(p.scale);
          (ring.material as THREE.MeshBasicMaterial).opacity = p.opacity;
        }
      }
      const h = 1 + 0.35 * Math.sin(t * 2.2);
      this.home.children[1]!.scale.setScalar(h);
    }
    if (this.arc && this.arcProgress < 1) {
      this.arcProgress = Math.min(1, this.arcProgress + dt / 1.6);
      const total = this.arc.geometry.index?.count ?? 0;
      this.arc.geometry.setDrawRange(0, Math.floor(total * this.arcProgress / 6) * 6);
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}

/** Whether this browser can draw WebGL at all. */
export function canDrawWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
