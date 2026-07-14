import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, GhostButton, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { formatDate, formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function LedgerScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, balances, debtPreview } = useHousehold();
  const expenseRows = [...data.expenses].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

  return (
    <AppScreen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: theme.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>Ledger</Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Every purchase, plainly recorded.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/add-expense' as never)} style={({ pressed }) => ({ backgroundColor: theme.moneyNegative, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <Text selectable style={{ color: '#FFF', fontSize: 28, fontWeight: '500', marginTop: -2 }}>+</Text>
        </Pressable>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 3 }}>
            <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: '700' }}>HOUSEHOLD NETS</Text>
            <Text selectable style={{ color: theme.body, fontSize: 14 }}>Based on every recorded split</Text>
          </View>
          <Pill tone="pending">LIVE</Pill>
        </View>
        <View style={{ gap: 10 }}>
          {balances.filter((balance) => activeMembers.some((member) => member.id === balance.memberId)).map((balance) => (
            <View key={balance.memberId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={balance.name} />
              <Text selectable style={{ color: theme.body, fontSize: 15, fontWeight: '700', flex: 1 }}>{balance.name}</Text>
              <Text selectable style={{ color: balance.cents >= 0 ? theme.moneyPositive : theme.moneyNegative, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                {balance.cents >= 0 ? '+' : '−'}{formatMoney(Math.abs(balance.cents))}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card accent={theme.pending}>
        <View style={{ gap: 6 }}>
          <Text selectable style={{ color: theme.heading, fontSize: 18, fontWeight: '800' }}>Ready to simplify?</Text>
          <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>
            Your {data.expenses.length} raw expenses can settle in {debtPreview.transactions.length} direct {debtPreview.transactions.length === 1 ? 'payment' : 'payments'}.
          </Text>
        </View>
        <PrimaryButton label="Run Debt Detox" onPress={() => router.push('/debt-detox' as never)} />
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Recent expenses" />
        {expenseRows.map((expense) => {
          const payer = data.members.find((member) => member.id === expense.paidBy);
          return (
            <Card key={expense.id} style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800' }}>{expense.description}</Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 13 }}>Paid by {payer?.name ?? 'Unknown'} · {formatDate(expense.createdAt)}</Text>
                </View>
                <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{formatMoney(expense.amountCents)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pill tone={expense.splitMethod === 'equal' ? 'neutral' : 'pending'}>{expense.splitMethod === 'equal' ? `EQUAL · ${expense.splits.length}` : `CUSTOM · ${expense.splits.length}`}</Pill>
                <GhostButton label="View split" onPress={() => router.push('/debt-detox' as never)} />
              </View>
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}
