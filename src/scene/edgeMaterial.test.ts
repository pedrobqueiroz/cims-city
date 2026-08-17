import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createEdgeMaterial, createEdgeOverlay } from './edgeMaterial';

describe('edge material', () => {
  it('creates a line basic material from a color', () => {
    const material = createEdgeMaterial(new THREE.Color('#28343b'));
    expect(material).toBeInstanceOf(THREE.LineBasicMaterial);
    expect(`#${material.color.getHexString()}`).toBe('#28343b');
    material.dispose();
  });

  it('creates edge overlay geometry from a mesh', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: '#e5dfd4' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'test-box';

    const edges = createEdgeOverlay(mesh, new THREE.Color('#28343b'));
    expect(edges).toBeInstanceOf(THREE.LineSegments);
    expect(edges.name).toBe('edge:test-box');
    expect(edges.geometry).toBeInstanceOf(THREE.EdgesGeometry);

    edges.geometry.dispose();
    (edges.material as THREE.Material).dispose();
    geometry.dispose();
    material.dispose();
  });

  it('clones the input color so the original is not mutated', () => {
    const original = new THREE.Color('#ff0000');
    const material = createEdgeMaterial(original);
    original.set('#00ff00');
    expect(`#${material.color.getHexString()}`).toBe('#ff0000');
    material.dispose();
  });
});
