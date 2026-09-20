import { View } from "react-native";

import { Text } from "@/components/ui/text";

export function ErrorNotice({ message }: { message: string }) {
  return (
    <View className="rounded-2xl bg-danger-soft px-4 py-3">
      <Text className="text-[14px] leading-5 text-danger">{message}</Text>
    </View>
  );
}
