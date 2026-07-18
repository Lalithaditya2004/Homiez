import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { BrandLockup } from '@/components/brand-mark';
import { Card, EditorialHeader, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { sendPasswordResetEmail } from '@/lib/auth-repository';
import { deleteCloudAccount } from '@/lib/household-repository';
import { getMemberBalanceSummary } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/providers/household-provider';

export default function AccountScreen() {
  const theme = useAppTheme();
  const { cloudState, data, settleAllReceivables } = useHousehold();
  const hasHousehold = cloudState === 'synced';
  const current = hasHousehold ? data.members.find((member) => member.id === data.currentUserId) : undefined;
  const balance = hasHousehold ? getMemberBalanceSummary(data.peerBalances, data.currentUserId) : { owingCents: 0, owedCents: 0 };
  const currency = data.currency ?? 'INR';
  const pendingCount = hasHousehold ? data.settlementRequests.filter((request) => request.status === 'in-review' && (request.fromId === data.currentUserId || request.toId === data.currentUserId)).length : 0;
  const [action, setAction] = useState<'signout' | 'reset' | 'settle' | 'delete'>();
  const [identity, setIdentity] = useState<{ email?: string; name?: string }>({});

  useEffect(() => {
    void supabase?.auth.getUser().then(({ data: authData }) => {
      const email = authData.user?.email;
      const metadataName = authData.user?.user_metadata?.display_name ?? authData.user?.user_metadata?.full_name;
      setIdentity({ email, name: typeof metadataName === 'string' ? metadataName : email?.split('@')[0] });
    });
  }, []);

  async function sendReset() {
    const email = current?.email ?? identity.email;
    if (!email) return;
    setAction('reset');
    try {
      await sendPasswordResetEmail(email);
      Alert.alert('Reset email sent', 'Open the link on this device to choose a new password.');
    } catch (error) {
      Alert.alert('Could not send reset email', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAction(undefined);
    }
  }

  async function settleAll() {
    setAction('settle');
    try {
      await settleAllReceivables();
    } catch (error) {
      Alert.alert('Could not settle balances', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAction(undefined);
    }
  }

  async function deleteAccount() {
    setAction('delete');
    try {
      await deleteCloudAccount();
      await supabase?.auth.signOut({ scope: 'local' });
      router.replace('/auth' as never);
    } catch (error) {
      Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setAction(undefined);
    }
  }

  const deleteBlock = balance.owingCents > 0
    ? `You cannot delete your account while you owe ${formatMoney(balance.owingCents, currency)}.`
    : balance.owedCents > 0
      ? `${formatMoney(balance.owedCents, currency)} is owed to you. Mark it settled or forgiven first.`
      : pendingCount > 0
        ? 'Resolve your pending settlement requests before deleting your account.'
        : undefined;

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 42 }}>
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader eyebrow="Your private key" title="Account & connection" description="Manage recovery, this device session, and permanent account deletion." />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <BrandLockup compact />
        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 18 }}>{current?.name ?? identity.name ?? 'Roommate'}</Text>
        <Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 13 }}>{current?.email ?? identity.email ?? 'Signed in'}</Text>
        <Pill tone="positive">SUPABASE CONNECTED</Pill>
      </Card>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Security" />
        <Card>
          <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 16 }}>Password & session</Text>
          <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Send a secure password-reset link or disconnect this device without changing household data.</Text>
          <PrimaryButton label={action === 'reset' ? 'Sending…' : 'Reset password'} icon="lock-reset" tone="dark" disabled={Boolean(action)} onPress={() => void sendReset()} />
          <PrimaryButton
            label={action === 'signout' ? 'Signing out…' : 'Sign out'}
            icon="logout"
            disabled={Boolean(action)}
            onPress={() => {
              setAction('signout');
              void supabase?.auth.signOut().finally(() => setAction(undefined));
            }}
          />
        </Card>
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Delete account" />
        <Card accent={theme.accent}>
          <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 16 }}>Permanent deletion</Text>
          <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
            {deleteBlock ?? 'Your balance is square. Deletion signs you out, leaves shared households, anonymizes retained ledger history, and deletes any household where you are the sole active member.'}
          </Text>
          {balance.owedCents > 0 ? (
            <PrimaryButton
              label={action === 'settle' ? 'Settling…' : 'Settle all owed to me'}
              icon="done-all"
              tone="dark"
              disabled={Boolean(action)}
              onPress={() => Alert.alert(
                'Settle everything owed to you?',
                'This clears every receivable immediately without asking the debtors. Continue only after payment or if you choose to forgive the balances.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Settle all', style: 'destructive', onPress: () => void settleAll() },
                ],
              )}
            />
          ) : null}
          <PrimaryButton
            label={action === 'delete' ? 'Deleting…' : 'Delete my account'}
            icon="delete-forever"
            disabled={Boolean(action) || Boolean(deleteBlock)}
            onPress={() => Alert.alert(
              'Permanently delete your account?',
              'This cannot be undone. Your identity will be removed, shared history will be anonymized, and sole-member households will be deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete account', style: 'destructive', onPress: () => void deleteAccount() },
              ],
            )}
          />
        </Card>
      </View>
    </AppScreen>
  );
}
