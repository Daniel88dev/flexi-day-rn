import { act, renderHook } from "@testing-library/react-native";
import { useCallback } from "react";

import { en } from "@/i18n/en";

import type { StoreDatabase } from "../adapter";
import { applyPage } from "../apply";
import type { StoreFetch, StoreResponse } from "../fetch";
import { activePendingChanges, type PendingChanges, type VacationDraft } from "../pending";
import { mergedVacations, MERGED_VACATION_CHANNELS, type MergedVacation } from "../queries";
import type { StoreRuntime } from "../runtime";
import { createFakeClock, type FakeClock } from "../test-support/fake-clock";
import { createFakeSync, reply } from "../test-support/fake-sync";
import { tick } from "../test-support/pull-harness";
import { groupRow, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { flushStoreEvents, openTestStore } from "../test-support/test-store";
import { usePendingChanges } from "../use-pending-changes";
import { useStoreQuery } from "../use-store-query";
import {
  createStoreWrites,
  WRITE_TIMEOUT_MS,
  type StoreWrites,
  type WriteOutcome,
} from "../writes";

const NOW = "2026-09-19T12:00:00.000Z";

const DRAFT: VacationDraft = { groupId: "group-1", from: "2026-09-21", to: "2026-09-22" };

const CREATED = [
  (({ organizationId, ...row }) => row)(vacationRow({ id: "vacation-1" })),
  (({ organizationId, ...row }) => row)(
    vacationRow({ id: "vacation-2", requestedDay: "2026-09-22" })
  ),
];

let clock: FakeClock;
let store: StoreRuntime;
let pending: PendingChanges;

beforeEach(async () => {
  clock = createFakeClock(NOW);
  store = await openTestStore("user-1", { clock });
  pending = activePendingChanges();
  store.write((transaction) => applyPage(transaction, syncPage({ groups: [groupRow()] }), 1));
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

/** A backend that answers when the test says so, which is what shows a render in between. */
function deferredBackend() {
  let answer!: (response: StoreResponse) => void;
  const apiFetch: StoreFetch = () => new Promise<StoreResponse>((resolve) => (answer = resolve));

  return {
    writes: buildWrites(apiFetch),
    respond(status: number, body: unknown) {
      answer({ status, json: () => Promise.resolve(body) });
    },
  };
}

function buildWrites(apiFetch: StoreFetch): StoreWrites {
  return createStoreWrites({
    runtime: store,
    apiFetch,
    clock,
    pending,
    pull: () => Promise.resolve({ ok: true }),
    onUnauthorized: jest.fn(),
  });
}

/** What a screen will do: the overlay and the store's rows read as one list. */
function useBookings(): MergedVacation[] {
  const changes = usePendingChanges();
  const build = useCallback((db: StoreDatabase) => mergedVacations(db, changes), [changes]);
  return useStoreQuery(build, MERGED_VACATION_CHANNELS);
}

async function renderBookings() {
  const renders: MergedVacation[][] = [];
  const hook = await renderHook(() => {
    const rows = useBookings();
    renders.push(rows);
    return rows;
  });
  return { ...hook, renders };
}

function idsOf(rows: MergedVacation[]): string[] {
  return rows.map((row) => row.id);
}

describe("usePendingChanges", () => {
  it("returns the changes in flight as they are added", async () => {
    const { result } = await renderHook(() => usePendingChanges());
    expect(result.current).toEqual([]);

    let change;
    await act(async () => {
      change = pending.add({ kind: "create", draft: DRAFT });
      await flushStoreEvents();
    });

    expect(result.current).toEqual([change]);
  });

  it("returns the changes left after one is removed", async () => {
    const { result } = await renderHook(() => usePendingChanges());
    let change!: { id: string };
    await act(async () => {
      change = pending.add({ kind: "create", draft: DRAFT });
      await flushStoreEvents();
    });

    await act(async () => {
      pending.remove(change.id);
      await flushStoreEvents();
    });

    expect(result.current).toEqual([]);
  });
});

describe("createVacation", () => {
  it("shows a row for every working day of the range while the server decides", async () => {
    const { result } = await renderBookings();
    const backend = deferredBackend();

    await act(async () => {
      void backend.writes.createVacation(DRAFT);
      await flushStoreEvents();
    });

    expect(result.current).toEqual([
      expect.objectContaining({ requestedDay: "2026-09-21", pending: true }),
      expect.objectContaining({ requestedDay: "2026-09-22", pending: true }),
    ]);
  });

  it("replaces the shown rows with the server's own without a render in between", async () => {
    const { result, renders } = await renderBookings();
    const backend = deferredBackend();
    let written!: Promise<WriteOutcome>;

    await act(async () => {
      written = backend.writes.createVacation(DRAFT);
      await flushStoreEvents();
    });
    expect(result.current.every((row) => row.pending)).toBe(true);
    const shown = renders.length;

    await act(async () => {
      backend.respond(201, CREATED);
      await written;
    });

    expect(renders.slice(shown).map((rows) => rows.length)).toEqual([2]);
    expect(idsOf(result.current)).toEqual(["vacation-1", "vacation-2"]);
    expect(result.current.every((row) => !row.pending && !row.actionsDisabled)).toBe(true);
  });

  it("takes the shown rows away when the server does not answer in time", async () => {
    const { result } = await renderBookings();
    const sync = createFakeSync([reply.hang()]);
    const writes = buildWrites(sync.apiFetch);
    let written!: Promise<WriteOutcome>;

    await act(async () => {
      written = writes.createVacation(DRAFT);
      await flushStoreEvents();
    });
    expect(result.current).toHaveLength(2);

    let outcome!: WriteOutcome;
    await act(async () => {
      clock.advance(WRITE_TIMEOUT_MS);
      outcome = await written;
      await tick();
    });

    expect(result.current).toEqual([]);
    expect(outcome.ok === false && outcome.reason).toBe("unreachable");
    expect(outcome.ok === false && (outcome.message ?? en.sync.unreachable)).toBe(
      "Couldn't reach the server. Try again."
    );
  });

  it("takes the shown rows away and carries the server's own words when it refuses", async () => {
    const { result } = await renderBookings();
    const backend = deferredBackend();
    let written!: Promise<WriteOutcome>;

    await act(async () => {
      written = backend.writes.createVacation(DRAFT);
      await flushStoreEvents();
    });
    expect(result.current).toHaveLength(2);

    let outcome!: WriteOutcome;
    await act(async () => {
      backend.respond(422, { errors: [{ message: "Booking would exceed the allowance" }] });
      outcome = await written;
      await tick();
    });

    expect(result.current).toEqual([]);
    expect(outcome).toEqual({
      ok: false,
      reason: "rejected",
      message: "Booking would exceed the allowance",
    });
  });
});
