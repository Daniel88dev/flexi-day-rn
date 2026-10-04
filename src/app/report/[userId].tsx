import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { MemberPlaceholder } from "@/components/report/member-placeholder";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** One person's report, pushed from a people-list row. */
export default function MemberReportRoute() {
  const route = useRootRoute();
  const { userId, period } = useLocalSearchParams<{ userId: string; period?: string }>();
  const orphaned = useShellUnderneath({
    pathname: "/report/[userId]",
    params: { userId, ...(period ? { period } : {}) },
  });

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <MemberPlaceholder userId={userId} period={period} />
    </QueryClientProvider>
  );
}
