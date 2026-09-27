import { render, screen } from "@testing-library/react-native";

import { WindowNote } from "@/components/attendance/window-note";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

const renderNote = (note: Parameters<typeof WindowNote>[0]["note"]) =>
  render(
    <TranslationProvider>
      <WindowNote note={note} />
    </TranslationProvider>
  );

describe("WindowNote", () => {
  it("renders a muted hint while the day can be edited", async () => {
    await renderNote({ kind: "hint", mode: "NO_LIMIT", days: 0 });

    expect(screen.getByTestId("window-hint")).toHaveTextContent(en.selfService.windowNoLimitHint);
    expect(screen.queryByTestId("window-lock")).toBeNull();
  });

  it("renders the lock notice for a day outside the window", async () => {
    await renderNote({ kind: "lock", cause: "OUTSIDE", mode: "DAYS", days: 7 });

    expect(screen.getByTestId("window-lock")).toHaveTextContent(
      en.selfService.windowOutsideDaysNotice(7)
    );
  });

  it("renders the lock notice for an ended employment", async () => {
    await renderNote({ kind: "lock", cause: "ENDED", mode: "DAYS", days: 7 });

    expect(screen.getByTestId("window-lock")).toHaveTextContent(en.selfService.windowEndedNotice);
  });

  it("renders the off notice smaller and apart from the lock", async () => {
    await renderNote({ kind: "lock", cause: "OFF", mode: "OFF", days: 0 });

    expect(screen.getByTestId("window-off")).toHaveTextContent(en.selfService.windowOffNotice);
    expect(screen.queryByTestId("window-lock")).toBeNull();
  });
});
