import * as THREE from 'three';
import type { AirflowConfig, HullBox } from './vehicles';

export type AirflowSystem = {
  group: THREE.Group;
  setEnabled: (on: boolean) => void;
  setWindSpeed: (speed: number) => void;
  update: (dt: number, time: number) => void;
  dispose: () => void;
};

const DEFAULT_CONFIG: AirflowConfig = {
  longAxis: 'x',
  flowSign: 1,
  groundY: -0.05,
  inlet: -6.8,
  outlet: 8.5,
  wakeStart: 2.6,
  hull: [
    { c: [0, 0.52, 0], r: [2.42, 0.58, 1.12] },
    { c: [-0.08, 1.18, 0], r: [1.32, 0.48, 0.92] },
    { c: [-2.2, 0.48, 0], r: [0.52, 0.45, 0.98] },
    { c: [2.2, 0.48, 0], r: [0.52, 0.45, 0.98] },
  ],
};

type BoxRuntime = { min: THREE.Vector3; max: THREE.Vector3; c: THREE.Vector3; r: THREE.Vector3 };

function toBoxes(hull: HullBox[]): BoxRuntime[] {
  return hull.map(({ c, r }) => ({
    c: new THREE.Vector3(...c),
    r: new THREE.Vector3(...r),
    min: new THREE.Vector3(c[0] - r[0], c[1] - r[1], c[2] - r[2]),
    max: new THREE.Vector3(c[0] + r[0], c[1] + r[1], c[2] + r[2]),
  }));
}

/** Signed distance to an AABB (negative inside). Gradient ≈ outward normal outside. */
function boxSDF(p: THREE.Vector3, box: BoxRuntime, outN: THREE.Vector3): number {
  const dx = Math.abs(p.x - box.c.x) - box.r.x;
  const dy = Math.abs(p.y - box.c.y) - box.r.y;
  const dz = Math.abs(p.z - box.c.z) - box.r.z;
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  const oz = Math.max(dz, 0);
  const outside = Math.hypot(ox, oy, oz);
  const inside = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
  const d = outside + inside;
  if (outside > 1e-5) {
    const sx = Math.sign(p.x - box.c.x) || 1;
    const sy = Math.sign(p.y - box.c.y) || 1;
    const sz = Math.sign(p.z - box.c.z) || 1;
    outN.set(sx * ox, sy * oy, sz * oz);
    if (outN.lengthSq() > 1e-12) outN.normalize();
    else outN.set(0, 1, 0);
  } else {
    // Deep inside: push toward nearest face
    const ax = box.r.x - Math.abs(p.x - box.c.x);
    const ay = box.r.y - Math.abs(p.y - box.c.y);
    const az = box.r.z - Math.abs(p.z - box.c.z);
    if (ax <= ay && ax <= az) outN.set(Math.sign(p.x - box.c.x) || 1, 0, 0);
    else if (ay <= az) outN.set(0, Math.sign(p.y - box.c.y) || 1, 0);
    else outN.set(0, 0, Math.sign(p.z - box.c.z) || 1);
  }
  return d;
}

function hullDistance(p: THREE.Vector3, boxes: BoxRuntime[], outN: THREE.Vector3): number {
  let best = Infinity;
  const n = new THREE.Vector3();
  for (const b of boxes) {
    const d = boxSDF(p, b, n);
    if (d < best) {
      best = d;
      outN.copy(n);
    }
  }
  return best;
}

function insideHull(p: THREE.Vector3, boxes: BoxRuntime[], pad = 0): boolean {
  for (const b of boxes) {
    if (
      p.x > b.min.x - pad && p.x < b.max.x + pad &&
      p.y > b.min.y - pad && p.y < b.max.y + pad &&
      p.z > b.min.z - pad && p.z < b.max.z + pad
    ) return true;
  }
  return false;
}

function crossSectionY(y: number, z: number, boxes: BoxRuntime[]): boolean {
  // Is the inlet seed (long-axis origin) buried in the hull?
  const p = new THREE.Vector3(0, y, z);
  return insideHull(p, boxes, 0.05);
}

/**
 * Trace one streamline. Free stream along longAxis, then
 * tangential projection near the hull (v = v∞ − (v∞·n)·n·k(d)) so lines
 * slide along the body instead of bouncing off an invisible ball.
 */
