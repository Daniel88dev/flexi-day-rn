import { fireEvent, render, screen } from "@testing-library/react-native";

import { MonthStepper } from "@/components/requests/month-stepper";
import { TranslationProvider } from "@/i18n/use-translation";

async function renderStepper(canPrevious: boolean, onStep = jest.fn()) {
  await render(
    <TranslationProvider>
      <MonthStepper
        month={{ year: 2026, month: 9 }}
        canPrevious={canPrevious}
        canNext
        onStep={onStep}
      />
    </TranslationProvider>
  );
  return onStep;
}

describe("MonthStepper", () => {
  it("renders the month and year", async () => {
    await renderStepper(true);

    expect(screen.getByTestId("requests-month")).toHaveTextContent("September 2026");
  });

  it("steps back and on", async () => {
    const onStep = await renderStepper(true);

    await fireEvent.press(screen.getByLabelText("Previous month"));
    await fireEvent.press(screen.getByLabelText("Next month"));

    expect(onStep.mock.calls).toEqual([[-1], [1]]);
  });

  it("renders the step back as disabled at the first month", async () => {
    const onStep = await renderStepper(false);

    await fireEvent.press(screen.getByLabelText("Previous month"));

    expect(screen.getByLabelText("Previous month")).toBeDisabled();
    expect(onStep).not.toHaveBeenCalled();
  });
});
