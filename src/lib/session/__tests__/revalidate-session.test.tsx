import { act, renderHook } from "@testing-library/react-native";

import { createFakeAppState, type FakeAppState } from "@/test-support/fake-app-state";
import {
  revalidateSession,
  useSessionRevalidation,
  type SessionLookup,
} from "@/lib/session/revalidate-session";
import { SESSION } from "@/test-support/session";

jest.mock("@/lib/session/auth-client", () => ({ authClient: { getSession: jest.fn() } }));

let wipe: jest.Mock;
let error: jest.SpyInstance;

beforeEach(() => {
  wipe = jest.fn().mockResolvedValue(undefined);
  error = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

function answering(answer: unknown): SessionLookup {
  return jest.fn().mockResolvedValue(answer);
}

describe("revalidateSession", () => {
  it("leaves the phone signed in while the server still knows the session", async () => {
    await revalidateSession(answering(SESSION), wipe);

    expect(wipe).not.toHaveBeenCalled();
  });

  it("wipes when the server answers with no session at all", async () => {
    await revalidateSession(answering({ data: null, error: null }), wipe);

    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it("wipes when the server no longer recognises this phone", async () => {
    const mismatch = { data: null, error: { status: 401, code: "SESSION_DEVICE_MISMATCH" } };

    await revalidateSession(answering(mismatch), wipe);

    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it("leaves the phone signed in when the server itself is broken", async () => {
    await revalidateSession(answering({ data: null, error: { status: 500 } }), wipe);

    expect(wipe).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it("leaves the phone signed in when the server could not be reached", async () => {
    const unreachable = jest.fn().mockRejectedValue(new Error("network down"));

    await revalidateSession(unreachable, wipe);

    expect(wipe).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe("useSessionRevalidation", () => {
  let appState: FakeAppState;

  beforeEach(() => {
    appState = createFakeAppState();
  });

  function watch(lookup: SessionLookup, enabled = true) {
    return renderHook(() => useSessionRevalidation(wipe, { lookup, appState, enabled }));
  }

  it("looks the session up on a cold start, while the phone renders what it cached", async () => {
    const lookup = answering(SESSION);

    await watch(lookup);

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("looks it up again on the foreground event the sync pull runs on, beside it", async () => {
    // Nothing answers this lookup, so a pull serialised after it would never run.
    const hanging = jest.fn(() => new Promise<{ data?: unknown }>(() => {}));
    const syncPull = jest.fn();
    appState.subscribe(syncPull);
    await watch(hanging);

    appState.becomeActive();

    expect(hanging).toHaveBeenCalledTimes(2);
    expect(syncPull).toHaveBeenCalledTimes(1);
  });

  it("wipes the phone when the foreground lookup finds the session gone", async () => {
    const lookup = jest
      .fn()
      .mockResolvedValueOnce(SESSION)
      .mockResolvedValue({ data: null, error: null });
    await watch(lookup);
    expect(wipe).not.toHaveBeenCalled();

    appState.becomeActive();
    await Promise.resolve();

    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it("looks nothing up for a visitor the guard is sending to welcome", async () => {
    const lookup = answering(SESSION);

    await watch(lookup, false);
    appState.becomeActive();

    expect(lookup).not.toHaveBeenCalled();
    expect(appState.listening()).toBe(false);
  });

  it("stops looking once the shell is gone", async () => {
    const { unmount } = await watch(answering(SESSION));

    await act(async () => unmount());

    expect(appState.listening()).toBe(false);
  });
});
