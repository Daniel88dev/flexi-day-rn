import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import Screen from "@/app/my-attendance/entry";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockCanGoBack = jest.fn(() => true);
const mockParams: { date?: string } = {};
const mockSheet = jest.fn();

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("@/components/attendance/entry-sheet", () => ({
  EntrySheet: (props: object) => {
    mockSheet(props);
    return null;
  },
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));

type SheetProps = { openedOn: string; onSaved: (date: string) => void; onClose: () => void };
const sheetProps = () => mockSheet.mock.lastCall?.[0] as SheetProps;

async function renderRoute(route: RootRoute) {
  await render(
    <RootRouteProvider route={route}>
      <Screen />
    </RootRouteProvider>
  );
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 8, 27, 12), doNotFake: ["setImmediate", "nextTick"] });
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockParams.date = "2026-09-24";
});

afterEach(() => jest.useRealTimers());

describe("The entry sheet route", () => {
  it("opens the sheet on the linked day", async () => {
    await renderRoute("signed-in");

    expect(sheetProps().openedOn).toBe("2026-09-24");
  });

  it("opens on today for a day still to come", async () => {
    mockParams.date = "2026-10-02";
    await renderRoute("signed-in");

    expect(sheetProps().openedOn).toBe("2026-09-27");
  });

  it("closes the sheet, then opens My attendance on the day it saved", async () => {
    await renderRoute("signed-in");

    sheetProps().onSaved("2026-09-23");

    expect(router.back).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: "/my-attendance",
      params: { date: "2026-09-23" },
    });
  });

  it("puts My attendance under a cold deep link, then opens the sheet over it", async () => {
    mockCanGoBack.mockReturnValue(false);
    await renderRoute("signed-in");

    expect(router.replace).toHaveBeenCalledWith({
      pathname: "/my-attendance",
      params: { date: "2026-09-24" },
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/my-attendance/entry",
      params: { date: "2026-09-24" },
    });
    expect(mockSheet).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
    expect(mockSheet).not.toHaveBeenCalled();
  });
});
