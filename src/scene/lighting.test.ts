import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createDaylightRig, setLightingQuality } from './lighting';

describe('daylight rig', () => {
  it('configures the authored daylight lights and directional shadow camera', () => {
    const scene = new THREE.Scene();
    const rig = createDaylightRig(scene, 'desktop');

    expect(rig.root.name).toBe('lighting:daylight');
    expect(rig.sun.name).toBe('light:sun');
    expect(rig.sun.position.toArray()).toEqual([28, 42, 18]);
    expect(`#${rig.sun.color.getHexString()}`).toBe('#fff3dc');
    expect(rig.sun.castShadow).toBe(true);
    expect(rig.sun.target.position.toArray()).toEqual([0, 0, 0]);
    expect(rig.fill.name).toBe('light:hemisphere');
    expect(`#${rig.fill.color.getHexString()}`).toBe('#dbe9ee');
    expect(`#${rig.fill.groundColor.getHexString()}`).toBe('#8d938d');
    expect(rig.fill.castShadow).toBe(false);
    expect(rig.lights).toEqual([rig.sun, rig.fill]);
    expect(rig.root.children).toEqual(expect.arrayContaining([rig.sun, rig.fill, rig.sun.target]));
    expect(rig.sun.shadow.mapSize.toArray()).toEqual([2048, 2048]);
    expect(rig.sun.shadow.camera.left).toBe(-48);
    expect(rig.sun.shadow.camera.right).toBe(48);
    expect(rig.sun.shadow.camera.top).toBe(48);
    expect(rig.sun.shadow.camera.bottom).toBe(-48);
    expect(rig.sun.shadow.camera.near).toBe(1);
    expect(rig.sun.shadow.camera.far).toBe(110);
    expect(rig.sun.shadow.normalBias).toBe(0.025);
    expect(rig.sun.shadow.bias).toBe(-0.0002);
    expect(rig.lights.filter((light) => light.castShadow)).toHaveLength(1);
  });

  it('uses the mobile shadow budget and keeps exactly one shadow caster', () => {
    const rig = createDaylightRig(new THREE.Scene(), 'mobile');

    expect(rig.sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(rig.lights.filter((light) => light.castShadow)).toEqual([rig.sun]);
  });

  it('uses lower hemisphere fill intensity than sun intensity', () => {
    const rig = createDaylightRig(new THREE.Scene(), 'desktop');

    expect(rig.fill.intensity).toBeLessThan(rig.sun.intensity);
  });

  it('caps shadow map size per tier: desktop at 2048, mobile at 1024', () => {
    const desktopRig = createDaylightRig(new THREE.Scene(), 'desktop');
    expect(desktopRig.sun.shadow.mapSize.x).toBeLessThanOrEqual(2048);
    expect(desktopRig.sun.shadow.mapSize.y).toBeLessThanOrEqual(2048);

    const mobileRig = createDaylightRig(new THREE.Scene(), 'mobile');
    expect(mobileRig.sun.shadow.mapSize.x).toBeLessThanOrEqual(1024);
    expect(mobileRig.sun.shadow.mapSize.y).toBeLessThanOrEqual(1024);
  });

  it('changes tier by disposing the current map before replacing its size and marks shadows dirty', () => {
    const rig = createDaylightRig(new THREE.Scene(), 'desktop');
    const firstSizeAtDisposal: number[][] = [];
    const map = {
      dispose: vi.fn(() => firstSizeAtDisposal.push(rig.sun.shadow.mapSize.toArray())),
    } as unknown as THREE.WebGLRenderTarget;
    rig.sun.shadow.map = map;
    rig.sun.shadow.needsUpdate = false;

    setLightingQuality(rig, 'mobile');

    expect(map.dispose).toHaveBeenCalledTimes(1);
    expect(firstSizeAtDisposal).toEqual([[2048, 2048]]);
    expect(rig.sun.shadow.map).toBeNull();
    expect(rig.sun.shadow.mapSize.toArray()).toEqual([1024, 1024]);
    expect(rig.sun.castShadow).toBe(true);
    expect(rig.sun.shadow.needsUpdate).toBe(true);

    const secondSizeAtDisposal: number[][] = [];
    const reducedMap = {
      dispose: vi.fn(() => secondSizeAtDisposal.push(rig.sun.shadow.mapSize.toArray())),
    } as unknown as THREE.WebGLRenderTarget;
    rig.sun.shadow.map = reducedMap;
    setLightingQuality(rig, 'reduced');

    expect(reducedMap.dispose).toHaveBeenCalledTimes(1);
    expect(secondSizeAtDisposal).toEqual([[1024, 1024]]);
    expect(rig.sun.shadow.mapSize.toArray()).toEqual([1, 1]);
    expect(rig.sun.castShadow).toBe(false);
    expect(rig.lights.filter((light) => light.castShadow)).toHaveLength(0);
  });

  it('adds its root to the scene and disposes its resources and scene membership only once', () => {
    const scene = new THREE.Scene();
    const rig = createDaylightRig(scene, 'desktop');
    const map = { dispose: vi.fn() } as unknown as THREE.WebGLRenderTarget;
    rig.sun.shadow.map = map;

    expect(scene.children).toContain(rig.root);
    rig.dispose();
    rig.dispose();

    expect(map.dispose).toHaveBeenCalledTimes(1);
    expect(rig.sun.shadow.map).toBeNull();
    expect(scene.children).not.toContain(rig.root);
    expect(rig.root.parent).toBeNull();
  });
});
