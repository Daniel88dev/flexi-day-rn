import * as ReactNative from "react-native";

/**
 * React Native loads its core components on first access. On a cold transform cache, as every CI
 * run has, the first suite in a worker to render a screen spends about 3 s (locally; more on the
 * runner) transforming ScrollView, Modal and Text, and inside a test that lands on Jest's 5 s
 * timeout. `beforeAll(warmUpReactNative, WARM_UP_TIMEOUT)` pays it under its own budget instead.
 */
export const WARM_UP_TIMEOUT = 30_000;

export function warmUpReactNative(): void {
  void [ReactNative.View, ReactNative.Text, ReactNative.ScrollView, ReactNative.Modal];
}
