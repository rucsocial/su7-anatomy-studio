#!/usr/bin/env node
/**
 * Biome asset truth check — runs offline, no network.
 *
 * Why: the last rounds of this project kept failing the same way — "the request
 * returned 200" was accepted as "the asset is right". This script closes that gap
 * for the environment layer by checking the real bytes:
 *
 *   1. every /env/… path referenced by app/biomes.ts exists under public/
 *   2. its md5 matches scripts/env-assets.lock.json (recorded from the Poly Haven
 *      API's own md5 when the files were fetched) → detects corruption/swaps
 *   3. the HDR really is Radiance RGBE and declares its resolution
 *   4. the JPEGs really are JPEGs and decode their SOF dimensions
 *   5. the biome table itself is coherent (assets ⇔ scenery, sizes, repeats)
 *
 * Usage:  node scripts/validate-env-assets.mjs
 * Exit:   0 = all good, 1 = at least one failure
 */
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function md5(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

function parseHdr(buffer) {
  const head = buffer.subarray(0, 1024).toString('latin1');
  const radiance = head.startsWith('#?RADIANCE') || head.startsWith('#?RGBE');
  const format = /FORMAT=([^\n\r]+)/.exec(head);
  const size = /-Y\s+(\d+)\s+\+X\s+(\d+)/.exec(head);
  return {
    radiance,
    format: format ? format[1].trim() : '',
    height: size ? Number(size[1]) : 0,
    width: size ? Number(size[2]) : 0,
  };
}

function parseJpeg(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = buffer.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7), progressive: marker === 0xc2};
    }
    i += 2 + length;
  }
  return null;
}

// ---------------------------------------------------------------- 1. biome table
const biomesTs = readFileSync(join(root, 'app/biomes.ts'), 'utf8');
const assetPaths = [...biomesTs.matchAll(/'(\/env\/[^']+)'/g)].map((m) => m[1]);
const uniquePaths = [...new Set(assetPaths)];

if (uniquePaths.length !== assetPaths.length) fail('biomes.ts references the same /env/ file more than once');
const expected = 4 * 4; // 4 outdoor biomes × (hdri + diffuse + normal + arm)
if (uniquePaths.length !== expected) {
  fail(`biomes.ts references ${uniquePaths.length} /env/ files, expected ${expected}`);
}

const perBiome = new Map();
for (const path of uniquePaths) {
  const biome = path.split('/')[2];
  perBiome.set(biome, (perBiome.get(biome) || 0) + 1);
}
for (const [biome, count] of perBiome) {
  if (count !== 4) fail(`biome "${biome}" references ${count} files, expected 4 (hdri + 3 maps)`);
}

const sceneryByBiome = [...biomesTs.matchAll(/(\w+):\s*\{([\s\S]*?)\n  \},/g)]
  .map((m) => [m[1], /scenery:\s*'([a-z]+)'/.exec(m[2])?.[1]])
  .filter(([, scenery]) => Boolean(scenery));
const withAssets = new Set([...perBiome.keys()]);
for (const [biome, scenery] of sceneryByBiome) {
  const hasAssets = withAssets.has(biome);
  if (hasAssets && scenery === 'none') fail(`biome "${biome}" has assets but scenery: 'none'`);
  if (!hasAssets && scenery !== 'none') fail(`biome "${biome}" has scenery '${scenery}' but no HDRI assets`);
}

for (const [, value] of biomesTs.matchAll(/groundSize:\s*(\d+)/g)) {
  if (Number(value) < 50) fail(`groundSize ${value} m is too small to hold the car + stage`);
}
for (const [, value] of biomesTs.matchAll(/groundRepeat:\s*(\d+)/g)) {
  if (Number(value) < 1) fail(`groundRepeat ${value} would stretch a single texel across the plane`);
}

// ---------------------------------------------------------------- 2. lock file
const lockPath = join(root, 'scripts', 'env-assets.lock.json');
if (!existsSync(lockPath)) {
  fail('scripts/env-assets.lock.json is missing — regenerate it when assets change');
}
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {files: {}};

