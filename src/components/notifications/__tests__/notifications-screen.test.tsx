import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";
import { toast } from "sonner-native";

import { NotificationsScreen } from "@/components/notifications/notifications-screen";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient, type AppNotification } from "@/lib/query";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

// Reanimated's worklets don't load under Jest; the swipe's action panel renders beside the row.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { View } = jest.requireActual("react-native");
  const methods = { close: () => undefined, openLeft: () => undefined, openRight: () => undefined };
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: React.ReactNode;
      renderRightActions?: (...args: unknown[]) => React.ReactNode;
    }) => (
      <View testID="swipeable">
        {children}
        {renderRightActions?.(null, null, methods)}
      </View>
    ),
  };
});

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
  useFocusEffect: () => undefined,
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

const toastError = toast.error as unknown as jest.Mock;
const push = router.push as jest.Mock;
const navigate = router.navigate as jest.Mock;
const alert = jest.spyOn(Alert, "alert");

const HOUR = 3_600_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const SERVER: AppNotification[] = [
  {
    id: "n-request",
    type: "approval_decided",
    title: "Your request was approved",
    body: "Vacation, 14 Sep to 18 Sep",
    href: "https://flexi-day.com/requests/?vacationId=v-42",
    readAt: null,
    createdAt: ago(2 * HOUR),
  },
  {
    id: "n-day",
    type: "session_auto_closed",
    title: "Your session was closed",
    body: "The nightly sweep closed Monday's session.",
    href: "/my-attendance/?date=2026-09-21",
    readAt: null,
    createdAt: ago(26 * HOUR),
  },
  {
    id: "n-old",
    type: "comment",
    title: "New comment",
    body: "Eva: see you Monday",
    href: null,
    readAt: ago(HOUR),
    createdAt: ago(3 * 24 * HOUR),
  },
];

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

function serve(rows: AppNotification[] = SERVER, fail?: (method: string, path: string) => unknown) {
  let stored = rows.map((row) => ({ ...row }));
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = new URL(String(url)).pathname;
    const failure = fail?.(method, path);
    if (failure instanceof Error) throw failure;
    if (failure) return failure;
    if (method === "POST" && path.endsWith("/read-all")) {
      stored = stored.map((row) => ({ ...row, readAt: row.readAt ?? ago(0) }));
    } else if (method === "POST") {
      const id = path.split("/")[3];
      stored = stored.map((row) => (row.id === id ? { ...row, readAt: ago(0) } : row));
    } else if (method === "DELETE" && path === "/api/notifications") {
      stored = [];
    } else if (method === "DELETE") {
      const id = path.split("/")[3];
      stored = stored.filter((row) => row.id !== id);
    } else {
      return answer(200, stored);
    }
    return answer(200, { message: "ok" });
  });
}

const calls = (method: string, path: string) =>
  mockFetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? "GET") === method && new URL(String(url)).pathname === path
  );

async function renderScreen() {
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <NotificationsScreen />
      </QueryClientProvider>
    </TranslationProvider>
  );
}

/** Every write reads the list again; the test ends once that read has landed. */
const settled = () =>
  waitFor(() => expect(calls("GET", "/api/notifications").length).toBeGreaterThanOrEqual(2));

const unreadDots = () => screen.queryAllByTestId("notification-unread");

const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

beforeEach(() => {
  jest.clearAllMocks();
  alert.mockImplementation(() => undefined);
});
afterEach(() => queryClient.clear());

