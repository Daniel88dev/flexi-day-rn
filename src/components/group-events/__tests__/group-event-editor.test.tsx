import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ActionSheetIOS, Alert, type AlertButton } from "react-native";

import {
  GroupEventEditor,
  type GroupEventEditorState,
} from "@/components/group-events/group-event-editor";
import { TranslationProvider } from "@/i18n/use-translation";
import type { GroupEventTarget } from "@/lib/group-events/draft";
import { queryClient } from "@/lib/query/runtime";

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
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock(
  "@react-native-community/datetimepicker",
  () => jest.requireActual("@/test-support/date-time-picker").FakeDateTimePicker
);

const GROUPS = [
  { groupId: "g-design", groupName: "Design", canCreate: true },
  { groupId: "g-free", groupName: "Free team", canCreate: false },
];
const WRITTEN = { droppedOneOffs: 0, events: [], deletedIds: [] };

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

let dropped = 0;
let createStatus = 200;

function requests(method: string) {
  return mockFetch.mock.calls
    .filter(([, init]) => (init?.method ?? "GET") === method)
    .map(([url, init]) => ({
      url: String(url).replace(/^https?:\/\/[^/]+/, ""),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    }));
}

let pickScope: (index: number) => void = () => {};
const sheet = jest
  .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
  .mockImplementation((_options, callback) => {
    pickScope = callback;
  });
let alertButtons: AlertButton[] = [];
const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
  alertButtons = buttons ?? [];
});

const pressAlert = async (text: string) => {
  await act(async () => alertButtons.find((button) => button.text === text)?.onPress?.());
};

const STANDUP: GroupEventTarget = {
  event: {
    id: "ge-1",
    groupId: "g-design",
    title: "Standup",
    note: null,
    startDate: "2026-10-05",
    endDate: "2026-10-05",
    startTime: "09:30",
    endTime: "09:45",
    repeat: { freq: "weekly", interval: 1, weekdays: [0, 2], monthlyMode: null, until: null },
  },
  occurrenceDate: "2026-10-14",
};

const OFFSITE: GroupEventTarget = {
  event: {
    ...STANDUP.event,
    id: "ge-2",
    title: "Offsite",
    startDate: "2026-11-02",
    endDate: "2026-11-04",
    startTime: null,
    endTime: null,
    repeat: null,
  },
  occurrenceDate: "2026-11-02",
};

async function renderEditor(state: GroupEventEditorState) {
  const onClose = jest.fn();
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <GroupEventEditor state={state} onClose={onClose} />
      </QueryClientProvider>
    </TranslationProvider>
  );
  return onClose;
}

beforeEach(() => {
  jest.clearAllMocks();
  dropped = 0;
  createStatus = 200;
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/group-events/groups")) return answer(200, GROUPS);
    if (url.includes("/impact")) return answer(200, { droppedOneOffs: dropped });
    if (method === "POST" && createStatus === 402) {
      return answer(402, {
        errors: [
          {
            message: "Payment required",
            context: { reason: "PLAN_LIMIT", code: "GROUP_EVENTS_PLAN_REQUIRED" },
          },
        ],
      });
    }
    return answer(200, WRITTEN);
  });
});

afterEach(() => queryClient.clear());

const createOn = (date: string): GroupEventEditorState => ({ kind: "create", date, groupId: null });

