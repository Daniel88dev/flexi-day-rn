import { useState } from "react";
import { TextInput, View } from "react-native";

import { FieldLabel } from "@/components/requests/fields/field-label";
import { useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

export function NoteField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (note: string) => void;
  required: boolean;
}) {
  const { t } = useTranslation();
  const faint = useTone("faint");
  const primary = useTone("primary");
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <FieldLabel>{required ? t.requestForm.noteRequired : t.requestForm.note}</FieldLabel>
      <TextInput
        testID="note-field"
        accessibilityLabel={required ? t.requestForm.noteRequired : t.requestForm.note}
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={1000}
        placeholder={t.requestForm.notePlaceholder}
        placeholderTextColor={faint}
        selectionColor={primary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical="top"
        className={cn(
          "min-h-[96px] rounded-[12px] border bg-card px-4 pt-3 pb-3 font-sans text-[16px] text-foreground",
          focused ? "border-primary" : "border-input"
        )}
      />
    </View>
  );
}
