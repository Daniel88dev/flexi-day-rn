import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { apiRequest } from "@/lib/query";

import type { LocationDevice, Reading } from "../location-capture";
import { phoneLocation } from "../location-device";
import { useClockLocation } from "../use-clock-location";

jest.mock("@/lib/query", () => ({ apiRequest: jest.fn() }));
jest.mock("../location-device", () => ({
  phoneLocation: {
    servicesEnabled: jest.fn(),
    requestPermission: jest.fn(),
    lastKnown: jest.fn(),
    current: jest.fn(),
  },
  onLeavingApp: () => () => {},
}));

const device = jest.mocked(phoneLocation) as jest.Mocked<LocationDevice>;
const request = jest.mocked(apiRequest);
const at = (accuracy: number): Reading => ({ latitude: 50.0875, longitude: 14.4213, accuracy });

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const flush = () => act(async () => {});

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  client = new QueryClient();
  device.servicesEnabled.mockResolvedValue(true);
  device.requestPermission.mockResolvedValue({ granted: true, reduced: false });
  device.lastKnown.mockResolvedValue(null);
  device.current.mockImplementation(async (accuracy) => at(accuracy === "highest" ? 6 : 65));
  request.mockImplementation(async (_path, options) => ({
    applied: true,
    accuracy: (options?.body as { accuracy: number }).accuracy,
  }));
});

describe("useClockLocation", () => {
  it("returns the clock-out location once both fixes reach the session", async () => {
    const { result } = await renderHook(() => useClockLocation(), { wrapper });

    await act(async () => result.current.capture("OUT", "session-9"));
    await flush();

    expect(result.current.status).toEqual({ kind: "saved", end: "OUT", accuracy: 6 });
    expect(request.mock.calls.map(([path, options]) => [path, options?.body])).toEqual([
      ["/api/attendance/sessions/session-9/location", { end: "OUT", ...at(65) }],
      ["/api/attendance/sessions/session-9/location", { end: "OUT", ...at(6) }],
    ]);
  });

  it("follows the latest capture while an earlier one still sends its fixes", async () => {
    let firstPermission: (answer: { granted: boolean; reduced: boolean }) => void = () => {};
    device.requestPermission.mockReturnValueOnce(
      new Promise((resolve) => (firstPermission = resolve))
    );
    device.current.mockImplementation(async (accuracy) =>
      accuracy === "highest" ? new Promise<Reading>(() => {}) : at(65)
    );
    const { result } = await renderHook(() => useClockLocation(), { wrapper });

    await act(async () => result.current.capture("IN", "first"));
    await act(async () => result.current.capture("OUT", "second"));
    await flush();
    expect(result.current.status).toEqual({ kind: "sharpening", accuracy: 65 });

    firstPermission({ granted: true, reduced: false });
    await flush();

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/api/attendance/sessions/second/location",
      "/api/attendance/sessions/first/location",
    ]);
    expect(result.current.status).toEqual({ kind: "sharpening", accuracy: 65 });
  });

  it("reads the attendance state and day again once the capture is over", async () => {
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useClockLocation(), { wrapper });

    await act(async () => result.current.capture("IN", "session-9"));
    await flush();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["attendance-state"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["attendance-day"] });
  });

  it("does not read again before the capture is over", async () => {
    device.current.mockImplementation(() => new Promise<Reading>(() => {}));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useClockLocation(), { wrapper });

    await act(async () => result.current.capture("IN", "session-9"));
    await flush();

    expect(result.current.status).toEqual({ kind: "finding" });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
