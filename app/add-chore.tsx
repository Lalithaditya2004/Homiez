import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { useHousehold } from '@/providers/household-provider';

function tomorrow() { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); }
export default function AddChoreScreen() {
  const theme = useAppTheme(); const { activeMembers, data, createChore } = useHousehold();
  const [name, setName] = useState(''); const [assignee, setAssignee] = useState(data.currentUserId); const [dueDate, setDueDate] = useState(tomorrow());
  function save() { const parsed = new Date(`${dueDate}T12:00:00`); if (!name.trim()) return Alert.alert('Give this chore a clear name.'); if (Number.isNaN(parsed.getTime())) return Alert.alert('Use a date in YYYY-MM-DD format.'); createChore({ name, assigneeId: assignee, dueDate: parsed.toISOString() }); router.back(); }
  const selectedName = activeMembers.find((item) => item.id === assignee)?.name ?? 'Roommate'; const parsed = new Date(`${dueDate}T12:00:00`);
  const field = { backgroundColor: theme.card, color: theme.heading, borderRadius: 19, paddingHorizontal: 16, minHeight: 58, fontFamily: typography.medium, fontSize: 15, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' } as const;
  return <AppScreen keyboardShouldPersistTaps="handled"><EditorialHeader eyebrow="New household ritual" title="Schedule a chore" description="Create the reusable task once, then give its first appearance a person and a date." />
    <View style={{ gap: 8 }}><Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>CHORE NAME</Text><TextInput accessibilityLabel="Chore name" value={name} onChangeText={setName} placeholder="e.g. Clean kitchen" placeholderTextColor={theme.faint} style={field} /></View>
    <View style={{ gap: 10 }}><SectionTitle title="Assign to" />{activeMembers.map((member) => { const selected = member.id === assignee; return <Pressable key={member.id} onPress={() => setAssignee(member.id)}><Card variant={selected ? 'elevated' : 'default'} style={{ padding: 12, boxShadow: selected ? 'inset 0 0 0 1px rgba(255,64,0,.24), 0 8px 18px rgba(0,0,0,.18)' : undefined }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}><Avatar name={member.name} active={selected} /><View style={{ flex: 1 }}><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{member.name}</Text><Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{member.id === data.currentUserId ? 'Current user' : selected ? 'Selected' : 'Roommate'}</Text></View><View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 2px ${selected ? theme.accent : theme.faint}` }}>{selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent }} /> : null}</View></View></Card></Pressable>; })}</View>
    <View style={{ gap: 8 }}><Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>DUE DATE</Text><TextInput accessibilityLabel="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.faint} autoCapitalize="none" style={field} /></View>
    <Card variant="elevated"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><MaterialIcons name="calendar-month" size={22} color={theme.accent} /><View><Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{dueDate === tomorrow() ? 'Tomorrow' : 'Scheduled date'}</Text><Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{Number.isNaN(parsed.getTime()) ? dueDate : parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · assigned to {selectedName}</Text></View></View></Card>
    <PrimaryButton label="Create chore" icon="check" onPress={save} />
  </AppScreen>;
}
