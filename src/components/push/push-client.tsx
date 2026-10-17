import {
  useForegroundPushRefresh,
  usePushBadge,
  usePushRegistration,
  usePushTaps,
} from "@/lib/push";
import { useNotificationPermission } from "@/lib/reminders";

/** The signed-in shell's push work, mounted once the Local store is open. Renders nothing. */
export function PushClient() {
  const permission = useNotificationPermission();
  usePushRegistration(permission);
  usePushTaps();
  usePushBadge();
  useForegroundPushRefresh();
  return null;
}
