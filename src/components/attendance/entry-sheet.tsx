import DateTimePicker from "@react-native-community/datetimepicker";
import {
  LockSimpleIcon,
  MoonIcon,
  WarningCircleIcon,
  WifiSlashIcon,
  XIcon,
} from "phosphor-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from "react-native";

import { ClockNotice } from "@/components/clock/clock-notice";
import { FieldLabel } from "@/components/requests/fields/field-label";
import { Icon, useTone } from "@/components/ui/icon";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import {
  dayOfPickerDate,
  entryBreaks,
  entryClosed,
  entryDirty,
  entryErrors,
  entryMessages,
  entryPreview,
  entrySave,
  entrySpan,
  formatBusinessDay,
  formatBusinessWeekday,
  formatMinutes,
  pickerDateOfDay,
  defaultTime,
  refusalMessage,
  entryWindowHint,
  useClockRead,
  useDayRead,
  useEnterSession,
  useMonthRead,
  windowStart,
  type BreakDraft,
  type EntryDraft,
  type EntryFailure,
  type TimeField,
} from "@/lib/attendance";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/days";
import { currentMonth, isoDay } from "@/lib/requests/months";
import { dateOfTime, timeOfDate } from "@/lib/requests/times";
import { useToday } from "@/lib/use-today";

import { AddRow } from "./add-row";
import { useDiscardGuard } from "./discard-guard";

type Fields = Omit<EntryDraft, "breaks">;

/**
 * The page sheet that adds an Entered session for a day the reader forgot to clock. The rules are
 * the web's entry dialog's; the backend checks them again and its refusals show here, inline.
 */
