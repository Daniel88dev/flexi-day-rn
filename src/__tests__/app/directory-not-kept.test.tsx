import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SQLiteStorage } from "expo-sqlite/kv-store";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import DirectoryRoute from "@/app/directory";
import ProfileRoute from "@/app/directory/[employmentId]";
import { TranslationProvider } from "@/i18n/use-translation";
import { destroyStore } from "@/lib/local-store";
import { openTestStore } from "@/lib/local-store/test-support/test-store";
import { queryClient } from "@/lib/query";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import {
  directoryOrganization,
  directoryPerson,
  directoryProfile,
  formerDirectoryPerson,
} from "@/test-support/directory";
import { fakeFiles } from "@/test-support/fake-file-system";
import { WARM_UP_TIMEOUT, warmUpReactNative } from "@/test-support/warm-up";

import packageJson from "../../../package.json";

const mockFetch = jest.fn();
const mockKeychainWrites: string[] = [];

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return {
    ...actual,
    createApiFetch: (options: object) =>
      actual.createApiFetch({ ...options, fetchImpl: (...args: unknown[]) => mockFetch(...args) }),
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ canGoBack: () => true }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({ employmentId: "e-quillon", organizationId: "o-acme" }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
  getCalendars: () => [{ uses24hourClock: true }],
}));
jest.mock("expo-secure-store", () => ({
  setItemAsync: async (key: string, value: string) => void mockKeychainWrites.push(key, value),
  getItemAsync: async () => null,
  deleteItemAsync: async () => undefined,
}));
jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/lib/app-state", () => ({
  deviceAppState: jest.requireActual("@/test-support/fake-app-state").createFakeAppState(),
}));
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: "u-me", name: "Me", email: "me@dev.local", twoFactorEnabled: false }),
}));

/** Strings that appear only in the directory's answers, so finding one anywhere is a leak. */
const SENTINELS = [
  "Quillon Vantablack",
  "Senior sentinel engineer",
  "Zephyrine Oakhollow",
  "quillon.sentinel@acme.test",
  "+420 777 000 123",
];

/** Contact and Personal values, which only a Show answer carries. */
const SENSITIVE = [
  "+420 606 999 404",
  "quillon@private.test",
  "Ysolde Brackenridge",
  "+420 603 888 202",
  "Wolkerova 1337",
  "1987-05-23",
];

const ANSWERS: Record<string, unknown> = {
  "/api/directory/organizations": [directoryOrganization("o-acme", { role: "OWNER" })],
  "/api/directory/o-acme/people": {
    formerList: true,
    people: [
      directoryPerson("quillon", SENTINELS[0], { jobTitle: SENTINELS[1] }),
      directoryPerson("me", "Me"),
    ],
  },
  "/api/directory/o-acme/people/e-quillon": directoryProfile("quillon", SENTINELS[0], {
    organizationId: "o-acme",
    sections: {
      contact: { level: "READ" },
      personal: { level: "READ" },
      card: { level: "READ", jobTitle: SENTINELS[1], reportsTo: null },
      workContact: {
        level: "READ",
        workEmail: SENTINELS[3],
        workPhone: { e164: "+420777000123", display: SENTINELS[4], country: null },
      },
    },
  }),
  "/api/directory/o-acme/people/e-quillon/show/contact": {
    section: "CONTACT",
    level: "READ",
    recorded: true,
    privatePhone: { e164: "+420606999404", display: SENSITIVE[0], country: null },
    privateEmail: SENSITIVE[1],
    emergencyContact1: {
      name: SENSITIVE[2],
      phone: { e164: "+420603888202", display: SENSITIVE[3], country: null },
    },
    emergencyContact2: null,
  },
  "/api/directory/o-acme/people/e-quillon/show/personal": {
    section: "PERSONAL",
    level: "READ",
    recorded: true,
    homeAddress: {
      line1: SENSITIVE[4],
      line2: null,
      postalCode: null,
      city: "Brno",
      region: null,
      country: { code: "CZ", name: "Czechia" },
    },
    dateOfBirth: SENSITIVE[5],
  },
  "/api/directory/o-acme/former": [
    formerDirectoryPerson("zephyrine", SENTINELS[2], "2026-08-15T10:00:00.000Z"),
  ],
};

let folder: string;
let storeFile: string;
const kvWrites = jest.spyOn(SQLiteStorage.prototype, "setItemSync");

beforeAll(warmUpReactNative, WARM_UP_TIMEOUT);

beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), "directory-not-kept-"));
  storeFile = join(folder, "flexi-day.db");
  mockKeychainWrites.length = 0;
  kvWrites.mockClear();
  fakeFiles.reset();
  mockFetch.mockImplementation(async (url: string) => {
    const body = ANSWERS[new URL(url).pathname];
    return body === undefined
      ? { status: 404, json: async () => ({}) }
      : { status: 200, json: async () => body };
  });
  await openTestStore("u-me", { filePath: storeFile });
});

