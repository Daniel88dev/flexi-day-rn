import { useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const CODE_LENGTH = 6;

/** Six boxes driven by one hidden input, so iOS's one-time-code autofill still lands. */
export function CodeBoxes({
  label,
  value,
  onChange,
  onComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, CODE_LENGTH);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      disabled={disabled}
      className={cn("flex-row gap-2.5", disabled && "opacity-50")}
    >
      {Array.from({ length: CODE_LENGTH }).map((_, box) => {
        const active = focused && !disabled && box === Math.min(digits.length, CODE_LENGTH - 1);
        return (
          <View
            // Six slots that never reorder, so the position is the identity.
            // eslint-disable-next-line @eslint-react/no-array-index-key
            key={box}
            className={cn(
              "h-16 flex-1 items-center justify-center rounded-[12px] border bg-card",
              active ? "border-2 border-primary" : "border-input"
            )}
          >
            <Text className="font-display text-[26px] font-semibold text-foreground">
              {digits[box] ?? ""}
            </Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        accessibilityLabel={label}
        value={digits}
        onChangeText={(typed) => {
          const next = typed.replace(/\D/g, "").slice(0, CODE_LENGTH);
          onChange(next);
          if (next.length === CODE_LENGTH) onComplete?.(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        editable={!disabled}
        autoFocus
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute h-px w-px opacity-0"
      />
    </Pressable>
  );
}
