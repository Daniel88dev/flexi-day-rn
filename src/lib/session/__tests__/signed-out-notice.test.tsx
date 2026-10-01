import { act, renderHook } from "@testing-library/react-native";

import {
  clearSignedOutNotice,
  showSignedOutNotice,
  signedOutNotice,
  signedOutNoticeShowing,
  useSignedOutNotice,
} from "@/lib/session/signed-out-notice";

beforeEach(() => {
  clearSignedOutNotice();
});

describe("showSignedOutNotice", () => {
  it("leaves the notice for welcome to show", () => {
    showSignedOutNotice();

    expect(signedOutNoticeShowing()).toBe(true);
    expect(signedOutNotice()).toBe("signed-out");
  });

  it("leaves the account-deleted notice when the account is gone", () => {
    showSignedOutNotice("account-deleted");

    expect(signedOutNotice()).toBe("account-deleted");
  });

  it("keeps the account-deleted notice when a later wipe only says signed out", () => {
    showSignedOutNotice("account-deleted");

    showSignedOutNotice();

    expect(signedOutNotice()).toBe("account-deleted");
  });
});

describe("clearSignedOutNotice", () => {
  it("takes the notice away, as the next sign-in does", () => {
    showSignedOutNotice("account-deleted");

    clearSignedOutNotice();

    expect(signedOutNoticeShowing()).toBe(false);
    expect(signedOutNotice()).toBeNull();
  });
});

describe("useSignedOutNotice", () => {
  it("returns nothing on a phone that was never signed out", async () => {
    const { result } = await renderHook(() => useSignedOutNotice());

    expect(result.current).toBeNull();
  });

  it("returns the notice a wipe sets while the screen is up", async () => {
    const { result } = await renderHook(() => useSignedOutNotice());

    await act(async () => showSignedOutNotice());

    expect(result.current).toBe("signed-out");
  });

  it("returns the account-deleted notice a deletion sets", async () => {
    const { result } = await renderHook(() => useSignedOutNotice());

    await act(async () => showSignedOutNotice("account-deleted"));

    expect(result.current).toBe("account-deleted");
  });

  it("drops the notice again once a sign-in answers it", async () => {
    showSignedOutNotice();
    const { result } = await renderHook(() => useSignedOutNotice());

    await act(async () => clearSignedOutNotice());

    expect(result.current).toBeNull();
  });
});
