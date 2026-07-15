import type { ColorSchemeName } from 'react-native';

export const brandColors = {
  background: '#201E1F',
  surface: '#2A2729',
  surface2: '#353133',
  surface3: '#3C383A',
  text: '#F3F3F3',
  muted: '#A1A1A1',
  faint: '#6F6F6F',
  accent: '#FF4000',
  blue: '#2F7CF6',
  yellow: '#F4B400',
  pink: '#FF2D7A',
  dot: '#BDBDBD',
  cream: '#F3F3F3',
  periwinkle: '#A1A1A1',
  azure: '#FF4000',
  navy: '#FF4000',
  charcoal: '#201E1F',
} as const;

const darkPalette = {
  background: brandColors.background,
  card: brandColors.surface,
  cardStrong: brandColors.surface2,
  border: 'rgba(255,255,255,0.055)',
  heading: brandColors.text,
  body: brandColors.text,
  muted: brandColors.muted,
  faint: brandColors.faint,
  accent: brandColors.accent,
  navy: brandColors.accent,
  soft: brandColors.surface3,
  surfaceInverse: brandColors.surface2,
  textInverse: '#FFFFFF',
  moneyPositive: brandColors.accent,
  moneyPositiveTint: 'rgba(255,64,0,0.10)',
  moneyNegative: brandColors.text,
  moneyNegativeTint: brandColors.surface3,
  pending: brandColors.accent,
  pendingTint: 'rgba(255,64,0,0.08)',
  chores: brandColors.accent,
  choresTint: brandColors.surface3,
  slacker: brandColors.muted,
  slackerTint: brandColors.surface3,
  shadow: 'rgba(0,0,0,0.42)',
  shadowSoft: 'rgba(0,0,0,0.24)',
  wash: 'transparent',
  blue: brandColors.blue,
  yellow: brandColors.yellow,
  pink: brandColors.pink,
  dot: brandColors.dot,
} as const;

export const palette = { light: darkPalette, dark: darkPalette } as const;
export type AppTheme = { [Key in keyof typeof darkPalette]: string };

export function themeFor(_colorScheme: ColorSchemeName): AppTheme {
  return darkPalette;
}

export const typography = {
  display: 'Manrope_700Bold',
  displayItalic: 'Manrope_600SemiBold',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
} as const;

export const radius = { card: 21, cardSmall: 17, button: 19, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, display: 36 } as const;
export const springConfig = { damping: 18, stiffness: 240, mass: 0.72 } as const;
