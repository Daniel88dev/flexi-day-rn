import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, router, useNavigation, type Href } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { ClockWidget } from "@/components/clock/clock-widget";
import { useTone } from "@/components/ui/icon";
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
  const orphaned = !useNavigation().canGoBack();

  // A cold deep link lands here with nothing beneath, and the sheet would fill the screen. The
  // shell goes under it first, which also mounts the query layer the sheet reads through.
  useEffect(() => {
    if (route !== "signed-in" || !orphaned) return;
    router.replace("/dashboard");
    router.push("/clock");
  }, [route, orphaned]);

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: card } }} />
      <View className="bg-card px-5 pt-6" style={{ paddingBottom: 20 }} testID="clock-sheet">
        <ClockWidget onNavigate={(href: Href) => router.navigate(href)} />
      </View>
    </QueryClientProvider>
  );
}
