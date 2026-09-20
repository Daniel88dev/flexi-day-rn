import { ArrowUpRightIcon } from "phosphor-react-native";
import { Pressable, type PressableProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function TextLink({
  label,
  external,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  external?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      hitSlop={8}
      className={cn("flex-row items-center gap-1", className)}
    >
      <Text className="text-[15px] font-semibold text-primary">{label}</Text>
      {external ? <Icon icon={ArrowUpRightIcon} tone="primary" size={15} weight="bold" /> : null}
    </Pressable>
  );
}
