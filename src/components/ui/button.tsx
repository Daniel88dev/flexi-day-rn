import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { Pressable, type PressableProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function Button({
  label,
  icon,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  icon?: PhosphorIcon;
  className?: string;
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      className={cn(
        "h-14 flex-row items-center justify-center gap-2 rounded-full bg-primary px-6 active:opacity-90",
        className
      )}
    >
      <Text className="text-[16px] font-semibold text-primary-foreground">{label}</Text>
      {icon ? <Icon icon={icon} tone="onPrimary" size={18} weight="bold" /> : null}
    </Pressable>
  );
}
