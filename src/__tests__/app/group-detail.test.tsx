import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import GroupDetailRoute from "@/app/groups/[groupId]";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useMyGroups, useStoreOpen, type MyGroup } from "@/lib/local-store";
import { queryClient, type GroupDetail } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { GROUP_ACCESS, groupDetail, groupMember, userYearQuota } from "@/test-support/groups";
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
  useLocalSearchParams: () => ({ groupId: "group-1" }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  useMyGroups: jest.fn(),
  useStoreOpen: jest.fn(),
}));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const myGroups = useMyGroups as jest.MockedFunction<typeof useMyGroups>;
const storeOpen = useStoreOpen as jest.MockedFunction<typeof useStoreOpen>;

const NOW = new Date(2026, 9, 4, 9, 41);

const COUNTRIES = [
  { code: "CZ", name: "Czechia" },
  { code: "SK", name: "Slovakia" },
];

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
    role: "manager",
    ...patch,
  };
}

// The backend orders by name; the phone puts the manager first.
const MEMBERS = [
  groupMember("alice", "Alice Novak", { approverAccess: true }),
  groupMember("bob", "Bob Dvorak"),
  groupMember("dave", "Dave Horak", { controlledUser: false }),
  groupMember("olivia", "Olivia Owner", { adminAccess: true, approverAccess: true }),
];

const ACCESS = { ...GROUP_ACCESS, canAdmin: true };
const serverGroup = (patch: Partial<GroupDetail> = {}) => groupDetail({ access: ACCESS, ...patch });

// Bob has no quota row this year.
const QUOTAS = [
  userYearQuota("olivia"),
  userYearQuota("alice", { carriedOverDays: 0 }),
  userYearQuota("dave"),
];

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

type Answer = ReturnType<typeof answer>;
type Route = "countries" | "group" | "members" | "quotas";

const ROUTES: Record<Route, RegExp> = {
  countries: /\/api\/bank-holidays\/countries$/,
  group: /\/api\/group\/group-1$/,
  members: /\/api\/group-user\/group-1$/,
  quotas: /\/api\/quotas\/group-1\?year=2026$/,
};

let replies: Record<Route, () => Answer | Promise<Answer>>;

const unreachable = () => Promise.reject(new TypeError("Network request failed"));
const never = () => new Promise<Answer>(() => undefined);
const refusal = (status: number) => () => answer(status, { errors: [{ message: "No access" }] });

const requests = (route: Route) =>
  mockFetch.mock.calls.filter(([url]) => ROUTES[route].test(String(url))).length;

function serve() {
  mockFetch.mockImplementation(async (url: string) => {
    const route = (Object.keys(ROUTES) as Route[]).find((key) => ROUTES[key].test(String(url)));
    if (!route) throw new Error(`Unexpected request ${String(url)}`);
    return replies[route]();
  });
}

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
  myGroups.mockReturnValue([group()]);
  replies = {
    countries: () => answer(200, COUNTRIES),
    group: () => answer(200, serverGroup()),
    members: () => answer(200, MEMBERS),
    quotas: () => answer(200, QUOTAS),
  };
  serve();
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

