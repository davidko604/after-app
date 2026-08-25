import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createDailyContextRepository,
  type DailyContextRepository,
} from './daily-context';
import { type RepositoryOptions } from './internal';
import {
  createFactorRepository,
  createMealRepository,
  type FactorRepository,
  type MealRepository,
} from './meals';
import type { DiarySource } from './model';
import { createSampleDataRepository, type SampleDataRepository } from './sample-data';
import { createAppSettingsRepository, type AppSettingsRepository } from './settings';
import { createSymptomRepository, type SymptomRepository } from './symptoms';
import { createTimelineRepository, type TimelineRepository } from './timeline';

export type DiarySourceRepositories = {
  dailyContexts: DailyContextRepository;
  meals: MealRepository;
  source: DiarySource;
  symptoms: SymptomRepository;
  timeline: TimelineRepository;
};

export type DiaryDataLayer = {
  factors: FactorRepository;
  real: DiarySourceRepositories;
  sample: DiarySourceRepositories;
  sampleData: SampleDataRepository;
  settings: AppSettingsRepository;
};

function createSourceRepositories(
  db: SQLiteDatabase,
  source: DiarySource,
  options?: RepositoryOptions,
): DiarySourceRepositories {
  const meals = createMealRepository(db, source, options);
  const symptoms = createSymptomRepository(db, source, options);

  return {
    dailyContexts: createDailyContextRepository(db, source, options),
    meals,
    source,
    symptoms,
    timeline: createTimelineRepository(db, source, meals, symptoms),
  };
}

export function createDiaryDataLayer(
  db: SQLiteDatabase,
  options?: RepositoryOptions,
): DiaryDataLayer {
  return {
    factors: createFactorRepository(db, options),
    real: createSourceRepositories(db, 'real', options),
    sample: createSourceRepositories(db, 'sample', options),
    sampleData: createSampleDataRepository(db, options),
    settings: createAppSettingsRepository(db, options),
  };
}

export {
  booleanSettingCodec,
  integerSettingCodec,
  jsonSettingCodec,
  stringSettingCodec,
} from './settings';
export { DiaryIntegrityError, DiaryNotFoundError, DiaryValidationError } from './errors';
export type { DailyContextRepository } from './daily-context';
export type { RepositoryOptions } from './internal';
export type { FactorRepository, MealRepository } from './meals';
export type * from './model';
export type { SampleDataRepository } from './sample-data';
export type { AppSettingsRepository } from './settings';
export type { SymptomRepository } from './symptoms';
export type { TimelineRepository } from './timeline';
