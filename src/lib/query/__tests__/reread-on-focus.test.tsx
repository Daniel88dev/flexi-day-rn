import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useRereadOnFocus } from "@/lib/query/reread-on-focus";

let mockFocus: () => void = () => undefined;

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    mockFocus = effect;
  },
}));

const read = jest.fn();
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function useScreen() {
  useQuery({ queryKey: ["dashboard-summary"], queryFn: read });
  useRereadOnFocus([["dashboard-summary"]]);
}

beforeEach(() => {
  read.mockReset().mockResolvedValue({});
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
});

afterEach(() => client.clear());

describe("useRereadOnFocus", () => {
  it("reads nothing more on the first focus, which the mount already read for", async () => {
    await renderHook(useScreen, { wrapper });
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    await act(async () => mockFocus());

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads the keys again each time the screen comes back into focus", async () => {
    await renderHook(useScreen, { wrapper });
    await act(async () => mockFocus());

    await act(async () => mockFocus());
    await act(async () => mockFocus());

    await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
  });
});
