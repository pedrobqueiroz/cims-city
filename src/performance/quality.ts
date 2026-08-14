export type QualityTier = 'desktop' | 'mobile';
export type MotionPolicy = 'full' | 'reduced';

export interface GraphicsQualityInput {
  width: number;
  dpr: number;
  coarsePointer: boolean;
}

export interface QualityPolicy {
  tier: QualityTier;
  maxDpr: number;
  shadowSize: 2048 | 1024;
  contextDensity: 1 | 0.55;
  selectionEdges: boolean;
}

export type QualityInput = GraphicsQualityInput & { reducedMotion: boolean };

const TIER_POLICIES: Readonly<Record<QualityTier, Omit<QualityPolicy, 'tier' | 'maxDpr'>>> = {
  desktop: { shadowSize: 2048, contextDensity: 1, selectionEdges: true },
  mobile: { shadowSize: 1024, contextDensity: 0.55, selectionEdges: false },
};

const DPR_CAPS: Readonly<Record<QualityTier, number>> = {
  desktop: 1.5,
  mobile: 1.25,
};

export function selectGraphicsQuality(input: GraphicsQualityInput): QualityPolicy {
  const tier: QualityTier = input.width < 700 || input.coarsePointer ? 'mobile' : 'desktop';

  return {
    tier,
    maxDpr: DPR_CAPS[tier],
    ...TIER_POLICIES[tier],
  };
}

export function selectMotionPolicy(prefersReducedMotion: boolean): MotionPolicy {
  return prefersReducedMotion ? 'reduced' : 'full';
}

export function combinedTier(graphics: QualityPolicy, motion: MotionPolicy): 'desktop' | 'mobile' | 'reduced' {
  return motion === 'reduced' ? 'reduced' : graphics.tier;
}

export function selectQuality(input: QualityInput): QualityPolicy {
  return selectGraphicsQuality(input);
}