describe("GroupEventEditor", () => {
  it("adds a weekly group event to the first group that may take one", async () => {
    const onClose = await renderEditor(createOn("2026-10-21"));
    await waitFor(() =>
      expect(screen.getByTestId("group-event-editor-group")).toHaveTextContent(/Design/)
    );
    expect(screen.getByTestId("group-event-editor-save")).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId("group-event-editor-title"), "  Retro ");
    await fireEvent.press(screen.getByTestId("group-event-editor-repeat-weekly"));

    expect(screen.getByTestId("group-event-editor-end-date")).toBeDisabled();
    expect(screen.getByTestId("group-event-editor-one-day")).toHaveTextContent(
      "A recurring group event lasts one day"
    );
    expect(screen.getByTestId("group-event-editor-weekday-2")).toBeDisabled();
    expect(screen.getByTestId("group-event-editor-next-dates")).toHaveTextContent(
      /21 October · 28 October · 4 November · 11 November · 18 November · 25 November · …/
    );

    await fireEvent.press(screen.getByTestId("group-event-editor-weekday-4"));
    await fireEvent.press(screen.getByTestId("group-event-editor-interval-up"));
    expect(screen.getByTestId("group-event-editor-interval")).toHaveTextContent("Every 2 weeks");
    await fireEvent.press(screen.getByTestId("group-event-editor-save"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests("POST")).toEqual([
      {
        url: "/api/group-events",
        body: {
          groupId: "g-design",
          title: "Retro",
          note: null,
          startDate: "2026-10-21",
          endDate: "2026-10-21",
          startTime: null,
          endTime: null,
          repeat: { freq: "weekly", interval: 2, weekdays: [2, 4], monthlyMode: null, until: null },
        },
      },
    ]);
  });

  it("turns Repeat off for a run of days", async () => {
    await renderEditor(createOn("2026-10-21"));

    await fireEvent.press(screen.getByTestId("group-event-editor-end-date"));

    expect(screen.getByTestId("group-event-editor-end-date")).toHaveProp("accessibilityValue", {
      text: "2026-10-23",
    });
    expect(screen.getByTestId("group-event-editor-repeat-weekly")).toBeDisabled();
  });

  it("words a plan refusal inside the sheet and stays open", async () => {
    createStatus = 402;
    const onClose = await renderEditor(createOn("2026-10-21"));
    await waitFor(() =>
      expect(screen.getByTestId("group-event-editor-group")).toHaveTextContent(/Design/)
    );

    await fireEvent.changeText(screen.getByTestId("group-event-editor-title"), "Retro");
    await fireEvent.press(screen.getByTestId("group-event-editor-save"));

    expect(
      await screen.findByText("This group isn't on a paid plan, so it can't take new group events.")
    ).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("saves one occurrence of a recurring group event with This event", async () => {
    const onClose = await renderEditor({ kind: "edit", target: STANDUP, groupName: "Design" });
    expect(screen.getByTestId("group-event-editor-start-date")).toHaveProp("accessibilityValue", {
      text: "2026-10-14",
    });

    await fireEvent.changeText(screen.getByTestId("group-event-editor-title"), "Moved standup");
    await fireEvent.press(screen.getByTestId("group-event-editor-save"));

    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Change “Standup”",
        message: "Which dates should the change apply to?",
        options: ["This event", "This and following", "All events", "Cancel"],
        disabledButtonIndices: undefined,
      }),
      expect.any(Function)
    );
    await act(async () => pickScope(0));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests("GET").some(({ url }) => url.includes("/impact"))).toBe(false);
    expect(requests("PATCH")).toEqual([
      {
        url: "/api/group-events/ge-1",
        body: {
          scope: "this",
          occurrenceDate: "2026-10-14",
          changes: {
            title: "Moved standup",
            note: null,
            startDate: "2026-10-14",
            endDate: "2026-10-14",
            startTime: "09:30",
            endTime: "09:45",
          },
        },
      },
    ]);
  });

  it("disables This event for a new rule and warns before dropping one-off changes", async () => {
    dropped = 2;
    const onClose = await renderEditor({ kind: "edit", target: STANDUP, groupName: "Design" });

    await fireEvent.press(screen.getByTestId("group-event-editor-weekday-4"));
    await fireEvent.press(screen.getByTestId("group-event-editor-save"));

    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "A new repeat rule can't apply to one date",
        disabledButtonIndices: [0],
      }),
      expect.any(Function)
    );
    await act(async () => pickScope(1));

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Change “Standup”",
        "2 changes made to single dates will be lost, deleted dates included.",
        expect.any(Array)
      )
    );
    expect(requests("PATCH")).toEqual([]);
    await pressAlert("Save");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests("PATCH")[0].body).toMatchObject({
      scope: "following",
      occurrenceDate: "2026-10-14",
      changes: { repeat: { weekdays: [0, 2, 4] } },
    });
  });

  it("deletes a one-off after a plain confirm", async () => {
    const onClose = await renderEditor({ kind: "edit", target: OFFSITE, groupName: "Design" });

    await fireEvent.press(screen.getByTestId("group-event-editor-delete"));

    expect(alert).toHaveBeenCalledWith(
      "Delete “Offsite”?",
      "It leaves every calendar, .ics feeds and synced Google or Microsoft calendars included. This can't be undone.",
      expect.any(Array)
    );
    await pressAlert("Delete");

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests("DELETE")).toEqual([{ url: "/api/group-events/ge-2", body: undefined }]);
  });

  it("deletes the rest of a recurring group event from the occurrence", async () => {
    const onClose = await renderEditor({ kind: "edit", target: STANDUP, groupName: "Design" });

    await fireEvent.press(screen.getByTestId("group-event-editor-delete"));
    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Delete “Standup”?", destructiveButtonIndex: [0, 1, 2] }),
      expect.any(Function)
    );
    await act(async () => pickScope(1));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(requests("DELETE")[0].url).toBe(
      "/api/group-events/ge-1?scope=following&occurrenceDate=2026-10-14"
    );
  });
});
