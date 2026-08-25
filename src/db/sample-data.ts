import type { SQLiteDatabase } from 'expo-sqlite';

import { upsertDailyContextWithinTransaction } from './daily-context';
import { DiaryValidationError } from './errors';
import {
  nowIso,
  requireNonEmptyText,
  withWriteTransaction,
  type RepositoryOptions,
} from './internal';
import { insertMealWithinTransaction } from './meals';
import type { SampleDataset } from './model';
import { insertSymptomWithinTransaction } from './symptoms';

async function clearSampleRows(db: SQLiteDatabase): Promise<void> {
  await db.runAsync("DELETE FROM daily_context WHERE source = 'sample'");
  await db.runAsync("DELETE FROM symptom_events WHERE source = 'sample'");
  await db.runAsync("DELETE FROM meals WHERE source = 'sample'");
}

async function insertSampleDataset(
  db: SQLiteDatabase,
  dataset: SampleDataset,
  timestamp: string,
): Promise<void> {
  const mealIdsByKey = new Map<string, number>();

  for (const meal of dataset.meals) {
    const sampleKey = requireNonEmptyText(meal.sampleKey, 'Sample meal key', 120);

    if (mealIdsByKey.has(sampleKey)) {
      throw new DiaryValidationError('Sample meal keys must be unique within a dataset.');
    }

    const mealId = await insertMealWithinTransaction(db, 'sample', meal, timestamp);
    mealIdsByKey.set(sampleKey, mealId);
  }

  for (const symptom of dataset.symptoms) {
    let mealId: number | null = null;

    if (symptom.mealSampleKey !== null && symptom.mealSampleKey !== undefined) {
      const sampleKey = requireNonEmptyText(
        symptom.mealSampleKey,
        'Symptom sample meal key',
        120,
      );
      const resolvedMealId = mealIdsByKey.get(sampleKey);

      if (resolvedMealId === undefined) {
        throw new DiaryValidationError('A sample symptom references an unknown sample meal key.');
      }

      mealId = resolvedMealId;
    }

    await insertSymptomWithinTransaction(
      db,
      'sample',
      {
        bloating: symptom.bloating,
        cramping: symptom.cramping,
        mealId,
        note: symptom.note,
        occurredAt: symptom.occurredAt,
        stoolConsistency: symptom.stoolConsistency,
        urgency: symptom.urgency,
      },
      timestamp,
    );
  }

  for (const context of dataset.dailyContexts ?? []) {
    await upsertDailyContextWithinTransaction(db, 'sample', context, timestamp);
  }
}

export type SampleDataRepository = {
  insert: (dataset: SampleDataset) => Promise<void>;
  replace: (dataset: SampleDataset) => Promise<void>;
  reset: () => Promise<void>;
};

export function createSampleDataRepository(
  db: SQLiteDatabase,
  options?: RepositoryOptions,
): SampleDataRepository {
  return {
    async insert(dataset) {
      await withWriteTransaction(db, async (transaction) => {
        await insertSampleDataset(transaction, dataset, nowIso(options));
      });
    },

    async replace(dataset) {
      await withWriteTransaction(db, async (transaction) => {
        await clearSampleRows(transaction);
        await insertSampleDataset(transaction, dataset, nowIso(options));
      });
    },

    async reset() {
      await withWriteTransaction(db, clearSampleRows);
    },
  };
}
