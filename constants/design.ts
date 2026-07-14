import type { ColorSchemeName } from 'react-native';

export const palette = {
  light: {
    background: '#F6F1E7',
    heroStart: '#FBE4D0',
    heroEnd: '#EFA980',
    card: '#FFFCF8',
    border: '#E7DDD0',
    heading: '#2B2A26',
    body: '#3F3B34',
    muted: '#85796A',
    moneyPositive: '#5B7F5E',
    moneyPositiveTint: '#E1EAE0',
    moneyNegative: '#C1613F',
    moneyNegativeTint: '#F5E0D2',
    pending: '#D9A441',
    pendingTint: '#F7ECD3',
    chores: '#4C6B8A',
    choresTint: '#DCE6EE',
    slacker: '#B24C25',
    slackerTint: '#F3DCCF',
  },
  dark: {
    background: '#1E1B17',
    heroStart: '#4C3026',
    heroEnd: '#7F4733',
    card: '#29241E',
    border: '#3D362C',
    heading: '#F3EDE3',
    body: '#DED5C8',
    muted: '#B7AC9C',
    moneyPositive: '#7FAE7F',
    moneyPositiveTint: '#27362A',
    moneyNegative: '#E08A63',
    moneyNegativeTint: '#4B2F26',
    pending: '#E8BE72',
    pendingTint: '#4B3C22',
    chores: '#7FA6C4',
    choresTint: '#283844',
    slacker: '#D97C4C',
    slackerTint: '#4F2E22',
  },
} as const;

export type AppTheme = { [Key in keyof (typeof palette)['light']]: string };

export function themeFor(colorScheme: ColorSchemeName): AppTheme {
  return colorScheme === 'dark' ? palette.dark : palette.light;
}

export const radius = {
  card: 16,
  button: 14,
  pill: 20,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
