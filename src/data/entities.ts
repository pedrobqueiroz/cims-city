import type { EntityPresentation, NeighborhoodEntity } from './schema';

export function validateEntities(_entities: readonly NeighborhoodEntity[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const entity of _entities) { if (ids.has(entity.id)) errors.push(`Duplicate entity id: ${entity.id}`); ids.add(entity.id); }
  for (const entity of _entities) {
    for (const relationship of entity.relationships) {
      if (!ids.has(relationship.targetId)) errors.push(`Missing relationship target: ${entity.id} -> ${relationship.targetId}`);
      if (entity.id === 'cims-hub' && relationship.targetId === 'soft-robotics-lab' && relationship.kind === 'coordinates') errors.push('CiMS hub must not coordinate soft-robotics-lab');
    }
    if (entity.category === 'research-group') {
      if (!hasText(entity.leader)) errors.push(`Missing required research-group leader: ${entity.id}`);
      if (!hasText(entity.description)) errors.push(`Missing required research-group description: ${entity.id}`);
      if (!hasText(entity.example)) errors.push(`Missing required research-group example: ${entity.id}`);
      if (!entity.motif) errors.push(`Missing required research-group motif: ${entity.id}`);
      if (entity.visualWeight !== 1) errors.push(`Research group visual weight must be 1: ${entity.id}`);
    }
  }
  return errors;
}

function hasText(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }

export const ENTITIES: readonly NeighborhoodEntity[] = [
  { id: 'sei', category: 'umbrella', name: 'SEi — Saarland Engineering Institute', leader: 'Prof. Dr. Susan Pulham and Prof. Dr.-Ing. Paul Motzki', description: 'Institutional umbrella for CiMS and its SEi pillars.', relationships: [{ targetId: 'cims-hub', kind: 'contains' }, { targetId: 'hycatt', kind: 'contains' }, { targetId: 'new-zema', kind: 'contains' }], detailLevel: 'context', visualWeight: 0.35 },
  {
    id: 'cims-hub',
    category: 'hub',
    name: 'CiMS — Center for Intelligent Material Systems',
    leader: 'Prof. Dr.-Ing. Paul Motzki · Dr.-Ing. Sophie Nalbach',
    description: 'Paul provides CiMS’s overall scientific and institutional direction; Sophie leads its managing and operational coordination.',
    relationships: [
      { targetId: 'elastocalorics', kind: 'contains' },
      { targetId: 'electroactive-polymers', kind: 'contains' },
      { targetId: 'smart-material-electronics', kind: 'contains' },
      { targetId: 'smart-textiles', kind: 'contains' },
      { targetId: 'shape-memory-alloys', kind: 'contains' },
      { targetId: 'elastocalorics', kind: 'coordinates' },
      { targetId: 'electroactive-polymers', kind: 'coordinates' },
      { targetId: 'smart-material-electronics', kind: 'coordinates' },
      { targetId: 'smart-textiles', kind: 'coordinates' },
      { targetId: 'shape-memory-alloys', kind: 'coordinates' },
      { targetId: 'soft-robotics-lab', kind: 'adjacent' },
      { targetId: 'uds', kind: 'collaborates' },
      { targetId: 'htw-saar', kind: 'collaborates' },
    ],
    detailLevel: 'primary',
    visualWeight: 1,
  },
  { id: 'elastocalorics', category: 'research-group', name: 'Elastocalorics', leader: 'Franziska Louia', description: 'Heating and cooling through the mechanical loading and unloading of superelastic materials.', example: 'A compact solid-state cooling demonstrator based on shape-memory-alloy cycles.', relationships: [], motif: 'thermal', detailLevel: 'primary', visualWeight: 1 },
  { id: 'electroactive-polymers', category: 'research-group', name: 'Electroactive Polymers', leader: 'Dr.-Ing. Daniel Bruch', description: 'Polymer actuators and sensors that respond to electrical input.', example: 'A dielectric-elastomer actuator with integrated self-sensing.', relationships: [], motif: 'polymer', detailLevel: 'primary', visualWeight: 1 },
  { id: 'smart-material-electronics', category: 'research-group', name: 'Smart Material Electronics', leader: 'Dr.-Ing. Carmen Perri', description: 'Compact electronics for powering, measuring, and controlling smart-material systems.', example: 'An embedded control and measurement module for a smart-material demonstrator.', relationships: [], motif: 'electronics', detailLevel: 'primary', visualWeight: 1 },
  { id: 'smart-textiles', category: 'research-group', name: 'Smart Textiles', leader: 'Sebastian Gratz-Kelly', description: 'Integrating smart-material sensing and actuation into textiles and flexible structures.', example: 'A wearable textile structure that senses movement and provides feedback.', relationships: [], motif: 'textile', detailLevel: 'primary', visualWeight: 1 },
  { id: 'shape-memory-alloys', category: 'research-group', name: 'Shape-Memory Alloys', leader: 'Tom Gorges', description: 'Compact actuator and sensor systems based on shape-memory-alloy behavior.', example: 'A self-sensing nickel-titanium gripping mechanism.', relationships: [], motif: 'sma', detailLevel: 'primary', visualWeight: 1 },
  { id: 'soft-robotics-lab', category: 'adjacent-lab', name: 'Soft Robotic Systems and Control Lab / APS', leader: 'Prof. Dr. Gianluca Rizzello', description: 'Adjacent lab to CiMS.', relationships: [{ targetId: 'cims-hub', kind: 'adjacent' }], motif: 'soft-robotics', detailLevel: 'secondary', visualWeight: 0.6 },
  { id: 'hycatt', category: 'sei-pillar', name: 'HyCATT — Hydrogen Center for Applied Technologies and Transformation', description: 'SEi pillar with no internal entities represented here.', relationships: [], detailLevel: 'context', visualWeight: 0.35 },
  { id: 'new-zema', category: 'sei-pillar', name: 'New ZeMA pillar', description: 'SEi pillar; exact long name and remit pending.', relationships: [], detailLevel: 'context', visualWeight: 0.35 },
  { id: 'uds', category: 'external-partner', name: 'Universität des Saarlandes (UdS)', description: 'External partner to CiMS.', relationships: [{ targetId: 'cims-hub', kind: 'collaborates' }], detailLevel: 'context', visualWeight: 0.35 },
  { id: 'htw-saar', category: 'external-partner', name: 'htw saar', description: 'External partner to CiMS.', relationships: [{ targetId: 'cims-hub', kind: 'collaborates' }], detailLevel: 'context', visualWeight: 0.35 },
];

