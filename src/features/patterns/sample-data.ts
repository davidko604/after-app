import type {
  PatternFactor,
  PatternMeal,
  PatternSymptomEvent,
  SymptomSeverity,
} from './types';

export type SampleStress = 'low' | 'medium' | 'high';
export type SampleSleepQuality = 1 | 2 | 3 | 4 | 5;

export type SampleDailyContext = {
  id: string;
  localDate: string;
  stress: SampleStress;
  sleepQuality: SampleSleepQuality;
  exercised: boolean;
  medicationOrAntibioticChange: boolean;
  unusualDayNote?: string;
  source: 'sample';
};

export type SampleHistory = {
  metadata: {
    id: 'after-synthetic-18-day-v1';
    label: 'Synthetic 18-day demo history';
    dayCount: 18;
    source: 'sample';
    disclaimer: 'Synthetic sample data for demonstration. These are not your records.';
  };
  factors: readonly PatternFactor[];
  meals: readonly PatternMeal[];
  symptomEvents: readonly PatternSymptomEvent[];
  dailyContext: readonly SampleDailyContext[];
};

export const SAMPLE_PATTERN_FACTORS: readonly PatternFactor[] = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'caffeine', label: 'Caffeine' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'spicy', label: 'Spicy food' },
  { key: 'high-fat', label: 'High-fat food' },
  { key: 'artificial-sweeteners', label: 'Artificial sweeteners' },
  { key: 'large-meal', label: 'Large meal' },
];

const SAMPLE_MEALS: readonly PatternMeal[] = [
  sampleMeal('01', '2026-08-01', 'Greek yogurt bowl', ['dairy']),
  sampleMeal('02', '2026-08-02', 'Cheeseburger', ['dairy', 'high-fat', 'large-meal']),
  sampleMeal('03', '2026-08-03', 'Latte and sandwich', ['dairy', 'caffeine']),
  sampleMeal('04', '2026-08-04', 'Creamy curry', ['dairy', 'high-fat', 'spicy']),
  sampleMeal('05', '2026-08-05', 'Ice cream and fruit', ['dairy', 'artificial-sweeteners']),
  sampleMeal('06', '2026-08-06', 'Cappuccino and toast', ['dairy', 'caffeine']),
  sampleMeal('07', '2026-08-07', 'Fried chicken plate', ['high-fat', 'large-meal']),
  sampleMeal('08', '2026-08-08', 'Cheese pizza', ['dairy', 'spicy', 'large-meal']),
  sampleMeal('09', '2026-08-09', 'Takeout fries and sandwich', ['high-fat', 'large-meal']),
  sampleMeal('10', '2026-08-10', 'Yogurt parfait', ['dairy']),
  sampleMeal('11', '2026-08-11', 'Avocado toast', ['high-fat']),
  sampleMeal('12', '2026-08-12', 'Iced coffee and salad', ['caffeine']),
  sampleMeal('13', '2026-08-13', 'Rich ramen', ['high-fat', 'spicy']),
  sampleMeal('14', '2026-08-14', 'Lentil grain bowl', []),
  sampleMeal('15', '2026-08-15', 'Salmon dinner', ['high-fat']),
  sampleMeal('16', '2026-08-16', 'Spicy vegetable noodles', ['spicy']),
  sampleMeal('17', '2026-08-17', 'Espresso and oatmeal', ['caffeine']),
  sampleMeal('18', '2026-08-18', 'Roasted vegetable bowl', []),
];

