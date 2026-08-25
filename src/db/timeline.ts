import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryValidationError } from './errors';
import { requireIsoTimestamp, requirePositiveId } from './internal';
import type {
  DateRange,
  DiarySource,
  PendingMealCheckIn,
  TimelineEntry,
  TimelineSummary,
} from './model';
import type { MealRepository } from './meals';
import type { SymptomRepository } from './symptoms';

type CountRow = {
  count: number;
};

type PendingMealRow = {
  due_at: string;
  id: number;
};

function normalizeTimelineLimit(limit = 100): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DiaryValidationError('Timeline limit must be an integer from 1 to 500.');
  }

  return limit;
}

export type TimelineRepository = {
  getSummary: () => Promise<TimelineSummary>;
  list: (range?: DateRange) => Promise<readonly TimelineEntry[]>;
  listPendingMealCheckIns: (options?: {
    asOf?: string;
    limit?: number;
  }) => Promise<readonly PendingMealCheckIn[]>;
};

export function createTimelineRepository(
  db: SQLiteDatabase,
  source: DiarySource,
  meals: MealRepository,
  symptoms: SymptomRepository,
): TimelineRepository {
  return {
    async getSummary() {
      const [mealRow, symptomRow] = await Promise.all([
        db.getFirstAsync<CountRow>('SELECT COUNT(*) AS count FROM meals WHERE source = $source', {
          $source: source,
        }),
        db.getFirstAsync<CountRow>(
          'SELECT COUNT(*) AS count FROM symptom_events WHERE source = $source',
          { $source: source },
        ),
      ]);
      const mealCount = mealRow?.count ?? 0;
      const symptomCount = symptomRow?.count ?? 0;

      if (!Number.isInteger(mealCount) || mealCount < 0 || !Number.isInteger(symptomCount) || symptomCount < 0) {
        throw new DiaryIntegrityError('The database returned invalid timeline counts.');
      }

      return {
        meals: mealCount,
        symptoms: symptomCount,
        total: mealCount + symptomCount,
      };
    },

    async list(range) {
      const limit = normalizeTimelineLimit(range?.limit);
      const query = { ...range, limit };
      const [mealRows, symptomRows] = await Promise.all([
        meals.list(query),
        symptoms.list(query),
      ]);
      const entries: TimelineEntry[] = [
        ...mealRows.map<TimelineEntry>((meal) => ({
          id: meal.id,
          kind: 'meal',
          meal,
          occurredAt: meal.occurredAt,
        })),
        ...symptomRows.map<TimelineEntry>((symptom) => ({
          id: symptom.id,
          kind: 'symptom',
          occurredAt: symptom.occurredAt,
          symptom,
        })),
      ];

      entries.sort((left, right) => {
        const byTime = right.occurredAt.localeCompare(left.occurredAt);

        if (byTime !== 0) {
          return byTime;
        }

        if (left.kind !== right.kind) {
          return left.kind === 'symptom' ? -1 : 1;
        }

        return right.id - left.id;
      });

      return entries.slice(0, limit);
    },

    async listPendingMealCheckIns(options) {
      const limit = normalizeTimelineLimit(options?.limit ?? 50);
      const asOf = requireIsoTimestamp(options?.asOf ?? new Date().toISOString(), 'As-of time');
      const rows = await db.getAllAsync<PendingMealRow>(
        `SELECT
           m.id,
           strftime(
             '%Y-%m-%dT%H:%M:%fZ',
             m.occurred_at,
             '+' || m.check_in_delay_minutes || ' minutes'
           ) AS due_at
         FROM meals m
         WHERE m.source = $source
           AND unixepoch(m.occurred_at) + (m.check_in_delay_minutes * 60) <= unixepoch($asOf)
           AND NOT EXISTS (
             SELECT 1 FROM symptom_events s
             WHERE s.meal_id = m.id AND s.source = m.source
           )
         ORDER BY due_at ASC, m.id ASC
         LIMIT $limit`,
        { $asOf: asOf, $limit: limit, $source: source },
      );
      const pending: PendingMealCheckIn[] = [];

      for (const row of rows) {
        const meal = await meals.findById(requirePositiveId(row.id, 'Meal ID'));

        if (!meal) {
          throw new DiaryIntegrityError('A pending check-in references a missing meal.');
        }

        pending.push({
          dueAt: requireIsoTimestamp(row.due_at, 'Check-in due time'),
          meal,
        });
      }

      return pending;
    },
  };
}

