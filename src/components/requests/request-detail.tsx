import { router, useIsFocused } from "expo-router";
import { CaretLeftIcon, DotsThreeIcon, PaperPlaneRightIcon } from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";
import { SendingBadge, StatusBadge, TypeBadge } from "@/components/requests/badges";
import { AttachmentSection } from "@/components/requests/attachments/attachment-section";
import { DetailTimeline } from "@/components/requests/detail-timeline";
import { EditRequestSheet } from "@/components/requests/edit-request-sheet";
import { askForReason } from "@/components/requests/reason-prompt";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { useStoredRequest, vacationStatusOf, type VacationStatus } from "@/lib/local-store";
import {
  ApiError,
  classifyFailure,
  useCommentVacation,
  useVacationActions,
  useVacationDetail,
  type FailureClass,
  type VacationDetail,
} from "@/lib/query";
import { dayLengthLabel, runDatesLabel } from "@/lib/requests/format";
import { mergeTimeline } from "@/lib/requests/timeline";
import { dayNumber } from "@/lib/days";

const messageOf = (failure: FailureClass) =>
  failure.kind === "signed-out" ? null : failure.message;

function Header({ right }: { right?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="h-14 flex-row items-center justify-between gap-1 px-3">
      <View className="flex-row items-center gap-1">
        <Pressable
          testID="request-detail-back"
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.requestDetail.back}
          className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        >
          <Icon icon={CaretLeftIcon} tone="foreground" size={22} weight="bold" />
        </Pressable>
        <Text className="font-display text-[19px] font-semibold text-foreground">
          {t.requestDetail.title}
        </Text>
      </View>
      {right}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-1 pb-2 text-[13px] font-semibold text-muted-foreground">{children}</Text>
  );
}

function Summary({
  from,
  to,
  type,
  status,
  length,
  sending,
}: {
  from: string;
  to: string;
  type: VacationDetail["vacationType"];
  status: VacationStatus;
  length: string;
  sending?: boolean;
}) {
  const { t } = useTranslation();
  const days = dayNumber(to) - dayNumber(from) + 1;
  return (
    <View className="gap-3 px-1">
      <View className="flex-row flex-wrap items-center gap-2">
        <TypeBadge type={type} />
        <StatusBadge status={status} />
        {sending ? <SendingBadge /> : null}
      </View>
      <View>
        <Text
          testID="request-detail-dates"
          className="font-display text-[30px] leading-[36px] font-semibold text-foreground"
          style={{ letterSpacing: -0.6 }}
        >
          {runDatesLabel({ from, to }, t.requests.runDates)} {to.slice(0, 4)}
        </Text>
        <Text className="mt-1 text-[15px] text-muted-foreground">
          {t.requests.dayCount(days)} · {length}
        </Text>
      </View>
    </View>
  );
}

function PersonCard({
  userId,
  name,
  groupName,
  lines,
}: {
  userId: string;
  name: string | null;
  groupName: string | null;
  lines: string[];
}) {
  return (
    <View testID="request-detail-person" className="gap-3 rounded-[24px] bg-card px-4 py-3.5">
      <View className="flex-row items-center gap-3">
        <PersonAvatar userId={userId} name={name} size={40} />
        <View className="flex-1">
          <Text className="text-[16px] font-semibold text-foreground" numberOfLines={1}>
            {name ?? "?"}
          </Text>
          {groupName ? (
            <Text className="text-[14px] text-muted-foreground" numberOfLines={1}>
              {groupName}
            </Text>
          ) : null}
        </View>
      </View>
      {lines.map((line) => (
        <Text key={line} className="text-[13.5px] text-faint">
          {line}
        </Text>
      ))}
    </View>
  );
}

function NoteCard({ note }: { note: string }) {
  const { t } = useTranslation();
  return (
    <View>
      <SectionLabel>{t.requestDetail.note}</SectionLabel>
      <View className="rounded-[24px] bg-card px-4 py-3.5">
        <Text testID="request-detail-note" className="text-[15.5px] leading-[22px] text-foreground">
          {note}
        </Text>
      </View>
    </View>
  );
}

