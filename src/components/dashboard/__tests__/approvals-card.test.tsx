import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { ApprovalsCard } from "@/components/dashboard/approvals-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { applyPage } from "@/lib/local-store/apply";
import type { SyncEnvelope } from "@/lib/local-store/envelope";
import { activePendingChanges } from "@/lib/local-store/pending";
import type { StoreRuntime } from "@/lib/local-store/runtime";
import {
  groupRow,
  groupUserRow,
  syncPage,
  vacationRow,
} from "@/lib/local-store/test-support/sync-fixtures";
import { openTestStore } from "@/lib/local-store/test-support/test-store";
import { useApprovalDecisions, useMyApprovals, type PendingApproval } from "@/lib/query";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Medium: "medium" },
}));
jest.mock("@/lib/query", () => ({ useMyApprovals: jest.fn(), useApprovalDecisions: jest.fn() }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));

const approvals = useMyApprovals as jest.Mock;
const decisions = useApprovalDecisions as jest.Mock;
const approve = jest.fn();
const decline = jest.fn();

let prompt: AlertButton[] = [];
jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, buttons) => {
  prompt = buttons as AlertButton[];
});

const YEAR = 2026;
const VIEWER = "user-1";

const ITEM: PendingApproval = {
  vacationIds: ["vacation-1", "vacation-2"],
  user: { id: "user-2", name: "Eva Horáková", initials: "EH", avatarColor: "hsl(20 60% 50%)" },
  groupId: "group-1",
  groupName: "Engineering",
  vacationType: "VACATION",
  from: `${YEAR}-10-05`,
  to: `${YEAR}-10-06`,
  businessDays: 2,
  note: null,
  submittedAt: `${YEAR}-09-20T08:00:00.000Z`,
};

type Read = { data?: PendingApproval[]; isError?: boolean; isPending?: boolean };

function read({ data, isError = false, isPending = false }: Read) {
  approvals.mockReturnValue({ data, isError, isPending, isFetching: false, refetch: jest.fn() });
}

function renderCard({ onOpen = jest.fn(), approver = true } = {}) {
  return render(
    <TranslationProvider>
      <ApprovalsCard approver={approver} onOpen={onOpen} />
    </TranslationProvider>
  );
}

let store: StoreRuntime;

async function pullIn(page: Partial<SyncEnvelope>) {
  await act(async () => {
    store.write((transaction) => applyPage(transaction, syncPage(page), 1));
  });
}

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(async () => {
  jest.useFakeTimers({
    now: new Date(YEAR, 9, 1, 10),
    doNotFake: ["setImmediate", "nextTick", "queueMicrotask"],
  });
  store = await openTestStore(VIEWER);
  await pullIn({
    groups: [groupRow({ id: "group-1", groupName: "Engineering", managerUserId: "boss" })],
    groupUsers: [groupUserRow({ groupId: "group-1", userId: VIEWER })],
  });
  jest.clearAllMocks();
  prompt = [];
  approve.mockResolvedValue(true);
  decline.mockResolvedValue(true);
  decisions.mockReturnValue({ deciding: null, approve, decline });
  read({ data: [ITEM] });
});

afterEach(async () => {
  await store.lifecycle.closeStore();
  jest.useRealTimers();
});

describe("ApprovalsCard", () => {
  it("renders each waiting request with who, what and how long, and a count to review", async () => {
    await renderCard();

    expect(screen.getByText("Eva Horáková")).toBeTruthy();
    expect(screen.getByText("Vacation · 5-6 Oct · 2 days")).toBeTruthy();
    expect(screen.getByText(en.dashboard.approvals.toReview(1))).toBeTruthy();
  });

  it("renders the year of a request outside this year", async () => {
    read({ data: [{ ...ITEM, from: `${YEAR + 1}-01-04`, to: `${YEAR + 1}-01-04` }] });

    await renderCard();

    expect(screen.getByText(`Vacation · 4 Jan ${YEAR + 1} · 2 days`)).toBeTruthy();
  });

  it("renders all caught up when nothing is waiting", async () => {
    read({ data: [] });

    await renderCard();

    expect(screen.getByText(en.dashboard.approvals.allCaughtUp)).toBeTruthy();
    expect(screen.queryByText(en.dashboard.approvals.toReview(0))).toBeNull();
  });

  it("renders a Retry and no buttons when the list can't be read", async () => {
    read({ data: [ITEM], isError: true });

    await renderCard();

    expect(screen.getByText(en.dashboard.approvals.unreachable)).toBeTruthy();
    expect(screen.getByTestId("approvals-retry")).toBeTruthy();
    expect(screen.queryByTestId("approval-vacation-1-approve")).toBeNull();
  });

  it("approves every day of the item", async () => {
    await renderCard();

    await act(async () => {
      fireEvent.press(screen.getByTestId("approval-vacation-1-approve"));
    });

    expect(approve).toHaveBeenCalledWith(ITEM);
  });

  it("declines with the reason typed into the prompt", async () => {
    await renderCard();

    await fireEvent.press(screen.getByTestId("approval-vacation-1-decline"));
    await act(async () => {
      prompt
        .find((button) => button.text === en.dashboard.approvals.decline)
        ?.onPress?.(" Release week " as never);
    });

    expect(decline).toHaveBeenCalledWith(ITEM, "Release week");
  });

  it("declines nothing when the prompt is dismissed", async () => {
    await renderCard();

    await fireEvent.press(screen.getByTestId("approval-vacation-1-decline"));
    await prompt.find((button) => button.style === "cancel")?.onPress?.();

    expect(decline).not.toHaveBeenCalled();
  });

  it("opens the request's detail from the item", async () => {
    const onOpen = jest.fn();
    await renderCard({ onOpen });

    await fireEvent.press(screen.getByTestId("approval-vacation-1-open"));

    expect(onOpen).toHaveBeenCalledWith("vacation-1");
  });

  it("disables every button while a decision is in flight", async () => {
    decisions.mockReturnValue({
      deciding: { id: "vacation-9", decision: "approve" },
      approve,
      decline,
    });

    await renderCard();

    expect(screen.getByTestId("approval-vacation-1-approve")).toBeDisabled();
    expect(screen.getByTestId("approval-vacation-1-decline")).toBeDisabled();
  });

  it("renders the spinner on the button whose write is in flight, as a toast's Retry sets it", async () => {
    decisions.mockReturnValue({
      deciding: { id: "vacation-1", decision: "decline" },
      approve,
      decline,
    });

    await renderCard();

    expect(screen.getByTestId("approval-vacation-1-decline")).toBeBusy();
    expect(screen.getByTestId("approval-vacation-1-approve")).not.toBeBusy();
  });

  it("keys an item without days by its person and first day", async () => {
    read({ data: [{ ...ITEM, vacationIds: [] }] });

    await renderCard();

    expect(screen.getByTestId(`approval-user-2-${YEAR}-10-05-approve`)).toBeDisabled();
  });
});

