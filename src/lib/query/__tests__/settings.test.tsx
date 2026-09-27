import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query/runtime";
import { useMySettings, useSaveMySettings } from "@/lib/query/settings";

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
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const toastError = toast.error as unknown as jest.Mock<
  void,
  [string, { action: { label: string; onClick: () => void } }?]
>;

const STORED = {
  emailNotifications: true,
  dashboardScope: "MINE",
  dashboardGroupId: null,
  dashboardCalendarView: "LANES",
  attendanceLocationNoticeDismissed: false,
};

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

/** A backend that keeps what a PUT sends, the way the real one does. */
function fakeServer() {
  let stored = { ...STORED };
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") stored = { ...stored, ...JSON.parse(String(init.body)) };
    return answer(200, stored);
  });
}

function calls(method: string) {
  return mockFetch.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
}

function SettingsProbe() {
  const { data, isError } = useMySettings();
  if (isError) return <Text>failed</Text>;
  return <Text>{data ? `${data.dashboardScope} ${data.dashboardGroupId}` : "waiting"}</Text>;
}

function SaveProbe() {
  const { settings, save } = useSaveMySettings();
  return (
    <>
      <Text testID="email">{settings ? String(settings.emailNotifications) : "waiting"}</Text>
      <Pressable testID="turn-off" onPress={() => save({ emailNotifications: false })} />
    </>
  );
}

function renderWithClient(children: React.ReactNode) {
  return render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TranslationProvider>
  );
}

// A finished mutation waits five minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

beforeEach(() => jest.clearAllMocks());
afterEach(() => queryClient.clear());

describe("useMySettings", () => {
  it("returns the viewer's settings from /api/users/me/settings", async () => {
    mockFetch.mockResolvedValue(answer(200, { dashboardScope: "GROUP", dashboardGroupId: "g-1" }));

    await renderWithClient(<SettingsProbe />);

    expect(await screen.findByText("GROUP g-1")).toBeOnTheScreen();
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/users\/me\/settings$/);
  });

  it("reads nothing while disabled and returns what the cache holds", async () => {
    function Disabled() {
      const { data } = useMySettings({ enabled: false });
      return <Text>{data ? data.dashboardScope : "nothing"}</Text>;
    }
    await renderWithClient(<Disabled />);
    expect(screen.getByText("nothing")).toBeOnTheScreen();

    await act(async () => queryClient.setQueryData(["my-settings"], STORED));

    expect(await screen.findByText("MINE")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns no data while the server cannot be reached", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await renderWithClient(<SettingsProbe />);

    expect(await screen.findByText("failed", {}, { timeout: 5000 })).toBeOnTheScreen();
  });
});

describe("useSaveMySettings", () => {
  it("sends only the change through PUT /api/users/me/settings and reads the settings again", async () => {
    fakeServer();
    await renderWithClient(<SaveProbe />);
    expect(await screen.findByText("true")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("turn-off")));

    expect(await screen.findByText("false")).toBeOnTheScreen();
    const [[url, init]] = calls("PUT");
    expect(String(url)).toMatch(/\/api\/users\/me\/settings$/);
    expect(JSON.parse(String(init.body))).toEqual({ emailNotifications: false });
    expect(calls("GET")).toHaveLength(2);
  });

  it("shows the change while the save is in flight", async () => {
    let settle: (value: unknown) => void = () => {};
    mockFetch.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Promise((resolve) => (settle = resolve))
        : Promise.resolve(answer(200, STORED))
    );
    await renderWithClient(<SaveProbe />);
    expect(await screen.findByText("true")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("turn-off")));

    expect(await screen.findByText("false")).toBeOnTheScreen();
    await act(async () => settle(answer(200, { ...STORED, emailNotifications: false })));
  });

  it("puts the stored value back and toasts a Retry that sends the same change when no answer arrives", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") throw new TypeError("Network request failed");
      return answer(200, STORED);
    });
    await renderWithClient(<SaveProbe />);
    expect(await screen.findByText("true")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("turn-off")));

    expect(await screen.findByText("true")).toBeOnTheScreen();
    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable, {
      action: { label: en.request.retry, onClick: expect.any(Function) },
    });

    const retry = toastError.mock.calls[0][1]!.action.onClick;
    await act(async () => retry());

    const puts = calls("PUT");
    expect(puts).toHaveLength(2);
    expect(JSON.parse(String(puts[1][1].body))).toEqual({ emailNotifications: false });
  });

  it("toasts the server's message without a Retry when the server refuses the change", async () => {
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? answer(403, { message: "No access to that group." })
        : answer(200, STORED)
    );
    await renderWithClient(<SaveProbe />);
    expect(await screen.findByText("true")).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByTestId("turn-off")));

    expect(await screen.findByText("true")).toBeOnTheScreen();
    expect(toastError).toHaveBeenCalledWith("No access to that group.");
  });
});
