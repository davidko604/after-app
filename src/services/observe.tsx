import { requireOptionalNativeModule } from 'expo';
import type {
  ObserveConfig,
  ObserveInteractiveMarkerProps,
  ObserveRoot,
} from 'expo-observe';
import type { ComponentType } from 'react';

type ObservePackage = typeof import('expo-observe');
type ObserveRootWrap = typeof ObserveRoot.wrap;
type ObserveReadyMarkerComponent = ComponentType<ObserveInteractiveMarkerProps>;

type DurationBucket = 'under_1s' | '1_to_3s' | 'over_3s';

type TechnicalObserveEvent =
  | {
      attributes: { schemaVersion: number };
      name: 'database.ready';
    }
  | {
      attributes: { stage: 'open' | 'migrate' };
      name: 'database.failed';
    }
  | {
      attributes: {
        durationBucket: DurationBucket;
        mode: 'fixture' | 'remote';
        outcome: 'error' | 'fallback' | 'success';
      };
      name: 'image.analysis.completed';
    }
  | {
      attributes: {
        delayBucket: 'demo' | 'standard';
        outcome: 'fallback' | 'permission_denied' | 'scheduled';
      };
      name: 'notification.scheduling.completed';
    }
  | {
      attributes: { feature: 'image_analysis' | 'notification' };
      name: 'fallback.used';
    }
  | {
      attributes: { enabled: boolean };
      name: 'sample.changed';
    };

const FILTERED_ROUTE_PARAMS = [
  'factor',
  'factors',
  'factorTags',
  'mealId',
  'mealName',
  'note',
  'notificationId',
  'photoUri',
  'symptomId',
  'token',
];

const demoDispatchEnabled = process.env.EXPO_PUBLIC_OBSERVE_DEMO === 'true';
const nativeObserveAvailable =
  requireOptionalNativeModule<unknown>('ExpoObserve') !== null &&
  requireOptionalNativeModule<unknown>('ExpoAppMetrics') !== null;

function loadObservePackage(): ObservePackage {
  // A synchronous guarded load is required because importing expo-observe eagerly
  // throws in Expo Go before React can render a fallback.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-observe');
}

const observePackage = nativeObserveAvailable ? loadObservePackage() : null;

const observeConfig: ObserveConfig = {
  dispatchInDebug: demoDispatchEnabled && __DEV__,
  dispatchingEnabled: demoDispatchEnabled,
  environment: demoDispatchEnabled ? 'hackathon-demo' : 'production',
  integrations: {
    'expo-router': { filteredParams: FILTERED_ROUTE_PARAMS },
  },
};

observePackage?.Observe.configure(observeConfig);

const identityRootWrap: ObserveRootWrap = (Component) => Component;
const NoopReadyMarker: ObserveReadyMarkerComponent = () => null;

export const isObserveAvailable = nativeObserveAvailable;
export const isObserveDispatchEnabled = nativeObserveAvailable && demoDispatchEnabled;
export const withObserveRoot: ObserveRootWrap =
  observePackage?.ObserveRoot.wrap ?? identityRootWrap;
export const ObserveReadyMarker: ObserveReadyMarkerComponent =
  observePackage?.ObserveInteractiveMarker ?? NoopReadyMarker;

export function logTechnicalObserveEvent(event: TechnicalObserveEvent): void {
  observePackage?.Observe.logEvent(event.name, { attributes: event.attributes });
}

export type { TechnicalObserveEvent };