export const ENTITY_BY_ID: ReadonlyMap<string, NeighborhoodEntity> = new Map(ENTITIES.map((entity) => [entity.id, entity]));

export const ENTITY_PRESENTATION: ReadonlyMap<string, EntityPresentation> = new Map([
  ['sei', { slug: 'sei', scopeId: 'sei', visualRole: 'land' }],
  ['cims-hub', { slug: 'cims', scopeId: 'cims', visualRole: 'city' }],
  ['elastocalorics', { slug: 'elastocalorics', scopeId: 'cims', visualRole: 'neighborhood' }],
  ['electroactive-polymers', { slug: 'electroactive-polymers', scopeId: 'cims', visualRole: 'neighborhood' }],
  ['smart-material-electronics', { slug: 'smart-material-electronics', scopeId: 'cims', visualRole: 'neighborhood' }],
  ['smart-textiles', { slug: 'smart-textiles', scopeId: 'cims', visualRole: 'neighborhood' }],
  ['shape-memory-alloys', { slug: 'shape-memory-alloys', scopeId: 'cims', visualRole: 'neighborhood' }],
  ['soft-robotics-lab', { slug: 'soft-robotics-lab', scopeId: 'cims', visualRole: 'satellite' }],
  ['hycatt', { slug: 'hycatt', scopeId: 'sei', visualRole: 'city' }],
  ['new-zema', { slug: 'new-zema', scopeId: 'sei', visualRole: 'city' }],
  ['uds', { slug: 'uds', scopeId: 'sei', visualRole: 'satellite' }],
  ['htw-saar', { slug: 'htw-saar', scopeId: 'sei', visualRole: 'satellite' }],
]);
