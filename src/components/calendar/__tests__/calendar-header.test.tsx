import { fireEvent, render, screen } from "@testing-library/react-native";

import { CalendarHeader } from "@/components/calendar/calendar-header";
import { TranslationProvider } from "@/i18n/use-translation";

describe("CalendarHeader", () => {
  it("renders the month and calls back from the title and the arrows", async () => {
    const onStep = jest.fn();
    const onToday = jest.fn();
    await render(
      <TranslationProvider>
        <CalendarHeader
          month={{ year: 2026, month: 10 }}
          canPrevious
          canNext={false}
          onStep={onStep}
          onToday={onToday}
        />
      </TranslationProvider>
    );

    expect(screen.getByTestId("calendar-title")).toHaveTextContent("October 2026");
    expect(screen.getByTestId("calendar-next")).toBeDisabled();

    await fireEvent.press(screen.getByTestId("calendar-previous"));
    await fireEvent.press(screen.getByTestId("calendar-title"));

    expect(onStep).toHaveBeenCalledWith(-1);
    expect(onToday).toHaveBeenCalled();
  });
});
