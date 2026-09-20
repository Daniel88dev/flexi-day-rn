import { AppState } from "react-native";

/** The app coming back to the foreground: the sync pull and the session both run on it. */
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
