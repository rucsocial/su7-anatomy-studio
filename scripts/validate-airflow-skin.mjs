// 气流船体「贴皮」验证（DSH 会话 2026-09-13）
//
//   node --experimental-strip-types scripts/validate-airflow-skin.mjs
//
// 与 validate-airflow-hull.mjs 的区别：
//   那个只比"船体并集的包围盒" vs "车身包围盒" —— 包围盒够大 ≠ 表面在船体里。
//   本脚本按【整车顶点】采样，量每个顶点到船体的有符号距离，找出真正穿出去的区域。
//
// 为什么这件事决定"粒子穿不穿车身"：
//   气流粒子/丝带是被船体 SDF 往外推到 d >= skin 的。如果车身表面落在船体外，
//   粒子就会被推到一个【位于车身内部】的假表面上 → 视觉上就是"穿过车身"。
import fs from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:mock';
  globalThis.URL.revokeObjectURL = () => {};
}

// 船体【直接从 app/vehicles.ts 解析】—— 单一事实来源，避免脚本与配置漂移
const VT_SRC = fs.readFileSync('app/vehicles.ts', 'utf8');

function sliceBracket(s, openIdx, open, close) {
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === open) d++;
    else if (s[i] === close) { d--; if (d === 0) return s.slice(openIdx, i + 1); }
  }
  throw new Error('bracket unbalanced');
}

function parseHull(vehicleKey) {
  const start = Math.max(
    VT_SRC.indexOf(`'${vehicleKey}': {`),
    VT_SRC.indexOf(`\n  ${vehicleKey}: {`),
  );
  if (start < 0) throw new Error(`vehicles.ts 里找不到 ${vehicleKey}`);
  const af = VT_SRC.indexOf('airflow: {', start);
  const h = VT_SRC.indexOf('hull: [', af);
  if (af < 0 || h < 0) throw new Error(`${vehicleKey} 缺 airflow.hull`);
  const body = sliceBracket(VT_SRC, h + 'hull: '.length, '[', ']');
  const out = [];
  const re = /\{\s*c:\s*\[([^\]]+)\]\s*,\s*r:\s*\[([^\]]+)\]\s*\}/g;
  let m;
  while ((m = re.exec(body))) {
    out.push({ c: m[1].split(',').map(Number), r: m[2].split(',').map(Number) });
  }
  if (!out.length) throw new Error(`${vehicleKey} hull 解析出 0 个盒子`);
  return out;
}

const CASES = {
  su7: {
    file: 'public/models/su7-web.glb',
    rotation: [0, 0, 0],
    scale: 1,
    longAxis: 'z',
    hull: parseHull('su7'),
  },
};

const SAMPLE = 7;

function sdfBox(p, b) {
  const dx = Math.abs(p.x - b.c[0]) - b.r[0];
  const dy = Math.abs(p.y - b.c[1]) - b.r[1];
  const dz = Math.abs(p.z - b.c[2]) - b.r[2];
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0), oz = Math.max(dz, 0);
  return Math.hypot(ox, oy, oz) + Math.min(Math.max(dx, Math.max(dy, dz)), 0);
}
function hullDist(p, hull) {
  let best = Infinity;
  for (const b of hull) { const d = sdfBox(p, b); if (d < best) best = d; }
  return best;
}

let failed = false;
for (const [key, cfg] of Object.entries(CASES)) {
  console.log('='.repeat(100));
  console.log(`### ${key}   ${cfg.file}   hull ${cfg.hull.length} 盒`);
  console.log('='.repeat(100));

  const bytes = fs.readFileSync(cfg.file);
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const model = gltf.scene;
  model.rotation.set(...cfg.rotation);
  model.scale.setScalar(cfg.scale);
  model.updateMatrixWorld(true);

  const v = new THREE.Vector3();
  let total = 0, outside = 0, maxD = -Infinity, worst = null;
  const BB = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const bins = new Map();

  model.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += SAMPLE) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      total++;
      for (let k = 0; k < 3; k++) {
        if (v.getComponent(k) < BB[k]) BB[k] = v.getComponent(k);
        if (v.getComponent(k) > BB[3 + k]) BB[3 + k] = v.getComponent(k);
      }
      const d = hullDist(v, cfg.hull);
      if (d > 0) {
        outside++;
        const along = cfg.longAxis === 'x' ? v.x : v.z;
        const bk = Math.round(along * 4) / 4;
        const cur = bins.get(bk) ?? { n: 0, maxD: -Infinity, yMin: Infinity, yMax: -Infinity };
        cur.n++; if (d > cur.maxD) cur.maxD = d;
        if (v.y < cur.yMin) cur.yMin = v.y;
        if (v.y > cur.yMax) cur.yMax = v.y;
        bins.set(bk, cur);
      }
      if (d > maxD) { maxD = d; worst = v.clone(); }
    }
  });

  console.log(`  采样顶点 ${total.toLocaleString()}（每 ${SAMPLE} 取 1）`);
  console.log(`  车身包围盒 X[${BB[0].toFixed(2)}, ${BB[3].toFixed(2)}] Y[${BB[1].toFixed(2)}, ${BB[4].toFixed(2)}] Z[${BB[2].toFixed(2)}, ${BB[5].toFixed(2)}]`);
  const pct = outside / total * 100;
  console.log('');
  console.log(`  ⚠️ 车身表面落在 hull 外: ${outside.toLocaleString()} / ${total.toLocaleString()}  (${pct.toFixed(1)}%)`);
  if (worst) console.log(`  最远穿出 ${maxD.toFixed(3)} m @ (${worst.x.toFixed(2)}, ${worst.y.toFixed(2)}, ${worst.z.toFixed(2)})`);
  const ok = pct < 0.5;
  if (!ok) failed = true;
  console.log(`  → ${ok ? '✅ hull 基本贴住车身表面' : '❌ hull 漏了：粒子会被推到车身内部 → 看起来"穿过车身"'}`);

  console.log('');
  console.log(`  --- 按长轴 ${cfg.longAxis.toUpperCase()} 分箱，穿出最严重的 10 段 ---`);
  console.log(`    ${'位置'.padEnd(9)}${'点数'.padStart(7)}${'最大穿出'.padStart(11)}   该段 y 范围`);
  for (const [bk, s] of [...bins.entries()].sort((a, b) => b[1].maxD - a[1].maxD).slice(0, 10)) {
    console.log(`    ${String(bk).padEnd(9)}${String(s.n).padStart(7)}${s.maxD.toFixed(3).padStart(11)}   [${s.yMin.toFixed(2)}, ${s.yMax.toFixed(2)}]`);
  }
  console.log('');
}

