import { onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS } from "react-native";
import { toast } from "sonner-native";

import NewRequestRoute from "@/app/requests/new";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { createVacation, pull, useMemberGroups, type CreateOutcome } from "@/lib/local-store";
import { queryClient } from "@/lib/query";
import type { Attachment, GroupDetail, GroupMember, VacationDetail } from "@/lib/query";
import { fakeFiles } from "@/test-support/fake-file-system";
import { vacationDetail } from "@/test-support/vacation-detail";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";

const mockFetch = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockParams = jest.fn((): { date?: string } => ({ date: "2026-10-05" }));
const mockScreenOptions = jest.fn();

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
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams(),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
  Stack: {
    Screen: ({ options }: { options: object }) => {
      mockScreenOptions(options);
      return null;
    },
  },
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: "user-9", name: "Petr Novák", email: "petr@dev.local" }),
}));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  createVacation: jest.fn(),
  useMemberGroups: jest.fn(),
}));
jest.mock("@/lib/haptics", () => ({ haptic: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock(
  "@react-native-community/datetimepicker",
  () => jest.requireActual("@/test-support/date-time-picker").FakeDateTimePicker
);

const mockUpload = fakeFiles.upload;
jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

// A finished upload mutation waits five minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

const create = createVacation as jest.MockedFunction<typeof createVacation>;
const memberGroups = useMemberGroups as jest.MockedFunction<typeof useMemberGroups>;

const ENGINEERING = { groupId: "group-1", groupName: "Engineering" };
const DESIGN = { groupId: "group-2", groupName: "Design" };

const EVA: GroupMember = {
  userId: "user-2",
  controlledUser: true,
  deletedAt: null,
  user: { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(20 60% 50%)" },
};
const SELF: GroupMember = {
  ...EVA,
  userId: "user-9",
  user: { ...EVA.user, id: "user-9", name: "Petr Novák" },
};

const CREATED: CreateOutcome = {
  ok: true,
  created: { requestId: "request-1", vacationId: "vacation-1" },
};

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

let groupDetails: Record<string, GroupDetail>;

let choose: (index: number) => void = () => {};
let sheetOptions: string[] = [];
jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((options, cb) => {
  sheetOptions = options.options;
  choose = cb;
});

beforeEach(() => {
  jest.clearAllMocks();
  // Only the date is fixed: the query layer's timers stay real.
  jest.useFakeTimers({
    now: new Date(2026, 8, 27, 12),
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
    ],
  });
  onlineManager.setOnline(true);
  mockCanGoBack.mockReturnValue(true);
  mockParams.mockReturnValue({ date: "2026-10-05" });
  memberGroups.mockReturnValue([ENGINEERING]);
  create.mockResolvedValue(CREATED);
  groupDetails = {
    "group-1": { id: "group-1", organization: { sickDayBenefitActive: false } },
    "group-2": { id: "group-2", organization: { sickDayBenefitActive: true } },
  };
  mockFetch.mockImplementation(async (url: string) => {
    const path = String(url);
    if (path.includes("/api/group-user/")) return answer(200, [SELF, EVA]);
    const id = path.split("/api/group/")[1];
    return answer(200, groupDetails[id]);
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

async function renderForm(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <NewRequestRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

/** Rendered once the group's detail has answered, the way the form is used. */
async function renderLoaded() {
  await renderForm();
  await waitFor(() =>
    expect(mockFetch.mock.calls.some(([url]) => String(url).endsWith("/api/group/group-1"))).toBe(
      true
    )
  );
  await act(async () => undefined);
}

const submitButton = () => screen.getByTestId("new-request-submit");
const valueOf = (testID: string) => screen.getByTestId(testID).props.accessibilityValue.text;

async function submit() {
  await act(async () => {
    fireEvent.press(submitButton());
  });
}

describe("NewRequest route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderForm("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a form a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderForm();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/new",
      params: { date: "2026-10-05" },
    });
  });

  it("opens on the day it was opened for, in the viewer's first group, as a Vacation", async () => {
    await renderLoaded();

    expect(valueOf("dates-field-from")).toBe("2026-10-05");
    expect(valueOf("dates-field-to")).toBe("2026-10-05");
    expect(screen.getByTestId("new-request-group")).toHaveTextContent(/Engineering/);
    expect(screen.getByTestId("type-field-VACATION").props.accessibilityState.selected).toBe(true);
  });

  it("opens on today without a day, and clamps the pickers to this year through next", async () => {
    mockParams.mockReturnValue({});

    await renderLoaded();

    expect(valueOf("dates-field-from")).toBe("2026-09-27");
    expect(screen.getByTestId("dates-field-from").props.accessibilityHint).toBe(
      "2026-01-01..2027-12-31"
    );
  });

  it("drags To along when From moves past it", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByTestId("dates-field-from"));

    expect(valueOf("dates-field-from")).toBe("2026-10-07");
    expect(valueOf("dates-field-to")).toBe("2026-10-07");
  });

  it("offers half day on a single day only", async () => {
    await renderLoaded();
    expect(screen.getByTestId("half-day-field")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("dates-field-to"));

    expect(screen.queryByTestId("half-day-field")).toBeNull();
  });

  it("holds Submit back for Other until a note is written", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByTestId("type-field-OTHER"));
    expect(screen.getByText(en.requestForm.noteRequired)).toBeOnTheScreen();
    expect(submitButton()).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId("note-field"), "Moving house");
    expect(submitButton()).toBeEnabled();
  });

  it("offers Sick day only in a group whose organization has the benefit", async () => {
    memberGroups.mockReturnValue([ENGINEERING, DESIGN]);
    await renderLoaded();
    expect(screen.queryByTestId("type-field-SICK_DAY")).toBeNull();

    await fireEvent.press(screen.getByTestId("new-request-group"));
    expect(sheetOptions).toEqual(["Engineering", "Design", en.newRequest.cancel]);
    await act(async () => choose(1));

    expect(await screen.findByTestId("type-field-SICK_DAY")).toBeOnTheScreen();
    expect(screen.getByTestId("new-request-group")).toHaveTextContent(/Design/);
  });

  it("books for the viewer, then closes once the server has the request", async () => {
    await renderLoaded();
    await fireEvent(screen.getByTestId("times-field-switch"), "valueChange", true);
    await fireEvent(screen.getByTestId("half-day-field"), "valueChange", true);
    await fireEvent.changeText(screen.getByTestId("note-field"), " Dentist ");

    await submit();

    expect(create).toHaveBeenCalledWith({
      groupId: "group-1",
      from: "2026-10-05",
      to: "2026-10-05",
      vacationType: "VACATION",
      startTime: "09:00",
      endTime: "17:00",
      halfDay: true,
      note: "Dentist",
    });
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a busy Submit while the server decides, and does not close before it answers", async () => {
    let settle: (outcome: CreateOutcome) => void = () => {};
    create.mockImplementation(() => new Promise((resolve) => (settle = resolve)));
    await renderLoaded();

    await submit();

    expect(submitButton().props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => settle(CREATED));
    expect(router.back).toHaveBeenCalled();
  });

  it("offers no member to someone the group does not name its admin", async () => {
    groupDetails["group-1"] = { ...groupDetails["group-1"], access: { canAdmin: false } };

    await renderLoaded();

    expect(screen.queryByTestId("new-request-member")).toBeNull();
    expect(mockFetch.mock.calls.some(([url]) => String(url).includes("/api/group-user/"))).toBe(
      false
    );
  });

  it("books on a member's behalf for an admin, asking the server who the members are", async () => {
    groupDetails["group-1"] = { ...groupDetails["group-1"], access: { canAdmin: true } };
    await renderLoaded();
    // The row opens once the members have answered.
    await waitFor(() => expect(screen.getByTestId("new-request-member")).toBeEnabled());
    expect(screen.getByTestId("new-request-member")).toHaveTextContent(/Myself/);
    expect(screen.queryByTestId("new-request-auto-approve")).toBeNull();

    await fireEvent.press(screen.getByTestId("new-request-member"));
    // The admin is never offered as a member of their own; Myself stands for them.
    expect(sheetOptions).toEqual([en.newRequest.myself, "Eva Horáková", en.newRequest.cancel]);
    await act(async () => choose(1));
    expect(screen.getByTestId("new-request-member")).toHaveTextContent(/Eva Horáková/);
    await fireEvent(screen.getByTestId("new-request-auto-approve"), "valueChange", false);

    await submit();

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "group-1", userId: "user-2", autoApprove: false })
    );
  });

  it("keeps approve-immediately as set when another member is picked, and turns it on for Myself", async () => {
    const JAN: GroupMember = {
      ...EVA,
      userId: "user-3",
      user: { ...EVA.user, id: "user-3", name: "Jan Dvořák" },
    };
    groupDetails["group-1"] = { ...groupDetails["group-1"], access: { canAdmin: true } };
    mockFetch.mockImplementation(async (url: string) =>
      String(url).includes("/api/group-user/")
        ? answer(200, [EVA, JAN])
        : answer(200, groupDetails["group-1"])
    );
    await renderLoaded();
    await waitFor(() => expect(screen.getByTestId("new-request-member")).toBeEnabled());

    await fireEvent.press(screen.getByTestId("new-request-member"));
    await act(async () => choose(1));
    await fireEvent(screen.getByTestId("new-request-auto-approve"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("new-request-member"));
    await act(async () => choose(2));

    expect(screen.getByTestId("new-request-auto-approve").props.value).toBe(false);

    await fireEvent.press(screen.getByTestId("new-request-member"));
    await act(async () => choose(0));
    await fireEvent.press(screen.getByTestId("new-request-member"));
    await act(async () => choose(1));

    expect(screen.getByTestId("new-request-auto-approve").props.value).toBe(true);
  });

  it("keeps the sheet from being swiped away while Submit waits for the server", async () => {
    let settle: (outcome: CreateOutcome) => void = () => {};
    create.mockImplementation(() => new Promise((resolve) => (settle = resolve)));
    await renderLoaded();
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });

    await submit();
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });

    await act(async () => settle(CREATED));
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
  });

  it("keeps the entry and lists the days already booked when the server answers 409", async () => {
    create.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 409,
      message: "One or more days in the requested range are already booked",
      context: { conflictingDays: ["2026-10-05"] },
    });
    await renderLoaded();
    await fireEvent.changeText(screen.getByTestId("note-field"), "Trip");

    await submit();

    expect(screen.getByTestId("new-request-error")).toHaveTextContent(
      en.newRequest.conflict("5 Oct")
    );
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByTestId("note-field").props.value).toBe("Trip");
    expect(pull).toHaveBeenCalledWith("refresh");
    expect(submitButton()).toBeEnabled();
  });

  it("translates a 402 on a read-only group the way the web does", async () => {
    create.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 402,
      message: "Group is read-only",
      context: { reason: "READ_ONLY", limit: 5, current: 7 },
    });
    await renderLoaded();

    await submit();

    expect(screen.getByTestId("new-request-error")).toHaveTextContent(en.newRequest.readOnlyGroup);
  });

  it("lets Submit try again when the server could not be reached", async () => {
    create.mockResolvedValueOnce({ ok: false, reason: "unreachable", message: null });
    await renderLoaded();

    await submit();
    expect(screen.getByTestId("new-request-error")).toHaveTextContent(en.newRequest.unreachable);
    expect(router.back).not.toHaveBeenCalled();

    await submit();
    expect(create).toHaveBeenCalledTimes(2);
    expect(router.back).toHaveBeenCalled();
  });

  it("says it can't reach the server and holds Submit back while the phone is offline", async () => {
    await renderLoaded();

    await act(async () => onlineManager.setOnline(false));

    expect(screen.getByText(en.newRequest.offline)).toBeOnTheScreen();
    expect(submitButton()).toBeDisabled();
  });

  it("leaves Submit to the server when the group's detail answered with a failure of its own", async () => {
    mockFetch.mockImplementation(async (url: string) =>
      String(url).includes("/api/group/")
        ? answer(500, { errors: [{ message: "Failed to load group" }] })
        : answer(200, [])
    );

    await renderForm();
    // A 5xx gets the query layer's one retry before the read settles as failed.
    await waitFor(
      () => expect(queryClient.getQueryState(["group", "group-1"])?.status).toBe("error"),
      { timeout: 5000 }
    );

    expect(screen.queryByTestId("new-request-offline")).toBeNull();
    expect(submitButton()).toBeEnabled();
    await submit();
    expect(create).toHaveBeenCalled();
  });

  it("says it can't reach the server when the group's detail could not be read, with a Retry", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await renderForm();

    expect(
      await screen.findByTestId("new-request-offline", {}, { timeout: 5000 })
    ).toBeOnTheScreen();
    expect(submitButton()).toBeDisabled();

    mockFetch.mockImplementation(async () => answer(200, groupDetails["group-1"]));
    await fireEvent.press(screen.getByTestId("new-request-retry"));

    await waitFor(() => expect(screen.queryByTestId("new-request-offline")).toBeNull());
    expect(submitButton()).toBeEnabled();
  });

  it("says so when the viewer belongs to no group, and holds Submit back", async () => {
    memberGroups.mockReturnValue([]);

    await renderForm();

    expect(screen.getByText(en.newRequest.noGroups)).toBeOnTheScreen();
    expect(submitButton()).toBeDisabled();
  });

  it("closes on Cancel without booking", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByTestId("new-request-cancel"));

    expect(router.back).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("NewRequest attachments", () => {
  let created: VacationDetail;
  /** How the backend's check settles each uploaded file. */
  let verdict: Attachment["status"];

  function photos(...names: string[]) {
    for (const name of names) fakeFiles.put(`file:///tmp/${name}`, 2048);
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: names.map((name) => ({
        uri: `file:///tmp/${name}`,
        fileName: name,
        mimeType: "image/jpeg",
        fileSize: 2048,
      })),
    });
  }

  async function choosePhotos() {
    await fireEvent.press(await screen.findByTestId("attachment-add"));
    await act(async () => choose(sheetOptions.indexOf(en.attachments.choosePhoto)));
  }

  const registrations = () =>
    mockFetch.mock.calls.filter(
      ([url, init]) => init?.method === "POST" && /\/api\/attachments$/.test(String(url))
    );

  beforeEach(() => {
    fakeFiles.reset();
    verdict = "READY";
    created = vacationDetail({ attachments: [], canAttach: true });
    groupDetails["group-1"] = { ...groupDetails["group-1"], uploadsAvailable: true };
    mockUpload.mockImplementation(async () => {
      created = {
        ...created,
        attachments: (created.attachments ?? []).map((row) =>
          row.status === "UPLOADING" ? { ...row, status: verdict } : row
        ),
      };
      return { status: 200, body: "", headers: {} };
    });
    mockFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
      const path = String(url);
      if (init?.method === "POST" && /\/api\/attachments$/.test(path)) {
        const body = JSON.parse(init.body ?? "{}");
        const row: Attachment = {
          id: `attachment-${(created.attachments ?? []).length + 1}`,
          fileName: body.fileName,
          contentType: body.contentType,
          size: body.size,
          status: "UPLOADING",
          rejectionReason: null,
          uploadedByUserId: "user-9",
          createdAt: new Date().toISOString(),
          deletedAt: null,
          deletedByUserId: null,
        };
        created = { ...created, attachments: [...(created.attachments ?? []), row] };
        return answer(201, {
          attachment: row,
          upload: { url: "http://store/put", method: "PUT", headers: {}, expiresAt: "" },
        });
      }
      if (path.endsWith("/api/vacation/vacation-1")) return answer(200, created);
      if (path.includes("/api/group-user/")) return answer(200, [SELF, EVA]);
      return answer(200, groupDetails[path.split("/api/group/")[1]]);
    });
  });

  it("offers no files where the group's plan takes none", async () => {
    groupDetails["group-1"] = { ...groupDetails["group-1"], uploadsAvailable: false };
    await renderLoaded();

    expect(screen.queryByTestId("new-request-attachments")).toBeNull();
  });

  it("queues picked photos until the Request exists, sending nothing before Submit", async () => {
    photos("IMG_1.jpg", "IMG_2.jpg");
    await renderLoaded();

    await choosePhotos();

    expect(await screen.findAllByTestId("attachment-job")).toHaveLength(2);
    expect(screen.getAllByText(/Sends when you submit/)).toHaveLength(2);
    expect(screen.getByTestId("attachments-count")).toHaveTextContent("2 of 5");
    expect(registrations()).toHaveLength(0);
  });

  it("uploads the queued files to the new Request, then closes itself once all are accepted", async () => {
    photos("IMG_1.jpg", "IMG_2.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");

    await submit();

    await waitFor(() => expect(registrations()).toHaveLength(2));
    expect(registrations().map(([, init]) => JSON.parse(init.body).requestId)).toEqual([
      "request-1",
      "request-1",
    ]);
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  });

  it("stays open with the verdict when a file is rejected, until Done closes it", async () => {
    verdict = "REJECTED";
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");

    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("new-request-sent-status")).toHaveTextContent(
        en.newRequest.uploadProblems
      )
    );
    expect(screen.getByText(en.attachments.rejectedPlain)).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("new-request-done"));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("shows progress while the files are still going, and Done closes it early", async () => {
    let land: () => void = () => {};
    mockUpload.mockImplementation(
      () =>
        new Promise((resolve) => {
          land = () => resolve({ status: 200, body: "", headers: {} });
        })
    );
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");

    await submit();

    await waitFor(() =>
      expect(screen.getByTestId("new-request-sent-status")).toHaveTextContent(
        en.newRequest.uploadingFiles
      )
    );
    expect(screen.queryByTestId("new-request-submit")).toBeNull();
    await fireEvent.press(screen.getByTestId("new-request-done"));
    expect(router.back).toHaveBeenCalledTimes(1);
    await act(async () => land());
  });

  it("closes at once after a Submit with no files", async () => {
    await renderLoaded();

    await submit();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("new-request-sent")).toBeNull();
  });

  it("drops the picked files when the group changes", async () => {
    memberGroups.mockReturnValue([ENGINEERING, DESIGN]);
    groupDetails["group-2"] = { ...groupDetails["group-2"], uploadsAvailable: true };
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");

    await fireEvent.press(screen.getByTestId("new-request-group"));
    await act(async () => choose(sheetOptions.indexOf("Design")));

    await waitFor(() => expect(screen.queryByTestId("attachment-job")).toBeNull());
  });

  it("says so and offers Retry when the new Request cannot be read, and Done still closes", async () => {
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");
    const answering = mockFetch.getMockImplementation()!;
    let readable = false;
    mockFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) =>
      String(url).endsWith("/api/vacation/vacation-1") && !readable
        ? answer(503, { errors: [{ message: "Down for a moment" }] })
        : answering(url, init)
    );

    await submit();

    expect(
      await screen.findByTestId("new-request-sent-failed", {}, { timeout: 5000 })
    ).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    readable = true;
    await fireEvent.press(screen.getByTestId("new-request-sent-retry"));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  }, 15000);

  it("keeps Done working while the new Request cannot be read", async () => {
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");
    const answering = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) =>
      String(url).endsWith("/api/vacation/vacation-1")
        ? answer(503, { errors: [{ message: "Down for a moment" }] })
        : answering(url, init)
    );

    await submit();
    await screen.findByTestId("new-request-sent-failed", {}, { timeout: 5000 });
    await fireEvent.press(screen.getByTestId("new-request-done"));

    expect(router.back).toHaveBeenCalledTimes(1);
  }, 15000);

  it("does not close under the finger when the last failed file is dismissed", async () => {
    photos("IMG_1.jpg", "IMG_2.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");
    const answering = mockFetch.getMockImplementation()!;
    let registered = 0;
    mockFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST" && /\/api\/attachments$/.test(String(url))) {
        registered += 1;
        if (registered === 1) {
          return answer(422, {
            errors: [{ message: "No", context: { reason: "FILE_TOO_LARGE" } }],
          });
        }
      }
      return answering(url, init);
    });

    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("new-request-sent-status")).toHaveTextContent(
        en.newRequest.uploadProblems
      )
    );
    await fireEvent.press(screen.getByLabelText(en.attachments.dismiss("IMG_1.jpg")));

    await waitFor(() =>
      expect(screen.getByTestId("new-request-sent-status")).toHaveTextContent(
        en.newRequest.uploadsAccepted
      )
    );
    expect(router.back).not.toHaveBeenCalled();
  });

  it("closes and says the files were not sent when the booking answers without its Request", async () => {
    create.mockResolvedValue({ ok: true });
    photos("IMG_1.jpg");
    await renderLoaded();
    await choosePhotos();
    await screen.findAllByTestId("attachment-job");

    await submit();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith(en.newRequest.filesNotSent);
    expect(registrations()).toHaveLength(0);
  });
});
