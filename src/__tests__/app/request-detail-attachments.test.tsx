import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as WebBrowser from "expo-web-browser";
import { ActionSheetIOS, Alert, Linking, type AlertButton } from "react-native";

import RequestDetailRoute from "@/app/requests/[vacationId]";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query";
import type { Attachment, VacationDetail } from "@/lib/query/vacation-detail";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import { fakeFiles } from "@/test-support/fake-file-system";
import { vacationDetail } from "@/test-support/vacation-detail";

const mockFetch = jest.fn();
const mockUpload = fakeFiles.upload;
let mockViewerId = "user-2";
let mockFocused = true;

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
  useIsFocused: () => mockFocused,
  useLocalSearchParams: () => ({ vacationId: "vacation-1" }),
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));
jest.mock("@/lib/session/auth-client", () => ({ sessionCookie: async () => "" }));
jest.mock("@/lib/session/client-headers", () => ({ currentClientHeaders: () => ({}) }));
jest.mock("@/lib/viewer/use-viewer", () => ({
  useViewer: () => ({ id: mockViewerId, name: "Viewer", email: "viewer@dev.local" }),
}));
jest.mock("@/lib/local-store", () => ({
  pull: jest.fn().mockResolvedValue({ ok: true }),
  useStoredRequest: jest.fn(() => null),
  vacationStatusOf: jest.requireActual("@/lib/local-store/queries").vacationStatusOf,
}));
jest.mock("@/lib/haptics", () => ({ haptic: jest.fn() }));
jest.mock("sonner-native", () => ({ toast: { error: jest.fn() } }));
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@react-native-community/datetimepicker", () => () => null);
jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);
/** A file as the document picker hands it over, in the app's inbox. */
function picked(name: string, type: string, size: number) {
  const uri = `file:///tmp/Inbox/${name}`;
  fakeFiles.put(uri, size);
  return { uri, name, type, size };
}
jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));
jest.mock("expo-web-browser", () => ({
  openBrowserAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
  WebBrowserPresentationStyle: { PAGE_SHEET: "pageSheet" },
}));

const pickFile = fakeFiles.pickFileAsync;
const requestCamera = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const openBrowser = WebBrowser.openBrowserAsync as jest.Mock;

const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

let chooseSource: (index: number) => void = () => {};
let sheetOptions: string[] = [];
jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((options, cb) => {
  sheetOptions = options.options;
  chooseSource = cb;
});

let alert: { title: string; buttons: AlertButton[] } | null = null;
jest.spyOn(Alert, "alert").mockImplementation((title, _message, buttons) => {
  alert = { title, buttons: (buttons ?? []) as AlertButton[] };
});
const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

function file(patch: Partial<Attachment> = {}): Attachment {
  return {
    id: "file-1",
    fileName: "doctor.pdf",
    contentType: "application/pdf",
    size: 2048,
    status: "READY",
    rejectionReason: null,
    uploadedByUserId: "user-2",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    deletedByUserId: null,
    ...patch,
  };
}

/** The backend: the detail, its group, and the attachment routes, changing as a real one would. */
let detail: VacationDetail;
let uploadsAvailable: boolean;
let urls = 0;

function calls(method: string, pattern: RegExp) {
  return mockFetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? "GET") === method && pattern.test(String(url))
  );
}
const detailReads = () => calls("GET", /\/api\/vacation\/vacation-1$/);

