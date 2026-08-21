import * as THREE from 'three';

export interface Atmosphere {
  dispose(): void;
}

const disposedAtmospheres = new WeakSet<Atmosphere>();

export function createAtmosphere(scene: THREE.Scene): Atmosphere {
  // Neutral grey fog for atmospheric depth
  const fog = new THREE.FogExp2('#e0e8e4', 0.003);
  scene.fog = fog;

  const atmosphere: Atmosphere = {
    dispose() {
      if (disposedAtmospheres.has(atmosphere)) return;
      disposedAtmospheres.add(atmosphere);
      scene.fog = null;
    },
  };
  return atmosphere;
}
