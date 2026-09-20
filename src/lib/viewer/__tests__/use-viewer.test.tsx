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

  it("returns nobody while no session has been read", async () => {
    useSession.mockReturnValue({ data: null });

    const { result } = await renderHook(() => useViewer());

    expect(result.current).toBeNull();
  });
});
