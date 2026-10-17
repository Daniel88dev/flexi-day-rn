import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDotsIcon, TrashIcon } from "phosphor-react-native";
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";

import { Row, Section } from "@/components/settings/grouped-list";
import { useTone } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { draftOf, savedBirthday, type MyBirthday } from "@/lib/birthdays/birthday";
import { cn } from "@/lib/cn";
import { useRemoveMyBirthday, useSaveMyBirthday } from "@/lib/query";

const EARLIEST = new Date(1900, 0, 1);

/**
 * D22's edit page sheet: the system date wheel keeps its year column, the switch decides whether
 * the year is saved. Removing the birthday turns sharing off with it, on the server.
 */
export function BirthdaySheet({
  open,
  birthday,
  onClose,
}: {
  open: boolean;
  birthday: MyBirthday | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const labels = t.settings.birthday;
  const primary = useTone("primary");
  const { save, saving } = useSaveMyBirthday();
  const { remove, removing } = useRemoveMyBirthday();
  const [draft, setDraft] = useState(() => draftOf(birthday));
  const [wasOpen, setWasOpen] = useState(open);

  // Each opening starts from what is stored, not from an earlier draft.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(draftOf(birthday));
  }

  const busy = saving || removing;
  const { month, day, year } = draft.date;

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID="birthday-sheet" className="flex-1 bg-background">
        <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
          <Pressable
            testID="birthday-sheet-cancel"
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            className="h-10 justify-center rounded-full px-3 active:opacity-70"
          >
            <Text className="text-[16px] text-primary">{labels.cancel}</Text>
          </Pressable>
          <Text className="font-display text-[17px] font-semibold text-foreground">
            {labels.title}
          </Text>
          <Pressable
            testID="birthday-sheet-save"
            onPress={() =>
              save(savedBirthday(draft, birthday?.shared ?? false), { onSaved: onClose })
            }
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy, busy: saving }}
            className="h-10 min-w-[64px] items-center justify-center rounded-full px-3 active:opacity-70"
          >
            {saving ? (
              <ActivityIndicator color={primary} />
            ) : (
              <Text
                className={cn("text-[16px] font-semibold", busy ? "text-faint" : "text-primary")}
              >
                {labels.save}
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ gap: 24, padding: 16 }}>
          <View className="items-center rounded-[24px] bg-card py-2">
            <DateTimePicker
              testID="birthday-sheet-date"
              accessibilityLabel={labels.dateField}
              mode="date"
              display="spinner"
              value={new Date(year, month - 1, day)}
              minimumDate={EARLIEST}
              maximumDate={new Date()}
              onValueChange={(_event, date) =>
                setDraft((current) => ({
                  ...current,
                  date: {
                    month: date.getMonth() + 1,
                    day: date.getDate(),
                    year: date.getFullYear(),
                  },
                }))
              }
            />
          </View>
          <Section
            footer={
              month === 2 && day === 29 ? `${labels.yearHint} ${labels.leapNote}` : labels.yearHint
            }
          >
            <Row
              icon={CalendarDotsIcon}
              label={labels.includeYear}
              accessory={
                <Switch
                  testID="birthday-sheet-year"
                  accessibilityLabel={labels.includeYear}
                  value={draft.withYear}
                  onValueChange={(withYear) => setDraft((current) => ({ ...current, withYear }))}
                  trackColor={{ true: primary }}
                />
              }
            />
          </Section>
          {birthday ? (
            <Section>
              <Row
                testID="birthday-sheet-remove"
                icon={TrashIcon}
                label={labels.remove}
                destructive
                onPress={busy ? undefined : () => remove({ onRemoved: onClose })}
              />
            </Section>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}