export function EntrySheet({
  openedOn,
  onClose,
  onSaved,
}: {
  openedOn: string;
  onClose: () => void;
  onSaved: (businessDate: string) => void;
}) {
  const { t, locale } = useTranslation();
  const primary = useTone("primary");
  const { view } = useClockRead();
  const state = view.kind === "ready" ? view.state : null;
  const device = useToday();
  const today = state?.businessDate ?? isoDay(currentMonth(device), device.getDate());
  const timezone = state?.timezone ?? null;

  const [fields, setFields] = useState<Fields>({
    businessDate: openedOn,
    startedAt: "",
    endedAt: "",
    nextDay: false,
  });
  const [breaks, setBreaks] = useState<BreakDraft[]>([]);
  const breakCountRef = useRef(0);
  const draft: EntryDraft = { ...fields, breaks };
  const set = (patch: Partial<Fields>) => setFields((current) => ({ ...current, ...patch }));

  const organizationId = state?.organizationId ?? null;
  const isToday = draft.businessDate === today;
  const dayRead = useDayRead(organizationId, draft.businessDate, !isToday);
  const month = useMonthRead(organizationId, draft.businessDate);
  const sessions = (isToday ? state?.sessions : dayRead.data?.sessions) ?? [];

  const window = state?.selfService;
  const earliest = window ? windowStart(today, window.days) : null;
  const errors = entryErrors(draft, { timezone, now: new Date(), today, earliest, sessions });
  const messages = entryMessages(errors, draft, t);
  const monthDay = month.data?.days.find((entry) => entry.businessDate === draft.businessDate);
  const closedBy = state
    ? entryClosed({
        window,
        active: state.active,
        employmentEnded: state.employmentEnded,
        today,
        day: monthDay ?? { businessDate: draft.businessDate, upcoming: false, exclusion: null },
      })
    : null;
  const preview = entryPreview(draft, { timezone, sessions, month: month.data });

  const { save, saving, failure } = useEnterSession();
  const button = entrySave({
    draft,
    errors,
    saving,
    closed: state === null || closedBy !== null,
    failure,
  });

  const [savedOn, setSavedOn] = useState<string | null>(null);
  useDiscardGuard(entryDirty(draft, openedOn) && savedOn === null);
  // After the guard has let go, so leaving is not asked about.
  useEffect(() => {
    if (savedOn !== null) onSaved(savedOn);
  }, [savedOn, onSaved]);

  const submit = async () => {
    const span = entrySpan(draft, timezone);
    if (!organizationId || span.startedAt === null || span.endedAt === null) return;
    const spans = entryBreaks(draft, timezone);
    const saved = await save({
      organizationId,
      businessDate: draft.businessDate,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      ...(spans.length > 0 ? { breaks: spans } : {}),
    });
    if (saved) setSavedOn(draft.businessDate);
  };

  const openAt = (target: TimeField) => () =>
    defaultTime(draft, target, { now: new Date(), timezone, today });
  const changeBreak = (id: string, patch: Partial<BreakDraft>) =>
    setBreaks((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  const addBreak = () => {
    breakCountRef.current += 1;
    const id = `new-${breakCountRef.current}`;
    setBreaks((current) => [...current, { id, startedAt: "", endedAt: "", isNew: true }]);
  };

  // A reason the field messages already give, the window's, is not said twice.
  const closedText =
    closedBy !== null && closedBy !== "SELF_SERVICE_WINDOW" ? t.entry.refusals[closedBy] : null;

  return (
    <View testID="entry-sheet" className="flex-1 bg-background">
      <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
        <Pressable
          testID="entry-cancel"
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          className="h-10 justify-center rounded-full px-3 active:opacity-70"
        >
          <Text className="text-[16px] text-primary">{t.entry.cancel}</Text>
        </Pressable>
        <Text className="font-display text-[17px] font-semibold text-foreground">
          {t.entry.title}
        </Text>
        <Pressable
          testID="entry-save"
          onPress={() => void submit()}
          disabled={!button.enabled}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !button.enabled, busy: saving }}
          className="h-10 min-w-[64px] items-center justify-center rounded-full px-3 active:opacity-70"
        >
          {saving ? (
            <ActivityIndicator color={primary} />
          ) : (
            <Text
              className={cn(
                "text-[16px] font-semibold",
                button.enabled ? "text-primary" : "text-faint"
              )}
            >
              {button.retry ? t.entry.retry : t.entry.save}
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 20, padding: 16, paddingBottom: 48 }}
      >
        {failure ? <FailureNotice failure={failure} /> : null}
        {!failure && closedText ? (
          <ClockNotice
            testID="entry-closed"
            tone="muted"
            icon={LockSimpleIcon}
            title={closedText}
          />
        ) : null}

        <View className="gap-2">
          <View className="overflow-hidden rounded-[24px] bg-card">
            <Row label={t.entry.date}>
              <DateTimePicker
                testID="entry-date"
                mode="date"
                display="compact"
                value={pickerDateOfDay(draft.businessDate)}
                minimumDate={earliest === null ? undefined : pickerDateOfDay(earliest)}
                maximumDate={pickerDateOfDay(today)}
                onValueChange={(_event, date) => set({ businessDate: dayOfPickerDate(date) })}
                accentColor={primary}
              />
            </Row>
            <Separator />
            <Row label={t.entry.start}>
              <TimeCell
                testID="entry-start"
                value={draft.startedAt}
                placeholder={t.entry.setStart}
                onChange={(startedAt) => set({ startedAt })}
                opensAt={openAt({ field: "start" })}
              />
            </Row>
            <Separator />
            <Row label={t.entry.end}>
              <TimeCell
                testID="entry-end"
                value={draft.endedAt}
                placeholder={t.entry.setEnd}
                onChange={(endedAt) => set({ endedAt })}
                opensAt={openAt({ field: "end" })}
              />
            </Row>
            <Separator />
            <Row label={t.entry.nextDay}>
              <Switch
                testID="entry-next-day"
                accessibilityLabel={t.entry.nextDay}
                value={draft.nextDay}
                onValueChange={(nextDay) => set({ nextDay })}
                trackColor={{ true: primary }}
              />
            </Row>
            {draft.nextDay ? (
              <View testID="entry-next-day-hint" className="flex-row gap-2 px-4 pb-3.5">
                <View className="pt-0.5">
                  <Icon icon={MoonIcon} tone="muted" size={13} weight="bold" />
                </View>
                <Text className="flex-1 text-[13px] leading-[18px] text-muted-foreground">
                  {t.entry.nextDayHint(
                    formatBusinessDay(addDays(draft.businessDate, 1), locale),
                    formatBusinessWeekday(draft.businessDate, locale)
                  )}
                </Text>
              </View>
            ) : null}
          </View>
          {window ? (
            <Text className="px-1 text-[12.5px] text-muted-foreground">
              {entryWindowHint(window, t)}
            </Text>
          ) : null}
          {messages.fields.map((text) => (
            <Text key={text} testID="entry-error" className="px-1 text-[13.5px] text-danger">
              {text}
            </Text>
          ))}
        </View>

        <View>
          <FieldLabel>{`${t.entry.breaks} ${t.entry.optional}`}</FieldLabel>
          <View className="overflow-hidden rounded-[24px] bg-card">
            {breaks.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <Separator /> : null}
                <BreakRow
                  index={index}
                  entry={entry}
                  message={messages.breaks[entry.id]}
                  onChange={(patch) => changeBreak(entry.id, patch)}
                  onRemove={() =>
                    setBreaks((current) => current.filter((other) => other.id !== entry.id))
                  }
                  startOpensAt={openAt({ field: "break-start", breakId: entry.id })}
                  endOpensAt={openAt({ field: "break-end", breakId: entry.id })}
                />
              </View>
            ))}
            {breaks.length > 0 ? <Separator /> : null}
            <AddRow
              testID="entry-add-break"
              label={t.entry.addBreak}
              onPress={addBreak}
              className="min-h-[52px] px-4"
            />
          </View>
        </View>

        {preview ? (
          <View testID="entry-preview" className="flex-row rounded-[16px] bg-muted px-4 py-3.5">
            {[
              { key: "presence", label: t.entry.presence, minutes: preview.presenceMinutes },
              { key: "breaks", label: t.entry.breaks, minutes: preview.breaksMinutes },
              { key: "worked", label: t.entry.worked, minutes: preview.workedMinutes },
            ].map((cell) => (
              <View key={cell.key} className="flex-1 gap-0.5">
                <Text className="text-[11px] font-bold tracking-[0.6px] text-faint uppercase">
                  {cell.label}
                </Text>
                <Text
                  testID={`entry-preview-${cell.key}`}
                  className="text-[18px] font-semibold text-foreground"
                  style={TABULAR}
                >
                  {formatMinutes(cell.minutes)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text className="px-1 text-[12.5px] leading-[17px] text-muted-foreground">
          {t.entry.ownNote}
        </Text>
      </ScrollView>
    </View>
  );
}

function FailureNotice({ failure }: { failure: EntryFailure }) {
  const { t } = useTranslation();
  if (failure.kind === "network") {
    return (
      <ClockNotice
        testID="entry-unreachable"
        tone="muted"
        icon={WifiSlashIcon}
        title={t.entry.unreachable}
        body={t.entry.unreachableBody}
      />
    );
  }
  if (failure.kind === "server") {
    return (
      <ClockNotice
        testID="entry-server-error"
        tone="danger"
        icon={WarningCircleIcon}
        title={t.entry.serverError}
        body={t.entry.serverErrorBody}
      />
    );
  }
  return (
    <ClockNotice
      testID="entry-refused"
      tone="danger"
      icon={WarningCircleIcon}
      title={refusalMessage(failure, t)}
    />
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="min-h-[52px] flex-row items-center justify-between gap-3 px-4 py-1.5">
      <Text className="text-[15.5px] text-foreground">{label}</Text>
      {children}
    </View>
  );
}

function Separator() {
  return <View className="ml-4 h-px bg-border" />;
}

/** "Set start" until first tapped, then iOS's compact picker from where `opensAt` says. */
function TimeCell({
  value,
  placeholder,
  onChange,
  opensAt,
  testID,
}: {
  value: string;
  placeholder: string;
  onChange: (time: string) => void;
  opensAt: () => string;
  testID: string;
}) {
  const primary = useTone("primary");
  if (value === "") {
    return (
      <Pressable
        testID={`${testID}-set`}
        onPress={() => onChange(opensAt())}
        accessibilityRole="button"
        className="h-9 justify-center rounded-full bg-accent px-3.5 active:opacity-70"
      >
        <Text className="text-[15px] font-semibold text-primary">{placeholder}</Text>
      </Pressable>
    );
  }
  return (
    <DateTimePicker
      testID={testID}
      mode="time"
      display="compact"
      value={dateOfTime(value)}
      onValueChange={(_event, date) => onChange(timeOfDate(date))}
      accentColor={primary}
    />
  );
}

function BreakRow({
  index,
  entry,
  message,
  onChange,
  onRemove,
  startOpensAt,
  endOpensAt,
}: {
  index: number;
  entry: BreakDraft;
  message: string | undefined;
  onChange: (patch: Partial<BreakDraft>) => void;
  onRemove: () => void;
  startOpensAt: () => string;
  endOpensAt: () => string;
}) {
  const { t } = useTranslation();
  return (
    <View testID="entry-break" className="gap-1.5 px-4 py-2.5">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-[15.5px] text-foreground">
          {t.entry.breakLabel(index + 1)}
        </Text>
        <TimeCell
          testID={`entry-break-${index + 1}-start`}
          value={entry.startedAt}
          placeholder={t.entry.setStart}
          onChange={(startedAt) => onChange({ startedAt })}
          opensAt={startOpensAt}
        />
        <Text className="text-[15px] text-faint">-</Text>
        <TimeCell
          testID={`entry-break-${index + 1}-end`}
          value={entry.endedAt}
          placeholder={t.entry.setEnd}
          onChange={(endedAt) => onChange({ endedAt })}
          opensAt={endOpensAt}
        />
        <Pressable
          testID={`entry-break-${index + 1}-remove`}
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t.entry.removeBreak}
          className="h-8 w-8 items-center justify-center rounded-full bg-muted active:opacity-70"
        >
          <Icon icon={XIcon} tone="muted" size={14} weight="bold" />
        </Pressable>
      </View>
      {message ? <Text className="text-[13px] text-danger">{message}</Text> : null}
    </View>
  );
}
