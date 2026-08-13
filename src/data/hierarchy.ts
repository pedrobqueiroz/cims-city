import type { EntityPresentation, NeighborhoodEntity } from './schema';

export interface ContainmentGraph {
  ancestorsOf(id: string): readonly string[];
  childrenOf(id: string): readonly string[];
}

export function buildContainmentGraph(entities: readonly NeighborhoodEntity[]): ContainmentGraph {
  const entityIds = new Set<string>();
  const childrenById = new Map<string, string[]>();
  const parentById = new Map<string, string>();

  for (const entity of entities) {
    if (entityIds.has(entity.id)) throw new Error(`Duplicate entity id: ${entity.id}`);
    entityIds.add(entity.id);
    childrenById.set(entity.id, []);
  }

  for (const entity of entities) {
    for (const relationship of entity.relationships) {
      if (relationship.kind !== 'contains') continue;
      if (!entityIds.has(relationship.targetId)) {
        throw new Error(`Missing containment target: ${entity.id} -> ${relationship.targetId}`);
      }
      if (entity.id === relationship.targetId) {
        throw new Error(`Self-containment: ${entity.id}`);
      }
      if (parentById.has(relationship.targetId)) {
        throw new Error(`Duplicate containment parent: ${relationship.targetId}`);
      }

      parentById.set(relationship.targetId, entity.id);
      childrenById.get(entity.id)?.push(relationship.targetId);
    }
  }

  for (const id of entityIds) {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      if (visited.has(current)) throw new Error(`Containment cycle: ${current}`);
      visited.add(current);
      current = parentById.get(current);
    }
  }

  return {
    childrenOf(id) {
      return [...(childrenById.get(id) ?? [])];
    },
    ancestorsOf(id) {
      const ancestors: string[] = [];
      let parent = parentById.get(id);
      while (parent) {
        ancestors.push(parent);
        parent = parentById.get(parent);
      }
      return ancestors;
    },
  };
}

export function validateEntityPresentation(
  entities: readonly NeighborhoodEntity[],
  metadata: ReadonlyMap<string, EntityPresentation>,
): string[] {
  const errors: string[] = [];
  const entityIds = new Set(entities.map((entity) => entity.id));
  const slugs = new Set<string>();
  let landCount = 0;

  for (const entity of entities) {
    if (!metadata.has(entity.id)) errors.push(`Missing presentation entry: ${entity.id}`);
  }

  for (const [id, presentation] of metadata) {
    if (!entityIds.has(id)) errors.push(`Extra presentation entry: ${id}`);
    if (presentation.scopeId !== 'sei' && presentation.scopeId !== 'cims') {
      errors.push(`Invalid atlas scope id: ${id} -> ${presentation.scopeId}`);
    }
    if (slugs.has(presentation.slug)) errors.push(`Duplicate presentation slug: ${presentation.slug}`);
    slugs.add(presentation.slug);
    if (presentation.visualRole === 'land') landCount += 1;
  }

  if (landCount !== 1) errors.push(`Expected exactly one land presentation, found ${landCount}`);
  return errors;
}
