import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, GhostButton, Pill, PrimaryButton, SectionTitle } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { formatFrequency, formatRelativeAvailability, isPastDue } from '@/lib/chores';
import { formatDate, formatDateTime } from '@/lib/money';
import { useHousehold } from '@/providers/household-provider';

export default function ChoreDetailScreen() {
  const theme = useAppTheme();
  const { logId } = useLocalSearchParams<{ logId?: string }>();
  const { data, deleteChoreTemplate } = useHousehold();
  const log = data.choreLogs.find((item) => item.id === logId);
  const template = data.choreTemplates.find((item) => item.id === log?.choreTemplateId);
  const assignee = data.members.find((item) => item.id === log?.assignedTo);
  const credited = data.members.find((item) => item.id === log?.completedBy);

  if (!log || !template) {
    return (
      <AppScreen>
        <EditorialHeader eyebrow="Chore details" title="This chore moved on." description="It may have been undone or removed by a roommate." />
        <PrimaryButton label="Back to chores" tone="dark" icon="arrow-back" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  const statusLabel = log.status === 'active'
    ? isPastDue(log.dueDate) ? 'PAST DUE' : 'ACTIVE'
    : log.status === 'inactive' ? log.snoozedUntil ? 'SNOOZED' : 'COOLDOWN'
      : log.completionType === 'skipped' ? 'SKIPPED' : log.completionType === 'ad-hoc' ? 'AD-HOC' : 'COMPLETED';
  const currentTemplateId = template.id;
  const currentLogId = log.id;
  const currentTemplateName = template.name;

  function edit() {
    router.push({ pathname: '/add-chore', params: { templateId: currentTemplateId, logId: currentLogId } } as never);
  }

  function remove() {
    Alert.alert(
      `Remove “${currentTemplateName}”?`,
      'The chore leaves the tabs now. Its existing log remains in the 30-day record.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            deleteChoreTemplate(currentTemplateId);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 64 }}>
      <EditorialHeader eyebrow="Chore details" title={template.name} description="The full timing and ownership picture, in one place." />
      <Card accent={log.status === 'active' ? theme.accent : undefined} variant="elevated">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={(log.status === 'completed' ? credited : assignee)?.name ?? '?'} active={log.status === 'active'} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 18 }}>{template.name}</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 11 }}>
              {log.status === 'completed'
                ? log.completionType === 'skipped' ? 'No credit awarded' : `Credit to ${credited?.name ?? 'a roommate'}`
                : assignee?.name ?? 'Open to anyone'}
            </Text>
          </View>
          <Pill tone={log.status === 'active' ? 'positive' : log.status === 'completed' ? 'subtle' : 'pending'}>{statusLabel}</Pill>
        </View>
        <PrimaryButton label="Edit chore" tone="dark" icon="edit" onPress={edit} />
      </Card>

      <View style={{ gap: 11 }}>
        <SectionTitle title="Schedule and ownership" />
        <Card variant="inset">
          <DetailRow icon="person-outline" label="Assigned to" value={assignee?.name ?? 'Anyone in the house'} />
          {!template.frequencyInterval ? <DetailRow icon="event" label="Due date" value={log.dueDate ? formatDate(log.dueDate) : 'No due date'} /> : null}
          <DetailRow icon="repeat" label="Frequency" value={formatFrequency(template)} />
          <DetailRow icon="group-work" label="Rotation" value={template.rotationEnabled ? 'On · next roommate after completion' : 'Off'} />
        </Card>
      </View>

      <View style={{ gap: 11 }}>
        <SectionTitle title="Lifecycle" />
        <Card variant="inset">
          <DetailRow icon="radio-button-checked" label="Current state" value={statusLabel} />
          {log.status === 'inactive' ? <DetailRow icon="schedule" label="Returns" value={formatRelativeAvailability(log.availableAt)} /> : null}
          {log.completedAt ? <DetailRow icon="done-all" label={log.completionType === 'skipped' ? 'Skipped' : 'Completed'} value={formatDateTime(log.completedAt)} /> : null}
          <DetailRow icon="add-circle-outline" label="Created" value={formatDateTime(log.createdAt)} />
        </Card>
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <MaterialIcons name="history" size={20} color={theme.accent} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 13 }}>30-day record</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 11 }}>Completions stay in history after leaving the 24-hour tab.</Text>
          </View>
          <GhostButton label="Open" onPress={() => router.push({ pathname: '/chore-history', params: { templateId: template.id } } as never)} />
        </View>
      </Card>

      {!template.isAdHoc ? <GhostButton label="Remove chore" color={theme.muted} onPress={remove} /> : null}
    </AppScreen>
  );

  function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; value: string }) {
    return (
      <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardStrong }}>
          <MaterialIcons name={icon} size={17} color={theme.muted} />
        </View>
        <Text selectable style={{ color: theme.muted, flex: 1, fontSize: 11 }}>{label}</Text>
        <Text selectable style={{ color: theme.heading, maxWidth: '52%', textAlign: 'right', fontFamily: typography.semibold, fontSize: 11, lineHeight: 16 }}>{value}</Text>
      </View>
    );
  }
}
