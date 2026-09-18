/**
 * Lazy biome asset loader. One biome at a time: 1K HDR (~1.5 MB) + three 1K PBR
 * maps (~3.5 MB). Everything is cached by URL and explicitly disposed when the
 * biome is dropped, so switching back and forth does not grow GPU memory.
 *
 * All files are Poly Haven CC0 and md5-verified against the API — see
 * scripts/validate-env-assets.mjs.
 */
import * as THREE from 'three';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';
import type {BiomeAssets} from './biomes';

export type LoadedBiomeAssets = {
  hdri: THREE.Texture;
  map: THREE.Texture;
  normalMap: THREE.Texture;
  armMap: THREE.Texture;
  refs: number;
};

const cache = new Map<string, LoadedBiomeAssets>();
const hdrLoader = new RGBELoader();

export async function loadBiomeAssets(assets: BiomeAssets, anisotropy: number): Promise<LoadedBiomeAssets> {
  const key = assets.hdri;
  const hit = cache.get(key);
  if (hit) {
    hit.refs++;
    return hit;
  }
  const textureLoader = new THREE.TextureLoader();
  const configure = (tex: THREE.Texture, srgb: boolean) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
  };
  const [hdri, map, normalMap, armMap] = await Promise.all([
    hdrLoader.loadAsync(assets.hdri) as Promise<THREE.Texture>,
    textureLoader.loadAsync(assets.ground.map),
    textureLoader.loadAsync(assets.ground.normalMap),
    textureLoader.loadAsync(assets.ground.armMap),
  ]);
  const loaded: LoadedBiomeAssets = {
    hdri,
    map: configure(map, true),
    normalMap: configure(normalMap, false),
    armMap: configure(armMap, false),
    refs: 1,
  };
  cache.set(key, loaded);
  return loaded;
}

/** Drop one reference; textures are released when the last reference goes. */
export function releaseBiomeAssets(loaded: LoadedBiomeAssets | null): void {
  if (!loaded) return;
  loaded.refs--;
  if (loaded.refs > 0) return;
  for (const tex of [loaded.hdri, loaded.map, loaded.normalMap, loaded.armMap]) tex.dispose();
  for (const [key, value] of cache) if (value === loaded) cache.delete(key);
}

export function disposeBiomeAssetCache(): void {
  for (const loaded of cache.values()) {
    for (const tex of [loaded.hdri, loaded.map, loaded.normalMap, loaded.armMap]) tex.dispose();
  }
  cache.clear();
}

/** Debug helper for scripts: how many biome pixel-bytes are resident right now. */
export function biomeAssetCacheSize(): number {
  return cache.size;
}
