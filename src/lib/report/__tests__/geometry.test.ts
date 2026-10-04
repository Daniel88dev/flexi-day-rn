import { roundedRightRect } from "../geometry";

describe("roundedRightRect", () => {
  it("returns a path square on the left and rounded on the right", () => {
    expect(roundedRightRect(10, 0, 40, 6, 3)).toBe(
      "M10,0 L47,0 Q50,0 50,3 L50,3 Q50,6 47,6 L10,6 Z"
    );
  });

  it("returns a radius no larger than half the height or the whole width", () => {
    expect(roundedRightRect(0, 0, 2, 6, 3)).toBe("M0,0 L0,0 Q2,0 2,2 L2,4 Q2,6 0,6 L0,6 Z");
  });
});
