import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, Pill, SectionTitle } from '@/components/homiez-ui';
import { formatDateTime } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ChoreHistoryScreen() {
  const theme = useAppTheme();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { data, recentChoreLogs, deletedChoreLogs } = useHousehold();
  const [view, setView] = useState<'completed' | 'deleted'>('completed');
  const selectedTemplate = data.choreTemplates.find((template) => template.id === templateId);
  const completedLogs = useMemo(
    () => recentChoreLogs
      .filter((log) => log.status === 'completed' && (!templateId || log.choreTemplateId === templateId))
      .sort((left, right) => new Date(right.completedAt ?? right.createdAt).getTime() - new Date(left.completedAt ?? left.createdAt).getTime()),
    [recentChoreLogs, templateId],
  );

  const deleted = useMemo(
    () => deletedChoreLogs
      .filter((log) => !templateId || log.choreTemplateId === templateId)
      .sort((left, right) => new Date(right.deletedAt ?? right.createdAt).getTime() - new Date(left.deletedAt ?? left.createdAt).getTime()),
    [deletedChoreLogs, templateId],
  );
  const logs = view === 'completed' ? completedLogs : deleted;

  return (
    <AppScreen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
          {selectedTemplate ? selectedTemplate.name : 'Chore history'}
        </Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>A rolling, chronological 30-day record.</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {([
          ['completed', `Completed · ${completedLogs.length}`],
          ['deleted', `Deleted · ${deleted.length}`],
        ] as const).map(([option, label]) => {
          const selected = option === view;
          return (
            <Pressable key={option} accessibilityRole="button" onPress={() => setView(option)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: selected ? theme.chores : theme.border, backgroundColor: selected ? theme.choresTint : theme.card, minHeight: 46, justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
              <Text selectable style={{ color: selected ? theme.chores : theme.muted, fontSize: 13, fontWeight: '800' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title={view === 'completed' ? 'Completed tasks' : 'Deleted chores'} />
        {logs.length ? logs.map((log) => {
          const template = data.choreTemplates.find((item) => item.id === log.choreTemplateId);
          const roommate = data.members.find((member) => member.id === (view === 'completed' ? log.completedBy : log.assignedTo));
          return (
            <Card key={log.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={roommate?.name ?? '?'} color={view === 'completed' ? theme.moneyPositiveTint : theme.slackerTint} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text selectable style={{ color: theme.heading, fontSize: 16, fontWeight: '800' }}>{template?.name ?? 'Deleted chore'}</Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 13 }}>
                    {view === 'completed' ? `${roommate?.name ?? 'Someone'} completed · ${formatDateTime(log.completedAt)}` : `Removed · ${formatDateTime(log.deletedAt)}`}
                  </Text>
                </View>
                <Pill tone={view === 'completed' ? 'positive' : 'negative'}>{view === 'completed' ? 'DONE' : 'DELETED'}</Pill>
              </View>
            </Card>
          );
        }) : (
          <Card><Text selectable style={{ color: theme.muted }}>{view === 'completed' ? 'Nothing completed in the last 30 days.' : 'No chores were deleted in the last 30 days.'}</Text></Card>
        )}
      </View>
    </AppScreen>
  );
}
