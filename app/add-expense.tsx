import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { formatMoney, moneyToCents } from '@/lib/money';
import type { ExpenseSplit } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

type AllocationUnit = 'amount' | 'percent';

function createEqualSplits(amountCents: number, memberIds: string[]): ExpenseSplit[] {
  if (!memberIds.length) return [];
  const base = Math.floor(amountCents / memberIds.length);
  const remainder = amountCents - base * memberIds.length;
  return memberIds.map((memberId, index) => ({ memberId, owedCents: base + (index < remainder ? 1 : 0) }));
}

export default function AddExpenseScreen() {
  const theme = useAppTheme();
  const { activeMembers, data, addExpense } = useHousehold();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(data.currentUserId);
  const [method, setMethod] = useState<'equal' | 'custom'>('equal');
  const [selectedMemberIds, setSelectedMemberIds] = useState(activeMembers.map((member) => member.id));
  const [allocationUnit, setAllocationUnit] = useState<AllocationUnit>('amount');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const amountCents = moneyToCents(amount);
  const splits = useMemo(() => {
    if (method === 'equal') return createEqualSplits(amountCents, selectedMemberIds);
    if (allocationUnit === 'percent') {
      return selectedMemberIds.map((memberId, index) => {
        const rawPercent = Number(customValues[memberId] ?? 0);
        const isLast = index === selectedMemberIds.length - 1;
        const allocatedBefore = selectedMemberIds.slice(0, index).reduce((sum, id) => sum + Math.round(amountCents * (Number(customValues[id] ?? 0) / 100)), 0);
        return { memberId, owedCents: isLast ? amountCents - allocatedBefore : Math.round(amountCents * (rawPercent / 100)) };
      });
    }
    return selectedMemberIds.map((memberId) => ({ memberId, owedCents: moneyToCents(customValues[memberId] ?? '') }));
  }, [allocationUnit, amountCents, customValues, method, selectedMemberIds]);
  const allocatedCents = splits.reduce((sum, split) => sum + split.owedCents, 0);
  const totalPercent = selectedMemberIds.reduce((sum, memberId) => sum + Number(customValues[memberId] ?? 0), 0);

  function toggleMember(memberId: string) {
    setSelectedMemberIds((current) => {
      if (current.includes(memberId)) return current.length === 1 ? current : current.filter((id) => id !== memberId);
      return [...current, memberId];
    });
  }

  function saveExpense() {
    if (!description.trim() || amountCents <= 0) {
      Alert.alert('Add a description and a valid amount.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      Alert.alert('Select at least one roommate to split this expense.');
      return;
    }
    if (method === 'custom' && allocationUnit === 'percent' && Math.abs(totalPercent - 100) > 0.001) {
      Alert.alert('Custom percentages need to add up to 100%.');
      return;
    }
    if (allocatedCents !== amountCents) {
      Alert.alert('Custom amounts need to add up exactly to the expense total.');
      return;
    }

    addExpense({ description, amountCents, paidBy, splitMethod: method, splits });
    router.back();
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Log the facts</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>The split is visible to everyone in the household.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>WHAT WAS IT?</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Sunday groceries"
          placeholderTextColor={theme.muted}
          returnKeyType="next"
          style={{ backgroundColor: theme.card, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, minHeight: 50, fontSize: 16 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>TOTAL AMOUNT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14 }}>
          <Text selectable style={{ color: theme.muted, fontSize: 21, fontWeight: '700' }}>$</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.muted}
            keyboardType="decimal-pad"
            style={{ color: theme.heading, flex: 1, minHeight: 58, paddingHorizontal: 8, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}
          />
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Who paid?" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {activeMembers.map((member) => {
            const selected = member.id === paidBy;
            return (
              <Pressable key={member.id} accessibilityRole="button" onPress={() => setPaidBy(member.id)} style={({ pressed }) => ({ flexDirection: 'row', gap: 7, alignItems: 'center', borderWidth: 1, borderColor: selected ? theme.moneyNegative : theme.border, backgroundColor: selected ? theme.moneyNegativeTint : theme.card, padding: 8, borderRadius: 20, opacity: pressed ? 0.75 : 1 })}>
                <Avatar name={member.name} color={selected ? theme.moneyNegativeTint : theme.choresTint} />
                <Text selectable style={{ color: selected ? theme.moneyNegative : theme.body, fontSize: 14, fontWeight: '800', paddingRight: 4 }}>{member.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="How should it split?" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['equal', 'custom'] as const).map((option) => {
            const selected = option === method;
            return (
              <Pressable key={option} accessibilityRole="button" onPress={() => setMethod(option)} style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: selected ? theme.moneyNegative : theme.border, backgroundColor: selected ? theme.moneyNegativeTint : theme.card, opacity: pressed ? 0.75 : 1 })}>
                <Text selectable style={{ color: selected ? theme.moneyNegative : theme.body, fontWeight: '800', textTransform: 'capitalize' }}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
          {method === 'equal' ? 'The amount is divided evenly, down to the cent.' : 'Choose exact amounts or percentages for the selected roommates.'}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Split with" />
        {activeMembers.map((member) => {
          const selected = selectedMemberIds.includes(member.id);
          const customValue = customValues[member.id] ?? '';
          return (
            <Card key={member.id} style={{ padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleMember(member.id)} style={({ pressed }) => ({ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: selected ? theme.moneyNegative : theme.muted, backgroundColor: selected ? theme.moneyNegative : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                  <Text selectable style={{ color: '#FFFFFF', fontWeight: '900' }}>{selected ? '✓' : ''}</Text>
                </Pressable>
                <Avatar name={member.name} />
                <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800', flex: 1 }}>{member.name}</Text>
                {method === 'equal' && selected ? <Pill tone="neutral">{formatMoney(splits.find((split) => split.memberId === member.id)?.owedCents ?? 0)}</Pill> : null}
                {method === 'custom' && selected ? (
                  <TextInput
                    value={customValue}
                    onChangeText={(value) => setCustomValues((current) => ({ ...current, [member.id]: value }))}
                    placeholder={allocationUnit === 'percent' ? '0' : '0.00'}
                    placeholderTextColor={theme.muted}
                    keyboardType="decimal-pad"
                    style={{ backgroundColor: theme.background, color: theme.heading, width: 76, borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 8, minHeight: 38, textAlign: 'right', fontWeight: '800', fontVariant: ['tabular-nums'] }}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>

      {method === 'custom' ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['amount', 'percent'] as const).map((unit) => (
              <Pressable key={unit} accessibilityRole="button" onPress={() => setAllocationUnit(unit)} style={({ pressed }) => ({ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: allocationUnit === unit ? theme.pendingTint : theme.card, borderWidth: 1, borderColor: allocationUnit === unit ? theme.pending : theme.border, opacity: pressed ? 0.75 : 1 })}>
                <Text selectable style={{ color: allocationUnit === unit ? theme.pending : theme.muted, fontWeight: '800', fontSize: 13 }}>{unit === 'amount' ? 'Dollar amounts' : 'Percentages'}</Text>
              </Pressable>
            ))}
          </View>
          <Text selectable style={{ color: allocatedCents === amountCents && (allocationUnit === 'amount' || Math.abs(totalPercent - 100) < 0.001) ? theme.moneyPositive : theme.moneyNegative, fontSize: 14, fontWeight: '800' }}>
            {allocationUnit === 'percent' ? `${totalPercent.toFixed(1)}% of 100% assigned` : `${formatMoney(allocatedCents)} of ${formatMoney(amountCents)} assigned`}
          </Text>
        </View>
      ) : null}

      <PrimaryButton label="Save expense" onPress={saveExpense} />
    </AppScreen>
  );
}
