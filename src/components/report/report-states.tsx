import {
  ChartBarIcon,
  CloudSlashIcon,
  LockSimpleIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { deviceUses24HourClock } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { formatKeptAt } from "@/lib/report";
import { useToday } from "@/lib/use-today";

const COLUMNS = [38, 62, 20, 84, 50, 30, 96, 70, 44, 24, 58, 36];
const ROWS = [0.9, 0.75, 0.6, 0.45];

function Bone({ className, width }: { className?: string; width?: `${number}%` }) {
  return (
    <View
      style={width ? { width } : undefined}
      className={cn("rounded-full bg-muted", className)}
    />
  );
}

export function ReportSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      testID="report-loading"
      accessible
      accessibilityLabel={t.report.loading}
      className="gap-4 px-4 pt-2"
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
          {COLUMNS.map((height) => (
            <View key={height} style={{ height, width: 13 }} className="rounded-t-[4px] bg-muted" />
          ))}
        </View>
      </View>
      <View className="gap-3.5 rounded-[24px] border border-border bg-card p-4">
        <Bone className="h-4 w-1/3" />
        {ROWS.map((share) => (
          <View key={share} className="flex-row items-center gap-3">
            <Bone className="h-3 w-[70px]" />
            <Bone className="h-3" width={`${share * 60}%`} />
          </View>
        ))}
      </View>
    </View>
  );
}

export function MemberSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      testID="report-loading"
      accessible
      accessibilityLabel={t.report.loading}
      className="gap-3.5 px-4 pt-1"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-[52px] w-[52px] rounded-full bg-muted" />
        <View className="flex-1 gap-2">
          <Bone className="h-5 w-1/2" />
          <Bone className="h-3 w-1/3" />
        </View>
      </View>
      <Bone className="h-9 w-[132px]" />
      <View className="rounded-[24px] border border-border bg-card p-4">
        <Bone className="h-4 w-1/3" />
        <Bone className="mt-4 h-9 w-1/2" />
        <View className="mt-4 flex-row justify-between">
          {ROWS.map((share) => (
            <Bone key={share} className="h-3" width={`${share * 20}%`} />
          ))}
        </View>
        <View className="mt-5 h-[110px] flex-row items-end justify-between px-6">
          {COLUMNS.map((height) => (
            <View
              key={height}
              style={{ height: height * 0.8, width: 13 }}
              className="rounded-t-[4px] bg-muted"
            />
          ))}
        </View>
      </View>
      <View className="rounded-[24px] border border-border bg-card p-4">
        <Bone className="h-4 w-1/3" />
        <Bone className="mt-4 h-9 w-2/5" />
      </View>
    </View>
  );
}

function StateScreen({
  testID,
  icon,
  tinted,
  title,
  body,
  children,
}: {
  testID: string;
  icon: PhosphorIcon;
  tinted: boolean;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View testID={testID} className="flex-1 items-start justify-center px-8 pb-24">
      <View
        className={cn(
          "mb-5 h-14 w-14 items-center justify-center rounded-[16px]",
          tinted ? "bg-accent" : "bg-muted"
        )}
      >
        <Icon icon={icon} tone={tinted ? "primary" : "muted"} size={28} />
      </View>
      <Text className="font-display text-[24px] font-semibold text-foreground">{title}</Text>
      <Text className="mt-2 text-[15px] leading-[21px] text-muted-foreground">{body}</Text>
      {children}
    </View>
  );
}

export function ReportEmpty() {
  const { t } = useTranslation();
  return (
    <StateScreen
      testID="report-empty"
      icon={ChartBarIcon}
      tinted
      title={t.report.empty}
      body={t.report.emptyBody}
    />
  );
}

/** The person's report answered 403 or 404: they are outside every group the viewer may read. */
export function ReportForbidden() {
  const { t } = useTranslation();
  return (
    <StateScreen
      testID="report-forbidden"
      icon={LockSimpleIcon}
      tinted={false}
      title={t.report.forbidden}
      body={t.report.forbiddenBody}
    />
  );
}

/**
 * The first read failed and the phone keeps no report of its own, so there is nothing to show.
 * `controls` are the chips the person moved to get here, so they can move them back.
 */
export function ReportOffline({
  onRetry,
  controls,
}: {
  onRetry: () => void;
  controls?: ReactNode;
}) {
  const { t } = useTranslation();
  const state = (
    <StateScreen
      testID="report-offline"
      icon={CloudSlashIcon}
      tinted={false}
      title={t.report.offline}
      body={t.report.offlineBody}
    >
      <Pressable
        testID="report-retry"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.report.retry}
        className="mt-6 h-12 items-center justify-center rounded-full bg-primary px-7 active:opacity-90"
      >
        <Text className="text-[15px] font-semibold text-primary-foreground">{t.report.retry}</Text>
      </Pressable>
    </StateScreen>
  );
  if (!controls) return state;
  return (
    <View className="flex-1">
      {controls}
      {state}
    </View>
  );
}

/** A reread failed over a kept answer: the screen keeps it and says how old it is. */
export function ReportStale({ since, onRetry }: { since: Date; onRetry: () => void }) {
  const { t } = useTranslation();
  const today = useToday();
  const time = formatKeptAt(since, today, t.common.locale, deviceUses24HourClock());
  return (
    <View
      testID="report-stale"
      className="flex-row items-center gap-3 rounded-[16px] bg-muted px-3.5 py-3"
    >
      <Icon icon={CloudSlashIcon} tone="muted" size={20} />
      <Text className="flex-1 text-[13.5px] leading-[19px] text-muted-foreground">
        {t.report.stale(time)}
      </Text>
      <Pressable
        testID="report-stale-retry"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.report.retry}
        hitSlop={8}
        className="active:opacity-60"
      >
        <Text className="text-[14px] font-semibold text-primary">{t.report.retry}</Text>
      </Pressable>
    </View>
  );
}

/** The prior year's half of a window failed, so its months read as empty when they may not be. */
export function IncompleteNote({ year, onRetry }: { year: number; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View
      testID="report-incomplete"
      className="flex-row items-center gap-3 rounded-[16px] bg-warm-soft px-3.5 py-3"
    >
      <Text className="flex-1 text-[13.5px] leading-[19px] text-warm">
        {t.report.incomplete(year)}
      </Text>
      <Pressable
        testID="report-incomplete-retry"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.report.retry}
        hitSlop={8}
        className="active:opacity-60"
      >
        <Text className="text-[14px] font-semibold text-warm">{t.report.retry}</Text>
      </Pressable>
    </View>
  );
}
