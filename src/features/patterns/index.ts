export {
  analyzeFactorPatterns,
  evidenceLabelForExposureCount,
  isLooseOrUrgent,
  laplaceSmoothedRate,
} from './engine';
export { SAMPLE_PATTERN_FACTORS, SYNTHETIC_SAMPLE_HISTORY } from './sample-data';
export type {
  SampleDailyContext,
  SampleHistory,
  SampleSleepQuality,
  SampleStress,
} from './sample-data';
export type {
  AssociationDirection,
  EvidenceLabel,
  FactorPattern,
  PatternAnalysisConfig,
  PatternAnalysisInput,
  PatternDataSource,
  PatternFactor,
  PatternMeal,
  PatternRate,
  PatternSymptomEvent,
  PatternWindowHours,
  StoolConsistency,
  SymptomSeverity,
  Urgency,
} from './types';
