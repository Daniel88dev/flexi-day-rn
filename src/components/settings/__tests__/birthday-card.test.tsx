import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

import { BirthdaySettings } from "@/components/settings/birthday-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { pull } from "@/lib/local-store";
import { queryClient, type BirthdaySettings as Settings } from "@/lib/query";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock(
  "@react-native-community/datetimepicker",
  () => jest.requireActual("@/test-support/date-time-picker").FakeDateTimePicker
);

const DESIGN = { groupId: "g-1", groupName: "Design" };
const PLATFORM = { groupId: "g-2", groupName: "Platform" };

const SHARE_REFUSED = {
  errors: [
    {
      message: "Sharing a birthday needs a group on a paid plan",
      context: { reason: "PLAN_LIMIT", code: "BIRTHDAY_SHARE_PLAN_REQUIRED" },
    },
  ],
};

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

/** A backend that keeps what a PUT sends; `refuseShare` answers turning sharing on with a 402. */
function server(start: Settings, { refuseShare = false } = {}) {
  let stored = start;
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      if (refuseShare && body.shared && !stored.birthday?.shared) return answer(402, SHARE_REFUSED);
      stored = { ...stored, birthday: body };
    }
    if (init?.method === "DELETE") {
      stored = { ...stored, birthday: null };
      return answer(204, null);
    }
    return answer(200, stored);
  });
}

function puts() {
  return mockFetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([, init]) => JSON.parse(String(init.body)));
}

async function renderBare() {
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <BirthdaySettings />
      </QueryClientProvider>
    </TranslationProvider>
  );
}

