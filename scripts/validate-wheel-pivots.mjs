// 轮子 pivot 分配验证（DSH 会话 2026-09-13）
//
//   node --experimental-strip-types scripts/validate-wheel-pivots.mjs
//
// 复刻 app/vehicle-scene.tsx 里 mountWheelPivots() 的分配逻辑，在无头环境里跑，
// 检查：每个轮心分到多少网格、有没有网格被漏掉（漏掉的会原地不动→看起来"胎留毂飞"）、
// 四个轮胎是否落到四个不同的 pivot、以及转 90° 后各轮部件的离散度。
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

// 与 app/vehicles.ts 保持一致（脚本会回读该文件做一致性断言）
const EXPECT = {
  su7: {
    file: 'public/models/su7-web.glb',
    rotation: [0, 0, 0],
    scale: 1,
    longAxis: 'z',
    wheelCenters: [
      [-0.859022, 0.360427, -1.719717],
      [0.837685, 0.360369, -1.725955],
      [-0.86323, 0.360427, 1.292824],
      [0.866156, 0.360427, 1.269729],
    ],
  },
};

const PART_IDS = ['body', 'glass', 'doors', 'cabin', 'battery', 'drive', 'suspension', 'wheels'];

async function run(key) {
  const cfg = EXPECT[key];
  console.log('='.repeat(96));
  console.log(`### ${key}   ${cfg.file}`);
  console.log('='.repeat(96));

  const bytes = fs.readFileSync(cfg.file);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const scene = new THREE.Scene();
  const model = gltf.scene;
  model.rotation.set(...cfg.rotation);
  model.scale.setScalar(cfg.scale);
  scene.add(model);
  model.updateMatrixWorld(true);

  // ---- 复刻加载回调：按 part 建组并 attach ----
  const groups = {};
  for (const id of PART_IDS) { const g = new THREE.Group(); g.name = id; groups[id] = g; scene.add(g); }
  let attached = 0;
  const nodes = [];
  model.traverse(o => { if (o.userData && o.userData.component && o.userData.part) nodes.push(o); });
  for (const node of nodes) {
    const id = node.userData.part;
    if (!groups[id]) continue;
    groups[id].attach(node);
    attached++;
  }
  console.log(`  按 part attach 的顶层节点: ${attached} / 遍历到 ${nodes.length}`);
  // 注意：attach 是就地改父子，traverse 中收集后再 attach 才安全

  // ---- 复刻 mountWheelPivots ----
  groups.wheels.updateMatrixWorld(true);
  const meshes = [];
  groups.wheels.traverse(o => { if (o.isMesh) meshes.push(o); });
  console.log(`  groups.wheels 下的 mesh 总数: ${meshes.length}`);

  const centers = cfg.wheelCenters.map(c => new THREE.Vector3(c[0], c[1], c[2]));
  const wheelAxis = cfg.longAxis === 'x' ? 'z' : 'x';
  console.log(`  轮心数 ${centers.length} | 自转轴 = ${wheelAxis.toUpperCase()}`);

  const pivots = [];
  for (const center of centers) {
    const pivot = new THREE.Group();
    const local = groups.wheels.worldToLocal(center.clone());
    pivot.position.copy(local);
    groups.wheels.add(pivot);
    pivots.push(pivot);
  }

  const box = new THREE.Box3(), c = new THREE.Vector3();
  const assigned = [[], [], [], []];
  const skipped = [];
  const used = new Set();
  for (const m of meshes) {
    if (used.has(m)) continue;
    box.setFromObject(m); box.getCenter(c);
    let best = 0, bd = Infinity;
    for (let i = 0; i < centers.length; i++) { const d = centers[i].distanceTo(c); if (d < bd) { bd = d; best = i; } }
    if (bd > 0.5) { skipped.push({ m, bd, c: c.clone() }); continue; }
    pivots[best].attach(m);
    used.add(m);
    assigned[best].push({ m, bd, c: c.clone() });
  }

  console.log('');
  console.log('  --- 分配结果 ---');
  const CORNER = ['FL(-x,+z)', 'FR(-x,-z)', 'RL(+x,+z)', 'RR(+x,-z)'];
  for (let i = 0; i < 4; i++) {
    const list = assigned[i];
    const tri = list.reduce((s, x) => s + (x.m.geometry.index ? x.m.geometry.index.count / 3 : x.m.geometry.attributes.position.count / 3), 0);
    const maxd = list.length ? Math.max(...list.map(x => x.bd)) : 0;
    console.log(`    pivot ${i} ${CORNER[i]}  件数 ${String(list.length).padStart(3)}  面数 ${String(Math.round(tri)).padStart(6)}  最远件 ${maxd.toFixed(3)} m`);
  }
  console.log(`    ⚠️ 被漏掉（距最近轮心 >0.5 m，不会转）: ${skipped.length} 件`);
  for (const s of skipped.slice(0, 12)) {
    console.log(`        ${(s.m.name || s.m.parent?.name || '?').slice(0, 34).padEnd(36)} 距最近轮心 ${s.bd.toFixed(3)} m  中心 (${s.c.x.toFixed(3)},${s.c.y.toFixed(3)},${s.c.z.toFixed(3)})`);
  }

  // ---- 关键判据 1：四个轮胎是否落到四个不同 pivot ----
  console.log('');
  console.log('  --- 判据 ---');
  const tireOf = new Map();
  for (let i = 0; i < 4; i++) for (const a of assigned[i]) if (/tire|tyre/i.test(a.m.name || '')) tireOf.set(i, (tireOf.get(i) || 0) + 1);
  const tireTotal = [...tireOf.values()].reduce((a, b) => a + b, 0);
  console.log(`    1) Tire 网格分布: ${JSON.stringify(Object.fromEntries(tireOf))}  合计 ${tireTotal}`);

  // ---- 关键判据 2：旋转后各轮部件仍聚在一起 ----
  const phase = Math.PI / 2;
  for (const p of pivots) { if (wheelAxis === 'z') p.rotation.z = phase; else p.rotation.x = phase; }
  scene.updateMatrixWorld(true);

  let worstSpread = 0, worstIdx = -1;
  for (let i = 0; i < 4; i++) {
    if (!assigned[i].length) continue;
    const cs = [];
    for (const a of assigned[i]) { box.setFromObject(a.m); box.getCenter(c); cs.push(c.clone()); }
    // 各件中心到轮心的距离，转后应仍在车轮半径量级内
    const dists = cs.map(p => p.distanceTo(centers[i]));
    const mx = Math.max(...dists);
    if (mx > worstSpread) { worstSpread = mx; worstIdx = i; }
    console.log(`    2) pivot ${i} 旋转 90° 后：各件中心距轮心 max ${mx.toFixed(3)} m（车轮半径约 0.39/0.28）`);
  }
  console.log(`    → 最差 pivot ${worstIdx}: ${worstSpread.toFixed(3)} m  ${worstSpread > 0.5 ? '❌ 明显飞出' : '✅ 仍在轮内'}`);

  // ---- 关键判据 3：整车网格总数守恒 ----
  const after = [];
  groups.wheels.traverse(o => { if (o.isMesh) after.push(o); });
  console.log(`    3) 网格守恒: 处理前 ${meshes.length} → 处理后 ${after.length}  ${meshes.length === after.length ? '✅' : '❌ 丢失'}`);

  // ---- 关键判据 4：爆炸图那段对 piece.node.position 的写入会不会打飞轮子 ----
  // vehicle-scene.tsx 每帧执行:  piece.node.position.copy(piece.home).addScaledVector(spread, amount*…)
  // drive 模式 amount≈0 → 等价于把 node.position 写回 home。
  // 但 mountWheelPivots 已经把 piece.node attach 进 pivot（attach 会算出新的 local position）。
  // 若爆炸代码再覆盖一次 → 轮子被踢飞。这是待验证的假设。
  console.log('');
  console.log('  --- 判据 4：爆炸图位置写入是否打飞轮子（重新加载一遍，采集真实 home）---');
  const gltf2 = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const scene2 = new THREE.Scene();
  const model2 = gltf2.scene;
  model2.rotation.set(...cfg.rotation);
  model2.scale.setScalar(cfg.scale);
  scene2.add(model2);
  model2.updateMatrixWorld(true);

  const groups2 = {};
  for (const id of PART_IDS) { const g = new THREE.Group(); g.name = id; groups2[id] = g; scene2.add(g); }
  const nodes2 = [];
  model2.traverse(o => { if (o.userData && o.userData.component && o.userData.part) nodes2.push(o); });
  const homes2 = new Map();
  for (const node of nodes2) {
    const id = node.userData.part;
    if (!groups2[id]) continue;
    groups2[id].attach(node);
    homes2.set(node, node.position.clone());   // ← 与 app 一致：attach 之后采集 home
  }
  // 挂 pivot
  groups2.wheels.updateMatrixWorld(true);
  const pivots2 = [];
  for (const center of centers) {
    const p = new THREE.Group();
    p.position.copy(groups2.wheels.worldToLocal(center.clone()));
    groups2.wheels.add(p);
    pivots2.push(p);
  }
  const meshes2 = [];
  groups2.wheels.traverse(o => { if (o.isMesh) meshes2.push(o); });
  const box2 = new THREE.Box3(), c2 = new THREE.Vector3();
  const assigned2 = [[], [], [], []];
  for (const m of meshes2) {
    box2.setFromObject(m); box2.getCenter(c2);
    let best = 0, bd = Infinity;
    for (let i = 0; i < centers.length; i++) { const d = centers[i].distanceTo(c2); if (d < bd) { bd = d; best = i; } }
    if (bd > 0.5) continue;
    pivots2[best].attach(m);
    assigned2[best].push(m);
  }
  scene2.updateMatrixWorld(true);
  const afterMount = new Map();
  for (let i = 0; i < 4; i++) for (const m of assigned2[i]) { box2.setFromObject(m); box2.getCenter(c2); afterMount.set(m, c2.clone()); }

  // 模拟爆炸图写入 home
  for (const n of nodes2) n.position.copy(homes2.get(n));
  scene2.updateMatrixWorld(true);

  let maxFly = 0, flyCount = 0;
  for (let i = 0; i < 4; i++) for (const m of assigned2[i]) {
    box2.setFromObject(m); box2.getCenter(c2);
    const d = c2.distanceTo(afterMount.get(m));
    if (d > 0.05) flyCount++;
    if (d > maxFly) maxFly = d;
  }
  console.log(`    写入 piece.home 后轮子位移: 最大 ${maxFly.toFixed(3)} m，受影响 ${flyCount} / ${meshes2.length} 件`);
  console.log(`    → ${maxFly > 0.3 ? '❌ 确认被打飞（未加保护时的表现）' : '⚠️ 未见位移（与预期不符）'}`);

  // ---- 关键判据 5：加上保护后（跳过 pivot 托管的节点）是否不再位移 ----
  // 修复：app/vehicle-scene.tsx 中 pivotedPieces 守卫 —— 对 pivot 托管的 piece 跳过位置写入
  const pivoted = new Set();
  for (let i = 0; i < 4; i++) for (const m of assigned2[i]) pivoted.add(m);
  // 重新采集当前（已被打飞后的）位置作为基准不成立，故再挂一次：先卸载回位
  for (let i = 0; i < 4; i++) {
    const p = pivots2[i];
    if (!p) continue;
    p.rotation.set(0, 0, 0);
    while (p.children.length) groups2.wheels.attach(p.children[0]);
    p.removeFromParent();
  }
  // 重挂 pivot（模拟下一帧 mountWheelPivots）
  const pivots3 = [];
  for (const center of centers) {
    const p = new THREE.Group();
    p.position.copy(groups2.wheels.worldToLocal(center.clone()));
    groups2.wheels.add(p);
    pivots3.push(p);
  }
  const meshes3 = [];
  groups2.wheels.traverse(o => { if (o.isMesh) meshes3.push(o); });
  const box3 = new THREE.Box3(), c3 = new THREE.Vector3();
  const assigned3 = [[], [], [], []];
  const pivoted3 = new Set();
  for (const m of meshes3) {
    box3.setFromObject(m); box3.getCenter(c3);
    let best = 0, bd = Infinity;
    for (let i = 0; i < centers.length; i++) { const d = centers[i].distanceTo(c3); if (d < bd) { bd = d; best = i; } }
    if (bd > 0.5) continue;
    pivots3[best].attach(m);
    assigned3[best].push(m);
    pivoted3.add(m);
  }
  scene2.updateMatrixWorld(true);
  const before3 = new Map();
  for (let i = 0; i < 4; i++) for (const m of assigned3[i]) { box3.setFromObject(m); box3.getCenter(c3); before3.set(m, c3.clone()); }
  // 修复后的爆炸写入：pivot 托管的 piece 跳过
  for (const n of nodes2) {
    if (pivoted3.has(n)) continue;          // ← 修复行为
    n.position.copy(homes2.get(n));
  }
  scene2.updateMatrixWorld(true);
  let maxFly3 = 0, flyCount3 = 0;
  for (let i = 0; i < 4; i++) for (const m of assigned3[i]) {
    box3.setFromObject(m); box3.getCenter(c3);
    const d = c3.distanceTo(before3.get(m));
    if (d > 0.05) flyCount3++;
    if (d > maxFly3) maxFly3 = d;
  }
  console.log('');
  console.log(`    判据 5（修复后）: 位移 最大 ${maxFly3.toFixed(4)} m，受影响 ${flyCount3} / ${meshes3.length} 件`);
  console.log(`    → ${maxFly3 < 0.05 ? '✅ 修复有效：轮子不再被位置写入打飞' : '❌ 仍有位移，修复不完整'}`);

  // ---- 关键判据 6：旋转 + 位置写入同时发生，轮子是否仍贴住轮心 ----
  for (const p of pivots3) { if (wheelAxis === 'z') p.rotation.z = Math.PI / 2; else p.rotation.x = Math.PI / 2; }
  scene2.updateMatrixWorld(true);
  let maxOff = 0;
  for (let i = 0; i < 4; i++) for (const m of assigned3[i]) {
    box3.setFromObject(m); box3.getCenter(c3);
    const d = c3.distanceTo(centers[i]);
    if (d > maxOff) maxOff = d;
  }
  console.log(`    判据 6: 转 90° 后各件中心距轮心 max ${maxOff.toFixed(3)} m  ${maxOff < 0.5 ? '✅ 仍在轮内' : '❌ 飞出'}`);

  return { assigned, skipped, worstSpread, maxFly, flyCount, maxFly3, maxOff };
}

// 一致性断言：脚本里的轮心与 app/vehicles.ts 是否一致
const vt = fs.readFileSync('app/vehicles.ts', 'utf8');
for (const key of Object.keys(EXPECT)) {
  const c = EXPECT[key].wheelCenters;
  const found = c.every(v => vt.includes(String(v[0])));
  console.log(`[一致性] ${key} 的轮心 x 值能在 app/vehicles.ts 中找到: ${found ? '✅' : '❌（脚本已过期，请同步）'}`);
}
console.log('');

for (const key of Object.keys(EXPECT)) {
  await run(key);
  console.log('');
}
