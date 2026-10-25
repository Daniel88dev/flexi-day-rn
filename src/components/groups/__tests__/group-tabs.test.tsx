import { fireEvent, render, screen } from "@testing-library/react-native";

import { GroupTabs, TabsFailed, TabsSkeleton } from "@/components/groups/group-tabs";
import { TranslationProvider } from "@/i18n/use-translation";
import type { UserYearQuota } from "@/lib/query";
import { groupMember } from "@/test-support/groups";

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

const { getLocales } = jest.requireMock<{ getLocales: jest.Mock }>("expo-localization");

const withTranslation = (children: React.ReactNode) => (
  <TranslationProvider>{children}</TranslationProvider>
);

const MEMBER = groupMember("user-1", "Bob Dvorak", { email: "bob@dev.local" });

const read = <T,>(data: T | undefined) => ({ data, isError: false, dataUpdatedAt: 1 });

describe("GroupTabs", () => {
  it("renders the members, then a person's quotas on the Quotas tab", async () => {
    await render(
      withTranslation(
        <GroupTabs
          detail={read({})}
          members={read([MEMBER])}
          quotas={read<UserYearQuota[]>([])}
          managerUserId="someone-else"
          defaults={{ vacationDays: 20, homeOfficeDays: 0, sickDays: 0 }}
          sickDayBenefit={false}
          year={2026}
          onRetry={() => undefined}
        />
      )
    );

    expect(screen.getByText("1 person")).toBeOnTheScreen();
    expect(screen.getByTestId("group-member-user-1")).toHaveTextContent(/bob@dev\.local/);
    await fireEvent.press(screen.getByTestId("group-tab-quotas"));
    expect(screen.getByText("Allowance 2026")).toBeOnTheScreen();
    expect(screen.getByTestId("group-quota-user-1")).toHaveTextContent(/20/);
  });
});

describe("GroupTabs with a Deleted account", () => {
  const DELETED = groupMember("user-2", "Jana Nováková", {
    email: "user-2@deleted.invalid",
    accountDeleted: true,
  });

  const renderMembers = () =>
    render(
      withTranslation(
        <GroupTabs
          detail={read({})}
          members={read([MEMBER, DELETED])}
          quotas={read<UserYearQuota[]>([])}
          managerUserId="someone-else"
          defaults={{ vacationDays: 20, homeOfficeDays: 0, sickDays: 0 }}
          sickDayBenefit={false}
          year={2026}
          onRetry={() => undefined}
        />
      )
    );

  afterEach(() => {
    getLocales.mockReturnValue([{ languageCode: "en" }]);
  });

  it("shows initials, the kept name and the label, and hides the placeholder address", async () => {
    await renderMembers();

    const row = screen.getByTestId("group-member-user-2");
    expect(row).toHaveTextContent(/JN/);
    expect(row).toHaveTextContent(/Jana Nováková/);
    expect(row).toHaveTextContent(/Account deleted/);
    expect(row).not.toHaveTextContent(/deleted\.invalid/);
    expect(screen.getByTestId("group-member-user-1")).not.toHaveTextContent(/Account deleted/);
  });

  it("labels the row in Czech", async () => {
    getLocales.mockReturnValue([{ languageCode: "cs" }]);
    await renderMembers();

    expect(screen.getByTestId("group-member-user-2")).toHaveTextContent(/Účet smazán/);
  });
});

describe("TabsSkeleton", () => {
  it("renders the loading rows", async () => {
    await render(<TabsSkeleton />);

    expect(screen.getByTestId("group-tabs-loading")).toBeOnTheScreen();
  });
});

describe("TabsFailed", () => {
  it("renders the notice and retries on press", async () => {
    const onRetry = jest.fn();
    await render(withTranslation(<TabsFailed onRetry={onRetry} />));

    await fireEvent.press(screen.getByTestId("group-tabs-retry"));

    expect(onRetry).toHaveBeenCalled();
  });
});
