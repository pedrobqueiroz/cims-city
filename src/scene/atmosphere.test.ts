import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAtmosphere } from './atmosphere';

describe('atmosphere', () => {
  it('adds exponential fog to the scene', () => {
    const scene = new THREE.Scene();
    const atmosphere = createAtmosphere(scene);

    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect((scene.fog as THREE.FogExp2).density).toBeGreaterThan(0);

    atmosphere.dispose();
  });

  it('removes fog on dispose', () => {
    const scene = new THREE.Scene();
    const atmosphere = createAtmosphere(scene);

    atmosphere.dispose();
    expect(scene.fog).toBeNull();
  });

  it('is idempotent on dispose', () => {
    const scene = new THREE.Scene();
    const atmosphere = createAtmosphere(scene);

    atmosphere.dispose();
    atmosphere.dispose();
    expect(scene.fog).toBeNull();
  });
});
