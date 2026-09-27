import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { ActionSheetIOS } from "react-native";

import { useDiscardGuard } from "@/components/attendance/discard-guard";
import { TranslationProvider } from "@/i18n/use-translation";

const mockDispatch = jest.fn();
const mockPreventRemove = jest.fn();

jest.mock("expo-router", () => ({ useNavigation: () => ({ dispatch: mockDispatch }) }));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <TranslationProvider>{children}</TranslationProvider>
);

const leaving = { type: "POP" };

async function attemptLeave(choice: number) {
  const sheet = jest
    .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
    .mockImplementation((_options, callback) => callback(choice));
  await renderHook(() => useDiscardGuard(true), { wrapper });
  const [, onPrevented] = mockPreventRemove.mock.lastCall as [
    boolean,
    (event: { data: { action: object } }) => void,
  ];
  onPrevented({ data: { action: leaving } });
  return sheet;
}

beforeEach(() => jest.clearAllMocks());

describe("useDiscardGuard", () => {
  it("holds the sheet back only while it has changes", async () => {
    await renderHook(() => useDiscardGuard(false), { wrapper });
    expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
  });

  it("asks before leaving, and leaves on Discard changes", async () => {
    const sheet = await attemptLeave(0);

    expect(sheet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Discard changes?",
        options: ["Discard changes", "Keep editing"],
        destructiveButtonIndex: 0,
      }),
      expect.any(Function)
    );
    expect(mockDispatch).toHaveBeenCalledWith(leaving);
  });

  it("stays on Keep editing", async () => {
    await attemptLeave(1);

    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
