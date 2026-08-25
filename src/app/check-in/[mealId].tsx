import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, StatusPill } from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { createDiaryDataLayer, type Meal } from '@/db';
import { cancelMealCheckInNotification } from '@/services/meal-check-in-notifications';

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
  labels?: { end: string; middle?: string; start: string };
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
          {labels.middle ? <Text style={styles.scaleLabel}>{labels.middle}</Text> : null}
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
  const db = useSQLiteContext();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const numericMealId = Number(mealId);
  const [linkedMeal, setLinkedMeal] = useState<Meal | null>(null);
  const [mealLookupComplete, setMealLookupComplete] = useState(mealId === 'unlinked');
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
  const [showDetails, setShowDetails] = useState(false);
  const [usedTypicalPreset, setUsedTypicalPreset] = useState(false);

  useEffect(() => {
    let active = true;

    if (mealId === 'unlinked' || !Number.isInteger(numericMealId) || numericMealId <= 0) {
      queueMicrotask(() => {
        if (active) {
          setMealLookupComplete(true);
          setLinkedMeal(null);
        }
      });
      return () => {
        active = false;
      };
    }

    void createDiaryDataLayer(db).real.meals.findById(numericMealId).then(
      (meal) => {
        if (active) {
          setLinkedMeal(meal);
          setMealLookupComplete(true);
        }
      },
      () => {
        if (active) {
          setLinkedMeal(null);
          setMealLookupComplete(true);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [db, mealId, numericMealId]);

  const isComplete =
    stoolConsistency !== null && urgency !== null && cramping !== null && bloating !== null;

  function applyTypicalPreset() {
    setBloating(0);
    setCramping(0);
    setUsedTypicalPreset(true);
    setShowValidationError(false);
    setStoolConsistency(4);
    setUrgency('none');
  }

  function openSymptomDetails() {
    if (usedTypicalPreset) {
      setBloating(null);
      setCramping(null);
      setStoolConsistency(null);
      setUrgency(null);
    }
    setUsedTypicalPreset(false);
    setShowDetails(true);
  }

  async function finishCheckIn() {
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
      await createDiaryDataLayer(db).real.symptoms.create({
        bloating,
        cramping,
        mealId: linkedMeal?.id ?? null,
        note,
        occurredAt: new Date().toISOString(),
        stoolConsistency,
        urgency,
      });
      await cancelMealCheckInNotification(linkedMeal?.notificationId ?? null).catch(
        () => undefined,
      );
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
        <StatusPill tone="sage">Private on device</StatusPill>
      </View>
      <Heading>How are you feeling?</Heading>
      <Body>Choose a quick preset and save, or adjust any detail before recording it.</Body>

      <Card style={styles.mealCard}>
        <View accessibilityElementsHidden style={styles.mealThumbnail} />
        <View style={styles.mealCopy}>
          <Text style={styles.cardTitle}>
            {!mealLookupComplete
              ? 'Opening saved meal…'
              : isUnlinked
                ? 'Standalone bathroom check-in'
                : linkedMeal.name}
          </Text>
          <Body style={styles.compactBody}>
            {!mealLookupComplete
              ? 'Reading the private diary on this device.'
              : isUnlinked
              ? mealId === 'unlinked'
                ? 'This check-in will not be linked to a meal.'
                : 'The requested meal is unavailable, so this check-in will remain unlinked.'
              : `Check-in after ${linkedMeal.name}. Meal tags: ${linkedMeal.factors.map(({ factor }) => factor.label).join(', ') || 'none'}.`}
          </Body>
        </View>
      </Card>

      <Card style={styles.quickCard}>
        <Text style={styles.cardTitle}>Quick check-in</Text>
        <Body style={styles.compactBody}>
          Use the fast preset only when it matches. Otherwise record each observation separately.
        </Body>
        <Text style={styles.stoolGuide}>
          Stool type is not a score: 1–2 hard · 3–4 formed · 5–7 soft to watery
        </Text>
        <View style={styles.quickGrid}>
          <Pressable
            accessibilityHint="Sets stool type 4, no urgency, no cramping, and no bloating"
            accessibilityRole="radio"
            accessibilityState={{ selected: usedTypicalPreset }}
            onPress={applyTypicalPreset}
            style={({ pressed }) => [
              styles.quickPreset,
              usedTypicalPreset && styles.quickPresetSelected,
              pressed && styles.pressed,
            ]}
            testID="check-in-preset-typical">
            <Text style={[styles.quickPresetText, usedTypicalPreset && styles.scaleTextSelected]}>
              {usedTypicalPreset ? '✓ ' : ''}Everything felt typical
            </Text>
            <Text style={[styles.quickPresetMeta, usedTypicalPreset && styles.scaleTextSelected]}>
              Type 4 · no urgency or discomfort
            </Text>
          </Pressable>
          <Pressable
            accessibilityHint="Opens separate stool, urgency, cramping, and bloating controls"
            accessibilityRole="button"
            onPress={openSymptomDetails}
            style={({ pressed }) => [styles.quickPreset, pressed && styles.pressed]}
            testID="check-in-record-symptoms">
            <Text style={styles.quickPresetText}>Record symptoms</Text>
            <Text style={styles.quickPresetMeta}>Choose each observation separately</Text>
          </Pressable>
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.presetSummary} testID="check-in-preset-summary">
          {isComplete
            ? `Stool ${stoolConsistency} (${STOOL_LABELS[stoolConsistency]}) · ${urgency} urgency · cramping ${cramping} · bloating ${bloating}`
            : 'Choose the typical preset or record symptoms.'}
        </Text>
      </Card>

      {saveError ? (
        <Text accessibilityRole="alert" selectable style={styles.errorText} testID="check-in-save-error">
          The check-in could not be saved to the local diary. Check device storage and try again.
        </Text>
      ) : null}
      <ActionButton
        disabled={!isComplete || isSaving || !mealLookupComplete}
        label={isSaving ? 'Saving check-in…' : 'Save check-in'}
        onPress={() => void finishCheckIn()}
        testID="check-in-save"
      />
      <ActionButton
        label={showDetails ? 'Hide details' : 'Adjust details'}
        onPress={() => setShowDetails((visible) => !visible)}
        testID="check-in-toggle-details"
        variant="secondary"
      />

      {showDetails ? (
        <>
      <View style={styles.fieldGroup}>
        <Text accessibilityRole="header" style={styles.label}>Stool type · required</Text>
        <Body style={styles.compactBody}>This describes consistency, not better versus worse.</Body>
        <NumberScale
          accessibilityName="Stool consistency"
          labels={{ end: '7 · watery', middle: '3–4 · formed', start: '1 · hard' }}
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
        <Text style={styles.label}>Private note · optional</Text>
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
        </>
      ) : null}

      {showValidationError ? (
        <Text
          accessibilityRole="alert"
          selectable
          style={styles.errorText}
          testID="check-in-validation-error">
          Choose stool consistency, urgency, cramping, and bloating before saving.
        </Text>
      ) : null}
      {isSaving ? (
        <Text accessibilityLiveRegion="polite" style={styles.savingText} testID="check-in-saving">
          Saving check-in to this device…
        </Text>
      ) : null}
      <ActionButton
        label="Do this later"
        onPress={leaveCheckIn}
        testID="check-in-back-to-timeline"
        variant="secondary"
      />

      <Card style={styles.privateCard}>
        <Text style={styles.privateTitle}>Private local observation</Text>
        <Body>
          This check-in and optional note are saved only in SQLite on this device. They are never
          included in the separate meal-photo analysis request.
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
  presetSummary: { color: palette.forestPressed, fontSize: 13, fontWeight: '800', lineHeight: 19 },
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
  quickCard: { backgroundColor: palette.sage, gap: spacing.md },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickPreset: {
    alignItems: 'center',
    backgroundColor: palette.card,
    borderColor: palette.forest,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flexBasis: '47%',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  quickPresetSelected: { backgroundColor: palette.forest, borderColor: palette.forest },
  quickPresetMeta: { color: palette.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  quickPresetText: { color: palette.forest, fontSize: 15, fontWeight: '800' },
  savingText: { color: palette.forest, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  selectedValue: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  stoolGuide: {
    color: palette.forestPressed,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 17,
  },
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
