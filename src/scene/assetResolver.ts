import * as THREE from 'three';

export interface VisualRequest {
  entityId: string;
  procedural: () => THREE.Object3D;
  replacement?: () => Promise<THREE.Object3D>;
}

export interface ResolvedVisual {
  object: THREE.Object3D;
  source: 'procedural' | 'replacement';
  warning?: string;
}

export async function resolveEntityVisual(request: VisualRequest): Promise<ResolvedVisual> {
  if (typeof request.entityId !== 'string' || request.entityId.trim() === '') {
    throw new TypeError('entityId must be a nonblank string.');
  }

  if (!request.replacement) return resolveProcedural(request);

  try {
    const replacement = await request.replacement();
    if (!isObject3D(replacement)) {
      return resolveFallback(request, 'replacement did not return an Object3D');
    }

    nameIfEmpty(replacement, `replacement:${request.entityId}`);
    return { object: replacement, source: 'replacement' };
  } catch (reason) {
    return resolveFallback(request, normalizeReplacementReason(reason));
  }
}

function resolveFallback(request: VisualRequest, reason: string): ResolvedVisual {
  const object = resolveProcedural(request).object;
  return {
    object,
    source: 'procedural',
    warning: `Visual replacement unavailable for ${request.entityId}: ${reason}`,
  };
}

function resolveProcedural(request: VisualRequest): ResolvedVisual {
  const object = request.procedural();
  if (!isObject3D(object)) throw new TypeError('procedural did not return an Object3D');

  nameIfEmpty(object, `procedural:${request.entityId}`);
  return { object, source: 'procedural' };
}

function isObject3D(value: unknown): value is THREE.Object3D {
  return value instanceof THREE.Object3D;
}

function nameIfEmpty(object: THREE.Object3D, name: string): void {
  if (object.name === '') object.name = name;
}

function normalizeReplacementReason(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  return String(reason);
}