beforeEach(() => {
  jest.clearAllMocks();
  fakeFiles.reset();
  alert = null;
  urls = 0;
  mockViewerId = "user-2";
  mockFocused = true;
  uploadsAvailable = true;
  detail = vacationDetail({ attachments: [], canAttach: true, canDeleteAnyAttachment: false });
  mockUpload.mockImplementation(async () => {
    // The local disk store checks the bytes as they land, so the row is ready at once.
    detail = {
      ...detail,
      attachments: (detail.attachments ?? []).map((row) =>
        row.status === "UPLOADING" ? { ...row, status: "READY" } : row
      ),
    };
    return { status: 200, body: "", headers: {} };
  });
  mockFetch.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
    const path = String(url);
    const method = init?.method ?? "GET";
    if (path.includes("/api/group/")) {
      return answer(200, { id: "group-1", organization: null, uploadsAvailable });
    }
    if (method === "POST" && /\/api\/attachments$/.test(path)) {
      const body = JSON.parse(init?.body ?? "{}");
      const row = file({
        id: `new-${(detail.attachments ?? []).length + 1}`,
        fileName: body.fileName,
        contentType: body.contentType,
        size: body.size,
        status: "UPLOADING",
      });
      detail = { ...detail, attachments: [...(detail.attachments ?? []), row] };
      return answer(201, {
        attachment: row,
        upload: { url: "http://store/put", method: "PUT", headers: {}, expiresAt: "" },
      });
    }
    if (method === "DELETE") {
      const id = path.split("/api/attachments/")[1];
      detail = {
        ...detail,
        attachments: (detail.attachments ?? []).map((row) =>
          row.id === id ? { ...row, deletedAt: new Date().toISOString() } : row
        ),
      };
      return answer(200, {});
    }
    if (path.includes("/download-url")) {
      urls += 1;
      return answer(200, { url: `https://files/${urls}`, expiresAt: "" });
    }
    return answer(200, detail);
  });
});

afterEach(() => {
  queryClient.clear();
  jest.useRealTimers();
});

async function renderLoaded(patch: Partial<VacationDetail> = {}, { readsGroup = true } = {}) {
  detail = { ...detail, ...patch };
  await render(
    <RootRouteProvider route="signed-in">
      <TranslationProvider>
        <RequestDetailRoute />
      </TranslationProvider>
    </RootRouteProvider>
  );
  await screen.findByTestId("request-detail");
  if (readsGroup) {
    await waitFor(() => expect(calls("GET", /\/api\/group\/group-1$/)).toHaveLength(1));
  }
  await act(async () => undefined);
}

async function addFrom(label: string) {
  await fireEvent.press(screen.getByTestId("attachment-add"));
  await act(async () => chooseSource(sheetOptions.indexOf(label)));
}

