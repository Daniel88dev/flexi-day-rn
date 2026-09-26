import { fireEvent, render, screen } from "@testing-library/react-native";

import { RequestCard } from "@/components/requests/request-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { RequestRun } from "@/lib/requests/runs";

const VIEWER = "viewer";

const RUN: RequestRun = {
  id: "vacation-1",
  userId: "user-2",
  userName: "Eva Horáková",
  groupId: "group-1",
  groupName: "Engineering",
  vacationType: "VACATION",
  status: "approved",
  from: "2026-09-21",
  to: "2026-09-23",
  startTime: null,
  endTime: null,
  halfDay: false,
  vacationIds: ["vacation-1", "vacation-2", "vacation-3"],
  dayCount: 3,
  pending: false,
};

async function renderCard(run: RequestRun, onPress = jest.fn()) {
  await render(
    <TranslationProvider>
      <RequestCard run={run} viewerId={VIEWER} onPress={onPress} />
    </TranslationProvider>
  );
  return onPress;
}

describe("RequestCard", () => {
  it("renders the run's dates, person, group, type, length and status", async () => {
    await renderCard(RUN);

    expect(screen.getByText("21-23 Sep")).toBeTruthy();
    expect(screen.getByText("Eva Horáková · Engineering")).toBeTruthy();
    expect(screen.getByText(en.recordTypes.VACATION)).toBeTruthy();
    expect(screen.getByText("3 days · Full day")).toBeTruthy();
    expect(screen.getByText(en.status.approved)).toBeTruthy();
  });

  it("renders You for the viewer's own run", async () => {
    await renderCard({ ...RUN, userId: VIEWER });

    expect(screen.getByText("You · Engineering")).toBeTruthy();
  });

  it("opens the run when tapped", async () => {
    const onPress = await renderCard(RUN);

    await fireEvent.press(screen.getByTestId("request-run-vacation-1"));

    expect(onPress).toHaveBeenCalledWith(RUN);
  });

  it("renders Sending… and ignores a tap while a pending change holds the run", async () => {
    const onPress = await renderCard({ ...RUN, pending: true });

    await fireEvent.press(screen.getByTestId("request-run-vacation-1"));

    expect(screen.getByText(en.requests.sending)).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders a faded card while a pending change holds the run", async () => {
    await renderCard({ ...RUN, pending: true });

    expect(screen.getByTestId("request-run-vacation-1")).toHaveStyle({ opacity: 0.55 });
  });
});
