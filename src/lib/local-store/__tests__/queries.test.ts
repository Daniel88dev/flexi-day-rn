import { eq } from "drizzle-orm";

import { applyPage } from "../apply";
import { selectVacations } from "../queries";
import type { StoreRuntime } from "../runtime";
import { vacations } from "../schema";
import { syncPage, vacationRow } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";

const APPROVED = "2026-09-20T08:00:00.000Z";
const REJECTED = "2026-09-20T09:00:00.000Z";
const CANCELLED = "2026-09-20T10:00:00.000Z";

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function statusOf(id: string): string | undefined {
  const [row] = selectVacations(store.getDatabase()).where(eq(vacations.id, id)).all();
  return row?.status;
}

describe("selectVacations", () => {
  beforeEach(() => {
    store.write((transaction) =>
      applyPage(
        transaction,
        syncPage({
          vacations: [
            vacationRow({ id: "pending" }),
            vacationRow({ id: "approved", approvedAt: APPROVED, approvedBy: "user-2" }),
            vacationRow({ id: "rejected", rejectedAt: REJECTED, rejectedBy: "user-2" }),
            vacationRow({ id: "cancelled", deletedAt: CANCELLED, deletedByUserId: "user-1" }),
            vacationRow({
              id: "approved-then-cancelled",
              approvedAt: APPROVED,
              deletedAt: CANCELLED,
            }),
          ],
        }),
        1
      )
    );
  });

  it("returns pending for a booking the server has not decided", () => {
    expect(statusOf("pending")).toBe("pending");
  });

  it("returns approved for a booking with an approval timestamp", () => {
    expect(statusOf("approved")).toBe("approved");
  });

  it("returns rejected for a booking with a rejection timestamp", () => {
    expect(statusOf("rejected")).toBe("rejected");
  });

  it("returns cancelled for a booking with a deletion timestamp", () => {
    expect(statusOf("cancelled")).toBe("cancelled");
  });

  it("returns cancelled for an approved booking that was cancelled after", () => {
    expect(statusOf("approved-then-cancelled")).toBe("cancelled");
  });

  it("returns the booking's own columns and not the store's generation stamp", () => {
    const [row] = selectVacations(store.getDatabase()).where(eq(vacations.id, "approved")).all();

    expect(row).toMatchObject({
      id: "approved",
      userId: "user-1",
      groupId: "group-1",
      vacationType: "VACATION",
      halfDay: false,
      approvedBy: "user-2",
      status: "approved",
    });
    expect(row).not.toHaveProperty("generation");
  });

  it("returns every booking the store holds when nothing narrows it", () => {
    expect(selectVacations(store.getDatabase()).all()).toHaveLength(5);
  });
});
