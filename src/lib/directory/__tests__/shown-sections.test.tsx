import { act, renderHook } from "@testing-library/react-native";

import { useShownSections } from "@/lib/directory/shown-sections";
import { ApiError } from "@/lib/query/failure";
import { directoryProfile } from "@/test-support/directory";

const mockApiRequest = jest.fn();
const mockBlurs = new Set<() => void>();

jest.mock("@/lib/query", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  classifyFailure: jest.requireActual("@/lib/query/failure").classifyFailure,
}));

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => {
        const cleanup = effect();
        if (!cleanup) return undefined;
        mockBlurs.add(cleanup);
        return () => {
          mockBlurs.delete(cleanup);
          cleanup();
        };
      }, [effect]),
  };
});

const blur = () => {
  for (const cleanup of [...mockBlurs]) cleanup();
};

const CONTACT = {
  section: "CONTACT",
  level: "READ",
  recorded: true,
  privatePhone: null,
  privateEmail: "ada@home.test",
  emergencyContact1: null,
  emergencyContact2: null,
};

const someoneElse = directoryProfile("ada", "Ada", {
  sections: { contact: { level: "READ" }, personal: { level: "READ" } },
});

beforeEach(() => {
  mockApiRequest.mockReset();
  mockBlurs.clear();
});

describe("useShownSections", () => {
  it("returns a closed Section until Show, then its values from one POST", async () => {
    mockApiRequest.mockResolvedValue(CONTACT);
    const { result } = await renderHook(() => useShownSections(someoneElse, "cs"));
    expect(result.current("contact").values).toBeUndefined();
    expect(mockApiRequest).not.toHaveBeenCalled();

    await act(async () => result.current("contact").show());

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(mockApiRequest).toHaveBeenCalledWith(
      "/api/directory/o-a/people/e-ada/show/contact?language=cs",
      { method: "POST" }
    );
    expect(result.current("contact").values).toEqual(CONTACT);
    expect(result.current("contact").failure).toBeNull();
  });

  it("returns a refusal with no Retry for a 4xx", async () => {
    mockApiRequest.mockRejectedValue(new ApiError(403, "No read"));
    const { result } = await renderHook(() => useShownSections(someoneElse, "en"));

    await act(async () => result.current("personal").show());

    expect(result.current("personal").failure).toEqual({ retryable: false });
  });

  it("returns a retryable failure when no answer came or the server faulted", async () => {
    mockApiRequest
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockRejectedValueOnce(new ApiError(503, null));
    const { result } = await renderHook(() => useShownSections(someoneElse, "en"));

    await act(async () => result.current("contact").show());
    expect(result.current("contact").failure).toEqual({ retryable: true });
    await act(async () => result.current("personal").show());
    expect(result.current("personal").failure).toEqual({ retryable: true });
  });

  it("drops the values on leaving the screen, and an answer that lands after it", async () => {
    let answer: (value: unknown) => void = () => undefined;
    mockApiRequest.mockResolvedValueOnce(CONTACT).mockReturnValueOnce(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    const { result } = await renderHook(() => useShownSections(someoneElse, "en"));
    await act(async () => result.current("contact").show());
    await act(async () => result.current("personal").show());

    await act(async () => blur());
    await act(async () => answer({ section: "PERSONAL", homeAddress: null, dateOfBirth: null }));

    expect(result.current("contact").values).toBeUndefined();
    expect(result.current("personal").values).toBeUndefined();
  });

  it("opens the person's own Sections by itself", async () => {
    mockApiRequest.mockResolvedValue(CONTACT);
    const own = directoryProfile("me", "Me", {
      self: true,
      sections: { contact: { level: "WRITE" } },
    });

    const { result } = await renderHook(() => useShownSections(own, "en"));
    await act(async () => undefined);

    expect(mockApiRequest).toHaveBeenCalledTimes(1);
    expect(result.current("contact").values).toEqual(CONTACT);
  });
});
