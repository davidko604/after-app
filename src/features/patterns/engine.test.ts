import { describe, expect, it } from 'vitest';

import {
  analyzeFactorPatterns,
  evidenceLabelForExposureCount,
  laplaceSmoothedRate,
} from './engine';
import type { FactorPattern, PatternAnalysisInput, PatternMeal, PatternSymptomEvent } from './types';

describe('pattern correlation engine', () => {
  it('uses Laplace smoothing for exposed and baseline rates', () => {
    expect(laplaceSmoothedRate(6, 8)).toBeCloseTo(0.7);
    expect(laplaceSmoothedRate(3, 10)).toBeCloseTo(1 / 3);
  });

  it('maps exposure counts to the specified evidence labels', () => {
    expect([
      evidenceLabelForExposureCount(0),
      evidenceLabelForExposureCount(4),
      evidenceLabelForExposureCount(5),
      evidenceLabelForExposureCount(9),
      evidenceLabelForExposureCount(10),
      evidenceLabelForExposureCount(19),
      evidenceLabelForExposureCount(20),
    ]).toEqual([
      'Still learning',
      'Still learning',
      'Early pattern',
      'Early pattern',
      'Developing pattern',
      'Developing pattern',
      'More consistent pattern',
    ]);
  });

  it('respects the configurable 12 or 24 hour post-meal window', () => {
    const meals: readonly PatternMeal[] = [
      meal('exposed', '2026-08-01T12:00:00.000Z', ['dairy']),
      meal('baseline', '2026-08-04T12:00:00.000Z', []),
    ];
    const symptoms: readonly PatternSymptomEvent[] = [
      symptom('after-18-hours', '2026-08-02T06:00:00.000Z'),
    ];

    const twelveHour = requirePattern(
      analyzeFactorPatterns(input(meals, symptoms, 12)),
      'dairy',
    );
    const twentyFourHour = requirePattern(
      analyzeFactorPatterns(input(meals, symptoms, 24)),
      'dairy',
    );

    expect(twelveHour.exposed.symptomCount).toBe(0);
    expect(twentyFourHour.exposed.symptomCount).toBe(1);
  });

  it('uses meals where the factor is absent as the personal baseline', () => {
    const meals: readonly PatternMeal[] = [
      meal('dairy-1', '2026-08-01T12:00:00.000Z', ['dairy']),
      meal('dairy-2', '2026-08-03T12:00:00.000Z', ['dairy']),
      meal('without-dairy', '2026-08-05T12:00:00.000Z', []),
    ];
    const symptoms: readonly PatternSymptomEvent[] = [
      symptom('dairy-outcome', '2026-08-01T15:00:00.000Z'),
    ];

    const pattern = requirePattern(analyzeFactorPatterns(input(meals, symptoms, 12)), 'dairy');

    expect(pattern.exposed.observationCount).toBe(2);
    expect(pattern.exposed.symptomCount).toBe(1);
    expect(pattern.exposed.counterexampleCount).toBe(1);
    expect(pattern.baseline.observationCount).toBe(1);
    expect(pattern.baseline.symptomCount).toBe(0);
    expect(pattern.direction).toBe('more-often-followed-by');
  });

  it('rejects accidental mixing of real and sample records', () => {
    const mixedInput: PatternAnalysisInput = {
      source: 'real',
      factors: [{ key: 'dairy', label: 'Dairy' }],
      meals: [meal('sample-meal', '2026-08-01T12:00:00.000Z', ['dairy'])],
      symptomEvents: [],
      config: { windowHours: 12 },
    };

    expect(() => analyzeFactorPatterns(mixedInput)).toThrow(/cannot mix real and sample records/);
  });
});

function input(
  meals: readonly PatternMeal[],
  symptomEvents: readonly PatternSymptomEvent[],
  windowHours: 12 | 24,
): PatternAnalysisInput {
  return {
    source: 'sample',
    factors: [{ key: 'dairy', label: 'Dairy' }],
    meals,
    symptomEvents,
    config: { windowHours },
  };
}

function meal(id: string, occurredAt: string, factorKeys: readonly string[]): PatternMeal {
  return { id, occurredAt, factorKeys, name: id, source: 'sample' };
}

function symptom(id: string, occurredAt: string): PatternSymptomEvent {
  return {
    id,
    occurredAt,
    stoolConsistency: 6,
    urgency: 'moderate',
    cramping: 1,
    bloating: 1,
    source: 'sample',
  };
}

function requirePattern(patterns: readonly FactorPattern[], factorKey: string): FactorPattern {
  const pattern = patterns.find(({ factor }) => factor.key === factorKey);
  if (!pattern) {
    throw new Error(`Expected pattern for ${factorKey}.`);
  }
  return pattern;
}
