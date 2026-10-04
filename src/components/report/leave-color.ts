import { useUnstableNativeVariable } from "nativewind";
import { useColorScheme } from "react-native";

import type { CalendarRecordType } from "@/lib/local-store";

// The theme variable, then light and dark fallbacks in case the runtime hands back no colour.
const LEAVE_VAR: Record<CalendarRecordType, [string, string, string]> = {
  VACATION: ["--c-vacation", "#7a69d6", "#9b8ef0"],
  HOME_OFFICE: ["--c-home", "#3f9a73", "#5fc394"],
  SICK: ["--c-sick", "#d5566a", "#ec7f89"],
  SICK_DAY: ["--c-sickday", "#cf5a8c", "#ea83ad"],
  BANK_HOLIDAY: ["--c-bank", "#d29a3a", "#ebb862"],
  PAID_TIME_OFF: ["--c-pto", "#3d86c0", "#6aa9de"],
  NON_PAID_LEAVE: ["--c-nonpaid", "#3d97a7", "#6cc0cc"],
  STUDY_LEAVE: ["--c-study", "#8aa337", "#aec85a"],
  OTHER: ["--c-other", "#7c7d8a", "#a7a8b5"],
};

/** A leave type's colour as a plain string, for SVG fills that `className` cannot reach. */
export function useLeaveColor(type: CalendarRecordType): string {
  const [name, light, dark] = LEAVE_VAR[type];
  // Typed against the web build of react-native-css; the native build takes the name.
  const value = (useUnstableNativeVariable as unknown as (name: string) => unknown)(name);
  const scheme = useColorScheme();
  if (typeof value === "string") return value;
  return scheme === "dark" ? dark : light;
}
