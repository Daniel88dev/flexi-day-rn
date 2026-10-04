import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import {
  IncompleteNote,
  MemberSkeleton,
  ReportEmpty,
  ReportOffline,
  ReportSkeleton,
  ReportStale,
} from "@/components/report/report-states";
import { TranslationProvider } from "@/i18n/use-translation";

let mockLanguage = "en";
let mockUses24 = true;
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: mockLanguage }],
  getCalendars: () => [{ uses24hourClock: mockUses24 }],
}));

beforeEach(() => {
  mockLanguage = "en";
  mockUses24 = true;
  jest.useFakeTimers({ now: new Date(2026, 9, 4, 10), doNotFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => jest.useRealTimers());

describe("ReportSkeleton", () => {
  it("renders the loading shape with a label for VoiceOver", async () => {
    await render(
      <TranslationProvider>
        <ReportSkeleton />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-loading")).toHaveProp(
      "accessibilityLabel",
      "Loading the report"
    );
  });
});

describe("MemberSkeleton", () => {
  it("renders the member-shaped loading state with a label for VoiceOver", async () => {
    await render(
      <TranslationProvider>
        <MemberSkeleton />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-loading")).toHaveProp(
      "accessibilityLabel",
      "Loading the report"
    );
  });
});

describe("ReportEmpty", () => {
  it("renders the empty-scope title and its one line", async () => {
    await render(
      <TranslationProvider>
        <ReportEmpty />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-empty")).toBeOnTheScreen();
    expect(screen.getByText("Nothing to report yet")).toBeOnTheScreen();
  });
});

describe("ReportOffline", () => {
  it("renders the cold offline state with a Retry that calls back", async () => {
    const onRetry = jest.fn();
    await render(
      <TranslationProvider>
        <ReportOffline onRetry={onRetry} />
      </TranslationProvider>
    );

    expect(screen.getByText("Can't reach the server")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("report-retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the controls it is given above the state", async () => {
    await render(
      <TranslationProvider>
        <ReportOffline onRetry={jest.fn()} controls={<Text>Period chip</Text>} />
      </TranslationProvider>
    );

    expect(screen.getByText("Period chip")).toBeOnTheScreen();
    expect(screen.getByTestId("report-offline")).toBeOnTheScreen();
  });
});

describe("ReportStale", () => {
  it("renders the kept answer's time with a Retry that calls back", async () => {
    const onRetry = jest.fn();
    await render(
      <TranslationProvider>
        <ReportStale since={new Date(2026, 9, 4, 9, 5)} onRetry={onRetry} />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-stale")).toHaveTextContent(
      "Offline. Showing the report as of 09:05.Retry"
    );
    expect(screen.getByTestId("report-stale-retry")).toHaveProp("accessibilityLabel", "Retry");
    await fireEvent.press(screen.getByTestId("report-stale-retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the date in front of the time when the answer is not from today", async () => {
    await render(
      <TranslationProvider>
        <ReportStale since={new Date(2026, 9, 3, 18, 5)} onRetry={jest.fn()} />
      </TranslationProvider>
    );

    expect(screen.getByText("Offline. Showing the report as of 3 Oct, 18:05.")).toBeOnTheScreen();
  });

  it("renders the device's twelve-hour clock when it uses one", async () => {
    mockUses24 = false;
    await render(
      <TranslationProvider>
        <ReportStale since={new Date(2026, 9, 4, 18, 5)} onRetry={jest.fn()} />
      </TranslationProvider>
    );

    expect(screen.getByText("Offline. Showing the report as of 6:05 pm.")).toBeOnTheScreen();
  });

  it("renders the notice in Czech", async () => {
    mockLanguage = "cs";
    await render(
      <TranslationProvider>
        <ReportStale since={new Date(2026, 9, 3, 18, 5)} onRetry={jest.fn()} />
      </TranslationProvider>
    );

    expect(screen.getByText("Offline. Report ukazuje stav k\u00a03. 10. 18:05.")).toBeOnTheScreen();
    expect(screen.getByTestId("report-stale-retry")).toHaveProp(
      "accessibilityLabel",
      "Zkusit znovu"
    );
  });
});

describe("IncompleteNote", () => {
  it("renders the year that failed with a Retry that calls back", async () => {
    const onRetry = jest.fn();
    await render(
      <TranslationProvider>
        <IncompleteNote year={2025} onRetry={onRetry} />
      </TranslationProvider>
    );

    expect(screen.getByTestId("report-incomplete")).toHaveTextContent(
      "2025 didn't load, so its months show no leave yet.Retry"
    );
    await fireEvent.press(screen.getByTestId("report-incomplete-retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
