import { ShieldCheckIcon, type Icon as PhosphorIcon } from "phosphor-react-native";
import { View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { badgeLabel, type StandingBadge } from "@/lib/groups/access";
import { weekdayPills, workingDayRuns } from "@/lib/groups/facts";
import type { GroupRole } from "@/lib/local-store";
import { initials } from "@/lib/viewer/viewer";

/** A group's initials; VoiceOver reads the name beside it instead. */
export function Monogram({
  name,
  size = 44,
  neutral = false,
}: {
  name: string;
  size?: number;
  neutral?: boolean;
}) {
  return (
    <View
      testID={neutral ? "monogram-neutral" : "monogram"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: 16 }}
      className={cn("items-center justify-center", neutral ? "bg-muted" : "bg-accent")}
    >
      <Text
        style={{ fontSize: Math.round(size * 0.36), letterSpacing: -0.3 }}
        className={cn("font-display font-bold", neutral ? "text-muted-foreground" : "text-primary")}
      >
        {initials(name) || "?"}
      </Text>
    </View>
  );
}

const PILL_TONES = {
  accent: { surface: "bg-accent", text: "text-primary", icon: "primary" },
  muted: { surface: "bg-muted", text: "text-muted-foreground", icon: "muted" },
} as const;

export function Pill({
  label,
  tone = "accent",
  icon,
  testID,
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
  icon?: PhosphorIcon;
  testID?: string;
}) {
  const tones = PILL_TONES[tone];
  return (
    <View
      testID={testID}
      className={cn("flex-row items-center gap-1 rounded-full px-2.5 py-1", tones.surface)}
    >
      {icon ? <Icon icon={icon} tone={tones.icon} size={12} weight="bold" /> : null}
      <Text className={cn("text-[12px] font-semibold", tones.text)}>{label}</Text>
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

export type GroupIdentity = {
  name: string;
  organizationName: string | null;
  badge: StandingBadge | null;
  neutral: boolean;
};

export function GroupBadge({ badge }: { badge: StandingBadge | null }) {
  const { t } = useTranslation();
  if (badge !== "orgAdmin") return <RoleBadge role={badge} />;
  return (
    <Pill
      testID="org-admin-badge"
      label={badgeLabel(t, badge)}
      tone="muted"
      icon={ShieldCheckIcon}
    />
  );
}

export function OrgAdminNotice({ organization }: { organization: string }) {
  const { t } = useTranslation();
  return (
    <View
      testID="group-org-admin-notice"
      className="flex-row gap-3 rounded-[16px] bg-warm-soft px-4 py-3"
    >
      <View className="pt-0.5">
        <Icon icon={ShieldCheckIcon} tone="warm" size={18} weight="bold" />
      </View>
      <Text className="flex-1 text-[14px] leading-5 text-foreground">
        {t.groups.orgAdminNotice(organization)}
      </Text>
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
