import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";
import { initials as initialsOf } from "@/lib/viewer/viewer";

/**
 * A round picture, or initials on the person's colour without one. Pass `initials` when the read
 * carries the server's: it takes first and last name, where the phone's own takes the first two.
 */
export function Avatar({
  name,
  initials,
  color,
  size,
  textScale = 0.4,
  uri,
}: {
  name: string | null;
  initials?: string;
  color: string;
  size: number;
  textScale?: number;
  uri?: string | null;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={round} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ ...round, backgroundColor: color }} className="items-center justify-center">
      <Text style={{ fontSize: size * textScale, color: "#fff" }} className="font-semibold">
        {(initials ?? initialsOf(name ?? "")) || "?"}
      </Text>
    </View>
  );
}
