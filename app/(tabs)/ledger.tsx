import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, FloatingAction, Pill, PrimaryButton, SectionTitle, Segmented, SelectField } from '@/components/homiez-ui';
import { ScreenIllustration, screenIllustrations } from '@/components/screen-illustration';
import { typography } from '@/constants/design';
import { debtBetween, getGlobalNets, getPeerBreakdown, getPeerBreakdownForMember, type PeerBreakdown } from '@/lib/ledger';
import { formatDateTime, formatMoney, moneyToCents } from '@/lib/money';
import type { SettlementRequest } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

type BreakdownTab = 'owing' | 'owed';
type SettlementTab = 'to-settle' | 'mark-paid' | 'in-review' | 'accept';
type AmountModalState =
  | { kind: 'settle'; peer: PeerBreakdown }
  | { kind: 'mark-paid'; peer: PeerBreakdown }
  | { kind: 'modify'; request: SettlementRequest }
  | null;

export default function LedgerScreen() {
  const theme = useAppTheme();
  const { data, requestSettlement, resolveSettlement, settleAllReceivables, settleReceivable } = useHousehold();
  const currency = data.currency ?? 'INR';
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('owing');
  const [perspectiveTab, setPerspectiveTab] = useState<BreakdownTab>('owing');
  const [settlementTab, setSettlementTab] = useState<SettlementTab>('to-settle');
  const peers = useMemo(() => getPeerBreakdown(data), [data]);
  const actionablePeers = useMemo(() => getPeerBreakdown(data, 'actionable'), [data]);
  const totals = useMemo(() => getGlobalNets(data), [data]);
  const roommateOptions = data.members
    .filter((member) => member.status === 'active' && member.id !== data.currentUserId)
    .map((member) => ({ value: member.id, label: member.name }));
  const [selectedPeerId, setSelectedPeerId] = useState(roommateOptions[0]?.value ?? '');
  const selectedRoommate = data.members.find((member) => member.id === selectedPeerId);
  const selectedPerspective = useMemo(
    () => selectedPeerId ? getPeerBreakdownForMember(data, selectedPeerId).filter((peer) => peer.direction === perspectiveTab) : [],
    [data, perspectiveTab, selectedPeerId],
  );
  const breakdown = peers.filter((peer) => peer.direction === breakdownTab);
  const toSettle = actionablePeers.filter((peer) => peer.direction === 'owing' && peer.amountCents > 0);
  const inReview = data.settlementRequests.filter((request) => request.status === 'in-review' && request.fromId === data.currentUserId);
  const acceptSettles = data.settlementRequests.filter((request) => request.status === 'in-review' && request.toId === data.currentUserId);
  const receivables = data.members
    .filter((member) => member.status === 'active' && member.id !== data.currentUserId)
    .map((member) => ({ peerId: member.id, peerName: member.name, direction: 'owed' as const, amountCents: debtBetween(data.peerBalances, member.id, data.currentUserId) }))
    .filter((peer) => peer.amountCents > 0);
  const [amountModal, setAmountModal] = useState<AmountModalState>(null);
  const [amount, setAmount] = useState('');
  const [settlementAction, setSettlementAction] = useState(false);

  function openSettle(peer: PeerBreakdown) {
    setAmount((peer.amountCents / 100).toFixed(2));
    setAmountModal({ kind: 'settle', peer });
  }

  function openModify(request: SettlementRequest) {
    setAmount((request.claimedAmountCents / 100).toFixed(2));
    setAmountModal({ kind: 'modify', request });
  }

  function openMarkPaid(peer: PeerBreakdown) {
    setAmount((peer.amountCents / 100).toFixed(2));
    setAmountModal({ kind: 'mark-paid', peer });
  }

  async function submitAmount() {
    const cents = moneyToCents(amount);
    if (!amountModal || cents <= 0) return Alert.alert('Enter a valid settlement amount.');
    if (amountModal.kind === 'settle') {
      if (!requestSettlement(amountModal.peer.peerId, cents)) return Alert.alert('That amount is higher than the balance available to settle.');
      Alert.alert('Settlement sent for review', `${amountModal.peer.peerName} has been notified. Your balances stay protected until the request is reviewed.`);
    } else if (amountModal.kind === 'mark-paid') {
      if (cents > amountModal.peer.amountCents) return Alert.alert('The amount cannot exceed what this roommate owes you.');
      setSettlementAction(true);
      try {
        await settleReceivable(amountModal.peer.peerId, cents);
        Alert.alert('Balance settled', `${formatMoney(cents, currency)} owed by ${amountModal.peer.peerName} is now marked settled.`);
      } catch (error) {
        return Alert.alert('Could not settle balance', error instanceof Error ? error.message : 'Please try again.');
      } finally {
        setSettlementAction(false);
      }
    } else {
      if (cents > amountModal.request.claimedAmountCents) return Alert.alert('The corrected amount cannot exceed the original claim.');
      resolveSettlement(amountModal.request.id, 'accept', cents);
    }
    setAmountModal(null);
  }

  return (
    <>
      <AppScreen contentContainerStyle={{ paddingBottom: 42 }}>
        <ScreenIllustration source={screenIllustrations.ledger} artworkOnly />

        <Card accent={theme.accent} variant="elevated" style={{ padding: 20 }}>
          <EditorialHeader
            eyebrow="The money layer"
            title="Ledger"
            description="A clear view of what you owe, what you are owed, and what is waiting for confirmation."
            trailing={<FloatingAction label="Add expense" onPress={() => router.push('/add-expense' as never)} />}
          />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <NetMetric label="YOU OWE" value={totals.totalIOweCents} currency={currency} />
            <NetMetric label="YOU ARE OWED" value={totals.totalIAmOwedCents} currency={currency} accent />
          </View>
        </Card>

        <Card>
          <SectionTitle title="Individual breakdown" action="Aggregated by roommate" />
          <Segmented
            value={breakdownTab}
            onChange={(value) => setBreakdownTab(value as BreakdownTab)}
            options={[{ value: 'owing', label: 'Owing' }, { value: 'owed', label: 'Owed' }]}
          />
          <View style={{ gap: 9 }}>
            {breakdown.length ? breakdown.map((peer) => (
              <PeerRow key={peer.peerId} peer={peer} currency={currency} />
            )) : <EmptyState text={breakdownTab === 'owing' ? 'You do not owe any roommate.' : 'No roommate owes you right now.'} />}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Roommate perspective" action={selectedRoommate?.name ?? 'Select roommate'} />
          {roommateOptions.length ? (
            <>
              <SelectField accessibilityLabel="Select roommate" options={roommateOptions} value={selectedPeerId} onChange={setSelectedPeerId} />
              <Segmented
                value={perspectiveTab}
                onChange={(value) => setPerspectiveTab(value as BreakdownTab)}
                options={[{ value: 'owing', label: 'Owes' }, { value: 'owed', label: 'Owed' }]}
              />
              <View style={{ gap: 9, padding: 14, borderRadius: 19, backgroundColor: theme.background, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' }}>
                {selectedPerspective.length ? selectedPerspective.map((peer) => (
                  <PeerRow key={peer.peerId} peer={peer} currency={currency} perspectiveName={selectedRoommate?.name} />
                )) : <EmptyState text={perspectiveTab === 'owing' ? `${selectedRoommate?.name ?? 'This roommate'} owes no one.` : `No one owes ${selectedRoommate?.name ?? 'this roommate'}.`} />}
              </View>
            </>
          ) : <EmptyState text="Add another roommate to view their ledger perspective." />}
        </Card>

        <Card accent={theme.accent} variant="elevated">
          <SectionTitle title="The Settlement Hub" action="Debtors request · creditors settle directly" />
          <Segmented
            value={settlementTab}
            onChange={(value) => setSettlementTab(value as SettlementTab)}
            options={[
              { value: 'to-settle', label: `To Settle · ${toSettle.length}` },
              { value: 'mark-paid', label: `Mark Paid · ${receivables.length}` },
              { value: 'in-review', label: `In Review · ${inReview.length}` },
              { value: 'accept', label: `Accept · ${acceptSettles.length}` },
            ]}
          />
          {settlementTab === 'to-settle' ? (
            <View style={{ gap: 10 }}>
              {toSettle.length ? toSettle.map((peer) => (
                <Card key={peer.peerId} variant="inset" style={{ padding: 14 }}>
                  <PeerRow peer={peer} currency={currency} />
                  <PrimaryButton label="Settle" icon="payments" onPress={() => openSettle(peer)} />
                </Card>
              )) : <EmptyState text="Nothing needs payment from you." />}
            </View>
          ) : null}
          {settlementTab === 'mark-paid' ? (
            <View style={{ gap: 10 }}>
              {receivables.length ? (
                <PrimaryButton
                  label={settlementAction ? 'Settling…' : 'Settle all owed to me'}
                  icon="done-all"
                  tone="dark"
                  disabled={settlementAction}
                  onPress={() => Alert.alert(
                    'Settle every receivable?',
                    'This immediately marks every active roommate who owes you as settled. No approval request is sent, so use this only after payment or when you choose to forgive the balances.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Settle all',
                        style: 'destructive',
                        onPress: () => {
                          setSettlementAction(true);
                          void settleAllReceivables()
                            .catch((error: unknown) => Alert.alert('Could not settle balances', error instanceof Error ? error.message : 'Please try again.'))
                            .finally(() => setSettlementAction(false));
                        },
                      },
                    ],
                  )}
                />
              ) : null}
              {receivables.length ? receivables.map((peer) => (
                <Card key={peer.peerId} variant="inset" style={{ padding: 14 }}>
                  <PeerRow peer={peer} currency={currency} />
                  <PrimaryButton label="Mark received / forgiven" icon="check-circle" onPress={() => openMarkPaid(peer)} />
                </Card>
              )) : <EmptyState text="No roommate currently owes you." />}
            </View>
          ) : null}
          {settlementTab === 'in-review' ? (
            <RequestList requests={inReview} data={data} currency={currency} direction="outbound" />
          ) : null}
          {settlementTab === 'accept' ? (
            <View style={{ gap: 10 }}>
              {acceptSettles.length ? acceptSettles.map((request) => {
                const sender = data.members.find((member) => member.id === request.fromId);
                return (
                  <Card key={request.id} variant="inset" style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                      <Avatar name={sender?.name ?? '?'} />
                      <View style={{ flex: 1 }}>
                        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{sender?.name ?? 'Roommate'} says they paid</Text>
                        <Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{formatDateTime(request.createdAt)}</Text>
                      </View>
                      <Text selectable style={{ color: theme.accent, fontFamily: typography.bold, fontSize: 17 }}>{formatMoney(request.claimedAmountCents, currency)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <SettlementAction label="Accept" icon="check" onPress={() => resolveSettlement(request.id, 'accept')} />
                      <SettlementAction label="Modify" icon="edit" onPress={() => openModify(request)} />
                      <SettlementAction label="Reject" icon="close" destructive onPress={() => Alert.alert('Reject this settlement?', 'The full amount will return to the sender’s To Settle balance.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reject', style: 'destructive', onPress: () => resolveSettlement(request.id, 'reject') }])} />
                    </View>
                  </Card>
                );
              }) : <EmptyState text="No incoming settlements need your review." />}
            </View>
          ) : null}
        </Card>

        <PrimaryButton label="View Expenses Split" icon="receipt-long" tone="dark" onPress={() => router.push('/expenses-split' as never)} />
      </AppScreen>

      <Modal transparent visible={Boolean(amountModal)} animationType="fade" onRequestClose={() => setAmountModal(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(0,0,0,.66)' }}>
          <Card accent={theme.accent} variant="elevated" style={{ padding: 20 }}>
            <Pill tone="pending">{amountModal?.kind === 'modify' ? 'CORRECT CLAIM' : amountModal?.kind === 'mark-paid' ? 'CREDITOR SETTLEMENT' : 'SEND FOR REVIEW'}</Pill>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 22 }}>
              {amountModal?.kind === 'modify' ? 'How much arrived?' : amountModal?.kind === 'mark-paid' ? `Settle ${amountModal.peer.peerName}` : `Settle with ${amountModal?.kind === 'settle' ? amountModal.peer.peerName : ''}`}
            </Text>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
              {amountModal?.kind === 'modify'
                ? 'The accepted amount settles now. Any unpaid difference returns to To Settle.'
                : amountModal?.kind === 'mark-paid'
                  ? 'This updates the ledger immediately without asking the debtor. Use it after receiving payment or to forgive the amount.'
                  : 'Enter the full amount or make a partial payment.'}
            </Text>
            <TextInput
              accessibilityLabel="Settlement amount"
              autoFocus
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.faint}
              style={{ minHeight: 66, borderRadius: 19, backgroundColor: theme.background, color: theme.heading, paddingHorizontal: 16, fontFamily: typography.extraBold, fontSize: 30, fontVariant: ['tabular-nums'], boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.28)' }}
            />
            <PrimaryButton label={settlementAction ? 'Working…' : amountModal?.kind === 'modify' ? 'Proceed with amount' : amountModal?.kind === 'mark-paid' ? 'Mark settled' : 'Submit settlement'} icon="arrow-forward" disabled={settlementAction} onPress={() => void submitAmount()} />
            <Pressable accessibilityRole="button" onPress={() => setAmountModal(null)} style={{ alignItems: 'center', paddingVertical: 10 }}><Text style={{ color: theme.muted, fontFamily: typography.semibold }}>Cancel</Text></Pressable>
          </Card>
        </View>
      </Modal>
    </>
  );
}

