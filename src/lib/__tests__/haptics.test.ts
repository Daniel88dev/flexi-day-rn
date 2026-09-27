import * as Haptics from "expo-haptics";

import { haptic } from "@/lib/haptics";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

beforeEach(() => jest.clearAllMocks());

describe("haptic", () => {
  it("returns after a medium impact for a clock or break tap", () => {
    haptic("tap");
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("returns after the selection feedback for Got it", () => {
    haptic("selection");
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it.each(["success", "warning", "error"] as const)(
    "returns after the %s notification feedback",
    (kind) => {
      haptic(kind);
      expect(Haptics.notificationAsync).toHaveBeenCalledWith(kind);
    }
  );

  it("returns quietly when the device refuses", async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));
    expect(() => haptic("tap")).not.toThrow();
    await Promise.resolve();
  });
});
