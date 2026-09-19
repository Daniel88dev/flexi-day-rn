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
import { groupRow, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { createStoreWrites, CREATE_VACATION_PATH, WRITE_TIMEOUT_MS } from "../writes";

const NOW = "2026-09-19T12:00:00.000Z";

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