async function renderCard() {
  await renderBare();
  await waitFor(() => expect(screen.getByTestId("settings-birthday")).toBeEnabled());
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: new Date(2026, 9, 18, 10),
    doNotFake: ["setImmediate", "nextTick", "queueMicrotask"],
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

describe("BirthdaySettings", () => {
  it("shows the date, the year, the age at the next birthday, and who sees what", async () => {
    server({
      birthday: { month: 3, day: 14, year: 1988, shared: true },
      canShare: true,
      shareGroups: [DESIGN, PLATFORM],
    });
    await renderCard();

    const card = screen.getByTestId("settings-birthday");
    expect(card).toHaveTextContent(/14 March/);
    expect(card).toHaveTextContent(/1988, turns 39/);
    expect(card).toHaveTextContent(/Edit/);
    expect(screen.getByTestId("settings-birthday-share")).toHaveProp("value", true);
    const groups = screen.getByTestId("settings-birthday-audience-groups");
    expect(groups).toHaveTextContent(/Design, Platform/);
    expect(within(groups).getByLabelText("Date: Shown")).toBeOnTheScreen();
    expect(within(groups).getByLabelText("Age: Shown")).toBeOnTheScreen();
    const feeds = screen.getByTestId("settings-birthday-audience-teamFeeds");
    expect(within(feeds).getByLabelText("Age: Not shown")).toBeOnTheScreen();
  });

  it("adds a birthday without a year, and the year drops though the wheel keeps one", async () => {
    server({ birthday: null, canShare: true, shareGroups: [DESIGN] });
    await renderCard();
    expect(screen.getByTestId("settings-birthday")).toHaveTextContent(/Add your birthday/);
    expect(screen.getByTestId("settings-birthday-share")).toHaveProp("disabled", true);

    await fireEvent.press(screen.getByTestId("settings-birthday"));
    expect(screen.getByTestId("birthday-sheet-year")).toHaveProp("value", false);
    expect(screen.getByTestId("birthday-sheet-date")).toHaveProp("accessibilityValue", {
      text: "2000-01-01",
    });
    await fireEvent.press(screen.getByTestId("birthday-sheet-date"));
    await fireEvent.press(screen.getByTestId("birthday-sheet-save"));

    await waitFor(() => expect(screen.queryByTestId("birthday-sheet")).toBeNull());
    expect(puts()).toEqual([{ month: 1, day: 3, year: null, shared: false }]);
    expect(pull).toHaveBeenCalledWith("after-write");
    expect(screen.getByTestId("settings-birthday")).toHaveTextContent(/3 January/);
    expect(screen.getByTestId("settings-birthday")).toHaveTextContent(/No year, age hidden/);
  });

  it("removes the year, and the age goes with it, keeping sharing as it was", async () => {
    server({
      birthday: { month: 3, day: 14, year: 1988, shared: true },
      canShare: true,
      shareGroups: [DESIGN],
    });
    await renderCard();

    await fireEvent.press(screen.getByTestId("settings-birthday"));
    expect(screen.getByTestId("birthday-sheet")).toHaveTextContent(/age goes with it/);
    await fireEvent(screen.getByTestId("birthday-sheet-year"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("birthday-sheet-save"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-birthday")).toHaveTextContent(/No year, age hidden/)
    );
    expect(puts()).toEqual([{ month: 3, day: 14, year: null, shared: true }]);
    const groups = screen.getByTestId("settings-birthday-audience-groups");
    expect(within(groups).getByLabelText("Age: Not shown")).toBeOnTheScreen();
  });

  it("cancels the sheet without saving", async () => {
    server({ birthday: null, canShare: true, shareGroups: [] });
    await renderCard();

    await fireEvent.press(screen.getByTestId("settings-birthday"));
    await fireEvent.press(screen.getByTestId("birthday-sheet-cancel"));

    expect(screen.queryByTestId("birthday-sheet")).toBeNull();
    expect(puts()).toEqual([]);
  });

  it("removes the birthday from the sheet", async () => {
    server({
      birthday: { month: 3, day: 14, year: 1988, shared: true },
      canShare: true,
      shareGroups: [DESIGN],
    });
    await renderCard();

    await fireEvent.press(screen.getByTestId("settings-birthday"));
    await fireEvent.press(screen.getByTestId("birthday-sheet-remove"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-birthday")).toHaveTextContent(/Add your birthday/)
    );
    expect(screen.queryByTestId("birthday-sheet")).toBeNull();
    expect(pull).toHaveBeenCalledWith("after-write");
  });

  it("turns sharing on from the switch while a group is on a paid plan", async () => {
    server({
      birthday: { month: 3, day: 14, year: null, shared: false },
      canShare: true,
      shareGroups: [DESIGN],
    });
    await renderCard();
    expect(screen.getByTestId("settings-birthday-who")).toHaveTextContent(/never goes into/);

    await fireEvent(screen.getByTestId("settings-birthday-share"), "valueChange", true);

    await waitFor(() => expect(puts()).toEqual([{ month: 3, day: 14, year: null, shared: true }]));
    await waitFor(() =>
      expect(screen.getByTestId("settings-birthday-share")).toHaveProp("value", true)
    );
  });

  it("keeps a switch left on through a lapse with the lapsed line, and lets it only turn off", async () => {
    server({
      birthday: { month: 3, day: 14, year: 1988, shared: true },
      canShare: false,
      shareGroups: [DESIGN],
    });
    await renderCard();

    const share = screen.getByTestId("settings-birthday-share");
    expect(share).toHaveProp("value", true);
    expect(share).toHaveProp("disabled", false);
    expect(screen.getByTestId("settings-birthday-who")).toHaveTextContent(
      /no longer on Pro or Enterprise/
    );
    expect(screen.getByTestId("settings-birthday-audience-groups")).toHaveTextContent(/Design/);

    await fireEvent(share, "valueChange", false);

    await waitFor(() =>
      expect(screen.getByTestId("settings-birthday-share")).toHaveProp("value", false)
    );
    expect(screen.getByTestId("settings-birthday-share")).toHaveProp("disabled", true);
  });

  it("shows the notice in place of the switch with no paid or lapsed group", async () => {
    server({
      birthday: { month: 3, day: 14, year: 1988, shared: false },
      canShare: false,
      shareGroups: [],
    });
    await renderCard();

    expect(screen.getByTestId("settings-birthday-notice")).toHaveTextContent(
      /None of your groups is on a paid plan/
    );
    expect(screen.queryByTestId("settings-birthday-share")).toBeNull();
  });

  it("words a share the plan refuses with the lapsed line, under the switch", async () => {
    server(
      {
        birthday: { month: 3, day: 14, year: 1988, shared: false },
        canShare: true,
        shareGroups: [],
      },
      { refuseShare: true }
    );
    await renderCard();

    await fireEvent(screen.getByTestId("settings-birthday-share"), "valueChange", true);

    await waitFor(() =>
      expect(screen.getByTestId("settings-birthday-who")).toHaveTextContent(
        /turning it back on needs a group on a paid plan/
      )
    );
  });

  it("offers Retry while the birthday cannot be read", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    await renderBare();
    await act(() => jest.advanceTimersByTimeAsync(5000));

    expect(await screen.findByText(en.sync.unreachable)).toBeOnTheScreen();
    expect(screen.queryByTestId("settings-birthday")).toBeNull();
    server({ birthday: null, canShare: true, shareGroups: [] });
    await fireEvent.press(screen.getByTestId("settings-birthday-retry"));

    await waitFor(() => expect(screen.getByTestId("settings-birthday")).toBeEnabled());
  });
});
