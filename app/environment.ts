export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy';

export const DEFAULT_SEASON: Season = 'summer';
export const DEFAULT_WEATHER: Weather = 'sunny';

export type ParticleMode = 'none' | 'rain' | 'snow' | 'leaves' | 'petals';

export type EnvironmentConfig = {
  background: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  keyColor: string;
  keyIntensity: number;
  rimColor: string;
  rimIntensity: number;
  glowColor: string;
  glowIntensity: number;
  groundColor: string;
  groundRoughness: number;
  groundMetalness: number;
  plinthColor: string;
  exposure: number;
  envIntensity: number;
  particles: ParticleMode;
  /** Extra sky tint for overcast / storm moods */
  skyTint: number;
  /** Whether the ground reads as wet (stronger specular, darker) */
  wetGround: boolean;
};

export const SEASONS: {id: Season; name: string; hint: string}[] = [
  {id: 'spring', name: 'Spring', hint: 'Fresh greens · soft light'},
  {id: 'summer', name: 'Summer', hint: 'High sun · warm bounce'},
  {id: 'autumn', name: 'Autumn', hint: 'Golden hour · long shadows'},
  {id: 'winter', name: 'Winter', hint: 'Cool blue · pale key light'},
];

export const WEATHERS: {id: Weather; name: string; hint: string}[] = [
  {id: 'sunny', name: 'Sunny', hint: 'Clear sky · crisp shadows'},
  {id: 'cloudy', name: 'Cloudy', hint: 'Soft overcast · flat light'},
  {id: 'rainy', name: 'Rainy', hint: 'Wet road · streaked rain'},
  {id: 'snowy', name: 'Snowy', hint: 'Falling snow · muted light'},
];

const seasonBase: Record<Season, Omit<EnvironmentConfig, 'particles' | 'skyTint' | 'wetGround'>> = {
  spring: {
    background: '#0c161c',
    fogColor: '#0c161c',
    fogNear: 16,
    fogFar: 56,
    hemisphereSky: '#d4ecff',
    hemisphereGround: '#5a6a52',
    hemisphereIntensity: 1.05,
    keyColor: '#fff6e4',
    keyIntensity: 2.6,
    rimColor: '#b8e0d0',
    rimIntensity: 1.7,
    glowColor: '#f0d0b0',
    glowIntensity: 1.7,
    groundColor: '#324038',
    groundRoughness: 0.86,
    groundMetalness: 0.12,
    plinthColor: '#3f4e48',
    exposure: 1.0,
    envIntensity: 1.3,
  },
  summer: {
    background: '#09141f',
    fogColor: '#09141f',
    fogNear: 22,
    fogFar: 64,
    hemisphereSky: '#c4e0f8',
    hemisphereGround: '#6a5c42',
    hemisphereIntensity: 1.15,
    keyColor: '#fff8ea',
    keyIntensity: 3.0,
    rimColor: '#a8d0f0',
    rimIntensity: 1.8,
    glowColor: '#ffd098',
    glowIntensity: 2.2,
    groundColor: '#363e46',
    groundRoughness: 0.8,
    groundMetalness: 0.14,
    plinthColor: '#48525c',
    exposure: 1.05,
    envIntensity: 1.4,
  },
  autumn: {
    background: '#14120e',
    fogColor: '#14120e',
    fogNear: 14,
    fogFar: 50,
    hemisphereSky: '#f0d0a8',
    hemisphereGround: '#5a4830',
    hemisphereIntensity: 0.9,
    keyColor: '#ffc890',
    keyIntensity: 2.5,
    rimColor: '#e0a878',
    rimIntensity: 1.5,
    glowColor: '#f0a060',
    glowIntensity: 2.4,
    groundColor: '#40382c',
    groundRoughness: 0.92,
    groundMetalness: 0.1,
    plinthColor: '#504438',
    exposure: 0.98,
    envIntensity: 1.2,
  },
  winter: {
    background: '#0a1018',
    fogColor: '#0a1018',
    fogNear: 12,
    fogFar: 48,
    hemisphereSky: '#d8e8f8',
    hemisphereGround: '#44505c',
    hemisphereIntensity: 0.95,
    keyColor: '#eef4ff',
    keyIntensity: 2.1,
    rimColor: '#b8d0e8',
    rimIntensity: 1.9,
    glowColor: '#c8d4e8',
    glowIntensity: 1.3,
    groundColor: '#2e3842',
    groundRoughness: 0.72,
    groundMetalness: 0.16,
    plinthColor: '#3c4854',
    exposure: 0.94,
    envIntensity: 1.25,
  },
};

const weatherOverlay: Record<Weather, Partial<EnvironmentConfig>> = {
  sunny: {
    particles: 'none',
    skyTint: 0,
    wetGround: false,
  },
  cloudy: {
    keyIntensity: 0.75,
    rimIntensity: 0.85,
    glowIntensity: 0.55,
    hemisphereIntensity: 1.25,
    fogNear: 10,
    fogFar: 40,
    exposure: 0.86,
    envIntensity: 0.85,
    background: '#121820',
    fogColor: '#121820',
    keyColor: '#d8e0e8',
    particles: 'none',
    skyTint: 0.35,
    wetGround: false,
  },
  rainy: {
    keyIntensity: 0.4,
    rimIntensity: 0.55,
    glowIntensity: 0.35,
    hemisphereIntensity: 0.55,
    fogNear: 6,
    fogFar: 28,
    exposure: 0.72,
    envIntensity: 0.55,
    background: '#0c1218',
    fogColor: '#0c1218',
    keyColor: '#90a8c0',
    groundRoughness: 0.18,
    groundMetalness: 0.55,
    groundColor: '#141c24',
    plinthColor: '#1a2430',
    particles: 'rain',
    skyTint: 0.55,
    wetGround: true,
  },
  snowy: {
    keyIntensity: 0.65,
    rimIntensity: 1.0,
    glowIntensity: 0.5,
    hemisphereIntensity: 1.3,
    fogNear: 8,
    fogFar: 34,
    exposure: 0.84,
    envIntensity: 0.9,
    background: '#101820',
    fogColor: '#101820',
    keyColor: '#e0e8f0',
    groundColor: '#8a9298',
    groundRoughness: 0.85,
    groundMetalness: 0.08,
    plinthColor: '#5a646c',
    particles: 'snow',
    skyTint: 0.4,
    wetGround: false,
  },
};

const seasonalParticles: Partial<Record<Season, ParticleMode>> = {
  spring: 'petals',
  autumn: 'leaves',
};

export function resolveEnvironment(season: Season, weather: Weather): EnvironmentConfig {
  const base = {...seasonBase[season]} as EnvironmentConfig;
  base.particles = 'none';
  base.skyTint = 0;
  base.wetGround = false;
  const overlay = weatherOverlay[weather];
  const merged = {...base, ...overlay} as EnvironmentConfig;
  // Seasonal ambient particles only when weather does not dominate with rain/snow.
  if (weather === 'sunny' || weather === 'cloudy') {
    const seasonal = seasonalParticles[season];
    if (seasonal) merged.particles = seasonal;
  }
  // Rain in winter reads as sleet — keep rain mode but cool the palette further.
  if (season === 'winter' && weather === 'rainy') {
    merged.groundColor = '#101820';
    merged.keyColor = '#a0b0c0';
  }
  // Snow + autumn is rare but keep ground from going pure white too early.
  if (season === 'autumn' && weather === 'snowy') {
    merged.groundColor = '#6a7078';
  }
  return merged;
}

export function environmentKey(season: Season, weather: Weather): string {
  return `${season}:${weather}`;
}
