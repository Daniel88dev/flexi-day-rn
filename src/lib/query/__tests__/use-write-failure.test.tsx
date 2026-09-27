import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { toast } from "sonner-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull } from "@/lib/local-store";
import { ApiError } from "@/lib/query/failure";
import { useWriteFailure } from "@/lib/query/use-write-failure";

jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const client = new QueryClient();

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </TranslationProvider>
  );
}

describe("useWriteFailure", () => {
  it("returns the handler on the app's toaster and sync pull", async () => {
    const { result } = await renderHook(() => useWriteFailure(), { wrapper });

    result.current(new ApiError(409, null), { queryKeys: [], retry: jest.fn() });

    expect(toast.error).toHaveBeenCalledWith(en.request.refused);
    expect(pull).toHaveBeenCalledWith("refresh");
  });
});
