import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { toast } from "sonner-native";

import JoinSheetScreen from "@/app/groups/join";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull, useStoreOpen } from "@/lib/local-store";
import { qk, queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { groupDetail, joinedMembership } from "@/test-support/groups";
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
  Stack: { Screen: () => null },
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn(), useStoreOpen: jest.fn() }));
jest.mock("sonner-native", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock("expo-clipboard", () => ({ getStringAsync: jest.fn() }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const pullStore = pull as jest.MockedFunction<typeof pull>;
const storeOpen = useStoreOpen as jest.MockedFunction<typeof useStoreOpen>;
const clipboard = Clipboard.getStringAsync as jest.MockedFunction<typeof Clipboard.getStringAsync>;
const toastError = toast.error as jest.Mock;

const labels = en.join.sheet;
const errors = en.join.errors;

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

type Answer = ReturnType<typeof answer>;

const refusal = (status: number, context?: Record<string, unknown>, message = "Refused") =>
  answer(status, { errors: [{ message, ...(context ? { context } : {}) }] });

const WRITE = /\/api\/(auth\/invite\/join|group-user\/code\/.+)$/;
const DETAIL = /\/api\/group\/group-1$/;
let writeReply: () => Answer | Promise<Answer>;

const writes = () => mockFetch.mock.calls.filter(([url]) => WRITE.test(String(url)));

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  storeOpen.mockReturnValue(true);
  pullStore.mockResolvedValue({ ok: true });
  onlineManager.setOnline(true);
  writeReply = () => answer(201, joinedMembership());
  mockFetch.mockImplementation(async (url: string) => {
    if (WRITE.test(url)) return writeReply();
    if (DETAIL.test(url)) return answer(200, groupDetail({ groupName: "Dev Team" }));
    throw new Error(`Unexpected request ${url}`);
  });
});

afterEach(() => {
  queryClient.clear();
  onlineManager.setOnline(true);
});

async function renderSheet(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <JoinSheetScreen />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

const input = () => screen.getByTestId("join-sheet-input");
const joinButton = () => screen.getByTestId("join-sheet-submit");

async function type(value: string) {
  await act(async () => fireEvent.changeText(input(), value));
}

async function pressJoin() {
  await act(async () => fireEvent.press(joinButton()));
}

describe("JoinSheetScreen", () => {
  it("sends a deep link without a session to welcome", async () => {
    await renderSheet("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
  });

  it("renders nothing while it waits for the shell underneath it", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderSheet();

    expect(screen.queryByTestId("join-sheet")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/groups/join");
  });

  it("renders nothing until the Local store is open", async () => {
    storeOpen.mockReturnValue(false);

    await renderSheet();

    expect(screen.queryByTestId("join-sheet")).toBeNull();
  });
});

describe("JoinSheet", () => {
  it("shows the title, body, field, helper line and a Join that waits for input", async () => {
    await renderSheet();

    expect(screen.getByText(labels.title)).toBeOnTheScreen();
    expect(screen.getByText(labels.body)).toBeOnTheScreen();
    expect(screen.getByText(labels.label)).toBeOnTheScreen();
    expect(input().props.placeholder).toBe("7KQ2-M9PX-4HRT");
    expect(input().props.autoCapitalize).toBe("characters");
    expect(input().props.autoCorrect).toBe(false);
    expect(screen.getByTestId("join-sheet-helper")).toHaveTextContent(labels.helper);
    expect(joinButton()).toHaveTextContent(labels.join);
    expect(joinButton()).toBeDisabled();

    await type("6TBX-R4MJ-9CPG");

    expect(joinButton()).toBeEnabled();
  });

  it("fills the field from the clipboard on Paste", async () => {
    clipboard.mockResolvedValue("  https://www.flexi-day.com/join/?token=dev-new-hire \n");
    await renderSheet();

    await act(async () => fireEvent.press(screen.getByTestId("join-sheet-paste")));

    expect(input().props.value).toBe("https://www.flexi-day.com/join/?token=dev-new-hire");
  });

  it("posts a pasted link's token to the invite join path", async () => {
    clipboard.mockResolvedValue("https://www.flexi-day.com/join/?token=dev-new-hire");
    await renderSheet();
    await act(async () => fireEvent.press(screen.getByTestId("join-sheet-paste")));

    await pressJoin();

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0];
    expect(url).toMatch(/\/api\/auth\/invite\/join$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ token: "dev-new-hire" });
  });

  it("posts a typed code URL-encoded to the code path when Return is pressed", async () => {
    await renderSheet();
    await type("6tbx r4mj 9cpg");

    await act(async () => fireEvent(input(), "submitEditing"));

    await waitFor(() => expect(writes()).toHaveLength(1));
    const [url, init] = writes()[0];
    expect(url).toMatch(/\/api\/group-user\/code\/6tbx%20r4mj%209cpg$/);
    expect(init.method).toBe("POST");
  });

  it("says a link without its invite is broken, and calls nobody", async () => {
    await renderSheet();
    await type("https://www.flexi-day.com/join/");

    await pressJoin();

    expect(screen.getByTestId("join-sheet-error")).toHaveTextContent(errors.brokenLink);
    expect(screen.queryByTestId("join-sheet-helper")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["INVITE_NOT_FOUND", "code", () => refusal(404, { code: "INVITE_NOT_FOUND" }), errors.notFound],
    ["a 404 on a code", "code", () => refusal(404), errors.notFound],
    ["INVITE_USED", "link", () => refusal(410, { code: "INVITE_USED" }), errors.used],
    ["INVITE_EXPIRED", "link", () => refusal(410, { code: "INVITE_EXPIRED" }), errors.expired],
    ["INVITE_REVOKED", "link", () => refusal(410, { code: "INVITE_REVOKED" }), errors.revoked],
    [
      "INVITE_EMAIL_MISMATCH",
      "link",
      () => refusal(403, { code: "INVITE_EMAIL_MISMATCH" }),
      errors.emailMismatch,
    ],
    ["a 403 on a code without a code", "code", () => refusal(403), errors.emailMismatch],
    [
      "EMAIL_NOT_VERIFIED_USE_INVITE_LINK",
      "code",
      () => refusal(403, { code: "EMAIL_NOT_VERIFIED_USE_INVITE_LINK" }),
      errors.unverified,
    ],
    ["a 400 on a code", "code", () => refusal(400), errors.malformedCode],
    [
      "a 402 READ_ONLY",
      "code",
      () => refusal(402, { reason: "READ_ONLY" }),
      en.newRequest.readOnlyGroup,
    ],
    [
      "a 402 PLAN_LIMIT",
      "link",
      () => refusal(402, { reason: "PLAN_LIMIT", limit: 3, current: 3 }),
      en.newRequest.memberLimitReached(3),
    ],
  ])("shows %s inline under the field, and editing clears it", async (_, via, reply, line) => {
    writeReply = reply;
    await renderSheet();
    await type(via === "link" ? "flexi-day.com/join/?token=dev-new-hire" : "6TBX-R4MJ-9CPG");

    await pressJoin();

    expect(await screen.findByTestId("join-sheet-error")).toHaveTextContent(line);
    expect(toastError).not.toHaveBeenCalled();
    expect(pullStore).not.toHaveBeenCalled();
    expect(joinButton()).toHaveTextContent(labels.join);

    await type("6TBX-R4MJ-9CPH");

    expect(screen.queryByTestId("join-sheet-error")).toBeNull();
    expect(screen.getByTestId("join-sheet-helper")).toBeOnTheScreen();
  });

  it("disables the field, Paste and Join offline, with the connection notice", async () => {
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await act(async () => onlineManager.setOnline(false));

    expect(screen.getByTestId("join-sheet-offline")).toHaveTextContent(labels.offline);
    expect(input()).toBeDisabled();
    expect(screen.getByTestId("join-sheet-paste")).toBeDisabled();
    expect(joinButton()).toBeDisabled();

    await act(async () => fireEvent(input(), "submitEditing"));
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => onlineManager.setOnline(true));

    expect(screen.queryByTestId("join-sheet-offline")).toBeNull();
    expect(joinButton()).toBeEnabled();
  });

  it("holds Joining… until the after-write pull settles, then reads the name", async () => {
    let settlePull: () => void = () => undefined;
    pullStore.mockReturnValue(new Promise((resolve) => (settlePull = () => resolve({ ok: true }))));
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await pressJoin();
    await waitFor(() => expect(pullStore).toHaveBeenCalledWith("after-write"));

    expect(joinButton()).toHaveTextContent(labels.joining);
    expect(input()).toBeDisabled();
    expect(mockFetch.mock.calls.some(([url]) => DETAIL.test(String(url)))).toBe(false);
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => settlePull());

    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });

  it("closes the sheet, toasts the group's name and opens its detail once joined", async () => {
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await pressJoin();

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/groups/[groupId]",
        params: { groupId: "group-1" },
      })
    );
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("You joined Dev Team");
  });

  it("still opens the group when the pull fails, without its name when that read fails too", async () => {
    pullStore.mockResolvedValue({ ok: false, message: null });
    mockFetch.mockImplementation(async (url: string) => {
      if (WRITE.test(url)) return answer(201, joinedMembership());
      return answer(503, { message: "Down" });
    });
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await pressJoin();

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("You joined the group"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "group-1" },
    });
  });

  it("opens the group of an ALREADY_MEMBER answer, saying so", async () => {
    writeReply = () => refusal(409, { code: "ALREADY_MEMBER", groupId: "group-1" });
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await pressJoin();

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("You're already in Dev Team"));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/groups/[groupId]",
      params: { groupId: "group-1" },
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("hands a refusal without a mapped code to the write-failure handler, which reloads the administered read", async () => {
    writeReply = () => refusal(409, undefined, "The invite was just used.");
    queryClient.setQueryData(qk.administeredGroups(), []);
    await renderSheet();
    await type("6TBX-R4MJ-9CPG");

    await pressJoin();

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("The invite was just used."));
    expect(queryClient.getQueryState(qk.administeredGroups())?.isInvalidated).toBe(true);
    expect(pullStore).toHaveBeenCalledWith("refresh");
    expect(screen.queryByTestId("join-sheet-error")).toBeNull();
    expect(router.back).not.toHaveBeenCalled();
  });

  it("hands a 429 to the write-failure handler with the server's message and no Retry", async () => {
    writeReply = () => refusal(429, undefined, "Too many attempts. Try again later.");
    await renderSheet();
    await type("flexi-day.com/join/?token=dev-new-hire");

    await pressJoin();

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Too many attempts. Try again later.")
    );
    expect(toastError.mock.calls[0][1]).toBeUndefined();
  });

  it("offers Retry on the unreachable toast, which sends the same input again", async () => {
    writeReply = () => Promise.reject(new TypeError("Network request failed"));
    await renderSheet();
    await type("flexi-day.com/join/?token=dev-new-hire");

    await pressJoin();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    const [message, options] = toastError.mock.calls[0];
    expect(message).toBe(en.sync.unreachable);
    expect(options.action.label).toBe(en.request.retry);

    writeReply = () => answer(201, joinedMembership());
    await type("something else entirely");
    await act(async () => options.action.onClick());

    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(JSON.parse(writes()[1][1].body)).toEqual({ token: "dev-new-hire" });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("You joined Dev Team"));
  });
});
