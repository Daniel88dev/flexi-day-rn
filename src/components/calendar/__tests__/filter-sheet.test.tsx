import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterSheet } from "@/components/calendar/filter-sheet";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRecordType } from "@/lib/local-store";

async function renderSheet(filter: Set<CalendarRecordType>) {
  const onChange = jest.fn();
  await render(
    <TranslationProvider>
      <FilterSheet open onClose={jest.fn()} filter={filter} onChange={onChange} />
    </TranslationProvider>
  );
  return onChange;
}

describe("FilterSheet", () => {
  it("renders every type checked and drops one that is tapped", async () => {
    const onChange = await renderSheet(new Set(LEAVE_TYPE_ORDER));

    expect(screen.getByTestId("filter-sheet-SICK")).toBeChecked();
    await fireEvent.press(screen.getByTestId("filter-sheet-SICK"));

    expect(onChange.mock.calls[0][0].has("SICK")).toBe(false);
    expect(onChange.mock.calls[0][0].size).toBe(LEAVE_TYPE_ORDER.length - 1);
  });

  it("selects every type again from a partial filter", async () => {
    const onChange = await renderSheet(new Set<CalendarRecordType>(["SICK"]));

    await fireEvent.press(screen.getByText("Select all"));

    expect(onChange.mock.calls[0][0].size).toBe(LEAVE_TYPE_ORDER.length);
  });
});
