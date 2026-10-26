import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import DirectoryRoute from "@/app/directory";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { pressableProblems } from "@/test-support/accessibility";
import {
  directoryOrganization as org,
  directoryPerson as person,
  formerDirectoryPerson as former,
} from "@/test-support/directory";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockLanguage = "en";

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
  useFocusEffect: () => undefined,
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: mockLanguage }],
  getCalendars: () => [{ uses24hourClock: true }],
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: "u-me", name: "Me", email: "me@dev.local", twoFactorEnabled: false }),
}));

type Reply = { status: number; body: unknown } | "offline" | "hold";

let replies: Record<string, Reply> = {};

const ACME = org("o-acme", { name: "Acme s.r.o." });
const KOLAR = org("o-kolar", { name: "Kolář Holding a.s." });

const ACME_PEOPLE = {
  formerList: false,
  people: [
    person("eva", "Eva Horáková", {
      jobTitle: "Support specialist",
      department: { id: "d-sup", name: "Customer support", archived: false },
    }),
    person("jonas", "Jonas Weber", {
      jobTitle: "Product designer",
      markers: ["EXTERNAL_WORKER"],
      department: { id: "d-eng", name: "Engineering", archived: false },
    }),
    person("me", "Jakub Procházka", { jobTitle: "Backend developer" }),
  ],
};

function answer(path: string, reply: Reply) {
  replies[path] = reply;
}

function answerDefaults() {
  replies = {};
  answer("/api/directory/organizations", { status: 200, body: [ACME] });
  answer("/api/directory/o-acme/people", { status: 200, body: ACME_PEOPLE });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage = "en";
  mockCanGoBack.mockReturnValue(true);
  answerDefaults();
  mockFetch.mockImplementation(async (url: string) => {
    const reply = replies[new URL(url).pathname] ?? { status: 404, body: {} };
    if (reply === "offline") throw new TypeError("Network request failed");
    if (reply === "hold") return new Promise(() => undefined);
    return { status: reply.status, json: async () => reply.body };
  });
});

afterEach(() => queryClient.clear());

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

const paths = () => mockFetch.mock.calls.map(([url]) => new URL(String(url)).pathname);

async function renderDirectory(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <DirectoryRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

describe("Directory route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderDirectory("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("puts the shell underneath a cold deep link and comes back on top", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderDirectory();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith("/directory");
  });
});