const SAMPLE_SYMPTOM_EVENTS: readonly PatternSymptomEvent[] = [
  sampleSymptom('01', '2026-08-01', 6, 'moderate', 1, 1),
  sampleSymptom('02', '2026-08-02', 7, 'strong', 2, 2),
  sampleSymptom('03', '2026-08-03', 6, 'moderate', 1, 1),
  sampleSymptom('04', '2026-08-04', 6, 'strong', 2, 2),
  sampleSymptom('05', '2026-08-05', 6, 'moderate', 1, 2),
  sampleSymptom('06', '2026-08-06', 4, 'none', 0, 1),
  sampleSymptom('07', '2026-08-07', 6, 'strong', 2, 1),
  sampleSymptom('08', '2026-08-08', 7, 'moderate', 2, 2),
  sampleSymptom('09', '2026-08-09', 6, 'moderate', 1, 1),
  sampleSymptom('10', '2026-08-10', 4, 'none', 0, 2),
  sampleSymptom('13', '2026-08-13', 6, 'strong', 2, 2),
  sampleSymptom('14', '2026-08-14', 4, 'none', 1, 2),
];

const SAMPLE_DAILY_CONTEXT: readonly SampleDailyContext[] = [
  sampleContext('01', '2026-08-01', 'low', 4, true),
  sampleContext('02', '2026-08-02', 'medium', 3, false),
  sampleContext('03', '2026-08-03', 'medium', 3, true),
  sampleContext('04', '2026-08-04', 'high', 2, false, 'Late workday'),
  sampleContext('05', '2026-08-05', 'low', 4, true),
  sampleContext('06', '2026-08-06', 'low', 5, true),
  sampleContext('07', '2026-08-07', 'medium', 3, false),
  sampleContext('08', '2026-08-08', 'high', 2, false, 'Travel day'),
  sampleContext('09', '2026-08-09', 'medium', 3, true),
  sampleContext('10', '2026-08-10', 'low', 4, true),
  sampleContext('11', '2026-08-11', 'low', 4, true),
  sampleContext('12', '2026-08-12', 'medium', 3, false),
  sampleContext('13', '2026-08-13', 'high', 2, false, 'Unusually busy day'),
  sampleContext('14', '2026-08-14', 'medium', 3, true),
  sampleContext('15', '2026-08-15', 'low', 5, true),
  sampleContext('16', '2026-08-16', 'medium', 4, false),
  sampleContext('17', '2026-08-17', 'low', 4, true),
  sampleContext('18', '2026-08-18', 'low', 5, true),
];

export const SYNTHETIC_SAMPLE_HISTORY: SampleHistory = {
  metadata: {
    id: 'after-synthetic-18-day-v1',
    label: 'Synthetic 18-day demo history',
    dayCount: 18,
    source: 'sample',
    disclaimer: 'Synthetic sample data for demonstration. These are not your records.',
  },
  factors: SAMPLE_PATTERN_FACTORS,
  meals: SAMPLE_MEALS,
  symptomEvents: SAMPLE_SYMPTOM_EVENTS,
  dailyContext: SAMPLE_DAILY_CONTEXT,
};

function sampleMeal(
  dayId: string,
  localDate: string,
  name: string,
  factorKeys: readonly string[],
): PatternMeal {
  return {
    id: `sample-meal-${dayId}`,
    name,
    occurredAt: `${localDate}T12:00:00.000Z`,
    factorKeys,
    source: 'sample',
  };
}

function sampleSymptom(
  dayId: string,
  localDate: string,
  stoolConsistency: PatternSymptomEvent['stoolConsistency'],
  urgency: PatternSymptomEvent['urgency'],
  cramping: SymptomSeverity,
  bloating: SymptomSeverity,
): PatternSymptomEvent {
  return {
    id: `sample-symptom-${dayId}`,
    associatedMealId: `sample-meal-${dayId}`,
    occurredAt: `${localDate}T15:00:00.000Z`,
    stoolConsistency,
    urgency,
    cramping,
    bloating,
    source: 'sample',
  };
}

function sampleContext(
  dayId: string,
  localDate: string,
  stress: SampleStress,
  sleepQuality: SampleSleepQuality,
  exercised: boolean,
  unusualDayNote?: string,
): SampleDailyContext {
  return {
    id: `sample-context-${dayId}`,
    localDate,
    stress,
    sleepQuality,
    exercised,
    medicationOrAntibioticChange: false,
    unusualDayNote,
    source: 'sample',
  };
}
