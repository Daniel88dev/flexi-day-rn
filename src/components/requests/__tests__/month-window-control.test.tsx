import { fireEvent, render, screen } from "@testing-library/react-native";

import { MonthWindowControl } from "@/components/requests/month-window-control";
import { TranslationProvider } from "@/i18n/use-translation";
import { requestMonthBounds, type MonthWindow } from "@/lib/requests/months";

const BOUNDS = requestMonthBounds(new Date(2026, 9, 21));
const DEFAULT_WINDOW: MonthWindow = { first: { year: 2026, month: 10 }, length: 3 };

async function renderControl(value: MonthWindow, onChange = jest.fn()) {
  await render(
    <TranslationProvider>
      <MonthWindowControl
        value={value}
        bounds={BOUNDS}
        defaultWindow={DEFAULT_WINDOW}
        onChange={onChange}
      />
    </TranslationProvider>
  );
  return onChange;
}

describe("MonthWindowControl", () => {
  it("renders the window's label with its length selected", async () => {
    await renderControl(DEFAULT_WINDOW);

    expect(screen.getByTestId("requests-month")).toHaveTextContent("Oct – Dec 2026");
    expect(screen.getByTestId("requests-window-3")).toBeSelected();
    expect(screen.getByTestId("requests-window-6")).not.toBeSelected();
  });

  it("changes the length from the same first month", async () => {
    const onChange = await renderControl(DEFAULT_WINDOW);

    await fireEvent.press(screen.getByText("6 months"));

    expect(onChange).toHaveBeenCalledWith({ first: { year: 2026, month: 10 }, length: 6 });
  });

  it("pulls a longer window back so it ends on December of next year", async () => {
    const onChange = await renderControl({ first: { year: 2027, month: 12 }, length: 1 });

    await fireEvent.press(screen.getByText("3 months"));

    expect(onChange).toHaveBeenCalledWith({ first: { year: 2027, month: 10 }, length: 3 });
  });

  it("shifts the whole window a month back and on", async () => {
    const onChange = await renderControl(DEFAULT_WINDOW);

    await fireEvent.press(screen.getByLabelText("Previous month"));
    await fireEvent.press(screen.getByLabelText("Next month"));

    expect(onChange.mock.calls).toEqual([
      [{ first: { year: 2026, month: 9 }, length: 3 }],
      [{ first: { year: 2026, month: 11 }, length: 3 }],
    ]);
  });

  it("renders the step on as disabled once the window reaches December of next year", async () => {
    const onChange = await renderControl({ first: { year: 2027, month: 7 }, length: 6 });

    await fireEvent.press(screen.getByLabelText("Next month"));

    expect(screen.getByLabelText("Next month")).toBeDisabled();
    expect(screen.getByLabelText("Previous month")).toBeEnabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders the step back as disabled at January of last year", async () => {
    await renderControl({ first: { year: 2025, month: 1 }, length: 1 });

    expect(screen.getByLabelText("Previous month")).toBeDisabled();
  });

  it("renders no way back while the window is the default", async () => {
    await renderControl(DEFAULT_WINDOW);

    expect(screen.queryByTestId("requests-window-reset")).toBeNull();
  });

  it("returns to the default from any other window", async () => {
    const onChange = await renderControl({ first: { year: 2026, month: 12 }, length: 3 });

    await fireEvent.press(screen.getByText("Back to this month"));

    expect(onChange).toHaveBeenCalledWith(DEFAULT_WINDOW);
  });
});
