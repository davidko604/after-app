import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, StatusPill } from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { analyzeMealPhoto, MealAnalysisClientError } from '@/features/meal-analysis/client';
import {
  factorLabelForKey,
  MAX_IMAGE_BASE64_LENGTH,
  MEAL_FACTOR_OPTIONS,
  type MealAnalysisResult,
} from '@/features/meal-analysis/contract';
import { INITIAL_FACTORS, usePrototypeState } from '@/features/prototype/prototype-state';

const FACTORS = MEAL_FACTOR_OPTIONS.map((option) => option.label);

type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { result: MealAnalysisResult; status: 'ready' }
  | { message: string; recovery: string; status: 'error' };

export default function NewMealScreen() {
  const { saveMeal } = usePrototypeState();
  const [step, setStep] = useState<1 | 2>(1);
  const [mealName, setMealName] = useState('Creamy tomato pasta');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [selectedFactors, setSelectedFactors] = useState<string[]>([...INITIAL_FACTORS]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [customFactor, setCustomFactor] = useState('');

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
        setPhotoUri(asset?.uri ?? null);
        setPhotoBase64(asset?.base64 ?? null);
        setAnalysisState({ status: 'idle' });
      }
    } catch {
      Alert.alert(
        'Photo selection failed',
        'Android could not open the requested photo source. Continue without a photo or try again.',
      );
    }
  }

  async function suggestFactors() {
    if (!photoBase64) {
      const message = 'The selected photo could not be prepared for analysis.';
      const recovery = 'Choose the photo again or continue with the editable fixture suggestions.';
      setAnalysisState({ message, recovery, status: 'error' });
      Alert.alert(message, recovery);
      return;
    }

    if (photoBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      const message = 'The selected photo is too large to analyze.';
      const recovery = 'Crop it more tightly, choose a smaller image, or review factors manually.';
      setAnalysisState({ message, recovery, status: 'error' });
      Alert.alert(message, recovery);
      return;
    }

    setAnalysisState({ status: 'loading' });
    try {
      const result = await analyzeMealPhoto({
        imageBase64: photoBase64,
        mediaType: 'image/jpeg',
      });
      setSelectedFactors(result.factors.map(factorLabelForKey));
      setAnalysisState({ result, status: 'ready' });
    } catch (error) {
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
      Alert.alert(analysisError.message, analysisError.recovery);
    }
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

  function finishMeal() {
    saveMeal({
      factors: selectedFactors,
      name: mealName.trim() || 'Untitled meal',
      photoUri,
    });
    router.replace('/');
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
          <Text style={styles.cautionTitle}>A photo cannot reveal hidden ingredients</Text>
          <Body>After will never describe a meal tag as certain or claim that it caused a symptom.</Body>
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

        <ActionButton label="Save meal" onPress={finishMeal} testID="meal-save" />
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
      </Card>

      <View style={styles.field}>
        <Text style={styles.label}>Meal name</Text>
        <TextInput
          accessibilityLabel="Meal name"
          onChangeText={setMealName}
          placeholder="For example, pasta at home"
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
                    ? 'Photo ready for optional analysis'
                    : 'Editable demo suggestions'}
          </Text>
          <StatusPill tone={analysisState.status === 'error' ? 'peach' : 'sage'}>
            {analysisState.status === 'loading'
              ? 'Luna'
              : analysisState.status === 'ready' && analysisState.result.source === 'openai'
                ? 'Luna'
                : analysisState.status === 'error'
                  ? 'Manual available'
                  : 'Deterministic'}
          </StatusPill>
        </View>
        <Body style={styles.cardBody}>
          {analysisState.status === 'loading'
            ? 'Only the selected image is being sent. Meal names and diary records are not included.'
            : analysisState.status === 'ready'
              ? analysisState.result.notice
              : analysisState.status === 'error'
                ? analysisState.recovery
                : photoUri
                  ? 'Only the selected image will be sent. Luna cannot identify hidden ingredients. You must confirm every suggestion.'
                  : 'Dairy, high-fat food, and large meal are preselected without using a network or AI provider.'}
        </Body>
      </Card>

      {photoUri ? (
        <ActionButton
          accessibilityHint="Sends only the selected image to the server-side Luna analysis route"
          disabled={analysisState.status === 'loading'}
          label={analysisState.status === 'loading' ? 'Reviewing photo…' : 'Suggest factors with Luna'}
          onPress={() => void suggestFactors()}
          testID="meal-analyze-photo"
          variant="secondary"
        />
      ) : null}

      <ActionButton
        disabled={analysisState.status === 'loading'}
        label="Review and confirm factors"
        onPress={() => setStep(2)}
        testID="meal-review-factors"
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
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
});
