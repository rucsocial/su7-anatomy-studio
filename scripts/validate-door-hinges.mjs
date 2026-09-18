// Headless: verify door hinges mount on groups.doors (not model) and free edge moves outward.
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
const LABELS = ['FL','RL','FR','RR'];

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = gltf.scene;
  model.rotation.set(0, Math.PI / 2, 0);
  model.updateMatrixWorld(true);

  // Simulate reparent into a doors group (as vehicle-scene does)
  const groupsDoors = new THREE.Group();
  groupsDoors.name = 'doors';
  const scene = new THREE.Scene();
  scene.add(groupsDoors);

  const byName = new Map();
  model.traverse((o) => { if (o.name) byName.set(o.name, o); });
  for (const names of DOOR_SETS) {
    for (const n of names) {
      const o = byName.get(n);
      if (o) groupsDoors.attach(o);
    }
  }
  groupsDoors.updateMatrixWorld(true);

  // After reparent, model.getObjectByName must fail
  console.log('model still has Object_31?', !!model.getObjectByName('Object_31'));
  console.log('groups.doors has Object_31?', !!groupsDoors.getObjectByName('Object_31'));

  const doorsGroupByName = new Map();
  groupsDoors.traverse((o) => { if (o.name) doorsGroupByName.set(o.name, o); });

  let ok = 0;
  for (let i = 0; i < DOOR_SETS.length; i++) {
    const meshes = DOOR_SETS[i].map((n) => doorsGroupByName.get(n)).filter(Boolean);
    if (meshes.length < 2) { console.log(LABELS[i], 'MISSING', meshes.length); continue; }
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const hingeZ = box.min.z; // conventional: front edge of every door
    const pivot = new THREE.Group();
    const local = new THREE.Vector3(c.x, c.y, hingeZ);
    groupsDoors.worldToLocal(local);
    pivot.position.copy(local);
    groupsDoors.add(pivot);
    const freeZ = box.max.z; // free edge is rear of door
    for (const m of meshes) pivot.attach(m);
    const sign = c.x < 0 ? -1 : 1;
    pivot.rotation.y = sign * Math.PI * 0.42; // ~75°
    pivot.updateMatrixWorld(true);
    const beforeX = c.x;
    // after rotation, recompute world center of door meshes
    const box2 = new THREE.Box3();
    for (const m of meshes) box2.expandByObject(m);
    const c2 = box2.getCenter(new THREE.Vector3());
    const dx = c2.x - beforeX;
    const outward = c.x < 0 ? dx < -0.05 : dx > 0.05;
    console.log(LABELS[i], {
      center: c.toArray().map((x) => +x.toFixed(3)),
      hingeZ: +hingeZ.toFixed(3),
      sign,
      dxAfterOpen: +dx.toFixed(3),
      outward,
      meshes: meshes.length,
    });
    if (outward && meshes.length >= 2) ok++;
    pivot.rotation.y = 0;
  }
  console.log(ok === 4 ? 'DOORS OK' : 'DOORS BAD ' + ok + '/4');
  process.exit(ok === 4 ? 0 : 1);
});
