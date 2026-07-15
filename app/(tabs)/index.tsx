import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { BrandLockup } from '@/components/brand-mark';
import { Avatar, Card, EditorialHeader, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatDate, formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

function RouteMap() {
  const theme = useAppTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12, borderRadius: 19, backgroundColor: theme.background, boxShadow: 'inset 4px 4px 10px rgba(0,0,0,.3)' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent }} /><View style={{ width: 25, height: 2, backgroundColor: theme.faint }} /><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.soft }} /></View>;
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const { data, balances, cloudState, recentChoreLogs } = useHousehold();
  const currentMember = data.members.find((member) => member.id === data.currentUserId)!;
  const currentBalance = balances.find((balance) => balance.memberId === data.currentUserId)?.cents ?? 0;
  const pending = recentChoreLogs.filter((log) => log.status === 'pending').slice(0, 2);

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 118 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><BrandLockup compact /><Pill tone={cloudState === 'synced' ? 'positive' : 'neutral'}>{cloudState === 'synced' ? 'LIVE SYNC' : 'LOCAL LEDGER'}</Pill></View>
      <EditorialHeader eyebrow={data.name} title={`Good evening,\n${currentMember.name}.`} description="Money and chores, translated into one calm source of truth." />

      <Card accent={theme.accent} variant="elevated" style={{ padding: 20 }}>
        <Pill tone="positive">{currentBalance >= 0 ? 'YOU ARE OWED' : 'YOU OWE'}</Pill>
        <Text selectable style={{ color: theme.heading, fontFamily: typography.extraBold, fontSize: 52, lineHeight: 56, letterSpacing: -2.2, fontVariant: ['tabular-nums'] }}>{formatMoney(Math.abs(currentBalance))}</Text>
        <Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 12 }}>Your position across the household</Text>
        <PrimaryButton label="Log a new expense" icon="add" onPress={() => router.push('/add-expense' as never)} />
      </Card>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Untangle the IOUs" action="See math" onPress={() => router.push('/debt-detox' as never)} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/debt-detox' as never)}>
          <Card accent={theme.accent} variant="elevated"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1, gap: 5 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 20 }}>Debt Detox</Text><Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 11, lineHeight: 16 }}>Turn overlapping IOUs into the fewest direct payments.</Text></View><RouteMap /></View></Card>
        </Pressable>
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="What the flat needs" action="All chores" onPress={() => router.push('/chores' as never)} />
        <View style={{ gap: 10 }}>
          {pending.length ? pending.map((log) => { const template = data.choreTemplates.find((item) => item.id === log.choreTemplateId); const member = data.members.find((item) => item.id === log.assignedTo); return <Pressable key={log.id} onPress={() => router.push('/chores' as never)}><Card style={{ padding: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={member?.name ?? '?'} active={log === pending[0]} /><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{template?.name ?? 'Chore'}</Text><Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 11, marginTop: 4 }}>{member?.name ?? 'Unassigned'} · {formatDate(log.dueDate)}</Text></View><MaterialIcons name="north-east" size={19} color={theme.accent} /></View></Card></Pressable>; }) : <Card><Text selectable style={{ color: theme.muted }}>The queue is quiet.</Text></Card>}
        </View>
      </View>
    </AppScreen>
  );
}
