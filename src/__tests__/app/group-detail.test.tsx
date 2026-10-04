import { render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";

import GroupDetailRoute from "@/app/groups/[groupId]";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useMyGroups, useStoreOpen, type MyGroup } from "@/lib/local-store";
import { queryClient } from "@/lib/query";
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

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

const offline = () => mockFetch.mockRejectedValue(new TypeError("Network request failed"));

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  storeOpen.mockReturnValue(true);
  myGroups.mockReturnValue([group()]);
  mockFetch.mockResolvedValue(answer(200, COUNTRIES));
});

afterEach(() => queryClient.clear());

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

    const header = within(screen.getByTestId("group-header"));
    expect(header.getByText("Dev Team")).toBeOnTheScreen();
    expect(header.getByText("Olivia Owner")).toBeOnTheScreen();
    expect(header.getByText("Manager")).toBeOnTheScreen();
    expect(screen.getAllByText("Dev Team")).toHaveLength(1);
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName("Dev Team");
  });

  it("shows no badge in a group the viewer is a plain member of", async () => {
    myGroups.mockReturnValue([group({ role: null })]);

    await renderDetail();

    expect(within(screen.getByTestId("group-header")).queryByText("Manager")).toBeNull();
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
    expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/api\/bank-holidays\/countries$/);
  });

  it("shows the country's code until the countries read answers", async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    myGroups.mockReturnValue([group({ holidayCountry: "CZ" })]);

    await renderDetail();

    expect(holidayCountry()).toHaveTextContent(/CZ/);
  });

  it("shows None and asks for no countries without a holiday country", async () => {
    await renderDetail();

    expect(holidayCountry()).toHaveTextContent(new RegExp(en.groups.facts.none));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the default allowance", async () => {
    myGroups.mockReturnValue([group({ defaultVacationDays: 25, defaultHomeOfficeDays: 10 })]);

    await renderDetail();

    expect(screen.getByTestId("group-facts-allowance")).toHaveTextContent(
      /25 vacation, 10 home office/
    );
  });

  it("shows the header and facts offline, the country by its code", async () => {
    offline();
    myGroups.mockReturnValue([group({ holidayCountry: "CZ" })]);

    await renderDetail();

    // A request that got no answer is tried once more before the read fails.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(within(screen.getByTestId("group-header")).getByText("Dev Team")).toBeOnTheScreen();
    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Fri");
    expect(holidayCountry()).toHaveTextContent(/CZ/);
    expect(screen.getByTestId("group-facts-allowance")).toHaveTextContent(
      /20 vacation, 0 home office/
    );
  });

  it("says the group no longer exists when the store does not hold it", async () => {
    myGroups.mockReturnValue([group({ id: "another-group" })]);

    await renderDetail();

    expect(screen.getByTestId("group-not-found")).toHaveTextContent(en.groups.notFound);
    expect(screen.queryByTestId("group-facts")).toBeNull();
    expect(screen.getByTestId("stack-back")).toHaveAccessibleName(en.nav.groups);
  });

  it("asks the server for nothing but the countries, whatever the viewer's role", async () => {
    myGroups.mockReturnValue([group({ role: "admin", holidayCountry: "CZ" })]);

    await renderDetail();

    await waitFor(() => expect(holidayCountry()).toHaveTextContent(/Czechia/));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
