import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryNotFoundError } from './errors';
import {
  normalizeDateRange,
  normalizeOptionalText,
  nowIso,
  requireIntegerInRange,
  requireIsoTimestamp,
  requireNonEmptyText,
  requirePositiveId,
  requireSource,
  requireUrgency,
  validateUrgency,
  withWriteTransaction,
  type RepositoryOptions,
} from './internal';
import type {
  CreateSymptomEventInput,
  DateRange,
  DiarySource,
  SymptomEvent,
  UpdateSymptomEventInput,
} from './model';

type SymptomRow = {
  bloating: number;
  cramping: number;
  created_at: string;
  id: number;
  meal_id: number | null;
  meal_name: string | null;
  note: string | null;
  occurred_at: string;
  source: string;
  stool_consistency: number;
  updated_at: string;
  urgency: string;
};

const SYMPTOM_COLUMNS = `
  s.id,
  s.meal_id,
  s.occurred_at,
  s.stool_consistency,
  s.urgency,
  s.cramping,
  s.bloating,
  s.note,
  s.source,
  s.created_at,
  s.updated_at,
  m.name AS meal_name
`;

function mapSymptomRow(row: SymptomRow): SymptomEvent {
  const mealId = row.meal_id === null ? null : requirePositiveId(row.meal_id, 'Meal ID');

  if ((mealId === null) !== (row.meal_name === null)) {
    throw new DiaryIntegrityError('The database contains an incomplete symptom meal link.');
  }

  return {
    bloating: requireIntegerInRange(row.bloating, 0, 3, 'Bloating'),
    cramping: requireIntegerInRange(row.cramping, 0, 3, 'Cramping'),
    createdAt: requireIsoTimestamp(row.created_at, 'Symptom creation time'),
    id: requirePositiveId(row.id, 'Symptom event ID'),
    meal:
      mealId === null || row.meal_name === null
        ? null
        : {
            id: mealId,
            name: requireNonEmptyText(row.meal_name, 'Meal name'),
          },
    note: normalizeOptionalText(row.note, 'Symptom note'),
    occurredAt: requireIsoTimestamp(row.occurred_at, 'Symptom time'),
    source: requireSource(row.source),
    stoolConsistency: requireIntegerInRange(
      row.stool_consistency,
      1,
      7,
      'Stool consistency',
    ),
    updatedAt: requireIsoTimestamp(row.updated_at, 'Symptom update time'),
    urgency: requireUrgency(row.urgency),
  };
}

async function ensureMealInSource(
  db: SQLiteDatabase,
  source: DiarySource,
  mealId: number | null,
): Promise<number | null> {
  if (mealId === null) {
    return null;
  }

  const id = requirePositiveId(mealId, 'Meal ID');
  const meal = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM meals WHERE id = $id AND source = $source',
    { $id: id, $source: source },
  );

  if (!meal) {
    throw new DiaryNotFoundError('meal');
  }

  return requirePositiveId(meal.id, 'Meal ID');
}

async function selectSymptomById(
  db: SQLiteDatabase,
  source: DiarySource,
  id: number,
): Promise<SymptomEvent | null> {
  const row = await db.getFirstAsync<SymptomRow>(
    `SELECT ${SYMPTOM_COLUMNS}
     FROM symptom_events s
     LEFT JOIN meals m ON m.id = s.meal_id AND m.source = s.source
     WHERE s.id = $id AND s.source = $source`,
    { $id: requirePositiveId(id, 'Symptom event ID'), $source: source },
  );
  return row ? mapSymptomRow(row) : null;
}

export async function insertSymptomWithinTransaction(
  db: SQLiteDatabase,
  source: DiarySource,
  input: CreateSymptomEventInput,
  timestamp: string,
): Promise<number> {
  const mealId = await ensureMealInSource(db, source, input.mealId ?? null);
  const result = await db.runAsync(
    `INSERT INTO symptom_events (
       meal_id, occurred_at, stool_consistency, urgency, cramping, bloating, note,
       source, created_at, updated_at
     ) VALUES (
       $mealId, $occurredAt, $stoolConsistency, $urgency, $cramping, $bloating, $note,
       $source, $createdAt, $updatedAt
     )`,
    {
      $bloating: requireIntegerInRange(input.bloating, 0, 3, 'Bloating'),
      $cramping: requireIntegerInRange(input.cramping, 0, 3, 'Cramping'),
      $createdAt: timestamp,
      $mealId: mealId,
      $note: normalizeOptionalText(input.note, 'Symptom note'),
      $occurredAt: requireIsoTimestamp(input.occurredAt, 'Symptom time'),
      $source: source,
      $stoolConsistency: requireIntegerInRange(
        input.stoolConsistency,
        1,
        7,
        'Stool consistency',
      ),
      $updatedAt: timestamp,
      $urgency: validateUrgency(input.urgency),
    },
  );
  return requirePositiveId(result.lastInsertRowId, 'Symptom event ID');
}

