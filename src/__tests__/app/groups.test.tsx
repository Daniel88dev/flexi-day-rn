import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { toast } from "sonner-native";

import GroupsRoute from "@/app/groups";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull, useMyGroups, useStoreOpen, type MyGroup } from "@/lib/local-store";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn(),
  useMyGroups: jest.fn(),
  useStoreOpen: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const myGroups = useMyGroups as jest.MockedFunction<typeof useMyGroups>;
const storeOpen = useStoreOpen as jest.MockedFunction<typeof useStoreOpen>;
const pullStore = pull as jest.MockedFunction<typeof pull>;

function group(patch: Partial<MyGroup> = {}): MyGroup {
  return {
    id: "group-1",
    name: "Dev Team",
    organizationName: "Olivia Owner",
    defaultVacationDays: 20,
    defaultHomeOfficeDays: 0,
    defaultSickDays: 0,
    workingDays: [1, 2, 3, 4, 5],
    holidayCountry: null,
    role: null,
    ...patch,
  };
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  storeOpen.mockReturnValue(true);
  pullStore.mockResolvedValue({ ok: true });
  myGroups.mockReturnValue([]);
});

async function renderGroups(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <GroupsRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("Groups route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderGroups("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under Groups when a cold deep link opened it on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderGroups();

    expect(screen.toJSON()).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/groups");
  });

  it("renders nothing until the Local store is open", async () => {
    storeOpen.mockReturnValue(false);

    await renderGroups();

    expect(screen.toJSON()).toBeNull();
  });

  it("lists one card per group with its organization and defaults", async () => {
    myGroups.mockReturnValue([
      group(),
      group({
        id: "group-2",
        name: "Dev Support",
        organizationName: "Northwind",
        defaultVacationDays: 25,
        defaultHomeOfficeDays: 10,
      }),
    ]);

    await renderGroups();

    expect(screen.getByText(en.groups.yourGroups)).toBeOnTheScreen();
    const first = within(screen.getByTestId("group-card-group-1"));
    expect(first.getByText("Dev Team")).toBeOnTheScreen();
    expect(first.getByText("Olivia Owner")).toBeOnTheScreen();
    expect(first.getByText("20 vacation days · 0 home office")).toBeOnTheScreen();
    const second = within(screen.getByTestId("group-card-group-2"));
    expect(second.getByText("Northwind")).toBeOnTheScreen();
    expect(second.getByText("25 vacation days · 10 home office")).toBeOnTheScreen();
    expect(screen.queryByTestId("groups-empty")).toBeNull();
  });

  it("badges each card by the viewer's role, and a plain member's card not at all", async () => {
    myGroups.mockReturnValue([
      group({ id: "managed", role: "manager" }),
      group({ id: "administered", role: "admin" }),
      group({ id: "approved", role: "approver" }),
      group({ id: "plain", role: null }),
    ]);

    await renderGroups();

    expect(within(screen.getByTestId("group-card-managed")).getByText("Manager")).toBeTruthy();
    expect(within(screen.getByTestId("group-card-administered")).getByText("Admin")).toBeTruthy();
    expect(within(screen.getByTestId("group-card-approved")).getByText("Approver")).toBeTruthy();
    const plain = within(screen.getByTestId("group-card-plain"));
    expect(plain.queryByText("Manager")).toBeNull();
    expect(plain.queryByText("Admin")).toBeNull();
    expect(plain.queryByText("Approver")).toBeNull();
  });

  it("names the card for VoiceOver by group, organization, role and defaults", async () => {
    myGroups.mockReturnValue([group({ role: "manager" })]);

    await renderGroups();

    expect(screen.getByTestId("group-card-group-1")).toHaveAccessibleName(
      "Dev Team, Olivia Owner, Manager, 20 vacation days · 0 home office"
    );
  });

  it("pushes the group's detail when its card is tapped", async () => {
    myGroups.mockReturnValue([group()]);

    await renderGroups();
    await fireEvent.press(screen.getByTestId("group-card-group-1"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "group-1" },
    });
  });

  it("shows the empty card with the web's groups page when the store holds no groups", async () => {
    await renderGroups();

    const empty = within(screen.getByTestId("groups-empty"));
    expect(empty.getByText(en.groups.empty.title)).toBeOnTheScreen();
    expect(screen.queryByText(en.groups.yourGroups)).toBeNull();

    await fireEvent.press(screen.getByTestId("groups-empty-create-on-web"));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      expect.stringMatching(/\/groups\/$/),
      expect.anything()
    );
  });

  it("runs the sync pull on pull-to-refresh", async () => {
    myGroups.mockReturnValue([group()]);

    await renderGroups();
    await act(async () => {
      screen.getByTestId("groups-scroll").props.refreshControl.props.onRefresh();
    });

    expect(pullStore).toHaveBeenCalledWith("refresh");
  });

  it("says so when the pull-to-refresh cannot reach the server", async () => {
    pullStore.mockRejectedValue(new Error("offline"));

    await renderGroups();
    await act(async () => {
      screen.getByTestId("groups-scroll").props.refreshControl.props.onRefresh();
    });

    expect(toast.error).toHaveBeenCalledWith(en.sync.unreachable);
  });

  it("sends no request of its own", async () => {
    myGroups.mockReturnValue([group({ role: "admin" })]);

    await renderGroups();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
