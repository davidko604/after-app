import {
  FIXTURE_FACTOR_KEYS,
  MEAL_FACTOR_OPTIONS,
  type MealAnalysisErrorCode,
  type MealAnalysisErrorResponse,
  type MealAnalysisResult,
  type MealFactorKey,
  parseMealAnalysisRequest,
} from '@/features/meal-analysis/contract';

const OPENAI_MODEL = 'gpt-5.6-luna' as const;
const OPENAI_TIMEOUT_MS = 18_000;

const ANALYSIS_SCHEMA = {
  additionalProperties: false,
  properties: {
    factors: {
      items: {
        enum: MEAL_FACTOR_OPTIONS.map((option) => option.key),
        type: 'string',
      },
      type: 'array',
    },
    mealName: {
      type: 'string',
    },
    notice: {
      type: 'string',
    },
  },
  required: ['factors', 'mealName', 'notice'],
  type: 'object',
} as const;

type OpenAIAnalysisPayload = {
  factors: MealFactorKey[];
  mealName: string;
  notice: string;
};

export function GET() {
  const isOpenAI = process.env.MEAL_ANALYSIS_PROVIDER === 'openai';
  return Response.json({
    configured: isOpenAI && Boolean(process.env.OPENAI_API_KEY),
    model: isOpenAI ? OPENAI_MODEL : 'deterministic-fixture',
    provider: isOpenAI ? 'openai' : 'fixture',
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const input = parseMealAnalysisRequest(body);

  if (!input) {
    return errorResponse(
      'invalid_request',
      'The selected image could not be prepared for analysis.',
      'Choose a JPEG, PNG, or WebP image under 4.5 MB, or review factors manually.',
      400,
    );
  }

  if (process.env.MEAL_ANALYSIS_PROVIDER !== 'openai') {
    return Response.json(fixtureResult());
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse(
      'not_configured',
      'Meal-photo analysis is not configured on this server.',
      'Ask the demo operator to configure the server-only OpenAI key, or review factors manually.',
      503,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const providerResponse = await fetch('https://api.openai.com/v1/responses', {
      body: JSON.stringify({
        input: [
          {
            content:
              'Suggest a short editable meal name and identify only possible meal factors from the allowed list. Base both only on visible food and drink. Treat every factor as a hypothesis. Never infer hidden ingredients, safety, causality, a diagnosis, or dietary advice.',
            role: 'system',
          },
          {
            content: [
              {
                detail: 'low',
                image_url: `data:${input.mediaType};base64,${input.imageBase64}`,
                type: 'input_image',
              },
              {
                text: `Suggest a concise 2–6 word meal name based on what is visibly present. Use a generic description when the exact dish is uncertain. Allowed factors: ${MEAL_FACTOR_OPTIONS.map((option) => `${option.key} (${option.label})`).join(', ')}. Return only visible, plausible factor hypotheses. The notice must briefly tell the user to review the suggestions before saving.`,
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        max_output_tokens: 300,
        model: OPENAI_MODEL,
        reasoning: { effort: 'none' },
        store: false,
        text: {
          format: {
            name: 'meal_photo_suggestions',
            schema: ANALYSIS_SCHEMA,
            strict: true,
            type: 'json_schema',
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    });

    if (!providerResponse.ok) {
      if (providerResponse.status === 401 || providerResponse.status === 403) {
        return errorResponse(
          'provider_authentication',
          'The meal-analysis credential was rejected.',
          'Ask the demo operator to replace the server-only OpenAI key, or review factors manually.',
          502,
        );
      }

      if (providerResponse.status === 429) {
        return errorResponse(
          'provider_rate_limit',
          'The meal-analysis service is temporarily rate limited.',
          'Review factors manually and try a different photo later.',
          429,
        );
      }

      if (providerResponse.status === 400) {
        return errorResponse(
          'provider_request',
          'The meal-analysis request was rejected by the model service.',
          'Review factors manually while the demo operator checks the server contract.',
          502,
        );
      }

      return errorResponse(
        'provider_unavailable',
        'The meal-analysis service did not complete the request.',
        'Review factors manually and try again later.',
        502,
      );
    }

    const providerBody: unknown = await providerResponse.json().catch(() => null);
    const outputText = extractOutputText(providerBody);
    const analysis = outputText ? parseOpenAIAnalysis(outputText) : null;
    if (!analysis) {
      return errorResponse(
        'invalid_provider_response',
        'The meal-analysis service returned an unexpected result.',
        'Review factors manually. No diary or symptom data was sent.',
        502,
      );
    }

    const result: MealAnalysisResult = {
      contractVersion: 2,
      factors: analysis.factors,
      mealName: analysis.mealName,
      model: OPENAI_MODEL,
      notice: analysis.notice,
      source: 'openai',
    };
    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return errorResponse(
      'provider_unavailable',
      'The meal-analysis service could not be reached.',
      'Check the server connection or review factors manually.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function fixtureResult(): MealAnalysisResult {
  return {
    contractVersion: 2,
    factors: [...FIXTURE_FACTOR_KEYS],
    mealName: null,
    model: 'deterministic-fixture',
    notice: 'Demo fixture only. Review the suggestions before saving.',
    source: 'fixture',
  };
}

function errorResponse(
  code: MealAnalysisErrorCode,
  message: string,
  recovery: string,
  status: number,
) {
  const body: MealAnalysisErrorResponse = { error: { code, message, recovery } };
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
    status,
  });
}

function extractOutputText(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.output_text === 'string') {
    return value.output_text;
  }

  if (!Array.isArray(value.output)) {
    return null;
  }

  for (const item of value.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  return null;
}

function parseOpenAIAnalysis(value: string): OpenAIAnalysisPayload | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.factors) ||
      typeof parsed.mealName !== 'string' ||
      parsed.mealName.trim().length === 0 ||
      parsed.mealName.trim().length > 80 ||
      typeof parsed.notice !== 'string' ||
      parsed.notice.length === 0 ||
      parsed.notice.length > 240
    ) {
      return null;
    }

    const factors = parsed.factors.filter(isMealFactorKey);
    if (factors.length !== parsed.factors.length) {
      return null;
    }

    return {
      factors: [...new Set(factors)],
      mealName: parsed.mealName.trim(),
      notice: parsed.notice,
    };
  } catch {
    return null;
  }
}

function isMealFactorKey(value: unknown): value is MealFactorKey {
  return MEAL_FACTOR_OPTIONS.some((option) => option.key === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
