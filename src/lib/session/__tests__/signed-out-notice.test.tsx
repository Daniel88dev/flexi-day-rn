import { act, renderHook } from "@testing-library/react-native";

import {
  clearSignedOutNotice,
  showSignedOutNotice,
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
  });
});

describe("clearSignedOutNotice", () => {
  it("takes the notice away, as the next sign-in does", () => {
    showSignedOutNotice();

    clearSignedOutNotice();

    expect(signedOutNoticeShowing()).toBe(false);
  });
});

describe("useSignedOutNotice", () => {
  it("returns nothing on a phone that was never signed out", async () => {
    const { result } = await renderHook(() => useSignedOutNotice());

    expect(result.current).toBe(false);
  });

  it("returns the notice a wipe sets while the screen is up", async () => {
    const { result } = await renderHook(() => useSignedOutNotice());

    await act(async () => showSignedOutNotice());

    expect(result.current).toBe(true);
  });

  it("drops the notice again once a sign-in answers it", async () => {
    showSignedOutNotice();
    const { result } = await renderHook(() => useSignedOutNotice());

    await act(async () => clearSignedOutNotice());

    expect(result.current).toBe(false);
  });
});
