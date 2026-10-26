import { fireEvent, render, screen } from "@testing-library/react-native";

import MineRoute from "@/app/directory/mine";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  directoryOrganization as org,
  directoryPerson as person,
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
const KOLAR = org("o-k", { name: "Kolář Holding a.s." });

const people = (...rows: ReturnType<typeof person>[]) => ({
  status: 200,
  body: { formerList: false, people: rows },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = "en";
  mockCanGoBack.mockReturnValue(true);
  replies = {};
  answer("/api/directory/organizations", { status: 200, body: [ACME] });
  answer(
    "/api/directory/o-a/people",
    people(person("eva", "Eva Horáková"), person("me", "Jakub Procházka"))
  );
  answer("/api/directory/o-a/people/e-me", {
    status: 200,
    body: profileOf("me", "Jakub Procházka", { self: true }),
  });
  mockFetch.mockImplementation(async (url: string) => {
    const reply = replies[new URL(url).pathname] ?? { status: 404, body: {} };
    if (reply === "offline") throw new TypeError("Network request failed");
    return { status: reply.status, json: async () => reply.body };
  });
});

function answer(path: string, reply: Reply) {
  replies[path] = reply;
}

afterEach(() => queryClient.clear());

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

async function renderMine(route: RootRoute = "signed-in") {
  mockParams = {};
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <MineRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("My directory profile route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderMine("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("opens the viewer's own row as their profile, with the notice", async () => {
    await renderMine();

    expect(await screen.findByTestId("directory-profile-self")).toBeOnTheScreen();
    expect(screen.getByText("Jakub Procházka")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-organization")).toHaveTextContent("Acme s.r.o.");
  });

  it("switches to the viewer's profile in another directory organization", async () => {
    answer("/api/directory/organizations", { status: 200, body: [ACME, KOLAR] });
    answer(
      "/api/directory/o-k/people",
      people(person("me", "Jakub Procházka", { employmentId: "e-me-k" }))
    );
    answer("/api/directory/o-k/people/e-me-k", {
      status: 200,
      body: profileOf("me", "Jakub Procházka", {
        employmentId: "e-me-k",
        organizationId: "o-k",
        self: true,
        jobTitle: "Board secretary",
      }),
    });
    await renderMine();
    await screen.findByTestId("directory-profile-self");

    await fireEvent.press(screen.getByTestId("directory-organization-picker"));
    await fireEvent.press(screen.getByTestId("directory-organizations-o-k"));

    expect(await screen.findByText("Board secretary")).toBeOnTheScreen();
    expect(
      await screen.findByText(
        "This is your profile at Kolář Holding a.s. You change it on the web."
      )
    ).toBeOnTheScreen();
  });

  it("says so when the viewer has no profile in the organization", async () => {
    answer("/api/directory/o-a/people", people(person("eva", "Eva Horáková")));
    await renderMine();

    expect(await screen.findByTestId("directory-mine-none")).toHaveTextContent(
      "You have no profile in this organization's directory."
    );
  });
});