function CommentComposer({ vacationId }: { vacationId: string }) {
  const { t } = useTranslation();
  const faint = useTone("faint");
  const primary = useTone("primary");
  const onPrimary = useTone("onPrimary");
  const [message, setMessage] = useState("");
  const comment = useCommentVacation(vacationId);
  const text = message.trim();

  const send = () =>
    comment.mutate(text, {
      onSuccess: () => {
        setMessage("");
        haptic("success");
      },
    });

  return (
    <View className="flex-row items-end gap-2">
      <TextInput
        testID="request-comment-input"
        accessibilityLabel={t.requestDetail.commentPlaceholder}
        value={message}
        onChangeText={setMessage}
        placeholder={t.requestDetail.commentPlaceholder}
        placeholderTextColor={faint}
        selectionColor={primary}
        multiline
        maxLength={1000}
        className="max-h-[120px] min-h-[48px] flex-1 rounded-[12px] border border-input bg-card px-4 pt-3 pb-3 font-sans text-[16px] text-foreground"
      />
      <Pressable
        testID="request-comment-send"
        onPress={send}
        disabled={text.length === 0 || comment.isPending}
        accessibilityRole="button"
        accessibilityLabel={t.requestDetail.comment}
        accessibilityState={{ disabled: text.length === 0, busy: comment.isPending }}
        className={cn(
          "h-12 w-12 items-center justify-center rounded-full bg-primary active:opacity-90",
          text.length === 0 && "opacity-40"
        )}
      >
        {comment.isPending ? (
          <ActivityIndicator color={onPrimary} />
        ) : (
          <Icon icon={PaperPlaneRightIcon} tone="onPrimary" size={18} weight="fill" />
        )}
      </Pressable>
    </View>
  );
}

