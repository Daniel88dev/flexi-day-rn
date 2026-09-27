import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, router, type Href } from "expo-router";
import { View } from "react-native";

import { ClockWidget } from "@/components/clock/clock-widget";
import { useTone } from "@/components/ui/icon";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/**
 * The Clock sheet: a formSheet on the root stack, so the disc, a reminder and a deep link all
 * open the same thing. It sits outside the shell's query layer, so it hands the one client in.
 */
export default function ClockSheet() {
  const route = useRootRoute();
  // Without it iOS 26 paints a glass strip under the floating sheet's content.
  const card = useTone("card");
  // On its own the sheet would fill the screen.
  const orphaned = useShellUnderneath("/clock");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: card } }} />
      <View className="bg-card px-5 pt-6" style={{ paddingBottom: 20 }} testID="clock-sheet">
        <ClockWidget
          onNavigate={(href: Href) => {
            // The sheet goes first, so the screen it opens is not left under it.
            router.back();
            router.navigate(href);
          }}
        />
      </View>
    </QueryClientProvider>
  );
}
