import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert, type AlertButton } from "react-native";
import { toast } from "sonner-native";

import RequestDetailRoute from "@/app/requests/[vacationId]";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import {
  approveVacations,
  cancelVacations,
  pull,
  rejectVacations,
  updateVacation,
  useStoredRequest,
  useStoreOpen,
} from "@/lib/local-store";
import { installTestStore } from "@/lib/local-store/test-support/test-store";
import { queryClient } from "@/lib/query";
import type { VacationDetail } from "@/lib/query/vacation-detail";
import type { RootRoute } from "@/lib/session/root-route";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { vacationDetail } from "@/test-support/vacation-detail";
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
  useIsFocused: () => true,
  useLocalSearchParams: () => ({ vacationId: "vacation-1" }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
let mockViewerId = "user-9";
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: mockViewerId, name: "Viewer", email: "viewer@dev.local" }),
}));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  approveVacations: jest.fn(),
  rejectVacations: jest.fn(),
  cancelVacations: jest.fn(),
  updateVacation: jest.fn(),
  useStoredRequest: jest.fn(),
  useStoreOpen: jest.fn(),
  vacationStatusOf: jest.requireActual("@/lib/local-store/queries").vacationStatusOf,
}));
jest.mock("@/lib/haptics", () => ({ haptic: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => {
  const { createElement } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: object) => createElement(View, { ...props, testID: "keyboard-avoiding-view" }),
  };
});

const approve = approveVacations as jest.MockedFunction<typeof approveVacations>;
const reject = rejectVacations as jest.MockedFunction<typeof rejectVacations>;
const cancel = cancelVacations as jest.MockedFunction<typeof cancelVacations>;
const update = updateVacation as jest.MockedFunction<typeof updateVacation>;
const storedRequest = useStoredRequest as jest.MockedFunction<typeof useStoredRequest>;
const storeOpen = useStoreOpen as jest.MockedFunction<typeof useStoreOpen>;

const ADMIN = { id: "user-9", name: "Petr Novák", initials: "PN", avatarColor: "hsl(0 0% 50%)" };

// A finished mutation waits five minutes to be collected, and that timer keeps Jest running.
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

/** A backend answering the detail with `detail`, which a test may change between reads. */
let detail: VacationDetail;

function detailReads() {
  return mockFetch.mock.calls.filter(
    ([url, init]) => /\/api\/vacation\/vacation-1$/.test(String(url)) && !init?.method
  );
}

let prompt: { buttons: AlertButton[] } | null = null;
jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, buttons) => {
  prompt = { buttons: buttons as AlertButton[] };
});

async function openOptionsAndPick(key: "edit" | "cancel") {
  await fireEvent.press(screen.getByTestId("request-detail-options"));
  await fireEvent.press(screen.getByTestId(`request-detail-menu-${key}`));
}