function traceStreamline(cfg: AirflowConfig, boxes: BoxRuntime[], y0: number, lateral0: number, steps = 100): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const p = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const inf = new THREE.Vector3();
  const long = cfg.longAxis;
  const sign = cfg.flowSign;

  // Seed at inlet
  if (long === 'x') p.set(cfg.inlet, y0, lateral0);
  else p.set(lateral0, y0, cfg.inlet);

  const wall = 0.06;
  // Wider influence so lines near the silhouette actually bend.
  const influence = 0.95;

  for (let i = 0; i < steps; i++) {
    pts.push(p.clone());

    // Free stream
    inf.set(0, 0, 0);
    if (long === 'x') inf.x = sign;
    else inf.z = sign;
    // Mild ambient lift
    inf.y = 0.015 * Math.sin(lateral0 * 1.3 + p.x * 0.25 + p.z * 0.25);

    const d = hullDistance(p, boxes, n);
    v.copy(inf);

    if (d < influence) {
      // k(d): 1 at surface → 0 at influence edge
      const k = THREE.MathUtils.smoothstep(influence - d, 0, influence - wall);
      // Remove normal component of free stream near wall → tangential slide
      const vn = v.dot(n);
      if (vn < 0) v.addScaledVector(n, -vn * k * 1.15);
      // Push out if penetrating — stronger so the silhouette reads as a solid
      if (d < wall) v.addScaledVector(n, (wall - d) * 2.6);
      // Bernoulli-ish speed-up in the gap (narrower → faster)
      const gapBoost = 0.55 / (d + 0.1);
      v.addScaledVector(inf, Math.min(gapBoost, 0.7) * k);
      // Extra lift over the crown (visible roof sheet)
      if (n.y > 0.35) v.y += n.y * k * 0.22;
    }

    // Ground effect
    const gy = cfg.groundY;
    if (p.y < gy + 0.32) {
      v.y += (gy + 0.32 - p.y) * 1.4;
      // Slight accel under the car
      if (Math.abs(long === 'x' ? p.z : p.x) < 0.9) v[long] *= 1.08;
    }

    // Wake swirl behind the car
    const along = long === 'x' ? p.x : p.z;
    const lat = long === 'x' ? p.z : p.x;
    if (along * sign > cfg.wakeStart) {
      const t01 = Math.min(1, (along * sign - cfg.wakeStart) / 2.4);
      const radial = Math.hypot(p.y - (gy + 0.85), lat) / 1.7;
      const wake = t01 * Math.max(0, 1 - radial);
      const t = along * 0.85;
      v.y += Math.sin(t + lateral0 * 2.1) * wake * 0.22;
      const side = long === 'x' ? 'z' : 'x';
      v[side] += Math.cos(t * 0.9 + y0 * 1.7) * wake * 0.28;
      v[long] *= 1 - wake * 0.18;
    }

    const step = 0.16;
    p.addScaledVector(v, step);
    if (long === 'x' ? p.x > cfg.outlet : p.z > cfg.outlet) break;
  }
  return pts;
}

function ribbonFromCurve(curve: THREE.Vector3[], halfWidth: number): {positions: Float32Array; uvs: Float32Array; indices: Uint16Array} {
  const n = curve.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices = new Uint16Array((n - 1) * 6);
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const p = curve[i];
    if (i < n - 1) dir.subVectors(curve[i + 1], p);
    else dir.subVectors(p, curve[i - 1]);
    dir.normalize();
    side.crossVectors(dir, up).normalize();
    if (side.lengthSq() < 0.01) side.set(0, 0, 1);
    const t = i / (n - 1);
    const w = halfWidth * (0.55 + 0.7 * Math.sin(Math.PI * t));
    positions[i * 6] = p.x;
    positions[i * 6 + 1] = p.y + side.y * w;
    positions[i * 6 + 2] = p.z + side.z * w;
    positions[i * 6 + 3] = p.x;
    positions[i * 6 + 4] = p.y - side.y * w;
    positions[i * 6 + 5] = p.z - side.z * w;
    uvs[i * 4] = t; uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = t; uvs[i * 4 + 3] = 1;
    if (i < n - 1) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = i * 2 + 2;
      const d = i * 2 + 3;
      const o = i * 6;
      indices[o] = a; indices[o + 1] = b; indices[o + 2] = c;
      indices[o + 3] = b; indices[o + 4] = d; indices[o + 5] = c;
    }
  }
  return {positions, uvs, indices};
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Flowing multi-stripe lines. Speed is baked into UV.x stride via time scale.
const fragmentShader = /* glsl */ `
  uniform float vTime;
  uniform float vSpeed;
  uniform float opacity;
  varying vec2 vUv;

  void main() {
    float t = vUv.x;
    float y = vUv.y;
    float s1 = sin((t * 14.0) - vTime * (2.2 + vSpeed * 2.5));
    float s2 = sin((t * 18.0) - vTime * (1.7 + vSpeed * 2.0) + 1.7);
    float stripe = smoothstep(0.72, 0.95, s1) + smoothstep(0.78, 0.98, s2) * 0.7;
    float band = 1.0 - smoothstep(0.15, 0.5, abs(y - 0.5));
    float ends = smoothstep(0.0, 0.07, t) * smoothstep(1.0, 0.92, t);
    // Cooler far from body, warmer near (proxy via stripe intensity)
    vec3 cool = vec3(0.28, 0.62, 1.0);
    vec3 warm = vec3(0.55, 0.82, 1.0);
    vec3 col = mix(cool, warm, stripe) * (0.25 + stripe * 0.9);
    col += vec3(0.15, 0.35, 0.55) * band * 0.45;
    float a = opacity * ends * (0.22 + stripe * 0.78) * (0.35 + band * 0.65);
    gl_FragColor = vec4(col, a);
  }
`;

