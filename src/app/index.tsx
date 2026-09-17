import { Text, View } from "react-native";

import { BackendStatus } from "@/components/backend-status";

export default function Index() {
  return (
    <View className="flex-1 bg-background pt-safe pb-safe">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/[0.18]">
          <View className="h-8 w-8 rounded-full bg-primary" />
        </View>
        <Text className="text-2xl font-semibold text-foreground">Flexi Day</Text>
        <Text className="text-center text-base text-muted-foreground">
          Scaffold. The welcome screen lands with the first prototype.
        </Text>
        <BackendStatus />
      </View>
    </View>
  );
}
