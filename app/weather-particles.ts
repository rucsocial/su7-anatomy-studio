import * as THREE from 'three';
import type {ParticleMode} from './environment';

export type ParticleState = {
  object: THREE.Object3D;
  positions: Float32Array;
  velocities: Float32Array;
  drift: Float32Array;
  mode: ParticleMode;
  count: number;
  /** lineSegments for rain, points otherwise */
  kind: 'points' | 'lines';
};

const COUNTS: Record<Exclude<ParticleMode, 'none'>, number> = {
  rain: 700,
  snow: 900,
  leaves: 160,
  petals: 140,
};

const COLORS: Record<Exclude<ParticleMode, 'none'>, number> = {
  rain: 0x9ec8e8,
  snow: 0xf0f6fc,
  leaves: 0xd09040,
  petals: 0xf4b0c8,
};

const SIZES: Record<Exclude<ParticleMode, 'none'>, number> = {
  rain: 0.04,
  snow: 0.06,
  leaves: 0.08,
  petals: 0.055,
};

export function createParticleSystem(mode: ParticleMode, scene: THREE.Scene): ParticleState | null {
  if (mode === 'none') return null;
  const count = COUNTS[mode];
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const drift = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 30;
    positions[i * 3 + 1] = Math.random() * 18;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    if (mode === 'rain') {
      // Slanted fall — slight forward bias reads as wind-driven rain
      velocities[i * 3] = 0.6 + Math.random() * 1.2;
      velocities[i * 3 + 1] = -16 - Math.random() * 12;
      velocities[i * 3 + 2] = 0.2 + Math.random() * 0.6;
    } else if (mode === 'snow') {
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -0.7 - Math.random() * 1.1;
      velocities[i * 3 + 2] = 0;
      drift[i] = Math.random() * Math.PI * 2;
    } else if (mode === 'leaves') {
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -0.55 - Math.random() * 0.85;
      velocities[i * 3 + 2] = 0;
      drift[i] = Math.random() * Math.PI * 2;
    } else {
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -0.3 - Math.random() * 0.4;
      velocities[i * 3 + 2] = 0;
      drift[i] = Math.random() * Math.PI * 2;
    }
  }

  if (mode === 'rain') {
    // Streak lines: each drop is a short segment along its velocity
    const linePos = new Float32Array(count * 2 * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i6 = i * 6;
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];
      const len = 0.35 + Math.random() * 0.45;
      linePos[i6] = x;
      linePos[i6 + 1] = y;
      linePos[i6 + 2] = z;
      linePos[i6 + 3] = x - velocities[i3] * 0.02;
      linePos[i6 + 4] = y - velocities[i3 + 1] * (len / Math.abs(velocities[i3 + 1]));
      linePos[i6 + 5] = z - velocities[i3 + 2] * 0.02;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: COLORS.rain,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.userData.particles = true;
    scene.add(lines);
    return {object: lines, positions, velocities, drift, mode, count, kind: 'lines'};
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: COLORS[mode],
    size: SIZES[mode],
    transparent: true,
    opacity: mode === 'snow' ? 0.9 : 0.75,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.userData.particles = true;
  scene.add(points);

  return {object: points, positions, velocities, drift, mode, count, kind: 'points'};
}

export function updateParticles(state: ParticleState, dt: number, time: number): void {
  const {positions, velocities, drift, mode, count, kind} = state;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    if (mode === 'rain') {
      positions[i3] += velocities[i3] * dt;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += velocities[i3 + 2] * dt;
    } else {
      const phase = drift[i] + time * (mode === 'snow' ? 0.45 : 0.75);
      const sway = mode === 'snow' ? 0.55 : 1.3;
      positions[i3] += Math.sin(phase + positions[i3 + 2] * 0.15) * dt * sway;
      positions[i3 + 1] += velocities[i3 + 1] * dt;
      positions[i3 + 2] += Math.cos(phase + positions[i3] * 0.1) * dt * sway * 0.85;
      // Leaves/petals tumble faster near the ground
      if ((mode === 'leaves' || mode === 'petals') && positions[i3 + 1] < 2) {
        positions[i3] += Math.sin(time * 3 + i) * dt * 0.4;
      }
    }

    if (positions[i3 + 1] < -0.25) {
      positions[i3] = (Math.random() - 0.5) * 30;
      positions[i3 + 1] = 13 + Math.random() * 7;
      positions[i3 + 2] = (Math.random() - 0.5) * 30;
    }
    if (positions[i3] > 17) positions[i3] = -17;
    if (positions[i3] < -17) positions[i3] = 17;
    if (positions[i3 + 2] > 17) positions[i3 + 2] = -17;
    if (positions[i3 + 2] < -17) positions[i3 + 2] = 17;
  }

  if (kind === 'lines') {
    const attr = (state.object as THREE.LineSegments).geometry.getAttribute('position') as THREE.BufferAttribute;
    const linePos = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const i6 = i * 6;
      const x = positions[i3];
      const y = positions[i3 + 1];
      const z = positions[i3 + 2];
      const len = 0.4;
      linePos[i6] = x;
      linePos[i6 + 1] = y;
      linePos[i6 + 2] = z;
      linePos[i6 + 3] = x - 0.04;
      linePos[i6 + 4] = y + len;
      linePos[i6 + 5] = z - 0.02;
    }
    attr.needsUpdate = true;
  } else {
    const attr = (state.object as THREE.Points).geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }
}

export function disposeParticles(state: ParticleState | null): void {
  if (!state) return;
  const obj = state.object as THREE.Mesh;
  obj.geometry?.dispose();
  (obj.material as THREE.Material | undefined)?.dispose();
  state.object.removeFromParent();
}
