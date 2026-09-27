import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useNavigation, type Href } from "expo-router";

import { PushedDay } from "@/components/attendance/my-attendance-screen";
import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** One day of My attendance pushed over the shell, outside its query layer. */
export default function Screen() {
  const { t } = useTranslation();
  const route = useRootRoute();
  const { date } = useLocalSearchParams<{ date: string }>();
  const orphaned = !useNavigation().canGoBack();

  if (route === "welcome") return <Redirect href="/welcome" />;
  // A cold deep link lands here without the shell beneath; My attendance takes the same date.
  if (orphaned) return <Redirect href={`/my-attendance?date=${date}` as Href} />;

  return (
    <QueryClientProvider client={queryClient}>
      <StackScreen title={t.attendance.title}>
        <PushedDay date={date} />
      </StackScreen>
    </QueryClientProvider>
  );
}
