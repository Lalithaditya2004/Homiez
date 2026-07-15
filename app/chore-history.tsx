import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, Pill, SectionTitle, Segmented } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatDateTime } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ChoreHistoryScreen() {
  const theme = useAppTheme(); const { templateId } = useLocalSearchParams<{ templateId?: string }>(); const { data, recentChoreLogs, deletedChoreLogs } = useHousehold(); const [view, setView] = useState<'completed' | 'deleted'>('completed');
  const completed = useMemo(() => recentChoreLogs.filter((log) => log.status === 'completed' && (!templateId || log.choreTemplateId === templateId)).sort((a,b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime()), [recentChoreLogs, templateId]);
  const deleted = useMemo(() => deletedChoreLogs.filter((log) => !templateId || log.choreTemplateId === templateId).sort((a,b) => new Date(b.deletedAt ?? b.createdAt).getTime() - new Date(a.deletedAt ?? a.createdAt).getTime()), [deletedChoreLogs, templateId]);
  const logs = view === 'completed' ? completed : deleted;
  return <AppScreen><EditorialHeader eyebrow="Thirty-day record" title="A memory of care." description="Completed work and intentionally removed chores, kept chronological." /><Segmented value={view} onChange={(value) => setView(value as typeof view)} options={[{ value: 'completed', label: `Completed · ${completed.length}` }, { value: 'deleted', label: `Deleted · ${deleted.length}` }]} /><View style={{ gap: 10 }}><SectionTitle title={view === 'completed' ? 'Completed tasks' : 'Deleted chores'} action="30 days" />{logs.length ? logs.map((log) => { const template = data.choreTemplates.find((item) => item.id === log.choreTemplateId); const member = data.members.find((item) => item.id === (view === 'completed' ? log.completedBy : log.assignedTo)); return <Card key={log.id} style={{ padding: 14 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}><Avatar name={member?.name ?? '?'} active={view === 'completed'} /><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{template?.name ?? 'Deleted chore'}</Text><Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{view === 'completed' ? `${member?.name ?? 'Someone'} · ${formatDateTime(log.completedAt)}` : `Removed · ${formatDateTime(log.deletedAt)}`}</Text></View><Pill tone={view === 'completed' ? 'positive' : 'pending'}>{view === 'completed' ? 'DONE' : 'DELETED'}</Pill></View></Card>; }) : <Card><Text selectable style={{ color: theme.muted }}>Nothing here in the last 30 days.</Text></Card>}</View>
    <View style={{ height: 96, flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 14, borderRadius: 21, backgroundColor: theme.card, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.26)' }}>{[.42,.76,.56,.88].map((height,index) => <View key={index} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 7, height: '100%' }}><View style={{ width: '100%', height: `${height * 100}%`, borderRadius: 99, backgroundColor: theme.accent, opacity: .72 }} /><Text style={{ color: theme.faint, fontSize: 8 }}>W{index+1}</Text></View>)}</View>
  </AppScreen>;
}
