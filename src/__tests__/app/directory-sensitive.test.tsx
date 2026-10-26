import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { focusManager } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ActionSheetIOS, AppState, type AppStateStatus } from "react-native";

import ProfileRoute from "@/app/directory/[employmentId]";
import { PrivacyCover } from "@/components/privacy-cover";
import { TranslationProvider } from "@/i18n/use-translation";
import type { DirectoryProfile } from "@/lib/directory";
import { queryClient } from "@/lib/query";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { pressableProblems } from "@/test-support/accessibility";
import {
  directoryOrganization as org,
  directoryProfile as profileOf,
} from "@/test-support/directory";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockBlurs = new Set<() => void>();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
    useNavigation: () => ({ canGoBack: () => true }),
    useLocalSearchParams: () => ({ employmentId: "e-alice", organizationId: "o-a" }),
    // Focus on mount; `blur()` below runs the cleanups, as leaving the screen does.
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        const cleanup = effect();
        if (!cleanup) return undefined;
        mockBlurs.add(cleanup);
        return () => {
          if (mockBlurs.delete(cleanup)) cleanup();
        };
      }, [effect]),
    Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
  };
});

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ uses24hourClock: true }],
}));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock("@/lib/web", () => ({ openWebPage: jest.fn() }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: "u-me", name: "Me", email: "me@dev.local", twoFactorEnabled: false }),
}));

type Reply = { status: number; body: unknown } | "offline";
let replies: Record<string, Reply> = {};

const PRIVATE_PHONE = {
  e164: "+420777123456",
  display: "+420 777 123 456",
  country: { code: "CZ", name: "Czechia" },
};

const ALICE: DirectoryProfile = profileOf("alice", "Alice Novak", {
  sections: {
    card: { level: "READ", jobTitle: "Designer", reportsTo: null },
    contact: { level: "READ" },
    personal: { level: "READ" },
  },
});

const SHOWN_CONTACT = {
  section: "CONTACT",
  level: "READ",
  recorded: true,
  privatePhone: PRIVATE_PHONE,
  privateEmail: "alice@home.test",
  emergencyContact1: {
    name: "Petr Novak",
    phone: { e164: "+420602000111", display: "+420 602 000 111", country: null },
  },
  emergencyContact2: null,
};

const SHOWN_PERSONAL = {
  section: "PERSONAL",
  level: "READ",
  recorded: true,
  homeAddress: {
    line1: "Dlouhá 12",
    line2: null,
    postalCode: "110 00",
    city: "Praha",
    region: null,
    country: { code: "CZ", name: "Czechia" },
  },
  dateOfBirth: "1990-04-17",
};

const PROFILE_PATH = "/api/directory/o-a/people/e-alice";
const showPath = (section: string) => `${PROFILE_PATH}/show/${section}`;

function answer(path: string, reply: Reply) {
  replies[path] = reply;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockBlurs.clear();
  replies = {};
  answer("/api/directory/organizations", { status: 200, body: [org("o-a")] });
  answer(PROFILE_PATH, { status: 200, body: ALICE });
  answer(showPath("contact"), { status: 200, body: SHOWN_CONTACT });
  answer(showPath("personal"), { status: 200, body: SHOWN_PERSONAL });
  mockFetch.mockImplementation(async (url: string) => {
    const reply = replies[new URL(url).pathname] ?? { status: 404, body: {} };
    if (reply === "offline") throw new TypeError("Network request failed");
    return { status: reply.status, json: async () => reply.body };
  });
});

afterEach(() => {
  queryClient.clear();
  jest.restoreAllMocks();
});

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

async function renderProfile() {
  return render(
    <RootRouteProvider route="signed-in">
      <TranslationProvider>
        <ProfileRoute />
      </TranslationProvider>
      <PrivacyCover />
    </RootRouteProvider>
  );
}

const shows = () =>
  mockFetch.mock.calls
    .filter(([url]) => new URL(String(url)).pathname.includes("/show/"))
    .map(([url, init]) => {
      const parsed = new URL(String(url));
      return `${(init as RequestInit | undefined)?.method ?? "GET"} ${parsed.pathname}${parsed.search}`;
    });

