import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, FloatingAction, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatDate, formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function LedgerScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, balances, debtPreview } = useHousehold();
  const expenses = [...data.expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = expenses.reduce((sum, item) => sum + item.amountCents, 0);
  const max = Math.max(...balances.map((item) => Math.abs(item.cents)), 1);
  const latest = expenses[0];

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 118 }}>
      <EditorialHeader eyebrow="The money layer" title="Ledger" description="An audit trail with no emotional subtext—just who paid, who shared, and what remains." trailing={<FloatingAction label="Add expense" onPress={() => router.push('/add-expense' as never)} />} />
      <Card accent={theme.accent} variant="elevated" style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text selectable style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>ALL RECORDED SPEND</Text><Pill tone="subtle">{new Date().toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Pill></View>
        <Text selectable style={{ color: theme.heading, fontFamily: typography.extraBold, fontSize: 52, letterSpacing: -2.2, fontVariant: ['tabular-nums'] }}>{formatMoney(total)}</Text>
        <Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 12 }}>The complete household total recorded to date.</Text>
        <View style={{ flexDirection: 'row', paddingTop: 16, marginTop: 3, boxShadow: 'inset 0 1px rgba(255,255,255,.055)' }}><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 16 }}>{expenses.length} entries</Text><Text selectable style={{ color: theme.muted, fontSize: 10, marginTop: 4 }}>immutable records</Text></View><View style={{ flex: 1, paddingLeft: 16, boxShadow: 'inset 1px 0 rgba(255,255,255,.055)' }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 16 }}>{latest ? formatDate(latest.createdAt) : '—'}</Text><Text selectable style={{ color: theme.muted, fontSize: 10, marginTop: 4 }}>latest activity</Text></View></View>
      </Card>

      <View style={{ gap: 12 }}><SectionTitle title="Who is carrying what" action="Live" /><Card style={{ gap: 15 }}>{balances.filter((balance) => activeMembers.some((member) => member.id === balance.memberId)).map((balance) => <View key={balance.memberId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={balance.name} active={balance.memberId === data.currentUserId} /><View style={{ flex: 1, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{balance.name}</Text><Text selectable style={{ color: balance.cents >= 0 ? theme.accent : theme.heading, fontFamily: typography.bold, fontSize: 17, fontVariant: ['tabular-nums'] }}>{balance.cents >= 0 ? '+' : '−'}{formatMoney(Math.abs(balance.cents))}</Text></View><View style={{ height: 10, borderRadius: 5, backgroundColor: theme.background, overflow: 'hidden', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,.4)' }}><View style={{ width: `${Math.max(8, Math.round(Math.abs(balance.cents) / max * 100))}%`, height: '100%', borderRadius: 5, backgroundColor: theme.accent, opacity: balance.cents >= 0 ? 1 : .42 }} /></View></View></View>)}</Card></View>

      <Card accent={theme.accent} variant="elevated"><Pill tone="pending">DEBT DETOX READY</Pill><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 19 }}>Fewer transfers. Same truth.</Text><Text selectable style={{ color: theme.muted, fontSize: 11 }}>{expenses.length} entries collapse into {debtPreview.transactions.length} payment paths.</Text><PrimaryButton label="Open payout plan" onPress={() => router.push('/debt-detox' as never)} /></Card>

      <View style={{ gap: 12 }}><SectionTitle title="Expense trail" action="Newest first" /><View style={{ gap: 10 }}>{expenses.map((expense) => { const payer = data.members.find((item) => item.id === expense.paidBy); return <Card key={expense.id} style={{ padding: 14 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{expense.description}</Text><Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>Paid by {payer?.name ?? 'Unknown'} · {formatDate(expense.createdAt)}</Text></View><Text selectable style={{ color: theme.heading, fontFamily: typography.bold, fontSize: 17 }}>{formatMoney(expense.amountCents)}</Text></View><Pill tone="subtle">{expense.splitMethod.toUpperCase()} · {expense.splits.length}</Pill></Card>; })}</View></View>
    </AppScreen>
  );
}
