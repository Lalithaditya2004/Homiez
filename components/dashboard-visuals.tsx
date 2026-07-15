import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline } from 'react-native-svg';

import { useAppTheme } from '@/components/app-screen';
import { typography } from '@/constants/design';
import { formatMoney } from '@/lib/money';

export function BalanceOrbit({ balanceCents, size = 174, inverse = false }: { balanceCents: number; size?: number; inverse?: boolean }) {
  const theme = useAppTheme();
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  const confidence = Math.min(Math.abs(balanceCents) / 5000, 1);
  const dash = Math.max(circumference * Math.max(confidence, 0.08), 30);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 174 174" style={{ position: 'absolute' }}>
        <Circle cx="87" cy="87" r="76" fill="none" stroke={theme.soft} strokeWidth="1" strokeDasharray="2 8" />
        <Circle cx="87" cy="87" r={radius} fill="none" stroke={inverse ? theme.navy : theme.soft} strokeWidth="13" opacity={0.48} />
        <Circle
          cx="87"
          cy="87"
          r={radius}
          fill="none"
          stroke={balanceCents >= 0 ? (inverse ? theme.soft : theme.accent) : theme.accent}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 87 87)"
        />
        <Circle cx="87" cy="21" r="6" fill={inverse ? theme.surfaceInverse : theme.background} stroke={inverse ? theme.soft : theme.navy} strokeWidth="3" />
        <Circle cx="153" cy="87" r="5" fill={theme.soft} stroke={theme.accent} strokeWidth="2" />
      </Svg>
      <Text selectable style={{ color: inverse ? theme.textInverse : theme.heading, fontFamily: typography.display, fontSize: 29, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>
        {formatMoney(Math.abs(balanceCents))}
      </Text>
      <Text selectable style={{ color: inverse ? theme.soft : theme.muted, fontFamily: typography.bold, fontSize: 9, letterSpacing: 1.4 }}>
        {balanceCents >= 0 ? 'COMING TO YOU' : 'YOURS TO SETTLE'}
      </Text>
    </View>
  );
}

export function MicroSparkline({ values, width = 118, height = 36 }: { values: number[]; width?: number; height?: number }) {
  const theme = useAppTheme();
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={width} height={height} accessibilityLabel="Expense trend sparkline">
      <Line x1="0" y1={height - 4} x2={width} y2={height - 4} stroke={theme.soft} strokeWidth="1" strokeDasharray="3 5" />
      <Polyline points={points} fill="none" stroke={theme.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {values.length ? <Circle cx={Number(points.split(' ').at(-1)?.split(',')[0] ?? width)} cy={Number(points.split(' ').at(-1)?.split(',')[1] ?? height / 2)} r="4" fill={theme.background} stroke={theme.navy} strokeWidth="2" /> : null}
    </Svg>
  );
}

export function ChoreRing({ completed, total, size = 86 }: { completed: number; total: number; size?: number }) {
  const theme = useAppTheme();
  const radius = 33;
  const circumference = 2 * Math.PI * radius;
  const progress = total ? Math.min(completed / total, 1) : 0;
  const dash = Math.max(circumference * progress, progress ? 18 : 0);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 86 86" style={{ position: 'absolute' }}>
        <Circle cx="43" cy="43" r={radius} fill="none" stroke={theme.soft} strokeWidth="8" opacity={0.5} />
        <Circle cx="43" cy="43" r={radius} fill="none" stroke={theme.navy} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} transform="rotate(-90 43 43)" />
      </Svg>
      <Text selectable style={{ color: theme.heading, fontFamily: typography.display, fontSize: 24 }}>{completed}/{total}</Text>
    </View>
  );
}

export function DebtRouteMap({ transactionCount }: { transactionCount: number }) {
  const theme = useAppTheme();
  return (
    <Svg width={126} height={74} viewBox="0 0 126 74" accessibilityLabel={`${transactionCount} direct settlement paths`}>
      <Path d="M17 57C36 16 63 16 109 38" fill="none" stroke={theme.soft} strokeWidth="8" strokeLinecap="round" />
      <Path d="M17 57C40 24 68 24 109 38" fill="none" stroke={theme.accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="5 6" />
      <G>
        <Circle cx="17" cy="57" r="10" fill={theme.background} stroke={theme.navy} strokeWidth="4" />
        <Circle cx="63" cy="21" r="8" fill={theme.soft} stroke={theme.accent} strokeWidth="3" />
        <Circle cx="109" cy="38" r="11" fill={theme.navy} stroke={theme.background} strokeWidth="4" />
      </G>
      <Line x1="102" y1="31" x2="112" y2="38" stroke={theme.background} strokeWidth="2" strokeLinecap="round" />
      <Line x1="102" y1="45" x2="112" y2="38" stroke={theme.background} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
