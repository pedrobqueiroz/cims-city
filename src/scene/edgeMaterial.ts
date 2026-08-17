import * as THREE from 'three';

export function createEdgeMaterial(color: THREE.Color): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color: color.clone() });
}

export function createEdgeOverlay(
  mesh: THREE.Mesh,
  color: THREE.Color,
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const material = createEdgeMaterial(color);
  const lineSegments = new THREE.LineSegments(edges, material);
  lineSegments.name = `edge:${mesh.name}`;
  return lineSegments;
}
