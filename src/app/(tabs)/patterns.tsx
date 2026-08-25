import { StyleSheet, Text, View } from 'react-native';

import {
  ActionButton,
  Body,
  Card,
  Eyebrow,
  Heading,
  Screen,
  SectionTitle,
  StatusPill,
} from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { usePrototypeState } from '@/features/prototype/prototype-state';

type PatternCardProps = {
  accessibilitySummary: string;
  baselineRate: string;
  counterexamples: string;
  evidence: 'Early signal' | 'Still learning';
  exposureRate: string;
  factor: string;
  observations: string;
  summary: string;
  testID: string;
};

function PatternCard({
  accessibilitySummary,
  baselineRate,
  counterexamples,
  evidence,
  exposureRate,
  factor,
  observations,
  summary,
  testID,
}: PatternCardProps) {
  return (
    <View
      accessibilityLabel={evidence === 'Still learning' ? accessibilitySummary : undefined}
      accessible={evidence === 'Still learning'}
      testID={testID}>
      <Card style={styles.patternCard}>
        <View style={styles.cardHeader}>
          <View style={styles.factorCopy}>
            <SectionTitle>{factor}</SectionTitle>
            <Text style={styles.observations}>{observations}</Text>
          </View>
          <StatusPill tone={evidence === 'Still learning' ? 'peach' : 'sage'}>{evidence}</StatusPill>
        </View>
        {evidence === 'Still learning' ? (
          <Body style={styles.cardBody}>{summary}</Body>
        ) : (
          <>
            <View
              accessibilityLabel={accessibilitySummary}
              accessible
              style={styles.comparison}
              testID={`${testID}-comparison`}>
              <View style={styles.comparisonItem}>
                <Text selectable style={styles.rate} testID={`${testID}-exposure-rate`}>
                  {exposureRate}
                </Text>
                <Text style={styles.rateLabel}>After tagged meals</Text>
              </View>
              <Text accessibilityElementsHidden style={styles.versus}>vs</Text>
              <View style={[styles.comparisonItem, styles.baselineItem]}>
                <Text selectable style={styles.rate} testID={`${testID}-baseline-rate`}>
                  {baselineRate}
                </Text>
                <Text style={styles.rateLabel}>After other meals</Text>
              </View>
            </View>
            <Body>{summary}</Body>
            <Text selectable style={styles.counterexample}>{counterexamples}</Text>
          </>
        )}
      </Card>
    </View>
  );
}

export default function PatternsScreen() {
  const { sampleDataEnabled, setSampleDataEnabled } = usePrototypeState();

  return (
    <Screen>
      <View style={styles.header} testID="patterns-screen">
        <View style={styles.cardHeader}>
          <Eyebrow>Personal patterns</Eyebrow>
          <StatusPill tone="peach">{sampleDataEnabled ? 'Sample data' : 'Sample off'}</StatusPill>
        </View>
        <Heading>Evidence, with room for doubt.</Heading>
        <Body>
          After compares what followed tagged meals with check-ins after other meals. These are
          self-reported associations, not proof of cause.
        </Body>
      </View>

      {sampleDataEnabled ? (
        <>
          <View testID="patterns-sample-notice">
            <Card style={styles.sampleNotice}>
              <Text style={styles.noticeTitle}>Synthetic history · 18 days</Text>
              <Body>
                Every result below is generated sample data and is shown separately from the local
                diary.
              </Body>
            </Card>
          </View>
          <PatternCard
            accessibilitySummary="Sample data for dairy. Symptoms followed 75 percent of dairy-tagged meals, 6 of 8, compared with 33 percent of other meals, 5 of 15."
            baselineRate="33%"
            counterexamples="2 dairy-tagged meals had no reported symptoms."
            evidence="Early signal"
            exposureRate="75%"
            factor="Dairy"
            observations="8 tagged meals · 15 other meals"
            summary="Loose or urgent bowel movements followed 6 of 8 dairy-tagged meals. This is an early association, not proof that dairy caused the symptoms."
            testID="patterns-card-dairy"
          />
          <PatternCard
            accessibilitySummary="Sample data for high-fat food. Symptoms followed 67 percent of high-fat-tagged meals, 4 of 6, compared with 35 percent of other meals, 6 of 17."
            baselineRate="35%"
            counterexamples="2 high-fat meals were not followed by symptoms."
            evidence="Early signal"
            exposureRate="67%"
            factor="High-fat food"
            observations="6 tagged meals · 17 other meals"
            summary="Symptoms followed 4 of 6 high-fat-tagged meals in this sample history. Other factors may have contributed."
            testID="patterns-card-high-fat"
          />
          <PatternCard
            accessibilitySummary="Sample data for caffeine. Three tagged meals are not enough for a useful comparison."
            baselineRate="—"
            counterexamples=""
            evidence="Still learning"
            exposureRate="—"
            factor="Caffeine"
            observations="3 tagged meals"
            summary="More tagged and untagged check-ins are needed for a useful comparison."
            testID="patterns-card-caffeine"
          />
          <ActionButton
            label="Disable sample history"
            onPress={() => setSampleDataEnabled(false)}
            testID="patterns-disable-sample"
            variant="secondary"
          />
        </>
      ) : (
        <View testID="patterns-empty">
          <Card style={styles.learningCard}>
            <View style={styles.cardHeader}>
              <SectionTitle>Personal patterns are not calculated yet</SectionTitle>
              <StatusPill tone="peach">Demo only</StatusPill>
            </View>
            <Body style={styles.cardBody}>
              This build does not calculate patterns from the local diary. Preview the evidence
              design with clearly labeled synthetic history.
            </Body>
            <ActionButton
              label="Enable sample history"
              onPress={() => setSampleDataEnabled(true)}
              testID="patterns-enable-sample"
            />
          </Card>
        </View>
      )}

      <Card style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>A journaling tool, not medical advice</Text>
        <Body>
          These observations may help prepare for a conversation with a clinician. After does not
          diagnose conditions or recommend treatment or restrictive diets.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  baselineItem: { backgroundColor: palette.canvas },
  cardBody: { marginBottom: spacing.md, marginTop: spacing.md },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  comparison: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, marginTop: spacing.lg },
  comparisonItem: { alignItems: 'center', backgroundColor: palette.sage, borderRadius: radii.md, flex: 1, padding: spacing.md },
  counterexample: { color: palette.forest, fontSize: 13, fontWeight: '800', lineHeight: 19, marginTop: spacing.md },
  factorCopy: { flex: 1, gap: spacing.xs },
  header: { gap: spacing.sm, paddingTop: spacing.xl },
  learningCard: { borderColor: palette.sageStrong, gap: spacing.md },
  noticeCard: { backgroundColor: palette.peachSoft },
  noticeTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  observations: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  patternCard: { gap: spacing.sm },
  rate: { color: palette.ink, fontSize: 26, fontVariant: ['tabular-nums'], fontWeight: '900' },
  rateLabel: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  sampleNotice: { backgroundColor: palette.sage },
  versus: { color: palette.muted, fontSize: 12, fontWeight: '800' },
});
