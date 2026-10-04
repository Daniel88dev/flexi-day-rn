import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, type AlertButton } from "react-native";
import { toast } from "sonner-native";

import JoinScreenRoute from "@/app/join";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  destroyStore,
  pull,
  useMyGroups,
  useStoreOpen,
  useSyncStatus,
  type MyGroup,
  type SyncStatus,
} from "@/lib/local-store";
import { qk, queryClient, type InvitePreview } from "@/lib/query";
import { clearHeldInvite, heldInvite, holdInvite } from "@/lib/session/held-invite";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  clearSignedOutNotice,
  showSignedOutNotice,
  signedOutNoticeShowing,
} from "@/lib/session/signed-out-notice";
import { openWebPage } from "@/lib/web";
import { groupDetail, invitePreview, joinedMembership } from "@/test-support/groups";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockRouterCanGoBack = jest.fn(() => true);
const mockGetState = jest.fn();
const mockReset = jest.fn();
const mockServerSignOut = jest.fn();
let mockParams: { token?: string } = {};
let mockViewer: { id: string; name: string; email: string } | null = null;

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: jest.fn(),
    push: jest.fn(),
    canGoBack: () => mockRouterCanGoBack(),
  },
  useNavigation: () => ({ canGoBack: mockCanGoBack, getState: mockGetState, reset: mockReset }),
  useLocalSearchParams: () => mockParams,
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({
  SESSION_COOKIE_KEY: "flexi-day_cookie",
  clearClientSession: jest.fn(),
  sessionCookie: async () => "",
  authClient: { signOut: () => mockServerSignOut() },
}));
jest.mock("expo-secure-store", () => ({ setItemAsync: jest.fn(), getItemAsync: jest.fn() }));
jest.mock("@better-auth/expo/client", () => ({ storageAdapter: (storage: unknown) => storage }));
jest.mock("@/lib/web", () => ({
  ...jest.requireActual("@/lib/web"),
  openWebPage: jest.fn(),
}));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/viewer/use-viewer", () => ({ useViewer: () => mockViewer }));
jest.mock("@/lib/local-store", () => ({
  destroyStore: jest.fn(),
  pull: jest.fn(),
  useMyGroups: jest.fn(),
  useStoreOpen: jest.fn(),
  useSyncStatus: jest.fn(),
}));
jest.mock("sonner-native", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const pullStore = pull as jest.MockedFunction<typeof pull>;
const myGroups = useMyGroups as jest.MockedFunction<typeof useMyGroups>;
const storeOpen = useStoreOpen as jest.MockedFunction<typeof useStoreOpen>;
const syncStatus = useSyncStatus as jest.MockedFunction<typeof useSyncStatus>;

const synced = (patch: Partial<SyncStatus> = {}): SyncStatus => ({
  inFlight: false,
  lastPulledAt: "2026-10-04T09:00:00.000Z",
  lastError: null,
  hasCursor: true,
  generation: 1,
  ...patch,
});
const toastError = toast.error as jest.Mock;
const destroy = destroyStore as jest.MockedFunction<typeof destroyStore>;
const openPage = openWebPage as jest.MockedFunction<typeof openWebPage>;

const labels = en.join.screen;
const TOKEN = "dev-alice-support-00000000000000000";
const DETAIL_HREF = { pathname: "/groups/[groupId]", params: { groupId: "group-2" } };

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

type Answer = ReturnType<typeof answer>;

const refusal = (status: number, context?: Record<string, unknown>, message = "Refused") =>
  answer(status, { errors: [{ message, ...(context ? { context } : {}) }] });

const PREVIEW = /\/api\/auth\/invite\/preview$/;
const JOIN = /\/api\/auth\/invite\/join$/;
const DETAIL = /\/api\/group\/group-2$/;
const HELD = { token: TOKEN, invitedEmail: "alice@dev.local" };

const route = (name: string, params?: object) => ({ key: `${name}-key`, name, params });
const JOIN_ROUTE = route("join", { token: TOKEN });
const WELCOME_ALONE = {
  index: 0,
  routes: [{ name: "(auth)", state: { routes: [{ name: "welcome" }] } }],
};
const SIGN_IN = {
  index: 0,
  routes: [
    { name: "(auth)", state: { index: 1, routes: [{ name: "welcome" }, { name: "sign-in" }] } },
  ],
};

let previewReply: () => Answer | Promise<Answer>;
let joinReply: () => Answer | Promise<Answer>;

const requests = (path: RegExp) => mockFetch.mock.calls.filter(([url]) => path.test(String(url)));

function storeGroup(id: string): MyGroup {
  return {
    id,
    name: id === "group-2" ? "Dev Support" : "Dev Team",
    organizationName: "Olivia Owner",
    defaultVacationDays: 20,
    defaultHomeOfficeDays: 0,
    defaultSickDays: 0,
    workingDays: [1, 2, 3, 4, 5],
    holidayCountry: null,
    role: null,
  };
}

const openWith = (patch: Partial<InvitePreview> = {}) => {
  previewReply = () => answer(200, invitePreview(patch));
};

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: TOKEN };
  mockViewer = { id: "alice", name: "Alice Novak", email: "alice@dev.local" };
  mockCanGoBack.mockReturnValue(true);
  mockRouterCanGoBack.mockReturnValue(true);
  storeOpen.mockReturnValue(true);
  syncStatus.mockReturnValue(synced());
  myGroups.mockReturnValue([storeGroup("group-1")]);
  pullStore.mockResolvedValue({ ok: true });
  destroy.mockResolvedValue(undefined);
  openPage.mockResolvedValue(undefined);
  mockServerSignOut.mockResolvedValue({ data: { success: true } });
  mockGetState.mockReturnValue({ index: 0, routes: [JOIN_ROUTE] });
  clearHeldInvite();
  clearSignedOutNotice();
  onlineManager.setOnline(true);
  openWith();
  joinReply = () => answer(201, joinedMembership("group-2"));
  mockFetch.mockImplementation(async (url: string) => {
    if (PREVIEW.test(url)) return previewReply();
    if (JOIN.test(url)) return joinReply();
    if (DETAIL.test(url))
      return answer(200, groupDetail({ id: "group-2", groupName: "Dev Support" }));
    throw new Error(`Unexpected request ${url}`);
  });
});

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
  clearHeldInvite();
});

