import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { CalendarRecordType, VacationStatus } from "@/lib/local-store";

const STATUS_CLASSES: Record<VacationStatus, { badge: string; text: string }> = {
  pending: { badge: "bg-warm-soft", text: "text-warm" },
  approved: { badge: "bg-ok-soft", text: "text-ok" },
  rejected: { badge: "bg-danger-soft", text: "text-danger" },
  cancelled: { badge: "bg-muted", text: "text-muted-foreground" },
};

const TYPE_CLASSES: Record<CalendarRecordType, { fill: string; text: string }> = {
  VACATION: { fill: "bg-leave-vacation", text: "text-leave-vacation" },
  HOME_OFFICE: { fill: "bg-leave-home", text: "text-leave-home" },
  SICK: { fill: "bg-leave-sick", text: "text-leave-sick" },
  SICK_DAY: { fill: "bg-leave-sickday", text: "text-leave-sickday" },
  PAID_TIME_OFF: { fill: "bg-leave-pto", text: "text-leave-pto" },
  NON_PAID_LEAVE: { fill: "bg-leave-nonpaid", text: "text-leave-nonpaid" },
  STUDY_LEAVE: { fill: "bg-leave-study", text: "text-leave-study" },
  BANK_HOLIDAY: { fill: "bg-leave-bank", text: "text-leave-bank" },
  OTHER: { fill: "bg-leave-other", text: "text-leave-other" },
};

export function StatusBadge({ status }: { status: VacationStatus }) {
  const { t } = useTranslation();
  const classes = STATUS_CLASSES[status];
  return (
    <View className={cn("rounded-full px-2.5 py-1", classes.badge)}>
      <Text className={cn("text-[12px] font-semibold", classes.text)}>{t.status[status]}</Text>
    </View>
  );
}

export function TypeBadge({ type }: { type: CalendarRecordType }) {
  const { t } = useTranslation();
  const classes = TYPE_CLASSES[type];
  return (
    <View className="overflow-hidden rounded-full px-2.5 py-1">
      {/* The leave hues have no soft token, and an opacity modifier paints nothing here. */}
      <View className={cn("absolute inset-0", classes.fill)} style={{ opacity: 0.14 }} />
      <Text className={cn("text-[12px] font-semibold", classes.text)}>{t.recordTypes[type]}</Text>
    </View>
  );
}

export function SendingBadge() {
  const { t } = useTranslation();
  return (
    <View className="rounded-full bg-accent px-2.5 py-1">
      <Text className="text-[12px] font-semibold text-primary">{t.requests.sending}</Text>
    </View>
  );
}
