import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInUp, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppTheme } from '@/components/app-screen';
import { radius, springConfig, typography } from '@/constants/design';

export function Card({ children, accent, style, delay = 0, variant = 'default' }: PropsWithChildren<{ accent?: string; style?: StyleProp<ViewStyle>; delay?: number; variant?: 'default' | 'elevated' | 'inset' }>) {
  const theme = useAppTheme();
  return (
    <Animated.View
      entering={process.env.EXPO_OS === 'web' ? undefined : FadeIn.delay(delay).duration(140)}
      layout={process.env.EXPO_OS === 'web' ? undefined : LinearTransition.duration(120)}
      style={[{
        position: 'relative', overflow: 'hidden', backgroundColor: variant === 'elevated' ? theme.cardStrong : theme.card,
        borderRadius: radius.card, borderCurve: 'continuous', padding: 17, gap: 12,
        boxShadow: variant === 'inset' ? 'inset 5px 5px 14px rgba(0,0,0,.28), inset -5px -5px 12px rgba(255,255,255,.018)' : '13px 16px 34px rgba(0,0,0,.24), -6px -6px 18px rgba(255,255,255,.018), inset 0 1px 0 rgba(255,255,255,.035), inset 0 -1px 0 rgba(0,0,0,.28)',
      }, style]}>
      {children}
      {accent ? <View pointerEvents="none" style={{ position: 'absolute', top: 22, right: 0, width: 3, height: 38, borderTopLeftRadius: 3, borderBottomLeftRadius: 3, backgroundColor: accent }} /> : null}
    </Animated.View>
  );
}

export function EditorialHeader({ eyebrow, title, description, trailing }: { eyebrow: string; title: string; description?: string; trailing?: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Animated.View entering={process.env.EXPO_OS === 'web' ? undefined : FadeInUp.duration(280)} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text selectable style={{ color: theme.muted, fontFamily: typography.bold, fontSize: 11 }}>{eyebrow}</Text>
          <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 35, lineHeight: 43, letterSpacing: -1.35, paddingBottom: 2 }}>{title}</Text>
        </View>
        {trailing}
      </View>
      {description ? <Text selectable style={{ color: theme.muted, maxWidth: 390, fontFamily: typography.regular, fontSize: 14, lineHeight: 21 }}>{description}</Text> : null}
    </Animated.View>
  );
}

export function SectionTitle({ title, action, onPress, index }: { title: string; action?: string; onPress?: () => void; index?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 1 }}>
      <Text selectable style={{ color: theme.heading, flex: 1, fontFamily: typography.semibold, fontSize: 15, letterSpacing: -0.2 }}>{index ? `${index}  ` : ''}{title}</Text>
      {action ? <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}><Text style={{ color: theme.accent, fontFamily: typography.bold, fontSize: 11 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Avatar({ name, color, size = 42, active = false }: { name: string; color?: string; size?: number; active?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={{ width: size, height: size, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: size / 2, backgroundColor: color ?? theme.soft, boxShadow: active ? `inset 0 0 0 2px ${theme.accent}, 0 6px 13px rgba(0,0,0,.23)` : 'inset 0 1px 0 rgba(255,255,255,.05), 0 6px 13px rgba(0,0,0,.23)' }}>
      <Text selectable style={{ color: theme.heading, fontFamily: typography.bold, fontSize: size * 0.29 }}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

export function Pill({ children, tone = 'neutral' }: PropsWithChildren<{ tone?: 'positive' | 'negative' | 'pending' | 'chores' | 'neutral' | 'subtle' }>) {
  const theme = useAppTheme();
  const warning = tone === 'pending' || tone === 'negative';
  const subtle = tone === 'subtle' || tone === 'neutral';
  const dot = subtle ? theme.dot : theme.accent;
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 28, borderRadius: 999, paddingHorizontal: 11, backgroundColor: warning ? 'rgba(255,64,0,.08)' : theme.cardStrong, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.035), inset 0 -1px 0 rgba(0,0,0,.24)' }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot, boxShadow: subtle ? undefined : '0 0 0 3px rgba(255,64,0,.10)' }} />
      <Text selectable style={{ color: warning ? theme.accent : theme.muted, fontFamily: typography.bold, fontSize: 10, letterSpacing: 0.25 }}>{children}</Text>
    </View>
  );
}

function MotionSurface({ children, disabled, onPress, style }: PropsWithChildren<{ disabled?: boolean; onPress?: () => void; style: ViewStyle }>) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const settle = (value: number) => { scale.value = withSpring(value, springConfig); };
  return <Animated.View style={animatedStyle}><Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPressIn={() => settle(.97)} onPressOut={() => settle(1)} onPress={onPress} style={style}>{children}</Pressable></Animated.View>;
}

export function PrimaryButton({ label, onPress, tone = 'accent', disabled = false, icon = 'arrow-forward' }: { label: string; onPress?: () => void; tone?: 'money' | 'chores' | 'plain' | 'accent' | 'dark'; disabled?: boolean; icon?: React.ComponentProps<typeof MaterialIcons>['name'] }) {
  const theme = useAppTheme();
  const dark = tone === 'dark' || tone === 'plain';
  const handlePress = () => { if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); };
  return (
    <MotionSurface disabled={disabled} onPress={handlePress} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: dark ? theme.soft : theme.accent, borderRadius: 19, borderCurve: 'continuous', opacity: disabled ? .42 : 1, paddingLeft: 19, paddingRight: 10, boxShadow: dark ? '0 12px 28px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.045)' : '0 12px 28px rgba(255,64,0,.16), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -2px 0 rgba(100,20,0,.28)' }}>
      <Text style={{ color: '#fff', fontFamily: typography.semibold, fontSize: 16 }}>{label}</Text>
      <View style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,.14)' }}><MaterialIcons name={icon} size={19} color="#fff" /></View>
    </MotionSurface>
  );
}

