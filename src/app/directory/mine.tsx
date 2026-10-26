import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { MyProfileScreen } from "@/components/directory/my-profile-screen";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** Pushed from the More sheet's viewer block, outside the shell's query layer. */
export default function MyDirectoryProfileRoute() {
  const route = useRootRoute();
  const orphaned = useShellUnderneath("/directory/mine");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <MyProfileScreen />
    </QueryClientProvider>
  );
}
