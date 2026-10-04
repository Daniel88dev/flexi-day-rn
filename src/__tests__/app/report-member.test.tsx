import { render, screen } from "@testing-library/react-native";
import { router } from "expo-router";

import MemberReportRoute from "@/app/report/[userId]";
import { TranslationProvider } from "@/i18n/use-translation";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";

const mockParams: { userId: string; period?: string } = { userId: "u-erin" };
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  useLocalSearchParams: () => mockParams,
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));

async function renderMember(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <MemberReportRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockParams.period = "rolling";
});

describe("Member report route", () => {
  it("shows whose report it is and the period it was opened on, under the Report shell", async () => {
    await renderMember();

    expect(screen.getByTestId("report-member")).toBeOnTheScreen();
    expect(screen.getByTestId("report-member-user")).toHaveTextContent("u-erin");
    expect(screen.getByTestId("report-member-period")).toHaveTextContent("Last 12 months");
  });

  it("shows a calendar year period as the year", async () => {
    mockParams.period = "2025";

    await renderMember();

    expect(screen.getByTestId("report-member-period")).toHaveTextContent("2025");
  });

  it("sends a signed-out visitor to welcome", async () => {
    await renderMember("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell underneath a cold deep link and comes back on top with the same period", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderMember();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/report/[userId]",
      params: { userId: "u-erin", period: "rolling" },
    });
    expect(screen.queryByTestId("report-member")).toBeNull();
  });
});
