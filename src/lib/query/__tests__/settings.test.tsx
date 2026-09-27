import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { queryClient } from "@/lib/query/runtime";
import { useMySettings } from "@/lib/query/settings";

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

function SettingsProbe() {
  const { data, isError } = useMySettings();
  if (isError) return <Text>failed</Text>;
  return <Text>{data ? `${data.dashboardScope} ${data.dashboardGroupId}` : "waiting"}</Text>;
}

function renderProbe() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsProbe />
    </QueryClientProvider>
  );
}

afterEach(() => queryClient.clear());

describe("useMySettings", () => {
  it("returns the viewer's settings from /api/users/me/settings", async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({ dashboardScope: "GROUP", dashboardGroupId: "g-1" }),
    });

    await renderProbe();

    expect(await screen.findByText("GROUP g-1")).toBeOnTheScreen();
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/users\/me\/settings$/);
  });

  it("returns no data while the server cannot be reached", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await renderProbe();

    expect(await screen.findByText("failed", {}, { timeout: 5000 })).toBeOnTheScreen();
  });
});
