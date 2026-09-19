import { eq } from "drizzle-orm";

import { applyPage, writeSyncState } from "../apply";
import { activePendingChanges, type PendingChanges, type VacationDraft } from "../pending";
import { selectVacations } from "../queries";
import type { PullOutcome } from "../pull";
import type { StoreRuntime } from "../runtime";
import { vacations } from "../schema";
import { createFakeClock, type FakeClock } from "../test-support/fake-clock";
import { createFakeSync, reply, type FakeSyncReply } from "../test-support/fake-sync";
import { tick } from "../test-support/pull-harness";
import { groupRow, storeVacations, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import {
  APPROVE_VACATION_PATH,
  CANCEL_VACATION_PATH,
  createStoreWrites,
  CREATE_VACATION_PATH,
  REJECT_VACATION_PATH,
  VACATION_PATH,
  WRITE_TIMEOUT_MS,
} from "../writes";

const NOW = "2026-09-19T12:00:00.000Z";

/** What the pull after a write brings back: the server's own stamp, not the one the store guessed. */
const PULLED = "2026-09-19T12:00:02.000Z";

const DRAFT: VacationDraft = { groupId: "group-1", from: "2026-09-21", to: "2026-09-22" };

/** The create endpoint answers rows of the vacations table, without an organization. */
function createdRow(row: Partial<ReturnType<typeof vacationRow>> = {}) {
  const { organizationId, ...created } = vacationRow(row);
  return created;
}

let clock: FakeClock;
let store: StoreRuntime;
let pending: PendingChanges;
let onUnauthorized: jest.Mock;
let pull: jest.Mock<Promise<PullOutcome>, [string]>;

beforeEach(async () => {
  clock = createFakeClock(NOW);
  store = await openTestStore("user-1", { clock });
  pending = activePendingChanges();
  onUnauthorized = jest.fn();
  pull = jest.fn<Promise<PullOutcome>, [string]>(() => Promise.resolve({ ok: true }));
  store.write((transaction) => applyPage(transaction, syncPage({ groups: [groupRow()] }), 1));
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function buildWrites(replies: FakeSyncReply[]) {
  const sync = createFakeSync(replies);
  const writes = createStoreWrites({
    runtime: store,
    apiFetch: sync.apiFetch,
    clock,
    pending,
    pull,
    onUnauthorized,
  });
  return { sync, writes };
}

function storedVacations() {
  return selectVacations(store.getDatabase()).all();
}

function generationOf(id: string): number | undefined {
  return store
    .getDatabase()
    .select({ generation: vacations.generation })
    .from(vacations)
    .where(eq(vacations.id, id))
    .all()[0]?.generation;
}

describe("createVacation", () => {
  it("returns ok and stores the rows the server answered with", async () => {
    const { writes } = buildWrites([
      reply.rows([
        createdRow({ id: "vacation-1", requestedDay: "2026-09-21" }),
        createdRow({ id: "vacation-2", requestedDay: "2026-09-22" }),
      ]),
    ]);

    const outcome = await writes.createVacation(DRAFT);

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([
      expect.objectContaining({ id: "vacation-1", organizationId: "org-1", status: "pending" }),
      expect.objectContaining({ id: "vacation-2", organizationId: "org-1", status: "pending" }),
    ]);
    expect(pending.list()).toEqual([]);
  });

  it("posts the draft as it stands to the create endpoint", async () => {
    const { sync, writes } = buildWrites([reply.rows([createdRow()])]);
    const draft: VacationDraft = {
      ...DRAFT,
      vacationType: "HOME_OFFICE",
      note: "Skiing",
    };

    await writes.createVacation(draft);

    const [request] = sync.requests;
    expect(request.path).toBe(CREATE_VACATION_PATH);
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(request.init.body ?? "")).toEqual(draft);
  });

  it("holds the change in flight until the answer lands", async () => {
    const { writes } = buildWrites([reply.rows([createdRow()])]);

    const written = writes.createVacation(DRAFT);
    expect(pending.list()).toEqual([
      expect.objectContaining({ kind: "create", draft: DRAFT, startedAt: Date.parse(NOW) }),
    ]);

    await written;
    expect(pending.list()).toEqual([]);
  });

  it("stamps a stored row with the generation the pull is on, so a sweep treats it alike", async () => {
    store.write((transaction) => writeSyncState(transaction, { generation: 4 }));
    const { writes } = buildWrites([reply.rows([createdRow({ id: "vacation-1" })])]);

    await writes.createVacation(DRAFT);

    const [row] = store
      .getDatabase()
      .select({ generation: vacations.generation })
      .from(vacations)
      .where(eq(vacations.id, "vacation-1"))
      .all();
    expect(row.generation).toBe(4);
  });

  it("stores nothing for a row whose group the store has never pulled", async () => {
    const { writes } = buildWrites([reply.rows([createdRow({ groupId: "group-404" })])]);

    const outcome = await writes.createVacation({ ...DRAFT, groupId: "group-404" });

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([]);
    expect(pending.list()).toEqual([]);
  });

  it("returns an unreachable failure when the server never answers", async () => {
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.createVacation(DRAFT);
    await tick();
    expect(pending.list()).toHaveLength(1);

    clock.advance(WRITE_TIMEOUT_MS);

    expect(await written).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(pending.list()).toEqual([]);
    expect(storedVacations()).toEqual([]);
  });

  it("waits for the answer right up to the write timeout", async () => {
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.createVacation(DRAFT);
    await tick();
    clock.advance(WRITE_TIMEOUT_MS - 1);
    await tick();

    expect(pending.list()).toHaveLength(1);

    clock.advance(1);
    await written;
    expect(pending.list()).toEqual([]);
  });

  it("returns the server's message verbatim when it rejects the booking", async () => {
    const { writes } = buildWrites([reply.status(422, "Selected day is not a working day")]);

    const outcome = await writes.createVacation(DRAFT);

    expect(outcome).toEqual({
      ok: false,
      reason: "rejected",
      message: "Selected day is not a working day",
    });
    expect(pending.list()).toEqual([]);
    expect(storedVacations()).toEqual([]);
  });

  it("returns a rejection with no message when the refusal carried none", async () => {
    const { writes } = buildWrites([reply.statusWithBody(402, { errors: [] })]);

    expect(await writes.createVacation(DRAFT)).toEqual({
      ok: false,
      reason: "rejected",
      message: null,
    });
    expect(pending.list()).toEqual([]);
  });

  it("returns a rejection carrying what the server said about a failure of its own", async () => {
    const { writes } = buildWrites([reply.status(500, "Failed to create vacation")]);

    expect(await writes.createVacation(DRAFT)).toEqual({
      ok: false,
      reason: "rejected",
      message: "Failed to create vacation",
    });
  });

  it("returns ok and hands a 401 to the unauthorized callback, with nothing to say", async () => {
    const { writes } = buildWrites([reply.status(401, "Unauthorized")]);

    const outcome = await writes.createVacation(DRAFT);

    expect(outcome).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(pending.list()).toEqual([]);
    expect(storedVacations()).toEqual([]);
  });

  it("stores nothing when the store was closed while the write was in flight", async () => {
    const { writes } = buildWrites([reply.rows([createdRow()])]);
    const written = writes.createVacation(DRAFT);
    await store.lifecycle.closeStore();

    expect(await written).toEqual({ ok: true });
    expect(pending.list()).toEqual([]);
  });

  it("returns an unreachable failure when the request itself fails", async () => {
    const { writes } = buildWrites([reply.failure("Network request failed")]);

    expect(await writes.createVacation(DRAFT)).toEqual({
      ok: false,
      reason: "unreachable",
      message: null,
    });
    expect(pending.list()).toEqual([]);
  });

  it("pulls once after the server confirms the booking", async () => {
    const { writes } = buildWrites([reply.rows([createdRow()])]);

    await writes.createVacation(DRAFT);

    expect(pull.mock.calls).toEqual([["after-write"]]);
  });

  it("pulls after nothing when the server refused the booking", async () => {
    const { writes } = buildWrites([reply.status(422, "Selected day is not a working day")]);

    await writes.createVacation(DRAFT);

    expect(pull).not.toHaveBeenCalled();
  });

  it("keeps the rows it stored when the pull that follows fails", async () => {
    pull.mockResolvedValue({ ok: false, message: "The sync pull answered 500." });
    const { writes } = buildWrites([reply.rows([createdRow({ id: "vacation-1" })])]);

    const outcome = await writes.createVacation(DRAFT);
    await tick();

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([expect.objectContaining({ id: "vacation-1" })]);
  });
});

describe("updateVacation", () => {
  const EDIT = { ids: ["vacation-1"], halfDay: true, note: "Half a day after all" };

  it("returns ok and stores the rows the server answered with", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([
      reply.rows([createdRow({ id: "vacation-1", halfDay: true, note: "Half a day after all" })]),
    ]);

    const outcome = await writes.updateVacation(EDIT);

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([
      expect.objectContaining({
        id: "vacation-1",
        halfDay: true,
        note: "Half a day after all",
        organizationId: "org-1",
      }),
    ]);
    expect(pending.list()).toEqual([]);
  });

  it("sends the ids and the fields to the update endpoint as a patch", async () => {
    const { sync, writes } = buildWrites([reply.rows([createdRow()])]);

    await writes.updateVacation({ ids: ["vacation-1", "vacation-2"], vacationType: "HOME_OFFICE" });

    const [request] = sync.requests;
    expect(request.path).toBe(VACATION_PATH);
    expect(request.init.method).toBe("PATCH");
    expect(JSON.parse(request.init.body ?? "")).toEqual({
      ids: ["vacation-1", "vacation-2"],
      vacationType: "HOME_OFFICE",
    });
  });

  it("holds the rows it edits until the answer lands", async () => {
    const { writes } = buildWrites([reply.rows([createdRow()])]);

    const written = writes.updateVacation(EDIT);
    expect(pending.list()).toEqual([
      expect.objectContaining({
        kind: "update",
        vacationIds: ["vacation-1"],
        update: { halfDay: true, note: "Half a day after all" },
      }),
    ]);

    await written;
    expect(pending.list()).toEqual([]);
  });

  it("returns the server's message when a row is no longer editable", async () => {
    const { writes } = buildWrites([
      reply.status(409, "One or more records changed while editing — refresh and retry"),
    ]);

    expect(await writes.updateVacation(EDIT)).toEqual({
      ok: false,
      reason: "rejected",
      message: "One or more records changed while editing — refresh and retry",
    });
    expect(pending.list()).toEqual([]);
  });

  it("returns an unreachable failure when the server never answers", async () => {
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.updateVacation(EDIT);
    await tick();
    expect(pending.list()).toHaveLength(1);
    clock.advance(WRITE_TIMEOUT_MS);

    expect(await written).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(pending.list()).toEqual([]);
  });

  it("returns ok and hands a 401 to the unauthorized callback", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(401, "Unauthorized")]);

    expect(await writes.updateVacation(EDIT)).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(storedVacations()).toEqual([expect.objectContaining({ halfDay: false })]);
    expect(pending.list()).toEqual([]);
  });

  it("returns ok and sends nothing when it was given no ids", async () => {
    const { sync, writes } = buildWrites([]);

    expect(await writes.updateVacation({ ids: [], halfDay: true })).toEqual({ ok: true });
    expect(sync.requests).toEqual([]);
    expect(pending.list()).toEqual([]);
  });

  it("returns the validator's own message when it refuses the body", async () => {
    const { writes } = buildWrites([
      reply.statusWithBody(422, {
        error: "Invalid data",
        details: [{ message: "halfDay: `halfDay` is only valid for a single-day record" }],
      }),
    ]);

    expect(
      await writes.updateVacation({ ids: ["vacation-1", "vacation-2"], halfDay: true })
    ).toEqual({
      ok: false,
      reason: "rejected",
      message: "halfDay: `halfDay` is only valid for a single-day record",
    });
  });

  it("pulls once after the server confirms the edit", async () => {
    const { writes } = buildWrites([reply.rows([createdRow()])]);

    await writes.updateVacation(EDIT);

    expect(pull.mock.calls).toEqual([["after-write"]]);
  });
});

