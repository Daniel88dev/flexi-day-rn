import { renderHook } from "@testing-library/react-native";
import { router } from "expo-router";
import type { ReactNode } from "react";

import { useShellUnderneath } from "@/lib/navigation/use-shell-underneath";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";

const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
}));

const HREF = { pathname: "/requests/new", params: { date: "2026-10-05" } } as const;

function renderShell(route: RootRoute, underneath?: Parameters<typeof useShellUnderneath>[1]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootRouteProvider route={route}>{children}</RootRouteProvider>
  );
  return renderHook(() => useShellUnderneath(HREF, underneath), { wrapper });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

describe("useShellUnderneath", () => {
  it("returns false and moves nothing for a screen opened over the shell", async () => {
    const { result } = await renderShell("signed-in");

    expect(result.current).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("returns true and puts the shell under a screen a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    const { result } = await renderShell("signed-in");

    expect(result.current).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith(HREF);
  });

  it("puts the tab the screen names under it instead of the dashboard", async () => {
    mockCanGoBack.mockReturnValue(false);
    const tab = { pathname: "/my-attendance", params: { date: "2026-09-24" } } as const;

    await renderShell("signed-in", tab);

    expect(router.replace).toHaveBeenCalledWith(tab);
    expect(router.push).toHaveBeenCalledWith(HREF);
  });

  it("moves nothing for a visitor the screen sends to welcome", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderShell("welcome");

    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
