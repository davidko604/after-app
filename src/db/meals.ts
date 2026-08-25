import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryNotFoundError, DiaryValidationError } from './errors';
import {
  normalizeDateRange,
  normalizeOptionalText,
  nowIso,
  requireFactorKey,
  requireIsoTimestamp,
  requireNonEmptyText,
  requireNonNegativeInteger,
  requirePositiveId,
  requireSource,
  requireSqliteBoolean,
  requireSuggestionSource,
  sqliteBoolean,
  withWriteTransaction,
  type RepositoryOptions,
} from './internal';
import type {
  CreateMealInput,
  DateRange,
  DiarySource,
  Factor,
  Meal,
  MealFactor,
  MealFactorInput,
  UpdateMealInput,
} from './model';

type FactorRow = {
  created_at: string;
  id: number;
  is_custom: number;
  key: string;
  label: string;
};

type MealJoinRow = {
  check_in_delay_minutes: number;
  confirmed: number | null;
  created_at: string;
  factor_created_at: string | null;
  factor_id: number | null;
  factor_is_custom: number | null;
  factor_key: string | null;
  factor_label: string | null;
  id: number;
  image_uri: string | null;
  name: string;
  notification_id: string | null;
  occurred_at: string;
  source: string;
  suggestion_source: string | null;
  updated_at: string;
};

const MEAL_JOIN_COLUMNS = `
  m.id,
  m.occurred_at,
  m.name,
  m.image_uri,
  m.check_in_delay_minutes,
  m.notification_id,
  m.source,
  m.created_at,
  m.updated_at,
  f.id AS factor_id,
  f.key AS factor_key,
  f.label AS factor_label,
  f.is_custom AS factor_is_custom,
  f.created_at AS factor_created_at,
  mf.suggestion_source,
  mf.confirmed
`;

function mapFactorRow(row: FactorRow): Factor {
  return {
    createdAt: requireIsoTimestamp(row.created_at, 'Factor creation time'),
    id: requirePositiveId(row.id, 'Factor ID'),
    isCustom: requireSqliteBoolean(row.is_custom, 'custom factor'),
    key: requireFactorKey(row.key),
    label: requireNonEmptyText(row.label, 'Factor label', 120),
  };
}

function mapMealRows(rows: readonly MealJoinRow[]): Meal[] {
  const grouped = new Map<number, { factors: MealFactor[]; meal: Omit<Meal, 'factors'> }>();

  for (const row of rows) {
    const id = requirePositiveId(row.id, 'Meal ID');
    let entry = grouped.get(id);

    if (!entry) {
      entry = {
        factors: [],
        meal: {
          checkInDelayMinutes: requireNonNegativeInteger(
            row.check_in_delay_minutes,
            'Check-in delay',
          ),
          createdAt: requireIsoTimestamp(row.created_at, 'Meal creation time'),
          id,
          imageUri: normalizeOptionalText(row.image_uri, 'Image URI', 2_000),
          name: requireNonEmptyText(row.name, 'Meal name'),
          notificationId: normalizeOptionalText(row.notification_id, 'Notification ID', 500),
          occurredAt: requireIsoTimestamp(row.occurred_at, 'Meal time'),
          source: requireSource(row.source),
          updatedAt: requireIsoTimestamp(row.updated_at, 'Meal update time'),
        },
      };
      grouped.set(id, entry);
    }

    if (row.factor_id !== null) {
      if (
        row.factor_key === null ||
        row.factor_label === null ||
        row.factor_is_custom === null ||
        row.factor_created_at === null ||
        row.suggestion_source === null ||
        row.confirmed === null
      ) {
        throw new DiaryIntegrityError('The database contains an incomplete meal factor.');
      }

      entry.factors.push({
        confirmed: requireSqliteBoolean(row.confirmed, 'confirmed factor'),
        factor: mapFactorRow({
          created_at: row.factor_created_at,
          id: row.factor_id,
          is_custom: row.factor_is_custom,
          key: row.factor_key,
          label: row.factor_label,
        }),
        suggestionSource: requireSuggestionSource(row.suggestion_source),
      });
    }
  }

  return Array.from(grouped.values(), ({ factors, meal }) => ({ ...meal, factors }));
}

async function selectMealById(
  db: SQLiteDatabase,
  source: DiarySource,
  id: number,
): Promise<Meal | null> {
  const rows = await db.getAllAsync<MealJoinRow>(
    `SELECT ${MEAL_JOIN_COLUMNS}
     FROM meals m
     LEFT JOIN meal_factors mf ON mf.meal_id = m.id
     LEFT JOIN factors f ON f.id = mf.factor_id
     WHERE m.id = $id AND m.source = $source
     ORDER BY f.label COLLATE NOCASE, f.id`,
    { $id: requirePositiveId(id, 'Meal ID'), $source: source },
  );

  return mapMealRows(rows)[0] ?? null;
}

