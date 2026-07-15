import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, GhostButton, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { useHousehold } from '@/providers/household-provider';

export default function HouseholdScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, archivedMembers, cloudError, cloudState, moveOutMember, refreshCloud } = useHousehold();
  const currentMember = data.members.find((member) => member.id === data.currentUserId)!;

  if (cloudState !== 'demo' && cloudState !== 'synced') {
    const needsSignIn = cloudState === 'signed-out';
    const needsSetup = cloudState === 'needs-household';
    const isLoading = cloudState === 'loading';
    return (
      <AppScreen>
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: theme.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>Household</Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Secure, shared data begins here.</Text>
        </View>
        <Card accent={cloudState === 'error' ? theme.moneyNegative : theme.pending}>
          <Text selectable style={{ color: theme.heading, fontSize: 19, fontWeight: '800' }}>
            {isLoading ? 'Loading your household…' : needsSignIn ? 'Sign in to sync your flat' : needsSetup ? 'Create or join a household' : 'Could not reach your household'}
          </Text>
          <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>
            {isLoading ? 'Checking your Supabase session and household access.' : needsSignIn ? 'Your demo workspace remains available locally until you connect an email account.' : needsSetup ? 'You are signed in. Create a new flat or enter the code another roommate shared.' : cloudError ?? 'Try again to restore the secure cloud connection.'}
          </Text>
          {needsSignIn ? <PrimaryButton label="Open account" onPress={() => router.push('/auth' as never)} /> : null}
          {needsSetup ? <PrimaryButton label="Set up household" onPress={() => router.push('/household-setup' as never)} /> : null}
          {cloudState === 'error' ? <PrimaryButton label="Try again" onPress={() => void refreshCloud()} /> : null}
        </Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>Household</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Everyone has the same keys.</Text>
      </View>

      <Card>
        <Text selectable style={{ color: theme.muted, fontSize: 13, fontWeight: '700' }}>INVITE LINK</Text>
        <Text selectable style={{ color: theme.heading, fontSize: 20, fontWeight: '800' }}>{data.name}</Text>
        <View style={{ backgroundColor: theme.background, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 12 }}>
          <Text selectable style={{ color: theme.body, fontSize: 14 }}>homiez://join/{data.joinCode}</Text>
        </View>
        <Pill tone="pending">CODE · {data.joinCode}</Pill>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title={`Roommates · ${activeMembers.length}`} action="Archived" onPress={() => router.push('/archived-roommates' as never)} />
        {activeMembers.map((member) => {
          const isCurrentUser = member.id === data.currentUserId;
          return (
            <Card key={member.id} style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={member.name} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800' }}>{member.name}{isCurrentUser ? ' · you' : ''}</Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 13 }}>{member.email}</Text>
                </View>
                <Pill tone="positive">ACTIVE</Pill>
              </View>
              {!isCurrentUser ? (
                <GhostButton
                  label="Move out"
                  color={theme.moneyNegative}
                  onPress={() => Alert.alert(
                    `Move out ${member.name}?`,
                    'Their account will be frozen from new expenses. Only you can undo this in Archived roommates.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Move out', style: 'destructive', onPress: () => moveOutMember(member.id) },
                    ],
                  )}
                />
              ) : null}
            </Card>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/auth' as never)}>
        <Card style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={currentMember.name} color={theme.moneyPositiveTint} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800' }}>Account</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 13 }}>Email sign-in and Supabase connection</Text>
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 22 }}>›</Text>
          </View>
        </Card>
      </Pressable>

      {archivedMembers.length ? <Text selectable style={{ color: theme.muted, fontSize: 13 }}>{archivedMembers.length} roommate{archivedMembers.length === 1 ? '' : 's'} can be reviewed in the archive.</Text> : null}
    </AppScreen>
  );
}
