import { Redirect, Stack, router, useNavigation } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { NotificationsIntro } from "@/components/reminders/notifications-intro";
import { useTone } from "@/components/ui/icon";
import { notificationPermission, reminderPrefs } from "@/lib/reminders";
import { useRootRoute } from "@/lib/session/root-route-context";

/** A formSheet on the root stack, pushed once by the signed-in shell. */
export default function NotificationsIntroSheet() {
  const route = useRootRoute();
  const card = useTone("card");
  const orphaned = !useNavigation().canGoBack();

  // Seen the moment it shows, so a sheet swiped away or an app killed under it never returns.
  useEffect(() => reminderPrefs.markIntroSeen(), []);

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return <Redirect href="/dashboard" />;

  return (
    <>
      <Stack.Screen options={{ contentStyle: { backgroundColor: card } }} />
      <View className="bg-card px-6 pt-8" style={{ paddingBottom: 28 }}>
        <NotificationsIntro
          onContinue={() => notificationPermission.request()}
          onDismiss={() => router.back()}
        />
      </View>
    </>
  );
}
