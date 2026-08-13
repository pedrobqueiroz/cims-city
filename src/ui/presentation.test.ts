import { describe, expect, it } from 'vitest';
import { initialNeighborhoodState, reduceNeighborhoodState } from '../application/state';
import { ENTITIES, ENTITY_PRESENTATION } from '../data/entities';
import type { NeighborhoodEntity } from '../data/schema';
import {
  CATEGORY_LABELS,
  ROUTE_LEGEND_COPY,
  createAtlasViewModel,
} from './presentation';

function cimsState(selectedId: string | null = null) {
  let state = reduceNeighborhoodState(initialNeighborhoodState(), { type: 'ENTER_SCOPE', scopeId: 'cims' });
  if (selectedId) state = reduceNeighborhoodState(state, { type: 'SELECT_ENTITY', entityId: selectedId });
  return state;
}

describe('atlas presentation', () => {
  it('derives scope-aware categorized navigation and orientation from canonical entities', () => {
    const overview = createAtlasViewModel(initialNeighborhoodState(), ENTITIES, ENTITY_PRESENTATION);
    expect(overview.breadcrumbs.map((item) => item.label)).toEqual(['SEi']);
    expect(overview.categories.map((category) => category.label)).toEqual([
      'Institutional Umbrella',
      'CiMS Hub',
      'SEi Pillars',
      'External Partners',
    ]);
    expect(overview.categories.flatMap((category) => category.items).map((item) => item.id)).toEqual([
      'sei', 'cims-hub', 'hycatt', 'new-zema', 'uds', 'htw-saar',
    ]);
    expect(overview.categories.flatMap((category) => category.items).find((item) => item.id === 'cims-hub'))
      .toMatchObject({ label: 'CiMS', scopeAction: 'cims' });
  });

  it('keeps SEi and CiMS in selected-entity breadcrumbs and preserves full institutional copy', () => {
    const viewModel = createAtlasViewModel(cimsState('smart-textiles'), ENTITIES, ENTITY_PRESENTATION);
    expect(viewModel.breadcrumbs.map((item) => item.label)).toEqual(['SEi', 'CiMS', 'Smart Textiles']);
    expect(viewModel.breadcrumbs.at(-1)?.current).toBe(true);
    expect(viewModel.selected).toMatchObject({
      id: 'smart-textiles',
      name: 'Smart Textiles',
      leader: 'Sebastian Gratz-Kelly',
      description: 'Integrating smart-material sensing and actuation into textiles and flexible structures.',
      example: 'A wearable textile structure that senses movement and provides feedback.',
    });
  });

  it('uses canonical entity names and inverse language for incoming directed relationships', () => {
    const viewModel = createAtlasViewModel(cimsState('smart-textiles'), ENTITIES, ENTITY_PRESENTATION);
    const groups = viewModel.selected?.relationshipGroups;
    const relationshipText = viewModel.selected?.relationshipGroups
      .flatMap((group) => group.items)
      .map((relationship) => relationship.text);

    expect(groups?.map((group) => group.label)).toEqual([
      'Institutional Containment',
      'Scientific Coordination',
    ]);
    expect(relationshipText).toEqual(expect.arrayContaining([
      'Contained by — CiMS — Center for Intelligent Material Systems',
      'Coordinated by — CiMS — Center for Intelligent Material Systems',
    ]));
    expect(relationshipText).not.toContain('Contains — CiMS — Center for Intelligent Material Systems');
    expect(relationshipText).not.toContain('Coordinates — CiMS — Center for Intelligent Material Systems');
  });

  it('exposes all 16 canonical relationships and all 14 incident CiMS relationships once', () => {
    const overview = createAtlasViewModel(initialNeighborhoodState(), ENTITIES, ENTITY_PRESENTATION);
    const cims = createAtlasViewModel(cimsState('cims-hub'), ENTITIES, ENTITY_PRESENTATION);
    expect(overview.relationships).toHaveLength(16);
    expect(cims.selected?.relationshipGroups.flatMap((group) => group.items)).toHaveLength(14);
    expect(cims.selected?.relationshipGroups.map((group) => group.label)).toEqual([
      'Institutional Containment', 'Scientific Coordination', 'Spatial Adjacency', 'Research Collaboration',
    ]);
    expect(cims.selected?.relationshipGroups.flatMap((group) => group.items).map((item) => item.text))
      .toContain('Contains — Smart Textiles');
  });

  it('omits empty relationship groups instead of rendering empty lists', () => {
    const isolated: NeighborhoodEntity = {
      id: 'isolated',
      category: 'sei-pillar',
      name: 'Independent institute',
      description: 'No represented connections.',
      relationships: [],
      detailLevel: 'context',
      visualWeight: 0.35,
    };
    const viewModel = createAtlasViewModel(
      { ...initialNeighborhoodState(), selectedId: 'isolated' },
      [isolated],
      new Map([['isolated', { slug: 'isolated', scopeId: 'sei' as const, visualRole: 'city' as const }]]),
    );
    expect(viewModel.selected?.relationshipGroups).toEqual([]);
  });

  it('owns the institutional category and route-legend language', () => {
    expect(CATEGORY_LABELS['research-group']).toBe('Research Groups');
    expect(ROUTE_LEGEND_COPY.map((entry) => entry.label)).toEqual([
      'Institutional Containment', 'Scientific Coordination', 'Spatial Adjacency', 'Research Collaboration',
    ]);
  });
});
