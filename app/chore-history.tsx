import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, Pill, SectionTitle, Segmented, SelectField } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatDateTime } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

type HistoryView = 'completed' | 'skipped';

export default function ChoreHistoryScreen() {
  const theme = useAppTheme();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const { data, recentChoreLogs } = useHousehold();
  const [view, setView] = useState<HistoryView>('completed');
  const [roommateId, setRoommateId] = useState('all');
  const completed = useMemo(() => recentChoreLogs
    .filter((log) => log.status === 'completed' && log.completionType !== 'skipped' && (!templateId || log.choreTemplateId === templateId))
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime()), [recentChoreLogs, templateId]);
  const skipped = useMemo(() => recentChoreLogs
    .filter((log) => log.status === 'completed' && log.completionType === 'skipped' && (!templateId || log.choreTemplateId === templateId))
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime()), [recentChoreLogs, templateId]);
  const source = view === 'completed' ? completed : skipped;
  const logs = source.filter((log) => roommateId === 'all' || (log.completedBy ?? log.assignedTo) === roommateId);
  const roommateOptions = [
    { value: 'all', label: 'All roommates' },
    ...data.members.map((member) => ({ value: member.id, label: member.name })),
  ];

  return (
    <AppScreen>
      <EditorialHeader eyebrow="Thirty-day record" title="A memory of care." description="Every completed or skipped chore, attributed to the roommate who took the action." />
      <Segmented
        value={view}
        onChange={(value) => setView(value as HistoryView)}
        options={[
          { value: 'completed', label: `Completed · ${completed.length}` },
          { value: 'skipped', label: `Skipped · ${skipped.length}` },
        ]}
      />
      <Card variant="inset" style={{ padding: 12 }}>
        <Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9 }}>FILTER BY ROOMMATE</Text>
        <SelectField accessibilityLabel="Filter chore history by roommate" options={roommateOptions} value={roommateId} onChange={setRoommateId} />
      </Card>
      <View style={{ gap: 10 }}>
        <SectionTitle title={view === 'completed' ? 'Completed tasks' : 'Skipped tasks'} action="Last 30 days" />
        {logs.length ? logs.map((log) => {
          const template = data.choreTemplates.find((item) => item.id === log.choreTemplateId);
          const member = data.members.find((item) => item.id === (log.completedBy ?? log.assignedTo));
          return (
            <Card key={log.id} style={{ padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                <Avatar name={member?.name ?? '?'} active={view === 'completed'} />
                <View style={{ flex: 1 }}>
                  <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{template?.name ?? 'Chore'}</Text>
                  <Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{view === 'completed' ? 'Completed' : 'Skipped'} by {member?.name ?? 'Unknown roommate'} · {formatDateTime(log.completedAt)}</Text>
                </View>
                <Pill tone={view === 'completed' ? 'positive' : 'pending'}>{view === 'completed' ? 'DONE' : 'SKIPPED'}</Pill>
              </View>
            </Card>
          );
        }) : <Card><Text selectable style={{ color: theme.muted }}>No {view} chores match this roommate in the last 30 days.</Text></Card>}
      </View>
    </AppScreen>
  );
}
