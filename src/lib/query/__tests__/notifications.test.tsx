import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  useHasUnreadNotifications,
  useNotifications,
  useNotificationWrites,
  useRereadNotificationsOnFocus,
  type AppNotification,
} from "@/lib/query/notifications";
import { qk } from "@/lib/query/keys";
import { queryClient } from "@/lib/query/runtime";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
let mockFocus: () => void = () => undefined;
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const toastError = toast.error as unknown as jest.Mock<
  void,
  [string, { action: { label: string; onClick: () => void } }?]
>;

function notification(id: string, readAt: string | null): AppNotification {
  return {
    id,
    type: "approval_decided",
    title: `Title ${id}`,
    body: `Body ${id}`,
    href: null,
    readAt,
    createdAt: "2026-09-27T08:00:00.000Z",
  };
}

const SERVER = [
  notification("n-1", null),
  notification("n-2", "2026-09-26T08:00:00.000Z"),
  notification("n-3", null),
];

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

type Route = { method: string; path: string };

/** A backend that keeps its notifications and changes them the way the real one does. */
function fakeServer(fail?: (route: Route) => unknown) {
  let stored = SERVER.map((row) => ({ ...row }));
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const route = { method: init?.method ?? "GET", path: new URL(String(url)).pathname };
    const failure = await fail?.(route);
    if (failure instanceof Error) throw failure;
    if (failure) return failure;

    const read = /^\/api\/notifications\/([^/]+)\/read$/.exec(route.path);
    const one = /^\/api\/notifications\/([^/]+)$/.exec(route.path);
    if (route.method === "POST" && route.path === "/api/notifications/read-all") {
      stored = stored.map((row) => ({ ...row, readAt: row.readAt ?? "2026-09-27T09:00:00.000Z" }));
      return answer(200, { message: "ok", updated: 2 });
    }
    if (route.method === "POST" && read) {
      stored = stored.map((row) =>
        row.id === read[1] ? { ...row, readAt: "2026-09-27T09:00:00.000Z" } : row
      );
      return answer(200, { message: "ok" });
    }
    if (route.method === "DELETE" && route.path === "/api/notifications") {
      stored = [];
      return answer(200, { message: "ok", removed: 3 });
    }
    if (route.method === "DELETE" && one) {
      stored = stored.filter((row) => row.id !== one[1]);
      return answer(200, { message: "ok" });
    }
    return answer(200, stored);
  });
}

function calls(method: string, path?: string) {
  return mockFetch.mock.calls.filter(
    ([url, init]) =>
      (init?.method ?? "GET") === method &&
      (path === undefined || new URL(String(url)).pathname === path)
  );
}

function Probe() {
  const { data, isError } = useNotifications();
  const unread = useHasUnreadNotifications();
  const writes = useNotificationWrites();
  return (
    <>
      <Text testID="list">
        {isError
          ? "failed"
          : data
            ? data.map((row) => `${row.id}:${row.readAt ? "read" : "unread"}`).join(" ")
            : "waiting"}
      </Text>
      <Text testID="dot">{unread ? "dot" : "no dot"}</Text>
      <Text testID="busy">{writes.busy ?? "idle"}</Text>
      <Pressable testID="read-n-1" onPress={() => writes.markRead("n-1")} />
      <Pressable testID="remove-n-2" onPress={() => writes.remove("n-2")} />
      <Pressable testID="read-all" onPress={writes.markAllRead} />
      <Pressable testID="clear-all" onPress={writes.clearAll} />
    </>
  );
}

async function renderProbe() {
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    </TranslationProvider>
  );
  await screen.findByText("n-1:unread n-2:read n-3:unread");
}

const expectList = (text: string) =>
  waitFor(() => expect(screen.getByTestId("list")).toHaveTextContent(text, { exact: true }));

/** The server answers every request but those with `method`, which wait until released. */
function hold(method: string): () => void {
  const waiting: (() => void)[] = [];
  fakeServer((route) =>
    route.method === method
      ? new Promise<null>((resolve) => waiting.push(() => resolve(null)))
      : null
  );
  return () => waiting.forEach((release) => release());
}

// A finished mutation waits five minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

beforeEach(() => jest.clearAllMocks());
afterEach(() => queryClient.clear());

describe("useNotifications", () => {
  it("returns every notification of the viewer from /api/notifications", async () => {
    fakeServer();
    await renderProbe();

    const [[url]] = calls("GET");
    expect(String(url)).toMatch(/\/api\/notifications$/);
  });

  it("returns a failed read, not a crash, when the answer is not a list", async () => {
    mockFetch.mockResolvedValue(answer(200, { organizationId: "org-1" }));
    await render(
      <TranslationProvider>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </TranslationProvider>
    );

    expect(await screen.findByText("failed", {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByTestId("dot")).toHaveTextContent("no dot");
  });
});

describe("useRereadNotificationsOnFocus", () => {
  it("reads the list again each time the screen comes back into focus", async () => {
    function Focused() {
      useRereadNotificationsOnFocus();
      return <Probe />;
    }
    fakeServer();
    await render(
      <TranslationProvider>
        <QueryClientProvider client={queryClient}>
          <Focused />
        </QueryClientProvider>
      </TranslationProvider>
    );
    await screen.findByText("n-1:unread n-2:read n-3:unread");

    await act(async () => mockFocus());
    expect(calls("GET")).toHaveLength(1);

    await act(async () => mockFocus());
    await waitFor(() => expect(calls("GET")).toHaveLength(2));
  });
});

describe("useHasUnreadNotifications", () => {
  it("returns true while any notification is unread", async () => {
    fakeServer();
    await renderProbe();

    expect(screen.getByTestId("dot")).toHaveTextContent("dot");
  });

  it("returns false once every notification is read", async () => {
    fakeServer();
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("read-all")));

    expect(await screen.findByText("no dot")).toBeOnTheScreen();
  });

  it("returns false while nothing has been read", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await render(
      <TranslationProvider>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </TranslationProvider>
    );

    expect(screen.getByTestId("dot")).toHaveTextContent("no dot");
  });
});

