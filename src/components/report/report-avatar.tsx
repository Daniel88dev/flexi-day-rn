import { View } from "react-native";

import { Text } from "@/components/ui/text";
import type { ReportUser } from "@/lib/report";

/** The report's own avatar, in the person's scope colour so it matches their chart segments. */
export function ReportAvatar({
  user,
  color,
  size = 36,
}: {
  user: ReportUser;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.38, color: "#fff" }} className="font-semibold">
        {user.initials}
      </Text>
    </View>
  );
}
