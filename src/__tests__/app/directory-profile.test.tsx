import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { ActionSheetIOS, Linking } from "react-native";

import ProfileRoute from "@/app/directory/[employmentId]";
import { TranslationProvider } from "@/i18n/use-translation";
import type { DirectoryProfile } from "@/lib/directory";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { openWebPage } from "@/lib/web";
import { pressableProblems } from "@/test-support/accessibility";
import {
  directoryOrganization as org,
  directoryProfile as profileOf,
} from "@/test-support/directory";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockLanguage = "en";
let mockParams: Record<string, string> = {};

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
  useLocalSearchParams: () => mockParams,
  useFocusEffect: () => undefined,
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: mockLanguage }],
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

const ACME = org("o-a", { name: "Acme s.r.o." });
const PHONE = {
  e164: "+420602111061",
  display: "+420 602 111 061",
  country: { code: "CZ", name: "Czechia" },
};

const EVA: DirectoryProfile = profileOf("eva", "Eva Horáková", {
  photoUrl: "https://photos/eva-small",
  markers: ["EXTERNAL_WORKER"],
  sections: {
    card: {
      level: "READ",
      jobTitle: "Support specialist",
      department: { id: "d-sup", name: "Customer support", archived: false },
      location: {
        id: "l-prg",
        name: "Prague HQ",
        archived: false,
        country: { code: "CZ", name: "Czechia" },
      },
      reportsTo: { employmentId: "e-marketa", name: "Markéta Černá" },
    },
    photo: {
      level: "READ",
      photo: { smallUrl: "https://photos/eva-small", fullUrl: "https://photos/eva-full" },
    },
    workContact: { level: "READ", workEmail: null, workPhone: PHONE },
  },
});

const ONDREJ: DirectoryProfile = profileOf("ondrej", "Ondřej Malý", {
  ended: true,
  sections: {
    card: {
      level: "WRITE",
      jobTitle: "Accountant",
      reportsTo: null,
      department: null,
      location: null,
    },
    workContact: { level: "WRITE", workEmail: null, workPhone: null },
    job: {
      level: "WRITE",
      spell: { startedAt: "2022-06-01T00:00:00.000Z", endedAt: "2026-09-30T00:00:00.000Z" },
      legalName: null,
      employeeNumber: "A-0007",
      startDate: "2022-06-01",
      leavingDate: "2026-09-30",
      probationEndDate: null,
      contractType: "PERMANENT",
      workingTime: "FULL_TIME",
    },
  },
  account: { status: "ACTIVE", signInEmail: "ondrej@gmail.com", directoryRoles: [] },
  retention: {
    hold: {
      setAt: "2026-10-03T09:00:00.000Z",
      setBy: { userId: "u-martin", name: "Martin Svoboda" },
    },
    sections: {
      card: { status: "KEPT_UNTIL_ERASED" },
      photo: { status: "REMOVES_ON", date: "2027-11-30" },
      workContact: { status: "REMOVED_ON", date: "2026-10-30" },
      job: { status: "REMOVES_ON", date: "2029-11-30" },
    },
  },
});

function answer(path: string, reply: Reply) {
  replies[path] = reply;
}

function answerProfile(profile: DirectoryProfile) {
  answer(`/api/directory/o-a/people/${profile.employmentId}`, { status: 200, body: profile });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = "en";
  mockCanGoBack.mockReturnValue(true);
  replies = {};
  answer("/api/directory/organizations", { status: 200, body: [ACME] });
  mockFetch.mockImplementation(async (url: string) => {
    const reply = replies[new URL(url).pathname] ?? { status: 404, body: {} };
    if (reply === "offline") throw new TypeError("Network request failed");
    return { status: reply.status, json: async () => reply.body };
  });
});

afterEach(() => queryClient.clear());

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

async function renderProfile(
  employmentId: string,
  route: RootRoute = "signed-in",
  organizationId = "o-a"
) {
  mockParams = { employmentId, organizationId };
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <ProfileRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

const profileUrls = () =>
  mockFetch.mock.calls
    .map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname.includes("/people/"));

