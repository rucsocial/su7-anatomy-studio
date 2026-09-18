/**
 * Xiaomi SU7 — vehicle part data
 *
 * ⚠️ READ BEFORE EDITING
 * 1. The 3D asset depicts the PRE-REFRESH 2024 SU7. The current xiaomiev.com SU7 page
 *    documents the 2026 "新一代 SU7" (902 km CLTC, 752 V / 897 V, standard LiDAR).
 *    Numbers below are 2024-model unless a spec is tagged otherwise.
 * 2. `geometry.nodes` lists the real node names in `su7-web.glb` that implement each
 *    system. Where the asset has no geometry, `geometryStatus` says so — do NOT claim
 *    a system is modelled when it is not.
 * 3. Asset provenance: page author "Mona x Supercars (@Car2022)" AND embedded author
 *    "GT Cars: Hyperspeed" must BOTH be credited (CC-BY-4.0 requires attribution;
 *    the two differ, so neither may be dropped).
 *
 * Sources
 *  - ASSET  : https://github.com/caozhangqing85-cyber/su7-3d-configurator  (MIT code)
 *  - MODEL  : https://sketchfab.com/3d-models/xiaomi-su7-ca2cda599f5341068c992c9f44551bf9 (CC-BY-4.0)
 *  - OFFICIAL: https://www.xiaomiev.com/su7
 */

export type PartId =
  | 'body' | 'glass' | 'doors' | 'cabin'
  | 'battery' | 'drive' | 'suspension' | 'wheels';

/** Whether the shipped 3D asset actually contains geometry for this system. */
export type GeometryStatus = 'present' | 'partial' | 'needs-authoring';

export interface VehiclePart {
  id: PartId;
  name: string;
  category: string;
  tag: string;
  description: string;
  principle: string;
  specs: [string, string][];
  source: string;
  geometry: {
    status: GeometryStatus;
    /** Node names inside su7-web.glb */
    nodes: string[];
    /** Triangle count of those nodes combined (0 when absent) */
    triangles: number;
    note?: string;
  };
}

const OFFICIAL = 'https://www.xiaomiev.com/su7';