const section = (key: "contact" | "personal") =>
  within(screen.getByTestId(`directory-profile-section-${key}`));

describe("Sensitive sections on the profile", () => {
  it("starts Contact and Personal closed, between Job and Record, without asking for values", async () => {
    await renderProfile();
    await screen.findByText("Alice Novak");

    expect(section("contact").getByText("Hidden until you open it.")).toBeOnTheScreen();
    expect(section("personal").getByText("Hidden until you open it.")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-profile-show-contact")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-profile-show-personal")).toBeOnTheScreen();
    expect(shows()).toEqual([]);
    expect(pressableProblems(screen.toJSON() as never)).toEqual([]);
  });

  it("opens one Section with one Show in the device language, with the read-log line", async () => {
    await renderProfile();
    await screen.findByText("Alice Novak");

    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));

    expect(await section("contact").findByText("+420 777 123 456")).toBeOnTheScreen();
    expect(section("contact").getByText("alice@home.test")).toBeOnTheScreen();
    expect(section("contact").getByText("Petr Novak, +420 602 000 111")).toBeOnTheScreen();
    expect(
      section("contact").getByText("Your view of this section is recorded in the read log.")
    ).toBeOnTheScreen();
    expect(section("personal").getByText("Hidden until you open it.")).toBeOnTheScreen();
    expect(shows()).toEqual(["POST /api/directory/o-a/people/e-alice/show/contact?language=en"]);
  });

  it("shows the Personal values the server formatted, the address line by line", async () => {
    await renderProfile();
    await screen.findByText("Alice Novak");

    await fireEvent.press(screen.getByTestId("directory-profile-show-personal"));

    expect(
      await section("personal").findByText("Dlouhá 12\n110 00 Praha\nCzechia")
    ).toBeOnTheScreen();
    expect(section("personal").getByText("17 Apr 1990")).toBeOnTheScreen();
    expect(shows()).toEqual(["POST /api/directory/o-a/people/e-alice/show/personal?language=en"]);
  });

  it("says a failed Show couldn't load inside that Section, and Retry opens it", async () => {
    answer(showPath("contact"), "offline");
    await renderProfile();
    await screen.findByText("Alice Novak");

    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));

    expect(await section("contact").findByText("Couldn't load this section.")).toBeOnTheScreen();
    expect(section("personal").queryByText("Couldn't load this section.")).toBeNull();
    answer(showPath("contact"), { status: 200, body: SHOWN_CONTACT });
    await fireEvent.press(screen.getByTestId("directory-profile-retry-contact"));

    expect(await section("contact").findByText("+420 777 123 456")).toBeOnTheScreen();
    expect(shows()).toHaveLength(2);
  });

  it("keeps an opened Section through pull-to-refresh and a foreground re-read, with no second Show", async () => {
    await renderProfile();
    await screen.findByText("Alice Novak");
    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));
    await section("contact").findByText("+420 777 123 456");
    const profileReads = () =>
      mockFetch.mock.calls.filter(([url]) => new URL(String(url)).pathname === PROFILE_PATH);
    expect(profileReads()).toHaveLength(1);

    const scroll = screen.getByTestId("directory-profile-scroll");
    await act(async () => scroll.props.refreshControl.props.onRefresh());
    await waitFor(() => expect(profileReads()).toHaveLength(2));
    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(profileReads()).toHaveLength(3));

    expect(section("contact").getByText("+420 777 123 456")).toBeOnTheScreen();
    expect(shows()).toHaveLength(1);
  });

  it("closes an opened Section on leaving the person, Reports to included", async () => {
    answer(PROFILE_PATH, {
      status: 200,
      body: {
        ...ALICE,
        sections: {
          ...ALICE.sections,
          card: {
            level: "READ",
            jobTitle: "Designer",
            reportsTo: { employmentId: "e-bob", name: "Bob Boss" },
          },
        },
      },
    });
    await renderProfile();
    await screen.findByText("Alice Novak");
    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));
    await section("contact").findByText("+420 777 123 456");

    await fireEvent.press(screen.getByTestId("directory-profile-reports-to"));
    expect(router.push).toHaveBeenCalled();
    // Pushing Reports to blurs this screen, which stays mounted underneath.
    await act(async () => blur());

    expect(screen.queryByText("+420 777 123 456")).toBeNull();
    expect(section("contact").getByText("Hidden until you open it.")).toBeOnTheScreen();
  });

  it("drops a Show that answers after the person was left", async () => {
    let release: () => void = () => undefined;
    await renderProfile();
    await screen.findByText("Alice Novak");
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(
          (resolve) => (release = () => resolve({ status: 200, json: async () => SHOWN_CONTACT }))
        )
    );

    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));
    await act(async () => blur());
    await act(async () => release());

    expect(screen.queryByText("+420 777 123 456")).toBeNull();
    expect(section("contact").getByText("Hidden until you open it.")).toBeOnTheScreen();
  });

  it("opens the person's own Sections without Show and without the read-log line", async () => {
    answer(PROFILE_PATH, { status: 200, body: { ...ALICE, self: true } });
    answer(showPath("contact"), { status: 200, body: { ...SHOWN_CONTACT, recorded: false } });
    answer(showPath("personal"), { status: 200, body: { ...SHOWN_PERSONAL, recorded: false } });
    await renderProfile();
    await screen.findByText("Alice Novak");

    expect(await section("contact").findByText("+420 777 123 456")).toBeOnTheScreen();
    expect(await section("personal").findByText("17 Apr 1990")).toBeOnTheScreen();
    expect(screen.queryByTestId("directory-profile-show-contact")).toBeNull();
    expect(screen.queryByText("Your view of this section is recorded in the read log.")).toBeNull();
    expect(shows().sort()).toEqual([
      "POST /api/directory/o-a/people/e-alice/show/contact?language=en",
      "POST /api/directory/o-a/people/e-alice/show/personal?language=en",
    ]);
  });

  it("offers no Copy on private and emergency values", async () => {
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation(() => undefined);
    await renderProfile();
    await screen.findByText("Alice Novak");
    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));
    await section("contact").findByText("+420 777 123 456");

    await fireEvent.press(screen.getByTestId("directory-profile-value-privatePhone"));
    await fireEvent.press(screen.getByTestId("directory-profile-value-privateEmail"));
    await fireEvent.press(screen.getByTestId("directory-profile-value-emergencyContact1"));

    expect(sheet.mock.calls.map(([options]) => options.options)).toEqual([
      ["Call", "Cancel"],
      ["Email", "Cancel"],
      ["Call", "Cancel"],
    ]);
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it("puts the cover up when the app goes inactive with a Section open, and not once it closes", async () => {
    let changeTo: (state: AppStateStatus) => void = () => undefined;
    jest.spyOn(AppState, "addEventListener").mockImplementation((event, listener) => {
      if (event === "change") changeTo = (state) => listener(state);
      return { remove: jest.fn() } as never;
    });
    await renderProfile();
    await screen.findByText("Alice Novak");

    await act(async () => changeTo("inactive"));
    expect(screen.queryByTestId("privacy-cover")).toBeNull();
    await act(async () => changeTo("active"));

    await fireEvent.press(screen.getByTestId("directory-profile-show-contact"));
    await section("contact").findByText("+420 777 123 456");
    await act(async () => changeTo("inactive"));
    expect(screen.getByTestId("privacy-cover")).toBeOnTheScreen();
    await act(async () => changeTo("active"));
    expect(screen.queryByTestId("privacy-cover")).toBeNull();

    await act(async () => blur());
    await act(async () => changeTo("inactive"));
    expect(screen.queryByTestId("privacy-cover")).toBeNull();
  });

  it("leaves Contact and Personal out when the server sends neither", async () => {
    answer(PROFILE_PATH, {
      status: 200,
      body: { ...ALICE, sections: { card: ALICE.sections.card } },
    });
    await renderProfile();
    await screen.findByText("Alice Novak");

    expect(screen.queryByTestId("directory-profile-section-contact")).toBeNull();
    expect(screen.queryByTestId("directory-profile-section-personal")).toBeNull();
  });
});

function blur() {
  for (const cleanup of [...mockBlurs]) {
    mockBlurs.delete(cleanup);
    cleanup();
  }
}
