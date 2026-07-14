import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, GhostButton, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { formatDate } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ChoresScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, recentChoreLogs, completeChore, deleteChoreTemplate, scheduleChore } = useHousehold();
  const templates = data.choreTemplates.filter((template) => !template.isDeleted);
  const pendingLogs = recentChoreLogs.filter((log) => log.status === 'pending');

  function scheduleForTomorrow(templateId: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    scheduleChore(templateId, data.currentUserId, tomorrow.toISOString());
  }

  return (
    <AppScreen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text selectable style={{ color: theme.heading, fontSize: 30, fontWeight: '800', letterSpacing: -0.8 }}>Chores</Text>
          <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Shared upkeep, no nagging required.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/add-chore' as never)} style={({ pressed }) => ({ backgroundColor: theme.chores, borderRadius: 14, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
          <Text selectable style={{ color: '#FFF', fontSize: 28, fontWeight: '500', marginTop: -2 }}>+</Text>
        </Pressable>
      </View>

      <Card accent={theme.chores}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.choresTint, alignItems: 'center', justifyContent: 'center' }}>
            <Text selectable style={{ color: theme.chores, fontSize: 18, fontWeight: '800' }}>✓</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>{pendingLogs.length} chore{pendingLogs.length === 1 ? '' : 's'} in the queue</Text>
            <Text selectable style={{ color: theme.body, fontSize: 14 }}>Tap completion when the task is actually done.</Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Reusable chores" action="30-day history" onPress={() => router.push('/chore-history' as never)} />
        {templates.map((template) => {
          const nextLog = pendingLogs.filter((log) => log.choreTemplateId === template.id).sort((left, right) => (left.dueDate ?? '').localeCompare(right.dueDate ?? ''))[0];
          const assignee = activeMembers.find((member) => member.id === nextLog?.assignedTo);
          return (
            <Card key={template.id} accent={theme.chores}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={template.name} color={theme.choresTint} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>{template.name}</Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 14 }}>
                    {nextLog ? `${assignee?.name ?? 'Unassigned'} · due ${formatDate(nextLog.dueDate)}` : 'Nothing scheduled'}
                  </Text>
                </View>
                {nextLog ? <Pill tone="chores">DUE</Pill> : <Pill tone="neutral">CLEAR</Pill>}
              </View>
              {nextLog ? (
                <PrimaryButton label="Mark complete" tone="chores" onPress={() => completeChore(nextLog.id)} />
              ) : (
                <PrimaryButton label="Schedule for tomorrow" tone="chores" onPress={() => scheduleForTomorrow(template.id)} />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <GhostButton label="View history" onPress={() => router.push({ pathname: '/chore-history', params: { templateId: template.id } } as never)} />
                <GhostButton label="Remove" color={theme.slacker} onPress={() => Alert.alert(
                  `Remove ${template.name}?`,
                  'The template and its logs will move to Deleted chores for 30 days.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => deleteChoreTemplate(template.id) },
                  ],
                )} />
              </View>
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}
