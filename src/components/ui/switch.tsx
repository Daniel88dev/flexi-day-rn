import { Switch as RNSwitch, type SwitchProps } from "react-native";

/**
 * RN's iOS Switch composes `alignSelf: 'flex-start'` under its style (facebook/react-native#53326),
 * which beats a row's `items-center` and lifts the switch to the top of the row.
 */
export function Switch({ style, ...props }: SwitchProps) {
  return <RNSwitch {...props} style={[{ alignSelf: "center" }, style]} />;
}
