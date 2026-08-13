import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRelationshipAppearance } from './relationshipAppearance';

const resources: Array<THREE.BufferGeometry | THREE.Material> = [];
const appearances: Array<ReturnType<typeof createRelationshipAppearance>> = [];

function route(sourceId: string, targetId: string, material?: THREE.Material): THREE.Group {
  const result = new THREE.Group();
  result.userData = { sourceId, targetId, emphasis: 'normal' };
  if (material) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    result.add(new THREE.Mesh(geometry, material));
    resources.push(geometry);
  }
  return result;
}

function materialOf(group: THREE.Group): THREE.Material {
  const mesh = group.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  if (!mesh || Array.isArray(mesh.material)) throw new Error('Expected a single route material');
  return mesh.material;
}

afterEach(() => {
  for (const appearance of appearances.splice(0)) appearance.dispose();
  for (const resource of resources.splice(0)) resource.dispose();
  vi.restoreAllMocks();
});

describe('relationship appearance', () => {
  it('emphasizes incident routes and recedes unrelated visuals', () => {
    const activeRoute = new THREE.Group();
    activeRoute.userData = { sourceId: 'cims-hub', targetId: 'smart-textiles' };
    const unrelatedRoute = new THREE.Group();
    unrelatedRoute.userData = { sourceId: 'hycatt', targetId: 'new-zema' };
    const routes = [activeRoute, unrelatedRoute];
    const unrelatedVisual = new THREE.Group();
    const visualMaterial = new THREE.MeshBasicMaterial({ opacity: 0.8, transparent: true });
    const visualGeometry = new THREE.BoxGeometry(1, 1, 1);
    unrelatedVisual.add(new THREE.Mesh(visualGeometry, visualMaterial));
    resources.push(visualMaterial, visualGeometry);
    const visuals = new Map<string, THREE.Object3D>([['hycatt', unrelatedVisual]]);
    const appearance = createRelationshipAppearance(routes, visuals);
    appearances.push(appearance);

    appearance.apply({ mode: 'incident', entityId: 'cims-hub' });

    expect(activeRoute.userData.emphasis).toBe('active');
    expect(unrelatedRoute.userData.emphasis).toBe('receded');
    expect(unrelatedVisual.userData.emphasis).toBe('receded');
    const visualMesh = unrelatedVisual.children[0] as THREE.Mesh;
    expect(visualMesh.material).not.toBe(visualMaterial);
    expect((visualMesh.material as THREE.Material & { opacity: number }).opacity).toBeLessThan(0.8);
  });

  it('reuses material variants while keeping preview lighter than committed selection', () => {
    const shared = new THREE.MeshBasicMaterial({ color: 0x336699, opacity: 0.9, transparent: true });
    resources.push(shared);
    const activeRoute = route('cims-hub', 'smart-textiles', shared);
    const previewRoute = route('hycatt', 'new-zema', shared);
    const unrelatedRoute = route('uds', 'htw-saar', shared);
    const geometry = (activeRoute.children[0] as THREE.Mesh).geometry;
    const clone = vi.spyOn(shared, 'clone');
    const appearance = createRelationshipAppearance([activeRoute, previewRoute, unrelatedRoute], new Map());
    appearances.push(appearance);

    expect(clone).toHaveBeenCalledTimes(3);
    clone.mockClear();
    appearance.apply({ mode: 'incident', entityId: 'cims-hub', previewId: 'hycatt' });
    const activeMaterial = materialOf(activeRoute);
    const previewMaterial = materialOf(previewRoute);
    const recededMaterial = materialOf(unrelatedRoute);

    expect(clone).not.toHaveBeenCalled();
    expect(activeRoute.userData.emphasis).toBe('active');
    expect(previewRoute.userData.emphasis).toBe('preview');
    expect(unrelatedRoute.userData.emphasis).toBe('receded');
    expect(activeMaterial).not.toBe(shared);
    expect(previewMaterial.opacity).toBeLessThan(activeMaterial.opacity);
    expect(previewMaterial.opacity).toBeGreaterThan(recededMaterial.opacity);
    expect((activeRoute.children[0] as THREE.Mesh).geometry).toBe(geometry);
    expect(shared.color.getHex()).toBe(0x336699);
    expect(shared.opacity).toBe(0.9);

    appearance.apply({ mode: 'none' });
    expect(materialOf(activeRoute)).toBe(shared);
    expect(activeRoute.userData.emphasis).toBe('normal');
  });

  it('restores original materials and disposes only owned variants', () => {
    const original = new THREE.MeshBasicMaterial({ opacity: 0.7, transparent: true });
    resources.push(original);
    const activeRoute = route('cims-hub', 'smart-textiles', original);
    const originalDispose = vi.spyOn(original, 'dispose');
    const appearance = createRelationshipAppearance([activeRoute], new Map());

    appearance.apply({ mode: 'incident', entityId: 'cims-hub' });
    const variant = materialOf(activeRoute);
    const variantDispose = vi.spyOn(variant, 'dispose');
    appearance.dispose();
    appearance.dispose();

    expect(materialOf(activeRoute)).toBe(original);
    expect(variantDispose).toHaveBeenCalledTimes(1);
    expect(originalDispose).not.toHaveBeenCalled();
  });
});
