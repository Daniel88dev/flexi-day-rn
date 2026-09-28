import { ActivityIndicator, View } from "react-native";

import { Text } from "@/components/ui/text";
import { useDevSignIn } from "@/lib/session/use-dev-sign-in";

export function DevSignIn({ ticket, to }: { ticket: unknown; to: unknown }) {
  const { error } = useDevSignIn(ticket, to);

  return (
    <View
      testID="dev-sign-in"
      className="flex-1 items-center justify-center gap-3 bg-background px-6"
    >
      {error ? (
        <>
          <Text className="font-display text-[20px] font-semibold text-foreground">
            Dev sign-in failed
          </Text>
          <Text testID="dev-sign-in-error" className="text-center text-[15px] text-danger">
            {error}
          </Text>
        </>
      ) : (
        <View testID="dev-sign-in-busy" className="items-center gap-3">
          <ActivityIndicator />
          <Text className="text-[15px] text-muted-foreground">Signing in…</Text>
        </View>
      )}
    </View>
  );
}
