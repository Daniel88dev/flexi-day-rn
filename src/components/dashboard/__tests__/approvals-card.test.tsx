import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { ApprovalsCard } from "@/components/dashboard/approvals-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useApprovalDecisions, useMyApprovals, type PendingApproval } from "@/lib/query";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  ImpactFeedbackStyle: { Medium: "medium" },
}));
jest.mock("@/lib/query", () => ({ useMyApprovals: jest.fn(), useApprovalDecisions: jest.fn() }));

const approvals = useMyApprovals as jest.Mock;
const decisions = useApprovalDecisions as jest.Mock;
const approve = jest.fn();
const decline = jest.fn();

let prompt: AlertButton[] = [];
jest.spyOn(Alert, "prompt").mockImplementation((_title, _message, buttons) => {
  prompt = buttons as AlertButton[];
});

const YEAR = new Date().getFullYear();

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

function renderCard(onOpen = jest.fn()) {
  return render(
    <TranslationProvider>
      <ApprovalsCard onOpen={onOpen} />
    </TranslationProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  prompt = [];
  approve.mockResolvedValue(true);
  decline.mockResolvedValue(true);
  decisions.mockReturnValue({ deciding: null, approve, decline });
  read({ data: [ITEM] });
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
    await renderCard(onOpen);

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
