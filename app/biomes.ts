/**
 * Biome axis for the studio viewer.
 *
 * Architecture (deliberately NOT a third multiplicative axis):
 *   Biome   → HDRI sky + IBL, ground PBR, distant scenery, fog reach
 *   Season  → colour temperature / intensity / fog tint      (unchanged)
 *   Weather → particles / fog distance / exposure / wetness   (unchanged)
 *
 * `studio` is the original look (RoomEnvironment IBL, flat colour ground, plinth).
 * Every other biome adds assets; season/weather still layer on top of them, so
 * picking "Winter + Rainy + Forest" keeps working.
 *
 * Assets: Poly Haven, CC0 (https://polyhaven.com/license — "Our assets are all
 * licensed as CC0 … you can use our assets for any purpose, including commercial
 * work … you do not need to give credit"). Downloaded 1K variants; each file was
 * verified against the API's own md5 — see scripts/validate-env-assets.mjs.
 */
export type Biome = 'studio' | 'seaside' | 'forest' | 'grassland' | 'urban';

export type SceneryKind = 'none' | 'sea' | 'trees' | 'hills' | 'skyline';

export type BiomeAssets = {
  /** Equirect HDR used for both the sky and the PMREM image-based lighting. */
  hdri: string;
  ground: {
    map: string;
    normalMap: string;
    /** Packed R=AO, G=roughness, B=metalness (Poly Haven "arm"). */
    armMap: string;
  };
};

export type BiomeConfig = {
  /** Absent = the original studio look (no downloaded assets). */
  assets?: BiomeAssets;
  /** Ground plane edge length in metres. Seaside is small: the sea takes over. */
  groundSize: number;
  /** Texture repeats across the ground plane. */
  groundRepeat: number;
  /**
   * Multipliers applied to the season/weather ground roughness / metalness while a
   * ground map is present (the map's G/B channels scale the result again). Ignored
   * by `studio`, which has no map and passes the season values through unchanged.
   */
  groundRoughnessScale: number;
  groundMetalnessScale: number;
  /** Multiplies the season/weather fog distances so distant scenery stays visible. */
  fogScale: number;
  /** Multiplies season/weather light intensities — HDRI supplies most of the light outdoors. */
  lightScale: number;
  /** Multiplies the environment intensity; outdoors the IBL should read strongly. */
  envScale: number;
  /** Studio furniture (plinth + rim rings) fades out when false. */
  stage: boolean;
  /** Reference grid is a studio tool only. */
  grid: boolean;
  scenery: SceneryKind;
};

export const DEFAULT_BIOME: Biome = 'studio';

export const BIOMES: {id: Biome; name: string; hint: string}[] = [
  {id: 'studio', name: 'Studio', hint: 'Neutral light box · original look'},
  {id: 'seaside', name: 'Seaside', hint: 'Harbour sky · sand shore · open water'},
  {id: 'forest', name: 'Forest', hint: 'Rainforest canopy · leaf litter floor'},
  {id: 'grassland', name: 'Grassland', hint: 'Meadow sky · grass floor · rolling hills'},
  {id: 'urban', name: 'City', hint: 'Canary Wharf skyline · asphalt street'},
];

export const BIOME_CONFIG: Record<Biome, BiomeConfig> = {
  studio: {
    groundSize: 200,
    groundRepeat: 1,
    groundRoughnessScale: 1,
    groundMetalnessScale: 1,
    fogScale: 1,
    lightScale: 1,
    envScale: 1,
    stage: true,
    grid: true,
    scenery: 'none',
  },
  seaside: {
    assets: {
      hdri: '/env/seaside/small_harbor_01_1k.hdr',
      ground: {
        map: '/env/seaside/sand_01_1k_diffuse.jpg',
        normalMap: '/env/seaside/sand_01_1k_nor_gl.jpg',
        armMap: '/env/seaside/sand_01_1k_arm.jpg',
      },
    },
    // Small sand pad; the water ring starts at ~44 m and runs to the horizon.
    groundSize: 92,
    groundRepeat: 30,
    groundRoughnessScale: 1.12,
    groundMetalnessScale: 0.2,
    fogScale: 5,
    lightScale: 0.5,
    envScale: 1.45,
    stage: false,
    grid: false,
    scenery: 'sea',
  },
  forest: {
    assets: {
      hdri: '/env/forest/rainforest_trail_1k.hdr',
      ground: {
        map: '/env/forest/forest_ground_04_1k_diffuse.jpg',
        normalMap: '/env/forest/forest_ground_04_1k_nor_gl.jpg',
        armMap: '/env/forest/forest_ground_04_1k_arm.jpg',
      },
    },
    groundSize: 620,
    groundRepeat: 175,
    groundRoughnessScale: 1.18,
    groundMetalnessScale: 0.1,
    fogScale: 4.5,
    lightScale: 0.55,
    envScale: 1.35,
    stage: false,
    grid: false,
    scenery: 'trees',
  },
  grassland: {
    assets: {
      hdri: '/env/grassland/meadow_2_1k.hdr',
      ground: {
        map: '/env/grassland/leafy_grass_1k_diffuse.jpg',
        normalMap: '/env/grassland/leafy_grass_1k_nor_gl.jpg',
        armMap: '/env/grassland/leafy_grass_1k_arm.jpg',
      },
    },
    groundSize: 700,
    groundRepeat: 190,
    groundRoughnessScale: 1.15,
    groundMetalnessScale: 0.15,
    fogScale: 6,
    lightScale: 0.5,
    envScale: 1.5,
    stage: false,
    grid: false,
    scenery: 'hills',
  },
  urban: {
    assets: {
      hdri: '/env/urban/canary_wharf_1k.hdr',
      ground: {
        map: '/env/urban/asphalt_02_1k_diffuse.jpg',
        normalMap: '/env/urban/asphalt_02_1k_nor_gl.jpg',
        armMap: '/env/urban/asphalt_02_1k_arm.jpg',
      },
    },
    groundSize: 620,
    groundRepeat: 120,
    groundRoughnessScale: 0.95,
    groundMetalnessScale: 0.45,
    fogScale: 5,
    lightScale: 0.5,
    envScale: 1.4,
    stage: false,
    grid: false,
    scenery: 'skyline',
  },
};

export function getBiome(id: Biome): BiomeConfig {
  return BIOME_CONFIG[id] || BIOME_CONFIG[DEFAULT_BIOME];
}

/** Every asset path the app will request — used by scripts/validate-env-assets.mjs. */
export function biomeAssetPaths(): string[] {
  const out: string[] = [];
  for (const cfg of Object.values(BIOME_CONFIG)) {
    if (!cfg.assets) continue;
    out.push(cfg.assets.hdri, cfg.assets.ground.map, cfg.assets.ground.normalMap, cfg.assets.ground.armMap);
  }
  return out;
}
