import { fireEvent, render, screen } from "@testing-library/react-native";

import { DashboardDefaultSection } from "@/components/settings/dashboard-default-section";
import { showGroupPicker } from "@/components/ui/group-picker";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import type { RequestScopeGroup } from "@/lib/local-store";
import type { MySettings } from "@/lib/query";

jest.mock("@/components/ui/group-picker", () => ({ showGroupPicker: jest.fn() }));

const pickGroup = showGroupPicker as jest.MockedFunction<typeof showGroupPicker>;

const DESIGN = { groupId: "g-1", groupName: "Design" };
const SUPPORT = { groupId: "g-2", groupName: "Support" };

type Stored = Pick<MySettings, "dashboardScope" | "dashboardGroupId" | "dashboardCalendarView">;

const MINE: Stored = {
  dashboardScope: "MINE",
  dashboardGroupId: null,
  dashboardCalendarView: "LANES",
};

async function renderSection(
  options: { settings?: Stored | undefined; groups?: RequestScopeGroup[] } = {}
) {
  const settings = "settings" in options ? options.settings : MINE;
  const groups = options.groups ?? [DESIGN, SUPPORT];
  const onChange = jest.fn();
  await render(
    <TranslationProvider>
      <DashboardDefaultSection settings={settings} groups={groups} onChange={onChange} />
    </TranslationProvider>
  );
  return onChange;
}

beforeEach(() => jest.clearAllMocks());

describe("DashboardDefaultSection", () => {
  it("disables Group with the web's hint when the viewer sees no group in full", async () => {
    const onChange = await renderSection({ groups: [] });

    const group = screen.getByTestId("settings-scope-group");
    expect(group).toBeDisabled();
    expect(screen.getByText(en.settings.noViewableGroups)).toBeOnTheScreen();
    await fireEvent.press(group);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("saves Group with the first group the viewer sees when none is stored", async () => {
    const onChange = await renderSection();

    expect(screen.getByTestId("settings-scope-group")).toBeEnabled();
    expect(screen.getByText(en.settings.dashboardScopeHint)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("settings-scope-group"));

    expect(onChange).toHaveBeenCalledWith({ dashboardScope: "GROUP", dashboardGroupId: "g-1" });
  });

  it("saves Mine and keeps the stored group", async () => {
    const onChange = await renderSection({
      settings: { ...MINE, dashboardScope: "GROUP", dashboardGroupId: "g-2" },
    });

    await fireEvent.press(screen.getByTestId("settings-scope-mine"));

    expect(onChange).toHaveBeenCalledWith({ dashboardScope: "MINE" });
  });

  it("shows the stored group and saves the one picked instead", async () => {
    const onChange = await renderSection({
      settings: { ...MINE, dashboardScope: "GROUP", dashboardGroupId: "g-2" },
    });

    expect(screen.getByTestId("settings-scope-group")).toBeSelected();
    expect(screen.getByTestId("settings-group-picker")).toHaveTextContent(/Support/);
    await fireEvent.press(screen.getByTestId("settings-group-picker"));
    const [options, onPick] = pickGroup.mock.calls[0];
    expect(options.groups).toEqual([DESIGN, SUPPORT]);
    onPick({ kind: "group", groupId: "g-1" });

    expect(onChange).toHaveBeenCalledWith({ dashboardScope: "GROUP", dashboardGroupId: "g-1" });
  });

  it("shows no group row while Mine is the default", async () => {
    await renderSection();

    expect(screen.getByTestId("settings-scope-mine")).toBeSelected();
    expect(screen.queryByTestId("settings-group-picker")).toBeNull();
  });

  it("disables every choice until the settings have loaded", async () => {
    await renderSection({ settings: undefined });

    expect(screen.getByTestId("settings-scope-mine")).toBeDisabled();
    expect(screen.getByTestId("settings-scope-group")).toBeDisabled();
    expect(screen.getByTestId("settings-view-lanes")).toBeDisabled();
    expect(screen.getByTestId("settings-view-stripes")).toBeDisabled();
  });

  it("shows the stored layout and saves Stripes when it is picked", async () => {
    const onChange = await renderSection();

    expect(screen.getByTestId("settings-view-lanes")).toBeSelected();
    await fireEvent.press(screen.getByTestId("settings-view-stripes"));

    expect(onChange).toHaveBeenCalledWith({ dashboardCalendarView: "STRIPES" });
  });

  it("saves Lanes over stored stripes, and nothing for the layout already stored", async () => {
    const onChange = await renderSection({
      settings: { ...MINE, dashboardCalendarView: "STRIPES" },
    });

    expect(screen.getByTestId("settings-view-stripes")).toBeSelected();
    await fireEvent.press(screen.getByTestId("settings-view-stripes"));
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("settings-view-lanes"));
    expect(onChange).toHaveBeenCalledWith({ dashboardCalendarView: "LANES" });
  });

  it("offers the layout when the viewer sees no group in full", async () => {
    const onChange = await renderSection({ groups: [] });

    await fireEvent.press(screen.getByTestId("settings-view-stripes"));

    expect(onChange).toHaveBeenCalledWith({ dashboardCalendarView: "STRIPES" });
  });
});
