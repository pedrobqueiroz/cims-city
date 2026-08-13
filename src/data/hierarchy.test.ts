import { describe, expect, it } from 'vitest';
import { ENTITIES } from './entities';
import { buildContainmentGraph, validateEntityPresentation } from './hierarchy';
import type { EntityPresentation, NeighborhoodEntity, Relationship } from './schema';

function entity(id: string, relationships: Relationship[] = []): NeighborhoodEntity {
  return {
    id,
    category: 'umbrella',
    name: id,
    description: 'Entity description',
    relationships,
    detailLevel: 'context',
    visualWeight: 0.35,
  };
}

function presentation(
  slug: string,
  scopeId: 'sei' | 'cims',
  visualRole: 'land' | 'city' | 'neighborhood' | 'satellite',
): EntityPresentation {
  return { slug, scopeId, visualRole };
}

const contains = (targetId: string): Relationship => ({ targetId, kind: 'contains' });
const presentationEntities = [entity('sei'), entity('cims-hub')];
const validPresentation = new Map<string, EntityPresentation>([
  ['sei', presentation('sei', 'sei', 'land')],
  ['cims-hub', presentation('cims', 'cims', 'city')],
]);

describe('containment graph', () => {
  it('builds SEi land with CiMS and CiMS research neighborhoods', () => {
    const graph = buildContainmentGraph(ENTITIES);

    expect(graph.childrenOf('sei')).toEqual(['cims-hub', 'hycatt', 'new-zema']);
    expect(graph.childrenOf('cims-hub')).toEqual([
      'elastocalorics',
      'electroactive-polymers',
      'smart-material-electronics',
      'smart-textiles',
      'shape-memory-alloys',
    ]);
    expect(graph.ancestorsOf('smart-textiles')).toEqual(['cims-hub', 'sei']);
  });

  it('returns empty ancestry and children for uncontained or unknown entities', () => {
    const graph = buildContainmentGraph(ENTITIES);

    expect(graph.ancestorsOf('sei')).toEqual([]);
    expect(graph.childrenOf('uds')).toEqual([]);
    expect(graph.childrenOf('unknown')).toEqual([]);
  });

  it('rejects containment cycles', () => {
    const cyclicEntities = [
      entity('first', [contains('second')]),
      entity('second', [contains('first')]),
    ];

    expect(() => buildContainmentGraph(cyclicEntities)).toThrow('Containment cycle');
  });

  it('rejects containment targets that are missing', () => {
    expect(() => buildContainmentGraph([entity('parent', [contains('missing')])]))
      .toThrow('Missing containment target: parent -> missing');
  });

  it('rejects children with duplicate containment parents', () => {
    expect(() => buildContainmentGraph([
      entity('first', [contains('child')]),
      entity('second', [contains('child')]),
      entity('child'),
    ])).toThrow('Duplicate containment parent: child');
  });

  it('rejects self-containment', () => {
    expect(() => buildContainmentGraph([entity('self', [contains('self')])]))
      .toThrow('Self-containment: self');
  });
});

describe('entity presentation validation', () => {
  it('accepts complete metadata with one land role', () => {
    expect(validateEntityPresentation(presentationEntities, validPresentation)).toEqual([]);
  });

  it('reports missing and extra metadata entries', () => {
    const metadata = new Map(validPresentation);
    metadata.delete('cims-hub');
    metadata.set('extra', presentation('extra', 'sei', 'satellite'));

    expect(validateEntityPresentation(presentationEntities, metadata)).toEqual([
      'Missing presentation entry: cims-hub',
      'Extra presentation entry: extra',
    ]);
  });

  it('reports duplicate presentation slugs', () => {
    const metadata = new Map(validPresentation);
    metadata.set('cims-hub', presentation('sei', 'cims', 'city'));

    expect(validateEntityPresentation(presentationEntities, metadata))
      .toEqual(['Duplicate presentation slug: sei']);
  });

  it('reports invalid scope ids supplied at runtime', () => {
    const metadata = new Map(validPresentation);
    metadata.set('cims-hub', { ...presentation('cims', 'cims', 'city'), scopeId: 'invalid' } as unknown as EntityPresentation);

    expect(validateEntityPresentation(presentationEntities, metadata))
      .toEqual(['Invalid atlas scope id: cims-hub -> invalid']);
  });

  it('requires exactly one land role', () => {
    const metadata = new Map(validPresentation);
    metadata.set('cims-hub', presentation('cims', 'cims', 'land'));

    expect(validateEntityPresentation(presentationEntities, metadata))
      .toEqual(['Expected exactly one land presentation, found 2']);
  });
});
