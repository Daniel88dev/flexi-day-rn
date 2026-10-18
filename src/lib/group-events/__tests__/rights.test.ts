import type { CalendarGroupEvent } from "@/lib/local-store";

import { withRights } from "../rights";

const event = (patch: Partial<CalendarGroupEvent>): CalendarGroupEvent => ({
  id: "ge-1",
  groupId: "g-1",
  groupName: "Dev Team",
  title: "Standup",
  note: null,
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  startTime: "09:30",
  endTime: "09:45",
  repeat: null,
  ruleStartDate: "2026-10-21",
  changedOnce: false,
  creator: { id: "bob", name: "Bob" },
  ...patch,
});

describe("withRights", () => {
  it("returns every event locked, with the store's creator, before the server answers", () => {
    expect(withRights([event({})], undefined)).toEqual([{ ...event({}), canEdit: false }]);
  });

  it("returns the server's canEdit and creator for the events it answered for", () => {
    const rights = new Map([
      ["ge-1", { canEdit: true, createdBy: { id: "bob", name: "Bob Dvorak" } }],
      ["ge-2", { canEdit: false, createdBy: null }],
    ]);

    const [mine, gone, unknown] = withRights(
      [event({}), event({ id: "ge-2" }), event({ id: "ge-3" })],
      rights
    );

    expect(mine).toMatchObject({ canEdit: true, creator: { id: "bob", name: "Bob Dvorak" } });
    expect(gone).toMatchObject({ canEdit: false, creator: null });
    expect(unknown).toMatchObject({ canEdit: false, creator: { id: "bob", name: "Bob" } });
  });
});