describe("Directory screen", () => {
  it("shows skeleton rows until the first answer", async () => {
    answer("/api/directory/o-acme/people", "hold");

    await renderDirectory();

    const loading = await screen.findByTestId("directory-loading");
    expect(loading).toHaveProp("accessibilityLabel", "Loading the directory");
    expect(within(screen.getByTestId("directory")).getByText("Directory")).toBeOnTheScreen();
  });

  it("labels the skeleton in Czech", async () => {
    mockLanguage = "cs";
    answer("/api/directory/o-acme/people", "hold");

    await renderDirectory();

    expect(await screen.findByTestId("directory-loading")).toHaveProp(
      "accessibilityLabel",
      "Načítání adresáře"
    );
  });

  it("lists each person with title, department and markers, and You on the viewer's row", async () => {
    await renderDirectory();

    const eva = await screen.findByTestId("directory-row-e-eva");
    expect(within(eva).getByText("Eva Horáková")).toBeOnTheScreen();
    expect(within(eva).getByText("Support specialist · Customer support")).toBeOnTheScreen();
    const jonas = screen.getByTestId("directory-row-e-jonas");
    expect(within(jonas).getByText("External worker")).toBeOnTheScreen();
    expect(within(screen.getByTestId("directory-row-e-me")).getByText("You")).toBeOnTheScreen();
    expect(within(eva).queryByText("You")).toBeNull();
    expect(screen.getByText("3 people")).toBeOnTheScreen();
  });

  it("shows the plain organization name, with no picker, for a viewer in one directory organization", async () => {
    answer("/api/directory/organizations", {
      status: 200,
      body: [ACME, org("o-off", { enabled: false })],
    });

    await renderDirectory();

    expect(await screen.findByTestId("directory-organization")).toHaveTextContent("Acme s.r.o.");
    expect(screen.queryByTestId("directory-organization-picker")).toBeNull();
  });

  it("offers a picker for a viewer in two directory organizations and reads the one picked", async () => {
    answer("/api/directory/organizations", { status: 200, body: [ACME, KOLAR] });
    answer("/api/directory/o-kolar/people", {
      status: 200,
      body: { formerList: false, people: [person("lucie", "Lucie Králová")] },
    });

    await renderDirectory();
    const picker = await screen.findByTestId("directory-organization-picker");
    expect(picker).toHaveTextContent("Acme s.r.o.");
    await act(async () => fireEvent.press(picker));
    await act(async () => fireEvent.press(screen.getByTestId("directory-organizations-o-kolar")));

    expect(await screen.findByTestId("directory-row-e-lucie")).toBeOnTheScreen();
    expect(screen.getByTestId("directory-organization-picker")).toHaveTextContent(
      "Kolář Holding a.s."
    );
    expect(screen.queryByTestId("directory-row-e-eva")).toBeNull();
  });

  it("gives a viewer without the Former list no Current/Former switch", async () => {
    await renderDirectory();

    await screen.findByTestId("directory-row-e-eva");
    expect(screen.queryByTestId("directory-segment-former")).toBeNull();
    expect(paths()).not.toContain("/api/directory/o-acme/former");
  });

  it("gives the Former list's viewers a switch to the ended spells, latest end first", async () => {
    answer("/api/directory/o-acme/people", {
      status: 200,
      body: { ...ACME_PEOPLE, formerList: true },
    });
    answer("/api/directory/o-acme/former", {
      status: 200,
      body: [
        former("carol", "Carol Svoboda", "2026-06-30T10:00:00.000Z", { jobTitle: "Accountant" }),
        former("frank", "Frank Novak", "2026-08-15T10:00:00.000Z", {
          markers: ["ACCOUNT_DELETED", "REJOINED"],
          hold: true,
          nextRemoval: { section: "workContact", date: "2026-09-14T10:00:00.000Z" },
        }),
      ],
    });

    await renderDirectory();
    await act(async () => fireEvent.press(await screen.findByTestId("directory-segment-former")));

    const frank = await screen.findByTestId("directory-former-row-e-frank");
    expect(within(frank).getByText("Ended 15 Aug 2026")).toBeOnTheScreen();
    expect(within(frank).getByText("Work contact removed 14 Sept 2026")).toBeOnTheScreen();
    expect(within(frank).getByText("Retention hold")).toBeOnTheScreen();
    expect(within(frank).getByText("Account deleted")).toBeOnTheScreen();
    expect(within(frank).getByText("Rejoined")).toBeOnTheScreen();
    const carol = screen.getByTestId("directory-former-row-e-carol");
    expect(within(carol).getByText("Accountant · Ended 30 Jun 2026")).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^directory-former-row-/).map((row) => row.props.testID);
    expect(rows).toEqual(["directory-former-row-e-frank", "directory-former-row-e-carol"]);
    expect(screen.getByText("by end date")).toBeOnTheScreen();
  });

  it("opens a row's profile, and a former row's", async () => {
    answer("/api/directory/o-acme/people", {
      status: 200,
      body: { ...ACME_PEOPLE, formerList: true },
    });
    answer("/api/directory/o-acme/former", {
      status: 200,
      body: [former("ondrej", "Ondřej Malý", "2026-09-30T00:00:00.000Z")],
    });
    await renderDirectory();

    await act(async () => fireEvent.press(await screen.findByTestId("directory-row-e-eva")));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/directory/[employmentId]",
      params: { employmentId: "e-eva", organizationId: "o-acme" },
    });

    await act(async () => fireEvent.press(screen.getByTestId("directory-segment-former")));
    await act(async () =>
      fireEvent.press(await screen.findByTestId("directory-former-row-e-ondrej"))
    );
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/directory/[employmentId]",
      params: { employmentId: "e-ondrej", organizationId: "o-acme" },
    });
  });

  it("says the directory is read live and offers Retry when the server can't be reached", async () => {
    answer("/api/directory/o-acme/people", "offline");

    await renderDirectory();

    const offline = await screen.findByTestId("directory-offline", {}, { timeout: 5000 });
    expect(
      within(offline).getByText(
        "Can't reach the server. The directory is read live and isn't kept on this phone."
      )
    ).toBeOnTheScreen();

    answer("/api/directory/o-acme/people", { status: 200, body: ACME_PEOPLE });
    await act(async () => fireEvent.press(screen.getByTestId("directory-retry")));
    expect(await screen.findByTestId("directory-row-e-eva")).toBeOnTheScreen();
  });

  it("says the same in Czech", async () => {
    mockLanguage = "cs";
    answer("/api/directory/organizations", "offline");

    await renderDirectory();

    const offline = await screen.findByTestId("directory-offline", {}, { timeout: 5000 });
    expect(
      within(offline).getByText(
        "Nelze se spojit se serverem. Adresář se načítá živě a v telefonu se neukládá."
      )
    ).toBeOnTheScreen();
    expect(within(offline).getByText("Zkusit znovu")).toBeOnTheScreen();
  });

  it("searches name and job title, and clears an empty search with its filters", async () => {
    await renderDirectory();
    const search = await screen.findByTestId("directory-search");

    await act(async () => fireEvent.changeText(search, "designer"));
    expect(screen.getByTestId("directory-row-e-jonas")).toBeOnTheScreen();
    expect(screen.queryByTestId("directory-row-e-eva")).toBeNull();

    await act(async () => fireEvent.changeText(search, "nobody at all"));
    const empty = screen.getByTestId("directory-no-match");
    expect(within(empty).getByText("No one matches")).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId("directory-clear-filters")));

    expect(screen.getByTestId("directory-search")).toHaveProp("value", "");
    expect(screen.getByTestId("directory-row-e-eva")).toBeOnTheScreen();
  });

  it("words the empty search in Czech", async () => {
    mockLanguage = "cs";
    await renderDirectory();

    await act(async () =>
      fireEvent.changeText(await screen.findByTestId("directory-search"), "nikdo")
    );

    expect(screen.getByText("Nikdo neodpovídá")).toBeOnTheScreen();
    expect(screen.getByText("Vymazat hledání a filtry")).toBeOnTheScreen();
  });

  it("keeps the rows when a re-read fails, with the offline line above them", async () => {
    await renderDirectory();
    await screen.findByTestId("directory-row-e-eva");

    answer("/api/directory/o-acme/people", "offline");
    const scroll = screen.getByTestId("directory-scroll");
    await act(async () => scroll.props.refreshControl.props.onRefresh());

    expect(await screen.findByTestId("directory-offline", {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByTestId("directory-row-e-eva")).toBeOnTheScreen();
  });

  it("marks an archived department on the row and in its filter sheet", async () => {
    answer("/api/directory/o-acme/people", {
      status: 200,
      body: {
        ...ACME_PEOPLE,
        people: [
          person("eva", "Eva Horáková", {
            jobTitle: "Support specialist",
            department: { id: "d-old", name: "Helpdesk", archived: true },
          }),
        ],
      },
    });
    await renderDirectory();

    const eva = await screen.findByTestId("directory-row-e-eva");
    expect(within(eva).getByText("Support specialist · Helpdesk (archived)")).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId("directory-filter-department")));
    expect(
      within(screen.getByTestId("directory-department-sheet-d-old")).getByText(
        "Helpdesk (archived)"
      )
    ).toBeOnTheScreen();
  });

  it("filters by type, and by department only once the server sends departments", async () => {
    await renderDirectory();
    await screen.findByTestId("directory-row-e-eva");
    expect(screen.queryByTestId("directory-filter-location")).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId("directory-filter-type")));
    await act(async () => fireEvent.press(screen.getByTestId("directory-type-sheet-external")));
    expect(screen.getByTestId("directory-row-e-jonas")).toBeOnTheScreen();
    expect(screen.queryByTestId("directory-row-e-eva")).toBeNull();

    await act(async () => fireEvent.press(screen.getByTestId("directory-filter-type")));
    await act(async () => fireEvent.press(screen.getByTestId("directory-type-sheet-all")));
    await act(async () => fireEvent.press(screen.getByTestId("directory-filter-department")));
    await act(async () => fireEvent.press(screen.getByTestId("directory-department-sheet-d-sup")));
    expect(screen.getByTestId("directory-row-e-eva")).toBeOnTheScreen();
    expect(screen.queryByTestId("directory-row-e-jonas")).toBeNull();
  });

  it("shows a lapsed organization's banner, and keeps the list readable", async () => {
    answer("/api/directory/organizations", {
      status: 200,
      body: [{ ...ACME, writable: false }],
    });

    await renderDirectory();

    const banner = await screen.findByTestId("directory-lapsed");
    expect(
      within(banner).getByText(
        "Acme s.r.o. is no longer on Enterprise. Profiles stay readable here, and nothing new can be added."
      )
    ).toBeOnTheScreen();
    expect(within(banner).queryByText("Plans are managed on the web.")).toBeNull();
    expect(await screen.findByTestId("directory-row-e-eva")).toBeOnTheScreen();
  });

  it("tells an org admin of a lapsed organization that plans are managed on the web", async () => {
    answer("/api/directory/organizations", {
      status: 200,
      body: [{ ...ACME, writable: false, role: "ORGANIZATION_ADMIN" }],
    });

    await renderDirectory();

    const banner = await screen.findByTestId("directory-lapsed");
    expect(within(banner).getByText("Plans are managed on the web.")).toBeOnTheScreen();
  });

  it("gives every pressable a testID and a label of its own", async () => {
    answer("/api/directory/organizations", { status: 200, body: [ACME, KOLAR] });
    answer("/api/directory/o-acme/people", {
      status: 200,
      body: { ...ACME_PEOPLE, formerList: true },
    });

    await renderDirectory();
    await screen.findByTestId("directory-row-e-eva");

    await waitFor(() => expect(pressableProblems(screen.toJSON() as never)).toEqual([]));
  });
});
