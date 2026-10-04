import { ChartBarIcon, CloudSlashIcon, type Icon as PhosphorIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

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

/** The first read failed and the phone keeps no report of its own, so there is nothing to show. */
export function ReportOffline({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
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
}
