import { EyeIcon, EyeSlashIcon, type Icon as PhosphorIcon } from "phosphor-react-native";
import { useState, type ReactNode, type Ref } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

export type FieldProps = TextInputProps & {
  label?: string;
  labelRight?: ReactNode;
  icon?: PhosphorIcon;
  secure?: boolean;
  inputRef?: Ref<TextInput>;
  className?: string;
};

export function Field({
  label,
  labelRight,
  icon,
  secure,
  inputRef,
  className,
  onFocus,
  onBlur,
  ...props
}: FieldProps) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secure));
  const faint = useTone("faint");
  const primary = useTone("primary");

  return (
    <View className={className}>
      {label || labelRight ? (
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-[13px] font-semibold text-muted-foreground">{label}</Text>
          {labelRight}
        </View>
      ) : null}
      <View
        className={cn(
          "h-[52px] flex-row items-center gap-3 rounded-[12px] border bg-card px-4",
          focused ? "border-primary" : "border-input"
        )}
      >
        {icon ? <Icon icon={icon} tone={focused ? "primary" : "faint"} size={18} /> : null}
        <TextInput
          ref={inputRef}
          {...props}
          secureTextEntry={secure ? hidden : props.secureTextEntry}
          placeholderTextColor={faint}
          selectionColor={primary}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          className="flex-1 py-0 font-sans text-[16px] text-foreground"
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((was) => !was)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t.auth.signIn.showPassword : t.auth.signIn.hidePassword}
          >
            <Icon icon={hidden ? EyeIcon : EyeSlashIcon} tone="faint" size={20} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
