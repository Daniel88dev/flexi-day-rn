import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";

import { DirectoryScreen } from "@/components/directory/directory-screen";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** Pushed over the shell from More, outside its query layer, so it hands the one client in. */
export default function DirectoryRoute() {
  const route = useRootRoute();
  const orphaned = useShellUnderneath("/directory");

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <DirectoryScreen />
    </QueryClientProvider>
  );
}
