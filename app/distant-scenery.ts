/**
 * Distant scenery per biome. Everything lives beyond ~44 m so it can never
 * intersect the car, and it is deliberately low-detail: fog + the HDRI horizon
 * do the rest of the work. No new assets — all procedural, so nothing to load.
 */
import * as THREE from 'three';
import type {SceneryKind} from './biomes';

export type SceneryHandle = {
  group: THREE.Group;
  /** Called every frame while visible (water motion, …). */
  update?: (elapsed: number) => void;
  dispose: () => void;
};

const GROUND_Y = -0.19;

/** Seamless tiling wave normal map (integer wave numbers keep the edges matched). */
function waveNormalTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const waves: [number, number, number, number][] = [
    [1, 0, 1.0, 0],
    [2, 1, 0.55, 1.1],
    [3, -2, 0.35, 2.4],
    [5, 3, 0.22, 0.7],
    [7, -5, 0.14, 3.1],
    [11, 6, 0.09, 1.9],
  ];
  const height = (x: number, y: number) => {
    let v = 0;
    for (const [fx, fy, amp, phase] of waves) {
      v += amp * Math.sin(2 * Math.PI * (fx * x + fy * y) + phase);
    }
    return v;
  };
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  const img = ctx.createImageData(size, size);
  const strength = 1.6;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size;
      const v = j / size;
      const e = 1 / size;
      const dx = (height(u + e, v) - height(u - e, v)) / (2 * e);
      const dy = (height(u, v + e) - height(u, v - e)) / (2 * e);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (j * size + i) * 4;
      img.data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

function sea(): SceneryHandle {
  const group = new THREE.Group();
  group.name = 'scenery_sea';
  const normalMap = waveNormalTexture(256);
  normalMap.repeat.set(110, 110);
  const material = new THREE.MeshStandardMaterial({
    color: 0x1b3a49,
    roughness: 0.06,
    metalness: 0.02,
    normalMap,
    normalScale: new THREE.Vector2(0.42, 0.42),
    envMapIntensity: 1.8,
  });
  // Inner 44 m keeps the sand pad clear; outer edge sits past the fog horizon.
  const water = new THREE.Mesh(new THREE.RingGeometry(44, 460, 128, 8), material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = GROUND_Y - 0.03;
  water.receiveShadow = false;
  group.add(water);
  return {
    group,
    update(elapsed) {
      normalMap.offset.x = elapsed * 0.0055;
      normalMap.offset.y = elapsed * 0.0032;
    },
    dispose() {
      water.geometry.dispose();
      material.dispose();
      normalMap.dispose();
    },
  };
}

function trees(): SceneryHandle {
  const group = new THREE.Group();
  group.name = 'scenery_trees';
  const count = 132;
  const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 3.4, 5);
  const canopyGeometry = new THREE.ConeGeometry(1.55, 4.6, 7);
  const topGeometry = new THREE.ConeGeometry(1.05, 3.1, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({color: 0x3b2a20, roughness: 0.95, metalness: 0});
  const canopyMaterial = new THREE.MeshStandardMaterial({color: 0x2f4a2a, roughness: 0.92, metalness: 0});
  const topMaterial = new THREE.MeshStandardMaterial({color: 0x3a5a30, roughness: 0.9, metalness: 0});
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  const canopy = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, count);
  const tops = new THREE.InstancedMesh(topGeometry, topMaterial, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // Annulus 52…150 m, denser near the near edge so the ring reads as a treeline.
    const radius = 52 + Math.pow(Math.random(), 0.7) * 98;
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const scale = 0.85 + Math.random() * 1.15;
    pos.set(Math.cos(angle) * radius, GROUND_Y, Math.sin(angle) * radius);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2);
    scl.set(scale, scale * (0.85 + Math.random() * 0.5), scale);
    m.compose(pos.clone().setY(GROUND_Y + 1.7 * scl.y), q, scl);
    trunks.setMatrixAt(i, m);
    m.compose(pos.clone().setY(GROUND_Y + (3.4 + 2.3) * scl.y), q, scl);
    canopy.setMatrixAt(i, m);
    m.compose(pos.clone().setY(GROUND_Y + (3.4 + 4.5) * scl.y), q, scl);
    tops.setMatrixAt(i, m);
    const k = 0.82 + Math.random() * 0.36;
    tops.setColorAt(i, tint.setRGB(k, k * (0.94 + Math.random() * 0.12), k * 0.9));
  }
  for (const inst of [trunks, canopy, tops]) {
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.castShadow = false;
    inst.receiveShadow = false;
    group.add(inst);
  }
  return {
    group,
    dispose() {
      for (const g of [trunkGeometry, canopyGeometry, topGeometry]) g.dispose();
      for (const mm of [trunkMaterial, canopyMaterial, topMaterial]) mm.dispose();
      trunks.dispose();
      canopy.dispose();
      tops.dispose();
    },
  };
}

function hills(): SceneryHandle {
  const group = new THREE.Group();
  group.name = 'scenery_hills';
  const count = 46;
  const geometry = new THREE.SphereGeometry(1, 18, 10);
  const material = new THREE.MeshStandardMaterial({color: 0x5d6b45, roughness: 1, metalness: 0, flatShading: false});
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const radius = 190 + Math.random() * 300;
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    const rx = 46 + Math.random() * 74;
    const ry = 9 + Math.random() * 22;
    const rz = 46 + Math.random() * 74;
    pos.set(Math.cos(angle) * radius, GROUND_Y - ry * 0.42, Math.sin(angle) * radius);
    scl.set(rx, ry, rz);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
    const k = 0.78 + Math.random() * 0.4;
    mesh.setColorAt(i, tint.setRGB(k * 0.98, k, k * 0.82));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

function skyline(): SceneryHandle {
  const group = new THREE.Group();
  group.name = 'scenery_skyline';
  const count = 108;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({color: 0x4a5361, roughness: 0.78, metalness: 0.12});
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const radius = 132 + Math.random() * 210;
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const w = 9 + Math.random() * 20;
    const d = 9 + Math.random() * 20;
    // A few towers, mostly mid-rise, so the skyline reads as a city not a wall.
    const h = Math.random() < 0.16 ? 60 + Math.random() * 55 : 16 + Math.random() * 34;
    pos.set(Math.cos(angle) * radius, GROUND_Y + h / 2, Math.sin(angle) * radius);
    scl.set(w, h, d);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle + Math.random() * 0.4);
    m.compose(pos, q, scl);
    mesh.setMatrixAt(i, m);
    const k = 0.72 + Math.random() * 0.5;
    mesh.setColorAt(i, tint.setRGB(k * 0.94, k * 0.98, k * 1.06));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  return {
    group,
    dispose() {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
    },
  };
}

export function createScenery(kind: SceneryKind): SceneryHandle | null {
  if (kind === 'sea') return sea();
  if (kind === 'trees') return trees();
  if (kind === 'hills') return hills();
  if (kind === 'skyline') return skyline();
  return null;
}
