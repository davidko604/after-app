import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, StatusPill } from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { usePrototypeState } from '@/features/prototype/prototype-state';

type Urgency = 'none' | 'moderate' | 'strong';

const STOOL_LABELS: Record<number, string> = {
  1: 'separate hard lumps',
  2: 'firm and lumpy',
  3: 'formed with surface cracks',
  4: 'smooth and soft',
  5: 'soft blobs',
  6: 'mushy',
  7: 'watery',
};

const INTENSITY_LABELS: Record<number, string> = {
  0: 'none',
  1: 'mild',
  2: 'moderate',
  3: 'strong',
};

function NumberScale({
  accessibilityName,
  labels,
  onChange,
  optionLabels,
  testID,
  value,
  values,
}: {
  accessibilityName: string;
  labels?: { end: string; start: string };
  onChange: (value: number) => void;
  optionLabels?: Record<number, string>;
  testID: string;
  value: number | null;
  values: readonly number[];
}) {
  const selectedDescription = value === null ? null : optionLabels?.[value];

  return (
    <View>
      <View style={styles.scale}>
        {values.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityLabel={`${accessibilityName}, ${option}${optionLabels?.[option] ? `, ${optionLabels[option]}` : ''}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.scaleButton,
                selected && styles.scaleButtonSelected,
                pressed && styles.pressed,
              ]}
              testID={`${testID}-${option}`}>
              <Text style={[styles.scaleText, selected && styles.scaleTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {labels ? (
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLabel}>{labels.start}</Text>
          <Text style={styles.scaleLabel}>{labels.end}</Text>
        </View>
      ) : null}
      <Text
        accessibilityLiveRegion="polite"
        style={styles.selectedValue}
        testID={`${testID}-selection`}>
        {value === null
          ? 'Select one'
          : `${value}${selectedDescription ? ` · ${selectedDescription}` : ''}`}
      </Text>
    </View>
  );
}

export default function CheckInScreen() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const { meal, saveSymptom } = usePrototypeState();
  const linkedMeal = mealId === 'prototype-meal' ? meal : null;
  const isUnlinked = !linkedMeal;
  const savingLock = useRef(false);
  const [stoolConsistency, setStoolConsistency] = useState<number | null>(null);
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [cramping, setCramping] = useState<number | null>(null);
  const [bloating, setBloating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);

  const isComplete =
    stoolConsistency !== null && urgency !== null && cramping !== null && bloating !== null;

  function finishCheckIn() {
    if (!isComplete) {
      setShowValidationError(true);
      return;
    }

    if (savingLock.current) {
      return;
    }

    savingLock.current = true;
    setIsSaving(true);
    setSaveError(false);

    try {
      saveSymptom({ bloating, cramping, stoolConsistency, urgency });
      router.replace('/');
    } catch {
      savingLock.current = false;
      setIsSaving(false);
      setSaveError(true);
    }
  }

  function leaveCheckIn() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  return (
    <Screen>
      <View style={styles.topRow} testID="check-in-screen">
        <Eyebrow>{isUnlinked ? 'Quick entry' : 'Meal check-in'}</Eyebrow>
        <StatusPill tone="peach">Current-session demo</StatusPill>
      </View>
      <Heading>How are you feeling?</Heading>
      <Body>Choose each observation before saving. No symptom values are selected for you.</Body>

      <Card style={styles.mealCard}>
        <View accessibilityElementsHidden style={styles.mealThumbnail} />
        <View style={styles.mealCopy}>
          <Text style={styles.cardTitle}>{isUnlinked ? 'Standalone symptom entry' : linkedMeal.name}</Text>
          <Body style={styles.compactBody}>
            {isUnlinked
              ? mealId === 'unlinked'
                ? 'This check-in will not be linked to a meal.'
                : 'The requested meal is unavailable in this preview, so this check-in will remain unlinked.'
              : `Check-in after ${linkedMeal.name}. Meal tags: ${linkedMeal.factors.join(', ') || 'none'}.`}
          </Body>
        </View>
      </Card>

      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.label}>Stool consistency · required</Text>
        <NumberScale
          accessibilityName="Stool consistency"
          labels={{ end: 'Watery', start: 'Hard' }}
          onChange={(value) => {
            setShowValidationError(false);
            setStoolConsistency(value);
          }}
          optionLabels={STOOL_LABELS}
          testID="check-in-stool"
          value={stoolConsistency}
          values={[1, 2, 3, 4, 5, 6, 7]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.label}>Urgency · required</Text>
        <View style={styles.segmentedRow}>
          {(['none', 'moderate', 'strong'] as const).map((option) => {
            const selected = urgency === option;
            return (
              <Pressable
                accessibilityLabel={`Urgency, ${option}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => {
                  setShowValidationError(false);
                  setUrgency(option);
                }}
                style={({ pressed }) => [
                  styles.segmentButton,
                  selected && styles.segmentButtonSelected,
                  pressed && styles.pressed,
                ]}
                testID={`check-in-urgency-${option}`}>
                <Text style={[styles.segmentText, selected && styles.scaleTextSelected]}>
                  {option[0]?.toUpperCase()}
                  {option.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.selectedValue} testID="check-in-urgency-selection">
          {urgency === null ? 'Select one' : `${urgency[0]?.toUpperCase()}${urgency.slice(1)}`}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.label}>Cramping · required</Text>
        <NumberScale
          accessibilityName="Cramping"
          onChange={(value) => {
            setShowValidationError(false);
            setCramping(value);
          }}
          optionLabels={INTENSITY_LABELS}
          testID="check-in-cramping"
          value={cramping}
          values={[0, 1, 2, 3]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.label}>Bloating · required</Text>
        <NumberScale
          accessibilityName="Bloating"
          onChange={(value) => {
            setShowValidationError(false);
            setBloating(value);
          }}
          optionLabels={INTENSITY_LABELS}
          testID="check-in-bloating"
          value={bloating}
          values={[0, 1, 2, 3]}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Private note · not saved in this preview</Text>
        <TextInput
          accessibilityLabel="Private symptom note"
          multiline
          onChangeText={setNote}
          placeholder="Anything unusual about today?"
          placeholderTextColor={palette.muted}
          style={styles.noteInput}
          testID="check-in-note"
          value={note}
        />
      </View>

      {showValidationError ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={styles.errorText}
          testID="check-in-validation-error">
          Choose stool consistency, urgency, cramping, and bloating before saving.
        </Text>
      ) : null}
      {saveError ? (
        <Text accessibilityRole="alert" selectable style={styles.errorText} testID="check-in-save-error">
          The check-in could not be added to this session. Review your choices and try again.
        </Text>
      ) : null}
      {isSaving ? (
        <Text accessibilityLiveRegion="polite" style={styles.savingText} testID="check-in-saving">
          Adding check-in to this session…
        </Text>
      ) : null}
      <ActionButton
        disabled={isSaving}
        label={isSaving ? 'Saving check-in…' : 'Save check-in'}
        onPress={finishCheckIn}
        testID="check-in-save"
      />
      <ActionButton
        label="Do this later"
        onPress={leaveCheckIn}
        testID="check-in-back-to-timeline"
        variant="secondary"
      />

      <Card style={styles.privateCard}>
        <Text style={styles.privateTitle}>Current preview behavior</Text>
        <Body>
          Symptom selections stay in memory for this app session. The note field is not saved. The
          separate photo-analysis request receives only a meal photo you explicitly submit, not
          these symptom selections or this note.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  compactBody: { fontSize: 13, lineHeight: 19 },
  errorText: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  fieldGroup: { gap: spacing.sm },
  label: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  mealCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  mealCopy: { flex: 1, gap: spacing.xs },
  mealThumbnail: {
    backgroundColor: palette.peach,
    borderColor: palette.sageStrong,
    borderRadius: radii.md,
    borderWidth: 6,
    height: 64,
    width: 64,
  },
  noteInput: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1.5,
    color: palette.ink,
    minHeight: 78,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.72 },
  privateCard: { backgroundColor: palette.sage },
  privateTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  scale: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scaleButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    flexGrow: 1,
    flexBasis: 44,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 42,
  },
  scaleButtonSelected: { backgroundColor: palette.forest, borderColor: palette.forest },
  scaleLabel: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 5 },
  scaleText: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  scaleTextSelected: { color: palette.white },
  savingText: { color: palette.forest, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  selectedValue: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  segmentButton: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  segmentButtonSelected: { backgroundColor: palette.forest, borderColor: palette.forest },
  segmentText: { color: palette.ink, fontSize: 13, fontWeight: '800' },
  segmentedRow: { flexDirection: 'row', gap: spacing.sm },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
});
