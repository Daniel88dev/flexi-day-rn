import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { rereadAfterSelfService, rereadAttendance } from "@/lib/query/attendance";
import { qk } from "@/lib/query/keys";

function clientWith(read: jest.Mock) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const observer = new QueryObserver(client, { queryKey: qk.attendanceState(), queryFn: read });
  const unsubscribe = observer.subscribe(() => undefined);
  return { client, unsubscribe };
}

describe("rereadAttendance", () => {
  it("returns arrived once the clock's read has answered again, holding the new answer", async () => {
    const read = jest.fn().mockResolvedValueOnce({ open: false }).mockResolvedValue({ open: true });
    const { client, unsubscribe } = clientWith(read);
    await client.fetchQuery({ queryKey: qk.attendanceState(), queryFn: read });

    await expect(rereadAttendance(client)).resolves.toEqual({ arrived: true });

    expect(client.getQueryData(qk.attendanceState())).toEqual({ open: true });
    unsubscribe();
  });

  it("returns the re-read's failure when it got no answer", async () => {
    const offline = new TypeError("Network request failed");
    const read = jest.fn().mockResolvedValueOnce({ open: false }).mockRejectedValue(offline);
    const { client, unsubscribe } = clientWith(read);
    await client.fetchQuery({ queryKey: qk.attendanceState(), queryFn: read });

    await expect(rereadAttendance(client)).resolves.toEqual({ arrived: false, error: offline });
    unsubscribe();
  });

  it("returns with My attendance's month and day reads marked stale", async () => {
    const { client, unsubscribe } = clientWith(jest.fn().mockResolvedValue({}));
    const month = qk.attendanceMonth(2026, 9);
    const day = qk.attendanceDay({ organizationId: "org-1", businessDate: "2026-09-27" });
    client.setQueryData(month, {});
    client.setQueryData(day, {});

    await rereadAttendance(client);

    expect(client.getQueryState(month)?.isInvalidated).toBe(true);
    expect(client.getQueryState(day)?.isInvalidated).toBe(true);
    unsubscribe();
  });
});

describe("rereadAfterSelfService", () => {
  it("returns once /current has answered again, with the day, month and events marked stale", async () => {
    const read = jest.fn().mockResolvedValueOnce({ open: false }).mockResolvedValue({ open: true });
    const { client, unsubscribe } = clientWith(read);
    await client.fetchQuery({ queryKey: qk.attendanceState(), queryFn: read });
    const month = qk.attendanceMonth(2026, 9, "org-1");
    const day = qk.attendanceDay({ organizationId: "org-1", businessDate: "2026-09-24" });
    const events = qk.attendanceEvents("s1");
    for (const key of [month, day, events]) client.setQueryData(key, {});

    await expect(rereadAfterSelfService(client)).resolves.toEqual({ arrived: true });

    expect(client.getQueryData(qk.attendanceState())).toEqual({ open: true });
    for (const key of [month, day, events]) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    }
    unsubscribe();
  });
});