describe("approveVacations", () => {
  it("returns ok and writes the approval the answer carried no rows for", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation approved")]);

    const outcome = await writes.approveVacations(["vacation-1"]);

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([
      expect.objectContaining({ id: "vacation-1", approvedAt: NOW, approvedBy: "user-1" }),
    ]);
    expect(pending.list()).toEqual([]);
  });

  it("posts one id to the endpoint of that one row", async () => {
    const { sync, writes } = buildWrites([reply.decided("Vacation approved")]);

    await writes.approveVacations(["vacation-1"]);

    const [request] = sync.requests;
    expect(request.path).toBe(`${APPROVE_VACATION_PATH}/vacation-1`);
    expect(request.init.method).toBe("POST");
    expect(JSON.parse(request.init.body ?? "")).toEqual({});
  });

  it("posts several ids to the bulk endpoint in one body", async () => {
    storeVacations(
      store,
      vacationRow({ id: "vacation-1" }),
      vacationRow({ id: "vacation-2", requestedDay: "2026-09-22" })
    );
    const { sync, writes } = buildWrites([reply.decided("Vacations approved")]);

    await writes.approveVacations(["vacation-1", "vacation-2"]);

    const [request] = sync.requests;
    expect(request.path).toBe(APPROVE_VACATION_PATH);
    expect(JSON.parse(request.init.body ?? "")).toEqual({ ids: ["vacation-1", "vacation-2"] });
    expect(storedVacations().map((row) => row.status)).toEqual(["approved", "approved"]);
  });

  it("stamps the row it wrote with the generation the pull is on", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    store.write((transaction) => writeSyncState(transaction, { generation: 4 }));
    const { writes } = buildWrites([reply.decided("Vacation approved")]);

    await writes.approveVacations(["vacation-1"]);

    expect(generationOf("vacation-1")).toBe(4);
  });

  it("pulls once after the server confirms the approval", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation approved")]);

    await writes.approveVacations(["vacation-1"]);

    expect(pull.mock.calls).toEqual([["after-write"]]);
  });

  it("keeps the row the pull that follows sent over the one it wrote itself", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    pull.mockImplementation(() => {
      storeVacations(
        store,
        vacationRow({ id: "vacation-1", approvedAt: PULLED, approvedBy: "user-2" })
      );
      return Promise.resolve({ ok: true });
    });
    const { writes } = buildWrites([reply.decided("Vacation approved")]);

    await writes.approveVacations(["vacation-1"]);
    await tick();

    expect(storedVacations()).toEqual([
      expect.objectContaining({ approvedAt: PULLED, approvedBy: "user-2" }),
    ]);
  });

  it("keeps the row it wrote itself when the pull that follows fails", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    pull.mockResolvedValue({ ok: false, message: "The sync pull answered 500." });
    const { writes } = buildWrites([reply.decided("Vacation approved")]);

    await writes.approveVacations(["vacation-1"]);
    await tick();

    expect(storedVacations()).toEqual([
      expect.objectContaining({ approvedAt: NOW, approvedBy: "user-1", status: "approved" }),
    ]);
  });

  it("returns the server's message and writes nothing when the row was already decided", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(409, "Vacation already approved")]);

    expect(await writes.approveVacations(["vacation-1"])).toEqual({
      ok: false,
      reason: "rejected",
      message: "Vacation already approved",
    });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pending.list()).toEqual([]);
    expect(pull).not.toHaveBeenCalled();
  });

  it("returns an unreachable failure and writes nothing when the server never answers", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.approveVacations(["vacation-1"]);
    await tick();
    expect(pending.list()).toHaveLength(1);
    clock.advance(WRITE_TIMEOUT_MS);

    expect(await written).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pending.list()).toEqual([]);
  });

  it("returns ok and hands a 401 to the unauthorized callback, writing nothing", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(401, "Unauthorized")]);

    expect(await writes.approveVacations(["vacation-1"])).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pending.list()).toEqual([]);
  });
});

