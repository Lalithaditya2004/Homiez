import { Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { brandColors, typography } from '@/constants/design';

export function BrandMark({ size = 42 }: { size?: number; inverse?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" accessibilityLabel="Homiez logo">
      <Rect width="128" height="128" rx="34" fill={brandColors.surface2} />
      <Path d="M27 101V47L64 23L101 47V101H76V70H52V101H27Z" fill={brandColors.text} />
      <Path d="M52 70H76V101H52V70Z" fill={brandColors.accent} />
    </Svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <BrandMark size={compact ? 34 : 42} />
      <Text selectable style={{ color: brandColors.text, fontFamily: typography.extraBold, fontSize: compact ? 16 : 20, letterSpacing: -0.55 }}>homiez</Text>
    </View>
  );
}
