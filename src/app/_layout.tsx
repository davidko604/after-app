import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/constants/theme';
import { DATABASE_NAME, migrateDatabase } from '@/db/migrate';
import { PrototypeStateProvider } from '@/features/prototype/prototype-state';
import { withObserveRoot } from '@/services/observe';

void SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.canvas },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.canvas },
        headerTintColor: palette.ink,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="meal/new" options={{ title: 'Log a meal', presentation: 'modal' }} />
      <Stack.Screen name="meal/[mealId]" options={{ title: 'Meal details' }} />
      <Stack.Screen
        name="check-in/[mealId]"
        options={{ title: 'Bathroom check-in', presentation: 'modal' }}
      />
    </Stack>
  );
}

function RootLayout() {
  const [databaseError, setDatabaseError] = useState<Error | null>(null);
  const handleDatabaseError = useCallback((error: Error) => {
    // SQLiteProvider reports initialization failures while rendering its error state.
    // Defer our parent update so React can finish that render first.
    queueMicrotask(() => setDatabaseError(error));
  }, []);

  useEffect(() => {
    if (databaseError) {
      void SplashScreen.hideAsync();
    }
  }, [databaseError]);

  if (databaseError) {
    return (
      <View accessibilityRole="alert" style={styles.centered}>
        <Text style={styles.errorTitle}>After could not open your diary</Text>
        <Text style={styles.loadingBody}>
          The local database could not be prepared. Close and reopen the app. If this keeps
          happening, reinstall this development build before adding real entries.
        </Text>
        {__DEV__ ? <Text style={styles.errorDetail}>{databaseError.message}</Text> : null}
      </View>
    );
  }

  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onError={handleDatabaseError}
      onInit={migrateDatabase}>
      <PrototypeStateProvider>
        <AppNavigator />
      </PrototypeStateProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: palette.canvas,
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorDetail: {
    color: palette.muted,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 560,
    textAlign: 'center',
  },
  loadingBody: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 420,
    textAlign: 'center',
  },
});

export default withObserveRoot(RootLayout);