describe("rejectVacations", () => {
  it("returns ok and writes the rejection with the reason it carried", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation rejected")]);

    const outcome = await writes.rejectVacations(["vacation-1"], "Too many away that week");

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([
      expect.objectContaining({
        rejectedAt: NOW,
        rejectedBy: "user-1",
        rejectionReason: "Too many away that week",
        status: "rejected",
      }),
    ]);
  });

  it("posts one id and its reason to the endpoint of that one row", async () => {
    const { sync, writes } = buildWrites([reply.decided("Vacation rejected")]);

    await writes.rejectVacations(["vacation-1"], "Too many away that week");

    const [request] = sync.requests;
    expect(request.path).toBe(`${REJECT_VACATION_PATH}/vacation-1`);
    expect(JSON.parse(request.init.body ?? "")).toEqual({ reason: "Too many away that week" });
  });

  it("posts several ids and one reason to the bulk endpoint", async () => {
    storeVacations(
      store,
      vacationRow({ id: "vacation-1" }),
      vacationRow({ id: "vacation-2", requestedDay: "2026-09-22" })
    );
    const { sync, writes } = buildWrites([reply.decided("Vacations rejected")]);

    await writes.rejectVacations(["vacation-1", "vacation-2"], "Understaffed");

    const [request] = sync.requests;
    expect(request.path).toBe(REJECT_VACATION_PATH);
    expect(JSON.parse(request.init.body ?? "")).toEqual({
      ids: ["vacation-1", "vacation-2"],
      reason: "Understaffed",
    });
    expect(storedVacations().map((row) => row.status)).toEqual(["rejected", "rejected"]);
  });

  it("returns ok and writes no reason where the caller gave none", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation rejected")]);

    await writes.rejectVacations(["vacation-1"]);

    expect(storedVacations()).toEqual([
      expect.objectContaining({ rejectionReason: null, status: "rejected" }),
    ]);
  });

  it("returns the server's message and writes nothing when the row was already decided", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(409, "Vacation already rejected")]);

    expect(await writes.rejectVacations(["vacation-1"], "Understaffed")).toEqual({
      ok: false,
      reason: "rejected",
      message: "Vacation already rejected",
    });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
  });

  it("returns an unreachable failure and writes nothing when the server never answers", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.rejectVacations(["vacation-1"]);
    await tick();
    clock.advance(WRITE_TIMEOUT_MS);

    expect(await written).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pending.list()).toEqual([]);
  });

  it("returns ok and hands a 401 to the unauthorized callback, writing nothing", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(401, "Unauthorized")]);

    expect(await writes.rejectVacations(["vacation-1"])).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
  });
});

