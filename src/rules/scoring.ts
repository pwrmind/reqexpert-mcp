import type { Requirement } from '../core/schema.js';

export interface ScoringFactor {
  readonly name: string;
  readonly weight: number;
  score(req: Readonly<Requirement>): number; // 0..1
}

const LEVEL: Record<'Высокая' | 'Средняя' | 'Низкая', number> = {
  'Высокая': 1,
  'Средняя': 0.5,
  'Низкая': 0,
};

export const DEFAULT_SCORING_FACTORS: readonly ScoringFactor[] = [
  { name: 'acceptanceCriteria', weight: 4, score: (r) => (r.acceptanceCriteria.trim() ? 1 : 0) },
  { name: 'source',             weight: 2, score: (r) => (r.source.trim() ? 1 : 0) },
  { name: 'description',        weight: 1, score: (r) => (r.description.trim() ? 1 : 0) },
  { name: 'testability',        weight: 2, score: (r) => LEVEL[r.testability] },
  { name: 'stability',          weight: 1, score: (r) => LEVEL[r.stability] },
  { name: 'mustTraceability',   weight: 2, score: (r) => (r.priority !== 'Must' || r.codeRefs.length > 0 ? 1 : 0) },
];

export interface ScoringFactorResult {
  name: string;
  weight: number;
  score: number;
  contribution: number;
}

export interface ScoringBreakdown {
  total: number;
  factors: ScoringFactorResult[];
}

export class QualityScorer {
  constructor(private readonly factors: readonly ScoringFactor[] = DEFAULT_SCORING_FACTORS) {}

  score(req: Readonly<Requirement>): number {
    return this.breakdown(req).total;
  }

  breakdown(req: Readonly<Requirement>): ScoringBreakdown {
    const totalWeight = this.factors.reduce((s, f) => s + f.weight, 0);
    const items = this.factors.map((f) => {
      const score = f.score(req);
      return { name: f.name, weight: f.weight, score, contribution: score * f.weight };
    });
    const got = items.reduce((s, i) => s + i.contribution, 0);
    return {
      total: totalWeight === 0 ? 0 : Math.round((got / totalWeight) * 100),
      factors: items,
    };
  }
}
