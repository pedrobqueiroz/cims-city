import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ENTITIES } from '../data/entities';
import { SelectionController } from '../interaction/selectionController';
import { createCampus } from './campus';
import { createMaterialPalette, disposeMaterialPalette } from './materials';
import {
  assertLayout,
  GROUP_FOOTPRINT,
  GROUP_IDS,
  GROUP_RADIUS,
  LAYOUT_BY_ID,
  type LayoutNode,
  validateLayout,
} from './layout';

const groupCoordinates: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['elastocalorics', [-24, -21]],
  ['electroactive-polymers', [-9.7342, -10.6353]],
  ['smart-material-electronics', [-15.1832, 6.1353]],
  ['smart-textiles', [-32.8168, 6.1353]],
  ['shape-memory-alloys', [-38.2658, -10.6353]],
]);

function copyLayout(): Map<string, LayoutNode> {
  return new Map([...LAYOUT_BY_ID].map(([id, node]) => [
    id,
    { ...node, position: [...node.position] as [number, number, number], footprint: [...node.footprint] as [number, number], focus: { ...node.focus, target: [...node.focus.target] as [number, number, number] } },
  ]));
}

describe('organizational campus layout', () => {
  it('places the five exact research groups on a shared local ring around the CiMS hub', () => {
    expect(GROUP_IDS).toEqual([
      'elastocalorics',
      'electroactive-polymers',
      'smart-material-electronics',
      'smart-textiles',
      'shape-memory-alloys',
    ]);
    expect(GROUP_RADIUS).toBe(15);
    expect(GROUP_FOOTPRINT).toEqual([10, 7]);
    const hub = LAYOUT_BY_ID.get('cims-hub')!;

    for (const id of GROUP_IDS) {
      const layout = LAYOUT_BY_ID.get(id);
      expect(layout, id).toBeDefined();
      if (!layout) return;
      expect(Math.hypot(layout.position[0] - hub.position[0], layout.position[2] - hub.position[2])).toBeCloseTo(15, 6);
      expect(layout.position[1]).toBe(0);
      expect(layout.footprint).toEqual([10, 7]);
      expect(layout.focus.distance).toBe(15);
      expect(layout.focus.target[1]).toBe(3);
    }
  });

  it('uses the authored distinct, roughly even group-angle positions', () => {
    const hub = LAYOUT_BY_ID.get('cims-hub')!;
    const angles = GROUP_IDS.map((id) => {
      const layout = LAYOUT_BY_ID.get(id);
      expect(layout, id).toBeDefined();
      if (!layout) return 0;
      const position = layout.position;
      const expected = groupCoordinates.get(id)!;
      expect([Number(position[0].toFixed(4)), Number(position[2].toFixed(4))], id).toEqual(expected);
      return (Math.atan2(position[2] - hub.position[2], position[0] - hub.position[0]) * 180) / Math.PI;
    });

    expect(new Set(angles.map((angle) => angle.toFixed(4))).size).toBe(5);
    const gaps = angles
      .map((angle) => (angle + 360) % 360)
      .sort((left, right) => left - right)
      .map((angle, index, sorted) => ((sorted[(index + 1) % sorted.length]! - angle + 360) % 360));
    for (const gap of gaps) expect(gap).toBeCloseTo(72, 6);
  });

  it('keeps the adjacent lab outside the local group ring and partners beyond CiMS', () => {
    const lab = LAYOUT_BY_ID.get('soft-robotics-lab')!;
    const hub = LAYOUT_BY_ID.get('cims-hub')!;
    expect(lab).toBeDefined();
    if (!lab) return;
    expect(Math.hypot(lab.position[0] - hub.position[0], lab.position[2] - hub.position[2])).toBeGreaterThan(20);

    for (const id of ['uds', 'htw-saar']) {
      const partner = LAYOUT_BY_ID.get(id)!;
      expect(partner, id).toBeDefined();
      if (!partner) return;
      expect(Math.hypot(partner.position[0] - hub.position[0], partner.position[2] - hub.position[2]), id).toBeGreaterThan(40);
    }
  });

  it('keeps the SEi semantic land anchor separate from the relocated CiMS hub', () => {
    const sei = LAYOUT_BY_ID.get('sei');
    const hub = LAYOUT_BY_ID.get('cims-hub');

    expect(sei).toMatchObject({
      position: [0, 0, 2],
      footprint: [8, 5],
      focus: { target: [0, 3, 0], distance: 58 },
    });
    expect(hub?.position).toEqual([-24, 0, -6]);
    expect(sei?.position).not.toEqual(hub?.position);
  });

  it('central ray selection aimed at the Hub cannot return the SEi context proxy', () => {
    const palette = createMaterialPalette();
    const campus = createCampus({
      entities: ENTITIES,
      layout: LAYOUT_BY_ID,
      palette,
      contextDensity: 0,
    });
    const scene = new THREE.Scene();
    scene.add(campus.root);
    scene.updateMatrixWorld(true);

    const seiProxy = campus.entityVisuals.get('sei')!.proxy;
    const hubProxy = campus.entityVisuals.get('cims-hub')!.proxy;
    expect(seiProxy.getWorldPosition(new THREE.Vector3()).toArray()).not.toEqual(
      hubProxy.getWorldPosition(new THREE.Vector3()).toArray(),
    );

    const canvas = document.createElement('canvas');
    canvas.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, right: 400, bottom: 400, left: 0,
      width: 400, height: 400, toJSON: () => ({}),
    });
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 260);
    camera.position.set(-24, 20, 34);
    camera.lookAt(-24, 3.5, -6);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const onSelect = vi.fn();
    const selection = new SelectionController({
      canvas,
      camera,
      proxies: campus.selectionProxies,
      onSelect,
      requestRender: vi.fn(),
    });

    selection.pointerDown({ pointerId: 1, clientX: 200, clientY: 200 });
    selection.pointerUp({ pointerId: 1, clientX: 200, clientY: 200 });

    expect(onSelect).toHaveBeenCalledWith('cims-hub', 'scene');
    expect(onSelect).not.toHaveBeenCalledWith('sei', 'scene');
    selection.dispose();
    campus.dispose();
    disposeMaterialPalette(palette);
  });

  it('validates the complete entity catalogue', () => {
    expect(assertLayout(ENTITIES.map((entity) => entity.id))).toEqual([]);
  });

  it('reports a missing supplied layout entity', () => {
    expect(validateLayout(['missing'], LAYOUT_BY_ID)).toEqual(['Missing layout entity: missing']);
  });

  it('reports a non-finite layout coordinate', () => {
    const layout = copyLayout();
    const node = layout.get('shape-memory-alloys')!;
    expect(node).toBeDefined();
    if (!node) return;
    layout.set('shape-memory-alloys', { ...node, position: [Number.NaN, node.position[1], node.position[2]] });
    expect(validateLayout(ENTITIES.map((entity) => entity.id), layout)).toEqual(['Non-finite layout coordinate: shape-memory-alloys']);
  });

  it('reports a duplicate primary layout position', () => {
    const layout = copyLayout();
    const group = layout.get('elastocalorics')!;
    const duplicate = layout.get('smart-textiles')!;
    expect(group).toBeDefined();
    expect(duplicate).toBeDefined();
    if (!group || !duplicate) return;
    layout.set('smart-textiles', { ...duplicate, position: group.position });
    expect(validateLayout(ENTITIES.map((entity) => entity.id), layout)).toEqual(['Duplicate primary layout position: elastocalorics and smart-textiles']);
  });

  it('reports an unequal research-group footprint', () => {
    const layout = copyLayout();
    const node = layout.get('smart-textiles')!;
    expect(node).toBeDefined();
    if (!node) return;
    layout.set('smart-textiles', { ...node, footprint: [11, 7] });
    expect(validateLayout(ENTITIES.map((entity) => entity.id), layout)).toEqual(['Research-group footprint mismatch: smart-textiles']);
  });

  it('reports an unequal research-group focus distance', () => {
    const layout = copyLayout();
    const node = layout.get('shape-memory-alloys')!;
    expect(node).toBeDefined();
    if (!node) return;
    layout.set('shape-memory-alloys', { ...node, focus: { ...node.focus, distance: 14 } });
    expect(validateLayout(ENTITIES.map((entity) => entity.id), layout)).toEqual(['Research-group focus distance mismatch: shape-memory-alloys']);
  });
});
