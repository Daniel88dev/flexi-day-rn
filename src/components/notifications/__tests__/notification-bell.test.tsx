import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { qk, queryClient } from "@/lib/query";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({ router: { push: jest.fn() }, useFocusEffect: () => undefined }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

function notifications(...readAt: (string | null)[]) {
  const body = readAt.map((read, index) => ({
    id: `n-${index}`,
    type: "comment",
    title: "New comment",
    body: "Eva: see you Monday",
    href: null,
    readAt: read,
    createdAt: "2026-09-27T08:00:00.000Z",
  }));
  mockFetch.mockResolvedValue({ status: 200, json: async () => body });
}

async function renderBell() {
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationBell />
      </QueryClientProvider>
    </TranslationProvider>
  );
  await waitFor(() =>
    expect(queryClient.getQueryState(qk.notifications(false))?.status).toBe("success")
  );
  // The query hands its answer to the bell on a timer of its own; let it land inside act.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => queryClient.clear());

describe("NotificationBell", () => {
  it("says some are unread in the bell's label while any notification is unread", async () => {
    notifications("2026-09-27T09:00:00.000Z", null);
    await renderBell();

    await screen.findByLabelText(en.notifications.openUnread);
    expect(screen.getByTestId("notification-bell")).toHaveAccessibleName(
      "Notifications, some unread"
    );
  });

  it("drops the unread note from the bell's label once everything is read", async () => {
    notifications("2026-09-27T09:00:00.000Z");
    await renderBell();

    await screen.findByLabelText(en.notifications.open);
    expect(screen.getByTestId("notification-bell")).toHaveAccessibleName("Notifications");
  });

  it("opens the notification list", async () => {
    notifications();
    await renderBell();
    await screen.findByLabelText(en.notifications.open);

    await fireEvent.press(screen.getByTestId("notification-bell"));

    expect(router.push).toHaveBeenCalledWith("/notifications");
  });
});
