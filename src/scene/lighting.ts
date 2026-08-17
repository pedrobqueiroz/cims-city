import * as THREE from 'three';

export type LightingQualityTier = 'desktop' | 'mobile' | 'reduced';

export interface DaylightRig {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  fill: THREE.HemisphereLight;
  lights: readonly THREE.Light[];
  dispose(): void;
}

const disposedRigs = new WeakSet<DaylightRig>();

function shadowMapSize(tier: LightingQualityTier): number {
  if (tier === 'desktop') return 2048;
  if (tier === 'mobile') return 1024;
  return 1;
}

function disposeShadowMap(sun: THREE.DirectionalLight): void {
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
}

export function setLightingQuality(rig: DaylightRig, tier: LightingQualityTier): void {
  if (disposedRigs.has(rig)) return;

  disposeShadowMap(rig.sun);
  const size = shadowMapSize(tier);
  rig.sun.castShadow = tier !== 'reduced';
  rig.sun.shadow.mapSize.set(size, size);
  rig.sun.shadow.needsUpdate = true;
}

export function createDaylightRig(scene: THREE.Scene, tier: LightingQualityTier): DaylightRig {
  const root = new THREE.Group();
  root.name = 'lighting:daylight';

  const sun = new THREE.DirectionalLight('#e8eef5', 2.2);
  sun.name = 'light:sun';
  sun.position.set(28, 42, 18);
  sun.target.position.set(0, 0, 0);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 110;
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.0002;

  const fill = new THREE.HemisphereLight('#c5d5e0', '#5a6b5a', 0.9);
  fill.name = 'light:hemisphere';
  fill.castShadow = false;

  root.add(sun, sun.target, fill);
  scene.add(root);

  const lights = [sun, fill] as const;
  const rig: DaylightRig = {
    root,
    sun,
    fill,
    lights,
    dispose() {
      if (disposedRigs.has(rig)) return;
      disposedRigs.add(rig);
      disposeShadowMap(sun);
      root.removeFromParent();
    },
  };
  setLightingQuality(rig, tier);
  return rig;
}
