import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Greeting } from "@/components/dashboard/greeting";
import { useTone } from "@/components/ui/icon";
import { useViewer } from "@/lib/viewer/use-viewer";

export default function DashboardScreen() {
  const viewer = useViewer();
  const primary = useTone("primary");
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh is one of the two triggers for a sync pull. The pull itself lands with the
  // local store; until then the gesture is here so the screen is built around it.
  const refresh = () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  return (
    <ScrollView
      className="flex-1 bg-background pt-safe"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={primary} onRefresh={refresh} />
      }
    >
      <View className="gap-5 px-4 pt-3">
        <Greeting viewer={viewer} />
        <EmptyDashboard />
      </View>
    </ScrollView>
  );
}
