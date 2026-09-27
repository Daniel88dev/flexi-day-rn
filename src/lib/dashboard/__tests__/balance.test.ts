import { balanceRows } from "../balance";

describe("balanceRows", () => {
  it("returns only the allowances with days allocated, in the order they came", () => {
    const rows = balanceRows([
      { type: "VACATION", allocated: 25, used: 10, pending: 2 },
      { type: "HOME_OFFICE", allocated: 0, used: 0, pending: 0 },
      { type: "SICK_DAY", allocated: 5, used: 1, pending: 0 },
      { type: "SICK", allocated: 0, used: 3, pending: 0 },
    ]);

    expect(rows.map((row) => row.type)).toEqual(["VACATION", "SICK_DAY"]);
  });

  it("returns the days left and the share used", () => {
    expect(balanceRows([{ type: "VACATION", allocated: 25, used: 10, pending: 2 }])).toEqual([
      { type: "VACATION", allocated: 25, used: 10, pending: 2, left: 15, share: 0.4 },
    ]);
  });

  it("returns an overdraft as negative days left, with the bar full", () => {
    expect(balanceRows([{ type: "VACATION", allocated: 4, used: 5.5, pending: 0 }])).toEqual([
      { type: "VACATION", allocated: 4, used: 5.5, pending: 0, left: -1.5, share: 1 },
    ]);
  });
});
