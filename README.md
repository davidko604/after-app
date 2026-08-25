# After

After is a private, offline-first food-to-symptom journal built with Expo SDK 57. It helps people collect structured observations and see possible personal patterns. It does not diagnose conditions or provide medical advice.

## Development

Use Node 22.13 or newer. This repository was checked with Node 24. Install dependencies, then start the development server:

```bash
npm install
npx expo start
```

This project intentionally targets development builds rather than Expo Go because its native dependency set includes SQLite, notifications, Image Picker, and EAS Observe.

Useful checks:

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo install --check
```

## Privacy boundary

- Meal, symptom, context, factor, and note data is stored locally with Expo SQLite.
- There are no accounts or cloud synchronization.
- Sensitive diary data must never be added to logs or Observe attributes.
- Meal-photo analysis must remain optional. It starts with a deterministic fixture and cannot receive symptom records or notes.

## Build profiles

`eas.json` defines installable Android development/preview APKs, an iOS development-simulator build, and a production profile. Android package and iOS bundle identifiers are intentionally unset until they are confirmed before the first long-lived build or store record.

Private hackathon and presentation notes live in the local-only `.private/` directory, excluded through `.git/info/exclude`.
