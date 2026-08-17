import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMaterialPalette, disposeMaterialPalette } from './materials';
import { createTree, createBush, disposeVegetation, type TreeType } from './vegetation';

const groups: THREE.Group[] = [];

afterEach(() => {
  for (const group of groups.splice(0)) disposeVegetation(group);
});

describe('vegetation', () => {
  it.each(['deciduous', 'conifer'] as TreeType[])('creates a %s tree with trunk and crown', (type) => {
    const palette = createMaterialPalette();
    const tree = createTree(type, palette);
    groups.push(tree);

    expect(tree.name).toBe(`tree:${type}`);
    const trunk = tree.getObjectByName('trunk');
    const crown = tree.getObjectByName('crown');
    expect(trunk).toBeDefined();
    expect(crown).toBeDefined();

    disposeMaterialPalette(palette);
  });

  it('creates deciduous trees with spherical crown', () => {
    const palette = createMaterialPalette();
    const tree = createTree('deciduous', palette);
    groups.push(tree);

    const crown = tree.getObjectByName('crown') as THREE.Mesh;
    expect(crown.geometry).toBeInstanceOf(THREE.IcosahedronGeometry);

    disposeMaterialPalette(palette);
  });

  it('creates conifer trees with conical crown', () => {
    const palette = createMaterialPalette();
    const tree = createTree('conifer', palette);
    groups.push(tree);

    const crown = tree.getObjectByName('crown') as THREE.Mesh;
    expect(crown.geometry).toBeInstanceOf(THREE.ConeGeometry);

    disposeMaterialPalette(palette);
  });

  it('creates a bush with multiple lobes', () => {
    const palette = createMaterialPalette();
    const bush = createBush(palette);
    groups.push(bush);

    expect(bush.name).toBe('bush');
    expect(bush.children.length).toBe(3);

    disposeMaterialPalette(palette);
  });

  it('creates vegetation with shadow casting enabled', () => {
    const palette = createMaterialPalette();
    const tree = createTree('deciduous', palette);
    groups.push(tree);

    tree.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        expect(child.castShadow).toBe(true);
      }
    });

    disposeMaterialPalette(palette);
  });

  it('disposes geometry on disposal', () => {
    const palette = createMaterialPalette();
    const tree = createTree('deciduous', palette);
    const geometries: THREE.BufferGeometry[] = [];
    tree.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.push(child.geometry);
    });
    const spies = geometries.map(g => vi.spyOn(g, 'dispose'));

    disposeVegetation(tree);

    for (const spy of spies) expect(spy).toHaveBeenCalled();
    disposeMaterialPalette(palette);
  });
});