// ---------------------------------------------------------------- 3. per-file truth
let grandTotal = 0;
const rows = [];
for (const path of uniquePaths) {
  const rel = path.replace(/^\//, '');
  const file = join(root, 'public', rel);
  if (!existsSync(file)) {
    fail(`missing file: public/${rel}`);
    continue;
  }
  const buffer = readFileSync(file);
  const bytes = statSync(file).size;
  grandTotal += bytes;

  const recorded = lock.files?.[path];
  if (!recorded) fail(`public/${rel} is not covered by env-assets.lock.json`);
  else {
    if (recorded.bytes !== bytes) fail(`public/${rel}: ${bytes} bytes on disk, lock says ${recorded.bytes}`);
    const digest = md5(buffer);
    if (recorded.md5 && recorded.md5 !== digest) {
      fail(`public/${rel}: md5 ${digest} does not match the Poly Haven md5 ${recorded.md5}`);
    }
  }

  let shape = '';
  if (rel.endsWith('.hdr')) {
    const hdr = parseHdr(buffer);
    if (!hdr.radiance) fail(`public/${rel}: not a Radiance HDR (bad magic)`);
    if (!hdr.format.includes('rgbe')) fail(`public/${rel}: unexpected FORMAT "${hdr.format}"`);
    if (!hdr.width || !hdr.height) fail(`public/${rel}: header has no -Y/+X resolution line`);
    else if (hdr.width !== hdr.height * 2) {
      notes.push(`public/${rel}: equirect is ${hdr.width}×${hdr.height} — not the usual 2:1 panorama`);
    }
    shape = `${hdr.width}×${hdr.height} ${hdr.format}`;
  } else {
    const jpeg = parseJpeg(buffer);
    if (!jpeg) fail(`public/${rel}: not a JPEG (or no SOF marker found)`);
    else {
      if (jpeg.width < 512 || jpeg.height < 512) fail(`public/${rel}: ${jpeg.width}×${jpeg.height} is below the 512 px floor`);
      if (jpeg.width !== jpeg.height) fail(`public/${rel}: ${jpeg.width}×${jpeg.height} is not square — ground tiles need square maps`);
      shape = `${jpeg.width}×${jpeg.height} jpeg${jpeg.progressive ? ' (progressive)' : ''}`;
    }
  }
  rows.push({path, mb: (bytes / 1048576).toFixed(2), shape});
}

// ---------------------------------------------------------------- 4. report
const colour = (text, code) => `\u001b[${code}m${text}\u001b[0m`;
console.log('Biome environment assets\n');
console.log(`  ${'file'.padEnd(46)}${'size'.padStart(8)}  shape`);
for (const row of rows) {
  console.log(`  ${row.path.replace('/env/', '').padEnd(46)}${(row.mb + ' MB').padStart(8)}  ${row.shape}`);
}
console.log('');
const biomeTotals = new Map();
for (const path of uniquePaths) {
  const biome = path.split('/')[2];
  const file = join(root, 'public', path.replace(/^\//, ''));
  if (existsSync(file)) biomeTotals.set(biome, (biomeTotals.get(biome) || 0) + statSync(file).size);
}
for (const [biome, bytes] of [...biomeTotals].sort()) {
  console.log(`  ${biome.padEnd(12)}${(bytes / 1048576).toFixed(2)} MB  (loaded on demand — only one biome is resident)`);
}
console.log(`  ${'total'.padEnd(12)}${(grandTotal / 1048576).toFixed(2)} MB on disk`);
if (notes.length) {
  console.log('');
  for (const note of notes) console.log(colour('  note   ' + note, 33));
}

console.log('');
if (failures.length) {
  console.log(colour(`${failures.length} failure(s):`, 31));
  for (const failure of failures) console.log(colour('  ✗ ' + failure, 31));
  process.exit(1);
}
console.log(colour(`✓ ${rows.length} assets verified against the lock, ${biomeTotals.size} biomes coherent`, 32));