export type SymptomRepository = {
  create: (input: CreateSymptomEventInput) => Promise<SymptomEvent>;
  delete: (id: number) => Promise<boolean>;
  findById: (id: number) => Promise<SymptomEvent | null>;
  list: (range?: DateRange) => Promise<readonly SymptomEvent[]>;
  listForMeal: (mealId: number) => Promise<readonly SymptomEvent[]>;
  update: (id: number, input: UpdateSymptomEventInput) => Promise<SymptomEvent>;
};

export function createSymptomRepository(
  db: SQLiteDatabase,
  source: DiarySource,
  options?: RepositoryOptions,
): SymptomRepository {
  return {
    async create(input) {
      let eventId: number | null = null;
      await withWriteTransaction(db, async (transaction) => {
        eventId = await insertSymptomWithinTransaction(
          transaction,
          source,
          input,
          nowIso(options),
        );
      });

      if (eventId === null) {
        throw new DiaryIntegrityError('The symptom transaction completed without an ID.');
      }

      const event = await selectSymptomById(db, source, eventId);

      if (!event) {
        throw new DiaryIntegrityError('The symptom event could not be read after insertion.');
      }

      return event;
    },

    async delete(id) {
      const result = await db.runAsync(
        'DELETE FROM symptom_events WHERE id = $id AND source = $source',
        { $id: requirePositiveId(id, 'Symptom event ID'), $source: source },
      );
      return result.changes > 0;
    },

    findById(id) {
      return selectSymptomById(db, source, id);
    },

    async list(range) {
      const query = normalizeDateRange(range);
      const rows = await db.getAllAsync<SymptomRow>(
        `SELECT ${SYMPTOM_COLUMNS}
         FROM symptom_events s
         LEFT JOIN meals m ON m.id = s.meal_id AND m.source = s.source
         WHERE s.source = $source
           AND ($after IS NULL OR s.occurred_at >= $after)
           AND ($before IS NULL OR s.occurred_at < $before)
         ORDER BY s.occurred_at DESC, s.id DESC
         LIMIT $limit`,
        { ...query, $source: source },
      );
      return rows.map(mapSymptomRow);
    },

    async listForMeal(mealId) {
      const id = requirePositiveId(mealId, 'Meal ID');
      await ensureMealInSource(db, source, id);
      const rows = await db.getAllAsync<SymptomRow>(
        `SELECT ${SYMPTOM_COLUMNS}
         FROM symptom_events s
         LEFT JOIN meals m ON m.id = s.meal_id AND m.source = s.source
         WHERE s.meal_id = $mealId AND s.source = $source
         ORDER BY s.occurred_at DESC, s.id DESC`,
        { $mealId: id, $source: source },
      );
      return rows.map(mapSymptomRow);
    },

    async update(id, input) {
      const eventId = requirePositiveId(id, 'Symptom event ID');
      await withWriteTransaction(db, async (transaction) => {
        const existing = await selectSymptomById(transaction, source, eventId);

        if (!existing) {
          throw new DiaryNotFoundError('symptom event');
        }

        const mealId = await ensureMealInSource(
          transaction,
          source,
          input.mealId === undefined ? existing.meal?.id ?? null : input.mealId,
        );
        await transaction.runAsync(
          `UPDATE symptom_events SET
             meal_id = $mealId,
             occurred_at = $occurredAt,
             stool_consistency = $stoolConsistency,
             urgency = $urgency,
             cramping = $cramping,
             bloating = $bloating,
             note = $note,
             updated_at = $updatedAt
           WHERE id = $id AND source = $source`,
          {
            $bloating: requireIntegerInRange(
              input.bloating ?? existing.bloating,
              0,
              3,
              'Bloating',
            ),
            $cramping: requireIntegerInRange(
              input.cramping ?? existing.cramping,
              0,
              3,
              'Cramping',
            ),
            $id: eventId,
            $mealId: mealId,
            $note:
              input.note === undefined
                ? existing.note
                : normalizeOptionalText(input.note, 'Symptom note'),
            $occurredAt: requireIsoTimestamp(
              input.occurredAt ?? existing.occurredAt,
              'Symptom time',
            ),
            $source: source,
            $stoolConsistency: requireIntegerInRange(
              input.stoolConsistency ?? existing.stoolConsistency,
              1,
              7,
              'Stool consistency',
            ),
            $updatedAt: nowIso(options),
            $urgency: validateUrgency(input.urgency ?? existing.urgency),
          },
        );
      });

      const event = await selectSymptomById(db, source, eventId);

      if (!event) {
        throw new DiaryIntegrityError('The symptom event could not be read after editing.');
      }

      return event;
    },
  };
}

