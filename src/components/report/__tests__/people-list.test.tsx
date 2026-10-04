import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { PeopleList } from "@/components/report/people-list";
import { TranslationProvider } from "@/i18n/use-translation";
import { daysLeftScale, peopleSections } from "@/lib/report";
import { ownerOverview } from "@/test-support/report";

let mockLanguage = "en";
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: mockLanguage }] }));

const [support, team] = peopleSections(ownerOverview, "VACATION");
const scale = daysLeftScale([...support.rows, ...team.rows]);

async function renderList(section = support, onOpen = jest.fn()) {
  await render(
    <TranslationProvider>
      <PeopleList
        section={section}
        year={2026}
        scale={scale}
        type="VACATION"
        colors={{ "u-frank": "#2a78d6" }}
        onOpen={onOpen}
      />
    </TranslationProvider>
  );
  return onOpen;
}

beforeEach(() => {
  mockLanguage = "en";
});

describe("PeopleList", () => {
  it("renders the group name, its head count and year, and a row per person", async () => {
    await renderList();

    const list = screen.getByTestId("people-g-support");
    expect(within(list).getByText("Dev Support")).toBeOnTheScreen();
    expect(within(list).getByText("2 people, 2026")).toBeOnTheScreen();
    expect(screen.getByTestId("member-row-u-frank")).toBeOnTheScreen();
    expect(screen.getByTestId("member-row-u-erin")).toBeOnTheScreen();
  });

  it("renders the days left, the allowance and the parts that are not zero", async () => {
    await renderList();

    const erin = screen.getByTestId("member-row-u-erin");
    expect(within(erin).getByText("7")).toBeOnTheScreen();
    expect(within(erin).getByText("of 20")).toBeOnTheScreen();
    expect(within(erin).getByText("13 used, 3 pending")).toBeOnTheScreen();
    expect(within(erin).getByText("EK")).toBeOnTheScreen();
  });

  it("calls back with the person's id when a row is tapped", async () => {
    const onOpen = await renderList();

    await fireEvent.press(screen.getByTestId("member-row-u-frank"));

    expect(onOpen).toHaveBeenCalledWith("u-frank");
  });

  it("renders Czech counts, half days with a comma and the Czech row label", async () => {
    mockLanguage = "cs";
    await renderList();

    const frank = screen.getByTestId("member-row-u-frank");
    expect(
      within(screen.getByTestId("people-g-support")).getByText("2 lidé, 2026")
    ).toBeOnTheScreen();
    expect(within(frank).getByText("27,5")).toBeOnTheScreen();
    expect(within(frank).getByText("z 31")).toBeOnTheScreen();
    expect(within(frank).getByText("3,5 vybráno")).toBeOnTheScreen();
    expect(frank).toHaveProp("accessibilityLabel", "Frank Benes, zbývá 27,5 dne z 31");
    expect(screen.getByTestId("member-row-u-erin")).toHaveProp(
      "accessibilityLabel",
      "Erin Kral, zbývá 7 dní z 20"
    );
  });
});
