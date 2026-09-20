import { ArrowUpRightIcon } from "phosphor-react-native";
import { Pressable, type PressableProps } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function TextLink({
  label,
  external,
  size = 15,
  className,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  external?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Pressable
      {...props}
      accessibilityRole="link"
      hitSlop={8}
      className={cn("flex-row items-center gap-1", className)}
    >
      <Text className="font-semibold text-primary" style={{ fontSize: size }}>
        {label}
      </Text>
      {external ? <Icon icon={ArrowUpRightIcon} tone="primary" size={size} weight="bold" /> : null}
    </Pressable>
  );
}
