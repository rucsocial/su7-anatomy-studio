/**
 * Vehicle registry — Xiaomi SU7 variants (CC-BY-4.0).
 */
import { parts as su7Parts, describePiece as describeSu7, type PartId as Su7PartId } from './su7-parts';

export type AboutBlock = {
  /** Plain paragraphs (may contain markdown-like [text](url) links parsed lightly in UI) */
  paragraphs: string[];
};

export type VehicleId = 'su7' | 'su7-detail';
export type PartId = Su7PartId;

/** Axis-aligned hull primitive used for streamline deflection (multi-box, not a single ellipsoid). */
export type HullBox = {
  /** Center in scene space */
  c: [number, number, number];
  /** Half-extents */
  r: [number, number, number];
};

export type AirflowConfig = {
  /** Scene axis that is the car's long axis (flow travels along this axis). */
  longAxis: 'x' | 'z';
  /** +1: flow from −axis toward +axis (nose at −axis). −1: reverse. */
  flowSign: 1 | -1;
  /** Multi-primitive hull, sized from measured world bounds. */
  hull: HullBox[];
  /** Floor y for ground effect */
  groundY: number;
  /** Start of free-stream inlet (along longAxis, opposite flow) */
  inlet: number;
  /** End of outlet */
  outlet: number;
  /** Wake starts this far behind the car (same units as longAxis) */
  wakeStart: number;
  /**
   * Visual style. Model X uses particles-only — long ribbons fight the low-poly body.
   * SU7 keeps thin ribbons + tracers.
   */
  style?: 'ribbons' | 'particles';
};

export type VehiclePartInfo = {
  id: PartId;
  name: string;
  category: string;
  tag: string;
  description: string;
  principle: string;
  specs: [string, string][];
  source: string;
};

export type VehicleConfig = {
  id: VehicleId;
  brand: string;
  model: string;
  plaqueTop: string;
  plaqueTitle: string;
  loadingText: string;
  modelPath: string;
  catalogPath: string;
  /** Applied to the loaded GLB root */
  rotation: [number, number, number];
  scale: number;
  parts: VehiclePartInfo[];
  describePiece: (label: string) => string;
  /** System-level label anchors in scene space */
  anchors: Record<PartId, [number, number, number]>;
  /** About / credits copy */
  about: AboutBlock;
  /**
   * false = the GLB asset lacks this geometry; illustrative geometry may still be built procedurally.
   * Doors are fused into body panels in the SU7 asset and have no procedural stand-in yet.
   */
  geometryFlags: {
    doors: boolean;
    battery: boolean;
    drive: boolean;
    suspension: boolean;
  };
  /** Wind-tunnel streamline hull + flow axis for this vehicle. */
  airflow: AirflowConfig;
  /**
   * Whether Drive mode can spin wheel meshes.
   * Both vehicles spin via 4 hardcoded hub pivots (see wheelCenters).
   */
  driveSpinWheels: boolean;
  /**
   * Wheel hub centers in scene world space (meters).
   * Model X: measured from GLB after scene rotation (DSH, residual 0.6 mm vs manifest).
   * SU7: from su7-3d-configurator wheel sockets (already metric, Y-up).
   */
  wheelCenters: [number, number, number][];
  /** Optional post-load look tweaks (spoiler down). */
  visualTweak?: 'spoiler-down';
  /**
   * Force body paint to this hex (sRGB). Used for 海湾蓝 calibration on the detail asset.
   * Overview SU7 stays on its baked black paint_body and must NOT set this.
   */
  paintHex?: string;
  /**
   * Optional sidecar texture that replaces the cabin-screen atlas so the on-screen car
   * matches the vehicle paint (paintHex or baked black).
   */
  screenTintPath?: string;
  /** Material name prefixes whose map is replaced by screenTintPath. */
  screenTintMaterialNames?: string[];
  /** Pretty name on the vehicle switcher chip */
  switcherLabel?: string;
  /**
   * Node-name → part mapping for assets without baked userData.
   */
  nodeMap?: Record<string, { part: PartId; label: string }>;
  /**
   * Openable parts the asset can actually animate.
   * Overview: doors fused into body; roof_glass is a fixed panoramic panel (not a sliding sunroof).
   * Detail: four door groups + door glass. No separate frunk/trunk/hood lids in either GLB.
   */
  openables: {
    doors: boolean;
    windows: boolean;
  };
};

