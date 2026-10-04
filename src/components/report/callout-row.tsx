import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export function Dot({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity }} />;
}

export function CalloutRow({
  color,
  colorOpacity,
  label,
  value,
  strong,
}: {
  color?: string;
  colorOpacity?: number;
  label: string;
  value?: string;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2 py-[2px]">
      {color ? <Dot color={color} opacity={colorOpacity} /> : null}
      <Text
        numberOfLines={1}
        className={cn(
          "flex-1 text-[12.5px]",
          strong ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </Text>
      {value === undefined ? null : (
        <Text
          style={TABULAR}
          className={cn("text-[12.5px] text-foreground", strong && "font-semibold")}
        >
          {value}
        </Text>
      )}
    </View>
  );
}
