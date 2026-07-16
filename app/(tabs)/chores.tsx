import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Avatar, Card, EditorialHeader, FloatingAction, GhostButton, Pill, PrimaryButton, SectionTitle, Segmented } from '@/components/homiez-ui';
import { ScreenIllustration, screenIllustrations } from '@/components/screen-illustration';
import { typography } from '@/constants/design';
import { formatFrequency, formatRelativeAvailability, isPastDue, isToday, isWithinCompletedWindow } from '@/lib/chores';
import { formatDate, formatDateTime } from '@/lib/money';
import type { ChoreFrequencyUnit, ChoreLog, ChoreTemplate } from '@/lib/types';
import { useHousehold } from '@/providers/household-provider';

type ChoreTab = 'active' | 'inactive' | 'completed';
const CHORES_BACKGROUND = '#22211F';

export default function ChoresScreen() {
  const theme = useAppTheme();
  const {
    data,
    activeMembers,
    recentChoreLogs,
    completeChore,
    skipChore,
    snoozeChore,
    undoChore,
    logAdHocChore,
  } = useHousehold();
  const [tab, setTab] = useState<ChoreTab>('active');
  const [pastDueOnly, setPastDueOnly] = useState(false);
  const [snoozingLog, setSnoozingLog] = useState<ChoreLog>();
  const [snoozeAmount, setSnoozeAmount] = useState(2);
  const [snoozeUnit, setSnoozeUnit] = useState<ChoreFrequencyUnit>('day');
  const [adHocOpen, setAdHocOpen] = useState(false);
  const [adHocTitle, setAdHocTitle] = useState('');

  const templateById = useMemo(() => new Map(data.choreTemplates.map((template) => [template.id, template])), [data.choreTemplates]);
  const visibleLogs = recentChoreLogs.filter((log) => !log.deletedAt && !templateById.get(log.choreTemplateId)?.isDeleted);
  const active = visibleLogs.filter((log) => log.status === 'active');
  const inactive = visibleLogs.filter((log) => log.status === 'inactive');
  const completed = visibleLogs
    .filter((log) => log.status === 'completed' && isWithinCompletedWindow(log.completedAt))
    .sort((a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime());
  const dueToday = active.filter((log) => isToday(log.dueDate));
  const pastDue = active.filter((log) => !templateById.get(log.choreTemplateId)?.frequencyInterval && isPastDue(log.dueDate));
  const unassigned = active.filter((log) => !log.assignedTo);
  const displayedActive = pastDueOnly ? pastDue : active;

  function openDetails(log: ChoreLog) {
    router.push({ pathname: '/chore-detail', params: { logId: log.id } } as never);
  }

  function confirmSkip(log: ChoreLog, template: ChoreTemplate) {
    const repeating = Boolean(template.frequencyInterval);
    Alert.alert(
      `Skip “${template.name}”?`,
      repeating
        ? `${formatFrequency(template)} will restart from now. The current assignee keeps their turn.`
        : 'It will appear in Completed with no credit and can be undone for 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', onPress: () => skipChore(log.id) },
      ],
    );
  }

  function confirmSnooze() {
    if (!snoozingLog) return;
    snoozeChore(snoozingLog.id, snoozeAmount, snoozeUnit);
    setSnoozingLog(undefined);
  }

  function saveAdHoc() {
    if (!adHocTitle.trim()) return Alert.alert('What did you take care of?');
    logAdHocChore(adHocTitle);
    setAdHocTitle('');
    setAdHocOpen(false);
  }

  return (
    <>
      <AppScreen style={{ backgroundColor: CHORES_BACKGROUND }} contentContainerStyle={{ paddingBottom: 118 }}>
        <ScreenIllustration source={screenIllustrations.chores} backgroundColor={CHORES_BACKGROUND} artworkOnly showGround={false} />

        <Card accent={theme.accent} variant="elevated" style={{ paddingTop: 20 }}>
          <EditorialHeader
            eyebrow="The care layer"
            title="Chores"
            description="See what needs attention, what is waiting, and what the house finished today."
            trailing={<FloatingAction label="New chore" onPress={() => router.push('/add-chore' as never)} />}
          />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <Pill tone="positive">TODAY</Pill>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 21 }}>Today’s chores</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 11 }}>The active work that needs the house’s attention.</Text>
            </View>
            <Text selectable style={{ color: theme.accent, fontFamily: typography.bold, fontSize: 42, lineHeight: 46, fontVariant: ['tabular-nums'] }}>{dueToday.length}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TodayStat label="DUE TODAY" value={dueToday.length} />
            <TodayStat label="PAST DUE" value={pastDue.length} divided />
            <TodayStat label="UNASSIGNED" value={unassigned.length} divided />
          </View>
          <PrimaryButton label="View 30-day history" tone="dark" icon="history" onPress={() => router.push('/chore-history' as never)} />
        </Card>

        <Segmented
          value={tab}
          onChange={(value) => setTab(value as ChoreTab)}
          options={[
            { value: 'active', label: `Active · ${active.length}` },
            { value: 'inactive', label: `Inactive · ${inactive.length}` },
            { value: 'completed', label: `Completed · ${completed.length}` },
          ]}
        />

        {tab === 'active' ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <SectionTitle title={pastDueOnly ? 'Past-due chores' : 'Ready to do'} action={pastDueOnly ? 'Show all' : undefined} onPress={() => setPastDueOnly(false)} />
              {!pastDueOnly ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: pastDueOnly }}
                  onPress={() => setPastDueOnly(true)}
                  style={({ pressed }) => ({
                    minHeight: 36,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 14,
                    paddingHorizontal: 11,
                    backgroundColor: pastDue.length ? 'rgba(255,64,0,.08)' : theme.card,
                    opacity: pressed ? .65 : 1,
                  })}>
                  <MaterialIcons name="filter-list" size={15} color={pastDue.length ? theme.accent : theme.muted} />
                  <Text style={{ color: pastDue.length ? theme.accent : theme.muted, fontFamily: typography.bold, fontSize: 10 }}>PAST DUE · {pastDue.length}</Text>
                </Pressable>
              ) : null}
            </View>
            {displayedActive.length ? displayedActive.map((log, index) => {
              const template = templateById.get(log.choreTemplateId);
              if (!template) return null;
              return (
                <ActiveChoreCard
                  key={log.id}
                  log={log}
                  template={template}
                  featured={index === 0}
                  onDetails={() => openDetails(log)}
                  onComplete={() => completeChore(log.id)}
                  onSkip={() => confirmSkip(log, template)}
                  onSnooze={() => setSnoozingLog(log)}
                />
              );
            }) : <EmptyState icon="check-circle" title={pastDueOnly ? 'Nothing is past due.' : 'The active list is clear.'} body={pastDueOnly ? 'Every dated chore is on track.' : 'Enjoy the quiet — or add something the house needs.'} />}
          </View>
        ) : null}

        {tab === 'inactive' ? (
          <View style={{ gap: 12 }}>
            <SectionTitle title="Waiting to return" />
            {inactive.length ? inactive.map((log) => {
              const template = templateById.get(log.choreTemplateId);
              if (!template) return null;
              const assignee = activeMembers.find((member) => member.id === log.assignedTo);
              const snoozed = Boolean(log.snoozedUntil);
              return (
                <Card key={log.id} variant="inset">
                  <Pressable accessibilityRole="button" onPress={() => openDetails(log)} style={({ pressed }) => ({ opacity: pressed ? .65 : 1 })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Avatar name={assignee?.name ?? '?'} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 17 }}>{template.name}</Text>
                        <Text selectable style={{ color: theme.muted, fontSize: 11 }}>{formatRelativeAvailability(log.availableAt)} · {assignee?.name ?? 'Unassigned'}</Text>
                      </View>
                      <Pill tone={snoozed ? 'pending' : 'subtle'}>{snoozed ? 'SNOOZED' : 'COOLDOWN'}</Pill>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text selectable style={{ color: theme.faint, fontFamily: typography.medium, fontSize: 10 }}>{snoozed ? 'Temporary pause' : formatFrequency(template)}</Text>
                    <GhostButton label="View details" onPress={() => openDetails(log)} />
                  </View>
                </Card>
              );
            }) : <EmptyState icon="hourglass-empty" title="Nothing is waiting." body="Repeating and snoozed chores will rest here until they are ready." />}
          </View>
        ) : null}

        {tab === 'completed' ? (
          <View style={{ gap: 12 }}>
            <PrimaryButton label="Log an ad-hoc chore" tone="dark" icon="add-task" onPress={() => setAdHocOpen(true)} />
            <SectionTitle title="Completed in the last 24 hours" />
            {completed.length ? completed.map((log) => {
              const template = templateById.get(log.choreTemplateId);
              if (!template) return null;
              const member = activeMembers.find((item) => item.id === log.completedBy) ?? data.members.find((item) => item.id === log.completedBy);
              const skipped = log.completionType === 'skipped';
              return (
                <Card key={log.id} accent={skipped ? undefined : theme.accent}>
                  <Pressable accessibilityRole="button" onPress={() => openDetails(log)} style={({ pressed }) => ({ opacity: pressed ? .65 : 1 })}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Avatar name={member?.name ?? '?'} active={!skipped} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 17 }}>{template.name}</Text>
                        <Text selectable style={{ color: theme.muted, fontSize: 11 }}>
                          {skipped ? `Skipped by ${member?.name ?? 'Unknown roommate'} · ${formatDateTime(log.completedAt)} · no credit` : `Completed by ${member?.name ?? 'Someone'} · ${formatDateTime(log.completedAt)}`}
                        </Text>
                      </View>
                      <Pill tone={skipped ? 'subtle' : 'positive'}>{log.completionType === 'ad-hoc' ? 'AD-HOC' : skipped ? 'SKIPPED' : 'DONE'}</Pill>
                    </View>
                  </Pressable>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text selectable style={{ color: theme.faint, fontSize: 10 }}>Visible here for 24 hours</Text>
                    {log.completionType === 'ad-hoc' || skipped
                      ? <GhostButton label="View details" onPress={() => openDetails(log)} />
                      : <GhostButton label="Undo" onPress={() => undoChore(log.id)} />}
                  </View>
                </Card>
              );
            }) : <EmptyState icon="done-all" title="No recent completions." body="Finished and ad-hoc chores stay visible here for 24 hours." />}
          </View>
        ) : null}
      </AppScreen>

      <SnoozeModal
        visible={Boolean(snoozingLog)}
        title={templateById.get(snoozingLog?.choreTemplateId ?? '')?.name ?? 'Chore'}
        amount={snoozeAmount}
        unit={snoozeUnit}
        onAmountChange={setSnoozeAmount}
        onUnitChange={setSnoozeUnit}
        onCancel={() => setSnoozingLog(undefined)}
        onConfirm={confirmSnooze}
      />
      <AdHocModal
        visible={adHocOpen}
        value={adHocTitle}
        currentUserName={activeMembers.find((member) => member.id === data.currentUserId)?.name ?? 'You'}
        onChange={setAdHocTitle}
        onCancel={() => setAdHocOpen(false)}
        onConfirm={saveAdHoc}
      />
    </>
  );

  function TodayStat({ label, value, divided = false }: { label: string; value: number; divided?: boolean }) {
    return (
      <View style={{ flex: 1, paddingLeft: divided ? 13 : 0, boxShadow: divided ? 'inset 1px 0 rgba(255,255,255,.055)' : undefined }}>
        <Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 9 }}>{label}</Text>
        <Text selectable style={{ color: value ? theme.heading : theme.faint, fontFamily: typography.semibold, fontSize: 20, marginTop: 8, fontVariant: ['tabular-nums'] }}>{value}</Text>
      </View>
    );
  }

  function ActiveChoreCard({ log, template, featured, onDetails, onComplete, onSkip, onSnooze }: {
    log: ChoreLog;
    template: ChoreTemplate;
    featured: boolean;
    onDetails: () => void;
    onComplete: () => void;
    onSkip: () => void;
    onSnooze: () => void;
  }) {
    const assignee = activeMembers.find((member) => member.id === log.assignedTo);
    const overdue = !template.frequencyInterval && isPastDue(log.dueDate);
    const today = !template.frequencyInterval && isToday(log.dueDate);
    return (
      <Card accent={overdue || featured ? theme.accent : undefined} variant={featured ? 'elevated' : 'default'}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View ${template.name} details`} onPress={onDetails} style={({ pressed }) => ({ opacity: pressed ? .65 : 1 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={assignee?.name ?? '?'} active={featured} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 17 }}>{template.name}</Text>
              <Text selectable style={{ color: theme.muted, fontSize: 11 }}>
                {assignee?.name ?? 'Unassigned'} · {template.frequencyInterval ? formatFrequency(template) : log.dueDate ? `due ${formatDate(log.dueDate)}` : 'no due date'}
              </Text>
            </View>
            <Pill tone={overdue ? 'negative' : log.assignedTo ? 'positive' : 'subtle'}>{overdue ? 'PAST DUE' : today ? 'TODAY' : log.assignedTo ? 'ACTIVE' : 'OPEN'}</Pill>
          </View>
        </Pressable>
        <PrimaryButton label="Complete" tone={featured ? 'accent' : 'dark'} icon="check" onPress={onComplete} />
        <View style={{ flexDirection: 'row', gap: 9 }}>
          <ActionButton icon="snooze" label="Snooze" onPress={onSnooze} />
          <ActionButton icon="skip-next" label="Skip" onPress={onSkip} />
          <ActionButton icon="info-outline" label="Details" onPress={onDetails} />
        </View>
      </Card>
    );
  }

  function ActionButton({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; label: string; onPress: () => void }) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 15,
        backgroundColor: theme.cardStrong,
        opacity: pressed ? .62 : 1,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.035)',
      })}>
        <MaterialIcons name={icon} size={16} color={theme.muted} />
        <Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 10 }}>{label}</Text>
      </Pressable>
    );
  }

  function EmptyState({ icon, title, body }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string; body: string }) {
    return (
      <Card variant="inset" style={{ alignItems: 'center', paddingVertical: 26 }}>
        <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.cardStrong }}>
          <MaterialIcons name={icon} size={22} color={theme.faint} />
        </View>
        <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 15 }}>{title}</Text>
        <Text selectable style={{ color: theme.muted, maxWidth: 300, textAlign: 'center', fontSize: 11, lineHeight: 17 }}>{body}</Text>
      </Card>
    );
  }
}

function SnoozeModal({ visible, title, amount, unit, onAmountChange, onUnitChange, onCancel, onConfirm }: {
  visible: boolean;
  title: string;
  amount: number;
  unit: ChoreFrequencyUnit;
  onAmountChange: (amount: number) => void;
  onUnitChange: (unit: ChoreFrequencyUnit) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.62)' }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: theme.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 36, gap: 18, boxShadow: '0 -20px 50px rgba(0,0,0,.35)' }}>
          <View style={{ gap: 6 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 22 }}>Snooze “{title}”</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>It will move to Inactive, then return automatically.</Text>
          </View>
          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 10 }}>FOR HOW LONG?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[1, 2, 3, 7].map((value) => (
                <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value}`} accessibilityState={{ selected: amount === value }} onPress={() => onAmountChange(value)} style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: amount === value ? theme.accent : theme.cardStrong }}>
                  <Text style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 14 }}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <Segmented
              value={unit}
              onChange={(value) => onUnitChange(value as ChoreFrequencyUnit)}
              options={[
                { value: 'day', label: amount === 1 ? 'Day' : 'Days' },
                { value: 'week', label: amount === 1 ? 'Week' : 'Weeks' },
                { value: 'month', label: amount === 1 ? 'Month' : 'Months' },
              ]}
            />
          </View>
          <PrimaryButton label={`Snooze for ${amount} ${unit}${amount === 1 ? '' : 's'}`} icon="snooze" onPress={onConfirm} />
          <GhostButton label="Cancel" onPress={onCancel} color={theme.muted} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AdHocModal({ visible, value, currentUserName, onChange, onCancel, onConfirm }: {
  visible: boolean;
  value: string;
  currentUserName: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.62)' }}>
        <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: theme.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 36, gap: 18, boxShadow: '0 -20px 50px rgba(0,0,0,.35)' }}>
          <View style={{ gap: 6 }}>
            <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 22 }}>Log an ad-hoc chore</Text>
            <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>Give {currentUserName} credit for something that was not on the list.</Text>
          </View>
          <TextInput
            accessibilityLabel="Ad-hoc chore title"
            autoFocus
            value={value}
            onChangeText={onChange}
            placeholder="e.g. Deep-cleaned the oven"
            placeholderTextColor={theme.faint}
            returnKeyType="done"
            onSubmitEditing={onConfirm}
            style={{ minHeight: 58, borderRadius: 19, borderCurve: 'continuous', backgroundColor: theme.cardStrong, color: theme.heading, paddingHorizontal: 16, fontFamily: typography.medium, fontSize: 15, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' }}
          />
          <PrimaryButton label="Add to Completed" icon="add-task" disabled={!value.trim()} onPress={onConfirm} />
          <GhostButton label="Cancel" onPress={onCancel} color={theme.muted} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