const su7About: AboutBlock = {
  paragraphs: [
    'Drag to orbit. Pinch or scroll to zoom. Select a component for details; use the slider to separate the car.',
    '3D model: Xiaomi SU7. Page author: [Mona x Supercars (@Car2022)](https://sketchfab.com/3d-models/xiaomi-su7-ca2cda599f5341068c992c9f44551bf9). Embedded author: GT Cars: Hyperspeed. License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Repository changes: semantic node names, metric scale, wheel-group split, material adjustments (su7-3d-configurator).',
    '本页为非官方技术演示，与小米集团、小米汽车及相关品牌不存在隶属、赞助或授权关系。CC BY 4.0 不授予小米品牌、车标、外观设计或任何第三方商标权。',
    '界面布局参考特斯拉在线车辆说明与早期 Model X 3D 拆解项目的设计思路；本仓库不包含任何特斯拉资产或商标。',
    'Doors are not separate geometry in this asset (skins are fused into body panels). Battery, drive units and suspension are illustrative geometry. The 39 pieces are artist-authored mesh islands, not verified service-part identifiers.',
  ],
};

/** Semantic node names present in su7-web.glb (39 isolatable meshes). */
const su7NodeMap: Record<string, { part: PartId; label: string }> = {
  body_panels_main: { part: 'body', label: 'Body panels · main shell' },
  body_panels_outer: { part: 'body', label: 'Body panels · outer skin' },
  body_panels_upper_a: { part: 'body', label: 'Body panels · upper front' },
  body_panels_upper_b: { part: 'body', label: 'Body panels · upper rear' },
  body_paint_front: { part: 'body', label: 'Paint region · front' },
  body_paint_rear: { part: 'body', label: 'Paint region · rear' },
  body_paint_sides: { part: 'body', label: 'Paint region · sides' },
  front_bumper: { part: 'body', label: 'Front bumper' },
  rear_bumper_trim: { part: 'body', label: 'Rear bumper · upper trim' },
  rear_bumper_lower: { part: 'body', label: 'Rear bumper · lower' },
  front_grille_panel: { part: 'body', label: 'Front lower panel' },
  trim_rear_spoiler_edge: { part: 'body', label: 'Rear spoiler edge' },
  underbody: { part: 'body', label: 'Underbody panel' },
  detail_cowl: { part: 'body', label: 'Windscreen cowl' },
  detail_rear_badge: { part: 'body', label: 'Rear badge' },
  detail_roof_antenna: { part: 'body', label: 'Roof antenna' },
  lights_head: { part: 'body', label: 'Headlights' },
  lights_tail: { part: 'body', label: 'Tail lights' },
  glass_greenhouse: { part: 'glass', label: 'Greenhouse glazing' },
  roof_glass: { part: 'glass', label: 'Roof glass panel' },
  glass_hidden_alpha0: { part: 'glass', label: 'Hidden glass sheet' },
  cabin_block: { part: 'cabin', label: 'Cabin block' },
  cabin_headliner: { part: 'cabin', label: 'Headliner' },
  wheel_fl_tire: { part: 'wheels', label: 'Tyre · front-left' },
  wheel_fl_rim: { part: 'wheels', label: 'Rim · front-left' },
  wheel_fl_hub: { part: 'wheels', label: 'Hub · front-left' },
  wheel_fl_sidewall: { part: 'wheels', label: 'Sidewall · front-left' },
  wheel_fr_tire: { part: 'wheels', label: 'Tyre · front-right' },
  wheel_fr_rim: { part: 'wheels', label: 'Rim · front-right' },
  wheel_fr_hub: { part: 'wheels', label: 'Hub · front-right' },
  wheel_fr_sidewall: { part: 'wheels', label: 'Sidewall · front-right' },
  wheel_rl_tire: { part: 'wheels', label: 'Tyre · rear-left' },
  wheel_rl_rim: { part: 'wheels', label: 'Rim · rear-left' },
  wheel_rl_hub: { part: 'wheels', label: 'Hub · rear-left' },
  wheel_rl_sidewall: { part: 'wheels', label: 'Sidewall · rear-left' },
  wheel_rr_tire: { part: 'wheels', label: 'Tyre · rear-right' },
  wheel_rr_rim: { part: 'wheels', label: 'Rim · rear-right' },
  wheel_rr_hub: { part: 'wheels', label: 'Hub · rear-right' },
  wheel_rr_sidewall: { part: 'wheels', label: 'Sidewall · rear-right' },
};