afterEach(async () => {
  queryClient.clear();
  await destroyStore();
  rmSync(folder, { recursive: true, force: true });
});

function storeBytes(): string {
  return ["", "-wal", "-shm"]
    .map((suffix) => `${storeFile}${suffix}`)
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path).toString("latin1"))
    .join("");
}

const leaks = (haystack: string) =>
  [...SENTINELS, ...SENSITIVE].filter((sentinel) => haystack.includes(sentinel));

/** Everything the query client holds: every query's answer and every mutation's. */
const queryClientContents = () =>
  JSON.stringify([
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.state),
    queryClient
      .getMutationCache()
      .getAll()
      .map((mutation) => mutation.state),
  ]);

describe("Directory screen, what the phone keeps", () => {
  it("shows the directory and writes none of it to the Local store, the Keychain, the kv-store or a file", async () => {
    const view = await render(
      <RootRouteProvider route="signed-in">
        <TranslationProvider>
          <DirectoryRoute />
        </TranslationProvider>
      </RootRouteProvider>
    );

    expect(await screen.findByText(SENTINELS[0])).toBeOnTheScreen();
    expect(screen.getByText(SENTINELS[1])).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId("directory-segment-former")));
    expect(await screen.findByText(SENTINELS[2])).toBeOnTheScreen();

    // The store file exists and was written (the open stamps the user), so an empty read is real.
    expect(storeBytes()).toContain("u-me");
    expect(leaks(storeBytes())).toEqual([]);
    expect(leaks(mockKeychainWrites.join("\n"))).toEqual([]);
    expect(leaks(JSON.stringify(kvWrites.mock.calls))).toEqual([]);
    expect(fakeFiles.under("file://")).toEqual([]);

    // Memory only, and only while a screen shows it: closing the directory drops it.
    expect(queryClient.getQueryData(["directory", "people", "o-acme"])).toBeDefined();
    await view.unmount();
    await waitFor(() => {
      expect(queryClient.getQueryData(["directory", "people", "o-acme"])).toBeUndefined();
      expect(queryClient.getQueryData(["directory", "former", "o-acme"])).toBeUndefined();
    });
  });

  it("shows a profile and keeps none of it once the profile closes", async () => {
    const view = await render(
      <RootRouteProvider route="signed-in">
        <TranslationProvider>
          <ProfileRoute />
        </TranslationProvider>
      </RootRouteProvider>
    );

    expect(await screen.findByText(SENTINELS[3])).toBeOnTheScreen();
    expect(screen.getByText(SENTINELS[4])).toBeOnTheScreen();

    expect(storeBytes()).toContain("u-me");
    expect(leaks(storeBytes())).toEqual([]);
    expect(leaks(mockKeychainWrites.join("\n"))).toEqual([]);
    expect(leaks(JSON.stringify(kvWrites.mock.calls))).toEqual([]);
    expect(fakeFiles.under("file://")).toEqual([]);

    const profileKey = ["directory", "profile", "o-acme", "e-quillon", "en"];
    expect(queryClient.getQueryData(profileKey)).toBeDefined();
    await view.unmount();
    await waitFor(() => expect(queryClient.getQueryData(profileKey)).toBeUndefined());
  });

  it("opens Contact and Personal into screen memory only, never the query cache or the Local store", async () => {
    const view = await render(
      <RootRouteProvider route="signed-in">
        <TranslationProvider>
          <ProfileRoute />
        </TranslationProvider>
      </RootRouteProvider>
    );
    await screen.findByText(SENTINELS[3]);

    await act(async () => fireEvent.press(screen.getByTestId("directory-profile-show-contact")));
    await act(async () => fireEvent.press(screen.getByTestId("directory-profile-show-personal")));
    expect(await screen.findByText(SENSITIVE[0])).toBeOnTheScreen();
    expect(await screen.findByText(new RegExp(SENSITIVE[4]))).toBeOnTheScreen();

    const sensitiveIn = (haystack: string) =>
      SENSITIVE.filter((sentinel) => haystack.includes(sentinel));
    // The profile read sits in the cache, so an empty find there is real.
    expect(queryClientContents()).toContain(SENTINELS[3]);
    expect(sensitiveIn(queryClientContents())).toEqual([]);
    expect(storeBytes()).toContain("u-me");
    expect(sensitiveIn(storeBytes())).toEqual([]);
    expect(sensitiveIn(mockKeychainWrites.join("\n"))).toEqual([]);
    expect(sensitiveIn(JSON.stringify(kvWrites.mock.calls))).toEqual([]);
    expect(fakeFiles.under("file://")).toEqual([]);

    await view.unmount();
    expect(sensitiveIn(queryClientContents())).toEqual([]);
  });

  it("ships no query cache persister, so nothing writes the cache to disk", () => {
    const packages = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
    expect(packages.filter((name) => /persist|async-storage|mmkv/.test(name))).toEqual([]);
  });
});
