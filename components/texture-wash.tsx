import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';

import { themeFor } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function TextureWash() {
  const theme = themeFor(useColorScheme());
  return (
    <Svg pointerEvents="none" width="100%" height={520} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <Pattern id="grain" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
          <Circle cx="2" cy="3" r="0.8" fill={theme.navy} opacity={0.12} />
          <Circle cx="13" cy="11" r="0.55" fill={theme.accent} opacity={0.14} />
          <Line x1="4" y1="17" x2="17" y2="4" stroke={theme.soft} strokeWidth="0.45" opacity={0.2} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="520" fill="url(#grain)" />
      <Circle cx="93%" cy="64" r="142" fill={theme.soft} opacity={0.13} />
      <Circle cx="-4%" cy="350" r="92" fill={theme.accent} opacity={0.055} />
    </Svg>
  );
}