describe("ApprovalsCard, Your requests", () => {
  const own = (id: string, requestedDay: string, requestId = "request-1") =>
    vacationRow({ id, userId: VIEWER, groupId: "group-1", requestedDay, requestId });

  it("renders only Your requests to a viewer who approves nowhere, read-only, opening on tap", async () => {
    await pullIn({
      vacations: [own("fri", `${YEAR}-10-09`, "first"), own("mon", `${YEAR}-10-12`, "second")],
    });
    const onOpen = jest.fn();

    await renderCard({ onOpen, approver: false });

    expect(screen.queryByText(en.dashboard.approvals.waitingOnYou)).toBeNull();
    expect(screen.queryByText("Eva Horáková")).toBeNull();
    expect(screen.queryByText(en.dashboard.approvals.toReview(1))).toBeNull();
    expect(screen.getByText(en.dashboard.approvals.yourRequests)).toBeTruthy();
    expect(screen.getByTestId("awaiting-request-fri")).toHaveTextContent(
      "Vacation9 Oct · 1 dayWaiting on approval in Engineering"
    );
    expect(screen.getByTestId("awaiting-request-mon")).toBeTruthy();
    expect(screen.queryByText(en.dashboard.approvals.approve)).toBeNull();
    expect(screen.queryByText(en.dashboard.approvals.decline)).toBeNull();

    await fireEvent.press(screen.getByTestId("awaiting-request-fri"));

    expect(onOpen).toHaveBeenCalledWith("fri");
  });

  it("renders one row per Request, counting its stored days rather than the span", async () => {
    await pullIn({
      vacations: [
        own("first", `${YEAR}-10-06`),
        own("second", `${YEAR}-10-09`),
        own("third", `${YEAR}-10-14`),
      ],
    });

    await renderCard({ approver: false });

    expect(screen.getByTestId("awaiting-request-first")).toHaveTextContent(
      "Vacation6-14 Oct · 3 daysWaiting on approval in Engineering"
    );
    expect(screen.queryByTestId("awaiting-request-second")).toBeNull();
  });

  it("renders a nothing-pending state when none of the viewer's requests is waiting", async () => {
    await pullIn({
      vacations: [vacationRow({ id: "approved", userId: VIEWER, approvedAt: `${YEAR}-09-30` })],
    });

    await renderCard({ approver: false });

    expect(screen.getByText(en.dashboard.approvals.noPendingRequests)).toBeTruthy();
    expect(screen.queryByText(en.dashboard.approvals.allCaughtUp)).toBeNull();
  });

  it("renders an approver's own request they may decide only under Waiting on you", async () => {
    await pullIn({
      groupUsers: [groupUserRow({ groupId: "group-1", userId: VIEWER, approverAccess: true })],
      vacations: [own("vacation-1", `${YEAR}-10-05`), own("vacation-2", `${YEAR}-10-06`)],
    });
    read({ data: [{ ...ITEM, user: { ...ITEM.user, id: VIEWER, name: "Dana Holt" } }] });

    await renderCard();

    expect(screen.getByText(en.dashboard.approvals.waitingOnYou)).toBeTruthy();
    expect(screen.getByTestId("approval-vacation-1-approve")).toBeTruthy();
    expect(screen.queryByTestId("awaiting-request-vacation-1")).toBeNull();
    expect(screen.getByText(en.dashboard.approvals.noPendingRequests)).toBeTruthy();
  });

  it("renders an approver's own request in a group where they cannot decide it under Your requests", async () => {
    await pullIn({ vacations: [own("mine", `${YEAR}-10-05`)] });
    read({ data: [] });

    await renderCard();

    expect(screen.getByText(en.dashboard.approvals.allCaughtUp)).toBeTruthy();
    expect(screen.getByTestId("awaiting-request-mine")).toBeTruthy();
  });

  it("renders a booking still in flight at once, waiting and not yet openable", async () => {
    const onOpen = jest.fn();
    await renderCard({ onOpen, approver: false });
    expect(screen.getByText(en.dashboard.approvals.noPendingRequests)).toBeTruthy();

    await act(async () => {
      activePendingChanges().add({
        kind: "create",
        draft: { groupId: "group-1", from: `${YEAR}-10-12`, to: `${YEAR}-10-13` },
      });
    });

    const row = screen.getByTestId(/^awaiting-request-/);
    expect(row).toHaveTextContent(
      `Vacation12-13 Oct · 2 days${en.requests.sending}Waiting on approval in Engineering`
    );
    expect(row).toBeDisabled();
    await fireEvent.press(row);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