async function renderDetail(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <GroupDetailRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

const holidayCountry = () => screen.getByTestId("group-facts-holiday-country");
const header = () => within(screen.getByTestId("group-header"));
const membersShown = () => screen.findByTestId("group-members");

async function pullToRefresh() {
  await act(async () => {
    await screen.getByTestId("group-detail-scroll").props.refreshControl.props.onRefresh();
  });
}

async function openQuotas() {
  await membersShown();
  await fireEvent.press(screen.getByTestId("group-tab-quotas"));
  return screen.findByTestId("group-quotas");
}

describe("GroupDetail route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderDetail("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a detail a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderDetail();

    expect(screen.toJSON()).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "group-1" },
    });
  });

  it("renders nothing until the Local store is open", async () => {
    storeOpen.mockReturnValue(false);

    await renderDetail();

    expect(screen.toJSON()).toBeNull();
  });

  it("shows the header from the store with the role badge, the name kept off the bar", async () => {
    await renderDetail();

    expect(header().getByText("Dev Team")).toBeOnTheScreen();
    expect(header().getByText("Olivia Owner")).toBeOnTheScreen();
    expect(header().getByText("Manager")).toBeOnTheScreen();
    expect(screen.getAllByText("Dev Team")).toHaveLength(1);
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName("Dev Team");
  });

  it("shows no badge in a group the viewer is a plain member of", async () => {
    myGroups.mockReturnValue([group({ role: null })]);

    await renderDetail();

    expect(header().queryByText("Manager")).toBeNull();
    expect(screen.queryByTestId(/^role-badge-/)).toBeNull();
  });

  it("reads the working days to VoiceOver as one phrase", async () => {
    await renderDetail();

    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Fri");
  });

  it("reads split working days as their runs", async () => {
    myGroups.mockReturnValue([group({ workingDays: [1, 2, 3, 5, 6] })]);

    await renderDetail();

    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Wed, Fri, Sat");
  });

  it("shows the holiday country's name from the countries read", async () => {
    myGroups.mockReturnValue([group({ holidayCountry: "CZ" })]);

    await renderDetail();

    await waitFor(() => expect(holidayCountry()).toHaveTextContent(/Czechia/));
    expect(requests("countries")).toBe(1);
  });

  it("shows the country's code until the countries read answers", async () => {
    replies.countries = never;
    myGroups.mockReturnValue([group({ holidayCountry: "CZ" })]);

    await renderDetail();

    expect(holidayCountry()).toHaveTextContent(/CZ/);
  });

  it("shows None and asks for no countries without a holiday country", async () => {
    await renderDetail();

    expect(holidayCountry()).toHaveTextContent(new RegExp(en.groups.facts.none));
    await membersShown();
    expect(requests("countries")).toBe(0);
  });

  it("shows the default allowance", async () => {
    myGroups.mockReturnValue([group({ defaultVacationDays: 25, defaultHomeOfficeDays: 10 })]);

    await renderDetail();

    expect(screen.getByTestId("group-facts-allowance")).toHaveTextContent(
      /25 vacation, 10 home office/
    );
  });

  it("shows the header and facts offline, the country by its code", async () => {
    replies.group = unreachable;
    replies.countries = unreachable;
    myGroups.mockReturnValue([group({ holidayCountry: "CZ" })]);

    await renderDetail();

    expect(await screen.findByTestId("group-tabs-failed")).toBeOnTheScreen();
    expect(header().getByText("Dev Team")).toBeOnTheScreen();
    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Fri");
    expect(holidayCountry()).toHaveTextContent(/CZ/);
    expect(screen.getByTestId("group-facts-allowance")).toHaveTextContent(
      /20 vacation, 0 home office/
    );
  });
});