function tree(route: RootRoute) {
  return (
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <JoinScreenRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function renderScreen(route: RootRoute = "signed-in") {
  return render(tree(route));
}

async function renderInvite() {
  await renderScreen();
  await screen.findByTestId("join-preview");
}

const press = async (testID: string) => {
  await act(async () => fireEvent.press(screen.getByTestId(testID)));
};

describe("JoinScreenRoute", () => {
  it("renders a deep link without a session signed out, reading nothing from the Local store", async () => {
    mockViewer = null;
    storeOpen.mockReturnValue(false);

    await renderScreen("welcome");

    expect(await screen.findByTestId("join-preview")).toBeOnTheScreen();
    expect(screen.queryByText("/welcome")).toBeNull();
    expect(myGroups).not.toHaveBeenCalled();
  });

  it("renders a cold link signed out on its own, putting nothing under it", async () => {
    mockViewer = null;
    mockCanGoBack.mockReturnValue(false);

    await renderScreen("welcome");

    expect(await screen.findByTestId("join-preview")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("puts the shell under a cold link first, then comes back with the token", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderScreen();

    expect(screen.queryByTestId("join-screen")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({ pathname: "/join", params: { token: TOKEN } });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("renders nothing until the Local store is open", async () => {
    storeOpen.mockReturnValue(false);

    await renderScreen();

    expect(screen.queryByTestId("join-screen")).toBeNull();
  });

  it("starts over for a new link opened over it, keyed by the token", async () => {
    joinReply = () => refusal(410, { code: "INVITE_USED" });
    const view = await renderScreen();
    await screen.findByTestId("join-preview");
    await press("join-submit");
    expect(await screen.findByText(labels.dead.used)).toBeOnTheScreen();

    mockParams = { token: "dev-new-hire-00000000000000000000000" };
    openWith({ groupId: "group-1", groupName: "Dev Team" });
    await view.rerender(tree("signed-in"));

    expect(await screen.findByText("Dev Team")).toBeOnTheScreen();
    expect(screen.queryByText(labels.dead.used)).toBeNull();
    const bodies = requests(PREVIEW).map(([, init]) => JSON.parse(init.body));
    expect(bodies).toEqual([{ token: TOKEN }, { token: "dev-new-hire-00000000000000000000000" }]);
  });
});

describe("JoinScreen", () => {
  it("shows a skeleton while the preview has not answered", async () => {
    previewReply = () => new Promise(() => undefined);

    await renderScreen();

    expect(screen.getByTestId("join-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-preview")).toBeNull();
  });

  it("shows the inviter, the group, who the invite is for and when it expires", async () => {
    await renderInvite();

    expect(screen.getByTestId("monogram", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("Olivia Owner invited you to join")).toBeOnTheScreen();
    expect(screen.getByText("Dev Support")).toBeOnTheScreen();
    expect(screen.getByText(labels.inviteFor)).toBeOnTheScreen();
    expect(screen.getByTestId("join-invite-for")).toHaveTextContent("alice@dev.local");
    expect(screen.getByText(labels.expires)).toBeOnTheScreen();
    expect(screen.getByTestId("join-expires")).toHaveTextContent("17 October");
  });

  it("invites without an inviter's name", async () => {
    openWith({ inviterName: null });

    await renderInvite();

    expect(screen.getByText(labels.invitedBy(null))).toBeOnTheScreen();
  });

  it("shows Anyone with the link for an invite without an address, and lets anyone join", async () => {
    openWith({ invitedEmail: null });
    mockViewer = { id: "bob", name: "Bob Dvorak", email: "bob@dev.local" };

    await renderInvite();

    expect(screen.getByTestId("join-invite-for")).toHaveTextContent(labels.anyoneWithLink);
    expect(screen.getByTestId("join-submit")).toHaveTextContent("Join Dev Support");
  });

  it("offers Join for the invited address, compared without letter case", async () => {
    mockViewer = { id: "alice", name: "Alice Novak", email: "Alice@Dev.Local" };

    await renderInvite();

    expect(screen.getByTestId("join-submit")).toHaveTextContent("Join Dev Support");
    expect(screen.getByTestId("join-submit")).toBeEnabled();
  });

  it("asks for nothing but the preview when it opens, and never joins on its own", async () => {
    await renderInvite();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(requests(PREVIEW)).toHaveLength(1);
    const [, init] = requests(PREVIEW)[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
    expect(requests(JOIN)).toHaveLength(0);
    expect(pullStore).not.toHaveBeenCalled();
  });

  it("says Join needs a connection and disables it offline", async () => {
    await renderInvite();

    await act(async () => onlineManager.setOnline(false));

    expect(screen.getByTestId("join-offline")).toHaveTextContent(en.join.sheet.offline);
    expect(screen.getByTestId("join-submit")).toBeDisabled();

    await act(async () => onlineManager.setOnline(true));

    expect(screen.queryByTestId("join-offline")).toBeNull();
    expect(screen.getByTestId("join-submit")).toBeEnabled();
  });

  it("shows the already-member notice and opens the group for a member, without Join", async () => {
    myGroups.mockReturnValue([storeGroup("group-1"), storeGroup("group-2")]);

    await renderInvite();

    expect(screen.getByTestId("join-already-member")).toHaveTextContent(
      "You're already in Dev Support."
    );
    expect(screen.queryByTestId("join-submit")).toBeNull();

    await press("join-open-group");

    expect(router.replace).toHaveBeenCalledWith(DETAIL_HREF);
    expect(requests(JOIN)).toHaveLength(0);
  });

  it("decides the footer by membership alone, whatever standing the store gives the viewer (ADR 0003)", async () => {
    myGroups.mockReturnValue([{ ...storeGroup("group-1"), role: "admin" }]);

    await renderInvite();

    expect(screen.getByTestId("join-submit")).toHaveTextContent("Join Dev Support");
    expect(screen.queryByTestId("join-already-member")).toBeNull();
    expect(requests(/\/api\/group/)).toHaveLength(0);
  });

  it("shows the already-member footer for a member whose invite is already used", async () => {
    openWith({ status: "used" });
    myGroups.mockReturnValue([storeGroup("group-1"), storeGroup("group-2")]);

    await renderInvite();

    expect(screen.getByTestId("join-already-member")).toHaveTextContent(
      "You're already in Dev Support."
    );
    expect(screen.queryByTestId("join-dead")).toBeNull();
    expect(screen.queryByTestId("join-submit")).toBeNull();
  });

  it("offers Retry when the preview got no answer, as offline, and shows the invite once it does", async () => {
    previewReply = () => Promise.reject(new TypeError("Network request failed"));

    await renderScreen();

    expect(await screen.findByTestId("join-preview-failed")).toHaveTextContent(labels.loadFailed, {
      exact: false,
    });
    expect(requests(PREVIEW)).toHaveLength(1);

    openWith();
    await press("join-preview-retry");

    expect(await screen.findByTestId("join-preview")).toBeOnTheScreen();
  });

  it("offers Retry when the server fails the preview", async () => {
    previewReply = () => answer(503, { message: "Down" });

    await renderScreen();

    expect(await screen.findByTestId("join-preview-failed")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-dead")).toBeNull();
  });

  it.each([
    ["a 404", () => refusal(404, { code: "INVITE_NOT_FOUND" })],
    ["a 422 for a token cut short", () => refusal(422)],
  ])("says the invite doesn't exist on %s, with Done", async (_, reply) => {
    previewReply = reply;

    await renderScreen();

    expect(await screen.findByTestId("join-dead")).toHaveTextContent(labels.dead.notFound, {
      exact: false,
    });
    expect(screen.getByText(labels.notFoundBody)).toBeOnTheScreen();
    expect(screen.getByTestId("join-broken-link")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-preview-failed")).toBeNull();

    await press("join-done");

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["used", labels.dead.used],
    ["expired", labels.dead.expired],
    ["revoked", labels.dead.revoked],
  ] as const)("shows a %s invite as dead, saying who to ask", async (status, title) => {
    openWith({ status });

    await renderScreen();

    expect(await screen.findByTestId("join-dead")).toHaveTextContent(title, { exact: false });
    expect(
      screen.getByText("Ask Olivia Owner to send you a new one for Dev Support.")
    ).toBeOnTheScreen();
    expect(screen.getByTestId("join-broken-link")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-submit")).toBeNull();
    expect(screen.getByTestId("join-done")).toHaveTextContent(labels.done);
  });

  it("goes back on close", async () => {
    await renderInvite();

    await press("join-close");

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("waits for the first sync pull before calling a closed invite dead, then finds the member", async () => {
    openWith({ status: "used" });
    syncStatus.mockReturnValue(synced({ hasCursor: false, lastPulledAt: null, inFlight: true }));
    myGroups.mockReturnValue([]);
    const view = await renderScreen();

    expect(await screen.findByTestId("join-loading")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-dead")).toBeNull();

    syncStatus.mockReturnValue(synced());
    myGroups.mockReturnValue([storeGroup("group-2")]);
    await view.rerender(tree("signed-in"));

    expect(await screen.findByTestId("join-already-member")).toHaveTextContent(
      "You're already in Dev Support."
    );
  });

  it("calls a closed invite dead once the first sync pull has failed", async () => {
    openWith({ status: "expired" });
    syncStatus.mockReturnValue(synced({ hasCursor: false, lastError: "unreachable" }));
    myGroups.mockReturnValue([]);

    await renderScreen();

    expect(await screen.findByTestId("join-dead")).toHaveTextContent(labels.dead.expired, {
      exact: false,
    });
  });

  it("offers Join on an open invite before the first sync pull lands", async () => {
    syncStatus.mockReturnValue(synced({ hasCursor: false, inFlight: true }));
    myGroups.mockReturnValue([]);

    await renderInvite();

    expect(screen.getByTestId("join-submit")).toHaveTextContent("Join Dev Support");
  });

  it("lets go of a held invite on close", async () => {
    holdInvite(HELD);
    await renderInvite();

    await press("join-close");

    expect(heldInvite()).toBeNull();
  });

  it("goes to the root on close when nothing is underneath", async () => {
    mockRouterCanGoBack.mockReturnValue(false);
    await renderInvite();

    await press("join-close");

    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});

describe("JoinScreen Join", () => {
  it("joins with the token only when pressed, then replaces the screen with the detail and toasts", async () => {
    await renderInvite();
    expect(requests(JOIN)).toHaveLength(0);

    await press("join-submit");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(DETAIL_HREF));
    const [, init] = requests(JOIN)[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN });
    expect(pullStore).toHaveBeenCalledWith("after-write");
    expect(toast.success).toHaveBeenCalledWith("You joined Dev Support");
    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("holds Joining… until the after-write pull settles", async () => {
    let settlePull: () => void = () => undefined;
    pullStore.mockReturnValue(new Promise((resolve) => (settlePull = () => resolve({ ok: true }))));
    await renderInvite();

    await press("join-submit");
    await waitFor(() => expect(pullStore).toHaveBeenCalledWith("after-write"));

    expect(screen.getByTestId("join-submit")).toHaveTextContent(en.join.sheet.joining);
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => settlePull());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(DETAIL_HREF));
  });

  it.each([
    ["INVITE_USED", labels.dead.used],
    ["INVITE_EXPIRED", labels.dead.expired],
    ["INVITE_REVOKED", labels.dead.revoked],
  ])("swaps to the dead state on a 410 %s", async (code, title) => {
    joinReply = () => refusal(410, { code });
    await renderInvite();

    await press("join-submit");

    expect(await screen.findByTestId("join-dead")).toHaveTextContent(title, { exact: false });
    expect(
      screen.getByText("Ask Olivia Owner to send you a new one for Dev Support.")
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("join-submit")).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens the group of an ALREADY_MEMBER answer, saying so", async () => {
    joinReply = () => refusal(409, { code: "ALREADY_MEMBER", groupId: "group-2" });
    await renderInvite();

    await press("join-submit");

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(DETAIL_HREF));
    expect(toast.info).toHaveBeenCalledWith("You're already in Dev Support");
    expect(toastError).not.toHaveBeenCalled();
  });

  it.each([
    [
      "INVITE_EMAIL_MISMATCH",
      () => refusal(403, { code: "INVITE_EMAIL_MISMATCH" }),
      en.join.errors.emailMismatch,
    ],
    [
      "a 402 PLAN_LIMIT",
      () => refusal(402, { reason: "PLAN_LIMIT", limit: 3, current: 3 }),
      en.newRequest.memberLimitReached(3),
    ],
    ["INVITE_NOT_FOUND", () => refusal(404, { code: "INVITE_NOT_FOUND" }), en.join.errors.notFound],
  ])("shows %s inline above the footer", async (_, reply, line) => {
    joinReply = reply;
    await renderInvite();

    await press("join-submit");

    expect(await screen.findByTestId("join-error")).toHaveTextContent(line);
    expect(screen.getByTestId("join-submit")).toHaveTextContent("Join Dev Support");
    expect(toastError).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("hands an unmapped refusal to the write-failure handler, which reads the preview again", async () => {
    joinReply = () => refusal(409, undefined, "The invite was just used.");
    await renderInvite();

    await press("join-submit");

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("The invite was just used."));
    expect(pullStore).toHaveBeenCalledWith("refresh");
    await waitFor(() => expect(requests(PREVIEW)).toHaveLength(2));
    expect(screen.queryByTestId("join-error")).toBeNull();
    expect(queryClient.getQueryData(qk.invitePreview(TOKEN))).toBeDefined();
  });

  it("offers Retry on the unreachable toast, which joins with the same token again", async () => {
    joinReply = () => Promise.reject(new TypeError("Network request failed"));
    await renderInvite();

    await press("join-submit");

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [message, options] = toastError.mock.calls[0];
    expect(message).toBe(en.sync.unreachable);
    expect(options.action.label).toBe(en.request.retry);

    joinReply = () => answer(201, joinedMembership("group-2"));
    await act(async () => options.action.onClick());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(DETAIL_HREF));
    expect(requests(JOIN).map(([, init]) => JSON.parse(init.body))).toEqual([
      { token: TOKEN },
      { token: TOKEN },
    ]);
  });
});

async function renderSignedOut() {
  mockViewer = null;
  storeOpen.mockReturnValue(false);
  await renderScreen("welcome");
  await screen.findByTestId("join-preview");
}

/** The whole stack becomes welcome under a fresh sign-in, so Back from sign-in goes to welcome. */
const signInOpened = () => {
  expect(mockReset).toHaveBeenLastCalledWith(SIGN_IN);
  expect(router.replace).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
};

describe("JoinScreen signed out", () => {
  it("masks the invited address and offers Sign in to join with Create your account", async () => {
    await renderSignedOut();

    expect(screen.getByText("Olivia Owner invited you to join")).toBeOnTheScreen();
    expect(screen.getByTestId("join-invite-for")).toHaveTextContent("a…@dev.local");
    expect(screen.queryByText("alice@dev.local")).toBeNull();
    expect(screen.getByTestId("join-sign-in")).toHaveTextContent(labels.signInToJoin);
    expect(screen.getByTestId("join-create-account")).toHaveTextContent(
      `${en.auth.signIn.newToApp} ${labels.createAccount}`
    );
    expect(screen.queryByTestId("join-submit")).toBeNull();
    expect(requests(JOIN)).toHaveLength(0);
  });

  it("shows Anyone with the link for an invite without an address", async () => {
    openWith({ invitedEmail: null });

    await renderSignedOut();

    expect(screen.getByTestId("join-invite-for")).toHaveTextContent(labels.anyoneWithLink);
    expect(screen.getByTestId("join-sign-in")).toBeOnTheScreen();
  });

  it("shows a dead invite with Done and no way to sign in", async () => {
    openWith({ status: "expired" });

    await renderScreen("welcome");

    expect(await screen.findByTestId("join-dead")).toHaveTextContent(labels.dead.expired, {
      exact: false,
    });
    expect(screen.getByTestId("join-done")).toBeOnTheScreen();
    expect(screen.queryByTestId("join-sign-in")).toBeNull();
  });

  it("holds the invite on Sign in to join and puts welcome under a fresh sign-in", async () => {
    mockGetState.mockReturnValue({ index: 1, routes: [route("(auth)"), JOIN_ROUTE] });
    await renderSignedOut();

    await press("join-sign-in");

    expect(heldInvite()).toEqual(HELD);
    expect(mockReset).toHaveBeenCalledTimes(1);
    signInOpened();
    expect(requests(JOIN)).toHaveLength(0);
  });

  it("opens sign-in the same way from a cold link with nothing under it", async () => {
    await renderSignedOut();

    await press("join-sign-in");

    signInOpened();
  });

  it("opens the web's join page in the browser sheet, then holds the invite and opens sign-in once it closes", async () => {
    let closeSheet: () => void = () => undefined;
    openPage.mockReturnValue(new Promise((resolve) => (closeSheet = () => resolve(undefined))));
    await renderSignedOut();

    await press("join-create-account");

    expect(openPage).toHaveBeenCalledWith(`/join/?token=${TOKEN}`);
    expect(heldInvite()).toBeNull();
    expect(mockReset).not.toHaveBeenCalled();

    await act(async () => closeSheet());

    expect(heldInvite()).toEqual(HELD);
    signInOpened();
    expect(mockFetch.mock.calls.filter(([url]) => /sign-up/.test(String(url)))).toHaveLength(0);
  });
});

// The wipe empties the query client under the open screen; its answer lands on the next tick.
const signedOut = async () => {
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/sign-in"));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
};

describe("JoinScreen wrong account", () => {
  let alert: jest.SpyInstance;
  const alertButton = (style: AlertButton["style"]) =>
    (alert.mock.calls[0][2] as AlertButton[]).find((button) => button.style === style);

  beforeEach(() => {
    mockViewer = { id: "bob", name: "Bob Dvorak", email: "bob@dev.local" };
    alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => alert.mockRestore());

  it("says who the invite is for, masked, and who is signed in, with Sign out and continue", async () => {
    await renderInvite();

    expect(screen.getByTestId("join-wrong-account")).toHaveTextContent(
      "This invite is for a…@dev.local. You're signed in as bob@dev.local."
    );
    expect(screen.getByTestId("join-invite-for")).toHaveTextContent("a…@dev.local");
    expect(screen.getByTestId("join-sign-out")).toHaveTextContent(labels.signOutAndContinue);
    expect(screen.queryByTestId("join-submit")).toBeNull();
    expect(screen.queryByTestId("join-sign-in")).toBeNull();
  });

  it("asks first, and Cancel leaves the session, the stack and the hold as they were", async () => {
    await renderInvite();

    await press("join-sign-out");

    expect(alert).toHaveBeenCalledWith(
      labels.confirmSignOut.title,
      labels.confirmSignOut.body,
      expect.any(Array)
    );
    expect(alertButton("cancel")?.text).toBe(labels.confirmSignOut.cancel);
    expect(alertButton("destructive")?.text).toBe(labels.confirmSignOut.signOut);
    await act(async () => alertButton("cancel")?.onPress?.());

    expect(mockServerSignOut).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(heldInvite()).toBeNull();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("on Sign out holds the invite, drops every screen for welcome, signs out server-first with a quiet wipe, then opens sign-in", async () => {
    showSignedOutNotice();
    mockGetState.mockReturnValue({
      index: 2,
      routes: [route("(app)"), route("groups"), JOIN_ROUTE],
    });
    await renderInvite();

    await press("join-sign-out");
    await act(async () => alertButton("destructive")?.onPress?.());

    await signedOut();
    expect(heldInvite()).toEqual(HELD);
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith(WELCOME_ALONE);
    const order = (mock: jest.Mock) => mock.mock.invocationCallOrder[0];
    expect(order(mockReset)).toBeLessThan(order(mockServerSignOut));
    expect(order(mockServerSignOut)).toBeLessThan(order(destroy as unknown as jest.Mock));
    expect(order(destroy as unknown as jest.Mock)).toBeLessThan(order(router.push as jest.Mock));
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(signedOutNoticeShowing()).toBe(false);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens sign-in only once the server has answered and the wipe is done", async () => {
    let answer: () => void = () => undefined;
    mockServerSignOut.mockReturnValue(new Promise((resolve) => (answer = () => resolve({}))));
    await renderInvite();

    await press("join-sign-out");
    await act(async () => alertButton("destructive")?.onPress?.());

    expect(mockReset).toHaveBeenCalledWith(WELCOME_ALONE);
    expect(destroy).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => answer());

    await signedOut();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("still wipes and opens sign-in when the server never answers the sign-out", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockServerSignOut.mockRejectedValue(new TypeError("Network request failed"));
    await renderInvite();

    await press("join-sign-out");
    await act(async () => alertButton("destructive")?.onPress?.());

    await signedOut();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(heldInvite()).toEqual(HELD);
    error.mockRestore();
  });
});
