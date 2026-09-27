import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NotificationsScreen } from "@/components/notifications/notifications-screen";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * Pushed over the shell from any tab's bell, outside its query layer and its gesture root, so it
 * hands the one client in and mounts a gesture root for the rows' swipe.
 */
export default function NotificationsRoute() {
  const route = useRootRoute();
  const orphaned = useShellUnderneath("/notifications");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NotificationsScreen />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
