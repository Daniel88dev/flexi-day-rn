import * as WebBrowser from "expo-web-browser";

import { openWebPage } from "@/lib/web";

jest.mock("@/lib/api", () => ({ WEB_URL: "https://web.test" }));

jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const openBrowserAsync = WebBrowser.openBrowserAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  openBrowserAsync.mockResolvedValue({ type: "dismiss" });
});

describe("openWebPage", () => {
  it("opens the path on the web app in a sheet the person can swipe away", async () => {
    await openWebPage("/sign-up/");

    expect(openBrowserAsync).toHaveBeenCalledWith("https://web.test/sign-up/", {
      presentationStyle: "pageSheet",
    });
  });

  it("returns without throwing when the browser refuses to open", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    openBrowserAsync.mockRejectedValue(new Error("Another browser is already open."));

    await expect(openWebPage("/sign-up/")).resolves.toBeUndefined();
  });
});
