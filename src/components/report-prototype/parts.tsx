// PROTOTYPE (T-143, prototype/report): small shared pieces of the report design.
import { CaretDownIcon, CheckIcon, CloudSlashIcon, CircleIcon } from "phosphor-react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { BottomSheet } from "@/components/calendar/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import type { UserSummary } from "./types";

export function Avatar({ user, size = 32 }: { user: UserSummary; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: user.avatarColor,
      }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.38, color: "#fff" }} className="font-semibold">
        {user.initials}
      </Text>
    </View>
  );
}

export function Card({
  children,
  testID,
  className,
}: {
  children: ReactNode;
  testID?: string;
  className?: string;
}) {
  return (
    <View
      testID={testID}
      className={cn("rounded-[24px] border border-border bg-card p-4", className)}
    >
      {children}
    </View>
  );
}

export function CardTitle({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: string;
  right?: ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text className="font-display text-[16px] font-semibold text-foreground">{title}</Text>
        {meta ? <Text className="mt-0.5 text-[12.5px] text-faint">{meta}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View className="flex-row items-baseline justify-between px-1 pt-2 pb-2">
      <Text className="font-display text-[17px] font-semibold text-foreground">{title}</Text>
      {meta ? <Text className="text-[13px] text-faint">{meta}</Text> : null}
    </View>
  );
}

export function FilterChip({
  label,
  active,
  onPress,
  testID,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  count?: number;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        "h-9 flex-row items-center gap-1.5 rounded-full border pr-3 pl-3.5 active:opacity-70",
        active ? "border-transparent bg-accent" : "border-border bg-card"
      )}
    >
      <Text className={cn("text-[14px] font-medium", active ? "text-primary" : "text-foreground")}>
        {label}
      </Text>
      {count ? (
        <View className="h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1">
          <Text className="text-[11px] font-bold text-primary-foreground">{count}</Text>
        </View>
      ) : null}
      <Icon icon={CaretDownIcon} tone={active ? "primary" : "muted"} size={13} weight="bold" />
    </Pressable>
  );
}

export type Option = { value: string; label: string; hint?: string; leading?: ReactNode };

