// Simulate: mount doors, then run explosion home-write path — doors must stay put when closed.
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const DOOR_SETS = [
  ['Object_31','Object_32','Object_33','Object_34','Object_35','Object_36'],
  ['Object_38','Object_39','Object_40','Object_41','Object_42'],
  ['Object_44','Object_45','Object_46','Object_47','Object_48','Object_49'],
  ['Object_51','Object_52','Object_53','Object_54'],
];

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const scene = new THREE.Scene();
  const model = gltf.scene;
  model.rotation.set(0, Math.PI / 2, 0);
  scene.add(model);
  model.updateMatrixWorld(true);

  const groupsDoors = new THREE.Group();
  scene.add(groupsDoors);
  const byName = new Map();
  model.traverse((o) => { if (o.name) byName.set(o.name, o); });
  for (const names of DOOR_SETS) for (const n of names) {
    const o = byName.get(n);
    if (o) groupsDoors.attach(o);
  }
  groupsDoors.updateMatrixWorld(true);

  const pieces = [];
  groupsDoors.traverse((o) => {
    if (o.isMesh && o.name && o.name.startsWith('Object_')) {
      pieces.push({ node: o, home: o.position.clone(), part: 'doors' });
    }
  });
  const pivotedPieces = new Set();
  const doorNames = new Map();
  for (const p of pieces) doorNames.set(p.node.name, p.node);

  const worldBefore = new Map();
  for (const p of pieces) worldBefore.set(p.node, p.node.getWorldPosition(new THREE.Vector3()));

  // Mount hinges
  const hinges = [];
  for (const names of DOOR_SETS) {
    const meshes = names.map((n) => doorNames.get(n)).filter(Boolean);
    if (meshes.length < 2) continue;
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const isFront = c.z < 0;
    const hingeZ = isFront ? box.min.z : box.max.z;
    const pivot = new THREE.Group();
    const local = new THREE.Vector3(c.x, c.y, hingeZ);
    groupsDoors.worldToLocal(local);
    pivot.position.copy(local);
    groupsDoors.add(pivot);
    for (const m of meshes) {
      pivot.attach(m);
      pivotedPieces.add(m);
    }
    hinges.push(pivot);
  }
  for (const p of pieces) if (pivotedPieces.has(p.node)) p.home.copy(p.node.position);

  let maxShift = 0;
  for (const p of pieces) {
    const after = p.node.getWorldPosition(new THREE.Vector3());
    maxShift = Math.max(maxShift, after.distanceTo(worldBefore.get(p.node)));
  }
  console.log('max world shift after hinge mount (closed):', maxShift.toFixed(4));

  // Simulate explosion write WITH correct guard
  const amount = 0;
  for (const p of pieces) {
    const pivotManaged = pivotedPieces.has(p.node);
    if (!pivotManaged) p.node.position.copy(p.home);
  }
  let maxShift2 = 0;
  for (const p of pieces) {
    const after = p.node.getWorldPosition(new THREE.Vector3());
    maxShift2 = Math.max(maxShift2, after.distanceTo(worldBefore.get(p.node)));
  }
  console.log('max world shift after guarded home write:', maxShift2.toFixed(4));

  // Simulate explosion write WITHOUT guard (old bug) — should fling
  for (const p of pieces) p.node.position.copy(p.home.add(new THREE.Vector3(0, 1.1, 0)));
  let maxShift3 = 0;
  for (const p of pieces) {
    const after = p.node.getWorldPosition(new THREE.Vector3());
    maxShift3 = Math.max(maxShift3, after.distanceTo(worldBefore.get(p.node)));
  }
  console.log('max world shift after UNGUARDED home write (bug demo):', maxShift3.toFixed(4));

  const ok = maxShift < 0.001 && maxShift2 < 0.001 && maxShift3 > 0.5;
  console.log(ok ? 'GUARD OK' : 'GUARD BAD');
  process.exit(ok ? 0 : 1);
});
