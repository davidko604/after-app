import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { SupportedImageMediaType } from '@/features/meal-analysis/contract';

const PHOTO_DIRECTORY_NAME = 'meal-photos';

const EXTENSION_BY_MEDIA_TYPE: Record<SupportedImageMediaType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function persistMealPhoto(
  sourceUri: string,
  mediaType: SupportedImageMediaType | null,
): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }

  const directory = mealPhotoDirectory();
  directory.create({ idempotent: true, intermediates: true });

  const source = new File(sourceUri);
  if (!source.exists) {
    throw new Error('The selected photo is no longer available on this device.');
  }

  const sourceExtension = source.extension.replace(/^\./, '').toLocaleLowerCase();
  const extension = mediaType
    ? EXTENSION_BY_MEDIA_TYPE[mediaType]
    : /^[a-z0-9]{2,5}$/.test(sourceExtension)
      ? sourceExtension
      : 'image';
  const filename = `${Date.now()}-${randomSuffix()}.${extension}`;
  const destination = new File(directory, filename);
  await source.copy(destination);
  return destination.uri;
}

export function deletePersistedMealPhoto(uri: string | null): void {
  if (!uri || Platform.OS === 'web') {
    return;
  }

  const directory = mealPhotoDirectory();
  if (!uri.startsWith(`${directory.uri}/`)) {
    return;
  }

  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

function mealPhotoDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIRECTORY_NAME);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
