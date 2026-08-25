import { createContext, type PropsWithChildren, use, useMemo, useState } from 'react';

export const INITIAL_FACTORS = [
  'Dairy',
  'High-fat food',
  'Large meal',
] as const;

type MealDraft = {
  name: string;
  photoUri: string | null;
  factors: string[];
};

type SymptomDraft = {
  bloating: number;
  cramping: number;
  stoolConsistency: number;
  urgency: 'none' | 'moderate' | 'strong';
};

type PrototypeStateValue = {
  meal: MealDraft | null;
  sampleDataEnabled: boolean;
  setSampleDataEnabled: (enabled: boolean) => void;
  symptom: SymptomDraft | null;
  saveMeal: (meal: MealDraft) => void;
  saveSymptom: (symptom: SymptomDraft) => void;
  reset: () => void;
};

const PrototypeStateContext = createContext<PrototypeStateValue | null>(null);

export function PrototypeStateProvider({ children }: PropsWithChildren) {
  const [meal, setMeal] = useState<MealDraft | null>(null);
  const [symptom, setSymptom] = useState<SymptomDraft | null>(null);
  const [sampleDataEnabled, setSampleDataEnabled] = useState(false);

  const value = useMemo<PrototypeStateValue>(
    () => ({
      meal,
      sampleDataEnabled,
      setSampleDataEnabled,
      symptom,
      saveMeal(nextMeal) {
        setMeal(nextMeal);
        setSymptom(null);
      },
      saveSymptom: setSymptom,
      reset() {
        setMeal(null);
        setSymptom(null);
        setSampleDataEnabled(false);
      },
    }),
    [meal, sampleDataEnabled, symptom],
  );

  return <PrototypeStateContext value={value}>{children}</PrototypeStateContext>;
}

export function usePrototypeState() {
  const value = use(PrototypeStateContext);

  if (!value) {
    throw new Error('usePrototypeState must be used inside PrototypeStateProvider.');
  }

  return value;
}
