// PROTOTYPE (T-265): dev-only floating switcher for the adjacent-days variants. Throwaway.
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import {
  PROTO_VARIANT_LABELS,
  setProtoState,
  useProtoState,
  type ProtoVariant,
} from "@/lib/calendar/prototype-adjacent";

const ORDER: ProtoVariant[] = ["A", "B", "C"];

export function ProtoAdjacentSwitcher() {
  const { variant, view } = useProtoState();
  if (!__DEV__) return null;
  const step = (delta: number) =>
    setProtoState({ variant: ORDER[(ORDER.indexOf(variant) + delta + ORDER.length) % 3] });

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-16 flex-row items-center justify-center gap-2"
    >
      <View className="elevation-4 flex-row items-center rounded-full bg-foreground px-1 py-1 shadow-md">
        <Pressable
          testID="proto-variant-prev"
          onPress={() => step(-1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          <Text className="text-[20px] font-bold text-background">‹</Text>
        </Pressable>
        <Text className="min-w-[150px] text-center text-[13px] font-bold text-background">
          {PROTO_VARIANT_LABELS[variant]}
        </Text>
        <Pressable
          testID="proto-variant-next"
          onPress={() => step(1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center"
        >
          <Text className="text-[20px] font-bold text-background">›</Text>
        </Pressable>
      </View>
      <Pressable
        testID="proto-view-toggle"
        onPress={() => setProtoState({ view: view === "lanes" ? "stripes" : "lanes" })}
        className="elevation-4 h-11 items-center justify-center rounded-full bg-primary px-3 shadow-md"
      >
        <Text className="text-[12px] font-bold text-primary-foreground">
          {view === "lanes" ? "Lanes" : "Stripes"}
        </Text>
      </Pressable>
    </View>
  );
}
