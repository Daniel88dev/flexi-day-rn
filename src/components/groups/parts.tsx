import { View } from "react-native";

import { Notice } from "@/components/ui/notice";
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

const PILL_TONES = {
  accent: { surface: "bg-accent", text: "text-primary" },
  muted: { surface: "bg-muted", text: "text-muted-foreground" },
} as const;

export function Pill({
  label,
  tone = "accent",
  testID,
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
  testID?: string;
}) {
  const { surface, text } = PILL_TONES[tone];
  return (
    <View testID={testID} className={cn("rounded-full px-2.5 py-1", surface)}>
      <Text className={cn("text-[12px] font-semibold", text)}>{label}</Text>
    </View>
  );
}

/** Renders `<testID>-failed` around the notice and `<testID>-retry` on its button. */
export function RetryNotice({
  testID,
  message,
  onRetry,
}: {
  testID: string;
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View testID={`${testID}-failed`}>
      <Notice
        tone="error"
        message={message}
        action={{ label: t.groups.retry, onPress: onRetry, testID: `${testID}-retry` }}
      />
    </View>
  );
}

/** Display only (ADR 0003): it names the viewer's standing and decides nothing. */
export function RoleBadge({ role }: { role: GroupRole | null }) {
  const { t } = useTranslation();
  if (role === null) return null;
  return <Pill testID={`role-badge-${role}`} label={t.groups.roles[role]} />;
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
