import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Body, Card, Eyebrow, Heading, Screen, StatusPill } from '@/components/app-ui';
import { palette, radii, spacing } from '@/constants/theme';
import { createDiaryDataLayer, type Meal } from '@/db';
import { deletePersistedMealPhoto } from '@/features/meal-photos/storage';
import { sampleMealImageSource } from '@/features/patterns/sample-images';
import { cancelMealCheckInNotification } from '@/services/meal-check-in-notifications';

type MealState =
  | { status: 'error' | 'loading' | 'missing' }
  | { meal: Meal; status: 'ready' };

export default function MealDetailScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ mealId: string; source?: string }>();
  const mealId = Number(params.mealId);
  const source = params.source === 'sample' ? 'sample' : 'real';
  const [state, setState] = useState<MealState>({ status: 'loading' });
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMeal = useCallback(async () => {
    if (!Number.isInteger(mealId) || mealId <= 0) {
      setState({ status: 'missing' });
      return;
    }

    setState({ status: 'loading' });
    try {
      const meal = await createDiaryDataLayer(db)[source].meals.findById(mealId);
      setState(meal ? { meal, status: 'ready' } : { status: 'missing' });
    } catch {
      setState({ status: 'error' });
    }
  }, [db, mealId, source]);

  useFocusEffect(
    useCallback(() => {
      void loadMeal();
    }, [loadMeal]),
  );

  function confirmDelete(meal: Meal) {
    Alert.alert(
      'Delete this meal?',
      'The meal and its factor links will be removed from this device. Linked symptom entries will remain as standalone observations.',
      [
        { style: 'cancel', text: 'Keep meal' },
        {
          onPress: () => void deleteMeal(meal),
          style: 'destructive',
          text: 'Delete meal',
        },
      ],
    );
  }

  async function deleteMeal(meal: Meal) {
    setIsDeleting(true);
    try {
      const deleted = await createDiaryDataLayer(db).real.meals.delete(meal.id);
      if (!deleted) {
        throw new Error('Meal missing');
      }
      await cancelMealCheckInNotification(meal.notificationId).catch(() => undefined);
      deletePersistedMealPhoto(meal.imageUri);
      router.replace('/');
    } catch {
      setIsDeleting(false);
      Alert.alert(
        'The meal was not deleted',
        'After could not update the local diary. Reopen this meal and try again.',
      );
    }
  }

  if (state.status !== 'ready') {
    return (
      <Screen>
        <Eyebrow>Saved meal</Eyebrow>
        <Heading>
          {state.status === 'loading'
            ? 'Opening meal…'
            : state.status === 'missing'
              ? 'Meal not found'
              : 'Meal unavailable'}
        </Heading>
        <Body>
          {state.status === 'loading'
            ? 'Reading the private diary on this device.'
            : state.status === 'missing'
              ? 'This meal may have been deleted or belongs to sample history.'
              : 'After could not read this meal. Return to Today and try again.'}
        </Body>
        {state.status === 'error' ? (
          <ActionButton label="Try again" onPress={() => void loadMeal()} testID="meal-detail-retry" />
        ) : null}
        <ActionButton
          label="Back to timeline"
          onPress={() => router.replace('/')}
          testID="meal-detail-back"
          variant="secondary"
        />
      </Screen>
    );
  }

  const { meal } = state;

  return (
    <Screen>
      <View style={styles.topRow} testID="meal-detail-screen">
        <Eyebrow>Saved meal</Eyebrow>
        <StatusPill tone={meal.source === 'sample' ? 'peach' : 'sage'}>
          {meal.source === 'sample' ? 'Synthetic sample' : 'Private on device'}
        </StatusPill>
      </View>
      <Heading>{meal.name}</Heading>
      <Body>{formatMealTime(meal.occurredAt)}</Body>

      {meal.imageUri ? (
        <Image
          accessibilityLabel={`Photo for ${meal.name}`}
          contentFit="cover"
          source={sampleMealImageSource(meal.imageUri)}
          style={styles.photo}
          testID="meal-detail-photo"
        />
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>Confirmed factors</Text>
        {meal.factors.length > 0 ? (
          <View style={styles.tags}>
            {meal.factors.map(({ factor }) => (
              <Text key={factor.id} style={styles.tag}>{factor.label}</Text>
            ))}
          </View>
        ) : (
          <Body>No factors were attached to this meal.</Body>
        )}
      </Card>

      {meal.source === 'sample' ? (
        <Card style={styles.checkInCard}>
          <Text style={styles.cardTitle}>Sample record only</Text>
          <Body>
            This fictional meal is read-only and kept separate from your private diary. Disable
            sample history in Settings to return to your records.
          </Body>
        </Card>
      ) : (
        <>
          <Card style={styles.checkInCard}>
            <Text style={styles.cardTitle}>Follow-up</Text>
            <Body>
              Check-in window: {formatDelay(meal.checkInDelayMinutes)} after the meal. You can record
              an observation now without waiting for the reminder.
            </Body>
            <ActionButton
              label="Check in now"
              onPress={() =>
                router.push({ pathname: '/check-in/[mealId]', params: { mealId: String(meal.id) } })
              }
              testID="meal-detail-check-in"
            />
          </Card>

          <ActionButton
            disabled={isDeleting}
            label={isDeleting ? 'Deleting…' : 'Delete meal'}
            onPress={() => confirmDelete(meal)}
            testID="meal-detail-delete"
            variant="secondary"
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: spacing.sm },
  checkInCard: { backgroundColor: palette.peachSoft, gap: spacing.md },
  photo: { borderRadius: radii.md, height: 240, width: '100%' },
  tag: {
    backgroundColor: palette.sage,
    borderRadius: radii.pill,
    color: palette.forestPressed,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
});

function formatMealTime(occurredAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(occurredAt));
}

function formatDelay(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }

  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`;
}
