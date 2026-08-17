import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ENTITIES, ENTITY_PRESENTATION } from '../data/entities';
import type { NeighborhoodEntity } from '../data/schema';
import { LAYOUT_BY_ID } from '../scene/layout';
import { createLabelLayer, type LabelLayerOptions } from './labels';

function entity(id: string, category: NeighborhoodEntity['category'], name = id): NeighborhoodEntity {
  return {
    id,
    category,
    name,
    description: `${name} description`,
    relationships: [],
    detailLevel: category === 'research-group' || category === 'hub' ? 'primary' : 'context',
    visualWeight: category === 'research-group' || category === 'hub' ? 1 : 0.35,
  };
}

function harness(
  entities: readonly NeighborhoodEntity[],
  positions: Readonly<Record<string, readonly [number, number, number]>>,
  options: LabelLayerOptions = {},
) {
  const container = document.createElement('div');
  document.body.append(container);
  const anchors = new Map<string, THREE.Object3D>();
  for (const item of entities) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...positions[item.id]!);
    anchor.updateMatrixWorld(true);
    anchors.set(item.id, anchor);
  }
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const onSelect = vi.fn();
  const layer = createLabelLayer(container, entities, anchors, camera, {
    onSelect,
    measureLabel: () => ({ width: 80, height: 32 }),
    ...options,
  });
  return { container, layer, onSelect, camera };
}

function label(container: HTMLElement, id: string): HTMLButtonElement {
  const result = container.querySelector<HTMLButtonElement>(`button[data-label-id="${id}"]`);
  if (!result) throw new Error(`Missing label: ${id}`);
  return result;
}

function canonicalLabelHarness() {
  const positions = Object.fromEntries(
    [...LAYOUT_BY_ID].map(([id, node]) => [id, node.position]),
  ) as Readonly<Record<string, readonly [number, number, number]>>;
  const result = harness(ENTITIES, positions, { presentation: ENTITY_PRESENTATION });
  result.camera.position.set(0, 150, 200);
  result.camera.lookAt(0, 0, 0);
  result.camera.far = 500;
  result.camera.fov = 50;
  result.camera.updateProjectionMatrix();
  result.camera.updateMatrixWorld(true);
  return result;
}

function visibleIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[data-label-id]')]
    .filter((button) => !button.hidden)
    .map((button) => button.dataset.labelId!);
}

