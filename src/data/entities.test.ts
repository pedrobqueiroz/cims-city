import { describe, expect, it } from 'vitest';
import { ENTITY_BY_ID, ENTITY_PRESENTATION, ENTITIES, validateEntities } from './entities';
import { validateEntityPresentation } from './hierarchy';
import type { NeighborhoodEntity } from './schema';

const completeGroup: NeighborhoodEntity = {
  id: 'complete-group',
  category: 'research-group',
  name: 'Complete group',
  leader: 'Leader',
  description: 'A complete research-group description.',
  example: 'A complete research demonstrator example.',
  relationships: [],
  motif: 'thermal',
  detailLevel: 'primary',
  visualWeight: 1,
};

describe('canonical organizational entities', () => {
  it('defines exactly five equal primary research groups', () => {
    const groups = ENTITIES.filter((entity) => entity.category === 'research-group');

    expect(groups.map((entity) => entity.id)).toEqual([
      'elastocalorics',
      'electroactive-polymers',
      'smart-material-electronics',
      'smart-textiles',
      'shape-memory-alloys',
    ]);
    expect(new Set(groups.map((entity) => entity.visualWeight))).toEqual(new Set([1]));
    expect(new Set(groups.map((entity) => entity.detailLevel))).toEqual(new Set(['primary']));
  });

  it('keeps adjacent and external entities out of the five-group line', () => {
    expect(ENTITY_BY_ID.get('soft-robotics-lab')?.category).toBe('adjacent-lab');
    expect(ENTITY_BY_ID.get('uds')?.category).toBe('external-partner');
    expect(ENTITY_BY_ID.get('htw-saar')?.category).toBe('external-partner');
    expect(ENTITY_BY_ID.get('cims-hub')?.relationships)
      .not.toContainEqual({ targetId: 'soft-robotics-lab', kind: 'coordinates' });
  });

  it('has valid unique ids and relationship targets', () => {
    expect(validateEntities(ENTITIES)).toEqual([]);
  });

  it('provides complete valid atlas presentation metadata', () => {
    expect(validateEntityPresentation(ENTITIES, ENTITY_PRESENTATION)).toEqual([]);
  });

  it('reports duplicate entity ids', () => {
    expect(validateEntities([completeGroup, { ...completeGroup }]))
      .toEqual(['Duplicate entity id: complete-group']);
  });

  it('reports relationship targets that are missing', () => {
    expect(validateEntities([
      { ...completeGroup, relationships: [{ targetId: 'missing', kind: 'contains' }] },
    ])).toEqual(['Missing relationship target: complete-group -> missing']);
  });

  it('reports each required research-group field that is incomplete', () => {
    expect(validateEntities([
      { ...completeGroup, leader: '', description: '', example: '', motif: undefined },
    ])).toEqual([
      'Missing required research-group leader: complete-group',
      'Missing required research-group description: complete-group',
      'Missing required research-group example: complete-group',
      'Missing required research-group motif: complete-group',
    ]);
  });

  it('reports a malformed research-group description without throwing', () => {
    const malformedGroup = {
      ...completeGroup,
      description: undefined,
    } as unknown as NeighborhoodEntity;

    expect(() => validateEntities([malformedGroup])).not.toThrow();
    expect(validateEntities([malformedGroup]))
      .toEqual(['Missing required research-group description: complete-group']);
  });

  it('reports research groups without the equal visual weight', () => {
    expect(validateEntities([{ ...completeGroup, visualWeight: 0.6 }]))
      .toEqual(['Research group visual weight must be 1: complete-group']);
  });

  it('reports hub coordination of the adjacent soft-robotics lab', () => {
    const hub: NeighborhoodEntity = {
      id: 'cims-hub',
      category: 'hub',
      name: 'CiMS',
      description: 'Hub',
      relationships: [{ targetId: 'soft-robotics-lab', kind: 'coordinates' }],
      detailLevel: 'primary',
      visualWeight: 1,
    };
    const lab: NeighborhoodEntity = {
      id: 'soft-robotics-lab',
      category: 'adjacent-lab',
      name: 'Soft robotics',
      description: 'Adjacent lab',
      relationships: [],
      detailLevel: 'secondary',
      visualWeight: 0.6,
    };

    expect(validateEntities([hub, lab]))
      .toEqual(['CiMS hub must not coordinate soft-robotics-lab']);
  });
});
