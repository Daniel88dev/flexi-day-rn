import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams } from "expo-router";

import { ProfileBody } from "@/components/directory/profile-screen";
import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import type { ProfileRef } from "@/lib/directory";
import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import { queryClient } from "@/lib/query";
import { useRootRoute } from "@/lib/session/root-route-context";

/** One spell's profile, pushed from a directory row or a Reports to; read only, live. */
export default function DirectoryProfileRoute() {
  const route = useRootRoute();
  const { t } = useTranslation();
  const { employmentId, organizationId } = useLocalSearchParams<ProfileRef>();
  const orphaned = useShellUnderneath({
    pathname: "/directory/[employmentId]",
    params: { employmentId, organizationId },
  });

  if (route === "welcome") return <Redirect href="/welcome" />;
  if (orphaned) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StackScreen testID="directory-profile" backLabel={t.directory.title}>
        <ProfileBody
          profileRef={{ organizationId: organizationId ?? "", employmentId: employmentId ?? "" }}
        />
      </StackScreen>
    </QueryClientProvider>
  );
}
