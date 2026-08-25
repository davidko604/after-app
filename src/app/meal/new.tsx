import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, StatusPill } from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { createMealRepository } from '@/db/meals';
import type { MealFactorInput, SuggestionSource } from '@/db/model';
import { analyzeMealPhoto, MealAnalysisClientError } from '@/features/meal-analysis/client';
import {
  factorLabelForKey,
  isSupportedImageMediaType,
  MAX_IMAGE_BASE64_LENGTH,
  MEAL_FACTOR_OPTIONS,
  type MealAnalysisResult,
  type SupportedImageMediaType,
} from '@/features/meal-analysis/contract';
import { deletePersistedMealPhoto, persistMealPhoto } from '@/features/meal-photos/storage';
import { usePrototypeState } from '@/features/prototype/prototype-state';
import {
  scheduleMealCheckInNotification,
} from '@/services/meal-check-in-notifications';

const FACTORS = MEAL_FACTOR_OPTIONS.map((option) => option.label);

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { result: MealAnalysisResult; status: 'ready' }
  | { message: string; recovery: string; status: 'error' };

export default function NewMealScreen() {
  const db = useSQLiteContext();
  const { saveMeal } = usePrototypeState();
  const [step, setStep] = useState<1 | 2>(1);
  const [mealName, setMealName] = useState('');
  const mealNameWasEdited = useRef(false);
  const analysisRequestId = useRef(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMediaType, setPhotoMediaType] = useState<SupportedImageMediaType | null>(null);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [customFactor, setCustomFactor] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function choosePhoto(source: 'camera' | 'library') {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            'Camera permission is off',
            'After can still log the meal without a photo. Enable camera access in Android Settings if you want to take one.',
          );
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              base64: true,
              mediaTypes: ['images'],
              quality: 0.6,
            })
          : await ImagePicker.launchImageLibraryAsync({
              allowsEditing: true,
              base64: true,
              mediaTypes: ['images'],
              quality: 0.6,
            });

      if (!result.canceled) {
        const asset = result.assets[0];
        const nextPhotoBase64 = asset?.base64 ?? null;
        const nextPhotoMediaType = resolveImageMediaType(asset?.mimeType, asset?.uri);
        if (!mealNameWasEdited.current) {
          setMealName('');
        }
        setPhotoUri(asset?.uri ?? null);
        setPhotoBase64(nextPhotoBase64);
        setPhotoMediaType(nextPhotoMediaType);
        setSelectedFactors([]);
        void analyzeSelectedPhoto(nextPhotoBase64, nextPhotoMediaType);
      }
    } catch {
      Alert.alert(
        'Photo selection failed',
        'Android could not open the requested photo source. Continue without a photo or try again.',
      );
    }
  }

  async function analyzeSelectedPhoto(
    imageBase64: string | null,
    mediaType: SupportedImageMediaType | null,
  ) {
    const requestId = ++analysisRequestId.current;

    if (!imageBase64) {
      const message = 'The selected photo could not be prepared for analysis.';
      const recovery = 'Choose the photo again or continue by naming the meal and editing factors manually.';
      setAnalysisState({ message, recovery, status: 'error' });
      return;
    }

    if (!mediaType) {
      const message = 'This photo format is not supported for analysis.';
      const recovery = 'Choose a JPEG, PNG, or WebP image, or review factors manually.';
      setAnalysisState({ message, recovery, status: 'error' });
      return;
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      const message = 'The selected photo is too large to analyze.';
      const recovery = 'Crop it more tightly, choose a smaller image, or review factors manually.';
      setAnalysisState({ message, recovery, status: 'error' });
      return;
    }

    setAnalysisState({ status: 'loading' });
    try {
      const result = await analyzeMealPhoto({
        imageBase64,
        mediaType,
      });
      if (requestId !== analysisRequestId.current) {
        return;
      }
      setSelectedFactors(result.factors.map(factorLabelForKey));
      if (result.mealName && !mealNameWasEdited.current) {
        setMealName(result.mealName);
      }
      setAnalysisState({ result, status: 'ready' });
    } catch (error) {
      if (requestId !== analysisRequestId.current) {
        return;
      }
      const analysisError =
        error instanceof MealAnalysisClientError
          ? error
          : new MealAnalysisClientError(
              'Meal-photo analysis did not complete.',
              'Review the editable factor suggestions manually and try again later.',
            );
      setAnalysisState({
        message: analysisError.message,
        recovery: analysisError.recovery,
        status: 'error',
      });
    }
  }

  function continueToFactors() {
    if (analysisState.status === 'loading') {
      analysisRequestId.current += 1;
      setAnalysisState({ status: 'idle' });
    }
    setStep(2);
  }

  function toggleFactor(factor: string) {
    setSelectedFactors((current) =>
      current.includes(factor) ? current.filter((item) => item !== factor) : [...current, factor],
    );
  }

  function addCustomFactor() {
    const factor = customFactor.trim();
    if (!factor) {
      return;
    }

    setSelectedFactors((current) =>
      current.some((item) => item.toLocaleLowerCase() === factor.toLocaleLowerCase())
        ? current
        : [...current, factor],
    );
    setCustomFactor('');
  }

  async function finishMeal() {
    const name = mealName.trim();
    if (!name) {
      setStep(1);
      Alert.alert(
        'Name this meal before saving',
        'Type a short name yourself, or review a photo with Luna for an editable suggestion.',
      );
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    let persistedPhotoUri: string | null = null;

    try {
      persistedPhotoUri = photoUri
        ? await persistMealPhoto(photoUri, photoMediaType)
        : null;
      const repository = createMealRepository(db, 'real');
      const factors = selectedFactors.map((label) =>
        mealFactorInput(label, analysisState),
      );
      let meal = await repository.create({
        checkInDelayMinutes: 180,
        factors,
        imageUri: persistedPhotoUri,
        name,
        occurredAt: new Date().toISOString(),
      });

      const notification = await scheduleMealCheckInNotification({
        delayMinutes: meal.checkInDelayMinutes,
        mealId: meal.id,
        mealName: meal.name,
      }).catch(() => ({ status: 'unavailable' as const }));

      if (notification.status === 'scheduled') {
        meal = await repository.update(meal.id, { notificationId: notification.identifier });
      }

      saveMeal({ factors: selectedFactors, name: meal.name, photoUri: meal.imageUri });
      router.replace('/');
    } catch {
      deletePersistedMealPhoto(persistedPhotoUri);
      setSaveError(
        'After could not save this meal to the local diary. Check that this device has storage available, then try again.',
      );
      setIsSaving(false);
    }
  }

  if (step === 2) {
    return (
      <Screen>
        <View style={styles.topRow}>
          <Eyebrow>Confirm factors</Eyebrow>
          <StatusPill tone="peach">Prototype · 2 of 2</StatusPill>
        </View>
        <Heading>What might be relevant?</Heading>
        <Body>
          {analysisState.status === 'ready' && analysisState.result.source === 'openai'
            ? 'Luna proposed these visible meal factors as hypotheses. Confirm or edit every tag.'
            : 'These demo suggestions are hypotheses, not facts. Confirm or edit every tag.'}
        </Body>

        <Card style={styles.cautionCard}>
          <Text style={styles.cautionTitle}>Review every suggestion</Text>
          <Body>Photo suggestions can miss ingredients. Confirm or edit the tags before saving.</Body>
        </Card>

        <View style={styles.factors}>
          {[...new Set([...FACTORS, ...selectedFactors])].map((factor) => {
            const selected = selectedFactors.includes(factor);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={factor}
                onPress={() => toggleFactor(factor)}
                style={({ pressed }) => [
                  styles.factor,
                  selected && styles.factorSelected,
                  pressed && styles.factorPressed,
                ]}
                testID={`meal-factor-${factor.toLowerCase().replaceAll(' ', '-')}`}>
                <Text style={[styles.factorText, selected && styles.factorTextSelected]}>
                  {selected ? '✓ ' : ''}
                  {factor}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.customFactorRow}>
          <TextInput
            accessibilityLabel="Custom meal factor"
            onChangeText={setCustomFactor}
            onSubmitEditing={addCustomFactor}
            placeholder="Custom factor"
            placeholderTextColor={palette.muted}
            returnKeyType="done"
            style={[styles.input, styles.customFactorInput]}
            testID="meal-custom-factor-input"
            value={customFactor}
          />
          <Pressable
            accessibilityLabel="Add custom meal factor"
            accessibilityRole="button"
            accessibilityState={{ disabled: !customFactor.trim() }}
            disabled={!customFactor.trim()}
            onPress={addCustomFactor}
            style={({ pressed }) => [
              styles.customFactor,
              !customFactor.trim() && styles.customFactorDisabled,
              pressed && styles.factorPressed,
            ]}
            testID="meal-custom-factor-add">
            <Text style={styles.factorText}>Add</Text>
          </Pressable>
        </View>

        <Card style={styles.scheduleCard}>
          <View style={styles.topRow}>
            <Text style={styles.cardTitle}>Check in after this meal</Text>
            <StatusPill>10 sec demo</StatusPill>
          </View>
          <Body style={styles.cardBody}>
            This design preview shows the pending return loop immediately. Native scheduling will
            be connected in the notification milestone.
          </Body>
        </Card>

        {saveError ? (
          <Text accessibilityRole="alert" style={styles.saveError} testID="meal-save-error">
            {saveError}
          </Text>
        ) : null}
        <ActionButton
          disabled={isSaving}
          label={isSaving ? 'Saving meal…' : 'Save meal'}
          onPress={() => void finishMeal()}
          testID="meal-save"
        />
        <ActionButton
          label="Back to meal"
          onPress={() => setStep(1)}
          testID="meal-back-to-details"
          variant="secondary"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.topRow}>
        <Eyebrow>Meal entry</Eyebrow>
        <StatusPill tone="peach">Prototype · 1 of 2</StatusPill>
      </View>
      <Heading>What did you eat?</Heading>
      <Body>A photo is optional. The manual diary remains available if the camera fails.</Body>

      <Card style={styles.photoCard}>
        {photoUri ? (
          <Image accessibilityLabel="Selected meal" contentFit="cover" source={photoUri} style={styles.photo} />
        ) : (
          <View accessibilityElementsHidden style={styles.photoPlaceholder}>
            <Text style={styles.photoGlyph}>◉</Text>
            <Text style={styles.cardTitle}>Add a meal photo</Text>
            <Body style={styles.centeredText}>A photo is optional. Manual factor editing always works.</Body>
          </View>
        )}
        <View style={styles.photoActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void choosePhoto('camera')}
            style={styles.photoAction}
            testID="meal-take-photo">
            <Text style={styles.photoActionText}>Camera</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void choosePhoto('library')}
            style={styles.photoAction}
            testID="meal-choose-photo">
            <Text style={styles.photoActionText}>Library</Text>
          </Pressable>
        </View>
        <Body style={styles.centeredText}>
          Choosing a photo automatically sends only that image to Luna for editable suggestions.
          Diary entries and symptom records are not included.
        </Body>
      </Card>

      <View style={styles.field}>
        <Text style={styles.label}>Meal name</Text>
        <TextInput
          accessibilityLabel="Meal name"
          onChangeText={(value) => {
            mealNameWasEdited.current = true;
            setMealName(value);
          }}
          placeholder="Name this meal"
          placeholderTextColor={palette.muted}
          returnKeyType="done"
          style={styles.input}
          testID="meal-name"
          value={mealName}
        />
      </View>

      <Card
        style={analysisState.status === 'error' ? styles.analysisErrorCard : styles.fixtureCard}>
        <View style={styles.topRow}>
          <Text style={styles.cardTitle} testID="meal-analysis-status">
            {analysisState.status === 'loading'
              ? 'Reviewing the photo'
              : analysisState.status === 'ready'
                ? analysisState.result.source === 'openai'
                  ? 'AI suggestions ready'
                  : 'Demo suggestions ready'
                : analysisState.status === 'error'
                  ? analysisState.message
                  : photoUri
                    ? 'Preparing photo analysis'
                    : 'Optional photo analysis'}
          </Text>
          <StatusPill tone={analysisState.status === 'error' ? 'peach' : 'sage'}>
            {analysisState.status === 'loading'
              ? 'Luna'
              : analysisState.status === 'ready' && analysisState.result.source === 'openai'
                ? 'Luna'
                : analysisState.status === 'error'
                  ? 'Manual available'
                  : 'Optional'}
          </StatusPill>
        </View>
        <Body style={styles.cardBody}>
          {analysisState.status === 'loading'
            ? 'Only the selected image is being sent. Existing diary records are not included.'
            : analysisState.status === 'ready'
              ? analysisState.result.notice
              : analysisState.status === 'error'
                ? analysisState.recovery
                : photoUri
                  ? 'Only the selected image is sent. Review the suggestions before saving.'
                  : 'Add a photo for automatic suggestions, or name the meal and review factors manually.'}
        </Body>
        {analysisState.status === 'ready' ? (
          <View style={styles.analysisSuggestions} testID="meal-analysis-suggestions">
            {analysisState.result.mealName ? (
              <>
                <Text style={styles.analysisSuggestionsLabel}>Suggested meal name</Text>
                <Text style={styles.analysisSuggestionsText}>{analysisState.result.mealName}</Text>
              </>
            ) : null}
            <Text style={styles.analysisSuggestionsLabel}>
              {analysisState.result.factors.length > 0
                ? 'Suggested factors'
                : 'No supported factors visibly identified'}
            </Text>
            {analysisState.result.factors.length > 0 ? (
              <Text style={styles.analysisSuggestionsText}>
                {analysisState.result.factors.map(factorLabelForKey).join(' · ')}
              </Text>
            ) : (
              <Body>
                Luna did not find a visible match from the supported list. You can still add factors
                manually when you know more than the photo shows.
              </Body>
            )}
          </View>
        ) : null}
      </Card>

      {photoUri && analysisState.status === 'error' && photoBase64 && photoMediaType ? (
        <ActionButton
          accessibilityHint="Retries one server-side Luna request for the currently selected image"
          label="Try photo analysis again"
          onPress={() => void analyzeSelectedPhoto(photoBase64, photoMediaType)}
          testID="meal-analyze-photo"
          variant="secondary"
        />
      ) : null}

      <ActionButton
        label={
          analysisState.status === 'loading'
            ? 'Skip AI and review factors now'
            : analysisState.status === 'ready'
            ? analysisState.result.factors.length > 0
              ? `Review ${analysisState.result.factors.length} suggested ${analysisState.result.factors.length === 1 ? 'factor' : 'factors'}`
              : 'Review and add factors manually'
            : photoUri
              ? 'Skip AI and review factors manually'
              : 'Review and confirm factors'
        }
        onPress={continueToFactors}
        testID="meal-review-factors"
        variant={photoUri && analysisState.status !== 'ready' ? 'secondary' : undefined}
      />
      <ActionButton
        label="Cancel"
        onPress={() => router.back()}
        testID="meal-back-to-timeline"
        variant="secondary"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  analysisSuggestions: {
    borderTopColor: palette.forest,
    borderTopWidth: 1,
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  analysisSuggestionsLabel: { color: palette.forestPressed, fontSize: 13, fontWeight: '800' },
  analysisSuggestionsText: { color: palette.ink, fontSize: 16, fontWeight: '800' },
  cardBody: { marginTop: spacing.sm },
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  cautionCard: { backgroundColor: palette.peachSoft, borderColor: palette.peach },
  cautionTitle: { color: palette.ink, fontSize: 16, fontWeight: '800', marginBottom: spacing.xs },
  centeredText: { textAlign: 'center' },
  customFactor: {
    backgroundColor: palette.peachSoft,
    borderColor: palette.peach,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  customFactorDisabled: { opacity: 0.45 },
  customFactorInput: { flex: 1 },
  customFactorRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  factor: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  factorPressed: { opacity: 0.7 },
  factorSelected: { backgroundColor: palette.sage, borderColor: palette.forest },
  factorText: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  factorTextSelected: { color: palette.forestPressed },
  factors: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: spacing.sm },
  fixtureCard: { backgroundColor: palette.sage },
  analysisErrorCard: { backgroundColor: palette.peachSoft, borderColor: palette.peach },
  input: {
    backgroundColor: palette.card,
    borderColor: palette.border,
    borderRadius: radii.md,
    borderWidth: 1.5,
    color: palette.ink,
    fontSize: 16,
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  label: { color: palette.ink, fontSize: 14, fontWeight: '800' },
  photo: { borderRadius: radii.md, height: 210, width: '100%' },
  photoAction: {
    alignItems: 'center',
    borderColor: palette.forest,
    borderRadius: radii.md,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  photoActionText: { color: palette.forest, fontSize: 14, fontWeight: '800' },
  photoActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  photoCard: { gap: spacing.md },
  photoGlyph: { color: palette.forest, fontSize: 36, marginBottom: spacing.sm },
  photoPlaceholder: { alignItems: 'center', paddingVertical: spacing.md },
  scheduleCard: { backgroundColor: palette.sage },
  saveError: { color: palette.danger, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
});

function resolveImageMediaType(
  mimeType: string | null | undefined,
  uri: string | null | undefined,
): SupportedImageMediaType | null {
  const normalizedMimeType = mimeType?.toLocaleLowerCase();
  if (isSupportedImageMediaType(normalizedMimeType)) {
    return normalizedMimeType;
  }

  const path = uri?.split(/[?#]/, 1)[0]?.toLocaleLowerCase();
  if (path?.endsWith('.png')) {
    return 'image/png';
  }
  if (path?.endsWith('.webp')) {
    return 'image/webp';
  }
  if (path?.endsWith('.jpg') || path?.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  return null;
}

function mealFactorInput(factorLabel: string, analysisState: AnalysisState): MealFactorInput {
  const standardFactor = MEAL_FACTOR_OPTIONS.find(({ label }) => label === factorLabel);
  const suggestionSource: SuggestionSource =
    analysisState.status === 'ready'
      ? analysisState.result.source === 'openai'
        ? 'photo_analysis'
        : 'fixture'
      : 'manual';

  if (standardFactor) {
    return {
      factor: {
        isCustom: false,
        key: standardFactor.key,
        kind: 'upsert',
        label: standardFactor.label,
      },
      suggestionSource,
    };
  }

  return {
    factor: {
      isCustom: true,
      key: customFactorKey(factorLabel),
      kind: 'upsert',
      label: factorLabel,
    },
    suggestionSource: 'manual',
  };
}

function customFactorKey(label: string): string {
  const normalized = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `custom-${normalized || 'factor'}`;
}
