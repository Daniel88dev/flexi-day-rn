import { View } from "react-native";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * The web's mark: a dot with a paper gap and a ring, on a soft halo of the same hue. The halo
 * is an inline opacity because a token with an opacity modifier compiles to `color-mix()` on
 * this NativeWind release and paints nothing.
 */
export function LogoMark({ size = 26 }: { size?: number }) {
  const primary = useTone("primary");
  const dot = Math.round(size * 0.52);
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <View
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: primary, opacity: 0.18 }}
      />
      <View
        style={{ width: dot + 9, height: dot + 9 }}
        className="items-center justify-center rounded-full bg-primary"
      >
        <View
          style={{ width: dot + 6, height: dot + 6 }}
          className="items-center justify-center rounded-full bg-background"
        >
          <View style={{ width: dot, height: dot }} className="rounded-full bg-primary" />
        </View>
      </View>
    </View>
  );
}

export function Wordmark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <Text
      className={cn("font-display font-bold text-foreground", className)}
      style={{ fontSize: size * 0.74, letterSpacing: -size * 0.74 * 0.03 }}
    >
      flexi
      <Text className="font-display font-bold text-primary">day</Text>
    </Text>
  );
}