function NetMetric({ label, value, currency, accent = false }: { label: string; value: number; currency: NonNullable<ReturnType<typeof useHousehold>['data']['currency']>; accent?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 8, padding: 14, borderRadius: 19, backgroundColor: theme.background, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' }}>
      <Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9, lineHeight: 13 }}>{label}</Text>
      <Text selectable adjustsFontSizeToFit numberOfLines={1} style={{ color: accent ? theme.accent : theme.heading, fontFamily: typography.extraBold, fontSize: 24, fontVariant: ['tabular-nums'] }}>{formatMoney(value, currency)}</Text>
    </View>
  );
}

function PeerRow({ peer, currency, perspectiveName }: { peer: PeerBreakdown; currency: NonNullable<ReturnType<typeof useHousehold>['data']['currency']>; perspectiveName?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 50 }}>
      <Avatar name={peer.peerName} size={38} active={peer.direction === 'owed'} />
      <View style={{ flex: 1 }}>
        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{peer.peerName}</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 10, marginTop: 3 }}>{peer.direction === 'owing' ? `${perspectiveName ?? 'You'} owe${perspectiveName ? 's' : ''}` : peer.direction === 'owed' ? `Owes ${perspectiveName ?? 'you'}` : 'Square'}</Text>
      </View>
      <Text selectable style={{ color: peer.direction === 'owed' ? theme.accent : theme.heading, fontFamily: typography.bold, fontSize: 16, fontVariant: ['tabular-nums'] }}>{formatMoney(peer.amountCents, currency)}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  const theme = useAppTheme();
  return <View style={{ minHeight: 70, alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 17, backgroundColor: theme.background }}><Text selectable style={{ color: theme.muted, textAlign: 'center', fontSize: 12 }}>{text}</Text></View>;
}

