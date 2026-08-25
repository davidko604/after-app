import type { ImageSource } from 'expo-image';

const SAMPLE_IMAGE_SOURCES: Record<string, ImageSource> = {
  // Static requires keep demo images inside the native bundle and available offline.
  'sample://meal-1': require('../../../assets/sample-meals/breakfast-oatmeal-berries-coffee.png'),
  'sample://meal-2': require('../../../assets/sample-meals/lunch-colorful-grain-bowl.png'),
  'sample://meal-3': require('../../../assets/sample-meals/dinner-creamy-mushroom-spinach-pasta.png'),
  'sample://meal-4': require('../../../assets/sample-meals/takeout-fried-spicy-chicken-fries.png'),
};

export function sampleMealImageSource(uri: string): ImageSource {
  return SAMPLE_IMAGE_SOURCES[uri] ?? uri;
}
