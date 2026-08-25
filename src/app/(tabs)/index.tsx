import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Body,
  Card,
  EmptyState,
  Eyebrow,
  Heading,
  Screen,
  SectionTitle,
  StatusPill,
} from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { usePrototypeState } from '@/features/prototype/prototype-state';

type CountRow = { count: number };
type DiarySummary = { meals: number; symptoms: number };
type DiarySummaryState =
  | { status: 'error' }
  | { status: 'loading' }
  | { status: 'ready'; summary: DiarySummary };

const todayLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
}).format(new Date());

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const { meal, symptom } = usePrototypeState();
  const requestId = useRef(0);
  const [summaryState, setSummaryState] = useState<DiarySummaryState>({ status: 'loading' });

  const loadSummary = useCallback(async () => {
    const activeRequest = ++requestId.current;
    setSummaryState({ status: 'loading' });

    try {
      const [mealRow, symptomRow] = await Promise.all([
        db.getFirstAsync<CountRow>("SELECT COUNT(*) AS count FROM meals WHERE source = 'real'"),
        db.getFirstAsync<CountRow>(
          "SELECT COUNT(*) AS count FROM symptom_events WHERE source = 'real'",
        ),
      ]);

      if (activeRequest === requestId.current) {
        setSummaryState({
          status: 'ready',
          summary: { meals: mealRow?.count ?? 0, symptoms: symptomRow?.count ?? 0 },
        });
      }
    } catch {
      if (activeRequest === requestId.current) {
        setSummaryState({ status: 'error' });
      }
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();

      return () => {
        requestId.current += 1;
      };
    }, [loadSummary]),
  );

  const prototypeCount = (meal ? 1 : 0) + (symptom ? 1 : 0);
  const summary = summaryState.status === 'ready' ? summaryState.summary : null;
  const realCount = summary ? summary.meals + summary.symptoms : 0;
  const entryCount = realCount + prototypeCount;
  const isEmpty = summaryState.status === 'ready' && entryCount === 0;
  const entryLabel = `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;

  return (
    <Screen>
      <View style={styles.header} testID="timeline-screen">
        <View style={styles.brandRow}>
          <View accessibilityElementsHidden style={styles.brandMark}>
            <View style={styles.brandDot} />
            <View style={styles.brandBowl} />
          </View>
          <Text accessibilityRole="header" style={styles.brandName}>After</Text>
          <StatusPill tone="peach">Current-session demo</StatusPill>
        </View>
        <Eyebrow>{todayLabel}</Eyebrow>
        <Heading>Notice what happens after.</Heading>
        <Body>Log a meal now. Check in later. Build a clearer picture from your observations.</Body>
      </View>

      <View style={styles.actions}>
        <ActionButton
          accessibilityHint="Opens the meal entry screen"
          label="Log meal"
          onPress={() => router.push('/meal/new')}
          testID="timeline-log-meal"
        />
        <ActionButton
          accessibilityHint="Opens a quick symptom check-in without selecting a meal"
          label="Log symptoms"
          onPress={() => router.push({ pathname: '/check-in/[mealId]', params: { mealId: 'unlinked' } })}
          testID="timeline-log-symptom"
          variant="secondary"
        />
      </View>

      <View style={styles.sectionHeader}>
        <SectionTitle>Today</SectionTitle>
        <StatusPill tone={summaryState.status === 'error' ? 'peach' : 'sage'}>
          {summaryState.status === 'loading'
            ? 'Reading diary'
            : summaryState.status === 'error'
              ? 'Unavailable'
              : entryLabel}
        </StatusPill>
      </View>

      {summaryState.status === 'loading' ? (
        <View accessibilityLiveRegion="polite" testID="timeline-loading">
          <Card style={styles.loadingCard}>
            <Text style={styles.loadingTitle}>Reading this device</Text>
            <Body>Checking the local diary before showing today&apos;s entries.</Body>
          </Card>
        </View>
      ) : summaryState.status === 'error' ? (
        <View testID="timeline-error">
          <Card style={styles.errorCard}>
            <Text accessibilityRole="alert" selectable style={styles.errorTitle}>
              Timeline unavailable
            </Text>
            <Body>
              After could not read the local diary. The current-session demo flow is still
              available, but it will not persist new entries in this build.
            </Body>
            <View style={styles.retryAction}>
              <ActionButton
                label="Retry timeline"
                onPress={() => void loadSummary()}
                testID="timeline-retry"
                variant="secondary"
              />
            </View>
          </Card>
        </View>
      ) : isEmpty ? (
        <View testID="timeline-empty">
          <EmptyState
            body="Your first demo meal or symptom entry will appear here for this app session. Entries created in this preview are not yet saved across restarts."
            icon={<View style={styles.emptyIcon}><View style={styles.emptyIconLine} /></View>}
            title="A quiet timeline is a good place to start"
          />
        </View>
      ) : (
        <View testID="timeline-ready">
          <Card>
            {symptom ? (
              <View style={styles.timelineItem} testID="timeline-symptom-entry">
                <View style={[styles.timelineIcon, styles.symptomIcon]}><Text style={styles.timelineGlyph}>◌</Text></View>
                <View style={styles.timelineCopy}>
                  <Text style={styles.entryTitle}>Symptom check-in</Text>
                  <Text style={styles.entryMetadata}>
                    Just now · Stool {symptom.stoolConsistency} · {symptom.urgency} urgency ·
                    cramping {symptom.cramping} · bloating {symptom.bloating}
                  </Text>
                  {meal ? <Text style={styles.association}>Meal: {meal.name}</Text> : null}
                </View>
              </View>
            ) : null}
            {meal ? (
              <View style={styles.timelineItem} testID="timeline-meal-entry">
                {meal.photoUri ? (
                  <Image accessibilityLabel="Meal thumbnail" contentFit="cover" source={meal.photoUri} style={styles.mealImage} />
                ) : (
                  <View style={styles.timelineIcon}><Text style={styles.timelineGlyph}>●</Text></View>
                )}
                <View style={styles.timelineCopy}>
                  <Text style={styles.entryTitle}>{meal.name}</Text>
                  <Text style={styles.entryMetadata}>A moment ago · Current session</Text>
                  <View style={styles.tags}>
                    {meal.factors.map((factor) => <Text key={factor} style={styles.tag}>{factor}</Text>)}
                  </View>
                </View>
              </View>
            ) : null}
            {realCount > 0 ? (
              <Body style={styles.realSummary}>
                This device also has {summary?.meals ?? 0} persisted meal records and{' '}
                {summary?.symptoms ?? 0} persisted symptom records. This preview can count those
                records, but does not list their details yet.
              </Body>
            ) : null}
          </Card>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <SectionTitle>Pending check-ins</SectionTitle>
        <StatusPill tone="peach">{meal && !symptom ? 'Ready now' : 'None ready'}</StatusPill>
      </View>
      {meal && !symptom ? (
        <Card style={styles.pendingCard}>
          <Text style={styles.entryTitle}>Check in after {meal.name}</Text>
          <Body style={styles.pendingBody}>
            Reminders are not scheduled in this build, so this card keeps the manual check-in
            available.
          </Body>
          <ActionButton
            label="Check in now"
            onPress={() => router.push({ pathname: '/check-in/[mealId]', params: { mealId: 'prototype-meal' } })}
            testID="timeline-pending-check-in"
            variant="secondary"
          />
        </Card>
      ) : (
        <Card style={styles.pendingCard}>
          <Body>
            {symptom
              ? 'Your latest meal check-in is complete. Repeated observations will make comparisons more useful.'
              : 'Reminders are not scheduled in this build. After you log a demo meal, its manual check-in will appear here.'}
          </Body>
        </Card>
      )}

      {symptom ? (
        <ActionButton
          label="See how patterns will look"
          onPress={() => router.push('/patterns')}
          testID="timeline-view-patterns"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  association: { color: palette.forest, fontSize: 12, fontWeight: '800', marginTop: spacing.xs },
  brandBowl: {
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18, borderColor: palette.card,
    borderTopWidth: 0, borderWidth: 3, bottom: 7, height: 13, left: 8, position: 'absolute', width: 24,
  },
  brandDot: { backgroundColor: palette.peach, borderRadius: 5, height: 9, position: 'absolute', right: 8, top: 7, width: 9 },
  brandMark: { backgroundColor: palette.forest, borderRadius: 13, height: 40, position: 'relative', width: 40 },
  brandName: { color: palette.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: spacing.sm },
  emptyIcon: { alignItems: 'center', backgroundColor: palette.sage, borderRadius: radii.pill, height: 64, justifyContent: 'center', width: 64 },
  emptyIconLine: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20, borderColor: palette.forest, borderTopWidth: 0, borderWidth: 3, height: 15, width: 34 },
  entryMetadata: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 3, textTransform: 'capitalize' },
  entryTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  errorCard: { borderColor: palette.danger },
  errorTitle: { color: palette.danger, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  header: { gap: spacing.sm, paddingBottom: spacing.sm, paddingTop: spacing.md },
  loadingCard: { backgroundColor: palette.sage },
  loadingTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  mealImage: { borderRadius: radii.md, height: 54, width: 54 },
  pendingBody: { marginBottom: spacing.md, marginTop: spacing.sm },
  pendingCard: { backgroundColor: palette.peachSoft },
  realSummary: { borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.md, paddingTop: spacing.md },
  retryAction: { marginTop: spacing.md },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  symptomIcon: { backgroundColor: palette.peachSoft },
  tag: { backgroundColor: palette.sage, borderRadius: radii.pill, color: palette.forestPressed, fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  timelineCopy: { flex: 1 },
  timelineGlyph: { color: palette.forest, fontSize: 20, fontWeight: '900' },
  timelineIcon: { alignItems: 'center', backgroundColor: palette.sage, borderRadius: radii.md, height: 54, justifyContent: 'center', width: 54 },
  timelineItem: { alignItems: 'flex-start', borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
});
