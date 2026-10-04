import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { useHolidayCountries } from "@/lib/query/groups";
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

const COUNTRIES = [
  { code: "CZ", name: "Czechia" },
  { code: "SK", name: "Slovakia" },
];

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

function CountriesProbe({ enabled }: { enabled?: boolean }) {
  const { data } = useHolidayCountries({ enabled });
  return <Text testID="countries">{data ? data.map((c) => c.name).join(", ") : "waiting"}</Text>;
}

async function renderProbe(enabled?: boolean) {
  await render(
    <QueryClientProvider client={queryClient}>
      <CountriesProbe enabled={enabled} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(answer(200, COUNTRIES));
});

afterEach(() => queryClient.clear());

describe("useHolidayCountries", () => {
  it("returns the countries the backend's holiday dataset supports", async () => {
    await renderProbe();

    await waitFor(() =>
      expect(screen.getByTestId("countries")).toHaveTextContent("Czechia, Slovakia")
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/bank-holidays\/countries$/);
    expect(init?.method).toBeUndefined();
  });

  it("returns the answer under the web's key", async () => {
    await renderProbe();

    await waitFor(() =>
      expect(queryClient.getQueryData(qk.bankHolidayCountries())).toEqual(COUNTRIES)
    );
  });

  it("sends nothing while it is not enabled", async () => {
    await renderProbe(false);

    expect(screen.getByTestId("countries")).toHaveTextContent("waiting");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
