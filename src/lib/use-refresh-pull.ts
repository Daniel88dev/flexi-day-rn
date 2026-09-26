import { useState } from "react";
import { toast } from "sonner-native";

import { useTranslation } from "@/i18n/use-translation";
import { pull } from "@/lib/local-store";

/**
 * Pull-to-refresh over the sync pull. It never fails quietly, where a foreground pull says nothing
 * and keeps what is there. The pull resolves when the whole loop ends, a queued rerun included,
 * which is how long the control stays down.
 */
export function useRefreshPull(): { refreshing: boolean; refresh: () => void } {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = () => {
    setRefreshing(true);
    void pull("refresh")
      .then((outcome) => {
        if (!outcome.ok) toast.error(outcome.message ?? t.sync.unreachable);
      })
      .catch(() => toast.error(t.sync.unreachable))
      .finally(() => setRefreshing(false));
  };

  return { refreshing, refresh };
}