function RequestList({ requests, data, currency, direction }: { requests: SettlementRequest[]; data: ReturnType<typeof useHousehold>['data']; currency: NonNullable<ReturnType<typeof useHousehold>['data']['currency']>; direction: 'outbound' }) {
  const theme = useAppTheme();
  if (!requests.length) return <EmptyState text="No settlements are waiting for confirmation." />;
  return (
    <View style={{ gap: 10 }}>
      {requests.map((request) => {
        const peerId = direction === 'outbound' ? request.toId : request.fromId;
        const peer = data.members.find((member) => member.id === peerId);
        return (
          <Card key={request.id} variant="inset" style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <Avatar name={peer?.name ?? '?'} />
              <View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>Waiting for {peer?.name ?? 'roommate'}</Text><Text selectable style={{ color: theme.muted, fontSize: 10, marginTop: 3 }}>{formatDateTime(request.createdAt)}</Text></View>
              <Text selectable style={{ color: theme.accent, fontFamily: typography.bold, fontSize: 16 }}>{formatMoney(request.claimedAmountCents, currency)}</Text>
            </View>
            <Pill tone="pending">IN REVIEW</Pill>
          </Card>
        );
      })}
    </View>
  );
}

function SettlementAction({ label, icon, onPress, destructive = false }: { label: string; icon: React.ComponentProps<typeof MaterialIcons>['name']; onPress: () => void; destructive?: boolean }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 14, backgroundColor: destructive ? 'rgba(255,64,0,.08)' : theme.soft, opacity: pressed ? .65 : 1 })}>
      <MaterialIcons name={icon} size={16} color={destructive ? theme.accent : theme.heading} />
      <Text style={{ color: destructive ? theme.accent : theme.heading, fontFamily: typography.bold, fontSize: 10 }}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}
