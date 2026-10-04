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
  variant = "primary",
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  icon?: PhosphorIcon;
  loading?: boolean;
  variant?: "primary" | "outline";
  className?: string;
}) {
  const outline = variant === "outline";
  const spinner = useTone(outline ? "foreground" : "onPrimary");
  return (
    <Pressable
      {...props}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-90",
        outline ? "border border-input bg-card" : "bg-primary",
        // A working button keeps its colour; the spinner already says it is busy.
        disabled && !loading && "opacity-50",
        className
      )}
    >
      {loading ? <ActivityIndicator color={spinner} /> : null}
      <Text
        className={cn(
          "text-[16px] font-semibold",
          outline ? "text-foreground" : "text-primary-foreground"
        )}
      >
        {label}
      </Text>
      {icon && !loading ? (
        <Icon icon={icon} tone={outline ? "foreground" : "onPrimary"} size={18} weight="bold" />
      ) : null}
    </Pressable>
  );
}
