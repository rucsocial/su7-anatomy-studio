# Xiaomi SU7 Anatomy Studio

Interactive 3D vehicle studio for the Xiaomi SU7: circular display platform, component descriptions, individual-piece isolation, progressive explosion slider, wind tunnel, environment presets, drive mode, door/window openables, and cabin interior view.

Two switchable SU7 assets:

- **SU7** — 39 semantic pieces (92K, lightweight overview, black paint)
- **SU7 海湾蓝** — 170K asset with cabin, door groups, and gulf-blue paint calibration

> Non-official educational demo. Not affiliated with, sponsored by, or endorsed by Xiaomi or Tesla.

## Quick start

Requires Node.js 22.13+ and npm.

```sh
npm ci
npm run dev -- --port 3015
```

Open `http://127.0.0.1:3015/`.

### Online preview

Once GitHub Pages is enabled for this repo (branch `gh-pages`), open:

**https://rucsocial.github.io/su7-anatomy-studio/**

No install required — browser only (WebGL).

## Validation

```sh
npx tsc --noEmit
node --experimental-strip-types scripts/validate-su7-explosion.mjs
npm run build:vercel
```

## What this project is / is not

| Is | Is not |
|----|--------|
| A browser Three.js **interactive anatomy viewer** built with MiMo Desktop | OEM parts catalog |
| Engineering work: explode layout, hinges, wheel pivots, wind tunnel, environments | From-scratch vehicle 3D modeling |
| Attribution-complete for third-party assets | Official Xiaomi or Tesla product |

**Models are community downloads (CC-BY), not authored from zero.**  
**UI pattern references Tesla online vehicle documentation** — this repo ships **no** Tesla geometry or trademarks.

## Attribution (required if you redistribute or adapt this project)

If you fork, demo, or republish this work, please keep:

### 3D models (CC BY 4.0)

1. **Overview SU7** — [Sketchfab: Xiaomi SU7](https://sketchfab.com/3d-models/xiaomi-su7-ca2cda599f5341068c992c9f44551bf9)  
   - Page author: **Mona x Supercars ([@Car2022](https://sketchfab.com/Car2022))**  
   - Embedded author: **GT Cars: Hyperspeed**  
   - Both names are required.

2. **Detail SU7 (170K / 海湾蓝)** — [Sketchfab](https://sketchfab.com/3d-models/su7-7296a91633d74c6eb113010e2ed75eda)  
   - Author: **[s1657270997](https://sketchfab.com/s1657270997)**

3. Semantic node names / metric scale / wheel-group split inspired by [su7-3d-configurator](https://github.com/caozhangqing85-cyber/su7-3d-configurator) (**MIT**).

4. Environment HDRI/textures: [Poly Haven](https://polyhaven.com) (**CC0**).

5. Application code: **MIT** (see [LICENSE](LICENSE)).

### Suggested credit line

> 3D models: Xiaomi SU7 by Mona x Supercars / GT Cars: Hyperspeed and s1657270997 (Sketchfab, CC BY 4.0). Semantic naming: su7-3d-configurator (MIT). Environment: Poly Haven (CC0). App: MIT. Interactive studio built with MiMo Desktop. Non-official educational demo; UI pattern references Tesla’s vehicle documentation; no Tesla assets included.

### What CC BY does *not* grant

Trademark rights for Xiaomi, Tesla, or any brand, badge, or industrial design. Keep a clear non-affiliation disclaimer when presenting this work.

## Model sources (detail)

### Xiaomi SU7 (overview)

[Sketchfab](https://sketchfab.com/3d-models/xiaomi-su7-ca2cda599f5341068c992c9f44551bf9) — CC BY 4.0. Repository changes: semantic node names, metric scale, wheel-group split, paint/screen tint calibrations.

### Xiaomi SU7 Detail (170K)

[Sketchfab](https://sketchfab.com/3d-models/su7-7296a91633d74c6eb113010e2ed75eda) — CC BY 4.0. Repository changes: axis rotation, semantic catalog, gulf-blue paint, spoiler lowered, sidecar screen tint.

### Scope limits (honest capability notes)

- Overview doors are fused into body panels — no separate door open.  
- Overview roof glass is a fixed panoramic panel — not a sliding sunroof.  
- Neither GLB has separate frunk/trunk lids — trunk open is unsupported.  
- Battery / drive / suspension are illustrative geometry where noted.

## Design lineage (Tesla)

Interaction layout (circular plinth, component catalog, explode slider, isolate, about panel) was designed in reference to **Tesla’s online vehicle documentation** and an earlier Model X anatomy studio this work evolved from.

This repository **does not ship Tesla assets or trademarks**.

## License

- **Code:** MIT ([LICENSE](LICENSE))  
- **3D models:** CC BY 4.0 (credited above)  
- **Environment textures:** CC0  
