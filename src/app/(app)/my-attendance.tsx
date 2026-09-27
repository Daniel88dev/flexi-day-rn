import { router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { MyAttendanceScreen } from "@/components/attendance/my-attendance-screen";

export default function Screen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const consumed = useCallback(() => router.setParams({ date: undefined }), []);
  return <MyAttendanceScreen linkedDate={date ?? null} onLinkConsumed={consumed} />;
}
