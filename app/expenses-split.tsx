import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, Pill, SectionTitle, Segmented } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { getExpenseAudits, type ExpenseAudit } from '@/lib/ledger';
import { formatDateTime, formatMoney } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

type ExpenseView = 'incomplete' | 'completed';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function ExpensesSplitScreen() {
  const theme = useAppTheme();
  const { data } = useHousehold();
  const [view, setView] = useState<ExpenseView>('incomplete');
  const [expandedId, setExpandedId] = useState<string>();
  const audits = useMemo(() => getExpenseAudits(data), [data]);
  const incomplete = audits.filter((audit) => !audit.completed);
  const completed = audits.filter((audit) => audit.completed && new Date(audit.completedAt ?? audit.expense.createdAt).getTime() >= Date.now() - THIRTY_DAYS_MS);
  const visible = view === 'incomplete' ? incomplete : completed;

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 44 }}>
      <EditorialHeader eyebrow="Granular audit" title="Expenses split" description="Open any bill to see exactly who is settled and whose share is still pending." />
      <Segmented
        value={view}
        onChange={(value) => setView(value as ExpenseView)}
        options={[
          { value: 'incomplete', label: `Incomplete · ${incomplete.length}` },
          { value: 'completed', label: `Settled · ${completed.length}` },
        ]}
      />
      <View style={{ gap: 10 }}>
        <SectionTitle title={view === 'incomplete' ? 'Incomplete settlements' : 'Completed / Settled'} action={view === 'completed' ? 'Last 30 days' : 'Active bills'} />
        {visible.length ? visible.map((audit) => (
          <ExpenseAuditCard
            key={audit.expense.id}
            audit={audit}
            expanded={expandedId === audit.expense.id}
            currency={audit.expense.currency}
            onPress={() => setExpandedId((current) => current === audit.expense.id ? undefined : audit.expense.id)}
          />
        )) : (
          <Card><Text selectable style={{ color: theme.muted, textAlign: 'center' }}>{view === 'incomplete' ? 'Every expense is fully settled.' : 'No settled expenses in the last 30 days.'}</Text></Card>
        )}
      </View>
    </AppScreen>
  );
}

function ExpenseAuditCard({ audit, expanded, currency, onPress }: { audit: ExpenseAudit; expanded: boolean; currency: ExpenseAudit['expense']['currency']; onPress: () => void }) {
  const theme = useAppTheme();
  const { data } = useHousehold();
  const payer = data.members.find((member) => member.id === audit.expense.paidBy);
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress}>
      <Card accent={audit.completed ? theme.accent : undefined} variant={expanded ? 'elevated' : 'default'} style={{ padding: 15 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Avatar name={payer?.name ?? '?'} active={audit.completed} />
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 15 }}>{audit.expense.description}</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 10, marginTop: 4 }}>Paid by {payer?.name ?? 'Roommate'} · {formatDateTime(audit.expense.createdAt)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.bold, fontSize: 16 }}>{formatMoney(audit.expense.amountCents, currency)}</Text>
            <MaterialIcons name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={20} color={theme.muted} />
          </View>
        </View>
        {expanded ? (
          <View style={{ gap: 9, paddingTop: 12, boxShadow: 'inset 0 1px rgba(255,255,255,.055)' }}>
            {audit.participants.map((participant) => (
              <View key={participant.memberId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 }}>
                <MaterialIcons name={participant.status === 'paid' ? 'check-circle' : 'cancel'} size={21} color={participant.status === 'paid' ? '#63D47C' : theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 13 }}>{participant.name}</Text>
                  <Text selectable style={{ color: participant.status === 'paid' ? '#63D47C' : theme.accent, fontSize: 10, marginTop: 2 }}>{participant.status === 'paid' ? 'Settled' : 'Payment pending'}</Text>
                </View>
                <Text selectable style={{ color: theme.muted, fontFamily: typography.bold, fontSize: 13 }}>{formatMoney(participant.amountCents, currency)}</Text>
              </View>
            ))}
            <Pill tone={audit.completed ? 'positive' : 'pending'}>{audit.completed ? 'FULLY SETTLED' : 'WAITING ON ROOMMATES'}</Pill>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
