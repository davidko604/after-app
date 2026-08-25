import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import {
  booleanSettingCodec,
  createDiaryDataLayer,
  type PendingMealCheckIn,
  type TimelineEntry,
  type TimelineSummary,
} from '@/db';
import { SAMPLE_DATA_ENABLED_SETTING } from '@/features/patterns/sample-dataset';
import { sampleMealImageSource } from '@/features/patterns/sample-images';

type DiarySummaryState =
  | { status: 'error' }
  | { status: 'loading' }
  | {
      entries: readonly TimelineEntry[];
      isSampleData: boolean;
      pending: readonly PendingMealCheckIn[];
      status: 'ready';
      summary: TimelineSummary;
    };

const todayLabel = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  weekday: 'long',
}).format(new Date());

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const requestId = useRef(0);
  const [summaryState, setSummaryState] = useState<DiarySummaryState>({ status: 'loading' });

  const loadSummary = useCallback(async () => {
    const activeRequest = ++requestId.current;
    setSummaryState({ status: 'loading' });

    try {
      const diary = createDiaryDataLayer(db);
      const sampleSetting = await diary.settings.get(
        SAMPLE_DATA_ENABLED_SETTING,
        booleanSettingCodec,
      );
      const isSampleData = sampleSetting?.value ?? false;
      const timeline = isSampleData ? diary.sample.timeline : diary.real.timeline;
      const [entries, pending, summary] = await Promise.all([
        timeline.list({ limit: 100 }),
        isSampleData ? Promise.resolve([]) : timeline.listPendingMealCheckIns({ limit: 10 }),
        timeline.getSummary(),
      ]);

      if (activeRequest === requestId.current) {
        setSummaryState({ entries, isSampleData, pending, status: 'ready', summary });
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

  const summary = summaryState.status === 'ready' ? summaryState.summary : null;
  const entryCount = summary?.total ?? 0;
  const isEmpty = summaryState.status === 'ready' && summaryState.entries.length === 0;
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
          <StatusPill tone={summaryState.status === 'ready' && summaryState.isSampleData ? 'peach' : 'sage'}>
            {summaryState.status === 'ready' && summaryState.isSampleData
              ? 'Sample history'
              : 'Private on device'}
          </StatusPill>
        </View>
        <Eyebrow>{todayLabel}</Eyebrow>
        <Heading>Notice what happens after.</Heading>
        <Body>Log a meal now. Check in later. Build a clearer picture from your observations.</Body>
      </View>

      {summaryState.status === 'ready' && summaryState.isSampleData ? (
        <View testID="timeline-sample-banner">
          <Card style={styles.sampleBanner}>
            <Text style={styles.entryTitle}>Synthetic sample history</Text>
            <Body style={styles.pendingBody}>
              These meals and check-ins are fictional demo records. Your private diary is hidden,
              not changed, while sample mode is on.
            </Body>
            <ActionButton
              label="Manage sample history"
              onPress={() => router.push('/settings')}
              testID="timeline-manage-sample"
              variant="secondary"
            />
          </Card>
        </View>
      ) : null}

      <View style={styles.actions}>
        <ActionButton
          accessibilityHint="Opens the meal entry screen"
          label="Log meal"
          onPress={() => router.push('/meal/new')}
          testID="timeline-log-meal"
        />
        <ActionButton
          accessibilityHint="Opens a quick bowel-movement check-in without selecting a meal"
          accessibilityLabel="Log a bowel movement"
          label="Log a poop"
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
            body="Your first meal or symptom entry will appear here and stay in the private diary on this device."
            icon={<View style={styles.emptyIcon}><View style={styles.emptyIconLine} /></View>}
            title="A quiet timeline is a good place to start"
          />
        </View>
      ) : (
        <View testID="timeline-ready">
          <Card>
            {summaryState.entries.map((entry) =>
              entry.kind === 'meal' ? (
                <Pressable
                  accessibilityHint="Opens this saved meal"
                  accessibilityLabel={`${entry.meal.name}, ${formatEntryTime(entry.occurredAt)}`}
                  accessibilityRole="button"
                  key={`meal-${entry.id}`}
                  onPress={() =>
                    router.push({
                      pathname: '/meal/[mealId]',
                      params: {
                        mealId: String(entry.id),
                        source: summaryState.isSampleData ? 'sample' : 'real',
                      },
                    })
                  }
                  style={({ pressed }) => [styles.timelineItem, pressed && styles.entryPressed]}
                  testID={`timeline-meal-${entry.id}`}>
                  {entry.meal.imageUri ? (
                    <Image
                      accessibilityLabel="Meal thumbnail"
                      contentFit="cover"
                      source={sampleMealImageSource(entry.meal.imageUri)}
                      style={styles.mealImage}
                    />
                  ) : (
                    <View style={styles.timelineIcon}>
                      <Text style={styles.timelineGlyph}>●</Text>
                    </View>
                  )}
                  <View style={styles.timelineCopy}>
                    <Text style={styles.entryTitle}>{entry.meal.name}</Text>
                    <Text style={styles.entryMetadata}>{formatEntryTime(entry.occurredAt)}</Text>
                    <View style={styles.tags}>
                      {entry.meal.factors.map(({ factor }) => (
                        <Text key={factor.id} style={styles.tag}>{factor.label}</Text>
                      ))}
                    </View>
                  </View>
                </Pressable>
              ) : (
                <View
                  key={`symptom-${entry.id}`}
                  style={styles.timelineItem}
                  testID={`timeline-symptom-${entry.id}`}>
                  <View style={[styles.timelineIcon, styles.symptomIcon]}>
                    <Text style={styles.timelineGlyph}>◌</Text>
                  </View>
                  <View style={styles.timelineCopy}>
                    <Text style={styles.entryTitle}>Bathroom check-in</Text>
                    <Text style={styles.entryMetadata}>
                      {formatEntryTime(entry.occurredAt)} · Stool {entry.symptom.stoolConsistency} ·{' '}
                      {entry.symptom.urgency} urgency · cramping {entry.symptom.cramping} · bloating{' '}
                      {entry.symptom.bloating}
                    </Text>
                    {entry.symptom.meal ? (
                      <Text style={styles.association}>Meal: {entry.symptom.meal.name}</Text>
                    ) : null}
                  </View>
                </View>
              ),
            )}
          </Card>
        </View>
      )}

      {summaryState.status !== 'ready' || !summaryState.isSampleData ? (
        <>
          <View style={styles.sectionHeader}>
            <SectionTitle>Pending check-ins</SectionTitle>
        <StatusPill tone="peach">
          {summaryState.status === 'ready' && summaryState.pending.length > 0
            ? `${summaryState.pending.length} ready`
            : 'None ready'}
        </StatusPill>
          </View>
          {summaryState.status === 'ready' && summaryState.pending.length > 0 ? (
        <Card style={styles.pendingCard}>
          <Text style={styles.entryTitle}>Check in after {summaryState.pending[0].meal.name}</Text>
          <Body style={styles.pendingBody}>
            This meal&apos;s check-in window has arrived. You can record it now even if notifications
            are unavailable.
          </Body>
          <ActionButton
            label="Check in now"
            onPress={() =>
              router.push({
                pathname: '/check-in/[mealId]',
                params: { mealId: String(summaryState.pending[0].meal.id) },
              })
            }
            testID="timeline-pending-check-in"
            variant="secondary"
          />
        </Card>
      ) : (
        <Card style={styles.pendingCard}>
          <Body>
            Saved meals appear here when their check-in window arrives. You can always use “Log
            symptoms” for an unlinked observation.
          </Body>
        </Card>
          )}
        </>
      ) : null}

      {summaryState.status === 'ready' && summaryState.summary.symptoms > 0 ? (
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
  entryPressed: { opacity: 0.72 },
  entryTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  errorCard: { borderColor: palette.danger },
  errorTitle: { color: palette.danger, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  header: { gap: spacing.sm, paddingBottom: spacing.sm, paddingTop: spacing.md },
  loadingCard: { backgroundColor: palette.sage },
  loadingTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  mealImage: { borderRadius: radii.md, height: 54, width: 54 },
  pendingBody: { marginBottom: spacing.md, marginTop: spacing.sm },
  pendingCard: { backgroundColor: palette.peachSoft },
  retryAction: { marginTop: spacing.md },
  sampleBanner: { backgroundColor: palette.peachSoft, borderColor: palette.peach },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  symptomIcon: { backgroundColor: palette.peachSoft },
  tag: { backgroundColor: palette.sage, borderRadius: radii.pill, color: palette.forestPressed, fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  timelineCopy: { flex: 1 },
  timelineGlyph: { color: palette.forest, fontSize: 20, fontWeight: '900' },
  timelineIcon: { alignItems: 'center', backgroundColor: palette.sage, borderRadius: radii.md, height: 54, justifyContent: 'center', width: 54 },
  timelineItem: { alignItems: 'flex-start', borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
});

function formatEntryTime(occurredAt: string): string {
  const date = new Date(occurredAt);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();

  return new Intl.DateTimeFormat(undefined, {
    day: sameDay ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: sameDay ? undefined : 'short',
  }).format(date);
}