export const VEHICLES: Record<VehicleId, VehicleConfig> = {
  su7: {
    id: 'su7',
    brand: 'Xiaomi',
    model: 'SU7',
    switcherLabel: 'SU7',
    plaqueTop: 'X I A O M I',
    plaqueTitle: 'SU7',
    loadingText: 'Loading the detailed SU7…',
    modelPath: '/models/su7-web.glb?v=39',
    catalogPath: '/models/su7-manifest.json',
    // su7-web.glb already bakes the metric scale (0.2533) and X −90° on vehicle_root.
    // Do NOT re-apply that transform here — it would double-scale and over-rotate the car.
    rotation: [0, 0, 0],
    scale: 1,
    parts: su7Parts as unknown as VehiclePartInfo[],
    describePiece: describeSu7,
    anchors: {
      body: [-1.45, 0.85, 0.1],
      glass: [0, 1.35, 0.1],
      doors: [1.15, 0.85, 0],
      cabin: [0, 0.95, 0.2],
      battery: [0, 0.18, 0],
      drive: [0, 0.42, 1.05],
      suspension: [-1.05, 0.42, -1.55],
      wheels: [-1.15, 0.36, 1.3],
    },
    about: su7About,
    // Doors are fused into body panels in this asset — no door nodes.
    // false = the GLB lacks this geometry; battery/drive/suspension still get procedural stand-ins.
    geometryFlags: { doors: false, battery: false, drive: false, suspension: false },
    nodeMap: su7NodeMap,
    // Measured world bounds: 2.240 × 1.437 × 4.997 m. Long axis = Z, nose at −Z.
    airflow: {
      longAxis: 'z',
      flowSign: 1,
      groundY: 0,
      inlet: -6.8,
      outlet: 8.5,
      wakeStart: 2.6,
      style: 'ribbons',
      hull: [
        // Auto-fitted from the su7-web.glb surface: 16 slices along Z (nose −Z → tail +Z).
        // Each slice is the AABB of that segment's surface points, +0.02 m margin.
        // Verified 0 / 105,567 vertices outside — scripts/validate-airflow-skin.mjs
        { c: [0, 0.4495, -2.5574], r: [0.831, 0.3065, 0.1762] },
        { c: [0, 0.4709, -2.2451], r: [0.9948, 0.3822, 0.1762] },
        { c: [-0.0029, 0.4503, -1.9328], r: [1.0014, 0.466, 0.1762] },
        { c: [-0.003, 0.4687, -1.6205], r: [1.0013, 0.4888, 0.1762] },
        { c: [-0.0014, 0.5549, -1.3082], r: [1.0029, 0.4488, 0.1762] },
        { c: [0, 0.6523, -0.9958], r: [1.1003, 0.5421, 0.1762] },
        { c: [0, 0.7388, -0.6835], r: [1.14, 0.6277, 0.1762] },
        { c: [0, 0.773, -0.3712], r: [0.9734, 0.661, 0.1762] },
        { c: [0, 0.7809, -0.0589], r: [0.975, 0.6682, 0.1762] },
        { c: [0, 0.7852, 0.2534], r: [0.9763, 0.6716, 0.1762] },
        { c: [0, 0.7787, 0.5657], r: [0.9858, 0.6663, 0.1762] },
        { c: [0.0015, 0.7514, 0.878], r: [1.0099, 0.6658, 0.1762] },
        { c: [0.0015, 0.6613, 1.1903], r: [1.0099, 0.6813, 0.1762] },
        { c: [0.0015, 0.6279, 1.5027], r: [1.0099, 0.6434, 0.1762] },
        { c: [0, 0.6552, 1.815], r: [0.9949, 0.5083, 0.1762] },
        { c: [0, 0.6215, 2.1273], r: [0.8888, 0.4304, 0.1762] },
      ],
    },
    driveSpinWheels: true,
    // SU7 socket centers (runtime meters, Y-up). Front at −Z.
    wheelCenters: [
      [-0.859022, 0.360427, -1.719717],
      [0.837685, 0.360369, -1.725955],
      [-0.86323, 0.360427, 1.292824],
      [0.866156, 0.360427, 1.269729],
    ],
    // Doors are fused into body panels; only the panoramic roof_glass can move.
    // Doors fused into body; panoramic roof_glass is fixed — nothing openable on this asset.
    openables: { doors: false, windows: false },
    // Center screen atlas ships a white car — retint to black to match paint_body.
    screenTintPath: '/models/su7-overview-screen-black.png',
    screenTintMaterialNames: ['Mesh13'],
  },
  /**
   * SU7 Detail — 170K GLB (interior ×37, 4 door groups). Separate vehicle so the
   * overview studio can keep the lighter 92K asset.
   * Source nose is +X → scene rotation Y +90° puts nose at −Z (not baked in GLB).
   */
  'su7-detail': {
    id: 'su7-detail',
    brand: 'Xiaomi',
    model: 'SU7 海湾蓝',
    switcherLabel: 'SU7 海湾蓝',
    plaqueTop: 'X I A O M I',
    plaqueTitle: 'SU7 海湾蓝',
    loadingText: 'Loading SU7 海湾蓝 (170K)…',
    modelPath: '/models/939243423__su7.glb?v=170',
    catalogPath: '/models/su7-detail-manifest.json',
    rotation: [0, Math.PI / 2, 0],
    scale: 1,
    parts: su7Parts as unknown as VehiclePartInfo[],
    describePiece: describeSu7,
    anchors: {
      body: [-1.35, 0.9, 0.1],
      glass: [0, 1.35, 0.1],
      doors: [1.1, 0.85, 0],
      cabin: [0, 0.9, 0.2],
      battery: [0, 0.2, 0],
      drive: [0, 0.4, 1.0],
      suspension: [-1.0, 0.4, -1.5],
      wheels: [-1.1, 0.34, 1.4],
    },
    about: {
      paragraphs: [
        'Drag to orbit. Pinch or scroll to zoom. Select a component for details; use the slider to separate the car.',
        '3D model: Xiaomi SU7. Author: [s1657270997](https://sketchfab.com/s1657270997). License: [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). Source: [Sketchfab](https://sketchfab.com/3d-models/su7-7296a91633d74c6eb113010e2ed75eda). Repository changes: axis rotation, semantic catalog, 海湾蓝 paint calibration, spoiler lowered.',
        '本页为非官方技术演示，与小米集团、小米汽车及相关品牌不存在隶属、赞助或授权关系。CC BY 4.0 不授予小米品牌、车标、外观设计或任何第三方商标权。',
        '界面布局参考特斯拉在线车辆说明与早期 Model X 3D 拆解项目的设计思路；本仓库不包含任何特斯拉资产或商标。',
        '170K detail asset: 170,371 tris, 41 meshes including full cabin (55k) and four door groups. Wheels ship as one merged mesh until runtime split.',
      ],
    },
    // Door meshes stay mapped so they remain visible after scene.remove(model).
    // The interactive door-open feature is intentionally NOT restored.
    geometryFlags: { doors: true, battery: false, drive: false, suspension: false },
    nodeMap: Object.fromEntries(
      ([
        ['Object_20', 'body', 'Body black trim'],
        ['Object_18', 'body', 'Body panels main'],
        ['Object_12', 'body', 'Rear structural'],
        ['Object_19', 'body', 'Body inner panel'],
        ['Object_25', 'body', 'Roof lidar'],
        ['Object_16', 'body', 'Front cavity panel'],
        ['Object_29', 'body', 'Body inner patch B'],
        ['Object_27', 'body', 'Body sill trim'],
        ['Object_14', 'body', 'Front badge'],
        ['Object_28', 'body', 'Body inner patch A'],
        ['Object_13', 'body', 'License plates'],
        ['Object_22', 'body', 'Tail lights'],
        ['Object_23', 'body', 'Light lens glass'],
        ['Object_24', 'body', 'Head lights'],
        ['Object_10', 'cabin', 'Cabin main'],
        ['Object_4', 'cabin', 'Cabin front'],
        ['Object_8', 'cabin', 'Cabin detail B'],
        ['Object_6', 'cabin', 'Cabin detail A'],
        ['Object_21', 'glass', 'Greenhouse glazing'],
        ['Object_56', 'wheels', 'Wheels merged'],
        ['Object_31', 'doors', 'Door FL inner'],
        ['Object_32', 'doors', 'Door FL outer'],
        ['Object_33', 'doors', 'Side mirror · FL'],
        ['Object_34', 'doors', 'Side mirror cap · FL'],
        ['Object_35', 'doors', 'Door FL panel'],
        ['Object_36', 'doors', 'Door FL glass'],
        ['Object_38', 'doors', 'Door RL inner'],
        ['Object_39', 'doors', 'Door RL outer'],
        ['Object_40', 'doors', 'Door RL panel'],
        ['Object_41', 'doors', 'Door RL trim'],
        ['Object_42', 'doors', 'Door RL misc'],
        ['Object_44', 'doors', 'Door FR inner'],
        ['Object_45', 'doors', 'Door FR outer'],
        ['Object_46', 'doors', 'Side mirror · FR'],
        ['Object_47', 'doors', 'Side mirror cap · FR'],
        ['Object_48', 'doors', 'Door FR panel'],
        ['Object_49', 'doors', 'Door FR glass'],
        ['Object_51', 'doors', 'Door RR inner'],
        ['Object_52', 'doors', 'Door RR outer'],
        ['Object_53', 'doors', 'Door RR panel'],
        ['Object_54', 'doors', 'Door RR trim'],
      ] as const).map(([node, part, label]) => [node, { part: part as PartId, label }])
    ),
    airflow: {
      longAxis: 'z',
      flowSign: 1,
      groundY: 0,
      inlet: -6.8,
      outlet: 8.5,
      wakeStart: 2.7,
      style: 'ribbons',
      // Slightly longer car (5.237 m) — reuse 92K hull as a close starting point until --fit.
      hull: [
        { c: [0, 0.45, -2.55], r: [0.9, 0.32, 0.18] },
        { c: [0, 0.47, -2.2], r: [1.0, 0.4, 0.18] },
        { c: [0, 0.55, -1.3], r: [1.02, 0.46, 0.18] },
        { c: [0, 0.74, -0.5], r: [1.1, 0.62, 0.2] },
        { c: [0, 0.78, 0.2], r: [0.98, 0.67, 0.2] },
        { c: [0, 0.7, 1.2], r: [1.02, 0.66, 0.2] },
        { c: [0, 0.62, 2.15], r: [0.9, 0.44, 0.18] },
      ],
    },
    driveSpinWheels: true,
    // DSH-measured hub centers after Y+90° (target frame).
    wheelCenters: [
      [-0.946659, 0.33635, -1.560669],
      [0.867318, 0.336321, -1.579347],
      [-0.946735, 0.336321, 1.490904],
      [0.867243, 0.33635, 1.454701],
    ],
    visualTweak: 'spoiler-down',
    // GLB Car_body is #076D87 (deep teal). Lift toward official 海湾蓝 (bay cyan-blue).
    // Overview SU7 remains black (baked paint_body #000000) — do not copy this there.
    paintHex: '#0C82A0',
    screenTintPath: '/models/su7-detail-screen-gulf.jpg',
    screenTintMaterialNames: ['interior1'],
    // Four door groups + door glass exist; no separate frunk/trunk/hood lids in this GLB.
    // Four door groups + door glass. No separate frunk/trunk/hood lids in this GLB.
    openables: { doors: true, windows: true },
  },
};

export const VEHICLE_IDS: VehicleId[] = ['su7', 'su7-detail'];

export function getVehicle(id: VehicleId): VehicleConfig {
  return VEHICLES[id];
}