console.log('='.repeat(100));
console.log('[一致性] 脚本内 hull vs app/vehicles.ts:');
const vt = fs.readFileSync('app/vehicles.ts', 'utf8');
for (const [key, cfg] of Object.entries(CASES)) {
  const miss = cfg.hull.filter(b => !vt.includes(`[${b.r.join(', ')}]`));
  console.log(`  ${key}: ${miss.length === 0 ? '✅ 全部匹配' : `⚠️ ${miss.length} 个未匹配（vehicles.ts 已改，请同步本脚本）`}`);
}
// ============================================================================
// 自动拟合：按长轴切片，每片取该片内车身表面的 AABB → 船体自动贴合真实轮廓
// 用法：node --experimental-strip-types scripts/validate-airflow-skin.mjs --fit
// ============================================================================
if (process.argv.includes('--fit')) {
  console.log('');
  console.log('#'.repeat(100));
  console.log('# 自动拟合切片船体（每片 = 该段车身表面的 AABB，再外扩 margin）');
  console.log('#'.repeat(100));
  const MARGIN = 0.02;

  for (const [key, cfg] of Object.entries(CASES)) {
    const bytes = fs.readFileSync(cfg.file);
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const model = gltf.scene;
    model.rotation.set(...cfg.rotation);
    model.scale.setScalar(cfg.scale);
    model.updateMatrixWorld(true);

    const v = new THREE.Vector3();
    const pts = [];
    model.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {            // 拟合用【全部】顶点
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        pts.push(v.x, v.y, v.z);
      }
    });
    const nPt = pts.length / 3;
    const ai = cfg.longAxis === 'x' ? 0 : 2;            // 长轴下标
    const ci = ai === 0 ? 2 : 0;                        // 横向下标
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < nPt; i++) { const a = pts[i * 3 + ai]; if (a < lo) lo = a; if (a > hi) hi = a; }

    const N = 16;
    const w = (hi - lo) / N;
    const slabs = [];
    for (let b = 0; b < N; b++) {
      const a0 = lo + b * w, a1 = a0 + w;
      let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, cnt = 0;
      for (let i = 0; i < nPt; i++) {
        const a = pts[i * 3 + ai];
        if (a < a0 || a >= a1) continue;
        const y = pts[i * 3 + 1], z = pts[i * 3 + ci];
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
        cnt++;
      }
      if (!cnt) continue;
      const c = [0, 0, 0], r = [0, 0, 0];
      c[ai] = (a0 + a1) / 2;
      c[1] = (y0 + y1) / 2;
      c[ci] = (z0 + z1) / 2;
      r[ai] = w / 2 + MARGIN;
      r[1] = (y1 - y0) / 2 + MARGIN;
      r[ci] = (z1 - z0) / 2 + MARGIN;
      slabs.push({ c: c.map(x => +x.toFixed(4)), r: r.map(x => +x.toFixed(4)) });
    }

    const sdf = (p) => { let best = Infinity; for (const b of slabs) { const d = sdfBox(p, b); if (d < best) best = d; } return best; };
    let out2 = 0, max2 = -Infinity;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < nPt; i++) {
      tmp.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      const d = sdf(tmp);
      if (d > 0) out2++;
      if (d > max2) max2 = d;
    }

    console.log('');
    console.log(`### ${key}  顶点 ${nPt.toLocaleString()}  切片 ${slabs.length}  长轴范围 [${lo.toFixed(3)}, ${hi.toFixed(3)}]`);
    console.log(`  拟合后复测: 落在船体外 ${out2} / ${nPt.toLocaleString()} (${(out2 / nPt * 100).toFixed(3)}%)  最远 ${max2.toFixed(4)} m`);
    console.log(`  → ${out2 === 0 ? '✅ 完全包住' : '⚠️ 仍有残留'}`);
    console.log('');
    console.log('  // ---- 粘贴到 app/vehicles.ts 的 airflow.hull ----');
    console.log('  hull: [');
    for (const s of slabs) console.log(`    { c: [${s.c.join(', ')}], r: [${s.r.join(', ')}] },`);
    console.log('  ],');
  }
}

process.exit(failed ? 1 : 0);
