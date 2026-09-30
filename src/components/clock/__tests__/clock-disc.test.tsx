import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ClockDisc } from "@/components/clock/clock-disc";
import { TranslationProvider } from "@/i18n/use-translation";
import { qk } from "@/lib/query/keys";
import { attendance, session } from "@/test-support/attendance";

const mockFetch = jest.fn();

// The factory runs before `mockFetch` is assigned, so it reaches it through a closure.
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
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

async function renderDisc(seed: (client: QueryClient) => void, onPress = jest.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  seed(client);
  await render(
    <TranslationProvider>
      <QueryClientProvider client={client}>
        <ClockDisc onPress={onPress} />
      </QueryClientProvider>
    </TranslationProvider>
  );
  return onPress;
}

afterEach(() => onlineManager.setOnline(true));

describe("ClockDisc", () => {
  it("shows the running h:mm under the disc while clocked in, and opens the sheet", async () => {
    const open = session({ startedAt: new Date(Date.now() - 107 * 60_000).toISOString() });
    const onPress = await renderDisc((client) =>
      client.setQueryData(qk.attendanceState(), attendance({ openSession: open }))
    );

    expect(screen.getByText("1:47")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("clock-disc"));
    expect(onPress).toHaveBeenCalled();
  });

  it("keeps the slot empty when /current answers that there is no Employment", async () => {
    mockFetch.mockResolvedValue({
      status: 404,
      json: async () => ({ errors: [{ message: "No employment" }] }),
    });
    await renderDisc(() => undefined);

    expect(await screen.findByTestId("clock-slot-empty")).toBeTruthy();
    expect(screen.queryByTestId("clock-disc")).toBeNull();
  });

  it("reads its face label as the disc's value while the clock is reachable", async () => {
    await renderDisc((client) => client.setQueryData(qk.attendanceState(), attendance()));

    const disc = screen.getByTestId("clock-disc");
    expect(disc).toHaveAccessibilityValue({ text: "Clock" });
    expect(disc).not.toBeBusy();
  });

  it("says on the disc that the server can't be reached when the phone is offline", async () => {
    onlineManager.setOnline(false);
    await renderDisc((client) => client.setQueryData(qk.attendanceState(), attendance()));

    expect(screen.getByTestId("clock-disc")).toHaveAccessibilityValue({
      text: "Clock, Can't reach the server",
    });
    expect(screen.getByText("Clock")).toBeTruthy();
  });

  it("marks the disc busy while the first read is in flight", async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    await renderDisc(() => undefined);

    expect(screen.getByTestId("clock-disc")).toBeBusy();
  });
});
