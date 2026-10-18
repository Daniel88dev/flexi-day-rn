import { LEAVE_CLASSES } from "@/components/ui/leave-classes";

describe("LEAVE_CLASSES", () => {
  it("returns classes for a teammate's Away that are not Sick's", () => {
    const away = LEAVE_CLASSES.AWAY;

    expect(away).toEqual({
      fill: expect.stringMatching(/^bg-/),
      text: expect.stringMatching(/^text-/),
      border: expect.stringMatching(/^border-/),
    });
    expect(away.fill).not.toBe(LEAVE_CLASSES.SICK.fill);
  });
});
