import { Stack, router, useIsFocused } from "expo-router";
import { CaretUpDownIcon } from "phosphor-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { toast } from "sonner-native";

import { AttachmentsHeading } from "@/components/requests/attachments/attachment-section";
import { AttachmentUploader } from "@/components/requests/attachments/attachment-uploader";
import { SentPanel } from "@/components/requests/attachments/sent-panel";
import { DatesField } from "@/components/requests/fields/dates-field";
import { HalfDayField } from "@/components/requests/fields/half-day-field";
import { NoteField } from "@/components/requests/fields/note-field";
import { TimesField } from "@/components/requests/fields/times-field";
import { TypeField } from "@/components/requests/fields/type-field";
import { showGroupPicker } from "@/components/ui/group-picker";
import { Icon, useTone } from "@/components/ui/icon";
import { showMemberPicker } from "@/components/ui/member-picker";
import { Notice } from "@/components/ui/notice";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { useMemberGroups } from "@/lib/local-store";
import {
  ApiError,
  useCreateRequest,
  useGroupDetail,
  useGroupMembers,
  useOnline,
  useVacationDetail,
} from "@/lib/query";
import { MAX_ATTACHMENTS_PER_REQUEST, formUploadsVerdict } from "@/lib/requests/attachments";
import {
  bookableMembers,
  bookableWindow,
  canSubmit,
  newRequestDraft,
  newRequestValues,
  offersHalfDay,
  openingRange,
  shownType,
  submitFailureMessage,
  withFrom,
  type NewRequestValues,
} from "@/lib/requests/new-request";
import { useAttachmentUploads } from "@/lib/requests/use-attachment-uploads";
import { useNow } from "@/lib/use-now";
import { useToday } from "@/lib/use-today";
import { useViewer } from "@/lib/viewer/use-viewer";

