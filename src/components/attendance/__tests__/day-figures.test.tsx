import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { DayFigures } from "@/components/attendance/day-figures";
import { TimelineStrip } from "@/components/attendance/timeline-strip";
import { TranslationProvider } from "@/i18n/use-translation";
import type { AttendanceMonth, AttendanceMonthDay } from "@/lib/attendance";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn() }));

function month(day: Partial<AttendanceMonthDay>, balanceMode: "DAILY" | "MONTHLY" = "DAILY") {
  return {
    balanceMode,
    days: [
      {
        businessDate: "2026-09-24",
        presenceMinutes: 480,
        workedMinutes: 450,
        requiredMinutes: 480,
        balanceMinutes: -30,
        exclusion: null,
        ...day,
      },
    ],
  } as unknown as AttendanceMonth;
}

async function renderFigures(data: AttendanceMonth | undefined, loading = false) {
  await render(
    <TranslationProvider>
      <DayFigures month={data} date="2026-09-24" loading={loading} />
    </TranslationProvider>
  );
}

describe("DayFigures", () => {
  it("shows worked of required with the day's balance in DAILY mode", async () => {
    await renderFigures(month({}));

    expect(screen.getByText("Worked 7:30 of 8:00")).toBeTruthy();
    expect(screen.getByText("-0:30")).toBeTruthy();
  });

  it("shows no balance chip in MONTHLY mode", async () => {
    await renderFigures(month({ balanceMinutes: null }, "MONTHLY"));

    expect(screen.queryByTestId("figures-balance")).toBeNull();
  });

  it("tags a day off somebody worked", async () => {
    await renderFigures(
      month({
        requiredMinutes: 0,
        balanceMinutes: 450,
        exclusion: { cause: "NON_WORKING_DAY", extent: "FULL", label: null },
      })
    );

    expect(screen.getByText("Worked 7:30")).toBeTruthy();
    expect(screen.getByText("Non-working day")).toBeTruthy();
  });

  it("holds a placeholder while the month loads", async () => {
    await renderFigures(undefined, true);

    expect(screen.getByTestId("figures-loading")).toBeTruthy();
  });
});

describe("TimelineStrip", () => {
  it("draws the spans, the hour ticks and the now line", async () => {
    await render(
      <TimelineStrip
        strip={{
          ticks: [
            { label: "08:00", at: 0 },
            { label: "12:00", at: 0.5 },
            { label: "15:00", at: 0.875 },
          ],
          spans: [
            { kind: "work", from: 0, to: 0.6 },
            { kind: "break", from: 0.25, to: 0.3 },
          ],
          now: 0.6,
        }}
      />
    );

    expect(screen.getByText("12:00")).toBeTruthy();
    // A label short of the edge sits at its own place, not pinned to the edge.
    expect(StyleSheet.flatten(screen.getByText("15:00").props.style)).toMatchObject({
      left: "87.5%",
    });
    expect(screen.getByTestId("timeline-work")).toBeTruthy();
    expect(screen.getByTestId("timeline-break")).toBeTruthy();
    expect(screen.getByTestId("timeline-now")).toBeTruthy();
  });
});
