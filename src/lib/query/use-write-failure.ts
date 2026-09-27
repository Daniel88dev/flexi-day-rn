import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast as sonner } from "sonner-native";

import { useTranslation } from "@/i18n/use-translation";
import { pull as syncPull } from "@/lib/local-store";

import { createWriteFailureHandler, type WriteFailureHandler } from "./write-failure";

/** The handler as screens reach it, on the shell's query client, toaster and Local store. */
export function useWriteFailure(): WriteFailureHandler {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMemo(
    () => createWriteFailureHandler({ queryClient, toast: sonner, pull: syncPull, t }),
    [queryClient, t]
  );
}
