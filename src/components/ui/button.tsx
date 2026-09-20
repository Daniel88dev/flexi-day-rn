import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { ActivityIndicator, Pressable, type PressableProps } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function Button({
  label,
  icon,
  loading,
  disabled,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  icon?: PhosphorIcon;
  loading?: boolean;
  className?: string;
}) {
  const spinner = useTone("onPrimary");
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-90",
        // A working button keeps its colour; the spinner already says it is busy.
        disabled && !loading && "opacity-50",
        className
      )}
    >
      {loading ? <ActivityIndicator color={spinner} /> : null}
      <Text className="text-[16px] font-semibold text-primary-foreground">{label}</Text>
      {icon && !loading ? <Icon icon={icon} tone="onPrimary" size={18} weight="bold" /> : null}
    </Pressable>
  );
}
