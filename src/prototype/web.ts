import * as WebBrowser from "expo-web-browser";

const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://flexi-day.com").replace(/\/+$/, "");

export function openWeb(path: string) {
  void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
