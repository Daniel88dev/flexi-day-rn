import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { CorrectionSheet } from "@/components/attendance/correction-sheet";
import { linkedDay } from "@/lib/attendance";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { currentMonth, isoDay } from "@/lib/requests/months";
import { useRootRoute } from "@/lib/session/root-route-context";
import { useToday } from "@/lib/use-today";
import { useViewer } from "@/lib/viewer/use-viewer";

/**
 * The correction sheet, a page sheet on the root stack outside the shell's query layer. `date` is
 * the session's business date, which says where to read it: `/current` for today, `/day` before.
 */
export default function CorrectionRoute() {
  const route = useRootRoute();
  const { id = "", date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const device = useToday();
  const businessDate = linkedDay(date, isoDay(currentMonth(device), device.getDate()));
  const viewerId = useViewer()?.id ?? null;
  const orphaned = useShellUnderneath(
    { pathname: "/my-attendance/session/[id]", params: { id, date: businessDate } },
    { pathname: "/my-attendance", params: { date: businessDate } }
  );

  const close = useCallback(() => router.back(), []);
  // Over the sheet, so a correction under way stays put while the reader clocks out.
  const openClock = useCallback(() => router.push("/clock"), []);

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <CorrectionSheet
        sessionId={id}
        businessDate={businessDate}
        viewerId={viewerId}
        onClose={close}
        onOpenClock={openClock}
      />
    </QueryClientProvider>
  );
}
