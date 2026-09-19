import { act, renderHook } from "@testing-library/react-native";
import { eq } from "drizzle-orm";

import type { StoreDatabase } from "../adapter";
import { applyPage } from "../apply";
import { selectVacations, VACATION_TABLES } from "../queries";
import type { StoreRuntime } from "../runtime";
import { vacations } from "../schema";
import { bankHolidayRow, syncPage, vacationRow } from "../test-support/sync-fixtures";
import { openTestStore } from "../test-support/test-store";
import { useStoreQuery } from "../use-store-query";

type VacationQuery = (database: StoreDatabase) => unknown;

let store: StoreRuntime;

beforeEach(async () => {
  store = await openTestStore();
});

afterEach(async () => {
  await store.lifecycle.closeStore();
});

function applyPageToStore(page: Parameters<typeof applyPage>[1]) {
  store.write((transaction) => applyPage(transaction, page, 1));
}

async function applyInTest(page: Parameters<typeof applyPage>[1]) {
  await act(async () => {
    applyPageToStore(page);
  });
}

function buildVacations() {
  return jest.fn<unknown, [StoreDatabase]>((database) => selectVacations(database).all());
}

function renderVacations(build: VacationQuery) {
  return renderHook(() => useStoreQuery(build, VACATION_TABLES));
}

describe("useStoreQuery", () => {
  it("returns the rows the query builds", async () => {
    await applyInTest(syncPage({ vacations: [vacationRow()] }));

    const { result } = await renderVacations(buildVacations());

    expect(result.current).toEqual([expect.objectContaining({ id: "vacation-1" })]);
  });

  it("re-runs after a page touches a subscribed table", async () => {
    const build = buildVacations();
    const { result } = await renderVacations(build);
    const reads = build.mock.calls.length;
    expect(result.current).toEqual([]);

    await applyInTest(syncPage({ vacations: [vacationRow()] }));

    expect(result.current).toEqual([expect.objectContaining({ id: "vacation-1" })]);
    expect(build).toHaveBeenCalledTimes(reads + 1);
  });

  it("stays put after a page that touches no subscribed table", async () => {
    const build = buildVacations();
    const { result } = await renderVacations(build);
    const reads = build.mock.calls.length;
    const first = result.current;

    await applyInTest(syncPage({ bankHolidays: [bankHolidayRow()] }));

    expect(result.current).toBe(first);
    expect(build).toHaveBeenCalledTimes(reads);
  });

  it("returns the rows of a page that committed before it subscribed", async () => {
    let applied = false;
    const build = jest.fn<unknown, [StoreDatabase]>((database) => {
      const rows = selectVacations(database).all();
      if (!applied) {
        applied = true;
        applyPageToStore(syncPage({ vacations: [vacationRow()] }));
      }
      return rows;
    });

    const { result } = await renderVacations(build);

    expect(build.mock.results[0].value).toEqual([]);
    expect(result.current).toEqual([expect.objectContaining({ id: "vacation-1" })]);
  });

  it("subscribes once when the caller passes a new table list on every render", async () => {
    const subscribe = jest.spyOn(store.events, "subscribe");
    const build = buildVacations();

    const { rerender } = await renderHook(() => useStoreQuery(build, ["vacations"]));
    await rerender({});
    await rerender({});

    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it("re-reads when the query it was given changes", async () => {
    await applyInTest(syncPage({ vacations: [vacationRow(), vacationRow({ id: "vacation-2" })] }));
    const everything: VacationQuery = (database) => selectVacations(database).all();
    const onlyTheSecond: VacationQuery = (database) =>
      selectVacations(database).where(eq(vacations.id, "vacation-2")).all();

    const { result, rerender } = await renderHook(
      ({ build }: { build: VacationQuery }) => useStoreQuery(build, VACATION_TABLES),
      { initialProps: { build: everything } }
    );
    expect(result.current).toHaveLength(2);

    await rerender({ build: onlyTheSecond });

    expect(result.current).toEqual([expect.objectContaining({ id: "vacation-2" })]);
  });

  it("stops reading the store after it unmounts", async () => {
    const build = buildVacations();
    const { unmount } = await renderVacations(build);
    const reads = build.mock.calls.length;

    await unmount();
    await applyInTest(syncPage({ vacations: [vacationRow()] }));

    expect(build).toHaveBeenCalledTimes(reads);
  });
});
