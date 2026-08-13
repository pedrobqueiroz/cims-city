import * as THREE from 'three';

export interface PerspectiveFitInput {
  bounds: THREE.Box3;
  direction: THREE.Vector3;
  verticalFovDegrees: number;
  viewport: { width: number; height: number };
  safeInsets: { top: number; right: number; bottom: number; left: number };
  padding: number;
}

export interface CameraPose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  screenOffset: THREE.Vector2;
}

export function fitPerspectiveView(input: PerspectiveFitInput): CameraPose {
  const { bounds, direction, verticalFovDegrees, viewport, safeInsets, padding } = input;
  const target = bounds.getCenter(new THREE.Vector3());
  const viewDirection = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, viewDirection).normalize();
  const up = new THREE.Vector3().crossVectors(viewDirection, right).normalize();
  const size = bounds.getSize(new THREE.Vector3());
  const halfWidth = (Math.abs(right.x) * size.x + Math.abs(right.y) * size.y + Math.abs(right.z) * size.z) / 2;
  const halfHeight = (Math.abs(up.x) * size.x + Math.abs(up.y) * size.y + Math.abs(up.z) * size.z) / 2;
  const safeWidth = Math.max(1, viewport.width - safeInsets.left - safeInsets.right - 2 * padding);
  const safeHeight = Math.max(1, viewport.height - safeInsets.top - safeInsets.bottom - 2 * padding);
  const tangent = Math.tan((verticalFovDegrees * Math.PI) / 360);
  const distance = Math.max(
    halfWidth * viewport.width / (safeWidth * tangent * (viewport.width / viewport.height)),
    halfHeight * viewport.height / (safeHeight * tangent),
  );
  const screenOffset = new THREE.Vector2(
    (safeInsets.left - safeInsets.right) / viewport.width,
    (safeInsets.bottom - safeInsets.top) / viewport.height,
  );
  const horizontalSpan = distance * tangent * (viewport.width / viewport.height);
  const verticalSpan = distance * tangent;
  target
    .addScaledVector(right, -screenOffset.x * horizontalSpan)
    .addScaledVector(up, -screenOffset.y * verticalSpan);

  return {
    position: target.clone().addScaledVector(viewDirection, distance),
    target,
    distance,
    screenOffset,
  };
}