async function answerPrompt(label: string, text?: string) {
  const button = prompt?.buttons.find((candidate) => candidate.text === label);
  await act(async () => (button?.onPress as (value?: string) => void)(text));
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(() => {
  jest.clearAllMocks();
  prompt = null;
  mockViewerId = "user-9";
  mockCanGoBack.mockReturnValue(true);
  detail = vacationDetail();
  storedRequest.mockReturnValue(null);
  storeOpen.mockReturnValue(true);
  mockFetch.mockImplementation(async (url: string) =>
    String(url).includes("/api/group/")
      ? answer(200, { id: "group-1", organization: { sickDayBenefitActive: false } })
      : answer(200, detail)
  );
});

afterEach(() => queryClient.clear());

async function renderDetail(route: RootRoute = "signed-in") {
  await render(
    <RootRouteProvider route={route}>
      <TranslationProvider>
        <RequestDetailRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
}

async function renderLoaded(patch: Partial<VacationDetail> = {}) {
  detail = vacationDetail(patch);
  await renderDetail();
  await screen.findByTestId("request-detail");
}

describe("RequestDetail route", () => {
  it("sends a signed-out visitor to welcome", async () => {
    await renderDetail("welcome");

    expect(screen.getByText("/welcome")).toBeOnTheScreen();
  });

  it("puts the shell under a detail a cold deep link opened on its own", async () => {
    mockCanGoBack.mockReturnValue(false);

    await renderDetail();

    expect(router.replace).toHaveBeenCalledWith("/dashboard");
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/requests/[vacationId]",
      params: { vacationId: "vacation-1" },
    });
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  describe("while the local store is not open yet", () => {
    const realStoreOpen = jest.requireActual("@/lib/local-store/use-store-open").useStoreOpen;
    const realStoredRequest = jest.requireActual(
      "@/lib/local-store/use-request-list"
    ).useStoredRequest;
    let store: ReturnType<typeof installTestStore>;

    beforeEach(() => {
      store = installTestStore();
      storeOpen.mockImplementation(realStoreOpen);
      storedRequest.mockImplementation(realStoredRequest);
    });

    afterEach(() => act(() => store.lifecycle.closeStore()));

    it("renders nothing and moves nothing over the shell, then shows the detail once the store opens", async () => {
      await renderDetail();

      expect(screen.toJSON()).toBeNull();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();

      await act(() => store.lifecycle.openStore("user-9"));

      expect(await screen.findByTestId("request-detail")).toBeOnTheScreen();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("still puts the shell under a cold deep link, exactly once", async () => {
      mockCanGoBack.mockReturnValue(false);

      await renderDetail();

      expect(screen.toJSON()).toBeNull();
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledTimes(1);
    });
  });

  it("renders what the web dialog shows: badges, length, person, group, note, files and history", async () => {
    await renderLoaded({
      rangeEnd: "2026-09-23",
      vacationIds: ["vacation-1", "vacation-2", "vacation-3"],
      startTime: "08:00:00",
      endTime: "12:00:00",
      note: "Family trip",
      createdByUser: ADMIN,
      attachments: [
        {
          id: "file-1",
          fileName: "tickets.pdf",
          contentType: "application/pdf",
          size: 2048,
          status: "READY",
          rejectionReason: null,
          uploadedByUserId: "user-2",
          createdAt: "2026-09-10T09:00:00.000Z",
          deletedAt: null,
          deletedByUserId: null,
        },
      ],
    });

    expect(screen.getByText(en.recordTypes.VACATION)).toBeOnTheScreen();
    expect(screen.getByText(en.status.pending)).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-dates")).toHaveTextContent("21-23 Sep 2026");
    expect(screen.getByText("3 days · 08:00-12:00")).toBeOnTheScreen();
    expect(screen.getByText("Eva Horáková")).toBeOnTheScreen();
    expect(screen.getByText("Engineering")).toBeOnTheScreen();
    expect(screen.getByText(en.requestDetail.createdBy(ADMIN.name))).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-note")).toHaveTextContent("Family trip");
    expect(screen.getByTestId("request-attachments")).toHaveTextContent(/tickets\.pdf/);
    expect(screen.getByTestId("request-timeline")).toHaveTextContent(/Requested by Eva Horáková/);
    expect(screen.getByTestId("request-timeline")).toHaveTextContent(/File attached/);
  });

  it("renders a cancelled request with who cancelled it and no actions", async () => {
    await renderLoaded({
      deletedAt: "2026-09-12T08:00:00.000Z",
      deletedByUser: ADMIN,
      history: [
        ...vacationDetail().history,
        {
          id: "event-2",
          eventType: "CANCELLED",
          actor: ADMIN,
          reason: "Plans changed",
          createdAt: "2026-09-12T08:00:00.000Z",
        },
      ],
    });

    // The status badge, and the timeline's own event.
    expect(screen.getAllByText(en.status.cancelled)).toHaveLength(2);
    expect(screen.getByTestId("request-detail-person")).toHaveTextContent(
      new RegExp(en.requestDetail.cancelledBy(ADMIN.name))
    );
    expect(screen.getByTestId("request-timeline")).toHaveTextContent(/“Plans changed”/);
    expect(screen.queryByTestId("request-detail-actions")).toBeNull();
    expect(screen.queryByTestId("request-detail-options")).toBeNull();
  });

  it("renders a deleted request as gone rather than failing", async () => {
    mockFetch.mockResolvedValue(answer(404, { errors: [{ message: "Vacation not found" }] }));

    await renderDetail();

    expect(await screen.findByText(en.requestDetail.notFound)).toBeOnTheScreen();
  });

  it("renders a request the viewer may no longer see as such", async () => {
    mockFetch.mockResolvedValue(answer(403, { errors: [{ message: "Not allowed" }] }));

    await renderDetail();

    expect(await screen.findByText(en.requestDetail.forbidden)).toBeOnTheScreen();
  });

  it("renders the phone's own copy, read-only, when the server cannot be reached", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    storedRequest.mockReturnValue({
      id: "vacation-1",
      userId: "user-2",
      userName: "Eva Horáková",
      groupId: "group-1",
      groupName: "Engineering",
      vacationType: "SICK",
      status: "approved",
      from: "2026-09-21",
      to: "2026-09-22",
      startTime: null,
      endTime: null,
      halfDay: false,
      vacationIds: ["vacation-1", "vacation-2"],
      dayCount: 2,
      pending: false,
      note: null,
    });

    await renderDetail();

    expect(
      await screen.findByText(en.requestDetail.offlineBody, {}, { timeout: 5000 })
    ).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-dates")).toHaveTextContent("21-22 Sep 2026");
    expect(screen.getByText(en.recordTypes.SICK)).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-actions")).toBeNull();
  });

  it("renders a request the server will not show, with its message and no Retry", async () => {
    mockFetch.mockResolvedValue(answer(400, { errors: [{ message: "Invalid vacation id" }] }));

    await renderDetail();

    expect(await screen.findByText(en.requestDetail.failed)).toBeOnTheScreen();
    expect(screen.getByText("Invalid vacation id")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-retry")).toBeNull();
  });

  it("keeps a detail already shown, read-only, when reading it again fails", async () => {
    await renderLoaded({ canApprove: true, canCancel: true, canEdit: true, note: "Family trip" });
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["vacation"] });
    });

    expect(
      await screen.findByText(en.requestDetail.staleBody, {}, { timeout: 5000 })
    ).toBeOnTheScreen();
    expect(screen.getByTestId("request-detail-note")).toHaveTextContent("Family trip");
    expect(screen.getByTestId("request-detail-retry")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-actions")).toBeNull();
    expect(screen.queryByTestId("request-detail-options")).toBeNull();
    expect(screen.queryByTestId("request-comment-input")).toBeNull();
  });

  it("offers no action the detail does not grant", async () => {
    await renderLoaded();

    expect(screen.queryByTestId("request-approve")).toBeNull();
    expect(screen.queryByTestId("request-decline")).toBeNull();
    expect(screen.queryByTestId("request-detail-options")).toBeNull();
  });

  it("offers each action the detail grants", async () => {
    await renderLoaded({ canApprove: true, canCancel: true, canEdit: true });

    expect(screen.getByTestId("request-approve")).toBeOnTheScreen();
    expect(screen.getByTestId("request-decline")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("request-detail-options"));

    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByTestId("request-detail-menu-edit")).toHaveTextContent(en.requestDetail.edit);
    expect(screen.getByTestId("request-detail-menu-cancel")).toHaveTextContent(
      en.requestDetail.cancelRequest
    );
  });

  it("keeps editing and cancelling off the screen, behind the options menu", async () => {
    await renderLoaded({ canCancel: true, canEdit: true });

    expect(screen.queryByTestId("request-detail-actions")).toBeNull();
    expect(screen.queryByText(en.requestDetail.edit)).toBeNull();
    expect(screen.queryByText(en.requestDetail.cancelRequest)).toBeNull();
  });

  it("offers only what the detail grants in the options menu", async () => {
    await renderLoaded({ canEdit: true });

    await fireEvent.press(screen.getByTestId("request-detail-options"));

    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByTestId("request-detail-menu-edit")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-detail-menu-cancel")).toBeNull();
  });

  it("approves every day of the run at once, without asking, and reads the detail again", async () => {
    approve.mockResolvedValue({ ok: true });
    await renderLoaded({ canApprove: true, vacationIds: ["vacation-1", "vacation-2"] });

    await act(async () => fireEvent.press(screen.getByTestId("request-approve")));

    expect(Alert.prompt).not.toHaveBeenCalled();
    expect(approve).toHaveBeenCalledWith(["vacation-1", "vacation-2"]);
    await waitFor(() => expect(detailReads()).toHaveLength(2));
  });

  it("declines with the reason given in the confirmation", async () => {
    reject.mockResolvedValue({ ok: true });
    await renderLoaded({ canApprove: true });

    await fireEvent.press(screen.getByTestId("request-decline"));
    await answerPrompt(en.requestDetail.decline, "  Too many away that week ");

    expect(reject).toHaveBeenCalledWith(["vacation-1"], "Too many away that week");
  });

  it("cancels with no reason when none was given, and not at all when backed out of either step", async () => {
    cancel.mockResolvedValue({ ok: true });
    await renderLoaded({ canCancel: true });

    await fireEvent.press(screen.getByTestId("request-detail-options"));
    await fireEvent.press(screen.getByTestId("request-detail-menu-backdrop"));
    expect(Alert.prompt).not.toHaveBeenCalled();

    await openOptionsAndPick("cancel");
    await answerPrompt(en.requestDetail.notNow);
    expect(cancel).not.toHaveBeenCalled();

    await openOptionsAndPick("cancel");
    await answerPrompt(en.requestDetail.cancelRequest, "");
    expect(cancel).toHaveBeenCalledWith(["vacation-1"], undefined);
  });

  it("toasts the server's message and reads the detail again when a decision is refused", async () => {
    approve.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 409,
      message: "Vacation already approved",
    });
    await renderLoaded({ canApprove: true });
    detail = vacationDetail({ approvedAt: "2026-09-12T08:00:00.000Z" });

    await act(async () => fireEvent.press(screen.getByTestId("request-approve")));

    expect(toast.error).toHaveBeenCalledWith("Vacation already approved");
    expect(pull).toHaveBeenCalledWith("refresh");
    expect(await screen.findByText(en.status.approved)).toBeOnTheScreen();
    expect(screen.queryByTestId("request-approve")).toBeNull();
  });

  it("posts a comment and shows it once the detail is read again", async () => {
    await renderLoaded();
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        detail = vacationDetail({
          history: [
            ...vacationDetail().history,
            {
              id: "event-2",
              eventType: "COMMENT",
              actor: ADMIN,
              reason: "Enjoy the trip",
              createdAt: "2026-09-12T08:00:00.000Z",
            },
          ],
        });
        return answer(200, { message: "Comment added" });
      }
      return answer(200, detail);
    });

    await fireEvent.changeText(screen.getByTestId("request-comment-input"), "Enjoy the trip");
    await act(async () => fireEvent.press(screen.getByTestId("request-comment-send")));

    const post = mockFetch.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(post?.[0])).toMatch(/\/api\/vacation\/comment\/vacation-1$/);
    await waitFor(() =>
      expect(screen.getByTestId("request-timeline")).toHaveTextContent(/“Enjoy the trip”/)
    );
    expect(screen.getByTestId("request-comment-input")).toHaveProp("value", "");
  });

  it("edits the note through the store and closes the sheet once the server takes it", async () => {
    update.mockResolvedValue({ ok: true });
    await renderLoaded({ canEdit: true, vacationIds: ["vacation-1"] });

    await openOptionsAndPick("edit");
    expect(screen.getByTestId("edit-request-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("note-field"), "Doctor at nine");
    await act(async () => fireEvent.press(screen.getByTestId("edit-request-save")));

    expect(update).toHaveBeenCalledWith({ ids: ["vacation-1"], note: "Doctor at nine" });
    await waitFor(() => expect(screen.queryByTestId("edit-request")).toBeNull());
  });

  it("lets the edit sheet's own scroll view keep the note above the keyboard", async () => {
    await renderLoaded({ canEdit: true });

    await openOptionsAndPick("edit");

    expect(
      within(screen.getByTestId("edit-request")).queryByTestId("keyboard-avoiding-view")
    ).toBeNull();
    const scroll = screen.getByTestId("edit-request-scroll");
    expect(scroll).toHaveProp("automaticallyAdjustKeyboardInsets", true);
    expect(scroll).toHaveProp("keyboardDismissMode", "interactive");
    expect(scroll).toHaveProp("keyboardShouldPersistTaps", "handled");
  });

  it("keeps the edit open with what was typed when the server refuses it", async () => {
    update.mockResolvedValue({
      ok: false,
      reason: "rejected",
      status: 422,
      message: "Note is required for Other",
    });
    await renderLoaded({ canEdit: true });

    await openOptionsAndPick("edit");
    await fireEvent.changeText(screen.getByTestId("note-field"), "Doctor at nine");
    await act(async () => fireEvent.press(screen.getByTestId("edit-request-save")));

    expect(toast.error).toHaveBeenCalledWith("Note is required for Other");
    expect(screen.getByTestId("note-field")).toHaveProp("value", "Doctor at nine");
  });

  it("keeps what was typed when a refused edit reads the detail again", async () => {
    update.mockImplementation(async () => {
      detail = vacationDetail({ canEdit: true, updatedAt: "2026-09-12T08:00:00.000Z" });
      return { ok: false, reason: "rejected", status: 409, message: "The request changed" };
    });
    await renderLoaded({ canEdit: true });

    await openOptionsAndPick("edit");
    await fireEvent.changeText(screen.getByTestId("note-field"), "Doctor at nine");
    await act(async () => fireEvent.press(screen.getByTestId("edit-request-save")));

    expect(toast.error).toHaveBeenCalledWith("The request changed");
    await waitFor(() => expect(detailReads()).toHaveLength(2));
    expect(screen.getByTestId("note-field")).toHaveProp("value", "Doctor at nine");
  });

  it("goes back to where it was opened from", async () => {
    await renderLoaded();

    await fireEvent.press(screen.getByTestId("request-detail-back"));

    expect(router.back).toHaveBeenCalled();
  });
});
