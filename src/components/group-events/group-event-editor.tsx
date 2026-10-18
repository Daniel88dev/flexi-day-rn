import DateTimePicker from "@react-native-community/datetimepicker";
import { ClockIcon, UsersIcon } from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { RepeatControls } from "@/components/group-events/repeat-controls";
import { askDelete, askEditScope, confirmDropped } from "@/components/group-events/scope-prompts";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { dateOfDay, dayOfDate } from "@/lib/days";
import {
  blankDraft,
  createInput,
  draftFromTarget,
  draftProblem,
  editRequest,
  ruleChanged,
  withDates,
  type GroupEventDraft,
  type GroupEventScope,
  type GroupEventTarget,
} from "@/lib/group-events/draft";
import { groupEventFailure } from "@/lib/group-events/failure";
import { useGroupEventGroups, useGroupEventWrites } from "@/lib/query";

export type GroupEventEditorState =
  | { kind: "create"; date: string; groupId: string | null }
  | { kind: "edit"; target: GroupEventTarget; groupName: string };

const timeOf = (time: string) =>
  new Date(2026, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
const clockOf = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

function FormGroup({ children }: { children: ReactNode }) {
  return <View className="overflow-hidden rounded-[24px] bg-card">{children}</View>;
}

function Hair() {
  return <View className="ml-4 h-px bg-border" />;
}

function FormRow({
  icon,
  label,
  value,
  accessory,
  onPress,
  testID,
}: {
  icon?: typeof ClockIcon;
  label: string;
  value?: string;
  accessory?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const content = (
    <>
      {icon ? <Icon icon={icon} tone="muted" /> : null}
      <Text className="flex-1 text-[15.5px] font-semibold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text className="max-w-[60%] text-[14.5px] text-faint" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
    </>
  );
  const className = "min-h-[52px] flex-row items-center gap-3 px-4 py-2";
  return onPress ? (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      className={cn(className, "active:opacity-70")}
    >
      {content}
    </Pressable>
  ) : (
    <View testID={testID} className={className}>
      {content}
    </View>
  );
}

function Picker({
  testID,
  mode,
  value,
  min,
  disabled,
  onChange,
}: {
  testID: string;
  mode: "date" | "time";
  value: string;
  min?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const primary = useTone("primary");
  return (
    <DateTimePicker
      testID={testID}
      mode={mode}
      display="compact"
      value={mode === "date" ? dateOfDay(value) : timeOf(value)}
      minimumDate={min ? dateOfDay(min) : undefined}
      minuteInterval={mode === "time" ? 5 : undefined}
      disabled={disabled}
      accentColor={primary}
      onValueChange={(_event, date) => onChange(mode === "date" ? dayOfDate(date) : clockOf(date))}
    />
  );
}

/** The group a new event goes to: the one picked, else the requested one if it may create, else the first that may. */
function useCreateGroups(draft: GroupEventDraft, requested: string | null) {
  const groups = (useGroupEventGroups().data ?? []).filter((group) => group.canCreate);
  const chosen =
    groups.find((group) => group.groupId === (draft.groupId ?? requested)) ?? groups[0] ?? null;
  return { groups, chosen };
}

function Editor({ state, onClose }: { state: GroupEventEditorState; onClose: () => void }) {
  const { t } = useTranslation();
  const labels = t.groupEvents.editor;
  const primary = useTone("primary");
  const faint = useTone("faint");
  const writes = useGroupEventWrites();
  const [draft, setDraft] = useState<GroupEventDraft>(() =>
    state.kind === "create" ? blankDraft(state.date, null) : draftFromTarget(state.target)
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const { groups, chosen } = useCreateGroups(draft, state.kind === "create" ? state.groupId : null);

  const full = state.kind === "create" ? { ...draft, groupId: chosen?.groupId ?? null } : draft;
  const problem = draftProblem(full);
  const busy = writes.busy || asking;
  const multiDay = draft.startDate !== draft.endDate;
  const set = (patch: Partial<GroupEventDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const run = async (write: () => Promise<void>) => {
    setFailure(null);
    try {
      await write();
      onClose();
    } catch (error) {
      setFailure(groupEventFailure(error, t));
    }
  };

  const saveEdit = async (target: GroupEventTarget) => {
    const { event } = target;
    if (!event.repeat) {
      await run(() => writes.update(event.id, editRequest(target, draft, undefined)));
      return;
    }
    setAsking(true);
    try {
      const scope = await askEditScope(
        { title: event.title, ruleChanged: ruleChanged(event, draft) },
        t
      );
      if (!scope) return;
      const request = editRequest(target, draft, scope);
      if (scope !== "this") {
        const dropped = await writes.impact(event.id, request);
        if (dropped > 0 && !(await confirmDropped({ title: event.title, dropped }, t))) return;
      }
      await run(() => writes.update(event.id, request));
    } catch (error) {
      setFailure(groupEventFailure(error, t));
    } finally {
      setAsking(false);
    }
  };

  const save = () => {
    if (problem || busy) return;
    if (state.kind === "create") void run(() => writes.create(createInput(full)));
    else void saveEdit(state.target);
  };

  const remove = async (target: GroupEventTarget) => {
    const answer = await askDelete(
      { title: target.event.title, recurring: target.event.repeat !== null },
      t
    );
    if (!answer) return;
    const request: { scope?: GroupEventScope; occurrenceDate?: string } = answer.scope
      ? { scope: answer.scope, occurrenceDate: target.occurrenceDate }
      : {};
    await run(() => writes.remove(target.event.id, request));
  };

  const pickGroup = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: labels.group,
        options: [...groups.map((group) => group.groupName), labels.cancel],
        cancelButtonIndex: groups.length,
      },
      (index) => {
        const group = groups[index];
        if (group) set({ groupId: group.groupId });
      }
    );

  const groupRow =
    state.kind === "edit" ? (
      <FormRow icon={UsersIcon} label={labels.group} value={state.groupName} />
    ) : groups.length > 1 ? (
      <FormRow
        testID="group-event-editor-group"
        icon={UsersIcon}
        label={labels.group}
        value={chosen?.groupName}
        onPress={pickGroup}
      />
    ) : (
      <FormRow
        testID="group-event-editor-group"
        icon={UsersIcon}
        label={labels.group}
        value={chosen?.groupName ?? labels.noGroup}
      />
    );

  return (
    <View testID="group-event-editor" className="flex-1 bg-background">
      <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
        <Pressable
          testID="group-event-editor-cancel"
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={labels.cancel}
          className="h-10 justify-center rounded-full px-3 active:opacity-70"
        >
          <Text className="text-[16px] text-primary">{labels.cancel}</Text>
        </Pressable>
        <Text className="font-display text-[17px] font-semibold text-foreground">
          {state.kind === "create" ? labels.newTitle : labels.editTitle}
        </Text>
        <Pressable
          testID="group-event-editor-save"
          onPress={save}
          disabled={Boolean(problem) || busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={state.kind === "create" ? labels.add : labels.save}
          accessibilityHint={problem ? labels.problems[problem] : undefined}
          accessibilityState={{ disabled: Boolean(problem) || busy, busy: writes.busy }}
          className="h-10 min-w-[64px] items-center justify-center rounded-full px-3 active:opacity-70"
        >
          {writes.busy ? (
            <ActivityIndicator color={primary} />
          ) : (
            <Text
              className={cn(
                "text-[16px] font-semibold",
                problem || busy ? "text-faint" : "text-primary"
              )}
            >
              {state.kind === "create" ? labels.add : labels.save}
            </Text>
          )}
        </Pressable>
      </View>
      <ScrollView
        contentContainerClassName="gap-5 px-4 pt-4 pb-16"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {failure ? <Notice tone="error" message={failure} /> : null}
        <FormGroup>
          <TextInput
            testID="group-event-editor-title"
            value={draft.title}
            onChangeText={(title) => set({ title })}
            placeholder={labels.title}
            accessibilityLabel={labels.title}
            maxLength={100}
            autoFocus={state.kind === "create"}
            className="px-4 py-3.5 font-sans text-[16px] text-foreground"
            placeholderTextColor={faint}
          />
          <Hair />
          {groupRow}
        </FormGroup>

        <View className="gap-1.5">
          <FormGroup>
            <FormRow
              icon={ClockIcon}
              label={labels.allDay}
              accessory={
                <Switch
                  testID="group-event-editor-all-day"
                  accessibilityLabel={labels.allDay}
                  value={draft.allDay}
                  onValueChange={(allDay) => set({ allDay })}
                  trackColor={{ true: primary }}
                />
              }
            />
            <Hair />
            <FormRow
              label={labels.starts}
              accessory={
                <View className="flex-row gap-1">
                  <Picker
                    testID="group-event-editor-start-date"
                    mode="date"
                    value={draft.startDate}
                    onChange={(startDate) => setDraft((d) => withDates(d, { startDate }))}
                  />
                  {!draft.allDay ? (
                    <Picker
                      testID="group-event-editor-start-time"
                      mode="time"
                      value={draft.startTime}
                      onChange={(startTime) => set({ startTime })}
                    />
                  ) : null}
                </View>
              }
            />
            <Hair />
            <FormRow
              label={labels.ends}
              accessory={
                <View className="flex-row gap-1">
                  <Picker
                    testID="group-event-editor-end-date"
                    mode="date"
                    value={draft.endDate}
                    min={draft.startDate}
                    disabled={draft.repeat !== null}
                    onChange={(endDate) => setDraft((d) => withDates(d, { endDate }))}
                  />
                  {!draft.allDay ? (
                    <Picker
                      testID="group-event-editor-end-time"
                      mode="time"
                      value={draft.endTime}
                      onChange={(endTime) => set({ endTime })}
                    />
                  ) : null}
                </View>
              }
            />
          </FormGroup>
          {draft.repeat !== null ? (
            <Text testID="group-event-editor-one-day" className="px-4 text-[12px] text-faint">
              {labels.lastsOneDay}
            </Text>
          ) : null}
        </View>

        <RepeatControls
          start={draft.startDate}
          value={draft.repeat}
          multiDay={multiDay}
          onChange={(repeat) => set({ repeat })}
        />

        <FormGroup>
          <TextInput
            testID="group-event-editor-note"
            value={draft.note}
            onChangeText={(note) => set({ note })}
            placeholder={labels.note}
            accessibilityLabel={labels.note}
            maxLength={1000}
            multiline
            className="min-h-[72px] px-4 py-3 font-sans text-[15px] text-foreground"
            placeholderTextColor={faint}
          />
        </FormGroup>

        {state.kind === "edit" ? (
          <FormGroup>
            <Pressable
              testID="group-event-editor-delete"
              onPress={() => void remove(state.target)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={labels.deleteEvent}
              className="items-center py-3.5 active:opacity-70"
            >
              <Text className="text-[16px] text-danger">{labels.deleteEvent}</Text>
            </Pressable>
          </FormGroup>
        ) : null}
      </ScrollView>
    </View>
  );
}

/**
 * D26's page sheet for a new or changed group event. A recurring save asks which dates it applies
 * to, and warns with the count before it drops changes made to single dates (D8).
 */
export function GroupEventEditor({
  state,
  onClose,
}: {
  state: GroupEventEditorState | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={state !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {state ? <Editor key={editorKey(state)} state={state} onClose={onClose} /> : null}
    </Modal>
  );
}

const editorKey = (state: GroupEventEditorState) =>
  state.kind === "create"
    ? `create-${state.date}`
    : `edit-${state.target.event.id}-${state.target.occurrenceDate}`;
