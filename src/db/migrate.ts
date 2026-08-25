import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export const DATABASE_NAME = 'after.db';
export const DATABASE_VERSION = 1;

type FactorSeed = {
  key: string;
  label: string;
};

const INITIAL_FACTORS: readonly FactorSeed[] = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'caffeine', label: 'Caffeine' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'spicy', label: 'Spicy food' },
  { key: 'high-fat', label: 'High-fat food' },
  { key: 'artificial-sweeteners', label: 'Artificial sweeteners' },
  { key: 'large-meal', label: 'Large meal' },
] as const;

type UserVersionRow = {
  user_version: number;
};

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const versionRow = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error(
      `This diary was created by a newer version of After (schema ${currentVersion}). Update the app before opening it.`,
    );
  }

  if (currentVersion === 0) {
    await migrateToVersionOne(db);
  }
}

async function migrateToVersionOne(db: SQLiteDatabase): Promise<void> {
  const appliedAt = new Date().toISOString();

  const runMigration = async (transaction: SQLiteDatabase) => {
    await transaction.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        occurred_at TEXT NOT NULL,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        image_uri TEXT,
        check_in_delay_minutes INTEGER NOT NULL DEFAULT 180 CHECK (check_in_delay_minutes >= 0),
        notification_id TEXT,
        source TEXT NOT NULL DEFAULT 'real' CHECK (source IN ('real', 'sample')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS factors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meal_factors (
        meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
        factor_id INTEGER NOT NULL REFERENCES factors(id) ON DELETE RESTRICT,
        suggestion_source TEXT NOT NULL DEFAULT 'manual'
          CHECK (suggestion_source IN ('manual', 'fixture', 'photo_analysis')),
        confirmed INTEGER NOT NULL DEFAULT 1 CHECK (confirmed IN (0, 1)),
        PRIMARY KEY (meal_id, factor_id)
      );

      CREATE TABLE IF NOT EXISTS symptom_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meal_id INTEGER REFERENCES meals(id) ON DELETE SET NULL,
        occurred_at TEXT NOT NULL,
        stool_consistency INTEGER NOT NULL CHECK (stool_consistency BETWEEN 1 AND 7),
        urgency TEXT NOT NULL CHECK (urgency IN ('none', 'moderate', 'strong')),
        cramping INTEGER NOT NULL CHECK (cramping BETWEEN 0 AND 3),
        bloating INTEGER NOT NULL CHECK (bloating BETWEEN 0 AND 3),
        note TEXT,
        source TEXT NOT NULL DEFAULT 'real' CHECK (source IN ('real', 'sample')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_context (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        local_date TEXT NOT NULL,
        stress TEXT CHECK (stress IS NULL OR stress IN ('low', 'medium', 'high')),
        sleep_quality INTEGER CHECK (sleep_quality IS NULL OR sleep_quality BETWEEN 1 AND 5),
        exercised INTEGER CHECK (exercised IS NULL OR exercised IN (0, 1)),
        medication_change TEXT,
        unusual_day_note TEXT,
        source TEXT NOT NULL DEFAULT 'real' CHECK (source IN ('real', 'sample')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (local_date, source)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS meals_occurred_at_index ON meals(occurred_at);
      CREATE INDEX IF NOT EXISTS meals_source_index ON meals(source);
      CREATE INDEX IF NOT EXISTS symptoms_occurred_at_index ON symptom_events(occurred_at);
      CREATE INDEX IF NOT EXISTS symptoms_meal_id_index ON symptom_events(meal_id);
      CREATE INDEX IF NOT EXISTS symptoms_source_index ON symptom_events(source);
    `);

    for (const factor of INITIAL_FACTORS) {
      await transaction.runAsync(
        `INSERT OR IGNORE INTO factors (key, label, is_custom, created_at)
         VALUES ($key, $label, 0, $createdAt)`,
        { $createdAt: appliedAt, $key: factor.key, $label: factor.label },
      );
    }

    await transaction.runAsync(
      'INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      DATABASE_VERSION,
      appliedAt,
    );
    await transaction.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  };

  if (Platform.OS === 'web') {
    await db.withTransactionAsync(() => runMigration(db));
    return;
  }

  await db.withExclusiveTransactionAsync(runMigration);
}