describe('createLabelLayer', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('projects front-facing labels and hides anchors behind the camera or outside the NDC frustum', () => {
    const entities = [entity('front', 'hub'), entity('behind', 'hub'), entity('outside', 'hub')];
    const { container, layer } = harness(entities, {
      front: [0, 0, 0],
      behind: [0, 0, 20],
      outside: [100, 0, 0],
    });
    layer.update(800, 600, null);
    expect(label(container, 'front').hidden).toBe(false);
    expect(label(container, 'front').style.transform).toContain('translate3d(400px, 300px, 0)');
    expect(label(container, 'behind').hidden).toBe(true);
    expect(label(container, 'outside').hidden).toBe(true);
  });

  it('mutates the existing label to its portrait alias before measurement while preserving its accessible name', () => {
    const smartTextiles = entity('smart-textiles', 'research-group', 'Smart Textiles');
    const measuredText: Array<string | null> = [];
    const { container, layer, onSelect } = harness(
      [smartTextiles],
      { 'smart-textiles': [0, 0, 0] },
      {
        portraitText: { 'smart-textiles': 'Textiles' },
        measureLabel: (button) => {
          measuredText.push(button.textContent);
          return { width: 80, height: 32 };
        },
      },
    );
    const mountedButton = label(container, 'smart-textiles');

    layer.update(800, 600, null);
    expect(mountedButton.textContent).toBe('Smart Textiles');

    layer.update(390, 844, 'smart-textiles');
    expect(label(container, 'smart-textiles')).toBe(mountedButton);
    expect(mountedButton.textContent).toBe('Textiles');
    expect(measuredText.at(-1)).toBe('Textiles');
    expect(mountedButton.getAttribute('aria-label')).toBe('View Smart Textiles');
    expect(mountedButton.dataset.selected).toBe('true');
    mountedButton.click();
    expect(onSelect).toHaveBeenLastCalledWith('smart-textiles');

    layer.update(800, 600, 'smart-textiles');
    expect(mountedButton.textContent).toBe('Smart Textiles');
    expect(label(container, 'smart-textiles')).toBe(mountedButton);
  });

  it('gives selected labels collision priority and keeps them visible in the frustum', () => {
    const entities = [entity('first', 'research-group'), entity('selected', 'external-partner')];
    const { container, layer } = harness(entities, { first: [0, 0, 0], selected: [0, 0, 0] });
    layer.update(800, 600, 'selected');
    expect(label(container, 'selected').hidden).toBe(false);
    expect(label(container, 'selected').dataset.selected).toBe('true');
    expect(label(container, 'first').hidden).toBe(true);
  });

  it('resolves equal-priority collisions by entity input order', () => {
    const entities = [entity('first', 'research-group'), entity('second', 'research-group')];
    const { container, layer } = harness(entities, { first: [0, 0, 0], second: [0, 0, 0] });
    layer.update(800, 600, null);
    expect(label(container, 'first').hidden).toBe(false);
    expect(label(container, 'second').hidden).toBe(true);
  });

  it('suppresses labels that collide only after the required 12px rectangle expansion', () => {
    const entities = [entity('first', 'research-group'), entity('threshold', 'research-group')];
    const { container, layer } = harness(entities, { first: [0, 0, 0], threshold: [1.4, 0, 0] });
    layer.update(800, 600, null);

    expect(label(container, 'first').hidden).toBe(false);
    expect(label(container, 'threshold').hidden).toBe(true);
  });

  it.each([
    ['adjacent-lab', 'adjacent'] as const,
    ['sei-pillar', 'pillar'] as const,
  ])('prioritizes %s labels over context labels even when context comes first', (category, tierTwoId) => {
    const entities = [entity('context', 'external-partner'), entity(tierTwoId, category)];
    const { container, layer } = harness(entities, { context: [0, 0, 0], [tierTwoId]: [0, 0, 0] });
    layer.update(800, 600, null);

    expect(label(container, tierTwoId).hidden).toBe(false);
    expect(label(container, 'context').hidden).toBe(true);
  });

  it('uses input order to resolve collisions within priority tier 2', () => {
    const entities = [entity('pillar', 'sei-pillar'), entity('adjacent', 'adjacent-lab')];
    const { container, layer } = harness(entities, { pillar: [0, 0, 0], adjacent: [0, 0, 0] });
    layer.update(800, 600, null);

    expect(label(container, 'pillar').hidden).toBe(false);
    expect(label(container, 'adjacent').hidden).toBe(true);
  });

  it('prioritizes an unselected research group over tier 2 and context labels', () => {
    const entities = [
      entity('umbrella', 'umbrella'),
      entity('external', 'external-partner'),
      entity('pillar', 'sei-pillar'),
      entity('adjacent', 'adjacent-lab'),
      entity('research', 'research-group'),
    ];
    const positions = Object.fromEntries(entities.map((item) => [item.id, [0, 0, 0] as const]));
    const { container, layer } = harness(entities, positions);
    layer.update(800, 600, null);

    expect(label(container, 'research').hidden).toBe(false);
    expect(label(container, 'adjacent').hidden).toBe(true);
    expect(label(container, 'pillar').hidden).toBe(true);
    expect(label(container, 'external').hidden).toBe(true);
    expect(label(container, 'umbrella').hidden).toBe(true);
  });

  it('prioritizes research groups and hubs over adjacent labs, pillars, and context labels', () => {
    const entities = [
      entity('context', 'external-partner'),
      entity('pillar', 'sei-pillar'),
      entity('adjacent', 'adjacent-lab'),
      entity('hub', 'hub'),
    ];
    const positions = Object.fromEntries(entities.map((item) => [item.id, [0, 0, 0] as const]));
    const { container, layer } = harness(entities, positions);
    layer.update(800, 600, null);
    expect(label(container, 'hub').hidden).toBe(false);
    expect(label(container, 'adjacent').hidden).toBe(true);
    expect(label(container, 'pillar').hidden).toBe(true);
    expect(label(container, 'context').hidden).toBe(true);
  });

  it('synchronizes selected data state across updates', () => {
    const entities = [entity('one', 'hub'), entity('two', 'hub')];
    const { container, layer } = harness(entities, { one: [-2, 0, 0], two: [2, 0, 0] });
    layer.update(800, 600, 'one');
    expect(label(container, 'one').dataset.selected).toBe('true');
    expect(label(container, 'two').dataset.selected).toBe('false');
    layer.update(800, 600, 'two');
    expect(label(container, 'one').dataset.selected).toBe('false');
    expect(label(container, 'two').dataset.selected).toBe('true');
  });

  it('exposes aria-current on the selected label for screen readers', () => {
    const entities = [entity('one', 'hub'), entity('two', 'hub')];
    const { container, layer } = harness(entities, { one: [-2, 0, 0], two: [2, 0, 0] });
    layer.update(800, 600, 'one');
    expect(label(container, 'one').getAttribute('aria-current')).toBe('true');
    expect(label(container, 'two').hasAttribute('aria-current')).toBe(false);
    layer.update(800, 600, 'two');
    expect(label(container, 'one').hasAttribute('aria-current')).toBe(false);
    expect(label(container, 'two').getAttribute('aria-current')).toBe('true');
  });

  it('routes label button activation to selection', () => {
    const entities = [entity('select-me', 'hub', 'Select me')];
    const { container, onSelect } = harness(entities, { 'select-me': [0, 0, 0] });
    label(container, 'select-me').click();
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('select-me');
  });

  it('shows district labels at SEi overview and research labels only inside CiMS', () => {
    const { layer, container } = canonicalLabelHarness();
    layer.update({
      width: 2000, height: 1200, scopeId: 'sei', selectedId: null, previewId: null,
      safeRectangles: [], maxVisible: 15,
    });
    const visible = visibleIds(container);
    // At least cims-hub and hycatt should be visible
    expect(visible).toEqual(expect.arrayContaining(['cims-hub', 'hycatt']));
    expect(label(container, 'smart-textiles').hidden).toBe(true);

    layer.update({
      width: 2000, height: 1200, scopeId: 'cims', selectedId: null, previewId: null,
      safeRectangles: [], maxVisible: 15,
    });
    expect(label(container, 'smart-textiles').hidden).toBe(false);
  });

  it('limits SEi overview labels to six while retaining the selected label', () => {
    const { layer, container } = canonicalLabelHarness();
    layer.update({
      width: 1200, height: 800, scopeId: 'sei', selectedId: 'smart-textiles', previewId: null,
      safeRectangles: [], maxVisible: 6,
    });

    expect(visibleIds(container).length).toBeLessThanOrEqual(6);
    expect(label(container, 'smart-textiles').hidden).toBe(false);
    expect(label(container, 'smart-textiles').dataset.selected).toBe('true');
  });

  it('excludes labels in reserved UI rectangles and clamps accepted labels to the viewport', () => {
    const entities = [entity('reserved', 'hub'), entity('edge', 'hub')];
    const presentation = new Map([
      ['reserved', { slug: 'reserved', scopeId: 'sei' as const, visualRole: 'city' as const }],
      ['edge', { slug: 'edge', scopeId: 'sei' as const, visualRole: 'city' as const }],
    ]);
    const { layer, container } = harness(entities, { reserved: [0, 0, 0], edge: [5.6, 0, 0] }, { presentation });

    layer.update({
      width: 800, height: 600, scopeId: 'sei', selectedId: null, previewId: null,
      safeRectangles: [{ left: 350, top: 250, right: 450, bottom: 350 }], maxVisible: 6,
    });
    expect(label(container, 'reserved').hidden).toBe(true);
    expect(label(container, 'edge').hidden).toBe(false);
    expect(label(container, 'edge').style.transform).toContain('translate3d(760px,');
  });

  it('caches measurements by label text and viewport class across camera-only updates', () => {
    const measureLabel = vi.fn(() => ({ width: 80, height: 32 }));
    const presentation = new Map([
      ['one', { slug: 'one', scopeId: 'sei' as const, visualRole: 'city' as const }],
    ]);
    const { layer, camera } = harness([entity('one', 'hub')], { one: [0, 0, 0] }, { presentation, measureLabel });
    const view = {
      width: 800, height: 600, scopeId: 'sei' as const, selectedId: null, previewId: null,
      safeRectangles: [], maxVisible: 6,
    };

    layer.update(view);
    camera.position.x = 1;
    camera.updateMatrixWorld(true);
    layer.update(view);

    expect(measureLabel).toHaveBeenCalledTimes(1);
  });

  it('dispose removes every owned label', () => {
    const entities = [entity('one', 'hub'), entity('two', 'research-group')];
    const { container, layer } = harness(entities, { one: [-2, 0, 0], two: [2, 0, 0] });
    layer.dispose();
    expect(container.children).toHaveLength(0);
  });
});