function PickerRow({
  label,
  value,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 active:opacity-70"
    >
      <Text className="text-[15.5px] text-foreground">{label}</Text>
      <View className="shrink flex-row items-center gap-1.5">
        <Text className="shrink text-[15.5px] text-muted-foreground" numberOfLines={1}>
          {value}
        </Text>
        {onPress ? <Icon icon={CaretUpDownIcon} tone="faint" size={14} weight="bold" /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Booking waits for the server: the rows show in the lists as the write goes out, and a failure
 * keeps the sheet open with the entry as it was and the reason above it.
 */
export function NewRequestForm({ date, end }: { date?: string; end?: string }) {
  const { t } = useTranslation();
  const labels = t.newRequest;
  const primary = useTone("primary");
  const viewerId = useViewer()?.id ?? null;
  const online = useOnline();
  const scrollRef = useRef<ScrollView>(null);

  const today = useToday();
  const bookable = bookableWindow(today);
  const [values, setValues] = useState<NewRequestValues>(() => {
    const { from, to } = openingRange(date, end, today);
    return newRequestValues(from, to);
  });
  const [error, setError] = useState<string | null>(null);

  const groups = useMemberGroups();
  const group = groups.find((candidate) => candidate.groupId === values.groupId) ?? groups[0];
  const groupId = group?.groupId ?? null;

  const groupDetail = useGroupDetail(groupId);
  const canAdmin = groupDetail.data?.access?.canAdmin === true;
  const offerSickDay = groupDetail.data?.organization?.sickDayBenefitActive === true;
  const membersRead = useGroupMembers(canAdmin ? groupId : null);
  const members = bookableMembers(membersRead.data ?? [], viewerId);
  const member = members.find((candidate) => candidate.userId === values.memberId) ?? null;

  const { submitting, submit } = useCreateRequest();

  const [created, setCreated] = useState<{ requestId: string; vacationId: string } | null>(null);
  const createdDetail = useVacationDetail(created?.vacationId ?? null, { poll: useIsFocused() });
  const uploads = useAttachmentUploads({
    requestId: created?.requestId ?? null,
    attachments: createdDetail.data?.attachments ?? [],
  });
  const offerAttachments = groupDetail.data?.uploadsAvailable === true;
  const now = useNow(30_000);
  const verdict = created
    ? formUploadsVerdict(uploads, createdDetail.data?.attachments, uploads.failedIds, now)
    : null;
  const closedRef = useRef(false);
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    router.back();
  };

  // Closes on the upload that settles the last file, never on a dismissal that leaves the list
  // clean: that would pull the sheet away under the finger.
  const settlingRef = useRef(false);
  useEffect(() => {
    if (verdict === "clean" && settlingRef.current) close();
    settlingRef.current = verdict === "settling";
  });

  const resolved: NewRequestValues = { ...values, groupId, memberId: member?.userId ?? null };
  // Only a group read that got no answer means the server is out of reach. Any answer, a 5xx
  // included, leaves Submit to the server, as the web never gates it on this read.
  const unreachable = !online || (groupDetail.isError && !(groupDetail.error instanceof ApiError));
  const ready = canSubmit(resolved, { offerSickDay }) && !unreachable && !submitting;
  const type = shownType(values.vacationType, { offerSickDay });

  const set = (patch: Partial<NewRequestValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const pickGroup = () =>
    showGroupPicker({ title: labels.group, groups, cancelLabel: labels.cancel }, (scope) => {
      if (scope.kind !== "group" || scope.groupId === groupId) return;
      // The member, and a Sick day, belonged to the group being left.
      // So do the picked files: the new group may not take uploads.
      uploads.reset();
      setValues((current) => ({
        ...current,
        groupId: scope.groupId,
        memberId: null,
        autoApprove: true,
        vacationType: current.vacationType === "SICK_DAY" ? "VACATION" : current.vacationType,
      }));
    });

  const pickMember = () =>
    showMemberPicker(
      {
        title: labels.forMember,
        members,
        myselfLabel: labels.myself,
        cancelLabel: labels.cancel,
      },
      // As on the web, only going back to Myself turns approve-immediately on again.
      (memberId) => set(memberId === null ? { memberId, autoApprove: true } : { memberId })
    );

  const send = async () => {
    if (!ready) return;
    setError(null);
    const outcome = await submit(newRequestDraft(resolved, { canAdmin, offerSickDay }));
    if (outcome.ok) {
      haptic("success");
      if (outcome.created && uploads.queued > 0) {
        uploads.start(outcome.created.requestId);
        setCreated(outcome.created);
        return;
      }
      if (uploads.queued > 0) toast.error(labels.filesNotSent);
      close();
      return;
    }
    haptic("error");
    setError(submitFailureMessage(outcome, t));
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <View testID="new-request" className="flex-1 bg-background">
      <Stack.Screen options={{ gestureEnabled: !submitting }} />
      <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
        {created ? (
          <>
            <View className="min-w-[72px]" />
            <Text className="font-display text-[17px] font-semibold text-foreground">
              {labels.title}
            </Text>
            <Pressable
              testID="new-request-done"
              onPress={close}
              hitSlop={8}
              accessibilityRole="button"
              className="h-10 min-w-[72px] items-center justify-center rounded-full px-3 active:opacity-70"
            >
              <Text className="text-[16px] font-semibold text-primary">{labels.done}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              testID="new-request-cancel"
              onPress={() => router.back()}
              disabled={submitting}
              hitSlop={8}
              accessibilityRole="button"
              className="h-10 justify-center rounded-full px-3 active:opacity-70"
            >
              <Text className={cn("text-[16px]", submitting ? "text-faint" : "text-primary")}>
                {labels.cancel}
              </Text>
            </Pressable>
            <Text className="font-display text-[17px] font-semibold text-foreground">
              {labels.title}
            </Text>
            <Pressable
              testID="new-request-submit"
              onPress={() => void send()}
              disabled={!ready}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityState={{ disabled: !ready, busy: submitting }}
              className="h-10 min-w-[72px] items-center justify-center rounded-full px-3 active:opacity-70"
            >
              {submitting ? (
                <ActivityIndicator color={primary} />
              ) : (
                <Text
                  className={cn("text-[16px] font-semibold", ready ? "text-primary" : "text-faint")}
                >
                  {labels.submit}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </View>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // A padding KeyboardAvoidingView measures from the screen, not the page sheet, and
        // leaves the note under the keyboard.
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ gap: 24, padding: 16, paddingBottom: 48 }}
      >
        {created && verdict ? (
          <SentPanel
            verdict={verdict}
            uploads={uploads}
            readFailed={createdDetail.isError}
            retrying={createdDetail.isFetching}
            onRetry={() => void createdDetail.refetch()}
          />
        ) : null}
        {created ? null : (
          <>
            {error ? (
              <View testID="new-request-error" accessibilityLiveRegion="polite">
                <Notice tone="error" message={error} />
              </View>
            ) : null}
            {unreachable ? (
              <View testID="new-request-offline">
                <Notice
                  tone="error"
                  message={labels.offline}
                  action={{
                    label: labels.retry,
                    onPress: () => void groupDetail.refetch(),
                    testID: "new-request-retry",
                  }}
                />
              </View>
            ) : null}
            {group ? null : <Notice tone="accent" message={labels.noGroups} />}

            {group ? (
              <View>
                <View className="overflow-hidden rounded-[24px] bg-card">
                  <PickerRow
                    testID="new-request-group"
                    label={labels.group}
                    value={group.groupName}
                    onPress={groups.length > 1 && !submitting ? pickGroup : undefined}
                  />
                  {canAdmin ? (
                    <>
                      <View className="ml-4 h-px bg-border" />
                      <PickerRow
                        testID="new-request-member"
                        label={labels.forMember}
                        value={member?.user.name ?? labels.myself}
                        onPress={members.length > 0 && !submitting ? pickMember : undefined}
                      />
                    </>
                  ) : null}
                  {member ? (
                    <>
                      <View className="ml-4 h-px bg-border" />
                      <View className="min-h-[52px] flex-row items-center justify-between px-4">
                        <Text className="text-[15.5px] text-foreground">
                          {labels.approveImmediately}
                        </Text>
                        <Switch
                          testID="new-request-auto-approve"
                          accessibilityLabel={labels.approveImmediately}
                          value={values.autoApprove}
                          onValueChange={(autoApprove) => set({ autoApprove })}
                          trackColor={{ true: primary }}
                        />
                      </View>
                    </>
                  ) : null}
                </View>
                {member ? (
                  <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">
                    {labels.approveImmediatelyHint}
                  </Text>
                ) : null}
                {canAdmin && membersRead.isError ? (
                  <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">
                    {labels.membersFailed}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <DatesField
              from={values.from}
              to={values.to}
              window={bookable}
              onFrom={(from) => setValues((current) => withFrom(current, from))}
              onTo={(to) => set({ to })}
            />
            <TypeField
              value={type}
              onChange={(vacationType) => set({ vacationType })}
              offerSickDay={offerSickDay}
            />
            <TimesField
              startTime={values.startTime}
              endTime={values.endTime}
              onChange={(times) => set(times)}
            />
            {offersHalfDay(values) ? (
              <HalfDayField value={values.halfDay} onChange={(halfDay) => set({ halfDay })} />
            ) : null}
            <NoteField
              value={values.note}
              onChange={(note) => set({ note })}
              required={type === "OTHER"}
              scrollRef={scrollRef}
            />
            {offerAttachments ? (
              <View testID="new-request-attachments">
                <AttachmentsHeading used={MAX_ATTACHMENTS_PER_REQUEST - uploads.remaining} />
                <View className="overflow-hidden rounded-[24px] bg-card">
                  <AttachmentUploader uploads={uploads} disabled={submitting} />
                </View>
                <Text className="px-4 pt-2 text-[12.5px] leading-[18px] text-faint">
                  {t.attachments.visibilityNotice}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
