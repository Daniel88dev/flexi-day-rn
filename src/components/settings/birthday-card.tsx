import { CakeIcon, CheckIcon, LockIcon, MinusIcon, UsersIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { BirthdaySheet } from "@/components/settings/birthday-sheet";
import { Divider, Row, Section } from "@/components/settings/grouped-list";
import { Icon, useTone } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { ageOn, audience, shareSwitchState, type AudienceRow } from "@/lib/birthdays/birthday";
import { dayOfDate } from "@/lib/days";
import { useMyBirthday, useSaveMyBirthday } from "@/lib/query";
import { useToday } from "@/lib/use-today";

const CORAL = "rgb(222, 112, 78)";
const CORAL_TINT = "rgba(222, 112, 78, 0.16)";

function Mark({ on, column }: { on: boolean; column: string }) {
  const { t } = useTranslation();
  const labels = t.settings.birthday;
  return (
    <View
      className="w-12 items-center"
      accessible
      accessibilityLabel={`${column}: ${on ? labels.shown : labels.notShown}`}
    >
      <Icon icon={on ? CheckIcon : MinusIcon} tone={on ? "primary" : "faint"} size={16} />
    </View>
  );
}

function AudienceTable({ rows }: { rows: AudienceRow[] }) {
  const { t } = useTranslation();
  const labels = t.settings.birthday;
  const whoOf = (row: AudienceRow) => {
    switch (row.who) {
      case "you":
        return labels.you;
      case "groups":
        return row.names.length > 0 ? row.names.join(", ") : labels.yourGroups;
      case "teamFeeds":
        return labels.teamFeeds;
      case "providers":
        return labels.providers;
    }
  };

  return (
    <View testID="settings-birthday-audience" className="px-4 pt-2 pb-3">
      <View className="flex-row pb-1">
        <Text className="flex-1 text-[11.5px] font-semibold text-faint">{labels.who}</Text>
        <Text className="w-12 text-center text-[11.5px] font-semibold text-faint">
          {labels.dateColumn}
        </Text>
        <Text className="w-12 text-center text-[11.5px] font-semibold text-faint">
          {labels.ageColumn}
        </Text>
      </View>
      {rows.map((row) => (
        <View
          key={row.who}
          testID={`settings-birthday-audience-${row.who}`}
          className="flex-row items-center border-t border-border py-2.5"
        >
          <Text className="flex-1 pr-2 text-[14px] text-foreground">{whoOf(row)}</Text>
          <Mark on={row.date} column={labels.dateColumn} />
          <Mark on={row.age} column={labels.ageColumn} />
        </View>
      ))}
    </View>
  );
}

/**
 * D22: the birthday card under the account header, its edit sheet, and who sees it. Plan state
 * comes from the server (D28): the switch, the lapsed line, or the notice in its place.
 */
export function BirthdaySettings() {
  const { t } = useTranslation();
  const labels = t.settings.birthday;
  const primary = useTone("primary");
  const today = dayOfDate(useToday());
  const query = useMyBirthday();
  const { save, saving, pending, planRefused } = useSaveMyBirthday();
  const [editing, setEditing] = useState(false);

  const settings = query.data;
  const stored = settings?.birthday ?? null;
  const birthday = pending ?? stored;
  const age = birthday ? ageOn(birthday, today) : null;
  const shareGroups = settings?.shareGroups ?? [];
  const state = shareSwitchState({
    canShare: settings?.canShare ?? false,
    storedShared: stored?.shared ?? false,
    shareGroups,
  });
  const shared = birthday?.shared ?? false;

  const summary = birthday ? labels.date(birthday.day, birthday.month) : labels.add;
  const detail = birthday
    ? birthday.year !== null && age !== null
      ? labels.withYear(birthday.year, age)
      : labels.noYear
    : null;

  return (
    <View className="gap-7">
      <Pressable
        testID="settings-birthday"
        onPress={() => setEditing(true)}
        disabled={!settings}
        accessibilityRole="button"
        accessibilityLabel={[labels.title, summary, detail].filter(Boolean).join(", ")}
        accessibilityState={{ disabled: !settings }}
        className="flex-row items-center gap-3.5 rounded-[24px] bg-card px-4 py-4 active:opacity-70"
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: CORAL_TINT }}
        >
          <CakeIcon size={24} color={CORAL} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-bold tracking-[1px] text-faint uppercase">
            {labels.title}
          </Text>
          <Text className="font-display text-[19px] font-semibold text-foreground">
            {settings ? summary : " "}
          </Text>
          {detail ? <Text className="text-[13px] text-faint">{detail}</Text> : null}
        </View>
        {settings ? (
          <Text className="text-[15px] font-semibold text-primary">
            {stored ? labels.editAction : labels.addAction}
          </Text>
        ) : null}
      </Pressable>

      {!settings ? null : state === "notice" ? (
        <View
          testID="settings-birthday-notice"
          className="flex-row gap-3 rounded-[24px] bg-card px-4 py-3.5"
        >
          <Icon icon={LockIcon} tone="faint" size={18} />
          <Text className="flex-1 text-[13.5px] leading-[19px] text-muted-foreground">
            {labels.noPaidGroup}
          </Text>
        </View>
      ) : (
        <Section
          testID="settings-birthday-who"
          label={labels.whoSees}
          footer={state === "lapsed" || planRefused ? labels.lapsed : labels.shareHint}
        >
          <Row
            icon={UsersIcon}
            label={labels.shareRow}
            accessory={
              <Switch
                testID="settings-birthday-share"
                accessibilityLabel={labels.share}
                value={shared}
                disabled={!birthday || saving || (state === "lapsed" && !shared)}
                onValueChange={(next) => {
                  if (birthday) save({ ...birthday, shared: next });
                }}
                trackColor={{ true: primary }}
              />
            }
          />
          <Divider />
          <AudienceTable rows={audience({ birthday, shareGroups })} />
        </Section>
      )}

      <BirthdaySheet open={editing} birthday={stored} onClose={() => setEditing(false)} />
    </View>
  );
}
