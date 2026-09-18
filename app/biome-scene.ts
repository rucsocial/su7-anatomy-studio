/**
 * Biome scene layer: sky + image-based lighting + ground PBR + distant scenery,
 * with a crossfade when the biome changes.
 *
 * Ownership: this module owns scene.environment, the sky meshes, the ground
 * meshes and the scenery groups. The viewer keeps owning the plinth, grid,
 * lights, fog and the season/weather colour lerp — it reads `params()` and calls
 * `setGroundY()` / `setGroundLook()`, so every field has exactly one writer.
 *
 * Transition (three r159 has no scene.environmentIntensity):
 *   · the incoming sky/ground fade in over TRANSITION seconds while the outgoing
 *     layer stays fully opaque underneath → a true crossfade, no base leaking;
 *   · the IBL swap happens at t = 0.5, exactly where the intensity dip peaks, so
 *     the pop is masked rather than seen;
 *   · scenery and the old ground swap together at t = 1 (a treeline appearing
 *     half-way over a still-present studio floor would read as a glitch).
 */
import * as THREE from 'three';
import {getBiome, type Biome, type BiomeConfig} from './biomes';
import {loadBiomeAssets, releaseBiomeAssets, disposeBiomeAssetCache, type LoadedBiomeAssets} from './biome-assets';
import {createScenery, type SceneryHandle} from './distant-scenery';

export type BiomeParams = {
  /** Environment intensity multiplier, including the swap-masking dip. */
  env: number;
  /** Multiplier for the season/weather key/rim/hemisphere/glow intensities. */
  light: number;
  /** Multiplier for the season/weather fog distances. */
  fog: number;
  /** Studio plinth opacity multiplier (0 outdoors). */
  stage: number;
  /** Whether the reference grid belongs in this biome. */
  grid: boolean;
};

export type BiomeScene = {
  apply: (biome: Biome) => void;
  update: (dt: number, elapsed: number) => void;
  params: () => BiomeParams;
  setGroundY: (y: number) => void;
  setGroundLook: (color: THREE.Color, roughness: number, metalness: number) => void;
  /** Exploded/isolated views drop the ground; scenery follows so nothing floats half-lit. */
  setEnvironmentVisible: (visible: boolean) => void;
  biome: () => Biome;
  loading: () => boolean;
  dispose: () => void;
};

export const BIOME_GROUND_Y = -0.19;
const TRANSITION = 0.95;
const SKY_RADIUS = 420;

type Layer = {
  biome: Biome;
  cfg: BiomeConfig;
  sky: THREE.Mesh | null;
  ground: THREE.Mesh;
  scenery: SceneryHandle | null;
  assets: LoadedBiomeAssets | null;
  envRT: THREE.WebGLRenderTarget | null;
};

type Pending = Layer & {t: number; swapped: boolean};

