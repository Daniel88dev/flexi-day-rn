import { View } from "react-native";

import { Text } from "@/components/ui/text";

export function SuccessNotice({ message }: { message: string }) {
  return (
    <View className="rounded-2xl bg-ok-soft px-4 py-3">
      <Text className="text-[14px] leading-5 text-ok">{message}</Text>
    </View>
  );
}