export function GhostButton({ label, onPress, color }: { label: string; onPress?: () => void; color?: string }) {
  const theme = useAppTheme();
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? .5 : 1, paddingVertical: 6 })}><Text style={{ color: color ?? theme.accent, fontFamily: typography.bold, fontSize: 10 }}>{label.toUpperCase()}</Text></Pressable>;
}

export function FloatingAction({ label, onPress }: { label: string; onPress?: () => void }) {
  const theme = useAppTheme();
  return <MotionSurface onPress={onPress} style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 25px rgba(255,64,0,.18), inset 0 1px 0 rgba(255,255,255,.2)' }}><MaterialIcons accessibilityLabel={label} name="add" size={24} color="#fff" /></MotionSurface>;
}

export function StatChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const theme = useAppTheme();
  return <View style={{ flex: 1, minWidth: 0, minHeight: 94, justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 17, padding: 13, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.03), 0 10px 24px rgba(0,0,0,.2)' }}><Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9 }}>{label.toUpperCase()}</Text><Text selectable style={{ color: accent ?? theme.heading, fontFamily: typography.semibold, fontSize: 22, fontVariant: ['tabular-nums'] }}>{value}</Text></View>;
}

export function Segmented({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const theme = useAppTheme();
  return <View style={{ flexDirection: 'row', gap: 5, padding: 5, borderRadius: 18, backgroundColor: theme.card, boxShadow: 'inset 4px 4px 10px rgba(0,0,0,.24)' }}>{options.map((option) => { const selected = option.value === value; return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={({ pressed }) => ({ flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: selected ? theme.cardStrong : 'transparent', opacity: pressed ? .7 : 1, boxShadow: selected ? '0 5px 14px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.045)' : undefined })}><Text style={{ color: selected ? theme.heading : theme.muted, fontFamily: typography.semibold, fontSize: 12 }}>{option.label}</Text></Pressable>; })}</View>;
}

export function SelectField({ accessibilityLabel, options, value, onChange }: { accessibilityLabel: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => ({
          minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15,
          borderRadius: 17, borderCurve: 'continuous', backgroundColor: theme.background, opacity: pressed ? .72 : 1,
          boxShadow: 'inset 4px 4px 10px rgba(0,0,0,.28)',
        })}>
        <Text selectable style={{ flex: 1, color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{selected?.label ?? 'Select'}</Text>
        <MaterialIcons name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={theme.muted} />
      </Pressable>
      {open ? (
        <View style={{ padding: 5, borderRadius: 17, backgroundColor: theme.cardStrong, boxShadow: '0 12px 26px rgba(0,0,0,.28)' }}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => { onChange(option.value); setOpen(false); }}
                style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 13, backgroundColor: active ? theme.soft : 'transparent', opacity: pressed ? .7 : 1 })}>
                <Text style={{ flex: 1, color: active ? theme.heading : theme.muted, fontFamily: typography.medium, fontSize: 13 }}>{option.label}</Text>
                {active ? <MaterialIcons name="check" size={17} color={theme.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function Callout({ title, children }: PropsWithChildren<{ title: string }>) {
  const theme = useAppTheme();
  return <View style={{ padding: 16, borderRadius: 19, backgroundColor: 'rgba(255,64,0,.07)', boxShadow: 'inset 0 0 0 1px rgba(255,64,0,.06)', gap: 5 }}><Text selectable style={{ color: theme.accent, fontFamily: typography.semibold, fontSize: 13 }}>{title}</Text><Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 12, lineHeight: 18 }}>{children}</Text></View>;
}