describe("RequestDetail attachments", () => {
  it("lets the owner add a file: checks it, registers it, uploads it and lists it", async () => {
    pickFile.mockResolvedValue({
      canceled: false,
      result: [picked("note.pdf", "application/pdf", 4096)],
    });
    await renderLoaded();

    expect(screen.getByTestId("attachments-count")).toHaveTextContent("0 of 5");
    await addFrom(en.attachments.chooseFile);

    await waitFor(() => expect(calls("POST", /\/api\/attachments$/)).toHaveLength(1));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\/\/cache\/attachment-picks\/.+\/note\.pdf$/),
      "http://store/put",
      expect.anything()
    );
    await waitFor(() => expect(screen.getAllByTestId("attachment-row")).toHaveLength(1));
    expect(screen.getByTestId("request-attachments")).toHaveTextContent(/note\.pdf/);
    expect(screen.getByTestId("attachments-count")).toHaveTextContent("1 of 5");
    expect(fakeFiles.under("file:///cache/attachment-picks")).toEqual([]);
  });

  it("offers the three sources and refuses a wrong type or an oversize file without a request", async () => {
    pickFile.mockResolvedValue({
      canceled: false,
      result: [
        picked("notes.txt", "text/plain", 10),
        picked("big.pdf", "application/pdf", 11 * 1024 * 1024),
      ],
    });
    await renderLoaded();

    await addFrom(en.attachments.chooseFile);

    expect(sheetOptions).toEqual([
      en.attachments.takePhoto,
      en.attachments.choosePhoto,
      en.attachments.chooseFile,
      en.attachments.cancel,
    ]);
    expect(await screen.findByText(en.attachments.unsupportedType)).toBeOnTheScreen();
    expect(screen.getByText(en.attachments.tooLarge)).toBeOnTheScreen();
    expect(calls("POST", /\/api\/attachments$/)).toHaveLength(0);
  });

  it("sends a refused camera to Settings instead of opening it", async () => {
    requestCamera.mockResolvedValue({ granted: false });
    await renderLoaded();

    await addFrom(en.attachments.takePhoto);

    await waitFor(() => expect(alert?.title).toBe(en.attachments.cameraDenied));
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    await act(async () =>
      alert?.buttons.find((button) => button.text === en.attachments.openSettings)?.onPress?.()
    );
    expect(openSettings).toHaveBeenCalled();
  });

  it("shows the plan note and no add row when the plan takes no uploads", async () => {
    uploadsAvailable = false;
    await renderLoaded({ canAttach: false, attachments: [file()] });

    expect(screen.getByTestId("attachments-lapsed")).toHaveTextContent(en.attachments.paidPlanOnly);
    expect(screen.queryByTestId("attachment-add")).toBeNull();
    expect(screen.getByTestId("request-attachments")).toHaveTextContent(/doctor\.pdf/);
  });

  it("shows the add row as full at five files", async () => {
    const five = Array.from({ length: 5 }, (_, index) => file({ id: `f${index}` }));
    await renderLoaded({ canAttach: false, attachments: five });

    expect(screen.getByTestId("attachment-add")).toBeDisabled();
    expect(screen.getByText(en.attachments.full)).toBeOnTheScreen();
  });

  it("offers no add row to a viewer who is neither the owner nor an editing admin", async () => {
    mockViewerId = "user-9";
    await renderLoaded({ attachments: [file()] });

    expect(screen.queryByTestId("attachment-add")).toBeNull();
    expect(screen.queryByTestId("attachment-delete")).toBeNull();
  });

  it("shows nothing about files to a viewer the detail sent no files field to", async () => {
    mockViewerId = "user-9";
    await renderLoaded({ attachments: undefined, canAttach: undefined }, { readsGroup: false });

    expect(screen.queryByTestId("request-attachments")).toBeNull();
    // Nothing about files is asked for: the group's plan only matters to a files section.
    expect(calls("GET", /\/api\/group\//)).toHaveLength(0);
  });

  it("deletes the viewer's own file once confirmed, and reads the detail again", async () => {
    await renderLoaded({ attachments: [file()] });
    const readsBefore = detailReads().length;

    await fireEvent.press(screen.getByTestId("attachment-delete"));
    expect(alert?.title).toBe(en.attachments.deleteTitle("doctor.pdf"));
    await act(async () =>
      alert?.buttons.find((button) => button.text === en.attachments.deleteConfirm)?.onPress?.()
    );

    await waitFor(() => expect(calls("DELETE", /\/api\/attachments\/file-1$/)).toHaveLength(1));
    await waitFor(() => expect(detailReads().length).toBeGreaterThan(readsBefore));
    await waitFor(() => expect(screen.queryByTestId("attachment-row")).toBeNull());
  });

  it("lets an admin delete a file someone else uploaded", async () => {
    mockViewerId = "user-9";
    await renderLoaded({ canDeleteAnyAttachment: true, attachments: [file()] });

    expect(screen.getByTestId("attachment-delete")).toBeOnTheScreen();
  });

  it("adds and deletes nothing while the detail shown is a stale one", async () => {
    await renderLoaded({ attachments: [file()] });
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["vacation", "vacation-1"] });
    });

    await screen.findByTestId("request-detail-failure");
    expect(screen.queryByTestId("attachment-add")).toBeNull();
    expect(screen.queryByTestId("attachment-delete")).toBeNull();
    expect(screen.getByTestId("request-attachments")).toHaveTextContent(/doctor\.pdf/);
  });

  it("opens an image full-screen in the app, with a fresh URL on every tap", async () => {
    await renderLoaded({
      attachments: [file({ fileName: "scan.jpg", contentType: "image/jpeg" })],
    });

    await act(async () => fireEvent.press(screen.getByLabelText(en.attachments.open("scan.jpg"))));
    expect(await screen.findByTestId("image-viewer-image")).toHaveProp("source", {
      uri: "https://files/1",
    });
    await fireEvent.press(screen.getByTestId("image-viewer-close"));
    await act(async () => fireEvent.press(screen.getByLabelText(en.attachments.open("scan.jpg"))));

    await waitFor(() =>
      expect(screen.getByTestId("image-viewer-image")).toHaveProp("source", {
        uri: "https://files/2",
      })
    );
    expect(calls("GET", /\/download-url\?disposition=inline$/)).toHaveLength(2);
    expect(openBrowser).not.toHaveBeenCalled();
  });

  it("opens a PDF in the browser sheet with a fresh URL", async () => {
    await renderLoaded({ attachments: [file()] });

    await act(async () =>
      fireEvent.press(screen.getByLabelText(en.attachments.open("doctor.pdf")))
    );

    await waitFor(() =>
      expect(openBrowser).toHaveBeenCalledWith("https://files/1", {
        presentationStyle: "pageSheet",
      })
    );
    expect(screen.queryByTestId("image-viewer-image")).toBeNull();
  });

  it("does not open a file still being checked", async () => {
    await renderLoaded({ attachments: [file({ status: "UPLOADING" })] });

    expect(screen.queryByLabelText(en.attachments.open("doctor.pdf"))).toBeNull();
    expect(screen.getByText(en.attachments.processing)).toBeOnTheScreen();
  });
});

