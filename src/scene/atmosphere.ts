import * as THREE from 'three';

export interface Atmosphere {
  dispose(): void;
}

const disposedAtmospheres = new WeakSet<Atmosphere>();

export function createAtmosphere(scene: THREE.Scene): Atmosphere {
  const fog = new THREE.FogExp2('#b8c4bf', 0.012);
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
