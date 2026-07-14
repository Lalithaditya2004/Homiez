import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';

import { radius, spacing } from '@/constants/design';
import { useAppTheme } from '@/components/app-screen';

export function Card({ children, accent, style }: PropsWithChildren<{ accent?: string; style?: object }>) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: accent ?? theme.border,
          borderWidth: 1,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          padding: spacing.lg,
          gap: spacing.md,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text selectable style={{ color: theme.heading, fontSize: 18, fontWeight: '700', letterSpacing: -0.2 }}>
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
          <Text selectable style={{ color: theme.chores, fontSize: 14, fontWeight: '700' }}>
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Avatar({ name, color }: { name: string; color?: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: color ?? theme.choresTint,
      }}>
      <Text selectable style={{ color: theme.heading, fontWeight: '800', fontSize: 14 }}>
        {name.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function Pill({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'positive' | 'negative' | 'pending' | 'chores' | 'neutral' }>) {
  const theme = useAppTheme();
  const colors = {
    positive: [theme.moneyPositiveTint, theme.moneyPositive],
    negative: [theme.moneyNegativeTint, theme.moneyNegative],
    pending: [theme.pendingTint, theme.pending],
    chores: [theme.choresTint, theme.chores],
    neutral: [theme.background, theme.muted],
  } as const;
  const [backgroundColor, color] = colors[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text selectable style={{ color, fontSize: 12, fontWeight: '800' }}>
        {children}
      </Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  tone = 'money',
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'money' | 'chores' | 'plain';
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const backgroundColor = tone === 'chores' ? theme.chores : tone === 'plain' ? theme.heading : theme.moneyNegative;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor,
        borderRadius: radius.button,
        borderCurve: 'continuous',
        opacity: disabled ? 0.45 : pressed ? 0.84 : 1,
        paddingHorizontal: spacing.lg,
      })}>
      <Text selectable style={{ color: tone === 'plain' ? theme.card : '#FFFFFF', fontSize: 16, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, color }: { label: string; onPress?: () => void; color?: string }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.65 : 1 })}>
      <Text selectable style={{ color: color ?? theme.chores, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}
