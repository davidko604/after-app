import {
  type MealAnalysisRequest,
  type MealAnalysisResult,
  parseMealAnalysisError,
  parseMealAnalysisResult,
} from './contract';

const REQUEST_TIMEOUT_MS = 20_000;

export class MealAnalysisClientError extends Error {
  constructor(
    message: string,
    readonly recovery: string,
  ) {
    super(message);
    this.name = 'MealAnalysisClientError';
  }
}

export async function analyzeMealPhoto(
  request: MealAnalysisRequest,
): Promise<MealAnalysisResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/meal-analysis', {
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const errorResponse = parseMealAnalysisError(body);
      throw new MealAnalysisClientError(
        errorResponse?.error.message ?? 'Meal-photo analysis did not complete.',
        errorResponse?.error.recovery ??
          'Review the existing factor suggestions manually and try again later.',
      );
    }

    const result = parseMealAnalysisResult(body);
    if (!result) {
      throw new MealAnalysisClientError(
        'Meal-photo analysis is out of sync with this app version.',
        'Continue manually. During development, reconnect the app to the current Expo session before trying again.',
      );
    }

    return result;
  } catch (error) {
    if (error instanceof MealAnalysisClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new MealAnalysisClientError(
        'Meal-photo analysis took too long.',
        'Check the connection or review the existing factor suggestions manually.',
      );
    }

    throw new MealAnalysisClientError(
      'After could not reach meal-photo analysis.',
      'Check the connection or review the existing factor suggestions manually.',
    );
  } finally {
    clearTimeout(timeout);
  }
}