/** One sheet for every filter: a single pick shows a radio, several picks a check. */
export function OptionSheet({
  open,
  onClose,
  title,
  options,
  selected,
  onChange,
  multiple,
  allLabel,
  testID,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple: boolean;
  allLabel?: string;
  testID: string;
}) {
  const toggle = (value: string) => {
    if (!multiple) {
      onChange([value]);
      onClose();
      return;
    }
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next.length === options.length ? [] : next);
  };
  const rows: (Option & { all?: true })[] = allLabel
    ? [{ value: "__all", label: allLabel, all: true }, ...options]
    : options;
  return (
    <BottomSheet open={open} onClose={onClose} closeLabel="Close" testID={testID}>
      <View className="flex-row items-center justify-between px-5 pt-1 pb-2">
        <Text className="font-display text-[18px] font-semibold text-foreground">{title}</Text>
        {multiple ? (
          <Pressable testID={`${testID}-done`} onPress={onClose} hitSlop={8}>
            <Text className="text-[15px] font-semibold text-primary">Done</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView className="px-3" contentContainerStyle={{ paddingBottom: 16 }}>
        {rows.map((row) => {
          const on = row.all ? selected.length === 0 : selected.includes(row.value);
          return (
            <Pressable
              key={row.value}
              testID={`${testID}-${row.all ? "all" : row.value}`}
              onPress={() => (row.all ? onChange([]) : toggle(row.value))}
              accessibilityRole={multiple ? "checkbox" : "radio"}
              accessibilityState={{ checked: on }}
              className="min-h-[52px] flex-row items-center gap-3 rounded-[16px] px-2 py-2.5 active:bg-muted"
            >
              {row.leading}
              <View className="flex-1">
                <Text
                  className={cn(
                    "text-[15.5px]",
                    row.all ? "font-semibold text-foreground" : "text-foreground"
                  )}
                >
                  {row.label}
                </Text>
                {row.hint ? <Text className="text-[12.5px] text-faint">{row.hint}</Text> : null}
              </View>
              {on ? (
                <Icon icon={CheckIcon} tone="primary" size={19} weight="bold" />
              ) : multiple ? null : (
                <Icon icon={CircleIcon} tone="faint" size={19} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

export function StatPair({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <View className="flex-1">
      <Text className="text-[12px] text-faint">{label}</Text>
      <Text
        style={{ fontVariant: ["tabular-nums"] }}
        className={cn(
          "mt-0.5 text-[16px] font-semibold",
          tone === "danger" ? "text-danger" : "text-foreground"
        )}
      >
        {value}
      </Text>
    </View>
  );
}

export function StatusPill({ status }: { status: "approved" | "pending" | "rejected" }) {
  const look = {
    approved: { s: "bg-ok-soft", t: "text-ok", l: "Approved" },
    pending: { s: "bg-warm-soft", t: "text-warm", l: "Pending" },
    rejected: { s: "bg-danger-soft", t: "text-danger", l: "Rejected" },
  }[status];
  return (
    <View className={cn("rounded-full px-2 py-0.5", look.s)}>
      <Text className={cn("text-[11.5px] font-semibold", look.t)}>{look.l}</Text>
    </View>
  );
}

export function Bone({ className, style }: { className?: string; style?: object }) {
  return <View style={style} className={cn("rounded-full bg-muted", className)} />;
}

export function ReportSkeleton() {
  return (
    <View
      testID="report-loading"
      className="gap-4 px-4 pt-2"
      accessibilityLabel="Loading the report"
    >
      <View className="flex-row gap-2">
        <Bone className="h-9 w-[132px]" />
        <Bone className="h-9 w-[104px]" />
        <Bone className="h-9 w-[112px]" />
      </View>
      <View className="rounded-[24px] border border-border bg-card p-4">
        <Bone className="h-4 w-2/5" />
        <Bone className="mt-2 h-3 w-1/3" />
        <View className="mt-5 h-[130px] flex-row items-end justify-between px-6">
          {[38, 62, 20, 84, 50, 30, 96, 70, 44, 24, 58, 36].map((h, i) => (
            <View key={i} style={{ height: h, width: 13 }} className="rounded-t-[4px] bg-muted" />
          ))}
        </View>
      </View>
      <View className="gap-3.5 rounded-[24px] border border-border bg-card p-4">
        <Bone className="h-4 w-1/3" />
        {[0.9, 0.75, 0.6, 0.45].map((w, i) => (
          <View key={i} className="flex-row items-center gap-3">
            <Bone className="h-3 w-[70px]" />
            <Bone className="h-3" style={{ width: `${w * 60}%` }} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function OfflineCold({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="report-offline" className="flex-1 items-start justify-center px-8 pb-24">
      <View className="mb-5 h-14 w-14 items-center justify-center rounded-[16px] bg-muted">
        <Icon icon={CloudSlashIcon} tone="muted" size={28} />
      </View>
      <Text className="font-display text-[24px] font-semibold text-foreground">
        Can&apos;t reach the server
      </Text>
      <Text className="mt-2 text-[15px] leading-[21px] text-muted-foreground">
        The report is read from Flexi Day each time and isn&apos;t kept on this phone. Connect and
        try again.
      </Text>
      <Pressable
        testID="report-retry"
        onPress={onRetry}
        accessibilityRole="button"
        className="mt-6 h-12 items-center justify-center rounded-full bg-primary px-7 active:opacity-90"
      >
        <Text className="text-[15px] font-semibold text-primary-foreground">Retry</Text>
      </Pressable>
    </View>
  );
}

export function StaleNotice({ since, onRetry }: { since: Date; onRetry: () => void }) {
  const at = `${String(since.getHours()).padStart(2, "0")}:${String(since.getMinutes()).padStart(2, "0")}`;
  return (
    <View
      testID="report-stale"
      className="flex-row items-center gap-3 rounded-[16px] bg-muted px-4 py-3"
    >
      <Icon icon={CloudSlashIcon} tone="muted" size={18} />
      <Text className="flex-1 text-[13.5px] leading-[19px] text-muted-foreground">
        Offline. Showing the report as of {at}.
      </Text>
      <Pressable
        testID="report-stale-retry"
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text className="text-[13.5px] font-semibold text-primary">Retry</Text>
      </Pressable>
    </View>
  );
}

export function IncompleteNote({ year, onRetry }: { year: number; onRetry: () => void }) {
  return (
    <View
      testID="report-incomplete"
      className="mb-3 flex-row items-center gap-3 rounded-[12px] bg-warm-soft px-3 py-2.5"
    >
      <Text className="flex-1 text-[13px] leading-[18px] text-warm">
        {year} didn&apos;t load, so its months show no leave yet.
      </Text>
      <Pressable
        testID="report-incomplete-retry"
        onPress={onRetry}
        hitSlop={8}
        accessibilityRole="button"
      >
        <Text className="text-[13px] font-semibold text-warm">Retry</Text>
      </Pressable>
    </View>
  );
}

/** The prototype's own switcher, dev builds only, never part of the design being judged. */
export function ProtoBar({
  proto,
}: {
  proto: { bar: boolean; variant: "A" | "B"; demo: boolean; layout: "split" | "merged" };
}) {
  if (!__DEV__ || !proto.bar) return null;
  const pill = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      className="h-8 justify-center rounded-full px-2.5"
      style={{ backgroundColor: on ? "#ffffff" : "transparent" }}
    >
      <Text className="text-[12.5px] font-semibold" style={{ color: on ? "#16151c" : "#ffffff" }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 bottom-0 left-0 items-center pb-safe"
    >
      <View
        className="mb-3 flex-row items-center gap-1 rounded-full px-1.5 py-1.5"
        style={{ backgroundColor: "#16151c" }}
      >
        {pill(
          "Chips",
          proto.variant === "A",
          () => router.setParams({ variant: "A" }),
          "proto-variant-A"
        )}
        {pill(
          "Sheet",
          proto.variant === "B",
          () => router.setParams({ variant: "B" }),
          "proto-variant-B"
        )}
        <View style={{ width: 1, height: 18, backgroundColor: "#ffffff40" }} />
        {pill("Live", !proto.demo, () => router.setParams({ data: "live" }), "proto-data-live")}
        {pill("Demo", proto.demo, () => router.setParams({ data: "demo" }), "proto-data-demo")}
        <View style={{ width: 1, height: 18, backgroundColor: "#ffffff40" }} />
        {pill(
          "Chart",
          proto.layout === "split",
          () => router.setParams({ layout: "split" }),
          "proto-layout-split"
        )}
        {pill(
          "List",
          proto.layout === "merged",
          () => router.setParams({ layout: "merged" }),
          "proto-layout-merged"
        )}
      </View>
    </View>
  );
}
