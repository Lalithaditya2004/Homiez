import { router } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, Pill, PrimaryButton } from '@/components/homiez-ui';
import { formatDateTime } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ArchivedRoommatesScreen() {
  const theme = useAppTheme();
  const { data, archivedMembers, reclaimMember } = useHousehold();

  return (
    <AppScreen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Archived roommates</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Frozen from new expenses, never silently erased.</Text>
      </View>

      {archivedMembers.length ? archivedMembers.map((member) => {
        const mover = data.members.find((candidate) => candidate.id === member.movedOutBy);
        const canUndo = member.movedOutBy === data.currentUserId;
        return (
          <Card key={member.id} accent={theme.moneyNegative}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={member.name} color={theme.moneyNegativeTint} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>{member.name}</Text>
                <Text selectable style={{ color: theme.muted, fontSize: 13 }}>Moved out {formatDateTime(member.movedOutAt)}</Text>
              </View>
              <Pill tone="negative">FROZEN</Pill>
            </View>
            <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>
              {canUndo ? 'You initiated this move-out, so you can reclaim it immediately.' : `${mover?.name ?? 'Another roommate'} initiated this move-out. Only they can undo it.`}
            </Text>
            {canUndo ? (
              <PrimaryButton label="Reclaim / undo move-out" onPress={() => {
                if (reclaimMember(member.id)) {
                  Alert.alert(`${member.name} is active again.`, 'They can immediately participate in new expenses and chores.', [{ text: 'Done', onPress: () => router.back() }]);
                }
              }} />
            ) : null}
          </Card>
        );
      }) : (
        <Card><Text selectable style={{ color: theme.muted }}>No archived roommates.</Text></Card>
      )}
    </AppScreen>
  );
}
