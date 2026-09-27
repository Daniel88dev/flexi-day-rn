import { fireEvent, render, screen } from "@testing-library/react-native";

import { FilterChips } from "@/components/requests/filter-chips";
import { TranslationProvider } from "@/i18n/use-translation";
import { REQUEST_FILTERS } from "@/lib/requests/filters";

const COUNTS = { all: 6, mine: 2, pending: 3, approved: 1, rejected: 0, cancelled: 0 };

async function renderChips(onChange = jest.fn()) {
  await render(
    <TranslationProvider>
      <FilterChips value="all" counts={COUNTS} onChange={onChange} />
    </TranslationProvider>
  );
  return onChange;
}

describe("FilterChips", () => {
  it("renders a chip per filter, by testID", async () => {
    await renderChips();

    for (const filter of REQUEST_FILTERS) {
      expect(screen.getByTestId(`requests-filter-${filter}`)).toBeTruthy();
    }
  });

  it("renders each chip's count", async () => {
    await renderChips();

    expect(screen.getByTestId("requests-filter-pending")).toHaveTextContent("Pending3");
  });

  it("renders the chosen chip as selected", async () => {
    await renderChips();

    expect(screen.getByTestId("requests-filter-all")).toBeSelected();
    expect(screen.getByTestId("requests-filter-mine")).not.toBeSelected();
  });

  it("picks the filter tapped", async () => {
    const onChange = await renderChips();

    await fireEvent.press(screen.getByTestId("requests-filter-mine"));

    expect(onChange).toHaveBeenCalledWith("mine");
  });
});
