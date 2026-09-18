// Headless check: can we split Object_56 into 4 wheel buckets?
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const centers = [
  new THREE.Vector3(-0.946659, 0.33635, -1.560669),
  new THREE.Vector3(0.867318, 0.336321, -1.579347),
  new THREE.Vector3(-0.946735, 0.336321, 1.490904),
  new THREE.Vector3(0.867243, 0.33635, 1.454701),
];

const buf = fs.readFileSync('public/models/939243423__su7.glb');
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const root = gltf.scene;
  root.rotation.set(0, Math.PI / 2, 0);
  root.updateMatrixWorld(true);
  let source = null;
  root.traverse((o) => {
    if (o.isMesh && o.name === 'Object_56') source = o;
  });
  if (!source) {
    console.error('Object_56 not found');
    process.exit(1);
  }
  source.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(source);
  const c = box.getCenter(new THREE.Vector3());
  console.log('mesh world center', c.toArray().map((x) => +x.toFixed(3)));
  console.log('mesh world size', box.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(3)));

  const pos = source.geometry.getAttribute('position');
  const index = source.geometry.getIndex();
  const owner = new Uint8Array(pos.count);
  const wv = new THREE.Vector3();
  const minD = [Infinity, Infinity, Infinity, Infinity];
  const maxD = [0, 0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    wv.fromBufferAttribute(pos, i).applyMatrix4(source.matrixWorld);
    let best = 0, bd = Infinity;
    for (let k = 0; k < 4; k++) {
      const d = centers[k].distanceTo(wv);
      if (d < bd) { bd = d; best = k; }
      if (d < minD[k]) minD[k] = d;
      if (d > maxD[k]) maxD[k] = d;
    }
    owner[i] = best;
  }
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < pos.count; i++) counts[owner[i]]++;
  console.log('verts per wheel', counts);
  const tri = [0, 0, 0, 0];
  for (let t = 0; t < index.count / 3; t++) {
    const a = index.getX(t * 3), b = index.getX(t * 3 + 1), c2 = index.getX(t * 3 + 2);
    const o0 = owner[a], o1 = owner[b], o2 = owner[c2];
    const o = (o0 === o1 || o0 === o2) ? o0 : (o1 === o2 ? o1 : o0);
    tri[o]++;
  }
  console.log('tris per wheel', tri, 'total', tri[0] + tri[1] + tri[2] + tri[3], 'src', index.count / 3);
  console.log('dist to centers min', minD.map((x) => +x.toFixed(3)), 'max', maxD.map((x) => +x.toFixed(3)));
  let minPair = Infinity;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minPair = Math.min(minPair, centers[i].distanceTo(centers[j]));
  console.log('min pair center dist', +minPair.toFixed(3));
  const ok = counts.every((n) => n > 1000) && tri.every((n) => n > 500);
  console.log(ok ? 'SPLIT OK' : 'SPLIT BAD');
  process.exit(ok ? 0 : 1);
}, (e) => {
  console.error(e);
  process.exit(1);
});