export const parts: VehiclePart[] = [
  {
    id: 'body',
    name: 'Body & structure',
    category: 'Exterior',
    tag: 'THE SHAPE THAT CUTS AIR',
    description:
      'The body carries the cabin, closes the front and rear storage volumes, and shapes the airflow that the car moves through. Its measured proportions are what the 3D model reproduces.',
    principle:
      'A low, long roofline and a sealed underbody let air leave the rear cleanly, which is why the production car quotes a 0.195 drag coefficient. Panels here are paint-region groups, so body colour can be changed per region rather than per panel.',
    specs: [
      ['Length', '4.997 m'],
      ['Width incl. mirrors', '2.2399 m'],
      ['Height', '1.4369 m'],
      ['Wheelbase', '2.9934 m'],
      ['Drag coefficient', '0.195 Cd (2024 model, published figure)'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'present',
      nodes: [
        'body_panels_main', 'body_panels_outer', 'body_panels_upper_a', 'body_panels_upper_b',
        'body_paint_front', 'body_paint_rear', 'body_paint_sides',
        'front_bumper', 'rear_bumper_trim', 'rear_bumper_lower', 'front_grille_panel',
        'trim_rear_spoiler_edge', 'underbody', 'detail_cowl',
      ],
      triangles: 64339,
      note:
        'Dimensions above are measured from the asset itself and match the published car. ' +
        'Lights (1,390 tris), rear badge (208) and roof antenna (4) are handled by describePiece() ' +
        'rather than by a system entry — 64,339 + 1,726 + 1,663 + 23,080 + 1,602 = 92,410, the whole model.',
    },
  },
  {
    id: 'glass',
    name: 'Glass & roof',
    category: 'Exterior',
    tag: 'LIGHT COMES IN FROM ABOVE',
    description:
      'The greenhouse glazing wraps the cabin, and a separate roof panel replaces what would otherwise be a metal roof — a large uninterrupted surface above the passengers.',
    principle:
      'The roof surface is modelled as its own node, so it can be highlighted, hidden or faded independently of the side and windscreen glazing. One hidden alpha-zero glass sheet is kept in the asset for interior occluder work.',
    specs: [
      ['Roof', 'Separate glass node (roof_glass)'],
      ['Greenhouse', 'Windscreen + side glazing (single node)'],
      ['Hidden sheet', 'glass_hidden_alpha0 — alpha 0, kept for occlusion'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'present',
      nodes: ['glass_greenhouse', 'roof_glass', 'glass_hidden_alpha0'],
      triangles: 1726,
    },
  },
  {
    id: 'doors',
    name: 'Doors',
    category: 'Exterior',
    tag: 'FOUR CONVENTIONAL DOORS',
    description:
      'The SU7 uses four conventionally hinged doors. Unlike the Model X, there are no upward-opening rear doors here.',
    principle:
      '⚠️ In this asset the door skins are NOT separate geometry — they are fused into the body panel and paint-region nodes. Independent door highlighting therefore cannot be done by node selection alone.',
    specs: [
      ['Layout', '4 doors, conventional hinges'],
      ['Upward-opening rear doors', 'None (this is a Model X feature, not an SU7 one)'],
      ['Asset geometry', 'Fused into body panels — no door nodes exist'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'needs-authoring',
      nodes: [],
      triangles: 0,
      note:
        'Doors must be cut out of body_panels_outer / body_panels_main / body_paint_sides in Blender ' +
        'before doors can be isolated. Blender sources ship with the asset repo (su7-blender-v2.blend).',
    },
  },
  {
    id: 'cabin',
    name: 'Passenger cabin',
    category: 'Interior',
    tag: 'THE SPACE YOU SIT IN',
    description:
      'Seats, trim, headliner and controls form the part of the car you touch every day. In this asset the cabin is represented by a single block plus a separate headliner.',
    principle:
      'Because the interior is modelled as a coarse block, the explorer shows the cabin as one volume rather than seat-by-seat. Treat it as a massing model, not an interior breakdown.',
    specs: [
      ['Cabin block', '1 node (cabin_block)'],
      ['Headliner', '1 node (cabin_headliner)'],
      ['Interior detail', 'Not modelled — block-level massing only'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'partial',
      nodes: ['cabin_block', 'cabin_headliner'],
      triangles: 1663,
      note: 'No seats, dashboard or screens as separate geometry. Honest limit of the source asset.',
    },
  },
  {
    id: 'battery',
    name: 'High-voltage battery',
    category: 'Energy',
    tag: 'THE ENERGY FOUNDATION',
    description:
      'A lithium-ion pack sits in the floor between the axles and feeds the drive units. The 2024 SU7 was offered with different pack sizes depending on version.',
    principle:
      'Energy flows to the motors under acceleration, and regains charge under regenerative braking. Published figures differ by version — check the version before quoting a number.',
    specs: [
      ['Chemistry', 'Lithium-ion — LFP and NMC versions were both offered'],
      ['Position', 'Floor, between axles'],
      ['Pack size (2024)', '73.6 / 94.3 / 101 kWh depending on version (published)'],
      ['Fast charging (2024)', '800 V class on the top version (published)'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'needs-authoring',
      nodes: [],
      triangles: 0,
      note:
        'No battery geometry in the asset. A reference geometry exists in a third-party teardown repo ' +
        '(omarRadwann/su7-ultra, battery.glb, 12,912 tris) but that repo is CC-BY-NC-SA-4.0 — ' +
        'non-commercial — so it cannot be merged into a project that may be published commercially.',
    },
  },
  {
    id: 'drive',
    name: 'Electric drive units',
    category: 'Powertrain',
    tag: 'ENERGY INTO MOTION',
    description:
      'Electric motors turn stored energy into wheel torque. Rear-wheel-drive versions use one motor; all-wheel-drive versions add a second unit at the front.',
    principle:
      'An inverter controls each motor and a single-speed reduction gearbox sends rotation to the wheels. The motors also slow the car through regenerative braking.',
    specs: [
      ['Layout', 'Rear motor, or front + rear'],
      ['Transmission', 'Single-speed reduction'],
      ['Output (2024 rear-drive)', '220 kW class (published)'],
      ['Output (2024 all-wheel drive)', '495 kW combined, 673 PS, 838 N·m (published)'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'needs-authoring',
      nodes: [],
      triangles: 0,
      note: 'No drive-unit geometry in the asset.',
    },
  },
  {
    id: 'suspension',
    name: 'Suspension',
    category: 'Chassis',
    tag: 'CONNECTED TO THE ROAD',
    description:
      'Double-wishbone geometry at the front and a multi-link layout at the rear locate each wheel. Higher versions add adjustable air springs and adaptive dampers.',
    principle:
      'Springs carry the weight while dampers control how the body moves over a bump. Air springs let ride height change; adaptive damping changes the balance between comfort and control.',
    specs: [
      ['Front', 'Double wishbone'],
      ['Rear', 'Multi-link'],
      ['Adjustable (higher versions)', 'Air springs + adaptive dampers'],
      ['Asset geometry', 'None — wheels attach to fixed sockets'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'needs-authoring',
      nodes: [],
      triangles: 0,
      note: 'Wheel sockets exist, but no arms, springs or dampers are modelled.',
    },
  },
  {
    id: 'wheels',
    name: 'Wheels, tyres & brakes',
    category: 'Chassis',
    tag: 'WHERE MOTION MEETS GRIP',
    description:
      'Each corner is modelled as four separate pieces — tyre, rim, hub and sidewall — so a single wheel can be isolated, hidden or replaced on its own.',
    principle:
      'The four corners were split out of the original merged mesh by triangle ownership, then verified: each socket now carries its own geometry. Brake calipers are NOT separate geometry and remain a visual-only extra.',
    specs: [
      ['Corners modelled', '4, independently isolatable'],
      ['Parts per corner', 'Tyre / rim / hub / sidewall'],
      ['Wheel radius (asset)', '0.360 m'],
      ['Rim width (asset)', '0.243 m'],
      ['Front / rear runtime width', '0.245 m / 0.265 m'],
      ['Brake calipers', 'Not separate geometry (visual-only)'],
    ],
    source: OFFICIAL,
    geometry: {
      status: 'present',
      nodes: [
        'wheel_fl_tire', 'wheel_fl_rim', 'wheel_fl_hub', 'wheel_fl_sidewall',
        'wheel_fr_tire', 'wheel_fr_rim', 'wheel_fr_hub', 'wheel_fr_sidewall',
        'wheel_rl_tire', 'wheel_rl_rim', 'wheel_rl_hub', 'wheel_rl_sidewall',
        'wheel_rr_tire', 'wheel_rr_rim', 'wheel_rr_hub', 'wheel_rr_sidewall',
      ],
      triangles: 23080,
      note:
        '23,080 = 4 corners x (rim 2,590 + tyre 1,600 + sidewall 1,440 + hub 140). ' +
        'A higher-detail swappable wheel ships separately (wheel-plum-blender-v2.glb, 31,984 tris, ' +
        '13 parts incl. disc, calipers, lug bolts) but its manifest marks rightsStatus ' +
        '"visual-reference-only" — clear the rights before publishing it.',
    },
  },
];

/**
 * Per-piece explanations, keyed by the SU7 model's semantic node names.
 * Names are matched after stripping a leading " · " suffix.
 */
export function describePiece(label: string): string {
  const name = label.split(' · ')[0];
  const explanations: Record<string, string> = {
    body_panels_main:
      'The largest single body group. It forms the main shell between the bumpers and carries the opening for the cabin.',
    body_panels_outer:
      'The outermost skin of the car. Its measured width across the mirrors is 2.2399 m, matching the published car.',
    body_panels_upper_a:
      'Upper body section toward the front — the shoulder line above the front wheel arch.',
    body_panels_upper_b:
      'Upper body section toward the rear — the shoulder line above the rear wheel arch.',
    body_paint_front:
      'A paint-region group covering front bodywork. Grouping by paint region lets the colour be changed here without touching the rest of the car.',
    body_paint_rear:
      'A paint-region group covering rear bodywork, handled separately from the front for colour changes.',
    body_paint_sides:
      'A paint-region group covering the flanks of the car.',
    front_bumper:
      'The front bumper cover forms the nose and surrounds the lower intake. It is the visible cover, not the impact structure behind it.',
    rear_bumper_trim:
      'The upper trim band of the rear bumper, sitting above the lower section.',
    rear_bumper_lower:
      'The lower rear bumper section. On the real car this region also houses sensors and the rear plate.',
    front_grille_panel:
      'A small front panel at the lower nose. Electric cars need far less cooling opening than combustion cars, so this area is mostly closed for aerodynamics.',
    trim_rear_spoiler_edge:
      'A thin rear edge trim piece. Small aerodynamic details like this contribute to the car’s low drag figure.',
    underbody:
      'The underside surface. A sealed, flat floor is one of the main reasons the car can quote a 0.195 drag coefficient.',
    detail_cowl:
      'The cowl sits at the base of the windscreen, between the glass and the body. It covers the joint and manages water drainage.',
    detail_rear_badge:
      'The rear badge. Decorative identification only — not part of the structure or the drivetrain.',
    detail_roof_antenna:
      'A small roof-mounted antenna detail.',
    glass_greenhouse:
      'The windscreen and side glazing treated as one group. It provides forward and side visibility and encloses the upper cabin.',
    roof_glass:
      'The roof panel above the passengers, modelled as its own glass surface. Because it is separate, it can be faded or hidden on its own.',
    glass_hidden_alpha0:
      'A fully transparent glass sheet kept in the asset as an interior occluder. It is invisible by design and exists to support rendering, not to be seen.',
    cabin_block:
      'The passenger compartment represented as a single volume. It is a massing block — seats, dashboard and screens are not separated out in this asset.',
    cabin_headliner:
      'The interior roof lining, above the passengers and below the glass roof.',
    lights_head:
      'The front lighting assembly. Headlamps both illuminate the road and signal the car’s presence to others.',
    lights_tail:
      'The rear lighting assembly, including the full-width light bar that identifies the car from behind.',
    wheel_fl_tire:
      'Front-left tyre. The tyre is the only part of the car in contact with the road; it carries the load and generates grip.',
    wheel_fr_tire: 'Front-right tyre, split out of the original merged wheel mesh.',
    wheel_rl_tire: 'Rear-left tyre, split out of the original merged wheel mesh.',
    wheel_rr_tire: 'Rear-right tyre, split out of the original merged wheel mesh.',
    wheel_fl_rim:
      'Front-left rim. The wheel supports the tyre and transfers load between it and the hub.',
    wheel_fr_rim: 'Front-right rim, independently isolatable.',
    wheel_rl_rim: 'Rear-left rim, independently isolatable.',
    wheel_rr_rim: 'Rear-right rim, independently isolatable.',
    wheel_fl_hub:
      'Front-left hub. Wheel fasteners clamp the wheel to this hub; the geometry here is the artist’s, not a verified service part.',
    wheel_fr_hub: 'Front-right hub.',
    wheel_rl_hub: 'Rear-left hub.',
    wheel_rr_hub: 'Rear-right hub.',
    wheel_fl_sidewall: 'Front-left tyre sidewall, modelled separately from the tread area.',
    wheel_fr_sidewall: 'Front-right tyre sidewall.',
    wheel_rl_sidewall: 'Rear-left tyre sidewall.',
    wheel_rr_sidewall: 'Rear-right tyre sidewall.',
  };
  return (
    explanations[name] ??
    'This is a separate piece of the source model. Its label describes the visible geometry; no verified service-part identity is supplied.'
  );
}
