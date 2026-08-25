import type { SQLiteDatabase } from 'expo-sqlite';

import { DiaryIntegrityError, DiaryValidationError } from './errors';
import {
  nowIso,
  requireIntegerInRange,
  requireIsoTimestamp,
  requireSettingKey,
  type RepositoryOptions,
} from './internal';
import type { AppSetting, AppSettingMetadata, SettingCodec } from './model';

type SettingRow = {
  key: string;
  updated_at: string;
  value: string;
};

type SettingMetadataRow = {
  key: string;
  updated_at: string;
};

function requireSerializedSetting(value: string): string {
  if (value.length > 50_000) {
    throw new DiaryValidationError('The serialized setting is too large.');
  }

  return value;
}

export const booleanSettingCodec: SettingCodec<boolean> = {
  decode(serialized) {
    if (serialized === 'true') {
      return true;
    }

    if (serialized === 'false') {
      return false;
    }

    throw new DiaryIntegrityError('The stored setting is not a boolean.');
  },
  encode(value) {
    return value ? 'true' : 'false';
  },
};

export const stringSettingCodec: SettingCodec<string> = {
  decode: requireSerializedSetting,
  encode: requireSerializedSetting,
};

export function integerSettingCodec(minimum: number, maximum: number): SettingCodec<number> {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    throw new DiaryValidationError('Integer setting bounds are invalid.');
  }

  return {
    decode(serialized) {
      if (!/^-?\d+$/.test(serialized)) {
        throw new DiaryIntegrityError('The stored setting is not an integer.');
      }

      const value = Number(serialized);

      try {
        return requireIntegerInRange(value, minimum, maximum, 'Setting value');
      } catch {
        throw new DiaryIntegrityError('The stored integer setting is outside its allowed range.');
      }
    },
    encode(value) {
      return String(requireIntegerInRange(value, minimum, maximum, 'Setting value'));
    },
  };
}

export function jsonSettingCodec<T>(decodeValue: (value: unknown) => T): SettingCodec<T> {
  return {
    decode(serialized) {
      let parsed: unknown;

      try {
        parsed = JSON.parse(serialized);
      } catch {
        throw new DiaryIntegrityError('The stored JSON setting is malformed.');
      }

      return decodeValue(parsed);
    },
    encode(value) {
      const serialized = JSON.stringify(value);

      if (serialized === undefined) {
        throw new DiaryValidationError('The setting cannot be serialized as JSON.');
      }

      return requireSerializedSetting(serialized);
    },
  };
}

export type AppSettingsRepository = {
  delete: (key: string) => Promise<boolean>;
  get: <T>(key: string, codec: SettingCodec<T>) => Promise<AppSetting<T> | null>;
  listMetadata: () => Promise<readonly AppSettingMetadata[]>;
  set: <T>(key: string, value: T, codec: SettingCodec<T>) => Promise<AppSetting<T>>;
};

export function createAppSettingsRepository(
  db: SQLiteDatabase,
  options?: RepositoryOptions,
): AppSettingsRepository {
  async function get<T>(key: string, codec: SettingCodec<T>): Promise<AppSetting<T> | null> {
    const normalizedKey = requireSettingKey(key);
    const row = await db.getFirstAsync<SettingRow>(
      'SELECT key, value, updated_at FROM app_settings WHERE key = $key',
      { $key: normalizedKey },
    );

    if (!row) {
      return null;
    }

    return {
      key: requireSettingKey(row.key),
      updatedAt: requireIsoTimestamp(row.updated_at, 'Setting update time'),
      value: codec.decode(row.value),
    };
  }

  return {
    async delete(key) {
      const result = await db.runAsync('DELETE FROM app_settings WHERE key = $key', {
        $key: requireSettingKey(key),
      });
      return result.changes > 0;
    },

    get,

    async listMetadata() {
      const rows = await db.getAllAsync<SettingMetadataRow>(
        'SELECT key, updated_at FROM app_settings ORDER BY key',
      );
      return rows.map((row) => ({
        key: requireSettingKey(row.key),
        updatedAt: requireIsoTimestamp(row.updated_at, 'Setting update time'),
      }));
    },

    async set<T>(key: string, value: T, codec: SettingCodec<T>) {
      const normalizedKey = requireSettingKey(key);
      const timestamp = nowIso(options);
      await db.runAsync(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($key, $value, $updatedAt)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at`,
        {
          $key: normalizedKey,
          $updatedAt: timestamp,
          $value: requireSerializedSetting(codec.encode(value)),
        },
      );
      const setting = await get(normalizedKey, codec);

      if (!setting) {
        throw new DiaryIntegrityError('The setting could not be read after saving.');
      }

      return setting;
    },
  };
}

