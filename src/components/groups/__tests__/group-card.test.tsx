import { fireEvent, render, screen } from "@testing-library/react-native";

import { GroupCard } from "@/components/groups/group-card";
import { TranslationProvider } from "@/i18n/use-translation";
import type { MyGroup } from "@/lib/local-store";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const GROUP: MyGroup = {
  id: "group-1",
  name: "Dev Team",
  organizationName: null,
  defaultVacationDays: 20,
  defaultHomeOfficeDays: 0,
  defaultSickDays: 0,
  workingDays: [1, 2, 3, 4, 5],
  holidayCountry: null,
  role: null,
};

describe("GroupCard", () => {
  it("renders the group without an organization line the store lacks, and opens it", async () => {
    const onPress = jest.fn();
    await render(
      <TranslationProvider>
        <GroupCard group={GROUP} onPress={onPress} />
      </TranslationProvider>
    );

    expect(screen.getByTestId("group-card-group-1")).toHaveAccessibleName(
      "Dev Team, 20 vacation days · 0 home office"
    );
    await fireEvent.press(screen.getByTestId("group-card-group-1"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
