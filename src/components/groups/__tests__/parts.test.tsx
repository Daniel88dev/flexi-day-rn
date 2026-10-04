import { render, screen } from "@testing-library/react-native";

import { Monogram, RoleBadge, WeekdayPills } from "@/components/groups/parts";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const withTranslation = (children: React.ReactNode) => (
  <TranslationProvider>{children}</TranslationProvider>
);

describe("Monogram", () => {
  it("renders the group's initials, hidden from VoiceOver", async () => {
    await render(<Monogram name="Dev Team" />);

    expect(screen.getByText("DT", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.queryByText("DT")).toBeNull();
  });
});

describe("RoleBadge", () => {
  it("renders the role's name", async () => {
    await render(withTranslation(<RoleBadge role="approver" />));

    expect(screen.getByTestId("role-badge-approver")).toHaveTextContent("Approver");
  });

  it("renders nothing for a plain member", async () => {
    await render(withTranslation(<RoleBadge role={null} />));

    expect(screen.toJSON()).toBeNull();
  });
});

describe("WeekdayPills", () => {
  it("renders seven initials from Monday and reads them as one phrase", async () => {
    await render(withTranslation(<WeekdayPills workingDays={[1, 2, 3, 4, 5]} />));

    expect(screen.getByTestId("weekday-pills")).toHaveAccessibleName("Mon to Fri");
    expect(screen.getAllByText(/^[MTWFS]$/)).toHaveLength(7);
  });
});
