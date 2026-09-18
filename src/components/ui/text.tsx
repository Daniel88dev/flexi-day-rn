import { Text as RNText, type TextProps } from "react-native";

import { cn } from "@/lib/cn";

/**
 * Text has no inheritance on native, so every text node opts into the body face here rather
 * than relying on a parent.
 */
export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText {...props} className={cn("font-sans", className)} />;
}