describe("RequestDetail kept picks and stale uploads", () => {
  it("clears copies a closed app left behind more than a day ago", async () => {
    const DAY = 24 * 60 * 60 * 1000;
    const old = `file:///cache/attachment-picks/${Date.now() - DAY - 60_000}-1/old.pdf`;
    const recent = `file:///cache/attachment-picks/${Date.now() - 60_000}-2/recent.pdf`;
    fakeFiles.put(old, 10);
    fakeFiles.put(recent, 10);

    await renderLoaded();

    expect(fakeFiles.under("file:///cache/attachment-picks")).toEqual([recent]);
  });

  it("turns a file still unchecked after ten minutes into a failed one while the screen is open", async () => {
    jest.useFakeTimers();
    const nineMinutesAgo = new Date(Date.now() - 9.5 * 60 * 1000).toISOString();
    await renderLoaded({ attachments: [file({ status: "UPLOADING", createdAt: nineMinutesAgo })] });
    expect(screen.getByText(en.attachments.processing)).toBeOnTheScreen();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByText(en.attachments.failed)).toBeOnTheScreen();
  });
});

describe("RequestDetail processing poll", () => {
  it("reads the detail every 3 s while a file is being checked, and stops once it settles", async () => {
    jest.useFakeTimers();
    await renderLoaded({ attachments: [file({ status: "UPLOADING" })] });
    const first = detailReads().length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(detailReads().length).toBe(first + 1);

    detail = { ...detail, attachments: [file()] };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    const settled = detailReads().length;
    expect(settled).toBe(first + 2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(detailReads().length).toBe(settled);
  });

  it("stops once a read fails, rather than retrying every 3 s", async () => {
    jest.useFakeTimers();
    await renderLoaded({ attachments: [file({ status: "UPLOADING" })] });
    const first = detailReads().length;
    const answering = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (url: string, init?: { method?: string }) =>
      /\/api\/vacation\/vacation-1$/.test(String(url))
        ? Promise.reject(new TypeError("Network request failed"))
        : answering(url, init)
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    const failedReads = detailReads().length;
    expect(failedReads).toBeGreaterThan(first);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(15000);
    });
    expect(detailReads().length).toBe(failedReads);
  });

  it("does not poll while another screen covers the detail", async () => {
    jest.useFakeTimers();
    mockFocused = false;
    await renderLoaded({ attachments: [file({ status: "UPLOADING" })] });
    const first = detailReads().length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });

    expect(detailReads().length).toBe(first);
  });

  it("never polls when nothing is being checked", async () => {
    jest.useFakeTimers();
    await renderLoaded({ attachments: [file()] });
    const first = detailReads().length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });

    expect(detailReads().length).toBe(first);
  });

  it("stops when the screen closes", async () => {
    jest.useFakeTimers();
    await renderLoaded({ attachments: [file({ status: "UPLOADING" })] });
    const first = detailReads().length;

    await act(async () => screen.unmount());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });

    expect(detailReads().length).toBe(first);
  });
});
