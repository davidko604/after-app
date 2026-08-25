import type { MealFactorInput, SampleDataset } from '@/db';

import type { SampleHistory } from './sample-data';

export const SAMPLE_DATA_ENABLED_SETTING = 'demo.sampleDataEnabled';

export function sampleHistoryToDataset(history: SampleHistory): SampleDataset {
  const factorsByKey = new Map(history.factors.map((factor) => [factor.key, factor]));

  return {
    dailyContexts: history.dailyContext.map((context) => ({
      exercised: context.exercised,
      localDate: context.localDate,
      medicationChange: context.medicationOrAntibioticChange
        ? 'Synthetic medication or antibiotic change'
        : null,
      sleepQuality: context.sleepQuality,
      stress: context.stress,
      unusualDayNote: context.unusualDayNote ?? null,
    })),
    meals: history.meals.map((meal, index) => ({
      checkInDelayMinutes: 180,
      factors: meal.factorKeys.map<MealFactorInput>((factorKey) => {
        const factor = factorsByKey.get(factorKey);
        if (!factor) {
          throw new Error(`Synthetic meal references unknown factor ${factorKey}.`);
        }

        return {
          factor: {
            isCustom: false,
            key: factor.key,
            kind: 'upsert',
            label: factor.label,
          },
          suggestionSource: 'fixture',
        };
      }),
      imageUri: `sample://meal-${(index % 4) + 1}`,
      name: meal.name,
      occurredAt: meal.occurredAt,
      sampleKey: meal.id,
    })),
    symptoms: history.symptomEvents.map((symptom) => ({
      bloating: symptom.bloating,
      cramping: symptom.cramping,
      mealSampleKey: symptom.associatedMealId ?? null,
      note: null,
      occurredAt: symptom.occurredAt,
      stoolConsistency: symptom.stoolConsistency,
      urgency: symptom.urgency,
    })),
  };
}
