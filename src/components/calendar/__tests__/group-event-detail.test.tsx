import { fireEvent, render, screen } from "@testing-library/react-native";

import { GroupEventDetail, GroupEventSheet } from "@/components/calendar/group-event-detail";
import { TranslationProvider } from "@/i18n/use-translation";
import type { ShownGroupEvent } from "@/lib/group-events/rights";

const STANDUP: ShownGroupEvent = {
  id: "standup",
  groupId: "g-design",
  groupName: "Design",
  title: "Weekly standup",
  note: "Bring the board",
  startDate: "2026-10-14",
  endDate: "2026-10-14",
  startTime: "09:30",
  endTime: "09:45",
  ruleStartDate: "2026-10-07",
  repeat: { freq: "weekly", interval: 1, weekdays: [2], monthlyMode: null, until: null },
  changedOnce: false,
  creator: { id: "eva", name: "Eva Novak" },
  canEdit: false,
};

describe("GroupEventDetail", () => {
  it("renders the date, time, rule, note, group and creator, with the lock line", async () => {
    await render(
      <TranslationProvider>
        <GroupEventDetail event={STANDUP} viewerId="me" />
      </TranslationProvider>
    );

    const detail = screen.getByTestId("group-event-detail");
    expect(detail).toHaveTextContent(
      /Weekly standup.*Wed 14 Oct.*09:30–09:45.*Every week on Wed.*Bring the board.*Design · Added by Eva Novak.*Only Eva or a group admin can change this/
    );
  });

  it("renders a multi-day event's dates and no lock line for an editor", async () => {
    await render(
      <TranslationProvider>
        <GroupEventDetail
          event={{
            ...STANDUP,
            startDate: "2026-10-13",
            endDate: "2026-10-15",
            startTime: null,
            endTime: null,
            repeat: null,
            note: null,
            canEdit: true,
          }}
          viewerId="me"
        />
      </TranslationProvider>
    );

    const detail = screen.getByTestId("group-event-detail");
    expect(detail).toHaveTextContent(/Tue 13 Oct – Thu 15 Oct.*All day/);
    expect(detail).not.toHaveTextContent(/can change this/);
    expect(detail).not.toHaveTextContent(/Every/);
  });

  it("offers an editor Edit and Delete, and a non-editor neither", async () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    await render(
      <TranslationProvider>
        <GroupEventDetail event={STANDUP} viewerId="me" onEdit={onEdit} onDelete={onDelete} />
      </TranslationProvider>
    );
    expect(screen.queryByTestId("group-event-detail-edit")).toBeNull();

    await render(
      <TranslationProvider>
        <GroupEventDetail
          event={{ ...STANDUP, canEdit: true }}
          viewerId="me"
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </TranslationProvider>
    );
    await fireEvent.press(screen.getByTestId("group-event-detail-edit"));
    await fireEvent.press(screen.getByTestId("group-event-detail-delete"));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "standup" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "standup" }));
  });

  it("goes back from a Back button when it has one", async () => {
    const onBack = jest.fn();
    await render(
      <TranslationProvider>
        <GroupEventDetail event={STANDUP} viewerId="me" onBack={onBack} />
      </TranslationProvider>
    );

    await fireEvent.press(screen.getByTestId("group-event-detail-back"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe("GroupEventSheet", () => {
  it("shows the event in a sheet, and nothing without one", async () => {
    const { rerender } = await render(
      <TranslationProvider>
        <GroupEventSheet event={STANDUP} viewerId="me" onClose={jest.fn()} />
      </TranslationProvider>
    );
    expect(screen.getByTestId("group-event-sheet")).toHaveTextContent(/Weekly standup/);

    await rerender(
      <TranslationProvider>
        <GroupEventSheet event={null} viewerId="me" onClose={jest.fn()} />
      </TranslationProvider>
    );
    expect(screen.queryByTestId("group-event-detail")).toBeNull();
  });
});
