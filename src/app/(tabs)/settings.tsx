import { Host, Switch } from '@expo/ui';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, SectionTitle, StatusPill } from '@/components/app-ui';
import { palette, spacing } from '@/constants/theme';
import { booleanSettingCodec, createDiaryDataLayer } from '@/db';
import { DATABASE_VERSION } from '@/db/migrate';
import { SYNTHETIC_SAMPLE_HISTORY } from '@/features/patterns';
import {
  SAMPLE_DATA_ENABLED_SETTING,
  sampleHistoryToDataset,
} from '@/features/patterns/sample-dataset';

type UserVersionRow = { user_version: number };
type DatabaseState =
  | { status: 'error' }
  | { status: 'loading' }
  | { status: 'ready'; version: number }
  | { status: 'unexpected'; version: number };

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [databaseState, setDatabaseState] = useState<DatabaseState>({ status: 'loading' });
  const [sampleDataEnabled, setSampleDataEnabled] = useState(false);
  const [sampleDataBusy, setSampleDataBusy] = useState(true);
  const [sampleDataError, setSampleDataError] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadVersion() {
      try {
        const diary = createDiaryDataLayer(db);
        const [row, sampleSetting] = await Promise.all([
          db.getFirstAsync<UserVersionRow>('PRAGMA user_version'),
          diary.settings.get(SAMPLE_DATA_ENABLED_SETTING, booleanSettingCodec),
        ]);
        const version = row?.user_version ?? 0;

        if (active) {
          setSampleDataEnabled(sampleSetting?.value ?? false);
          setSampleDataBusy(false);
          setDatabaseState(
            version === DATABASE_VERSION
              ? { status: 'ready', version }
              : { status: 'unexpected', version },
          );
        }
      } catch {
        if (active) {
          setSampleDataBusy(false);
          setDatabaseState({ status: 'error' });
        }
      }
    }

    void loadVersion();

    return () => {
      active = false;
    };
  }, [db]);

  const databaseLabel =
    databaseState.status === 'loading'
      ? 'Checking'
      : databaseState.status === 'ready'
        ? 'Ready'
        : databaseState.status === 'unexpected'
          ? 'Needs attention'
          : 'Check failed';

  async function handleSampleDataChange(enabled: boolean) {
    if (sampleDataBusy) {
      return;
    }

    setResetComplete(false);
    setSampleDataBusy(true);
    setSampleDataError(null);

    try {
      const diary = createDiaryDataLayer(db);
      if (enabled) {
        await diary.sampleData.replace(sampleHistoryToDataset(SYNTHETIC_SAMPLE_HISTORY));
      } else {
        await diary.sampleData.reset();
      }
      await diary.settings.set(SAMPLE_DATA_ENABLED_SETTING, enabled, booleanSettingCodec);
      setSampleDataEnabled(enabled);
    } catch {
      setSampleDataError(
        'After could not update synthetic history. The private diary was not changed. Try again.',
      );
    } finally {
      setSampleDataBusy(false);
    }
  }

  async function confirmReset() {
    await handleSampleDataChange(false);
    setShowResetConfirmation(false);
    setResetComplete(true);
  }

  return (
    <Screen>
      <View style={styles.header} testID="settings-screen">
        <Eyebrow>Settings & demo</Eyebrow>
        <Heading>Know what this preview stores.</Heading>
        <Body>This build keeps the demo flow separate from the local diary database.</Body>
      </View>

      <View style={styles.sectionHeader}>
        <SectionTitle>Local diary</SectionTitle>
        <StatusPill tone={databaseState.status === 'ready' ? 'sage' : 'peach'}>
          {databaseLabel}
        </StatusPill>
      </View>
      <Card>
        <Text style={styles.cardTitle}>Local storage status</Text>
        <Body>
          A local SQLite diary is prepared on this device, with no account or cloud sync. Entries
          you create are saved locally and remain available across app restarts.
        </Body>
        {databaseState.status === 'loading' ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.metadata}
            testID="settings-storage-loading">
            Checking the local database…
          </Text>
        ) : databaseState.status === 'error' ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={styles.errorText}
            testID="settings-storage-error">
            After could not verify local storage. Demo entries can still be tried, but they will
            remain available only for this app session.
          </Text>
        ) : databaseState.status === 'unexpected' ? (
          <Text
            accessibilityRole="alert"
            selectable
            style={styles.errorText}
            testID="settings-storage-unexpected">
            Expected database schema {DATABASE_VERSION}, but found {databaseState.version}. Reopen
            the app before relying on local storage.
          </Text>
        ) : (
          <Text selectable style={styles.metadata} testID="settings-storage-ready">
            Local database ready · schema {databaseState.version}
          </Text>
        )}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyTitle}>Optional photo analysis</Text>
          <Body style={styles.compactBody}>
            If you explicitly ask Luna to suggest factors, the selected meal photo is sent for
            analysis. Symptom selections and the private note field are not included in that
            photo-analysis request.
          </Body>
        </View>
      </Card>

      <SectionTitle>Demo controls</SectionTitle>
      <Card style={styles.demoCard}>
        <View style={styles.controlGroup}>
          <Host matchContents={{ vertical: true }} style={styles.switchHost}>
            <Switch
              label="Sample history"
              disabled={sampleDataBusy}
              onValueChange={(enabled) => void handleSampleDataChange(enabled)}
              testID="settings-sample-data"
              value={sampleDataEnabled}
            />
          </Host>
          <Body>
            {SYNTHETIC_SAMPLE_HISTORY.metadata.dayCount} days of clearly labeled synthetic meals,
            symptoms, context, and counterexamples. Today and Patterns switch to sample-only mode.
          </Body>
          {sampleDataBusy ? (
            <Text accessibilityLiveRegion="polite" style={styles.metadata}>
              Updating sample history…
            </Text>
          ) : null}
          {sampleDataError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>
              {sampleDataError}
            </Text>
          ) : null}
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={styles.cardTitle}>Check-in reminders</Text>
            <Body>
              Notifications are not scheduled in this build. Use the pending card on Today to
              complete the manual check-in flow.
            </Body>
          </View>
          <View testID="settings-notifications-inactive">
            <StatusPill tone="peach">Not active</StatusPill>
          </View>
        </View>
        <View style={styles.divider} />
        {showResetConfirmation ? (
          <View accessibilityLiveRegion="polite" style={styles.confirmation} testID="settings-reset-confirm">
            <Text accessibilityRole="alert" style={styles.cardTitle}>Reset the current demo?</Text>
            <Body>
              This clears the in-memory meal and symptom and disables sample history. It does not
              delete your real meals or symptoms from the local SQLite diary.
            </Body>
            <View style={styles.confirmationActions}>
              <ActionButton
                label="Cancel"
                onPress={() => setShowResetConfirmation(false)}
                testID="settings-reset-cancel"
                variant="secondary"
              />
              <ActionButton
                label="Reset demo"
                onPress={() => void confirmReset()}
                testID="settings-reset-approve"
              />
            </View>
          </View>
        ) : (
          <ActionButton
            label="Clear sample history"
            onPress={() => {
              setResetComplete(false);
              setShowResetConfirmation(true);
            }}
            testID="settings-reset-prototype"
            variant="secondary"
          />
        )}
        {resetComplete ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.successText}
            testID="settings-reset-complete">
            Sample history cleared. Your private diary was not changed.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.medicalCard}>
        <Text style={styles.cardTitle}>Not medical advice</Text>
        <Body>
          After helps organize personal observations that may be useful in a conversation with a
          clinician. It does not diagnose IBS, intolerance, allergy, or any other condition.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  compactBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  confirmation: {
    backgroundColor: palette.peachSoft,
    borderRadius: spacing.sm,
    gap: spacing.sm,
    padding: spacing.md,
  },
  confirmationActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  controlGroup: {
    gap: spacing.sm,
  },
  demoCard: {
    gap: spacing.md,
  },
  divider: {
    backgroundColor: palette.border,
    height: StyleSheet.hairlineWidth,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: spacing.md,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  medicalCard: {
    backgroundColor: palette.sage,
  },
  metadata: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  privacyNote: {
    borderTopColor: palette.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  privacyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowCopy: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  successText: {
    color: palette.forest,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  switchHost: {
    width: '100%',
  },
});
