import {
  useForegroundPushRefresh,
  usePushBadge,
  usePushRegistration,
  usePushTaps,
} from "@/lib/push";

/** The signed-in shell's push work, mounted once the Local store is open. Renders nothing. */
export function PushClient() {
  usePushRegistration();
  usePushTaps();
  usePushBadge();
  useForegroundPushRefresh();
  return null;
}
