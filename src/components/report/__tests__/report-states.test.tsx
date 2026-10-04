import { fireEvent, render, screen } from "@testing-library/react-native";

import {
  IncompleteNote,
  ReportEmpty,
  ReportOffline,
  ReportSkeleton,
} from "@/components/report/report-states";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

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
