import type {
  AssociationDirection,
  EvidenceLabel,
  FactorPattern,
  PatternAnalysisInput,
  PatternFactor,
  PatternRate,
  PatternSymptomEvent,
} from './types';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const OUTCOME_LABEL = 'Loose or urgent bowel movements';
const CAUTION = 'This is a personal association, not proof of cause or a diagnosis.';

type TimedSymptomEvent = {
  event: PatternSymptomEvent;
  occurredAtMs: number;
};

type TimedMeal = {
  meal: PatternAnalysisInput['meals'][number];
  occurredAtMs: number;
};

export function analyzeFactorPatterns(input: PatternAnalysisInput): readonly FactorPattern[] {
  validateInput(input);

  const timedSymptoms = input.symptomEvents.map((event) => ({
    event,
    occurredAtMs: parseTimestamp(event.occurredAt, `symptom event ${event.id}`),
  }));
  const timedMeals: readonly TimedMeal[] = input.meals.map((meal) => ({
    meal,
    occurredAtMs: parseTimestamp(meal.occurredAt, `meal ${meal.id}`),
  }));
  const windowMs = input.config.windowHours * MILLISECONDS_PER_HOUR;

  return input.factors.map((factor) => {
    let exposedObservations = 0;
    let exposedSymptoms = 0;
    let baselineObservations = 0;
    let baselineSymptoms = 0;

    for (const { meal, occurredAtMs } of timedMeals) {
      const mealHasOutcome = hasQualifyingOutcome(occurredAtMs, timedSymptoms, windowMs);

      if (meal.factorKeys.includes(factor.key)) {
        exposedObservations += 1;
        exposedSymptoms += mealHasOutcome ? 1 : 0;
      } else {
        baselineObservations += 1;
        baselineSymptoms += mealHasOutcome ? 1 : 0;
      }
    }

    const exposed = buildRate(exposedSymptoms, exposedObservations);
    const baseline = {
      ...buildRate(baselineSymptoms, baselineObservations),
      available: baselineObservations > 0,
    };
    const direction = associationDirection(exposed, baseline);
    const differencePercentagePoints = baseline.available
      ? (exposed.smoothedRate - baseline.smoothedRate) * 100
      : null;
    const evidenceLabel = evidenceLabelForExposureCount(exposedObservations);

    return {
      factor,
      source: input.source,
      isSampleData: input.source === 'sample',
      windowHours: input.config.windowHours,
      outcomeLabel: OUTCOME_LABEL,
      evidenceLabel,
      direction,
      exposed,
      baseline,
      differencePercentagePoints,
      summary: buildSummary({ baseline, direction, evidenceLabel, exposed, factor, input }),
      caution: CAUTION,
    };
  });
}

export function evidenceLabelForExposureCount(exposureCount: number): EvidenceLabel {
  if (!Number.isInteger(exposureCount) || exposureCount < 0) {
    throw new Error('Exposure count must be a non-negative integer.');
  }

  if (exposureCount < 5) {
    return 'Still learning';
  }
  if (exposureCount < 10) {
    return 'Early pattern';
  }
  if (exposureCount < 20) {
    return 'Developing pattern';
  }
  return 'More consistent pattern';
}

export function laplaceSmoothedRate(symptomCount: number, observationCount: number): number {
  if (
    !Number.isInteger(symptomCount) ||
    !Number.isInteger(observationCount) ||
    symptomCount < 0 ||
    observationCount < 0 ||
    symptomCount > observationCount
  ) {
    throw new Error('Symptom and observation counts must be valid non-negative integers.');
  }

  return (symptomCount + 1) / (observationCount + 2);
}

export function isLooseOrUrgent(event: PatternSymptomEvent): boolean {
  return event.stoolConsistency >= 6 || event.urgency !== 'none';
}

