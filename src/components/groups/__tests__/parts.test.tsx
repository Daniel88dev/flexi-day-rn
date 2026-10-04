import { fireEvent, render, screen } from "@testing-library/react-native";

import {
  GroupBadge,
  Monogram,
  OrgAdminNotice,
  Pill,
  RetryNotice,
  RoleBadge,
  WeekdayPills,
} from "@/components/groups/parts";
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

  it("renders neutral for a group that is not yours", async () => {
    await render(<Monogram name="Dev Support" neutral />);

    expect(screen.getByTestId("monogram-neutral", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("DS", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe("Pill", () => {
  it("renders its label", async () => {
    await render(<Pill testID="pill" label="Not tracked" tone="muted" />);

    expect(screen.getByTestId("pill")).toHaveTextContent("Not tracked");
  });
});

describe("RetryNotice", () => {
  it("renders the message and retries on press", async () => {
    const onRetry = jest.fn();
    await render(
      withTranslation(<RetryNotice testID="thing" message="Didn't load." onRetry={onRetry} />)
    );

    expect(screen.getByTestId("thing-failed")).toHaveTextContent(/Didn't load\./);
    await fireEvent.press(screen.getByTestId("thing-retry"));
    expect(onRetry).toHaveBeenCalled();
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

describe("GroupBadge", () => {
  it("renders Org admin for authority through the organization", async () => {
    await render(withTranslation(<GroupBadge badge="orgAdmin" />));

    expect(screen.getByTestId("org-admin-badge")).toHaveTextContent("Org admin");
  });

  it("renders a role as the role badge", async () => {
    await render(withTranslation(<GroupBadge badge="manager" />));

    expect(screen.getByTestId("role-badge-manager")).toHaveTextContent("Manager");
  });

  it("renders nothing without a badge", async () => {
    await render(withTranslation(<GroupBadge badge={null} />));

    expect(screen.toJSON()).toBeNull();
  });
});

describe("OrgAdminNotice", () => {
  it("renders the web's wording with the organization", async () => {
    await render(withTranslation(<OrgAdminNotice organization="Olivia Owner" />));

    expect(screen.getByTestId("group-org-admin-notice")).toHaveTextContent(
      /^You're managing this group as an administrator of Olivia Owner\./
    );
  });
});
