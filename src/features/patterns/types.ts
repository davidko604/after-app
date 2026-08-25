export type PatternDataSource = 'real' | 'sample';

export type PatternWindowHours = 12 | 24;

export type StoolConsistency = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Urgency = 'none' | 'moderate' | 'strong';

export type SymptomSeverity = 0 | 1 | 2 | 3;

export type PatternFactor = {
  key: string;
  label: string;
};

export type PatternMeal = {
  id: string;
  name: string;
  occurredAt: string;
  factorKeys: readonly string[];
  source: PatternDataSource;
};

export type PatternSymptomEvent = {
  id: string;
  associatedMealId?: string;
  occurredAt: string;
  stoolConsistency: StoolConsistency;
  urgency: Urgency;
  cramping: SymptomSeverity;
  bloating: SymptomSeverity;
  source: PatternDataSource;
};

export type PatternAnalysisConfig = {
  windowHours: PatternWindowHours;
};

export type PatternAnalysisInput = {
  source: PatternDataSource;
  factors: readonly PatternFactor[];
  meals: readonly PatternMeal[];
  symptomEvents: readonly PatternSymptomEvent[];
  config: PatternAnalysisConfig;
};

export type EvidenceLabel =
  | 'Still learning'
  | 'Early pattern'
  | 'Developing pattern'
  | 'More consistent pattern';

export type AssociationDirection =
  | 'more-often-followed-by'
  | 'less-often-followed-by'
  | 'similar-to-baseline'
  | 'baseline-unavailable';

export type PatternRate = {
  observationCount: number;
  symptomCount: number;
  counterexampleCount: number;
  rawRate: number | null;
  smoothedRate: number;
};

export type FactorPattern = {
  factor: PatternFactor;
  source: PatternDataSource;
  isSampleData: boolean;
  windowHours: PatternWindowHours;
  outcomeLabel: 'Loose or urgent bowel movements';
  evidenceLabel: EvidenceLabel;
  direction: AssociationDirection;
  exposed: PatternRate;
  baseline: PatternRate & {
    available: boolean;
  };
  differencePercentagePoints: number | null;
  summary: string;
  caution: 'This is a personal association, not proof of cause or a diagnosis.';
};
