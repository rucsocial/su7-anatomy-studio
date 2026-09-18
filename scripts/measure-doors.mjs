import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const DOOR_GROUPS = {
  door1: ['Object_31','Object_32','Object_33','Object_34','Object_35','Object_36'],
  door2: ['Object_38','Object_39','Object_40','Object_41','Object_42'],
  door3: ['Object_44','Object_45','Object_46','Object_47','Object_48','Object_49'],
  door4: ['Object_51','Object_52','Object_53','Object_54'],
};

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const root = gltf.scene;
  root.rotation.set(0, Math.PI / 2, 0);
  root.updateMatrixWorld(true);
  const byName = new Map();
  root.traverse((o) => { if (o.name) byName.set(o.name, o); });

  // car bounds for reference
  const carBox = new THREE.Box3().setFromObject(root);
  console.log('car bounds', carBox.min.toArray().map(x=>+x.toFixed(3)), carBox.max.toArray().map(x=>+x.toFixed(3)));

  for (const [key, names] of Object.entries(DOOR_GROUPS)) {
    const meshes = names.map(n => byName.get(n)).filter(Boolean);
    if (!meshes.length) { console.log(key, 'MISSING'); continue; }
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // nose is -Z after Y+90
    const isFront = c.z < 0;
    const hingeZ = isFront ? box.min.z : box.max.z;
    console.log(key, {
      center: c.toArray().map(x=>+x.toFixed(3)),
      size: size.toArray().map(x=>+x.toFixed(3)),
      min: box.min.toArray().map(x=>+x.toFixed(3)),
      max: box.max.toArray().map(x=>+x.toFixed(3)),
      isFront,
      hingeZ: +hingeZ.toFixed(3),
      side: c.x < 0 ? 'L' : 'R',
      swing: c.x < 0 ? '+Y' : '-Y',
    });
  }

  // overview roof_glass
  const buf2 = fs.readFileSync('public/models/su7-web.glb');
  const loader2 = new GLTFLoader();
  loader2.parse(buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength), '', (g2) => {
    g2.scene.updateMatrixWorld(true);
    let roof = null;
    g2.scene.traverse(o => { if (o.name === 'roof_glass') roof = o; });
    if (roof) {
      const box = new THREE.Box3().setFromObject(roof);
      const c = box.getCenter(new THREE.Vector3());
      console.log('roof_glass center', c.toArray().map(x=>+x.toFixed(3)), 'size', box.getSize(new THREE.Vector3()).toArray().map(x=>+x.toFixed(3)));
    }
    process.exit(0);
  });
});