function FailureNotice({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View testID="request-detail-failure" className="gap-2">
      <Notice tone="error" message={message} />
      {onRetry ? (
        <Pressable
          testID="request-detail-retry"
          onPress={onRetry}
          disabled={retrying}
          accessibilityRole="button"
          className="self-start rounded-full px-4 py-2 active:opacity-70"
        >
          <Text className="text-[14px] font-semibold text-primary">{t.request.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActionButton({
  testID,
  label,
  onPress,
  busy,
  disabled,
  className,
  textClassName,
  spinner,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
  className: string;
  textClassName: string;
  spinner: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      className={cn(
        "h-12 flex-row items-center justify-center gap-2 rounded-full px-4 active:opacity-90",
        disabled && !busy && "opacity-50",
        className
      )}
    >
      {busy ? <ActivityIndicator color={spinner} /> : null}
      <Text className={cn("text-[16px] font-semibold", textClassName)}>{label}</Text>
    </Pressable>
  );
}

type MenuItem = { label: string; onSelect: () => void; destructive?: boolean };

/** The request's own actions sit behind this menu rather than on the screen, so a stray tap starts none. */
function OptionsMenu({
  items,
  busy,
  disabled,
}: {
  items: MenuItem[];
  busy: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const labels = t.requestDetail;
  const foreground = useTone("foreground");

  const open = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...items.map((item) => item.label), labels.notNow],
        destructiveButtonIndex: items.flatMap((item, index) => (item.destructive ? [index] : [])),
        cancelButtonIndex: items.length,
      },
      (index) => items[index]?.onSelect()
    );

  return (
    <Pressable
      testID="request-detail-options"
      onPress={open}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={labels.options}
      accessibilityState={{ disabled, busy }}
      className={cn(
        "h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70",
        disabled && !busy && "opacity-50"
      )}
    >
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Icon icon={DotsThreeIcon} tone="foreground" size={22} weight="bold" />
      )}
    </Pressable>
  );
}

function DetailBody({
  detail,
  failure,
  refetching,
  onRefresh,
}: {
  detail: VacationDetail;
  /** The last read failed: what shows is an older answer, so it offers no action. */
  failure: FailureClass | null;
  refetching: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const labels = t.requestDetail;
  const primary = useTone("primary");
  const danger = useTone("danger");
  const onFill = useTone("onFill");
  const actions = useVacationActions(detail.id);
  const [editing, setEditing] = useState(false);
  // Each opening seeds the form from the detail as it stands then; a read meanwhile keeps it.
  const [editOpenings, setEditOpenings] = useState(0);

  const status = vacationStatusOf(detail);
  const busy = actions.running !== null;
  const lines = [
    detail.createdByUser && detail.createdByUser.id !== detail.userId
      ? labels.createdBy(detail.createdByUser.name)
      : null,
    detail.deletedAt && detail.deletedByUser ? labels.cancelledBy(detail.deletedByUser.name) : null,
  ].filter((line): line is string => line !== null);

  const decided = (taken: boolean) => haptic(taken ? "success" : "error");

  const approve = async () => decided(await actions.approve(detail.vacationIds));

  const decline = async () => {
    const reason = await askForReason({
      title: labels.declineTitle,
      message: labels.reasonBody,
      confirmLabel: labels.decline,
      cancelLabel: labels.notNow,
    });
    if (reason !== null) decided(await actions.reject(detail.vacationIds, reason));
  };

  const cancel = async () => {
    const reason = await askForReason({
      title: labels.cancelTitle,
      message: labels.reasonBody,
      confirmLabel: labels.cancelRequest,
      cancelLabel: labels.notNow,
    });
    if (reason !== null) decided(await actions.cancel(detail.vacationIds, reason));
  };

  const readOnly = failure !== null;
  const canDecide = !readOnly && detail.canApprove;
  const canCancel = !readOnly && detail.canCancel;
  const canEdit = !readOnly && detail.canEdit;

  const openEdit = () => {
    setEditOpenings((count) => count + 1);
    setEditing(true);
  };

  const menu: MenuItem[] = [
    ...(canEdit ? [{ label: labels.edit, onSelect: openEdit }] : []),
    ...(canCancel
      ? [{ label: labels.cancelRequest, onSelect: () => void cancel(), destructive: true }]
      : []),
  ];

  return (
    <>
      <Header
        right={
          menu.length > 0 ? (
            <OptionsMenu items={menu} busy={actions.running === "cancel"} disabled={busy} />
          ) : null
        }
      />
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          testID="request-detail"
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 24,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 32,
          }}
          refreshControl={
            <RefreshControl refreshing={refetching} tintColor={primary} onRefresh={onRefresh} />
          }
        >
          {failure ? (
            <FailureNotice
              message={
                failure.kind === "retryable"
                  ? labels.staleBody
                  : (messageOf(failure) ?? t.request.failed)
              }
              onRetry={failure.kind === "retryable" ? onRefresh : undefined}
              retrying={refetching}
            />
          ) : null}
          <Summary
            from={detail.rangeStart}
            to={detail.rangeEnd}
            type={detail.vacationType}
            status={status}
            length={dayLengthLabel(detail, {
              halfDay: t.common.halfDay,
              fullDay: t.common.fullDay,
            })}
          />
          <PersonCard
            userId={detail.user.id}
            name={detail.user.name}
            groupName={detail.groupName}
            lines={lines}
          />
          {detail.note ? <NoteCard note={detail.note} /> : null}
          <AttachmentSection detail={detail} readOnly={readOnly} />
          <View>
            <SectionLabel>{labels.history}</SectionLabel>
            <DetailTimeline entries={mergeTimeline(detail)} />
          </View>
          {readOnly ? null : <CommentComposer vacationId={detail.id} />}
        </ScrollView>
        {canDecide ? (
          <View
            testID="request-detail-actions"
            className="gap-2.5 border-t border-border bg-card px-4 pt-3 pb-safe"
          >
            <View className="flex-row gap-2.5">
              <ActionButton
                testID="request-decline"
                label={labels.decline}
                onPress={() => void decline()}
                busy={actions.running === "reject"}
                disabled={busy}
                className="flex-1 bg-danger-soft"
                textClassName="text-danger"
                spinner={danger}
              />
              <ActionButton
                testID="request-approve"
                label={labels.approve}
                onPress={() => void approve()}
                busy={actions.running === "approve"}
                disabled={busy}
                className="flex-1 bg-ok"
                textClassName="text-background"
                spinner={onFill}
              />
            </View>
            <View className="h-1" />
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {canEdit ? (
        <EditRequestSheet
          key={`${detail.id}-${editOpenings}`}
          detail={detail}
          open={editing}
          saving={actions.running === "update"}
          onClose={() => setEditing(false)}
          onSave={async (patch) => {
            const taken = await actions.update({ ids: detail.vacationIds, ...patch });
            decided(taken);
            return taken;
          }}
        />
      ) : null}
    </>
  );
}

function Gone({ title, body }: { title: string; body: string }) {
  return (
    <>
      <Header />
      <View testID="request-detail-gone" className="flex-1 items-center justify-center gap-2 px-10">
        <Text className="font-display text-center text-[20px] font-semibold text-foreground">
          {title}
        </Text>
        <Text className="text-center text-[15px] leading-[22px] text-muted-foreground">{body}</Text>
      </View>
    </>
  );
}

function Unreachable({
  vacationId,
  onRetry,
  retrying,
}: {
  vacationId: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const { t } = useTranslation();
  const stored = useStoredRequest(vacationId);
  return (
    <>
      <Header />
      <ScrollView
        testID="request-detail-offline"
        className="flex-1"
        contentContainerStyle={{ gap: 24, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
      >
        <FailureNotice
          message={t.requestDetail.offlineBody}
          onRetry={onRetry}
          retrying={retrying}
        />
        {stored ? (
          <>
            <Summary
              from={stored.from}
              to={stored.to}
              type={stored.vacationType}
              status={stored.status}
              length={dayLengthLabel(stored, {
                halfDay: t.common.halfDay,
                fullDay: t.common.fullDay,
              })}
              sending={stored.pending}
            />
            <PersonCard
              userId={stored.userId}
              name={stored.userName}
              groupName={stored.groupName}
              lines={[]}
            />
            {stored.note ? <NoteCard note={stored.note} /> : null}
          </>
        ) : null}
      </ScrollView>
    </>
  );
}

function Loading() {
  const primary = useTone("primary");
  return (
    <>
      <Header />
      <View testID="request-detail-loading" className="flex-1 items-center justify-center">
        <ActivityIndicator color={primary} />
      </View>
    </>
  );
}

/** Push notifications land here too, so a request decided, cancelled or deleted since must render. */
export function RequestDetail({ vacationId }: { vacationId: string }) {
  const { t } = useTranslation();
  const query = useVacationDetail(vacationId, { poll: useIsFocused() });

  // A request that is gone, or no longer the viewer's to see, outranks whatever was shown before.
  const refused = query.error instanceof ApiError ? query.error.status : null;
  const failure = query.isError ? classifyFailure(query.error) : null;

  let content: ReactNode;
  if (refused === 404) {
    content = <Gone title={t.requestDetail.notFound} body={t.requestDetail.notFoundBody} />;
  } else if (refused === 403) {
    content = <Gone title={t.requestDetail.forbidden} body={t.requestDetail.forbiddenBody} />;
  } else if (query.data) {
    content = (
      <DetailBody
        detail={query.data}
        failure={failure}
        refetching={query.isRefetching}
        onRefresh={() => void query.refetch()}
      />
    );
  } else if (failure?.kind === "retryable") {
    content = (
      <Unreachable
        vacationId={vacationId}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  } else if (failure) {
    content = <Gone title={t.requestDetail.failed} body={messageOf(failure) ?? t.request.failed} />;
  } else {
    content = <Loading />;
  }

  return <View className="flex-1 bg-background pt-safe">{content}</View>;
}
