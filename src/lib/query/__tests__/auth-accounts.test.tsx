import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import {
  fetchAuthAccounts,
  offersPasswordChange,
  useOffersPasswordChange,
} from "@/lib/query/auth-accounts";
import { ApiError, classifyFailure } from "@/lib/query/failure";
import { createQueryClient } from "@/lib/query/query-client";
import { authClient } from "@/lib/session/auth-client";

jest.mock("@/lib/session/auth-client", () => ({ authClient: { listAccounts: jest.fn() } }));

const listAccounts = authClient.listAccounts as unknown as jest.Mock;

const PASSWORD = { providerId: "credential" };
const GOOGLE = { providerId: "google" };

let client: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
});

afterEach(() => client.clear());

async function renderGate() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useOffersPasswordChange(), { wrapper });
}

describe("fetchAuthAccounts", () => {
  it("returns the accounts the auth client lists", async () => {
    await expect(fetchAuthAccounts(async () => ({ data: [PASSWORD] }))).resolves.toEqual([
      PASSWORD,
    ]);
  });

  it("throws an ApiError with the refusal's status, so the query layer sees it", async () => {
    const failed = fetchAuthAccounts(async () => ({
      data: null,
      error: { status: 401, message: "Unauthorized" },
    }));

    await expect(failed).rejects.toEqual(new ApiError(401, "Unauthorized"));
    expect(classifyFailure(await failed.catch((error: unknown) => error))).toEqual({
      kind: "signed-out",
    });
  });
});

describe("offersPasswordChange", () => {
  it("returns true when the account list has a credential account", () => {
    expect(offersPasswordChange({ data: [GOOGLE, PASSWORD], isError: false })).toBe(true);
  });

  it("returns false for an account that only signs in with Google or Microsoft", () => {
    expect(offersPasswordChange({ data: [GOOGLE], isError: false })).toBe(false);
  });

  it("returns false while the account list is still loading", () => {
    expect(offersPasswordChange({ data: undefined, isError: false })).toBe(false);
  });

  it("returns true when the account list could not be read", () => {
    expect(offersPasswordChange({ data: undefined, isError: true })).toBe(true);
  });
});

describe("useOffersPasswordChange", () => {
  it("returns true once the list shows a credential account", async () => {
    listAccounts.mockResolvedValue({ data: [GOOGLE, PASSWORD], error: null });
    const { result } = await renderGate();

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("returns false for an account without a credential account", async () => {
    listAccounts.mockResolvedValue({ data: [GOOGLE], error: null });
    const { result } = await renderGate();

    await waitFor(() => expect(client.getQueryState(["auth", "accounts"])?.status).toBe("success"));
    expect(result.current).toBe(false);
  });

  it("returns true when the lookup fails", async () => {
    listAccounts.mockResolvedValue({ data: null, error: { status: 500, message: "boom" } });
    const { result } = await renderGate();

    await waitFor(() => expect(result.current).toBe(true));
  });
});
