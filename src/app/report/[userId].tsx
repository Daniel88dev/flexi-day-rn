import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { MemberScreen } from "@/components/report-prototype/member";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

// PROTOTYPE (T-143, prototype/report).
export default function Screen() {
  const route = useRootRoute();
  if (route === "welcome") return <Redirect href="/welcome" />;
  return (
    <QueryClientProvider client={queryClient}>
      <MemberScreen />
    </QueryClientProvider>
  );
}
