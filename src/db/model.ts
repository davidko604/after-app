export type DiarySource = 'real' | 'sample';
export type SuggestionSource = 'manual' | 'fixture' | 'photo_analysis';
export type Urgency = 'none' | 'moderate' | 'strong';
export type Stress = 'low' | 'medium' | 'high';

export type DateRange = {
  after?: string;
  before?: string;
  limit?: number;
};

export type LocalDateRange = {
  after?: string;
  before?: string;
  limit?: number;
};

export type Factor = {
  createdAt: string;
  id: number;
  isCustom: boolean;
  key: string;
  label: string;
};

export type FactorReference =
  | {
      factorId: number;
      kind: 'existing';
    }
  | {
      isCustom?: boolean;
      key: string;
      kind: 'upsert';
      label: string;
    };

export type MealFactorInput = {
  confirmed?: boolean;
  factor: FactorReference;
  suggestionSource?: SuggestionSource;
};

export type MealFactor = {
  confirmed: boolean;
  factor: Factor;
  suggestionSource: SuggestionSource;
};

export type Meal = {
  checkInDelayMinutes: number;
  createdAt: string;
  factors: readonly MealFactor[];
  id: number;
  imageUri: string | null;
  name: string;
  notificationId: string | null;
  occurredAt: string;
  source: DiarySource;
  updatedAt: string;
};

export type CreateMealInput = {
  checkInDelayMinutes?: number;
  factors?: readonly MealFactorInput[];
  imageUri?: string | null;
  name: string;
  notificationId?: string | null;
  occurredAt: string;
};

export type UpdateMealInput = {
  checkInDelayMinutes?: number;
  factors?: readonly MealFactorInput[];
  imageUri?: string | null;
  name?: string;
  notificationId?: string | null;
  occurredAt?: string;
};

export type LinkedMealSummary = {
  id: number;
  name: string;
};

export type SymptomEvent = {
  bloating: number;
  cramping: number;
  createdAt: string;
  id: number;
  meal: LinkedMealSummary | null;
  note: string | null;
  occurredAt: string;
  source: DiarySource;
  stoolConsistency: number;
  updatedAt: string;
  urgency: Urgency;
};

export type CreateSymptomEventInput = {
  bloating: number;
  cramping: number;
  mealId?: number | null;
  note?: string | null;
  occurredAt: string;
  stoolConsistency: number;
  urgency: Urgency;
};

export type UpdateSymptomEventInput = {
  bloating?: number;
  cramping?: number;
  mealId?: number | null;
  note?: string | null;
  occurredAt?: string;
  stoolConsistency?: number;
  urgency?: Urgency;
};

export type DailyContext = {
  createdAt: string;
  exercised: boolean | null;
  id: number;
  localDate: string;
  medicationChange: string | null;
  sleepQuality: number | null;
  source: DiarySource;
  stress: Stress | null;
  unusualDayNote: string | null;
  updatedAt: string;
};

export type UpsertDailyContextInput = {
  exercised?: boolean | null;
  localDate: string;
  medicationChange?: string | null;
  sleepQuality?: number | null;
  stress?: Stress | null;
  unusualDayNote?: string | null;
};

export type UpdateDailyContextInput = Omit<Partial<UpsertDailyContextInput>, 'localDate'>;

export type AppSetting<T> = {
  key: string;
  updatedAt: string;
  value: T;
};

export type AppSettingMetadata = {
  key: string;
  updatedAt: string;
};

export type SettingCodec<T> = {
  decode: (serialized: string) => T;
  encode: (value: T) => string;
};

export type TimelineEntry =
  | {
      id: number;
      kind: 'meal';
      meal: Meal;
      occurredAt: string;
    }
  | {
      id: number;
      kind: 'symptom';
      occurredAt: string;
      symptom: SymptomEvent;
    };

export type TimelineSummary = {
  meals: number;
  symptoms: number;
  total: number;
};

export type PendingMealCheckIn = {
  dueAt: string;
  meal: Meal;
};

export type SampleMealSeed = CreateMealInput & {
  sampleKey: string;
};

export type SampleSymptomSeed = Omit<CreateSymptomEventInput, 'mealId'> & {
  mealSampleKey?: string | null;
};

export type SampleDataset = {
  dailyContexts?: readonly UpsertDailyContextInput[];
  meals: readonly SampleMealSeed[];
  symptoms: readonly SampleSymptomSeed[];
};