export function createBiomeScene(args: {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  pmrem: THREE.PMREMGenerator;
  studioEnv: THREE.Texture;
  onBusy?: (busy: boolean) => void;
}): BiomeScene {
  const {scene, renderer, pmrem, studioEnv, onBusy} = args;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const paramsState: BiomeParams = {env: 1, light: 1, fog: 1, stage: 1, grid: true};
  const scratch = new THREE.Color();
  const look = {color: new THREE.Color(1, 1, 1), roughness: 0.8, metalness: 0.14};

  function makeGround(cfg: BiomeConfig, assets: LoadedBiomeAssets | null, fadeIn: boolean): THREE.Mesh {
    const material = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1, metalness: 1});
    if (assets) {
      const repeat = cfg.groundRepeat;
      assets.map.repeat.set(repeat, repeat);
      assets.normalMap.repeat.set(repeat, repeat);
      assets.armMap.repeat.set(repeat, repeat);
      material.map = assets.map;
      material.normalMap = assets.normalMap;
      material.normalScale = new THREE.Vector2(0.9, 0.9);
      // arm = R:AO  G:roughness  B:metalness — three samples those channels directly,
      // and scene-graph aoMap uses uv channel 0 in r159 (Texture.channel defaults to 0).
      material.roughnessMap = assets.armMap;
      material.metalnessMap = assets.armMap;
      material.aoMap = assets.armMap;
      material.aoMapIntensity = 0.9;
      material.envMapIntensity = 1.15;
    }
    if (fadeIn) {
      material.transparent = true;
      material.opacity = 0;
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.groundSize, cfg.groundSize), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = BIOME_GROUND_Y;
    mesh.receiveShadow = true;
    mesh.name = 'ground_' + cfg.scenery;
    return mesh;
  }

  function makeSky(hdri: THREE.Texture): THREE.Mesh {
    const material = new THREE.MeshBasicMaterial({
      map: hdri,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -12;
    mesh.name = 'sky';
    return mesh;
  }

  function applyLook(target: {cfg: BiomeConfig; ground: THREE.Mesh}, color: THREE.Color, roughness: number, metalness: number) {
    const material = target.ground.material as THREE.MeshStandardMaterial;
    if (material.map) {
      // The texture supplies the albedo, so season/weather becomes a hue tint.
      // Normalising to the strongest channel keeps "sunny" bright instead of
      // multiplying a real sand/grass map by a dark studio colour.
      const max = Math.max(color.r, color.g, color.b, 1e-3);
      scratch.setRGB(color.r / max, color.g / max, color.b / max).multiplyScalar(0.95);
      material.color.copy(scratch);
      material.roughness = THREE.MathUtils.clamp(roughness * target.cfg.groundRoughnessScale, 0.05, 1);
      material.metalness = THREE.MathUtils.clamp(metalness * target.cfg.groundMetalnessScale, 0, 1);
    } else {
      material.color.copy(color);
      material.roughness = roughness;
      material.metalness = metalness;
    }
  }

  // ---- initial state: studio (no assets, no sky, no scenery) ----
  const studioCfg = getBiome('studio');
  const studioGround = makeGround(studioCfg, null, false);
  scene.add(studioGround);
  let current: Layer = {
    biome: 'studio',
    cfg: studioCfg,
    sky: null,
    ground: studioGround,
    scenery: null,
    assets: null,
    envRT: null,
  };
  scene.environment = studioEnv;
  let pending: Pending | null = null;
  let target: Biome = 'studio';
  let token = 0;
  let busy = false;
  let groundY = BIOME_GROUND_Y;

  function startPending(biome: Biome, cfg: BiomeConfig, assets: LoadedBiomeAssets | null, sky: THREE.Mesh | null, scenery: SceneryHandle | null) {
    const ground = makeGround(cfg, assets, true);
    ground.position.y = groundY + 0.006;
    scene.add(ground);
    if (sky) {
      sky.renderOrder = -11;
      scene.add(sky);
    }
    applyLook({cfg, ground}, look.color, look.roughness, look.metalness);
    pending = {biome, cfg, sky, ground, scenery, assets, envRT: null, t: 0, swapped: false};
  }

  function finishPending() {
    if (!pending) return;
    const done = pending;
    pending = null;

    if (current.sky) {
      scene.remove(current.sky);
      current.sky.geometry.dispose();
      (current.sky.material as THREE.Material).dispose();
    }
    scene.remove(current.ground);
    current.ground.geometry.dispose();
    (current.ground.material as THREE.Material).dispose();
    if (current.scenery) {
      scene.remove(current.scenery.group);
      current.scenery.dispose();
    }
    if (current.envRT) current.envRT.dispose();
    releaseBiomeAssets(current.assets);

    if (done.sky) (done.sky.material as THREE.MeshBasicMaterial).opacity = 1;
    const material = done.ground.material as THREE.MeshStandardMaterial;
    material.transparent = false;
    material.opacity = 1;
    material.needsUpdate = true;
    done.ground.position.y = groundY;
    if (done.scenery) scene.add(done.scenery.group);
    current = done;
  }

  function apply(biome: Biome) {
    if (biome === target) return;
    target = biome;
    const my = ++token;
    finishPending();
    const cfg = getBiome(biome);
    if (!cfg.assets) {
      startPending(biome, cfg, null, null, null);
      return;
    }
    busy = true;
    onBusy?.(true);
    loadBiomeAssets(cfg.assets, maxAniso)
      .then((assets) => {
        if (my !== token) {
          releaseBiomeAssets(assets);
          return;
        }
        startPending(biome, cfg, assets, makeSky(assets.hdri), createScenery(cfg.scenery));
        busy = false;
        onBusy?.(false);
      })
      .catch(() => {
        if (my === token) {
          busy = false;
          onBusy?.(false);
          target = current.biome;
        }
      });
  }

  function update(dt: number, elapsed: number) {
    if (current.scenery && current.scenery.update) current.scenery.update(elapsed);
    if (!pending) {
      paramsState.env = current.cfg.envScale;
      paramsState.light = current.cfg.lightScale;
      paramsState.fog = current.cfg.fogScale;
      paramsState.stage = current.cfg.stage ? 1 : 0;
      paramsState.grid = current.cfg.grid;
      return;
    }

    pending.t = Math.min(1, pending.t + dt / TRANSITION);
    const t = pending.t;
    const ease = t * t * (3 - 2 * t);
    if (current.sky) (current.sky.material as THREE.MeshBasicMaterial).opacity = 1 - ease;
    if (pending.sky) (pending.sky.material as THREE.MeshBasicMaterial).opacity = ease;
    (pending.ground.material as THREE.MeshStandardMaterial).opacity = ease;

    if (!pending.swapped && t >= 0.5) {
      pending.swapped = true;
      pending.envRT = pending.assets ? pmrem.fromEquirectangular(pending.assets.hdri as THREE.DataTexture) : null;
      scene.environment = pending.envRT ? pending.envRT.texture : studioEnv;
      if (current.envRT) {
        current.envRT.dispose();
        current.envRT = null;
      }
    }

    const from = current.cfg;
    const to = pending.cfg;
    const dip = 1 - 0.65 * Math.sin(Math.PI * t);
    paramsState.env = THREE.MathUtils.lerp(from.envScale, to.envScale, ease) * dip;
    paramsState.light = THREE.MathUtils.lerp(from.lightScale, to.lightScale, ease);
    paramsState.fog = THREE.MathUtils.lerp(from.fogScale, to.fogScale, ease);
    paramsState.stage = THREE.MathUtils.lerp(from.stage ? 1 : 0, to.stage ? 1 : 0, ease);
    paramsState.grid = from.grid && to.grid;

    if (t >= 1) finishPending();
  }

  return {
    apply,
    update,
    params: () => paramsState,
    setGroundY(y: number) {
      groundY = y;
      current.ground.position.y = y;
      if (pending) pending.ground.position.y = y + 0.006;
    },
    setGroundLook(color, roughness, metalness) {
      look.color.copy(color);
      look.roughness = roughness;
      look.metalness = metalness;
      applyLook(current, color, roughness, metalness);
      if (pending) applyLook(pending, color, roughness, metalness);
    },
    setEnvironmentVisible(visible: boolean) {
      current.ground.visible = visible;
      if (pending) pending.ground.visible = visible;
      if (current.scenery) current.scenery.group.visible = visible;
      if (pending && pending.scenery) pending.scenery.group.visible = visible;
    },
    biome: () => target,
    loading: () => busy,
    dispose() {
      token++;
      finishPending();
      scene.remove(current.ground);
      current.ground.geometry.dispose();
      (current.ground.material as THREE.Material).dispose();
      if (current.sky) {
        scene.remove(current.sky);
        current.sky.geometry.dispose();
        (current.sky.material as THREE.Material).dispose();
      }
      if (current.scenery) {
        scene.remove(current.scenery.group);
        current.scenery.dispose();
      }
      if (current.envRT) current.envRT.dispose();
      releaseBiomeAssets(current.assets);
      disposeBiomeAssetCache();
    },
  };
}