export function createAirflow(scene: THREE.Scene, config: AirflowConfig = DEFAULT_CONFIG): AirflowSystem {
  const group = new THREE.Group();
  group.name = 'airflow';
  group.visible = false;
  scene.add(group);

  const boxes = toBoxes(config.hull);
  const long = config.longAxis;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      vTime: {value: 0},
      vSpeed: {value: 0.4},
      opacity: {value: 1.0},
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    // L1: body must occlude streamlines — without this the lines float in front of the car.
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });

  const geometries: THREE.BufferGeometry[] = [];

  /** Keep only the span of the curve that is near the hull (plus short lead-in/out). */
  function trimNearBody(pts: THREE.Vector3[], boxes: BoxRuntime[], band: number): THREE.Vector3[] {
    const n = new THREE.Vector3();
    let first = -1;
    let last = -1;
    for (let i = 0; i < pts.length; i++) {
      if (hullDistance(pts[i], boxes, n) <= band) {
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) return [];
    const a = Math.max(0, first - 6);
    const b = Math.min(pts.length - 1, last + 6);
    return pts.slice(a, b + 1);
  }

  function addStreamline(y: number, lat: number, halfWidth: number) {
    if (crossSectionY(y, lat, boxes)) return;
    const pts = traceStreamline(config, boxes, y, lat, 120);
    if (pts.length < 8) return;
    let minD = Infinity;
    const nTmp = new THREE.Vector3();
    for (const p of pts) minD = Math.min(minD, hullDistance(p, boxes, nTmp));
    if (minD > 0.42) return;
    const skin = 0.12;
    for (const p of pts) {
      const d = hullDistance(p, boxes, nTmp);
      if (d < skin) p.addScaledVector(nTmp, skin - d);
    }
    const trimmed = trimNearBody(pts, boxes, 0.7);
    if (trimmed.length < 8) return;
    // Particles-only vehicles (Model X): keep curves for tracers, skip ribbons entirely.
    if ((config.style ?? 'ribbons') === 'particles') {
      curvePool.push(trimmed);
      return;
    }
    const ribbon = ribbonFromCurve(trimmed, Math.min(halfWidth, 0.018));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(ribbon.positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(ribbon.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(ribbon.indices, 1));
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    group.add(mesh);
    curvePool.push(trimmed);
  }

  const curvePool: THREE.Vector3[][] = [];

  // Lower + mid heights only — sky freestream (y≳1.8) was painting long horizontal rails.
  const ySamples = [0.14, 0.24, 0.34, 0.46, 0.58, 0.72, 0.88, 1.02, 1.16, 1.3, 1.42, 1.54, 1.66];
  const latSamples = long === 'x'
    ? [-1.55, -1.35, -1.18, -1.02, -0.86, -0.7, -0.54, -0.38, -0.22, -0.06, 0.06, 0.22, 0.38, 0.54, 0.7, 0.86, 1.02, 1.18, 1.35, 1.55]
    : [-1.35, -1.18, -1.02, -0.86, -0.7, -0.54, -0.38, -0.22, -0.06, 0.06, 0.22, 0.38, 0.54, 0.7, 0.86, 1.02, 1.18, 1.35];

  for (const y of ySamples) {
    for (const lat of latSamples) {
      addStreamline(y, lat, 0.016 + Math.random() * 0.014);
    }
  }

  // Ring of lines just outside the hull — these bend hardest and read as flow shape.
  for (const y of [0.28, 0.48, 0.72, 0.95, 1.18, 1.38, 1.55]) {
    for (const off of [0.08, 0.18, 0.32]) {
      for (const lat of latSamples) {
        const p = new THREE.Vector3(0, y, lat);
        if (insideHull(p, boxes, -0.02)) continue;
        const d = hullDistance(p, boxes, new THREE.Vector3());
        if (d > off + 0.25) continue;
        addStreamline(y, lat, 0.014 + Math.random() * 0.01);
      }
    }
  }

  // Particle tracers — primary look for Model X, motion cue for SU7 ribbons.
  const particlesOnly = (config.style ?? 'ribbons') === 'particles';
  const tracerCount = particlesOnly
    ? Math.min(220, Math.max(80, curvePool.length * 2))
    : Math.min(96, Math.max(48, geometries.length));
  const tracerPos = new Float32Array(tracerCount * 3);
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerMat = new THREE.PointsMaterial({
    color: particlesOnly ? 0xb8e0ff : 0x9fd0f0,
    size: particlesOnly ? 2.5 : 2,
    sizeAttenuation: false,
    transparent: true,
    opacity: particlesOnly ? 0.85 : 0.7,
    depthWrite: false,
    depthTest: true,
  });
  const tracers = new THREE.Points(tracerGeo, tracerMat);
  tracers.frustumCulled = false;
  tracers.renderOrder = 7;
  group.add(tracers);

  // Prefer the already-traced (clamped) curves; fall back to a fresh pass.
  const tracerCurves: THREE.Vector3[][] = curvePool.slice();
  if (tracerCurves.length < 8) {
    for (const y of [0.28, 0.42, 0.58, 0.75, 0.92, 1.08, 1.25, 1.42, 1.58]) {
      for (const lat of latSamples) {
        if (crossSectionY(y, lat, boxes)) continue;
        const pts = traceStreamline(config, boxes, y, lat, 120);
        if (pts.length >= 8) tracerCurves.push(pts);
        if (tracerCurves.length >= tracerCount) break;
      }
      if (tracerCurves.length >= tracerCount) break;
    }
  }
  const tracerMeta = Array.from({length: tracerCount}, (_, i) => ({
    curve: tracerCurves[i % Math.max(1, tracerCurves.length)] ?? [],
    offset: (i * 0.173) % 1,
    speed: 0.12 + (i % 5) * 0.03,
  }));

  // Soft inlet plane
  const inletGeo = new THREE.PlaneGeometry(long === 'x' ? 0.05 : 4.2, long === 'x' ? 4.2 : 0.05, 1, 1);
  const inletMat = new THREE.MeshBasicMaterial({
    color: 0x4a9fd8,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });
  const inlet = new THREE.Mesh(inletGeo, inletMat);
  if (long === 'x') {
    inlet.rotation.y = Math.PI / 2;
    inlet.position.set(config.inlet + 0.2, 1.2, 0);
  } else {
    inlet.position.set(0, 1.2, config.inlet + 0.2);
  }
  group.add(inlet);

  let enabled = false;
  let windSpeed = 0.4;
  let clock = 0;
  const tmp = new THREE.Vector3();
  const nTmp2 = new THREE.Vector3();

  return {
    group,
    setEnabled(on) {
      enabled = on;
      group.visible = on;
    },
    setWindSpeed(speed) {
      windSpeed = THREE.MathUtils.clamp(speed / 3.2, 0, 1);
      material.uniforms.vSpeed.value = windSpeed;
    },
    update(dt, time) {
      if (!enabled) return;
      material.uniforms.vTime.value = time;
      clock += dt * (0.35 + windSpeed * 1.4);
      for (let i = 0; i < tracerCount; i++) {
        const meta = tracerMeta[i];
        const curve = meta.curve;
        if (!curve || curve.length < 2) {
          tracerPos[i * 3] = 0; tracerPos[i * 3 + 1] = -99; tracerPos[i * 3 + 2] = 0;
          continue;
        }
        const t = (meta.offset + clock * meta.speed) % 1;
        const f = t * (curve.length - 1);
        const i0 = Math.floor(f);
        const i1 = Math.min(curve.length - 1, i0 + 1);
        const a = curve[i0];
        const b = curve[i1];
        const u = f - i0;
        const px = a.x + (b.x - a.x) * u;
        const py = a.y + (b.y - a.y) * u;
        const pz = a.z + (b.z - a.z) * u;
        // Keep tracers outside the hull so they never pop inside the car body.
        tmp.set(px, py, pz);
        const d = hullDistance(tmp, boxes, nTmp2);
        if (d < 0.1) tmp.addScaledVector(nTmp2, 0.1 - d);
        tracerPos[i * 3] = tmp.x;
        tracerPos[i * 3 + 1] = tmp.y;
        tracerPos[i * 3 + 2] = tmp.z;
      }
      tracerGeo.getAttribute('position').needsUpdate = true;
    },
    dispose() {
      group.removeFromParent();
      geometries.forEach((g) => g.dispose());
      material.dispose();
      tracerGeo.dispose();
      tracerMat.dispose();
      inletGeo.dispose();
      inletMat.dispose();
    },
  };
}
