import { Host, Switch } from '@expo/ui';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, SectionTitle, StatusPill } from '@/components/app-ui';
import { palette, spacing } from '@/constants/theme';
import { DATABASE_VERSION } from '@/db/migrate';
import { usePrototypeState } from '@/features/prototype/prototype-state';

type UserVersionRow = { user_version: number };
type DatabaseState =
  | { status: 'error' }
  | { status: 'loading' }
  | { status: 'ready'; version: number }
  | { status: 'unexpected'; version: number };

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { reset, sampleDataEnabled, setSampleDataEnabled } = usePrototypeState();
  const [databaseState, setDatabaseState] = useState<DatabaseState>({ status: 'loading' });
  const [resetComplete, setResetComplete] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadVersion() {
      try {
        const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
        const version = row?.user_version ?? 0;

        if (active) {
          setDatabaseState(
            version === DATABASE_VERSION
              ? { status: 'ready', version }
              : { status: 'unexpected', version },
          );
        }
      } catch {
        if (active) {
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

  function handleSampleDataChange(enabled: boolean) {
    setResetComplete(false);
    setSampleDataEnabled(enabled);
  }

  function confirmReset() {
    reset();
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
          created by the current demo flow remain in memory and reset when the app restarts.
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
              onValueChange={handleSampleDataChange}
              testID="settings-sample-data"
              value={sampleDataEnabled}
            />
          </Host>
          <Body>18 days of clearly labeled synthetic meals, symptoms, and counterexamples.</Body>
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
              delete records from the local SQLite database.
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
                onPress={confirmReset}
                testID="settings-reset-approve"
              />
            </View>
          </View>
        ) : (
          <ActionButton
            label="Reset current demo"
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
            Current demo reset.
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
