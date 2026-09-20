import { ArrowUpRightIcon } from "phosphor-react-native";
import { Pressable, type PressableProps } from "react-native";

import { Icon, type Tone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function TextLink({
  label,
  external,
  muted,
  size = 15,
  className,
  disabled,
  ...props
}: Omit<PressableProps, "children"> & {
  label: string;
  external?: boolean;
  muted?: boolean;
  size?: number;
  className?: string;
}) {
  const tone: Tone = disabled ? "faint" : muted ? "muted" : "primary";
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="link"
      hitSlop={8}
      className={cn("flex-row items-center gap-1", className)}
    >
      <Text
        className={cn(
          "font-semibold",
          disabled ? "text-faint" : muted ? "text-muted-foreground" : "text-primary"
        )}
        style={{ fontSize: size }}
      >
        {label}
      </Text>
      {external ? <Icon icon={ArrowUpRightIcon} tone={tone} size={size} weight="bold" /> : null}
    </Pressable>
  );
}
