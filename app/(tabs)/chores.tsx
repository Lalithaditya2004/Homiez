import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Callout, Card, EditorialHeader, FloatingAction, GhostButton, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatDate } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ChoresScreen() {
  const theme = useAppTheme();
  const { data, activeMembers, recentChoreLogs, completeChore, deleteChoreTemplate, scheduleChore } = useHousehold();
  const templates = data.choreTemplates.filter((template) => !template.isDeleted);
  const pending = recentChoreLogs.filter((log) => log.status === 'pending');
  const completed = recentChoreLogs.filter((log) => log.status === 'completed');
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + index); return { date, today: index === 0 }; });
  function scheduleTomorrow(templateId: string) { const date = new Date(); date.setDate(date.getDate() + 1); scheduleChore(templateId, data.currentUserId, date.toISOString()); }

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 118 }}>
      <EditorialHeader eyebrow="The care layer" title="Chores" description="A visible rhythm for the invisible work that keeps a home feeling good." trailing={<FloatingAction label="New chore" onPress={() => router.push('/add-chore' as never)} />} />
      <Card accent={theme.accent} variant="elevated"><Pill tone="positive">JULY ACTIVITY</Pill><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 21 }}>Chore activity this month</Text><Text selectable style={{ color: theme.muted, fontSize: 11 }}>A plain summary of scheduled work across the household.</Text><View style={{ flexDirection: 'row', marginTop: 4 }}><View style={{ flex: 1 }}><Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9 }}>COMPLETED</Text><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 20, marginTop: 10 }}>{completed.length} chores</Text></View><View style={{ flex: 1, paddingLeft: 14, boxShadow: 'inset 1px 0 rgba(255,255,255,.055)' }}><Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9 }}>PENDING</Text><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 20, marginTop: 10 }}>{pending.length} chores</Text></View></View><PrimaryButton label="Review 30-day history" tone="dark" icon="history" onPress={() => router.push('/chore-history' as never)} /></Card>

      <View style={{ gap: 12 }}><SectionTitle title="The next seven days" action={`${pending.length} in motion`} /><Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 5 }}>{week.map(({ date, today }) => <View key={date.toISOString()} style={{ flex: 1, alignItems: 'center', gap: 6 }}><Text selectable style={{ color: today ? theme.accent : theme.faint, fontFamily: typography.bold, fontSize: 9 }}>{date.toLocaleDateString('en-US', { weekday: 'narrow' }).toUpperCase()}</Text><View style={{ width: '100%', maxWidth: 38, height: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: today ? theme.accent : theme.cardStrong, boxShadow: today ? '0 8px 18px rgba(255,64,0,.2)' : '0 6px 14px rgba(0,0,0,.16)' }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{date.getDate()}</Text></View></View>)}</View></Card></View>

      <View style={{ gap: 12 }}><SectionTitle title="Reusable rituals" action="History" onPress={() => router.push('/chore-history' as never)} />{templates.map((template, index) => { const log = pending.filter((item) => item.choreTemplateId === template.id).sort((a,b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0]; const assignee = activeMembers.find((item) => item.id === log?.assignedTo); return <Card key={template.id} accent={log && index === 0 ? theme.accent : undefined}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={assignee?.name ?? '?'} active={Boolean(log)} /><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 18 }}>{template.name}</Text><Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{log ? `${assignee?.name ?? 'Unassigned'} · due ${formatDate(log.dueDate)}` : 'The slate is clean'}</Text></View><Pill tone={log ? 'positive' : 'subtle'}>{log ? 'DUE' : 'CLEAR'}</Pill></View><PrimaryButton label={log ? 'Mark complete' : 'Put it on tomorrow'} tone={index === 0 ? 'accent' : 'dark'} icon="check" onPress={() => log ? completeChore(log.id) : scheduleTomorrow(template.id)} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><GhostButton label="Trace history" onPress={() => router.push({ pathname: '/chore-history', params: { templateId: template.id } } as never)} /><GhostButton label="Remove" color={theme.muted} onPress={() => Alert.alert(`Remove ${template.name}?`, 'The template and its logs stay recoverable for 30 days.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => deleteChoreTemplate(template.id) }])} /></View></Card>; })}</View>
      <Pressable onPress={() => router.push('/add-chore' as never)}><Callout title="Give another task a home.">Create a reusable chore that can be scheduled again without rebuilding the details.</Callout></Pressable>
    </AppScreen>
  );
}