describe("GroupDetail access", () => {
  it("shows Members and Quotas once the group detail says canView, and asks for both", async () => {
    await renderDetail();

    expect(await membersShown()).toBeOnTheScreen();
    expect(screen.getByTestId("group-tab-members")).toBeSelected();
    expect(screen.getByTestId("group-tab-quotas")).toBeOnTheScreen();
    await waitFor(() => expect(requests("quotas")).toBe(1));
    expect(requests("group")).toBe(1);
    expect(requests("members")).toBe(1);
  });

  it("asks for no members or quotas while the group detail has not answered, whatever the store row says", async () => {
    replies.group = never;
    myGroups.mockReturnValue([group({ role: "admin" })]);

    await renderDetail();

    expect(screen.getByTestId("group-tabs-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("group-tab-members")).toBeNull();
    expect(requests("members")).toBe(0);
    expect(requests("quotas")).toBe(0);
  });

  it("asks for no members or quotas when the group detail says canView false, though the store row has view and admin access", async () => {
    // The store row's adminAccess (and viewAccess) is what makes the role "admin".
    myGroups.mockReturnValue([group({ role: "admin" })]);
    replies.group = () =>
      answer(200, serverGroup({ access: { ...ACCESS, canView: false, canAdmin: false } }));

    await renderDetail();

    expect(await screen.findByTestId("group-no-view-access")).toHaveTextContent(
      en.groups.noViewAccess
    );
    expect(screen.queryByTestId("group-tabs")).toBeNull();
    expect(requests("group")).toBe(1);
    expect(requests("members")).toBe(0);
    expect(requests("quotas")).toBe(0);
  });

  it("shows only the no-access line on a 403 for your own group, keeping the store header and facts", async () => {
    myGroups.mockReturnValue([group({ role: null })]);
    replies.group = refusal(403);

    await renderDetail();

    expect(await screen.findByTestId("group-no-view-access")).toHaveTextContent(
      en.groups.noViewAccess
    );
    expect(header().getByText("Dev Team")).toBeOnTheScreen();
    expect(screen.getByTestId("group-facts")).toBeOnTheScreen();
    expect(screen.queryByTestId("group-tabs")).toBeNull();
    expect(screen.queryByTestId("group-tabs-failed")).toBeNull();
    expect(screen.queryByTestId("group-no-access")).toBeNull();
    expect(requests("group")).toBe(1);
    expect(requests("members")).toBe(0);
  });

  it("takes the header and facts from the server for a group the store does not hold", async () => {
    myGroups.mockReturnValue([]);
    replies.group = () =>
      answer(
        200,
        serverGroup({
          groupName: "Dev Support",
          defaultVacationDays: 22,
          defaultHomeOfficeDays: 4,
          workingDays: [1, 2, 3, 4],
        })
      );

    await renderDetail();

    expect(screen.getByTestId("group-detail-loading")).toBeOnTheScreen();
    expect(await screen.findByTestId("group-header")).toBeOnTheScreen();
    expect(header().getByText("Dev Support")).toBeOnTheScreen();
    expect(header().getByText("Olivia Owner")).toBeOnTheScreen();
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName("Dev Support");
    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Thu");
    expect(screen.getByTestId("group-facts-allowance")).toHaveTextContent(
      /22 vacation, 4 home office/
    );
    expect(await membersShown()).toBeOnTheScreen();
  });

  it("says you don't have access any more on a 403 for a group the store does not hold", async () => {
    myGroups.mockReturnValue([]);
    replies.group = refusal(403);

    await renderDetail();

    expect(await screen.findByTestId("group-no-access")).toHaveTextContent(en.groups.noAccess);
    expect(screen.queryByTestId("group-header")).toBeNull();
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName(en.nav.groups);
  });

  it("says the group no longer exists on a 404, for a group the store does not hold", async () => {
    myGroups.mockReturnValue([]);
    replies.group = refusal(404);

    await renderDetail();

    expect(await screen.findByTestId("group-not-found")).toHaveTextContent(en.groups.notFound);
    expect(screen.queryByTestId("group-header")).toBeNull();
  });

  it("says the group no longer exists on a 404 for your own group too", async () => {
    replies.group = refusal(404);

    await renderDetail();

    expect(await screen.findByTestId("group-not-found")).toHaveTextContent(en.groups.notFound);
    expect(screen.queryByTestId("group-facts")).toBeNull();
    expect(requests("members")).toBe(0);
  });

  it("offers Retry over the whole screen when a group the store does not hold never loaded", async () => {
    myGroups.mockReturnValue([]);
    replies.group = unreachable;

    await renderDetail();

    expect(await screen.findByTestId("group-detail-failed")).toHaveTextContent(
      new RegExp(en.groups.detailFailed)
    );
    replies.group = () => answer(200, serverGroup());
    await fireEvent.press(screen.getByTestId("group-detail-retry"));

    expect(await screen.findByTestId("group-header")).toBeOnTheScreen();
    expect(await membersShown()).toBeOnTheScreen();
  });
});

// Dev Support as the server answers it to an org admin who is not a member.
const ADMINISTERED_ACCESS = { canView: true, canAdmin: true, viaOrgAdmin: true, isMember: false };
const administered = (patch: Partial<GroupDetail> = {}) =>
  serverGroup({
    groupName: "Dev Support",
    managerUserId: "dave",
    access: ADMINISTERED_ACCESS,
    ...patch,
  });

// Where a test ID sits in the rendered tree, to compare the order of two blocks.
type Rendered = ReturnType<typeof screen.toJSON> | string;
function testIDsInOrder(node: Rendered): string[] {
  if (node === null || typeof node === "string") return [];
  const own = typeof node.props.testID === "string" ? [node.props.testID as string] : [];
  return [...own, ...(node.children ?? []).flatMap(testIDsInOrder)];
}
const positionOf = (testID: string) => testIDsInOrder(screen.toJSON()).indexOf(testID);

describe("GroupDetail administered", () => {
  beforeEach(() => {
    myGroups.mockReturnValue([]);
    replies.group = () => answer(200, administered());
  });

  it("takes the header from the server with a neutral monogram, the organization and the Org admin badge", async () => {
    await renderDetail();

    expect(await screen.findByTestId("group-header")).toBeOnTheScreen();
    expect(header().getByText("Dev Support")).toBeOnTheScreen();
    expect(header().getByText("Olivia Owner")).toBeOnTheScreen();
    expect(header().getByTestId("org-admin-badge")).toHaveTextContent(en.groups.orgAdmin);
    expect(header().getByTestId("monogram-neutral", { includeHiddenElements: true })).toBeTruthy();
    expect(header().queryByTestId("monogram", { includeHiddenElements: true })).toBeNull();
  });

  it("shows the org-admin notice between the header and the facts when the server says org admin and not a member", async () => {
    await renderDetail();

    expect(await screen.findByTestId("group-org-admin-notice")).toHaveTextContent(
      en.groups.orgAdminNotice("Olivia Owner")
    );
    expect(positionOf("group-header")).toBeLessThan(positionOf("group-org-admin-notice"));
    expect(positionOf("group-org-admin-notice")).toBeLessThan(positionOf("group-facts"));
  });

  it("shows Members and Quotas when the server grants canView, and asks for both", async () => {
    await renderDetail();

    expect(await membersShown()).toBeOnTheScreen();
    expect(screen.getByTestId("group-tab-quotas")).toBeOnTheScreen();
    await waitFor(() => expect(requests("quotas")).toBe(1));
    expect(requests("members")).toBe(1);
  });

  it("shows no notice and badges Manager for a group the viewer manages without belonging to it", async () => {
    replies.group = () =>
      answer(
        200,
        administered({
          access: { canView: true, canAdmin: true, viaOrgAdmin: false, isMember: false },
        })
      );

    await renderDetail();

    expect(await membersShown()).toBeOnTheScreen();
    expect(header().getByTestId("role-badge-manager")).toHaveTextContent("Manager");
    expect(header().queryByTestId("org-admin-badge")).toBeNull();
    expect(screen.queryByTestId("group-org-admin-notice")).toBeNull();
  });

  it("shows no notice in your own group, though the server says the organization is yours", async () => {
    myGroups.mockReturnValue([group({ role: null })]);
    replies.group = () =>
      answer(
        200,
        serverGroup({
          access: { canView: true, canAdmin: true, viaOrgAdmin: true, isMember: true },
        })
      );

    await renderDetail();

    expect(await membersShown()).toBeOnTheScreen();
    expect(screen.queryByTestId("group-org-admin-notice")).toBeNull();
    expect(header().queryByTestId("org-admin-badge")).toBeNull();
    expect(header().getByTestId("monogram", { includeHiddenElements: true })).toBeTruthy();
  });

  it("shows Members and Quotas to an org admin who is a plain member without view access, because the server grants canView", async () => {
    myGroups.mockReturnValue([group({ role: null })]);
    replies.group = () =>
      answer(
        200,
        serverGroup({
          access: { canView: true, canAdmin: true, viaOrgAdmin: true, isMember: true },
        })
      );

    await renderDetail();

    expect(await membersShown()).toBeOnTheScreen();
    expect(screen.queryByTestId("group-no-view-access")).toBeNull();
    expect(requests("members")).toBe(1);
  });

  it("offers Retry as the whole screen when nothing loaded and the read failed, then shows the notice", async () => {
    replies.group = unreachable;

    await renderDetail();

    expect(await screen.findByTestId("group-detail-failed")).toHaveTextContent(
      new RegExp(en.groups.detailFailed)
    );
    expect(screen.queryByTestId("group-header")).toBeNull();
    expect(screen.queryByTestId("group-facts")).toBeNull();
    expect(screen.queryByTestId("group-tabs-failed")).toBeNull();
    replies.group = () => answer(200, administered());
    await fireEvent.press(screen.getByTestId("group-detail-retry"));

    expect(await screen.findByTestId("group-org-admin-notice")).toBeOnTheScreen();
    expect(await membersShown()).toBeOnTheScreen();
  });

  it("keeps the notice and header after a failed refresh", async () => {
    await renderDetail();
    await membersShown();
    replies.group = unreachable;
    replies.members = unreachable;
    replies.quotas = unreachable;

    await pullToRefresh();

    expect(screen.getByTestId("group-org-admin-notice")).toBeOnTheScreen();
    expect(header().getByTestId("org-admin-badge")).toBeOnTheScreen();
    expect(screen.getByTestId("group-tabs-stale")).toHaveTextContent("Offline, updated 09:41");
  });
});

describe("GroupDetail members", () => {
  it("lists the people with the manager first, then by name", async () => {
    await renderDetail();
    const list = within(await membersShown());

    expect(list.getByText("4 people")).toBeOnTheScreen();
    const order = screen
      .getAllByTestId(/^group-member-/)
      .map((row) => String(row.props.testID).replace("group-member-", ""));
    expect(order).toEqual(["olivia", "alice", "bob", "dave"]);
    expect(
      within(screen.getByTestId("group-member-bob")).getByText("bob@dev.local")
    ).toBeOnTheScreen();
  });

  it("badges Manager, Admin and Approver, and nothing for view access or being tracked", async () => {
    await renderDetail();
    await membersShown();

    const olivia = within(screen.getByTestId("group-member-olivia"));
    expect(olivia.getByTestId("member-badge-manager")).toHaveTextContent("Manager");
    expect(olivia.getByTestId("member-badge-admin")).toHaveTextContent("Admin");
    expect(olivia.getByTestId("member-badge-approver")).toHaveTextContent("Approver");
    expect(olivia.queryByTestId("member-badge-not-tracked")).toBeNull();
    const alice = within(screen.getByTestId("group-member-alice"));
    expect(alice.getByTestId("member-badge-approver")).toBeOnTheScreen();
    expect(alice.queryByTestId("member-badge-manager")).toBeNull();
    expect(
      within(screen.getByTestId("group-member-bob")).queryByTestId(/^member-badge-/)
    ).toBeNull();
  });

  it("marks a member who is not a controlled user Not tracked", async () => {
    await renderDetail();
    await membersShown();

    expect(
      within(screen.getByTestId("group-member-dave")).getByTestId("member-badge-not-tracked")
    ).toHaveTextContent(en.groups.members.notTracked);
    expect(screen.getAllByTestId("member-badge-not-tracked")).toHaveLength(1);
  });

  it("makes no member row tappable", async () => {
    await renderDetail();
    const list = within(await membersShown());

    expect(list.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTestId("group-member-alice").props.onPress).toBeUndefined();
  });

  it("shows skeleton rows while the members read has not answered", async () => {
    replies.members = never;

    await renderDetail();

    await waitFor(() => expect(requests("members")).toBe(1));
    expect(screen.getByTestId("group-tab-members")).toBeOnTheScreen();
    expect(screen.getByTestId("group-tabs-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("group-members")).toBeNull();
  });

  it("offers Retry where the tabs would be when the members never loaded", async () => {
    replies.members = unreachable;

    await renderDetail();

    expect(await screen.findByTestId("group-tabs-failed")).toHaveTextContent(
      new RegExp(en.groups.tabsFailed)
    );
    expect(screen.queryByTestId("group-members")).toBeNull();
    replies.members = () => answer(200, MEMBERS);
    await fireEvent.press(screen.getByTestId("group-tabs-retry"));

    expect(await membersShown()).toBeOnTheScreen();
  });

  it("keeps the members after a failed refresh, saying when they were read", async () => {
    await renderDetail();
    await membersShown();
    replies.group = unreachable;
    replies.members = unreachable;
    replies.quotas = unreachable;

    await pullToRefresh();

    expect(screen.getByTestId("group-tabs-stale")).toHaveTextContent("Offline, updated 09:41");
    expect(screen.getByTestId("group-member-olivia")).toBeOnTheScreen();
    expect(screen.queryByTestId("group-tabs-failed")).toBeNull();
  });
});

describe("GroupDetail quotas", () => {
  it("shows this year's allowance per person, with what was carried over", async () => {
    await renderDetail();
    const quotas = within(await openQuotas());

    expect(screen.getByTestId("group-tab-quotas")).toBeSelected();
    expect(quotas.getByText("Allowance 2026")).toBeOnTheScreen();
    expect(screen.getByTestId("group-tabs-meta")).toHaveTextContent(en.groups.quotas.perYear);
    expect(screen.queryByTestId("group-tabs-stale")).toBeNull();
    const olivia = within(screen.getByTestId("group-quota-olivia"));
    expect(olivia.getByTestId("quota-figure-vacation")).toHaveTextContent(/25.*Vacation/);
    expect(olivia.getByTestId("quota-figure-homeOffice")).toHaveTextContent(/10.*Home office/);
    expect(olivia.getByTestId("quota-figure-carriedOver")).toHaveTextContent(/\+3.*Carried over/);
    expect(
      within(screen.getByTestId("group-quota-alice")).getByTestId("quota-figure-carriedOver")
    ).toHaveTextContent(/^0/);
  });

  it("shows the group's defaults for a person without a quota row", async () => {
    myGroups.mockReturnValue([group({ defaultVacationDays: 20, defaultHomeOfficeDays: 2 })]);

    await renderDetail();
    await openQuotas();

    const bob = within(screen.getByTestId("group-quota-bob"));
    expect(bob.getByTestId("quota-figure-vacation")).toHaveTextContent(/^20/);
    expect(bob.getByTestId("quota-figure-homeOffice")).toHaveTextContent(/^2/);
    expect(bob.getByTestId("quota-figure-carriedOver")).toHaveTextContent(/^0/);
  });

  it("leaves the Sick days tile out while the organization does not offer the benefit", async () => {
    await renderDetail();
    await openQuotas();

    expect(screen.queryByTestId("quota-figure-sickDays")).toBeNull();
  });

  it("shows the Sick days tile while the organization badge says the benefit is active", async () => {
    myGroups.mockReturnValue([group({ defaultSickDays: 4 })]);
    replies.group = () =>
      answer(
        200,
        serverGroup({
          organization: { name: "Olivia Owner", sickDayBenefitActive: true },
        })
      );

    await renderDetail();
    await openQuotas();

    expect(
      within(screen.getByTestId("group-quota-olivia")).getByTestId("quota-figure-sickDays")
    ).toHaveTextContent(/5.*Sick days/);
    expect(
      within(screen.getByTestId("group-quota-bob")).getByTestId("quota-figure-sickDays")
    ).toHaveTextContent(/^4/);
  });

  it("shows skeleton rows while the quotas read has not answered", async () => {
    replies.quotas = never;

    await renderDetail();
    await membersShown();
    await fireEvent.press(screen.getByTestId("group-tab-quotas"));

    expect(screen.getByTestId("group-tabs-loading")).toBeOnTheScreen();
  });

  it("offers Retry when the quotas never loaded", async () => {
    replies.quotas = unreachable;

    await renderDetail();
    await membersShown();
    await fireEvent.press(screen.getByTestId("group-tab-quotas"));

    expect(await screen.findByTestId("group-tabs-failed")).toBeOnTheScreen();
    replies.quotas = () => answer(200, QUOTAS);
    await fireEvent.press(screen.getByTestId("group-tabs-retry"));

    expect(await screen.findByTestId("group-quotas")).toBeOnTheScreen();
  });

  it("keeps the quotas after a failed refresh, saying when they were read beside days per year", async () => {
    await renderDetail();
    await openQuotas();
    replies.quotas = unreachable;

    await pullToRefresh();

    expect(screen.getByTestId("group-tabs-meta")).toHaveTextContent(en.groups.quotas.perYear);
    expect(screen.getByTestId("group-tabs-stale")).toHaveTextContent("Offline, updated 09:41");
    expect(screen.getByTestId("group-quota-olivia")).toBeOnTheScreen();
  });
});

describe("GroupDetail pull-to-refresh", () => {
  it("reads the group detail, the members and the quotas again", async () => {
    await renderDetail();
    await membersShown();
    await waitFor(() => expect(requests("quotas")).toBe(1));

    await pullToRefresh();

    expect(requests("group")).toBe(2);
    expect(requests("members")).toBe(2);
    expect(requests("quotas")).toBe(2);
  });

  it("reads only the group detail again while it does not grant canView", async () => {
    replies.group = refusal(403);

    await renderDetail();
    await screen.findByTestId("group-no-view-access");

    await pullToRefresh();

    expect(requests("group")).toBe(2);
    expect(requests("members")).toBe(0);
    expect(requests("quotas")).toBe(0);
  });
});
