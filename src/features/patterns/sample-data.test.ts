import { describe, expect, it } from 'vitest';

import { analyzeFactorPatterns } from './engine';
import { SYNTHETIC_SAMPLE_HISTORY } from './sample-data';
import type { FactorPattern } from './types';

describe('synthetic sample history', () => {
  it('is clearly labeled and spans 18 days of sample-only records', () => {
    expect(SYNTHETIC_SAMPLE_HISTORY.metadata.source).toBe('sample');
    expect(SYNTHETIC_SAMPLE_HISTORY.metadata.dayCount).toBe(18);
    expect(SYNTHETIC_SAMPLE_HISTORY.metadata.disclaimer).toContain('not your records');
    expect(SYNTHETIC_SAMPLE_HISTORY.meals).toHaveLength(18);
    expect(SYNTHETIC_SAMPLE_HISTORY.dailyContext).toHaveLength(18);
    expect(SYNTHETIC_SAMPLE_HISTORY.meals.every(({ source }) => source === 'sample')).toBe(true);
    expect(
      SYNTHETIC_SAMPLE_HISTORY.symptomEvents.every(({ source }) => source === 'sample'),
    ).toBe(true);
  });

  it('produces two early possible patterns and one insufficient-evidence factor', () => {
    const patterns = analyzeFactorPatterns({
      source: 'sample',
      factors: SYNTHETIC_SAMPLE_HISTORY.factors,
      meals: SYNTHETIC_SAMPLE_HISTORY.meals,
      symptomEvents: SYNTHETIC_SAMPLE_HISTORY.symptomEvents,
      config: { windowHours: 12 },
    });
    const dairy = requirePattern(patterns, 'dairy');
    const highFat = requirePattern(patterns, 'high-fat');
    const caffeine = requirePattern(patterns, 'caffeine');

    expect(dairy.evidenceLabel).toBe('Early pattern');
    expect(dairy.direction).toBe('more-often-followed-by');
    expect(dairy.exposed.symptomCount).toBe(6);
    expect(dairy.exposed.counterexampleCount).toBe(2);
    expect(dairy.exposed.smoothedRate).toBeGreaterThan(dairy.baseline.smoothedRate);

    expect(highFat.evidenceLabel).toBe('Early pattern');
    expect(highFat.direction).toBe('more-often-followed-by');
    expect(highFat.exposed.symptomCount).toBe(5);
    expect(highFat.exposed.counterexampleCount).toBe(2);
    expect(highFat.exposed.smoothedRate).toBeGreaterThan(highFat.baseline.smoothedRate);

    expect(caffeine.evidenceLabel).toBe('Still learning');
    expect(caffeine.exposed.observationCount).toBe(4);
    expect(caffeine.summary).toContain('Synthetic sample');
  });
});

function requirePattern(patterns: readonly FactorPattern[], factorKey: string): FactorPattern {
  const pattern = patterns.find(({ factor }) => factor.key === factorKey);
  if (!pattern) {
    throw new Error(`Expected pattern for ${factorKey}.`);
  }
  return pattern;
}
