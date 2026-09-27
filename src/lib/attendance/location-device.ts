import * as Location from "expo-location";
import { AppState } from "react-native";

import type { LocationDevice, Reading } from "./location-capture";

const ACCURACY = {
  balanced: Location.Accuracy.Balanced,
  highest: Location.Accuracy.Highest,
} as const;

const readingOf = ({ coords }: Location.LocationObject): Reading => ({
  latitude: coords.latitude,
  longitude: coords.longitude,
  accuracy: coords.accuracy,
});

export const phoneLocation: LocationDevice = {
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  requestPermission: async () => {
    const answer = await Location.requestForegroundPermissionsAsync();
    return { granted: answer.granted, reduced: answer.ios?.accuracy === "reduced" };
  },
  lastKnown: async (maxAge) => {
    const known = await Location.getLastKnownPositionAsync({ maxAge });
    return known ? readingOf(known) : null;
  },
  current: async (accuracy) =>
    readingOf(await Location.getCurrentPositionAsync({ accuracy: ACCURACY[accuracy] })),
};

/**
 * Calls back when the app goes to the background. The permission prompt, Control Center and the
 * notification shade only make it inactive, and the passes carry on through those.
 */
export function onLeavingApp(listener: () => void): () => void {
  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "background") listener();
  });
  return () => subscription.remove();
}
