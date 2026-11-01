import * as ReactNative from "react-native";

/**
 * React Native loads its core components on first access. On a cold transform cache, as every CI
 * run has, the first test in a worker to render a screen spends seconds transforming them, and
 * inside a test that lands on Jest's 5 s timeout. `jest/warm-up.js` runs this in a `beforeAll` for
 * every test file, so the cost is paid under its own budget instead.
 *
 * The list names each component the app imports, not every export: some exports are deprecated
 * and warn when read. `__tests__/warm-up.test.ts` fails when the app imports one missing here.
 */
export const WARM_UP_TIMEOUT = 30_000;

export const WARMED_COMPONENTS = [
  "ActivityIndicator",
  "FlatList",
  "Image",
  "KeyboardAvoidingView",
  "Modal",
  "Pressable",
  "RefreshControl",
  "ScrollView",
  "StatusBar",
  "Switch",
  "Text",
  "TextInput",
  "View",
] as const satisfies readonly (keyof typeof ReactNative)[];

export const NON_COMPONENT_APIS = [
  "AccessibilityInfo",
  "ActionSheetIOS",
  "Alert",
  "AppState",
  "Keyboard",
  "Linking",
  "Platform",
  "Share",
  "StyleSheet",
] as const satisfies readonly (keyof typeof ReactNative)[];

export function warmUpReactNative(): void {
  for (const name of WARMED_COMPONENTS) void ReactNative[name];
}
