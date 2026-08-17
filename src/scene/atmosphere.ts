import * as THREE from 'three';

export interface Atmosphere {
  dispose(): void;
}

const disposedAtmospheres = new WeakSet<Atmosphere>();

export function createAtmosphere(scene: THREE.Scene): Atmosphere {
  const fog = new THREE.FogExp2('#c8d0cc', 0.006);
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
