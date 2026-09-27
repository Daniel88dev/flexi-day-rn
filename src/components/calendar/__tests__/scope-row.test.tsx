import { fireEvent, render, screen } from "@testing-library/react-native";

import { ScopeRow } from "@/components/calendar/scope-row";
import { LEAVE_TYPE_ORDER } from "@/components/ui/leave-classes";
import { TranslationProvider } from "@/i18n/use-translation";
import type { CalendarRecordType, RequestListScope } from "@/lib/local-store";

const GROUPS = [{ groupId: "g-1", groupName: "Design" }];

async function renderRow({
  scope = { kind: "mine" } as RequestListScope,
  groups = GROUPS,
  filter = new Set<CalendarRecordType>(LEAVE_TYPE_ORDER),
} = {}) {
  const handlers = { onScope: jest.fn(), onFilter: jest.fn() };
  await render(
    <TranslationProvider>
      <ScopeRow
        scope={scope}
        groupId={groups[0]?.groupId ?? null}
        groups={groups}
        filter={filter}
        {...handlers}
      />
    </TranslationProvider>
  );
  return handlers;
}

describe("ScopeRow", () => {
  it("renders no Mine | Group toggle when the viewer sees no group in full", async () => {
    await renderRow({ groups: [] });

    expect(screen.queryByTestId("calendar-scope-group")).toBeNull();
    expect(screen.getByTestId("calendar-filter")).toHaveTextContent("All types");
  });

  it("switches to the picker's group from Mine", async () => {
    const { onScope } = await renderRow();

    expect(screen.queryByTestId("calendar-group-picker")).toBeNull();
    await fireEvent.press(screen.getByTestId("calendar-scope-group"));

    expect(onScope).toHaveBeenCalledWith({ kind: "group", groupId: "g-1" });
  });

  it("renders the group picker only when there are two groups to pick from", async () => {
    const scope = { kind: "group", groupId: "g-1" } as const;
    await renderRow({ scope });
    expect(screen.queryByTestId("calendar-group-picker")).toBeNull();

    await renderRow({ scope, groups: [...GROUPS, { groupId: "g-2", groupName: "Support" }] });
    expect(screen.getByTestId("calendar-group-picker")).toHaveTextContent("Design");
  });

  it("renders how many types the filter keeps", async () => {
    await renderRow({ filter: new Set<CalendarRecordType>(["SICK"]) });

    expect(screen.getByTestId("calendar-filter")).toHaveTextContent("1 type");
  });
});
