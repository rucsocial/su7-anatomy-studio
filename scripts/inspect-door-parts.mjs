import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const NAMES = [
  'Object_31','Object_32','Object_33','Object_34','Object_35','Object_36',
  'Object_38','Object_39','Object_40','Object_41','Object_42',
  'Object_44','Object_45','Object_46','Object_47','Object_48','Object_49',
  'Object_51','Object_52','Object_53','Object_54',
];

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const root = gltf.scene;
  root.rotation.set(0, Math.PI / 2, 0);
  root.updateMatrixWorld(true);
  const byName = new Map();
  root.traverse((o) => { if (o.name) byName.set(o.name, o); });

  for (const n of NAMES) {
    const o = byName.get(n);
    if (!o) { console.log(n, 'MISSING'); continue; }
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const pos = o.geometry && o.geometry.getAttribute('position');
    console.log(n, {
      center: c.toArray().map((x) => +x.toFixed(3)),
      size: sz.toArray().map((x) => +x.toFixed(3)),
      zRange: [+box.min.z.toFixed(3), +box.max.z.toFixed(3)],
      xRange: [+box.min.x.toFixed(3), +box.max.x.toFixed(3)],
      yRange: [+box.min.y.toFixed(3), +box.max.y.toFixed(3)],
      verts: pos ? pos.count : 0,
    });
  }

  // Classify door extents for hinge at FRONT (min Z)
  const groups = {
    FL: ['Object_31','Object_32','Object_33','Object_34','Object_35','Object_36'],
    RL: ['Object_38','Object_39','Object_40','Object_41','Object_42'],
    FR: ['Object_44','Object_45','Object_46','Object_47','Object_48','Object_49'],
    RR: ['Object_51','Object_52','Object_53','Object_54'],
  };
  console.log('--- door group extents ---');
  for (const [k, names] of Object.entries(groups)) {
    const box = new THREE.Box3();
    for (const n of names) {
      const o = byName.get(n);
      if (o) box.expandByObject(o);
    }
    const c = box.getCenter(new THREE.Vector3());
    console.log(k, {
      centerZ: +c.z.toFixed(3),
      minZ: +box.min.z.toFixed(3),
      maxZ: +box.max.z.toFixed(3),
      // conventional car: hinge at front edge = min Z (nose is -Z)
      frontHingeZ: +box.min.z.toFixed(3),
      rearHingeZ: +box.max.z.toFixed(3),
    });
  }
  process.exit(0);
});