describe("cancelVacations", () => {
  it("returns ok and writes the cancellation the answer carried no rows for", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation cancelled")]);

    const outcome = await writes.cancelVacations(["vacation-1"]);

    expect(outcome).toEqual({ ok: true });
    expect(storedVacations()).toEqual([
      expect.objectContaining({
        deletedAt: NOW,
        deletedByUserId: "user-1",
        status: "cancelled",
      }),
    ]);
    expect(pending.list()).toEqual([]);
  });

  it("deletes one id at the endpoint of that one row, with its reason", async () => {
    const { sync, writes } = buildWrites([reply.decided("Vacation cancelled")]);

    await writes.cancelVacations(["vacation-1"], "Plans changed");

    const [request] = sync.requests;
    expect(request.path).toBe(`${VACATION_PATH}/vacation-1`);
    expect(request.init.method).toBe("DELETE");
    expect(JSON.parse(request.init.body ?? "")).toEqual({ reason: "Plans changed" });
  });

  it("posts several ids to the bulk endpoint in one body", async () => {
    storeVacations(
      store,
      vacationRow({ id: "vacation-1" }),
      vacationRow({ id: "vacation-2", requestedDay: "2026-09-22" })
    );
    const { sync, writes } = buildWrites([reply.decided("Vacations cancelled")]);

    await writes.cancelVacations(["vacation-1", "vacation-2"], "Plans changed");

    const [request] = sync.requests;
    expect(request.path).toBe(CANCEL_VACATION_PATH);
    expect(request.init.method).toBe("POST");
    expect(JSON.parse(request.init.body ?? "")).toEqual({
      ids: ["vacation-1", "vacation-2"],
      reason: "Plans changed",
    });
    expect(storedVacations().map((row) => row.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("pulls once after the server confirms the cancellation", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.decided("Vacation cancelled")]);

    await writes.cancelVacations(["vacation-1"]);

    expect(pull.mock.calls).toEqual([["after-write"]]);
  });

  it("returns the server's message and writes nothing when the row was already cancelled", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(409, "Vacation already cancelled")]);

    expect(await writes.cancelVacations(["vacation-1"])).toEqual({
      ok: false,
      reason: "rejected",
      message: "Vacation already cancelled",
    });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pull).not.toHaveBeenCalled();
  });

  it("returns an unreachable failure and writes nothing when the server never answers", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.hang()]);

    const written = writes.cancelVacations(["vacation-1"]);
    await tick();
    clock.advance(WRITE_TIMEOUT_MS);

    expect(await written).toEqual({ ok: false, reason: "unreachable", message: null });
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
    expect(pending.list()).toEqual([]);
  });

  it("returns ok and hands a 401 to the unauthorized callback, writing nothing", async () => {
    storeVacations(store, vacationRow({ id: "vacation-1" }));
    const { writes } = buildWrites([reply.status(401, "Unauthorized")]);

    expect(await writes.cancelVacations(["vacation-1"])).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(storedVacations()).toEqual([expect.objectContaining({ status: "pending" })]);
  });

  it("returns ok and sends nothing when it was given no ids", async () => {
    const { sync, writes } = buildWrites([]);

    expect(await writes.cancelVacations([])).toEqual({ ok: true });
    expect(sync.requests).toEqual([]);
    expect(pending.list()).toEqual([]);
    expect(pull).not.toHaveBeenCalled();
  });

  it("writes nothing for an id the store has never pulled", async () => {
    const { writes } = buildWrites([reply.decided("Vacation cancelled")]);

    expect(await writes.cancelVacations(["vacation-404"])).toEqual({ ok: true });
    expect(storedVacations()).toEqual([]);
  });
});
