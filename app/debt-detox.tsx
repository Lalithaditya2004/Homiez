import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Card, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function DebtDetoxScreen() {
  const theme = useAppTheme();
  const { data, debtPreview, acceptDebtPlan } = useHousehold();
  const [showMath, setShowMath] = useState(false);

  function acceptPlan() {
    acceptDebtPlan();
    Alert.alert('Settlement plan saved', 'The original expenses remain in the audit trail. Homiez only records the plan—it never moves money.', [
      { text: 'Done', onPress: () => router.back() },
    ]);
  }

  return (
    <AppScreen>
      <View style={{ gap: 5 }}>
        <Pill tone="pending">ON-DEMAND SETTLEMENT</Pill>
        <Text selectable style={{ color: theme.heading, fontSize: 28, fontWeight: '800', letterSpacing: -0.7 }}>Debt Detox</Text>
        <Text selectable style={{ color: theme.body, fontSize: 15, lineHeight: 21 }}>
          We preserve every original expense, then remove unnecessary pass-the-parcel payments.
        </Text>
      </View>

      <Card accent={theme.pending}>
        <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: '800' }}>SIMPLIFIED PAYOUT PLAN</Text>
        {debtPreview.transactions.length ? debtPreview.transactions.map((transaction) => (
          <View key={`${transaction.fromId}-${transaction.toId}`} style={{ backgroundColor: theme.pendingTint, borderRadius: 14, padding: 14, gap: 5 }}>
            <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>
              {transaction.fromName} pays {transaction.toName}
            </Text>
            <Text selectable style={{ color: theme.pending, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {formatMoney(transaction.amountCents)}
            </Text>
          </View>
        )) : (
          <Text selectable style={{ color: theme.moneyPositive, fontSize: 18, fontWeight: '800' }}>Everyone is already square.</Text>
        )}
        <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
          {data.settlement ? 'A plan is already saved. Running it again replaces that plan with the current ledger.' : 'No money moves here—this is the instruction set for payments made outside Homiez.'}
        </Text>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Net positions" />
        {debtPreview.balances.filter((balance) => data.members.find((member) => member.id === balance.memberId)?.status === 'active').map((balance) => (
          <View key={balance.memberId} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 }}>
            <Text selectable style={{ color: theme.body, fontSize: 16, fontWeight: '700' }}>{balance.name}</Text>
            <Text selectable style={{ color: balance.cents >= 0 ? theme.moneyPositive : theme.moneyNegative, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
              {balance.cents > 0 ? 'is owed ' : balance.cents < 0 ? 'owes ' : ''}{formatMoney(Math.abs(balance.cents))}
            </Text>
          </View>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setShowMath((current) => !current)}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>Show the math</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 14 }}>Every net position and match, in order.</Text>
            </View>
            <Text selectable style={{ color: theme.chores, fontSize: 22 }}>{showMath ? '−' : '+'}</Text>
          </View>
          {showMath ? (
            <View style={{ gap: 12, paddingTop: 4 }}>
              {debtPreview.mathSteps.map((step, index) => (
                <View key={`${index}-${step}`} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.choresTint }}>
                    <Text selectable style={{ color: theme.chores, fontSize: 12, fontWeight: '800' }}>{index + 1}</Text>
                  </View>
                  <Text selectable style={{ color: theme.body, flex: 1, fontSize: 14, lineHeight: 20 }}>{step}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </Pressable>

      <PrimaryButton label={debtPreview.transactions.length ? 'Accept payout plan' : 'Back to ledger'} onPress={debtPreview.transactions.length ? acceptPlan : () => router.back()} />
    </AppScreen>
  );
}
