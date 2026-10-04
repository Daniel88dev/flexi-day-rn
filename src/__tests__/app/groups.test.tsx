import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { toast } from "sonner-native";

import GroupsRoute from "@/app/groups";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull, useMyGroups, useStoreOpen, type MyGroup } from "@/lib/local-store";
import { queryClient, type AdministeredGroup } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { administeredGroup } from "@/test-support/groups";
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

const NOW = new Date(2026, 9, 4, 9, 41);

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

type Answer = ReturnType<typeof answer>;

const ADMINISTERED = /\/api\/group\/administered$/;
let administeredReply: () => Answer | Promise<Answer>;
const serveAdministered = (groups: AdministeredGroup[]) => () => answer(200, groups);
const unreachable = () => Promise.reject(new TypeError("Network request failed"));
const never = () => new Promise<Answer>(() => undefined);

const administeredRequests = () =>
  mockFetch.mock.calls.filter(([url]) => ADMINISTERED.test(String(url))).length;

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeAll(() => {
  // A read that got no answer is tried once more; without the wait, so failures settle at once.
  queryClient.setDefaultOptions({
    ...queryClient.getDefaultOptions(),
    queries: { ...queryClient.getDefaultOptions().queries, retryDelay: 0 },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  // Only the date is fixed: the query layer's timers stay real.
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  mockCanGoBack.mockReturnValue(true);
  storeOpen.mockReturnValue(true);
  pullStore.mockResolvedValue({ ok: true });
  myGroups.mockReturnValue([]);
  administeredReply = serveAdministered([]);
  mockFetch.mockImplementation(async (url: string) => {
    if (!ADMINISTERED.test(String(url))) throw new Error(`Unexpected request ${String(url)}`);
    return administeredReply();
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

const administeredSection = () => screen.findByTestId("groups-administered");

async function pullToRefresh() {
  await act(async () => {
    screen.getByTestId("groups-scroll").props.refreshControl.props.onRefresh();
  });
}

type Rendered = ReturnType<typeof screen.toJSON> | string;

function testIDsInOrder(node: Rendered): string[] {
  if (node === null || typeof node === "string") return [];
  const own = typeof node.props.testID === "string" ? [node.props.testID as string] : [];
  return [...own, ...(node.children ?? []).flatMap(testIDsInOrder)];
}

// Where a test ID sits in the rendered tree, to compare the order of two sections.
const positionOf = (testID: string) => testIDsInOrder(screen.toJSON()).indexOf(testID);

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

  it("says so when the pull-to-refresh cannot reach the server", async () => {
    pullStore.mockRejectedValue(new Error("offline"));

    await renderGroups();
    await pullToRefresh();

    expect(toast.error).toHaveBeenCalledWith(en.sync.unreachable);
  });

  it("asks the server only for the groups the viewer administers, whatever the store's roles", async () => {
    myGroups.mockReturnValue([group({ role: "admin" })]);

    await renderGroups();

    await waitFor(() => expect(administeredRequests()).toBe(1));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("Groups you administer", () => {
  it("lists them under Your groups with a neutral monogram, the Org admin badge, the member count and the footnote", async () => {
    myGroups.mockReturnValue([group()]);
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();

    const section = within(await administeredSection());
    expect(section.getByText(en.groups.administered.heading)).toBeOnTheScreen();
    const card = within(section.getByTestId("group-card-group-2"));
    expect(card.getByText("Dev Support")).toBeOnTheScreen();
    expect(card.getByText("Olivia Owner")).toBeOnTheScreen();
    expect(card.getByTestId("org-admin-badge")).toHaveTextContent(en.groups.orgAdmin);
    expect(card.getByText("3 members")).toBeOnTheScreen();
    expect(card.getByTestId("monogram-neutral", { includeHiddenElements: true })).toBeTruthy();
    expect(card.queryByText(/vacation days/)).toBeNull();
    expect(section.getByTestId("groups-administered-footnote")).toHaveTextContent(
      en.groups.administered.footnote
    );
    expect(section.queryByTestId("groups-administered-stale")).toBeNull();
    expect(positionOf("groups-yours")).toBeGreaterThanOrEqual(0);
    expect(positionOf("groups-yours")).toBeLessThan(positionOf("groups-administered"));
    expect(
      within(screen.getByTestId("group-card-group-1")).getByTestId("monogram", {
        includeHiddenElements: true,
      })
    ).toBeTruthy();
  });

  it("badges a group the viewer manages without belonging to it Manager, and counts one member", async () => {
    administeredReply = serveAdministered([
      administeredGroup({ viaOrgAdmin: false, memberCount: 1 }),
    ]);

    await renderGroups();

    const card = within(within(await administeredSection()).getByTestId("group-card-group-2"));
    expect(card.getByTestId("role-badge-manager")).toHaveTextContent("Manager");
    expect(card.queryByTestId("org-admin-badge")).toBeNull();
    expect(card.getByText("1 member")).toBeOnTheScreen();
  });

  it("names an administered card for VoiceOver by group, organization, badge and member count", async () => {
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();
    await administeredSection();

    expect(screen.getByTestId("group-card-group-2")).toHaveAccessibleName(
      "Dev Support, Olivia Owner, Org admin, 3 members"
    );
  });

  it("stays hidden until the administered read first answers", async () => {
    myGroups.mockReturnValue([group()]);
    administeredReply = never;

    await renderGroups();

    await waitFor(() => expect(administeredRequests()).toBe(1));
    expect(screen.getByTestId("groups-yours")).toBeOnTheScreen();
    expect(screen.queryByTestId("groups-administered")).toBeNull();
    expect(screen.queryByText(en.groups.administered.heading)).toBeNull();
  });

  it("stays hidden when the viewer administers no group", async () => {
    myGroups.mockReturnValue([group()]);

    await renderGroups();

    await waitFor(() => expect(queryClient.getQueryData(["groups", "administered"])).toEqual([]));
    expect(screen.queryByTestId("groups-administered")).toBeNull();
  });

  it("stays hidden when the first read fails, as on an offline cold start", async () => {
    myGroups.mockReturnValue([group()]);
    administeredReply = unreachable;

    await renderGroups();

    await waitFor(() =>
      expect(queryClient.getQueryState(["groups", "administered"])?.status).toBe("error")
    );
    expect(screen.queryByTestId("groups-administered")).toBeNull();
    expect(screen.queryByText(/Offline/)).toBeNull();
    expect(screen.getByTestId("group-card-group-1")).toBeOnTheScreen();
  });

  it("keeps this run's groups after a failed refetch, saying when they were read", async () => {
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();
    await administeredSection();
    administeredReply = unreachable;

    await pullToRefresh();

    expect(await screen.findByTestId("groups-administered-stale")).toHaveTextContent(
      "Offline, updated 09:41"
    );
    expect(screen.getByTestId("group-card-group-2")).toBeOnTheScreen();
    expect(screen.getByTestId("groups-administered-footnote")).toBeOnTheScreen();
  });

  it("shows the empty card above the administered groups for an org admin without groups of their own", async () => {
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();
    await administeredSection();

    expect(positionOf("groups-empty")).toBeGreaterThanOrEqual(0);
    expect(positionOf("groups-empty")).toBeLessThan(positionOf("groups-administered"));
    expect(screen.queryByTestId("groups-yours")).toBeNull();
  });

  it("pushes an administered group's detail when its card is tapped", async () => {
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();
    await administeredSection();
    await fireEvent.press(screen.getByTestId("group-card-group-2"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "group-2" },
    });
  });

  it("runs the sync pull and reads the administered groups again on pull-to-refresh", async () => {
    myGroups.mockReturnValue([group()]);
    administeredReply = serveAdministered([administeredGroup()]);

    await renderGroups();
    await administeredSection();
    expect(administeredRequests()).toBe(1);

    await pullToRefresh();

    expect(pullStore).toHaveBeenCalledWith("refresh");
    await waitFor(() => expect(administeredRequests()).toBe(2));
  });
});
