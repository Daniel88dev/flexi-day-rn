import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import DeleteAccountRoute from "@/app/settings/delete-account";
import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { signOut } from "@/lib/session/sign-out";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockWipe = jest.fn(async () => undefined);
const mockUseWipe = jest.fn((_notice?: string) => mockWipe);
const mockLocale = jest.fn(() => "en");

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    WEB_URL: "https://web.test",
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ canGoBack: mockCanGoBack }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
  Stack: { Screen: () => null },
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/session/signed-out-wipe", () => ({
  useSignedOutWipe: (notice?: string) => mockUseWipe(notice),
}));
jest.mock("@/lib/session/sign-out", () => ({ signOut: jest.fn() }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLocale() }] }));
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const copy = en.settings.deleteAccount;
const DELETABLE = { canDelete: true, blockers: [], confirmation: "password" };
const BLOCKED = {
  canDelete: false,
  blockers: [
    {
      kind: "GROUP_HAS_MEMBERS",
      groupId: "6f1c0a52-1b7e-4c38-9a0e-2d5f8c3b4a71",
      groupName: "Design",
      otherMembers: 2,
    },
    {
      kind: "ORGANIZATION_HAS_MEMBERS",
      organizationId: "0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
      organizationName: "Northwind",
      otherMembers: 4,
    },
    {
      kind: "SUBSCRIPTION_RENEWING",
      organizationId: "0b8e7d14-5c2a-4f6b-8e3d-9a1c2b3d4e5f",
      organizationName: "Northwind",
    },
    { kind: "SUPPORT_ADMIN" },
  ],
  confirmation: "password",
};

function answer(status: number, body?: unknown) {
  return { status, json: async () => body };
}

let status: unknown;
let deleted: () => ReturnType<typeof answer>;

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockLocale.mockReturnValue("en");
  status = DELETABLE;
  deleted = () => answer(204);
  mockFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (url.endsWith("/api/users/me/deletion")) {
      if (status instanceof Error) throw status;
      return answer(200, status);
    }
    if (url.endsWith("/api/users/me/delete") && init?.method === "POST") return deleted();
    return answer(404, { message: "Not found" });
  });
});

afterEach(() => queryClient.clear());

