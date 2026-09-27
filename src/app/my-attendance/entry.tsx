import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { EntrySheet } from "@/components/attendance/entry-sheet";
import { linkedDay } from "@/lib/attendance";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { currentMonth, isoDay } from "@/lib/requests/months";
import { useRootRoute } from "@/lib/session/root-route-context";
import { useToday } from "@/lib/use-today";

/** The entry sheet, a page sheet on the root stack. It sits outside the shell's query layer. */
export default function EntryRoute() {
  const route = useRootRoute();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const device = useToday();
  const openedOn = linkedDay(date, isoDay(currentMonth(device), device.getDate()));
  const orphaned = useShellUnderneath(
    { pathname: "/my-attendance/entry", params: { date: openedOn } },
    { pathname: "/my-attendance", params: { date: openedOn } }
  );

  // The sheet goes first, then My attendance opens on the day it saved.
  const saved = useCallback((businessDate: string) => {
    router.back();
    router.navigate({ pathname: "/my-attendance", params: { date: businessDate } });
  }, []);

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <EntrySheet openedOn={openedOn} onClose={() => router.back()} onSaved={saved} />
    </QueryClientProvider>
  );
}
