import * as WebBrowser from "expo-web-browser";

import { WEB_URL } from "@/lib/api";

/** The pages of the web app the phone hands off to. */
export const WEB_PATHS = {
  signUp: "/sign-up/",
  forgotPassword: "/forgot-password/",
  groups: "/groups/",
  join: "/join/",
  privacy: "/privacy/",
  terms: "/terms/",
  deleteAccount: "/settings/?delete-account",
} as const;

export function webJoinPath(token: string): string {
  return `${WEB_PATHS.join}?token=${encodeURIComponent(token)}`;
}

/**
 * Opens a page of the web app in a sheet over the screen that asked for it. Sign-up, the password
 * reset and the legal pages live on the web only, and a sheet keeps the app where it was underneath.
 */
export async function openWebPage(path: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    });
  } catch (error: unknown) {
    console.error("The web page could not be opened.", error);
  }
}
