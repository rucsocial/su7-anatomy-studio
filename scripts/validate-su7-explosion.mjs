import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createExplosionLayout,layoutCenter,overviewDirection} from '../app/explosion-layout.ts';

// Node lacks browser globals that GLTFLoader touches for embedded textures.
globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

const SCALE = 0.2533153540433125;
const nodeMap = {
  body_panels_main: 'body', body_panels_outer: 'body', body_panels_upper_a: 'body', body_panels_upper_b: 'body',
  body_paint_front: 'body', body_paint_rear: 'body', body_paint_sides: 'body', front_bumper: 'body',
  rear_bumper_trim: 'body', rear_bumper_lower: 'body', front_grille_panel: 'body', trim_rear_spoiler_edge: 'body',
  underbody: 'body', detail_cowl: 'body', detail_rear_badge: 'body', detail_roof_antenna: 'body',
  lights_head: 'body', lights_tail: 'body',
  glass_greenhouse: 'glass', roof_glass: 'glass', glass_hidden_alpha0: 'glass',
  cabin_block: 'cabin', cabin_headliner: 'cabin',
  wheel_fl_tire: 'wheels', wheel_fl_rim: 'wheels', wheel_fl_hub: 'wheels', wheel_fl_sidewall: 'wheels',
  wheel_fr_tire: 'wheels', wheel_fr_rim: 'wheels', wheel_fr_hub: 'wheels', wheel_fr_sidewall: 'wheels',
  wheel_rl_tire: 'wheels', wheel_rl_rim: 'wheels', wheel_rl_hub: 'wheels', wheel_rl_sidewall: 'wheels',
  wheel_rr_tire: 'wheels', wheel_rr_rim: 'wheels', wheel_rr_hub: 'wheels', wheel_rr_sidewall: 'wheels',
};

const bytes = fs.readFileSync('public/models/su7-web.glb');
const asset = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ''
);
// vehicle_root in su7-web.glb already carries metric scale 0.2533 and X −90°.
asset.scene.updateMatrixWorld(true);

const byName = new Map();
asset.scene.traverse(o => { if (o.name && !byName.has(o.name)) byName.set(o.name, o); });

const input = [];
for (const [name, part] of Object.entries(nodeMap)) {
  const o = byName.get(name);
  assert(o, `missing node ${name}`);
  input.push({ id: name, part, bounds: new THREE.Box3().setFromObject(o) });
}
assert.equal(input.length, 39);

// Sanity: overall length along Z ≈ 5 m after transform.
const overall = new THREE.Box3();
for (const p of input) overall.union(p.bounds);
const size = overall.getSize(new THREE.Vector3());
assert(size.z > 4.5 && size.z < 5.5, `car length Z=${size.z.toFixed(3)} expected ~5`);
assert(size.y > 1.2 && size.y < 1.6, `car height Y=${size.y.toFixed(3)} expected ~1.4`);
assert(size.x > 1.8 && size.x < 2.5, `car width X=${size.x.toFixed(3)} expected ~2.2`);

const result = createExplosionLayout(input);
assert.equal(result.pieces.size, 39);
const slots = [...result.pieces.values()];
for (let i = 0; i < slots.length; i++) {
  for (let j = i + 1; j < slots.length; j++) {
    const a = slots[i], b = slots[j];
    assert(
      Math.abs(a.u - b.u) >= (a.width + b.width) / 2 - 1e-7 ||
      Math.abs(a.v - b.v) >= (a.height + b.height) / 2 - 1e-7,
      `Pieces ${i} and ${j} overlap`
    );
  }
}
for (const aspect of [0.7, 1.3, 2]) {
  const camera = new THREE.PerspectiveCamera(37, aspect, 0.05, 500);
  const tan = Math.tan(THREE.MathUtils.degToRad(37 / 2));
  const distance = Math.max(result.height / (2 * tan), result.width / (2 * tan * aspect)) * 1.18 + 3;
  camera.position.copy(layoutCenter).addScaledVector(overviewDirection, distance);
  camera.lookAt(layoutCenter);
  camera.updateMatrixWorld(true);
  for (const p of input) {
    const slot = result.pieces.get(p.id);
    for (const x of [p.bounds.min.x, p.bounds.max.x])
      for (const y of [p.bounds.min.y, p.bounds.max.y])
        for (const z of [p.bounds.min.z, p.bounds.max.z]) {
          const projected = new THREE.Vector3(x, y, z).add(slot.translation).project(camera);
          assert(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z < 1, `Piece ${p.id} outside view at ${aspect}`);
        }
  }
}

// Four wheels independently present
const wheelIds = input.filter(p => p.part === 'wheels').map(p => p.id);
assert.equal(wheelIds.length, 16);

console.log(
  `SU7 OK: 39 pieces, dims ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)} m, ` +
  `${slots.length} non-overlapping slots, camera coverage at 3 aspects.`
);