describe("useNotificationWrites", () => {
  it("marks one read at once, sends it, and reads the list again once the server answers", async () => {
    const answered = hold("POST");
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("read-n-1")));

    await expectList("n-1:read n-2:read n-3:unread");
    expect(calls("POST", "/api/notifications/n-1/read")).toHaveLength(1);
    expect(calls("GET")).toHaveLength(1);

    await act(async () => answered());
    await waitFor(() => expect(calls("GET")).toHaveLength(2));
  });

  it("puts a failed mark read back and toasts a Retry that sends it again", async () => {
    let offline = true;
    fakeServer(({ method }) =>
      method === "POST" && offline ? new TypeError("Network request failed") : null
    );
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("read-n-1")));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(en.sync.unreachable, {
        action: { label: en.request.retry, onClick: expect.any(Function) },
      })
    );
    await expectList("n-1:unread n-2:read n-3:unread");

    offline = false;
    await act(async () => toastError.mock.calls[0][1]!.action.onClick());

    await expectList("n-1:read n-2:read n-3:unread");
    expect(calls("POST", "/api/notifications/n-1/read")).toHaveLength(2);
  });

  it("drops a removed notification at once and deletes it on the server", async () => {
    const answered = hold("DELETE");
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("remove-n-2")));

    await expectList("n-1:unread n-3:unread");
    expect(calls("DELETE", "/api/notifications/n-2")).toHaveLength(1);

    await act(async () => answered());
    await waitFor(() => expect(calls("GET")).toHaveLength(2));
    await expectList("n-1:unread n-3:unread");
  });

  it("brings a notification the server did not delete back, with the server's message", async () => {
    fakeServer(({ method }) =>
      method === "DELETE" ? answer(404, { message: "Notification not found" }) : null
    );
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("remove-n-2")));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Notification not found"));
    await expectList("n-1:unread n-2:read n-3:unread");
  });

  it("marks every notification read and reads the list again", async () => {
    fakeServer();
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("read-all")));

    await expectList("n-1:read n-2:read n-3:read");
    expect(calls("POST", "/api/notifications/read-all")).toHaveLength(1);
    await waitFor(() => expect(calls("GET")).toHaveLength(2));
  });

  it("clears every notification and reads the list again", async () => {
    fakeServer();
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("clear-all")));

    await expectList("");
    expect(calls("DELETE", "/api/notifications")).toHaveLength(1);
    await waitFor(() => expect(calls("GET")).toHaveLength(2));
  });

  it("names Clear all while it is in flight", async () => {
    const answered = hold("DELETE");
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("clear-all")));
    expect(await screen.findByText("clearAll")).toBeOnTheScreen();

    await act(async () => answered());
    expect(await screen.findByText("idle")).toBeOnTheScreen();
  });

  it("names Mark all read while it is in flight", async () => {
    hold("POST");
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("read-all")));

    expect(await screen.findByText("markAllRead")).toBeOnTheScreen();
  });

  it("takes back only the failed write while another one is still in flight", async () => {
    const release: Record<string, () => void> = {};
    fakeServer(({ method }) => {
      if (method === "DELETE") {
        return new Promise((resolve) => {
          release.remove = () => resolve(answer(500, { message: "Something broke." }));
        });
      }
      if (method === "POST") {
        return new Promise<null>((resolve) => {
          release.read = () => resolve(null);
        });
      }
      return null;
    });
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("remove-n-2")));
    await act(async () => fireEvent.press(screen.getByTestId("read-n-1")));
    await expectList("n-1:read n-3:unread");

    await act(async () => release.remove());

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    await expectList("n-1:read n-2:read n-3:unread");
    expect(calls("GET")).toHaveLength(1);

    await act(async () => release.read());

    await waitFor(() => expect(calls("GET")).toHaveLength(2));
    await expectList("n-1:read n-2:read n-3:unread");
  });

  it("keeps a read that landed during a failed write", async () => {
    let fail: () => void = () => undefined;
    let answerReads = true;
    fakeServer(({ method }) => {
      if (method === "DELETE") {
        return new Promise((resolve) => {
          fail = () => resolve(answer(500, { message: "Something broke." }));
        });
      }
      return method === "GET" && !answerReads ? new Promise(() => {}) : null;
    });
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("remove-n-2")));
    await expectList("n-1:unread n-3:unread");
    await act(async () =>
      queryClient.setQueryData(qk.notifications(false), [
        notification("n-0", null),
        ...SERVER.filter((row) => row.id !== "n-2"),
      ])
    );
    answerReads = false;

    await act(async () => fail());

    await expectList("n-0:unread n-1:unread n-2:read n-3:unread");
  });

  it("brings the list back when Clear all fails", async () => {
    fakeServer(({ method }) =>
      method === "DELETE" ? answer(500, { message: "Something broke." }) : null
    );
    await renderProbe();

    await act(async () => fireEvent.press(screen.getByTestId("clear-all")));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Something broke.", {
        action: { label: en.request.retry, onClick: expect.any(Function) },
      })
    );
    await expectList("n-1:unread n-2:read n-3:unread");
  });
});