describe("NotificationsScreen", () => {
  it("renders every notification newest first, with its age and an unread count", async () => {
    serve();
    await renderScreen();

    expect(await screen.findByText("Your request was approved")).toBeOnTheScreen();
    expect(screen.getByText("Vacation, 14 Sep to 18 Sep")).toBeOnTheScreen();
    expect(screen.getByText("2 h ago")).toBeOnTheScreen();
    expect(screen.getByText("3 d ago")).toBeOnTheScreen();
    expect(screen.getByTestId("notifications-unread-count")).toHaveTextContent("2 unread");
    expect(unreadDots()).toHaveLength(2);
  });

  it("marks a request notification read and opens the request's detail", async () => {
    serve();
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notification-n-request"));

    expect(push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "v-42" },
    });
    await waitFor(() => expect(calls("POST", "/api/notifications/n-request/read")).toHaveLength(1));
    await waitFor(() => expect(unreadDots()).toHaveLength(1));
    await settled();
  });

  it("marks a session notification read, leaves the list, then goes to My attendance on its day", async () => {
    serve();
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notification-n-day"));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance",
      params: { date: "2026-09-21" },
    });
    expect((router.back as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0]
    );
    await waitFor(() => expect(calls("POST", "/api/notifications/n-day/read")).toHaveLength(1));
    await settled();
  });

  it("stays on the list for a read notification with nowhere to go, and sends nothing", async () => {
    serve();
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notification-n-old"));

    expect(push).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(calls("POST", "/api/notifications/n-old/read")).toHaveLength(0);
  });

  it("still opens the request when marking it read fails, and shows it unread again", async () => {
    serve(SERVER, (method) => (method === "POST" ? new TypeError("Network request failed") : null));
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notification-n-request"));

    expect(push).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(en.sync.unreachable, expect.anything())
    );
    await waitFor(() => expect(unreadDots()).toHaveLength(2));
    await settled();
  });

  it("deletes a notification from its swipe action", async () => {
    serve();
    await renderScreen();
    await screen.findByTestId("notification-n-old");
    const swipe = screen.getAllByTestId("swipeable")[2];
    const deleteButton = within(swipe).getByTestId("notification-delete");
    expect(deleteButton.props.accessibilityLabel).toBe(en.notifications.deleteLabel("New comment"));

    await fireEvent.press(deleteButton);

    await waitFor(() => expect(screen.queryByTestId("notification-n-old")).toBeNull());
    expect(calls("DELETE", "/api/notifications/n-old")).toHaveLength(1);
    await settled();
  });

  it("deletes a notification through the VoiceOver delete action", async () => {
    serve();
    await renderScreen();

    const row = await screen.findByTestId("notification-n-day");
    expect(row.props.accessibilityActions).toEqual([
      { name: "delete", label: en.notifications.deleteLabel("Your session was closed") },
    ]);

    await fireEvent(row, "accessibilityAction", {
      nativeEvent: { actionName: "delete" },
    });

    await waitFor(() => expect(screen.queryByTestId("notification-n-day")).toBeNull());
    expect(calls("DELETE", "/api/notifications/n-day")).toHaveLength(1);
    await settled();
  });

  it("marks every notification read from the header", async () => {
    serve();
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notifications-mark-all-read"));

    await waitFor(() => expect(unreadDots()).toHaveLength(0));
    expect(calls("POST", "/api/notifications/read-all")).toHaveLength(1);
    expect(screen.getByTestId("notifications-unread-count")).toHaveTextContent(
      en.notifications.allRead
    );
    expect(screen.queryByTestId("notifications-mark-all-read")).toBeNull();
    await settled();
  });

  it("clears every notification from the header once the person confirms", async () => {
    serve();
    await renderScreen();

    await fireEvent.press(await screen.findByTestId("notifications-clear-all"));

    expect(alert).toHaveBeenCalledWith(
      en.notifications.clearConfirm.title,
      en.notifications.clearConfirm.body,
      expect.any(Array)
    );
    expect(calls("DELETE", "/api/notifications")).toHaveLength(0);

    const buttons = alert.mock.calls[0][2]!;
    const confirm = buttons.find((button) => button.style === "destructive");
    await act(async () => confirm?.onPress?.());

    expect(await screen.findByTestId("notifications-empty")).toBeOnTheScreen();
    expect(calls("DELETE", "/api/notifications")).toHaveLength(1);
    expect(screen.queryByTestId("notifications-clear-all")).toBeNull();
    await settled();
  });

  it("renders the empty state with no header actions when there is nothing", async () => {
    serve([]);
    await renderScreen();

    expect(await screen.findByText(en.notifications.empty)).toBeOnTheScreen();
    expect(screen.queryByTestId("notifications-mark-all-read")).toBeNull();
    expect(screen.queryByTestId("notifications-clear-all")).toBeNull();
  });

  it("offers Retry when the list can't be read, and shows it once it can", async () => {
    let offline = true;
    serve(SERVER, () => (offline ? new TypeError("Network request failed") : null));
    await renderScreen();

    const retry = await screen.findByTestId("notifications-retry", {}, { timeout: 4000 });
    expect(screen.getByText(en.sync.unreachable)).toBeOnTheScreen();

    offline = false;
    await fireEvent.press(retry);

    expect(await screen.findByText("Your request was approved")).toBeOnTheScreen();
  });

  it("goes back from the header", async () => {
    serve();
    await renderScreen();
    await screen.findByText("Your request was approved");

    await fireEvent.press(screen.getByTestId("notifications-back"));

    expect(router.back).toHaveBeenCalled();
  });
});

describe("the Czech unread count", () => {
  it("returns the 1, 2 to 4 and 5+ forms", () => {
    expect(cs.notifications.unreadCount(1)).toBe("1 nepřečtené");
    expect(cs.notifications.unreadCount(3)).toBe("3 nepřečtená");
    expect(cs.notifications.unreadCount(5)).toBe("5 nepřečtených");
  });
});
