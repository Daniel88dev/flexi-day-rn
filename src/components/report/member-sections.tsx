import { Fragment, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { StatusBadge } from "@/components/requests/badges";
import { TABULAR, Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { runDatesLabel } from "@/lib/requests/format";
import {
  bookingsNewestFirst,
  formatDays,
  groupAllowance,
  keyedBookings,
  type MemberChange,
  type MemberReport,
  type ReportBooking,
} from "@/lib/report";

import { useLeaveColor } from "./leave-color";

const BOOKINGS_SHOWN = 4;
const CHANGES_SHOWN = 3;

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <View className="mt-3 flex-row items-baseline justify-between px-1">
      <Text
        accessibilityRole="header"
        className="font-display text-[19px] font-semibold text-foreground"
      >
        {title}
      </Text>
      {meta ? (
        <Text style={TABULAR} className="text-[13.5px] text-faint">
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function Card({ testID, children }: { testID?: string; children: ReactNode }) {
  return (
    <View testID={testID} className="rounded-[24px] border border-border bg-card px-4 py-1">
      {children}
    </View>
  );
}

function Divider() {
  return <View className="h-px bg-border" />;
}

function EmptyLine({ text }: { text: string }) {
  return <Text className="py-3.5 text-[14px] text-muted-foreground">{text}</Text>;
}

function ShowMore({
  testID,
  total,
  open,
  onToggle,
}: {
  testID: string;
  total: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = open ? t.report.member.showFewer : t.report.member.showAll(total);
  return (
    <>
      <Divider />
      <Pressable
        testID={testID}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        className="self-start py-3.5 active:opacity-60"
      >
        <Text className="text-[14.5px] font-semibold text-primary">{label}</Text>
      </Pressable>
    </>
  );
}

/** A card of rows that shows the first `limit` until Show all, or one line when there are none. */
function CollapsedList<T>({
  testID,
  items,
  limit,
  empty,
  keyOf,
  render,
}: {
  testID: string;
  items: T[];
  limit: number;
  empty: string;
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? items : items.slice(0, limit);
  return (
    <Card>
      {items.length === 0 ? <EmptyLine text={empty} /> : null}
      {shown.map((item, index) => (
        <Fragment key={keyOf(item)}>
          {index > 0 ? <Divider /> : null}
          {render(item)}
        </Fragment>
      ))}
      {items.length > limit ? (
        <ShowMore
          testID={testID}
          total={items.length}
          open={open}
          onToggle={() => setOpen(!open)}
        />
      ) : null}
    </Card>
  );
}

function QuotaRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      className="flex-row items-center justify-between gap-3 py-3"
    >
      <Text className="flex-1 text-[15px] text-foreground">{label}</Text>
      <Text style={TABULAR} className="text-[15px] font-semibold text-foreground">
        {value}
      </Text>
    </View>
  );
}

/** Each group's allowance as the backend applies it, group defaults included. */
export function MemberQuotas({ report }: { report: MemberReport }) {
  const { t } = useTranslation();
  const labels = t.report.member;
  const days = (value: number) => formatDays(value, t.common.decimalSeparator);

  return (
    <View testID="member-quotas" className="gap-2.5">
      <SectionHeader title={labels.quotas} meta={String(report.year)} />
      {report.groups.map((group) => {
        const allowance = groupAllowance(report.summary, report.member.id, group.groupId);
        const rows: [string, number][] = [
          [labels.vacationDays, allowance.vacationDays],
          [labels.carriedOver, allowance.carriedOverDays],
          [labels.homeOfficeDays, allowance.homeOfficeDays],
        ];
        if (allowance.sickDays !== null) rows.push([labels.sickDays, allowance.sickDays]);
        return (
          <Card key={group.groupId} testID={`quota-group-${group.groupId}`}>
            <Text className="pt-3 text-[13.5px] font-semibold text-muted-foreground">
              {group.groupName}
            </Text>
            {rows.map(([label, value], index) => (
              <Fragment key={label}>
                {index > 0 ? <Divider /> : null}
                <QuotaRow label={label} value={days(value)} />
              </Fragment>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function BookingRow({ booking }: { booking: ReportBooking }) {
  const { t } = useTranslation();
  const color = useLeaveColor(booking.vacationType);
  const dates = runDatesLabel(booking, t.requests.runDates);
  const detail = [t.recordTypes[booking.vacationType], booking.note].filter(Boolean).join(", ");
  const days = formatDays(booking.days, t.common.decimalSeparator);

  return (
    <View
      accessible
      accessibilityLabel={[
        dates,
        detail,
        `${days} ${t.report.days(booking.days)}`,
        t.status[booking.status],
      ].join(", ")}
      className="flex-row items-center gap-3 py-3"
    >
      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: color }} />
      <View className="flex-1">
        <Text className="text-[16px] font-semibold text-foreground">{dates}</Text>
        <Text numberOfLines={1} className="mt-0.5 text-[13.5px] text-muted-foreground">
          {detail}
        </Text>
      </View>
      <Text style={TABULAR} className="text-[14px] text-muted-foreground">
        {t.report.daysShort(days)}
      </Text>
      <StatusBadge status={booking.status} />
    </View>
  );
}

/** The person's bookings in the answer's year, latest first, the rest behind Show all. */
export function MemberBookings({ report }: { report: MemberReport }) {
  const { t } = useTranslation();
  const labels = t.report.member;
  const bookings = keyedBookings(bookingsNewestFirst(report.bookings));

  return (
    <View testID="member-bookings" className="gap-2.5">
      <SectionHeader
        title={labels.bookings}
        meta={bookings.length > 0 ? labels.bookingsCount(bookings.length, report.year) : undefined}
      />
      <CollapsedList
        testID="member-bookings-more"
        items={bookings}
        limit={BOOKINGS_SHOWN}
        empty={labels.bookingsEmpty(report.year)}
        keyOf={(entry) => entry.key}
        render={(entry) => <BookingRow booking={entry.booking} />}
      />
    </View>
  );
}

function ChangeRow({ change }: { change: MemberChange }) {
  const { t } = useTranslation();
  const labels = t.report.member;
  const date = new Date(change.createdAt).toLocaleDateString(t.common.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  // The server sends no actor for the year rollover, and none for an admin since deleted.
  const by = change.actor
    ? labels.byPerson(change.actor.name)
    : change.actorDeleted
      ? labels.byDeletedAccount
      : labels.byFlexiDay;

  return (
    <View accessible accessibilityLabel={`${change.changeDetail}, ${date}, ${by}`} className="py-3">
      <Text className="text-[15px] leading-[20px] text-foreground">{change.changeDetail}</Text>
      <Text className="mt-1 text-[13px] text-faint">{`${date}, ${by}`}</Text>
    </View>
  );
}

/** Who changed the person's allowance this year, newest first as the server sends it. */
export function MemberChanges({ report }: { report: MemberReport }) {
  const { t } = useTranslation();
  const labels = t.report.member;

  return (
    <View testID="member-changes" className="gap-2.5">
      <SectionHeader title={labels.changes} />
      <CollapsedList
        testID="member-changes-more"
        items={report.changes}
        limit={CHANGES_SHOWN}
        empty={labels.changesEmpty(report.year)}
        keyOf={(change) => change.id}
        render={(change) => <ChangeRow change={change} />}
      />
    </View>
  );
}
