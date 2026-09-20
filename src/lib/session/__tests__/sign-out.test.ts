import { signOut } from "@/lib/session/sign-out";

jest.mock("@/lib/session/auth-client", () => ({ authClient: { signOut: jest.fn() } }));

let wipe: jest.Mock;
let error: jest.SpyInstance;

beforeEach(() => {
  wipe = jest.fn().mockResolvedValue(undefined);
  error = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  error.mockRestore();
});

describe("signOut", () => {
  it("ends the session on the server before wiping the phone", async () => {
    const calls: string[] = [];
    const endSession = jest.fn(async () => {
      calls.push("server");
      return {};
    });
    wipe.mockImplementation(async () => {
      calls.push("wipe");
    });

    await signOut(wipe, endSession);

    expect(calls).toEqual(["server", "wipe"]);
    expect(error).not.toHaveBeenCalled();
  });

  it("wipes the phone anyway when the server refuses, saying so in the log", async () => {
    const endSession = jest.fn().mockResolvedValue({ error: { message: "no session" } });

    await signOut(wipe, endSession);

    expect(wipe).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });

  it("wipes the phone anyway when the request never arrives, saying so in the log", async () => {
    const endSession = jest.fn().mockRejectedValue(new Error("network down"));

    await signOut(wipe, endSession);

    expect(wipe).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
  });
});
