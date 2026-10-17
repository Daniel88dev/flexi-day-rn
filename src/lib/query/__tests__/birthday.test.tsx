import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { toast } from "sonner-native";

import { TranslationProvider } from "@/i18n/use-translation";
import { pull } from "@/lib/local-store";
import { useMyBirthday, useRemoveMyBirthday, useSaveMyBirthday } from "@/lib/query/birthday";
import { queryClient } from "@/lib/query/runtime";

const mockFetch = jest.fn();

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});

jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/local-store", () => ({ pull: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

const SETTINGS = {
  birthday: { month: 3, day: 14, year: 1988, shared: false },
  canShare: true,
  shareGroups: [{ groupId: "g-1", groupName: "Design" }],
};

function answer(status: number, body: unknown) {
  return { status, json: async () => body, text: async () => JSON.stringify(body) };
}

const SHARE_REFUSED = {
  errors: [
    {
      message: "Sharing a birthday needs a group on a paid plan",
      context: { reason: "PLAN_LIMIT", code: "BIRTHDAY_SHARE_PLAN_REQUIRED" },
    },
  ],
};

function calls(method: string) {
  return mockFetch.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method);
}

function Probe() {
  const { data } = useMyBirthday();
  const { save, saving, planRefused } = useSaveMyBirthday();
  const remove = useRemoveMyBirthday();
  return (
    <>
      <Text testID="read">
        {data ? `${data.birthday?.month ?? "none"} ${data.canShare}` : "waiting"}
      </Text>
      <Text testID="refused">{String(planRefused)}</Text>
      <Text testID="saving">{String(saving)}</Text>
      <Pressable
        testID="share"
        onPress={() => save({ month: 3, day: 14, year: 1988, shared: true })}
      />
      <Pressable testID="remove" onPress={() => remove.remove()} />
    </>
  );
}

async function renderProbe() {
  await render(
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>
    </TranslationProvider>
  );
  await waitFor(() => expect(screen.getByTestId("read")).toHaveTextContent("3 true"));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE" ? answer(204, null) : answer(200, SETTINGS)
  );
});

afterEach(() => queryClient.clear());

describe("useMyBirthday", () => {
  it("reads the birthday and the plan state from the server", async () => {
    await renderProbe();

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/api\/users\/me\/birthday$/);
  });
});

describe("useSaveMyBirthday", () => {
  it("puts the birthday and pulls so the calendar shows it", async () => {
    await renderProbe();

    await fireEvent.press(screen.getByTestId("share"));

    await waitFor(() => expect(pull).toHaveBeenCalledWith("after-write"));
    expect(JSON.parse(String(calls("PUT")[0][1].body))).toEqual({
      month: 3,
      day: 14,
      year: 1988,
      shared: true,
    });
    expect(screen.getByTestId("refused")).toHaveTextContent("false");
  });

  it("words a refused share in place and reads the plan state again, toasting nothing", async () => {
    await renderProbe();
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? answer(402, SHARE_REFUSED)
        : answer(200, { ...SETTINGS, canShare: false })
    );

    await fireEvent.press(screen.getByTestId("share"));

    await waitFor(() => expect(screen.getByTestId("refused")).toHaveTextContent("true"));
    await waitFor(() => expect(screen.getByTestId("read")).toHaveTextContent("3 false"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("hands any other failure to the write failure handler", async () => {
    await renderProbe();
    mockFetch.mockImplementation(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? answer(422, { errors: [{ message: "Enter a valid date" }] })
        : answer(200, SETTINGS)
    );

    await fireEvent.press(screen.getByTestId("share"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Enter a valid date"));
    expect(screen.getByTestId("refused")).toHaveTextContent("false");
  });
});

describe("useRemoveMyBirthday", () => {
  it("deletes the birthday, reads it again and pulls", async () => {
    await renderProbe();

    await fireEvent.press(screen.getByTestId("remove"));

    await waitFor(() => expect(pull).toHaveBeenCalledWith("after-write"));
    expect(calls("DELETE")).toHaveLength(1);
    await waitFor(() => expect(calls("GET").length).toBeGreaterThan(1));
  });
});
