import { shownList, snapshot, tabReadState } from "@/lib/groups/read-state";

const loaded = (dataUpdatedAt: number, isError = false) => ({
  data: [],
  isError,
  dataUpdatedAt,
});
const pending = { data: undefined, isError: false, dataUpdatedAt: 0 };
const neverLoaded = { data: undefined, isError: true, dataUpdatedAt: 0 };

describe("tabReadState", () => {
  it("returns ready with nothing stale when every read answered", () => {
    expect(tabReadState([loaded(1000), loaded(2000)])).toEqual({ kind: "ready", staleSince: null });
  });

  it("returns loading while a read has not answered yet", () => {
    expect(tabReadState([loaded(1000), pending])).toEqual({ kind: "loading" });
  });

  it("returns failed when a read never loaded and failed, even beside one still loading", () => {
    expect(tabReadState([pending, neverLoaded])).toEqual({ kind: "failed" });
  });

  it("returns the kept data stale since the oldest failed read's answer", () => {
    expect(tabReadState([loaded(3000, true), loaded(2000), loaded(1500, true)])).toEqual({
      kind: "ready",
      staleSince: 1500,
    });
  });
});

describe("shownList", () => {
  const rows = (dataUpdatedAt: number, isError = false) => ({
    data: ["a", "b"],
    isError,
    dataUpdatedAt,
  });

  it("returns nothing before the read first answers", () => {
    expect(shownList(pending)).toBeNull();
  });

  it("returns nothing when the first read failed", () => {
    expect(shownList(neverLoaded)).toBeNull();
  });

  it("returns nothing for an empty answer, failed refetch or not", () => {
    expect(shownList(loaded(1000))).toBeNull();
    expect(shownList(loaded(1000, true))).toBeNull();
  });

  it("returns the rows with nothing stale while the last read answered", () => {
    expect(shownList(rows(1000))).toEqual({ items: ["a", "b"], staleSince: null });
  });

  it("returns the kept rows stale since their answer after a failed refetch", () => {
    expect(shownList(rows(1000, true))).toEqual({ items: ["a", "b"], staleSince: 1000 });
  });
});

describe("snapshot", () => {
  it("returns only the data, the error flag and when the data was read", () => {
    const read = { data: [1], isError: true, dataUpdatedAt: 1000, refetch: () => undefined };
    expect(snapshot(read)).toEqual({ data: [1], isError: true, dataUpdatedAt: 1000 });
  });
});
