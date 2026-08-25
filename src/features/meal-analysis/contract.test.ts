import { describe, expect, it } from 'vitest';

import { parseMealAnalysisResult } from './contract';

describe('parseMealAnalysisResult', () => {
  it('parses the current meal-name response contract', () => {
    expect(
      parseMealAnalysisResult({
        contractVersion: 2,
        factors: ['dairy', 'high-fat'],
        mealName: 'Creamy mushroom pasta',
        model: 'gpt-5.6-luna',
        notice: 'Confirm these hypotheses because hidden ingredients are not visible.',
        source: 'openai',
      }),
    ).toEqual({
      contractVersion: 2,
      factors: ['dairy', 'high-fat'],
      mealName: 'Creamy mushroom pasta',
      model: 'gpt-5.6-luna',
      notice: 'Confirm these hypotheses because hidden ingredients are not visible.',
      source: 'openai',
    });
  });

  it('rejects an older route that omits the contract version and meal name', () => {
    expect(
      parseMealAnalysisResult({
        factors: ['spicy'],
        model: 'gpt-5.6-luna',
        notice: 'Hidden ingredients cannot be identified from a photo.',
        source: 'openai',
      }),
    ).toBeNull();
  });

  it('rejects unknown contracts and invalid meal names', () => {
    expect(
      parseMealAnalysisResult({
        contractVersion: 3,
        factors: [],
        mealName: 'Soup',
        model: 'gpt-5.6-luna',
        notice: 'Confirm manually.',
        source: 'openai',
      }),
    ).toBeNull();
    expect(
      parseMealAnalysisResult({
        contractVersion: 2,
        factors: [],
        mealName: '',
        model: 'gpt-5.6-luna',
        notice: 'Confirm manually.',
        source: 'openai',
      }),
    ).toBeNull();
  });
});
