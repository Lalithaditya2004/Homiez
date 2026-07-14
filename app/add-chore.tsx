import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { useHousehold } from '@/providers/household-provider';

function defaultDueDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export default function AddChoreScreen() {
  const theme = useAppTheme();
  const { activeMembers, data, createChore } = useHousehold();
  const [name, setName] = useState('');
  const [assigneeId, setAssigneeId] = useState(data.currentUserId);
  const [dueDate, setDueDate] = useState(defaultDueDate());

  function saveChore() {
    const parsedDate = new Date(`${dueDate}T12:00:00`);
    if (!name.trim()) {
      Alert.alert('Give this chore a clear name.');
      return;
    }
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Use a date in YYYY-MM-DD format.');
      return;
    }
    createChore({ name, assigneeId, dueDate: parsedDate.toISOString() });
    router.back();
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Schedule a chore</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>This creates a reusable template and its first task.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>CHORE NAME</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Clean kitchen"
          placeholderTextColor={theme.muted}
          style={{ backgroundColor: theme.card, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, minHeight: 50, fontSize: 16 }}
        />
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Assign to" />
        {activeMembers.map((member) => {
          const selected = member.id === assigneeId;
          return (
            <Pressable key={member.id} accessibilityRole="button" onPress={() => setAssigneeId(member.id)}>
              <Card accent={selected ? theme.chores : undefined} style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Avatar name={member.name} />
                  <Text selectable style={{ color: theme.heading, flex: 1, fontSize: 16, fontWeight: '800' }}>{member.name}</Text>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? theme.chores : theme.muted, alignItems: 'center', justifyContent: 'center' }}>
                    {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.chores }} /> : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View style={{ gap: 10 }}>
        <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>DUE DATE</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          style={{ backgroundColor: theme.card, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 14, borderCurve: 'continuous', paddingHorizontal: 14, minHeight: 50, fontSize: 16, fontVariant: ['tabular-nums'] }}
        />
      </View>

      <PrimaryButton label="Create chore" tone="chores" onPress={saveChore} />
    </AppScreen>
  );
}
