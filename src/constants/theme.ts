import { Platform } from 'react-native';

export const palette = {
  canvas: '#F7F3EA',
  card: '#FFFDF8',
  ink: '#22352A',
  muted: '#68766E',
  forest: '#356146',
  forestPressed: '#294D38',
  sage: '#DCE8D7',
  sageStrong: '#BDD4B7',
  peach: '#F3C59E',
  peachSoft: '#F9E5D2',
  border: '#DEDCD3',
  white: '#FFFFFF',
  danger: '#9D3E35',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const maxContentWidth = 680;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#20362A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 2 },
  default: {},
});
