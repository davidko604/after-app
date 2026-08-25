import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryValidationError } from './errors';
import type { DateRange, DiarySource, Stress, SuggestionSource, Urgency } from './model';

export type RepositoryOptions = {
  now?: () => Date;
};

export function nowIso(options?: RepositoryOptions): string {
  const value = (options?.now ?? (() => new Date()))();

  if (Number.isNaN(value.getTime())) {
    throw new DiaryValidationError('The repository clock returned an invalid date.');
  }

  return value.toISOString();
}

export function requirePositiveId(value: number, field = 'ID'): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DiaryValidationError(`${field} must be a positive integer.`);
  }

  return value;
}

export function requireIntegerInRange(
  value: number,
  minimum: number,
  maximum: number,
  field: string,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new DiaryValidationError(`${field} must be an integer from ${minimum} to ${maximum}.`);
  }

  return value;
}

export function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DiaryValidationError(`${field} must be a non-negative integer.`);
  }

  return value;
}

export function requireNonEmptyText(value: string, field: string, maxLength = 500): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new DiaryValidationError(`${field} is required.`);
  }

  if (normalized.length > maxLength) {
    throw new DiaryValidationError(`${field} is too long.`);
  }

  return normalized;
}

export function normalizeOptionalText(
  value: string | null | undefined,
  field: string,
  maxLength = 4_000,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    throw new DiaryValidationError(`${field} is too long.`);
  }

  return normalized;
}

export function requireIsoTimestamp(value: string, field: string): string {
  const normalized = requireNonEmptyText(value, field, 80);
  const parsed = Date.parse(normalized);

  if (Number.isNaN(parsed)) {
    throw new DiaryValidationError(`${field} must be a valid ISO timestamp.`);
  }

  return new Date(parsed).toISOString();
}

export function requireLocalDate(value: string): string {
  const normalized = requireNonEmptyText(value, 'Local date', 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new DiaryValidationError('Local date must use YYYY-MM-DD format.');
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new DiaryValidationError('Local date must be a real calendar date.');
  }

  return normalized;
}

export function requireFactorKey(value: string): string {
  const normalized = requireNonEmptyText(value, 'Factor key', 80).toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new DiaryValidationError('Factor key must contain lowercase words separated by hyphens.');
  }

  return normalized;
}

export function requireSettingKey(value: string): string {
  const normalized = requireNonEmptyText(value, 'Setting key', 120);

  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new DiaryValidationError('Setting key contains unsupported characters.');
  }

  return normalized;
}

export function requireSource(value: string): DiarySource {
  if (value === 'real' || value === 'sample') {
    return value;
  }

  throw new DiaryIntegrityError('The database contains an unsupported diary source.');
}

export function requireSuggestionSource(value: string): SuggestionSource {
  if (value === 'manual' || value === 'fixture' || value === 'photo_analysis') {
    return value;
  }

  throw new DiaryIntegrityError('The database contains an unsupported suggestion source.');
}

export function requireUrgency(value: string): Urgency {
  if (value === 'none' || value === 'moderate' || value === 'strong') {
    return value;
  }

  throw new DiaryIntegrityError('The database contains an unsupported urgency value.');
}

export function validateUrgency(value: Urgency): Urgency {
  if (value === 'none' || value === 'moderate' || value === 'strong') {
    return value;
  }

  throw new DiaryValidationError('Urgency is invalid.');
}

export function requireStress(value: string | null): Stress | null {
  if (value === null || value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new DiaryIntegrityError('The database contains an unsupported stress value.');
}

export function validateStress(value: Stress | null | undefined): Stress | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new DiaryValidationError('Stress is invalid.');
}

export function sqliteBoolean(value: boolean): number {
  return value ? 1 : 0;
}

export function requireSqliteBoolean(value: number, field: string): boolean {
  if (value === 0) {
    return false;
  }

  if (value === 1) {
    return true;
  }

  throw new DiaryIntegrityError(`The database contains an invalid ${field} flag.`);
}

export function requireNullableSqliteBoolean(value: number | null, field: string): boolean | null {
  return value === null ? null : requireSqliteBoolean(value, field);
}

export function normalizeDateRange(range?: DateRange): {
  $after: string | null;
  $before: string | null;
  $limit: number;
} {
  const limit = range?.limit ?? 100;

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DiaryValidationError('Query limit must be an integer from 1 to 500.');
  }

  return {
    $after: range?.after ? requireIsoTimestamp(range.after, 'Range start') : null,
    $before: range?.before ? requireIsoTimestamp(range.before, 'Range end') : null,
    $limit: limit,
  };
}

export async function withWriteTransaction(
  db: SQLiteDatabase,
  task: (transaction: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  if (process.env.EXPO_OS === 'web') {
    await db.withTransactionAsync(() => task(db));
    return;
  }

  await db.withExclusiveTransactionAsync(task);
}

