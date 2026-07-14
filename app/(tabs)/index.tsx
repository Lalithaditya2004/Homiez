import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { formatDate, formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function HomeScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, balances, recentChoreLogs } = useHousehold();
  const currentMember = data.members.find((member) => member.id === data.currentUserId)!;
  const currentBalance = balances.find((balance) => balance.memberId === data.currentUserId)?.cents ?? 0;
  const pendingChores = recentChoreLogs.filter((log) => log.status === 'pending').slice(0, 2);

  return (
    <AppScreen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.muted, fontSize: 14, fontWeight: '700' }}>
          {data.name.toUpperCase()}
        </Text>
        <Text selectable style={{ color: theme.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>
          Hey, {currentMember.name}.
        </Text>
        <Text selectable style={{ color: theme.body, fontSize: 16 }}>
          One shared view. Zero roommate math.
        </Text>
      </View>

      <Card accent={currentBalance >= 0 ? theme.moneyPositive : theme.moneyNegative}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: '700' }}>
              YOUR CURRENT POSITION
            </Text>
            <Text selectable style={{ color: currentBalance >= 0 ? theme.moneyPositive : theme.moneyNegative, fontSize: 30, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {formatMoney(Math.abs(currentBalance))}
            </Text>
            <Text selectable style={{ color: theme.body, fontSize: 15 }}>
              {currentBalance > 0 ? 'The flat owes you.' : currentBalance < 0 ? 'You owe the flat.' : 'You are all square.'}
            </Text>
          </View>
          <Pill tone={currentBalance >= 0 ? 'positive' : 'negative'}>{currentBalance >= 0 ? 'OWED' : 'OWE'}</Pill>
        </View>
        <PrimaryButton label="Add an expense" onPress={() => router.push('/add-expense' as never)} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Settle without the drama" />
        <Pressable accessibilityRole="button" onPress={() => router.push('/debt-detox' as never)}>
          <Card accent={theme.pending}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>
                  Debt Detox
                </Text>
                <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>
                  Collapse every overlapping IOU into the fewest direct payments—with the math visible.
                </Text>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.pendingTint, alignItems: 'center', justifyContent: 'center' }}>
                <Text selectable style={{ color: theme.pending, fontSize: 21, fontWeight: '800' }}>→</Text>
              </View>
            </View>
          </Card>
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Up next" action="View chores" onPress={() => router.push('/chores' as never)} />
        {pendingChores.length ? pendingChores.map((log) => {
          const template = data.choreTemplates.find((item) => item.id === log.choreTemplateId);
          const assignee = data.members.find((member) => member.id === log.assignedTo);
          return (
            <Pressable key={log.id} accessibilityRole="button" onPress={() => router.push('/chores' as never)}>
              <Card style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={assignee?.name ?? '?'} color={theme.choresTint} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800' }}>{template?.name ?? 'Chore'}</Text>
                    <Text selectable style={{ color: theme.muted, fontSize: 14 }}>{assignee?.name ?? 'Unassigned'} · due {formatDate(log.dueDate)}</Text>
                  </View>
                  <Pill tone="chores">DUE</Pill>
                </View>
              </Card>
            </Pressable>
          );
        }) : (
          <Card><Text selectable style={{ color: theme.muted }}>No chores are waiting right now.</Text></Card>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {activeMembers.map((member) => <Avatar key={member.id} name={member.name} />)}
        <Text selectable style={{ color: theme.muted, fontSize: 14 }}>{activeMembers.length} active roommates</Text>
      </View>
    </AppScreen>
  );
}
