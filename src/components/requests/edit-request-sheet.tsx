import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";

import { HalfDayField } from "@/components/requests/fields/half-day-field";
import { NoteField } from "@/components/requests/fields/note-field";
import { TimesField } from "@/components/requests/fields/times-field";
import { TypeField } from "@/components/requests/fields/type-field";
import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { VacationUpdateDraft } from "@/lib/local-store";
import { useGroupDetail, type VacationDetail } from "@/lib/query";
import {
  canSaveEdit,
  editPatch,
  editValuesOf,
  isSingleDay,
  type EditValues,
} from "@/lib/requests/edit";
import { runDatesLabel } from "@/lib/requests/format";

export function EditRequestSheet({
  detail,
  open,
  saving,
  onClose,
  onSave,
}: {
  detail: VacationDetail;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: VacationUpdateDraft) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const labels = t.editRequest;
  const primary = useTone("primary");
  const [values, setValues] = useState<EditValues>(() => editValuesOf(detail));
  const group = useGroupDetail(open ? detail.groupId : null).data;

  const set = (patch: Partial<EditValues>) => setValues((current) => ({ ...current, ...patch }));
  const patch = editPatch(detail, values);
  const changed = Object.keys(patch).length > 0;
  const saveable = canSaveEdit(values) && changed && !saving;
  const current = detail.vacationType === "BANK_HOLIDAY" ? undefined : detail.vacationType;

  const save = async () => {
    if (await onSave(patch)) onClose();
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View testID="edit-request" className="flex-1 bg-background">
        <View className="h-14 flex-row items-center justify-between border-b border-border px-2">
          <Pressable
            testID="edit-request-cancel"
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
            testID="edit-request-save"
            onPress={() => void save()}
            disabled={!saveable}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !saveable, busy: saving }}
            className="h-10 min-w-[64px] items-center justify-center rounded-full px-3 active:opacity-70"
          >
            {saving ? (
              <ActivityIndicator color={primary} />
            ) : (
              <Text
                className={cn(
                  "text-[16px] font-semibold",
                  saveable ? "text-primary" : "text-faint"
                )}
              >
                {labels.save}
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView
          testID="edit-request-scroll"
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          // A padding KeyboardAvoidingView measures from the screen, not the page sheet, and
          // leaves the note under the keyboard.
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ gap: 24, padding: 16, paddingBottom: 48 }}
        >
          <View className="px-1">
            <Text className="text-[15px] font-semibold text-foreground">
              {detail.user.name} · {detail.groupName}
            </Text>
            <Text className="text-[13.5px] text-muted-foreground">
              {runDatesLabel({ from: detail.rangeStart, to: detail.rangeEnd }, t.requests.runDates)}
              {". "}
              {labels.appliesTo(detail.vacationIds.length)}
            </Text>
          </View>
          <TypeField
            value={values.vacationType}
            onChange={(vacationType) => set({ vacationType })}
            offerSickDay={group?.organization?.sickDayBenefitActive === true}
            current={current}
          />
          <TimesField
            startTime={values.startTime}
            endTime={values.endTime}
            onChange={(times) => set(times)}
          />
          {isSingleDay(detail) ? (
            <HalfDayField value={values.halfDay} onChange={(halfDay) => set({ halfDay })} />
          ) : null}
          <NoteField
            value={values.note}
            onChange={(note) => set({ note })}
            required={values.vacationType === "OTHER"}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
