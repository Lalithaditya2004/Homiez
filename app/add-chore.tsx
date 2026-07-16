import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Callout, Card, EditorialHeader, PrimaryButton, SectionTitle, Segmented } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatFrequency } from '@/lib/chores';
import type { ChoreFrequencyUnit } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

function dateInputValue(date?: string): string {
  return date ? new Date(date).toISOString().slice(0, 10) : '';
}

function dateFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function AddChoreScreen() {
  const theme = useAppTheme();
  const { templateId, logId } = useLocalSearchParams<{ templateId?: string; logId?: string }>();
  const { activeMembers, data, createChore, updateChore } = useHousehold();
  const existingTemplate = data.choreTemplates.find((item) => item.id === templateId);
  const existingLog = data.choreLogs.find((item) => item.id === logId);
  const editing = Boolean(existingTemplate && existingLog);

  const [name, setName] = useState(existingTemplate?.name ?? '');
  const [assignee, setAssignee] = useState<string | undefined>(existingLog?.assignedTo);
  const [hasDueDate, setHasDueDate] = useState(!existingTemplate?.frequencyInterval && Boolean(existingLog?.dueDate));
  const [dueDate, setDueDate] = useState(dateInputValue(existingLog?.dueDate) || dateFromToday(1));
  const [scheduleType, setScheduleType] = useState<'one-off' | 'repeating'>(existingTemplate?.frequencyInterval ? 'repeating' : 'one-off');
  const [frequencyInterval, setFrequencyInterval] = useState(String(existingTemplate?.frequencyInterval ?? 1));
  const [frequencyUnit, setFrequencyUnit] = useState<ChoreFrequencyUnit>(existingTemplate?.frequencyUnit ?? 'week');
  const [rotationEnabled, setRotationEnabled] = useState(existingTemplate?.rotationEnabled ?? false);

  const interval = Number.parseInt(frequencyInterval, 10);
  const isRepeating = scheduleType === 'repeating';
  const parsedDueDate = useMemo(() => !isRepeating && hasDueDate ? new Date(`${dueDate}T12:00:00`) : undefined, [dueDate, hasDueDate, isRepeating]);
  const selectedName = activeMembers.find((item) => item.id === assignee)?.name ?? 'Anyone in the house';
  const field = {
    backgroundColor: theme.card,
    color: theme.heading,
    borderRadius: 19,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    minHeight: 58,
    fontFamily: typography.medium,
    fontSize: 15,
    boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)',
  } as const;

  function chooseAssignee(memberId?: string) {
    setAssignee(memberId);
    if (!memberId) setRotationEnabled(false);
  }

  function save() {
    const cleanName = name.trim();
    if (!cleanName) return Alert.alert('Give this chore a clear name.');
    if (!isRepeating && hasDueDate && (!parsedDueDate || Number.isNaN(parsedDueDate.getTime()))) {
      return Alert.alert('Check the due date.', 'Use the YYYY-MM-DD format.');
    }
    if (isRepeating && (!Number.isFinite(interval) || interval < 1 || interval > 99)) {
      return Alert.alert('Check the frequency.', 'Choose a number between 1 and 99.');
    }

    const input = {
      name: cleanName,
      assigneeId: assignee,
      dueDate: isRepeating ? undefined : parsedDueDate?.toISOString(),
      frequencyInterval: isRepeating ? interval : undefined,
      frequencyUnit: isRepeating ? frequencyUnit : undefined,
      rotationEnabled: isRepeating && Boolean(assignee) && rotationEnabled,
    };
    if (editing && templateId && logId) updateChore({ ...input, templateId, logId });
    else createChore(input);
    router.back();
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 64 }}>
      <EditorialHeader
        eyebrow={editing ? 'Edit chore' : 'A clear ask'}
        title={editing ? 'Tune the details.' : 'Add a chore.'}
        description="Keep it one-off or set a rhythm. Everything can be changed later."
      />

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>WHAT NEEDS DOING?</Text>
        <TextInput
          accessibilityLabel="Chore name"
          autoFocus={!editing}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Sweep the living room"
          placeholderTextColor={theme.faint}
          returnKeyType="done"
          style={field}
        />
      </View>

      <View style={{ gap: 11 }}>
        <SectionTitle title="How often?" />
        <Segmented
          value={scheduleType}
          onChange={(value) => {
            setScheduleType(value as typeof scheduleType);
            if (value === 'one-off') setRotationEnabled(false);
            else setHasDueDate(false);
          }}
          options={[
            { value: 'one-off', label: 'One-off' },
            { value: 'repeating', label: 'Repeats' },
          ]}
        />
        {isRepeating ? (
          <Card variant="inset">
            <Text selectable style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>REPEAT EVERY</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput
                accessibilityLabel="Frequency amount"
                value={frequencyInterval}
                onChangeText={(value) => setFrequencyInterval(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
                style={[field, { width: 72, textAlign: 'center' }]}
              />
              <View style={{ flex: 1 }}>
                <Segmented
                  value={frequencyUnit}
                  onChange={(value) => setFrequencyUnit(value as ChoreFrequencyUnit)}
                  options={[
                    { value: 'day', label: 'Days' },
                    { value: 'week', label: 'Weeks' },
                    { value: 'month', label: 'Months' },
                  ]}
                />
              </View>
            </View>
            <Text selectable style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>
              The next cycle starts from the moment this chore is completed or skipped.
            </Text>
          </Card>
        ) : null}
      </View>

      <View style={{ gap: 11 }}>
        <SectionTitle title="Who starts?" />
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: !assignee }} onPress={() => chooseAssignee()}>
          <Card variant={!assignee ? 'elevated' : 'default'} style={{ padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.soft }}>
                <MaterialIcons name="groups" size={20} color={!assignee ? theme.accent : theme.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>Anyone can take it</Text>
                <Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>Leave it unassigned in Active</Text>
              </View>
              <Radio selected={!assignee} />
            </View>
          </Card>
        </Pressable>
        {activeMembers.map((member) => {
          const selected = member.id === assignee;
          return (
            <Pressable key={member.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => chooseAssignee(member.id)}>
              <Card variant={selected ? 'elevated' : 'default'} style={{ padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Avatar name={member.name} active={selected} />
                  <View style={{ flex: 1 }}>
                    <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{member.name}</Text>
                    <Text selectable style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>{member.id === data.currentUserId ? 'You' : 'Roommate'}</Text>
                  </View>
                  <Radio selected={selected} />
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {isRepeating ? (
        <Card variant="elevated">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>Fair-share rotation</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>
                {assignee ? 'Move to the next roommate after each completion.' : 'Choose a starting person to turn rotation on.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Fair-share rotation"
              disabled={!assignee}
              value={rotationEnabled}
              onValueChange={setRotationEnabled}
              trackColor={{ false: theme.soft, true: theme.accent }}
              thumbColor="#F3F3F3"
            />
          </View>
        </Card>
      ) : null}

      {!isRepeating ? <Card variant="inset">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>Add a due date</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 11 }}>Optional — useful when timing matters.</Text>
          </View>
          <Switch
            accessibilityLabel="Add a due date"
            value={hasDueDate}
            onValueChange={setHasDueDate}
            trackColor={{ false: theme.soft, true: theme.accent }}
            thumbColor="#F3F3F3"
          />
        </View>
        {hasDueDate ? (
          <View style={{ gap: 10 }}>
            <TextInput
              accessibilityLabel="Due date"
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.faint}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              style={field}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <DateShortcut label="Today" selected={dueDate === dateFromToday(0)} onPress={() => setDueDate(dateFromToday(0))} />
              <DateShortcut label="Tomorrow" selected={dueDate === dateFromToday(1)} onPress={() => setDueDate(dateFromToday(1))} />
            </View>
          </View>
        ) : null}
      </Card> : null}

      <Callout title={isRepeating ? formatFrequency({ frequencyInterval: interval || 1, frequencyUnit }) : 'One-off chore'}>
        {selectedName}{isRepeating
          ? ' · next cycle starts after completion'
          : hasDueDate && parsedDueDate && !Number.isNaN(parsedDueDate.getTime())
            ? ` · due ${parsedDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            : ' · no due date'}{rotationEnabled ? ' · rotation on' : ''}
      </Callout>
      <PrimaryButton label={editing ? 'Save changes' : 'Add to Active'} icon={editing ? 'check' : 'add'} onPress={save} />
    </AppScreen>
  );

  function Radio({ selected }: { selected: boolean }) {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', boxShadow: `inset 0 0 0 2px ${selected ? theme.accent : theme.faint}` }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.accent }} /> : null}
      </View>
    );
  }

  function DateShortcut({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => ({
          minHeight: 38,
          justifyContent: 'center',
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: selected ? theme.accent : theme.cardStrong,
          opacity: pressed ? .7 : 1,
        })}>
        <Text style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 11 }}>{label}</Text>
      </Pressable>
    );
  }
}