describe("Directory profile route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderProfile("e-eva", "welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reads the profile live in the device language", async () => {
    answerProfile(EVA);
    mockLanguage = "cs";
    await renderProfile("e-eva");

    expect(await screen.findByText("Eva Horáková")).toBeOnTheScreen();
    expect(profileUrls().map((url) => url.search)).toEqual(["?language=cs"]);
  });

  it("shows the header, the Card and Work contact a colleague reads, and nothing else", async () => {
    answerProfile(EVA);
    await renderProfile("e-eva");

    expect(await screen.findByText("Eva Horáková")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-marker-EXTERNAL_WORKER")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-profile-section-card")).toBeOnTheScreen();
    expect(screen.getByText("Customer support")).toBeOnTheScreen();
    expect(screen.getByText("Prague HQ, Czechia")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-profile-section-workContact")).toBeOnTheScreen();
    expect(screen.getByText("+420 602 111 061")).toBeOnTheScreen();
    expect(screen.queryByTestId("directory-profile-section-job")).toBeNull();
    expect(screen.queryByTestId("directory-profile-section-record")).toBeNull();
    expect(screen.queryByTestId("directory-profile-self")).toBeNull();
    expect(screen.queryByText(/edit/i)).toBeNull();
    expect(screen.queryByTestId("directory-profile-retention")).toBeNull();
  });

  it("puts every control on a labelled pressable with its own testID", async () => {
    answerProfile(EVA);
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    expect(pressableProblems(screen.toJSON() as never)).toEqual([]);
  });

  it("offers Call and Message from the work phone and disables Email without a work email", async () => {
    answerProfile(EVA);
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    expect(screen.getByTestId("directory-profile-email")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("directory-profile-call"));
    await fireEvent.press(screen.getByTestId("directory-profile-message"));

    expect(open.mock.calls).toEqual([["tel:+420602111061"], ["sms:+420602111061"]]);
  });

  it("hides the contact row from a viewer without Work contact", async () => {
    answerProfile({ ...EVA, sections: { card: EVA.sections.card } });
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    expect(screen.queryByTestId("directory-profile-contact-row")).toBeNull();
    expect(screen.queryByTestId("directory-profile-section-workContact")).toBeNull();
  });

  it("offers Call and Copy on the work phone, and copies the display form", async () => {
    answerProfile(EVA);
    const sheet = jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation((_options, pick) => pick(1));
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    await fireEvent.press(screen.getByTestId("directory-profile-value-workPhone"));

    expect(sheet.mock.calls[0][0].options).toEqual(["Call", "Copy", "Cancel"]);
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith("+420 602 111 061"));
  });

  it("opens Reports to as that person's profile", async () => {
    answerProfile(EVA);
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    await fireEvent.press(screen.getByTestId("directory-profile-reports-to"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/directory/[employmentId]",
      params: { employmentId: "e-marketa", organizationId: "o-a" },
    });
  });

  it("opens the full-size Profile photo", async () => {
    answerProfile(EVA);
    await renderProfile("e-eva");
    await screen.findByText("Eva Horáková");

    await fireEvent.press(screen.getByTestId("directory-profile-photo"));

    expect(screen.getByTestId("image-viewer")).toBeOnTheScreen();
  });

  it("shows the viewer's own profile with the notice that opens the web edit page", async () => {
    answerProfile({ ...EVA, self: true });
    await renderProfile("e-eva");

    const notice = await screen.findByTestId("directory-profile-self");
    expect(
      within(notice).getByText("This is your profile at Acme s.r.o. You change it on the web.")
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("directory-profile-edit-on-web"));

    expect(openWebPage).toHaveBeenCalledWith(
      "/directory/person/edit/?organizationId=o-a&employmentId=e-eva"
    );
  });

  it("says clearing is still possible on the web once the organization has lapsed", async () => {
    answer("/api/directory/organizations", {
      status: 200,
      body: [org("o-a", { name: "Acme s.r.o.", writable: false })],
    });
    answerProfile({ ...EVA, self: true });
    await renderProfile("e-eva");

    expect(
      await screen.findByText(
        "Acme s.r.o.'s plan no longer includes the directory. On the web you can still clear your details."
      )
    ).toBeOnTheScreen();
    expect(screen.getByTestId("directory-lapsed")).toBeOnTheScreen();
  });

  it("shows removal dates, purged Sections and the Retention block on a former profile", async () => {
    answerProfile(ONDREJ);
    await renderProfile("e-ondrej");
    await screen.findByText("Ondřej Malý");

    expect(screen.queryByTestId("directory-profile-contact-row")).toBeNull();
    const workContact = screen.getByTestId("directory-profile-section-workContact");
    expect(within(workContact).getByText("Removed by retention on 30 Oct 2026")).toBeOnTheScreen();
    expect(within(workContact).queryByText("Work phone")).toBeNull();
    const job = screen.getByTestId("directory-profile-section-job");
    expect(within(job).getByText("Removed on 30 Nov 2029")).toBeOnTheScreen();
    expect(within(job).getByText("Permanent")).toBeOnTheScreen();

    const retention = screen.getByTestId("directory-profile-retention");
    expect(within(retention).getByText("Kept until erased")).toBeOnTheScreen();
    expect(within(retention).getByText("Removed on 30 Nov 2027")).toBeOnTheScreen();
    expect(
      within(retention).getByText("Retention hold set by Martin Svoboda on 3 Oct 2026")
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Set retention hold|Lift/)).toBeNull();
  });

  it("says a profile out of reach isn't available", async () => {
    await renderProfile("e-gone");

    expect(await screen.findByText("This profile isn't available to you.")).toBeOnTheScreen();
  });

  it("offers Retry without the server, with nothing kept", async () => {
    answer("/api/directory/o-a/people/e-eva", "offline");
    await renderProfile("e-eva");

    expect(await screen.findByTestId("directory-offline", {}, { timeout: 5000 })).toBeOnTheScreen();
    answerProfile(EVA);
    await fireEvent.press(screen.getByTestId("directory-retry"));

    expect(await screen.findByText("Eva Horáková")).toBeOnTheScreen();
  });
});
