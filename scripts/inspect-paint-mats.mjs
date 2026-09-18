import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const root = gltf.scene;
  root.rotation.set(0, Math.PI / 2, 0);
  root.updateMatrixWorld(true);
  const doorNames = new Set([
    'Object_31','Object_32','Object_33','Object_34','Object_35','Object_36',
    'Object_38','Object_39','Object_40','Object_41','Object_42',
    'Object_44','Object_45','Object_46','Object_47','Object_48','Object_49',
    'Object_51','Object_52','Object_53','Object_54',
  ]);
  const bodyNames = new Set([
    'Object_18','Object_19','Object_20','Object_12','Object_16','Object_27','Object_28','Object_29',
  ]);
  const used = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const key = (o.name || '?') + ' | ' + (m.name || '?');
      used[key] = { name: o.name, mat: m.name, color: m.color ? m.color.getHexString() : null };
    }
  });
  console.log('=== door meshes materials ===');
  for (const [k, v] of Object.entries(used)) {
    if (doorNames.has(v.name)) console.log(v.name, v.mat, v.color);
  }
  console.log('=== body shell materials ===');
  for (const [k, v] of Object.entries(used)) {
    if (bodyNames.has(v.name)) console.log(v.name, v.mat, v.color);
  }
  process.exit(0);
});