async function resolveFactor(
  db: SQLiteDatabase,
  input: MealFactorInput,
  timestamp: string,
): Promise<number> {
  if (input.factor.kind === 'existing') {
    const factorId = requirePositiveId(input.factor.factorId, 'Factor ID');
    const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM factors WHERE id = $id', {
      $id: factorId,
    });

    if (!row) {
      throw new DiaryNotFoundError('factor');
    }

    return requirePositiveId(row.id, 'Factor ID');
  }

  const key = requireFactorKey(input.factor.key);
  const label = requireNonEmptyText(input.factor.label, 'Factor label', 120);
  await db.runAsync(
    `INSERT OR IGNORE INTO factors (key, label, is_custom, created_at)
     VALUES ($key, $label, $isCustom, $createdAt)`,
    {
      $createdAt: timestamp,
      $isCustom: sqliteBoolean(input.factor.isCustom ?? true),
      $key: key,
      $label: label,
    },
  );
  const row = await db.getFirstAsync<{ id: number }>('SELECT id FROM factors WHERE key = $key', {
    $key: key,
  });

  if (!row) {
    throw new DiaryIntegrityError('The factor could not be resolved after insertion.');
  }

  return requirePositiveId(row.id, 'Factor ID');
}

async function replaceMealFactors(
  db: SQLiteDatabase,
  mealId: number,
  factors: readonly MealFactorInput[],
  timestamp: string,
): Promise<void> {
  await db.runAsync('DELETE FROM meal_factors WHERE meal_id = $mealId', { $mealId: mealId });
  const seen = new Set<number>();

  for (const input of factors) {
    const factorId = await resolveFactor(db, input, timestamp);

    if (seen.has(factorId)) {
      throw new DiaryValidationError('A meal cannot contain the same factor more than once.');
    }

    seen.add(factorId);
    await db.runAsync(
      `INSERT INTO meal_factors (meal_id, factor_id, suggestion_source, confirmed)
       VALUES ($mealId, $factorId, $suggestionSource, $confirmed)`,
      {
        $confirmed: sqliteBoolean(input.confirmed ?? true),
        $factorId: factorId,
        $mealId: mealId,
        $suggestionSource: requireSuggestionSource(input.suggestionSource ?? 'manual'),
      },
    );
  }
}

