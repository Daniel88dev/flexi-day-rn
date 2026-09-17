import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/[0.18]">
          <View className="h-8 w-8 rounded-full bg-primary" />
        </View>
        <Text className="text-2xl font-semibold text-foreground">Flexi Day</Text>
        <Text className="text-center text-base text-muted-foreground">
          Scaffold. The welcome screen lands with the first prototype.
        </Text>
      </View>
    </SafeAreaView>
  );
}