function renderRoute(route: RootRoute = "signed-in") {
  return render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <DeleteAccountRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

const deleteCalls = () =>
  mockFetch.mock.calls.filter(([url]) => String(url).endsWith("/api/users/me/delete"));

async function typePasswordAndDelete(password = "hunter22") {
  await act(async () =>
    fireEvent.changeText(await screen.findByTestId("delete-account-password"), password)
  );
  await act(async () => fireEvent.press(screen.getByTestId("delete-account-submit")));
}

describe("Delete account", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderRoute("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a sheet a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderRoute();

    expect(screen.getByText("/dashboard")).toBeOnTheScreen();
  });

  it("says what goes and that it can't be undone, under the sheet's root", async () => {
    await renderRoute();

    expect(await screen.findByText(copy.whatGoes)).toBeOnTheScreen();
    expect(screen.getByText(copy.cantUndo)).toBeOnTheScreen();
    expect(screen.getByTestId("delete-account")).toBeOnTheScreen();
    expect(screen.getByTestId("delete-account-submit")).toBeDisabled();
  });

  it("sends the password and runs the account-deleted wipe instead of signing out", async () => {
    await renderRoute();

    await typePasswordAndDelete();

    const [[, init]] = deleteCalls();
    expect(JSON.parse(String(init.body))).toEqual({ password: "hunter22" });
    await waitFor(() => expect(mockWipe).toHaveBeenCalledTimes(1));
    expect(mockUseWipe).toHaveBeenCalledWith("account-deleted");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("shows a wrong password on the field", async () => {
    deleted = () =>
      answer(403, {
        errors: [
          { message: "The password is not correct", context: { reason: "PASSWORD_INVALID" } },
        ],
      });
    await renderRoute();

    await typePasswordAndDelete("wrong");

    expect(await screen.findByTestId("delete-account-password-error")).toHaveTextContent(
      copy.wrongPassword
    );
    expect(mockWipe).not.toHaveBeenCalled();
  });

  it("lists every blocker in plain words and offers no Delete", async () => {
    status = BLOCKED;

    await renderRoute();

    expect(await screen.findByText(copy.blockedTitle)).toBeOnTheScreen();
    expect(screen.getByText(copy.blockers.groupHasMembers("Design", 2))).toBeOnTheScreen();
    expect(
      screen.getByText(copy.blockers.organizationHasMembers("Northwind", 4))
    ).toBeOnTheScreen();
    expect(screen.getByText(copy.blockers.subscriptionRenewing("Northwind"))).toBeOnTheScreen();
    expect(screen.getByText(copy.blockers.supportAdmin)).toBeOnTheScreen();
    expect(screen.queryByTestId("delete-account-submit")).toBeNull();
    expect(screen.queryByTestId("delete-account-password")).toBeNull();
  });

  it("lists the blockers in Czech for a phone set to Czech", async () => {
    mockLocale.mockReturnValue("cs");
    status = BLOCKED;

    await renderRoute();

    expect(await screen.findByText(cs.settings.deleteAccount.blockedTitle)).toBeOnTheScreen();
    expect(screen.getByText(cs.settings.deleteAccount.blockers.supportAdmin)).toBeOnTheScreen();
  });

  it("reads the check again on a 409 and shows the blockers it names", async () => {
    deleted = () =>
      answer(409, {
        errors: [
          {
            message: "Blocked",
            context: { reason: "DELETION_BLOCKED", blockers: [BLOCKED.blockers[0]] },
          },
        ],
      });
    await renderRoute();
    await screen.findByTestId("delete-account-password");
    status = { ...BLOCKED, blockers: [BLOCKED.blockers[0]] };

    await typePasswordAndDelete();

    expect(await screen.findByText(copy.blockers.groupHasMembers("Design", 2))).toBeOnTheScreen();
    expect(screen.queryByTestId("delete-account-submit")).toBeNull();
    const reads = mockFetch.mock.calls.filter(([url]) => String(url).endsWith("/deletion"));
    expect(reads.length).toBeGreaterThanOrEqual(2);
  });

  it("offers Retry while the check gets no answer", async () => {
    status = new TypeError("Network request failed");
    await renderRoute();

    expect(await screen.findByText(en.sync.unreachable, {}, { timeout: 5000 })).toBeOnTheScreen();
    status = DELETABLE;
    await act(async () => fireEvent.press(screen.getByTestId("delete-account-retry")));

    expect(await screen.findByTestId("delete-account-password")).toBeOnTheScreen();
  });

  it("turns Delete into Retry when the delete gets no answer", async () => {
    deleted = () => {
      throw new TypeError("Network request failed");
    };
    await renderRoute();

    await typePasswordAndDelete();

    expect(await screen.findByTestId("delete-account-error")).toHaveTextContent(
      en.sync.unreachable
    );
    expect(screen.getByTestId("delete-account-submit")).toHaveTextContent(copy.retry);
  });

  it("sends an account that needs a fresh sign-in to the web's delete link", async () => {
    status = { ...DELETABLE, confirmation: "recent-sign-in" };
    await renderRoute();

    await act(async () => fireEvent.press(await screen.findByTestId("delete-account-open-web")));

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
      "https://web.test/settings/?delete-account",
      expect.anything()
    );
    expect(screen.queryByTestId("delete-account-password")).toBeNull();
  });

  it("closes from Cancel", async () => {
    await renderRoute();

    await act(async () => fireEvent.press(screen.getByTestId("delete-account-cancel")));

    expect(router.back).toHaveBeenCalled();
  });
});
