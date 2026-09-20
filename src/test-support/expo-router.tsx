import { Text } from "react-native";

/**
 * Expo Router's `<Redirect>` as the path it would have navigated to, so a test reads the
 * routing decision off the screen instead of a navigation spy.
 */
export function RedirectShim({ href }: { href: string }) {
  return <Text>{href}</Text>;
}
