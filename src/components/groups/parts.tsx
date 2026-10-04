import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { weekdayPills, workingDayRuns } from "@/lib/groups/facts";
import type { GroupRole } from "@/lib/local-store";
import { initials } from "@/lib/viewer/viewer";

/** A group's initials on a violet tile; VoiceOver reads the name beside it instead. */
export function Monogram({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: 16 }}
      className="items-center justify-center bg-accent"
    >
      <Text
        style={{ fontSize: Math.round(size * 0.36), letterSpacing: -0.3 }}
        className="font-display font-bold text-primary"
      >
        {initials(name) || "?"}
      </Text>
    </View>
  );
}

/** Display only (ADR 0003): it names the viewer's standing and decides nothing. */
export function RoleBadge({ role }: { role: GroupRole | null }) {
  const { t } = useTranslation();
  if (role === null) return null;
  return (
    <View testID={`role-badge-${role}`} className="rounded-full bg-accent px-2.5 py-1">
      <Text className="text-[12px] font-semibold text-primary">{t.groups.roles[role]}</Text>
    </View>
  );
}

/** Monday to Sunday, read to VoiceOver as one phrase rather than seven letters. */
export function WeekdayPills({ workingDays }: { workingDays: readonly number[] }) {
  const { t } = useTranslation();
  const labels = t.groups.facts.weekdayInitials;
  return (
    <View
      testID="weekday-pills"
      accessible
      accessibilityLabel={t.groups.facts.workingDaysPhrase(workingDayRuns(workingDays))}
      className="flex-row gap-1"
    >
      {weekdayPills(workingDays).map(({ weekday, working }, position) => (
        <View
          key={weekday}
          className={cn(
            "h-7 w-7 items-center justify-center rounded-full",
            working ? "bg-primary" : "bg-muted"
          )}
        >
          <Text
            className={cn(
              "text-[12px] font-semibold",
              working ? "text-primary-foreground" : "text-faint"
            )}
          >
            {labels[position]}
          </Text>
        </View>
      ))}
    </View>
  );
}
