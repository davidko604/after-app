import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryNotFoundError, DiaryValidationError } from './errors';
import {
  normalizeOptionalText,
  nowIso,
  requireIntegerInRange,
  requireIsoTimestamp,
  requireLocalDate,
  requireNullableSqliteBoolean,
  requirePositiveId,
  requireSource,
  requireStress,
  sqliteBoolean,
  validateStress,
  type RepositoryOptions,
} from './internal';
import type {
  DailyContext,
  DiarySource,
  LocalDateRange,
  UpdateDailyContextInput,
  UpsertDailyContextInput,
} from './model';

type DailyContextRow = {
  created_at: string;
  exercised: number | null;
  id: number;
  local_date: string;
  medication_change: string | null;
  sleep_quality: number | null;
  source: string;
  stress: string | null;
  unusual_day_note: string | null;
  updated_at: string;
};

function mapDailyContextRow(row: DailyContextRow): DailyContext {
  return {
    createdAt: requireIsoTimestamp(row.created_at, 'Daily context creation time'),
    exercised: requireNullableSqliteBoolean(row.exercised, 'exercise'),
    id: requirePositiveId(row.id, 'Daily context ID'),
    localDate: requireLocalDate(row.local_date),
    medicationChange: normalizeOptionalText(row.medication_change, 'Medication change'),
    sleepQuality:
      row.sleep_quality === null
        ? null
        : requireIntegerInRange(row.sleep_quality, 1, 5, 'Sleep quality'),
    source: requireSource(row.source),
    stress: requireStress(row.stress),
    unusualDayNote: normalizeOptionalText(row.unusual_day_note, 'Unusual day note'),
    updatedAt: requireIsoTimestamp(row.updated_at, 'Daily context update time'),
  };
}

function normalizeLimit(limit = 100): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DiaryValidationError('Query limit must be an integer from 1 to 500.');
  }

  return limit;
}

function toNullableExercise(value: boolean | null | undefined): number | null {
  return value === null || value === undefined ? null : sqliteBoolean(value);
}

async function selectDailyContext(
  db: SQLiteDatabase,
  source: DiarySource,
  localDate: string,
): Promise<DailyContext | null> {
  const row = await db.getFirstAsync<DailyContextRow>(
    `SELECT id, local_date, stress, sleep_quality, exercised, medication_change,
            unusual_day_note, source, created_at, updated_at
     FROM daily_context
     WHERE local_date = $localDate AND source = $source`,
    { $localDate: requireLocalDate(localDate), $source: source },
  );
  return row ? mapDailyContextRow(row) : null;
}

export async function upsertDailyContextWithinTransaction(
  db: SQLiteDatabase,
  source: DiarySource,
  input: UpsertDailyContextInput,
  timestamp: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO daily_context (
       local_date, stress, sleep_quality, exercised, medication_change, unusual_day_note,
       source, created_at, updated_at
     ) VALUES (
       $localDate, $stress, $sleepQuality, $exercised, $medicationChange, $unusualDayNote,
       $source, $createdAt, $updatedAt
     )
     ON CONFLICT(local_date, source) DO UPDATE SET
       stress = excluded.stress,
       sleep_quality = excluded.sleep_quality,
       exercised = excluded.exercised,
       medication_change = excluded.medication_change,
       unusual_day_note = excluded.unusual_day_note,
       updated_at = excluded.updated_at`,
    {
      $createdAt: timestamp,
      $exercised: toNullableExercise(input.exercised),
      $localDate: requireLocalDate(input.localDate),
      $medicationChange: normalizeOptionalText(input.medicationChange, 'Medication change'),
      $sleepQuality:
        input.sleepQuality === null || input.sleepQuality === undefined
          ? null
          : requireIntegerInRange(input.sleepQuality, 1, 5, 'Sleep quality'),
      $source: source,
      $stress: validateStress(input.stress),
      $unusualDayNote: normalizeOptionalText(input.unusualDayNote, 'Unusual day note'),
      $updatedAt: timestamp,
    },
  );
}

export type DailyContextRepository = {
  delete: (localDate: string) => Promise<boolean>;
  findByDate: (localDate: string) => Promise<DailyContext | null>;
  list: (range?: LocalDateRange) => Promise<readonly DailyContext[]>;
  update: (localDate: string, input: UpdateDailyContextInput) => Promise<DailyContext>;
  upsert: (input: UpsertDailyContextInput) => Promise<DailyContext>;
};

export function createDailyContextRepository(
  db: SQLiteDatabase,
  source: DiarySource,
  options?: RepositoryOptions,
): DailyContextRepository {
  return {
    async delete(localDate) {
      const result = await db.runAsync(
        'DELETE FROM daily_context WHERE local_date = $localDate AND source = $source',
        { $localDate: requireLocalDate(localDate), $source: source },
      );
      return result.changes > 0;
    },

    findByDate(localDate) {
      return selectDailyContext(db, source, localDate);
    },

    async list(range) {
      const rows = await db.getAllAsync<DailyContextRow>(
        `SELECT id, local_date, stress, sleep_quality, exercised, medication_change,
                unusual_day_note, source, created_at, updated_at
         FROM daily_context
         WHERE source = $source
           AND ($after IS NULL OR local_date >= $after)
           AND ($before IS NULL OR local_date < $before)
         ORDER BY local_date DESC, id DESC
         LIMIT $limit`,
        {
          $after: range?.after ? requireLocalDate(range.after) : null,
          $before: range?.before ? requireLocalDate(range.before) : null,
          $limit: normalizeLimit(range?.limit),
          $source: source,
        },
      );
      return rows.map(mapDailyContextRow);
    },

    async update(localDate, input) {
      const existing = await selectDailyContext(db, source, localDate);

      if (!existing) {
        throw new DiaryNotFoundError('daily context');
      }

      await upsertDailyContextWithinTransaction(
        db,
        source,
        {
          exercised: input.exercised === undefined ? existing.exercised : input.exercised,
          localDate: existing.localDate,
          medicationChange:
            input.medicationChange === undefined
              ? existing.medicationChange
              : input.medicationChange,
          sleepQuality:
            input.sleepQuality === undefined ? existing.sleepQuality : input.sleepQuality,
          stress: input.stress === undefined ? existing.stress : input.stress,
          unusualDayNote:
            input.unusualDayNote === undefined ? existing.unusualDayNote : input.unusualDayNote,
        },
        nowIso(options),
      );
      const context = await selectDailyContext(db, source, existing.localDate);

      if (!context) {
        throw new DiaryIntegrityError('The daily context could not be read after editing.');
      }

      return context;
    },

    async upsert(input) {
      const timestamp = nowIso(options);
      await upsertDailyContextWithinTransaction(db, source, input, timestamp);
      const context = await selectDailyContext(db, source, input.localDate);

      if (!context) {
        throw new DiaryIntegrityError('The daily context could not be read after upsert.');
      }

      return context;
    },
  };
}

