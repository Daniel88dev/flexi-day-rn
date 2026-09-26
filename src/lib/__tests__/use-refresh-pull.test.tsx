import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull, type PullOutcome } from "@/lib/local-store";

import { useRefreshPull } from "../use-refresh-pull";

jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));

const pullStore = pull as jest.MockedFunction<typeof pull>;
const toastError = toast.error as jest.MockedFunction<typeof toast.error>;

beforeEach(() => {
  jest.clearAllMocks();
});

function wrapper({ children }: { children: ReactNode }) {
  return <TranslationProvider>{children}</TranslationProvider>;
}

async function refresh() {
  const hook = await renderHook(() => useRefreshPull(), { wrapper });
  await act(async () => hook.result.current.refresh());
  return hook;
}

describe("useRefreshPull", () => {
  it("returns refreshing from the gesture until the pull resolves", async () => {
    let settle: (outcome: PullOutcome) => void = () => {};
    pullStore.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const { result } = await refresh();

    expect(pullStore).toHaveBeenCalledWith("refresh");
    expect(result.current.refreshing).toBe(true);

    await act(async () => settle({ ok: true }));

    expect(result.current.refreshing).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("toasts the server's message when the pull fails", async () => {
    pullStore.mockResolvedValue({ ok: false, message: "Your session expired." });
    await refresh();

    expect(toastError).toHaveBeenCalledWith("Your session expired.");
  });

  it("toasts the unreachable copy when the pull fails without a message", async () => {
    pullStore.mockResolvedValue({ ok: false, message: null });
    await refresh();

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable);
  });

  it("toasts the unreachable copy and settles when the pull rejects", async () => {
    pullStore.mockRejectedValue(new Error("The local store is not open."));
    const { result } = await refresh();

    expect(toastError).toHaveBeenCalledWith(en.sync.unreachable);
    expect(result.current.refreshing).toBe(false);
  });
});
