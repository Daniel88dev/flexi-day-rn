import { fireEvent, render, screen } from "@testing-library/react-native";

import { StatStrip } from "@/components/dashboard/stat-strip";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { statTiles } from "@/lib/dashboard/stats";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const READY = {
  state: "ready",
  summary: {
    pendingApprovalsCount: 2,
    outTodayCount: 3,
    workingTodayCount: 5,
    upcomingNext14DaysCount: 4,
    teamSize: 8,
  },
} as const;

function renderStrip(tiles = statTiles(READY, { approver: true }), onViewRequests = jest.fn()) {
  return render(
    <TranslationProvider>
      <StatStrip tiles={tiles} onViewRequests={onViewRequests} />
    </TranslationProvider>
  );
}

describe("StatStrip", () => {
  it("renders a tile per count", async () => {
    await renderStrip();

    expect(screen.getByTestId("stat-pending")).toHaveAccessibleName("Pending approvals: 2");
    expect(screen.getByTestId("stat-outToday")).toHaveAccessibleName("Out today: 3");
    expect(screen.getByTestId("stat-comingUp")).toHaveAccessibleName("Coming up · 14d: 4");
    expect(screen.getByTestId("stat-workingToday")).toHaveAccessibleName("Working today: 5");
    expect(screen.getByTestId("stat-pending")).not.toBeBusy();
  });

  it("renders a dash in every tile while the counts can't be read", async () => {
    await renderStrip(statTiles({ state: "failed" }, { approver: false }));

    expect(screen.getAllByText(en.dashboard.stats.noValue)).toHaveLength(3);
    expect(
      screen.getByLabelText(`${en.dashboard.stats.outToday}: ${en.dashboard.stats.noValueSpoken}`)
    ).toBeTruthy();
  });

  it("opens a tile's panel on tap and closes it on a second tap", async () => {
    await renderStrip();

    await fireEvent.press(screen.getByTestId("stat-outToday"));
    expect(screen.getByTestId("stat-panel")).toHaveTextContent(
      `${en.dashboard.stats.outToday}3 ${en.dashboard.stats.outTodaySub}`
    );
    expect(screen.queryByTestId("stat-panel-view-requests")).toBeNull();

    await fireEvent.press(screen.getByTestId("stat-outToday"));
    expect(screen.queryByTestId("stat-panel")).toBeNull();
  });

  it("links the Pending and Coming up panels to the requests list", async () => {
    const onViewRequests = jest.fn();
    await renderStrip(undefined, onViewRequests);

    await fireEvent.press(screen.getByTestId("stat-pending"));
    await fireEvent.press(screen.getByTestId("stat-panel-view-requests"));
    await fireEvent.press(screen.getByTestId("stat-comingUp"));
    await fireEvent.press(screen.getByTestId("stat-panel-view-requests"));

    expect(onViewRequests).toHaveBeenCalledTimes(2);
  });

  it("says in the panel that the count needs the server while it can't be read", async () => {
    await renderStrip(statTiles({ state: "failed" }, { approver: false }));

    await fireEvent.press(screen.getByTestId("stat-workingToday"));

    expect(screen.getByText(en.dashboard.stats.unreachable)).toBeTruthy();
  });

  it("renders a neutral placeholder, not a dash, while the first read is in flight", async () => {
    await renderStrip(statTiles({ state: "loading" }, { approver: false }));

    expect(screen.getByTestId("stat-outToday")).toBeBusy();
    expect(screen.queryByText(en.dashboard.stats.noValue)).toBeNull();
    expect(
      screen.getByLabelText(`${en.dashboard.stats.outToday}: ${en.dashboard.stats.loading}`)
    ).toBeTruthy();
  });

  it("says in the panel that the count is loading while the first read is in flight", async () => {
    await renderStrip(statTiles({ state: "loading" }, { approver: false }));

    await fireEvent.press(screen.getByTestId("stat-outToday"));

    expect(screen.getByTestId("stat-panel")).toHaveTextContent(
      `${en.dashboard.stats.outToday}${en.dashboard.stats.loading}`
    );
    expect(screen.queryByText(en.dashboard.stats.unreachable)).toBeNull();
  });
});
