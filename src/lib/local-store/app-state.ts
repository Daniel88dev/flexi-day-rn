import { AppState } from "react-native";

/** The app coming back to the foreground, as the store sees it: a fake stands in for Jest. */
export type AppStateSource = {
  subscribe(onActive: () => void): () => void;
};

export const deviceAppState: AppStateSource = {
  subscribe(onActive) {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") onActive();
    });
    return () => subscription.remove();
  },
};
