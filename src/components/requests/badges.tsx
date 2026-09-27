import { View } from "react-native";

import { LEAVE_CLASSES } from "@/components/ui/leave-classes";
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
  const classes = LEAVE_CLASSES[type];
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
