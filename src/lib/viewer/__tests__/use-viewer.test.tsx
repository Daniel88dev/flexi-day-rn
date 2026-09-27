import { renderHook } from "@testing-library/react-native";

import { authClient } from "@/lib/session/auth-client";
import { useViewer } from "@/lib/viewer/use-viewer";
import { SESSION, VIEWER } from "@/test-support/session";

jest.mock("@/lib/session/auth-client", () => ({ authClient: { useSession: jest.fn() } }));

const useSession = authClient.useSession as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useViewer", () => {
  it("returns the signed-in user of the session", async () => {
    useSession.mockReturnValue(SESSION);

    const { result } = await renderHook(() => useViewer());

    expect(result.current).toEqual(VIEWER);
  });

  it("returns two-factor as on only when the session's user has it on", async () => {
    useSession.mockReturnValue({ data: { user: { ...VIEWER, twoFactorEnabled: true } } });
    const { result, rerender } = await renderHook(() => useViewer());
    expect(result.current?.twoFactorEnabled).toBe(true);

    // The two-factor client's session signal re-reads the session; the viewer follows it.
    useSession.mockReturnValue({ data: { user: { ...VIEWER, twoFactorEnabled: null } } });
    await rerender({});
    expect(result.current?.twoFactorEnabled).toBe(false);
  });

  it("returns nobody while no session has been read", async () => {
    useSession.mockReturnValue({ data: null });

    const { result } = await renderHook(() => useViewer());

    expect(result.current).toBeNull();
  });
});
