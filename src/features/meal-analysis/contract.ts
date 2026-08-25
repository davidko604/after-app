export const MEAL_FACTOR_OPTIONS = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'caffeine', label: 'Caffeine' },
  { key: 'alcohol', label: 'Alcohol' },
  { key: 'spicy', label: 'Spicy food' },
  { key: 'high-fat', label: 'High-fat food' },
  { key: 'artificial-sweeteners', label: 'Artificial sweeteners' },
  { key: 'large-meal', label: 'Large meal' },
] as const;

export const FIXTURE_FACTOR_KEYS = ['dairy', 'high-fat', 'large-meal'] as const;

export const MAX_IMAGE_BASE64_LENGTH = 6_500_000;

export type MealFactorKey = (typeof MEAL_FACTOR_OPTIONS)[number]['key'];
export type MealAnalysisSource = 'fixture' | 'openai';
export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export type MealAnalysisRequest = {
  imageBase64: string;
  mediaType: SupportedImageMediaType;
};

export type MealAnalysisResult = {
  factors: MealFactorKey[];
  model: 'deterministic-fixture' | 'gpt-5.6-luna';
  notice: string;
  source: MealAnalysisSource;
};

export type MealAnalysisErrorCode =
  | 'invalid_request'
  | 'not_configured'
  | 'provider_authentication'
  | 'provider_request'
  | 'provider_rate_limit'
  | 'provider_unavailable'
  | 'invalid_provider_response';

export type MealAnalysisErrorResponse = {
  error: {
    code: MealAnalysisErrorCode;
    message: string;
    recovery: string;
  };
};

export function factorLabelForKey(key: MealFactorKey): string {
  return MEAL_FACTOR_OPTIONS.find((option) => option.key === key)?.label ?? key;
}

export function isMealFactorKey(value: unknown): value is MealFactorKey {
  return MEAL_FACTOR_OPTIONS.some((option) => option.key === value);
}

export function isSupportedImageMediaType(value: unknown): value is SupportedImageMediaType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export function parseMealAnalysisRequest(value: unknown): MealAnalysisRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const { imageBase64, mediaType } = value;
  if (
    typeof imageBase64 !== 'string' ||
    imageBase64.length === 0 ||
    imageBase64.length > MAX_IMAGE_BASE64_LENGTH ||
    !isSupportedImageMediaType(mediaType)
  ) {
    return null;
  }

  return { imageBase64, mediaType };
}

export function parseMealAnalysisResult(value: unknown): MealAnalysisResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const { factors, model, notice, source } = value;
  if (
    !Array.isArray(factors) ||
    !factors.every(isMealFactorKey) ||
    typeof notice !== 'string' ||
    (source !== 'fixture' && source !== 'openai') ||
    (model !== 'deterministic-fixture' && model !== 'gpt-5.6-luna')
  ) {
    return null;
  }

  return { factors: [...new Set(factors)], model, notice, source };
}

export function parseMealAnalysisError(value: unknown): MealAnalysisErrorResponse | null {
  if (!isRecord(value) || !isRecord(value.error)) {
    return null;
  }

  const { code, message, recovery } = value.error;
  if (
    !isMealAnalysisErrorCode(code) ||
    typeof message !== 'string' ||
    typeof recovery !== 'string'
  ) {
    return null;
  }

  return { error: { code, message, recovery } };
}

function isMealAnalysisErrorCode(value: unknown): value is MealAnalysisErrorCode {
  return (
    value === 'invalid_request' ||
    value === 'not_configured' ||
    value === 'provider_authentication' ||
    value === 'provider_request' ||
    value === 'provider_rate_limit' ||
    value === 'provider_unavailable' ||
    value === 'invalid_provider_response'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