function validateInput(input: PatternAnalysisInput): void {
  const factorKeys = new Set<string>();

  for (const factor of input.factors) {
    if (factor.key.trim().length === 0 || factor.label.trim().length === 0) {
      throw new Error('Pattern factors must have non-empty keys and labels.');
    }
    if (factorKeys.has(factor.key)) {
      throw new Error(`Pattern factor key must be unique: ${factor.key}`);
    }
    factorKeys.add(factor.key);
  }

  for (const meal of input.meals) {
    validateSource(meal.source, input.source, `meal ${meal.id}`);
    for (const factorKey of meal.factorKeys) {
      if (factorKey.trim().length === 0) {
        throw new Error(`Meal ${meal.id} contains an empty factor key.`);
      }
    }
  }

  for (const symptomEvent of input.symptomEvents) {
    validateSource(symptomEvent.source, input.source, `symptom event ${symptomEvent.id}`);
  }
}

function validateSource(
  recordSource: PatternAnalysisInput['source'],
  expectedSource: PatternAnalysisInput['source'],
  recordName: string,
): void {
  if (recordSource !== expectedSource) {
    throw new Error(
      `Pattern input cannot mix real and sample records. Expected ${expectedSource} for ${recordName}.`,
    );
  }
}

function parseTimestamp(value: string, recordName: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid occurredAt timestamp for ${recordName}.`);
  }
  return timestamp;
}

function hasQualifyingOutcome(
  mealOccurredAtMs: number,
  timedSymptoms: readonly TimedSymptomEvent[],
  windowMs: number,
): boolean {
  return timedSymptoms.some(({ event, occurredAtMs }) => {
    const elapsedMs = occurredAtMs - mealOccurredAtMs;
    return elapsedMs > 0 && elapsedMs <= windowMs && isLooseOrUrgent(event);
  });
}

function buildRate(symptomCount: number, observationCount: number): PatternRate {
  return {
    observationCount,
    symptomCount,
    counterexampleCount: observationCount - symptomCount,
    rawRate: observationCount === 0 ? null : symptomCount / observationCount,
    smoothedRate: laplaceSmoothedRate(symptomCount, observationCount),
  };
}

function associationDirection(
  exposed: PatternRate,
  baseline: PatternRate & { available: boolean },
): AssociationDirection {
  if (!baseline.available) {
    return 'baseline-unavailable';
  }

  const difference = exposed.smoothedRate - baseline.smoothedRate;
  if (Math.abs(difference) < Number.EPSILON) {
    return 'similar-to-baseline';
  }
  return difference > 0 ? 'more-often-followed-by' : 'less-often-followed-by';
}

type SummaryInput = {
  baseline: PatternRate & { available: boolean };
  direction: AssociationDirection;
  evidenceLabel: EvidenceLabel;
  exposed: PatternRate;
  factor: PatternFactor;
  input: PatternAnalysisInput;
};

function buildSummary({
  baseline,
  direction,
  evidenceLabel,
  exposed,
  factor,
  input,
}: SummaryInput): string {
  const samplePrefix = input.source === 'sample' ? 'Synthetic sample: ' : '';
  const factorName = factor.label.toLocaleLowerCase();

  if (exposed.observationCount === 0) {
    return `${samplePrefix}Still learning about ${factor.label}. No ${factorName}-tagged meals are available yet. ${CAUTION}`;
  }

  const exposedCopy = `${OUTCOME_LABEL} followed ${exposed.symptomCount} of ${exposed.observationCount} ${factorName}-tagged meals`;
  const counterexampleCopy = `${exposed.counterexampleCount} tagged ${pluralizeMeal(exposed.counterexampleCount)} had no qualifying outcome`;
  const evidenceCopy = evidenceLabel.toLocaleLowerCase();

  if (!baseline.available || direction === 'baseline-unavailable') {
    return `${samplePrefix}${exposedCopy}. ${counterexampleCopy}. There are not yet meals without ${factorName} to form a personal baseline. This is ${evidenceCopy}, not a causal or diagnostic conclusion.`;
  }

  return `${samplePrefix}${exposedCopy}, compared with a ${formatPercent(baseline.smoothedRate)} smoothed personal baseline when ${factorName} was absent. ${counterexampleCopy}. This is ${evidenceCopy} and a possible association, not proof that ${factorName} caused symptoms.`;
}

function pluralizeMeal(count: number): 'meal' | 'meals' {
  return count === 1 ? 'meal' : 'meals';
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