export async function insertMealWithinTransaction(
  db: SQLiteDatabase,
  source: DiarySource,
  input: CreateMealInput,
  timestamp: string,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO meals (
       occurred_at, name, image_uri, check_in_delay_minutes, notification_id, source,
       created_at, updated_at
     ) VALUES (
       $occurredAt, $name, $imageUri, $checkInDelayMinutes, $notificationId, $source,
       $createdAt, $updatedAt
     )`,
    {
      $checkInDelayMinutes: requireNonNegativeInteger(
        input.checkInDelayMinutes ?? 180,
        'Check-in delay',
      ),
      $createdAt: timestamp,
      $imageUri: normalizeOptionalText(input.imageUri, 'Image URI', 2_000),
      $name: requireNonEmptyText(input.name, 'Meal name'),
      $notificationId: normalizeOptionalText(input.notificationId, 'Notification ID', 500),
      $occurredAt: requireIsoTimestamp(input.occurredAt, 'Meal time'),
      $source: source,
      $updatedAt: timestamp,
    },
  );
  const mealId = requirePositiveId(result.lastInsertRowId, 'Meal ID');
  await replaceMealFactors(db, mealId, input.factors ?? [], timestamp);
  return mealId;
}

export type FactorRepository = {
  createCustom: (input: { key: string; label: string }) => Promise<Factor>;
  deleteCustom: (id: number) => Promise<boolean>;
  findByKey: (key: string) => Promise<Factor | null>;
  list: () => Promise<readonly Factor[]>;
  renameCustom: (id: number, label: string) => Promise<Factor>;
};

export function createFactorRepository(
  db: SQLiteDatabase,
  options?: RepositoryOptions,
): FactorRepository {
  async function findByKey(key: string): Promise<Factor | null> {
    const row = await db.getFirstAsync<FactorRow>(
      `SELECT id, key, label, is_custom, created_at
       FROM factors WHERE key = $key`,
      { $key: requireFactorKey(key) },
    );
    return row ? mapFactorRow(row) : null;
  }

  return {
    async createCustom(input) {
      const key = requireFactorKey(input.key);
      await db.runAsync(
        `INSERT INTO factors (key, label, is_custom, created_at)
         VALUES ($key, $label, 1, $createdAt)`,
        {
          $createdAt: nowIso(options),
          $key: key,
          $label: requireNonEmptyText(input.label, 'Factor label', 120),
        },
      );
      const factor = await findByKey(key);

      if (!factor) {
        throw new DiaryIntegrityError('The custom factor could not be read after insertion.');
      }

      return factor;
    },

    async deleteCustom(id) {
      const result = await db.runAsync(
        'DELETE FROM factors WHERE id = $id AND is_custom = 1',
        { $id: requirePositiveId(id, 'Factor ID') },
      );
      return result.changes > 0;
    },

    findByKey,

    async list() {
      const rows = await db.getAllAsync<FactorRow>(
        `SELECT id, key, label, is_custom, created_at
         FROM factors ORDER BY label COLLATE NOCASE, id`,
      );
      return rows.map(mapFactorRow);
    },

    async renameCustom(id, label) {
      const factorId = requirePositiveId(id, 'Factor ID');
      const result = await db.runAsync(
        'UPDATE factors SET label = $label WHERE id = $id AND is_custom = 1',
        { $id: factorId, $label: requireNonEmptyText(label, 'Factor label', 120) },
      );

      if (result.changes === 0) {
        throw new DiaryNotFoundError('factor');
      }

      const row = await db.getFirstAsync<FactorRow>(
        'SELECT id, key, label, is_custom, created_at FROM factors WHERE id = $id',
        { $id: factorId },
      );

      if (!row) {
        throw new DiaryIntegrityError('The custom factor could not be read after editing.');
      }

      return mapFactorRow(row);
    },
  };
}

export type MealRepository = {
  create: (input: CreateMealInput) => Promise<Meal>;
  delete: (id: number) => Promise<boolean>;
  findById: (id: number) => Promise<Meal | null>;
  list: (range?: DateRange) => Promise<readonly Meal[]>;
  update: (id: number, input: UpdateMealInput) => Promise<Meal>;
};

export function createMealRepository(
  db: SQLiteDatabase,
  source: DiarySource,
  options?: RepositoryOptions,
): MealRepository {
  return {
    async create(input) {
      let mealId: number | null = null;
      await withWriteTransaction(db, async (transaction) => {
        mealId = await insertMealWithinTransaction(transaction, source, input, nowIso(options));
      });

      if (mealId === null) {
        throw new DiaryIntegrityError('The meal transaction completed without an ID.');
      }

      const meal = await selectMealById(db, source, mealId);

      if (!meal) {
        throw new DiaryIntegrityError('The meal could not be read after insertion.');
      }

      return meal;
    },

    async delete(id) {
      const result = await db.runAsync(
        'DELETE FROM meals WHERE id = $id AND source = $source',
        { $id: requirePositiveId(id, 'Meal ID'), $source: source },
      );
      return result.changes > 0;
    },

    findById(id) {
      return selectMealById(db, source, id);
    },

    async list(range) {
      const query = normalizeDateRange(range);
      const rows = await db.getAllAsync<MealJoinRow>(
        `WITH selected_meals AS (
           SELECT * FROM meals
           WHERE source = $source
             AND ($after IS NULL OR occurred_at >= $after)
             AND ($before IS NULL OR occurred_at < $before)
           ORDER BY occurred_at DESC, id DESC
           LIMIT $limit
         )
         SELECT ${MEAL_JOIN_COLUMNS}
         FROM selected_meals m
         LEFT JOIN meal_factors mf ON mf.meal_id = m.id
         LEFT JOIN factors f ON f.id = mf.factor_id
         ORDER BY m.occurred_at DESC, m.id DESC, f.label COLLATE NOCASE, f.id`,
        { ...query, $source: source },
      );
      return mapMealRows(rows);
    },

    async update(id, input) {
      const mealId = requirePositiveId(id, 'Meal ID');
      await withWriteTransaction(db, async (transaction) => {
        const existing = await selectMealById(transaction, source, mealId);

        if (!existing) {
          throw new DiaryNotFoundError('meal');
        }

        const timestamp = nowIso(options);
        await transaction.runAsync(
          `UPDATE meals SET
             occurred_at = $occurredAt,
             name = $name,
             image_uri = $imageUri,
             check_in_delay_minutes = $checkInDelayMinutes,
             notification_id = $notificationId,
             updated_at = $updatedAt
           WHERE id = $id AND source = $source`,
          {
            $checkInDelayMinutes: requireNonNegativeInteger(
              input.checkInDelayMinutes ?? existing.checkInDelayMinutes,
              'Check-in delay',
            ),
            $id: mealId,
            $imageUri:
              input.imageUri === undefined
                ? existing.imageUri
                : normalizeOptionalText(input.imageUri, 'Image URI', 2_000),
            $name: requireNonEmptyText(input.name ?? existing.name, 'Meal name'),
            $notificationId:
              input.notificationId === undefined
                ? existing.notificationId
                : normalizeOptionalText(input.notificationId, 'Notification ID', 500),
            $occurredAt: requireIsoTimestamp(
              input.occurredAt ?? existing.occurredAt,
              'Meal time',
            ),
            $source: source,
            $updatedAt: timestamp,
          },
        );

        if (input.factors) {
          await replaceMealFactors(transaction, mealId, input.factors, timestamp);
        }
      });

      const meal = await selectMealById(db, source, mealId);

      if (!meal) {
        throw new DiaryIntegrityError('The meal could not be read after editing.');
      }

      return meal;
    },
  };
}
