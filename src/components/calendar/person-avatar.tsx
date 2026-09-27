import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { avatarColor, initials } from "@/lib/viewer/viewer";

export function PersonAvatar({
  userId,
  name,
  size = 28,
}: {
  userId: string;
  name: string | null;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(userId),
      }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.4, color: "#fff" }} className="font-semibold">
        {initials(name ?? "") || "?"}
      </Text>
    </View>
  );
}
