import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { queryClient } from "@/lib/query/runtime";
import type { Attachment } from "@/lib/query/vacation-detail";
import { fakeFiles } from "@/test-support/fake-file-system";

import { useAttachmentUploads } from "../use-attachment-uploads";

const mockFetch = jest.fn();
const mockUpload = fakeFiles.upload;

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
jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);

const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

const MB = 1024 * 1024;

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TranslationProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TranslationProvider>
  );
}

function row(id: string, patch: Partial<Attachment> = {}): Attachment {
  return {
    id,
    fileName: `${id}.pdf`,
    contentType: "application/pdf",
    size: MB,
    status: "READY",
    rejectionReason: null,
    uploadedByUserId: "user-2",
    createdAt: new Date().toISOString(),
    deletedAt: null,
    deletedByUserId: null,
    ...patch,
  };
}

/** A photo from the library, which needs no copy. */
function file(name: string, type = "application/pdf", size = MB) {
  const uri = `file:///tmp/${name}`;
  fakeFiles.put(uri, size);
  return { uri, name, type, size };
}

/** A file from the document picker, still in the inbox iOS clears. */
function inboxFile(name: string, type = "application/pdf", size = MB) {
  const uri = `file:///tmp/Inbox/${name}`;
  fakeFiles.put(uri, size);
  return { uri, name, type, size, inbox: true };
}

const picks = () => fakeFiles.under("file:///cache/attachment-picks");

let nextId = 0;

function registrations() {
  return mockFetch.mock.calls.filter(([url]) => /\/api\/attachments$/.test(String(url)));
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeFiles.reset();
  nextId = 0;
  mockFetch.mockImplementation(async () => {
    nextId += 1;
    return answer(201, {
      attachment: row(`attachment-${nextId}`, { status: "UPLOADING" }),
      upload: { url: "http://store/put", method: "PUT", headers: {}, expiresAt: "" },
    });
  });
});

afterEach(() => queryClient.clear());

async function renderUploads(requestId: string | null, attachments: Attachment[] = []) {
  return renderHook(
    (props: { requestId: string | null; attachments: Attachment[] }) => useAttachmentUploads(props),
    { wrapper, initialProps: { requestId, attachments } }
  );
}

describe("useAttachmentUploads", () => {
  it("queues files picked before the Request exists and sends none of them", async () => {
    const { result } = await renderUploads(null);

    await act(async () => result.current.pick([file("a.pdf"), file("b.pdf")]));

    expect(result.current.jobs.map((job) => [job.fileName, job.queued])).toEqual([
      ["a.pdf", true],
      ["b.pdf", true],
    ]);
    expect(result.current.queued).toBe(2);
    expect(result.current.remaining).toBe(3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends every queued file to the Request once start has its id", async () => {
    const { result } = await renderUploads(null);
    await act(async () => result.current.pick([file("a.pdf"), file("b.pdf")]));

    let sent = 0;
    await act(async () => {
      sent = result.current.start("request-7");
    });

    expect(sent).toBe(2);
    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(registrations().map(([, init]) => JSON.parse(init.body).requestId)).toEqual([
      "request-7",
      "request-7",
    ]);
    expect(result.current.queued).toBe(0);
  });

  it("drops a queued file the person removed, so start does not send it", async () => {
    const { result } = await renderUploads(null);
    await act(async () => result.current.pick([file("a.pdf"), file("b.pdf")]));

    await act(async () => result.current.remove(result.current.jobs[0].key));
    let sent = 0;
    await act(async () => {
      sent = result.current.start("request-7");
    });

    expect(sent).toBe(1);
    await waitFor(() => expect(registrations()).toHaveLength(1));
    expect(JSON.parse(registrations()[0][1].body).fileName).toBe("b.pdf");
  });

  it("uploads at once when the Request exists, and hands the row to the list once it lands", async () => {
    const { result, rerender } = await renderUploads("request-1");

    await act(async () => result.current.pick([file("a.pdf")]));
    await waitFor(() => expect(result.current.jobs[0]?.done).toBe(true));
    expect(result.current.inFlight).toBe(1);

    await act(async () =>
      rerender({
        requestId: "request-1",
        attachments: [row("attachment-1", { status: "UPLOADING" })],
      })
    );

    expect(result.current.jobs).toEqual([]);
    expect(result.current.settled.map((attachment) => attachment.id)).toEqual(["attachment-1"]);
    expect(result.current.inFlight).toBe(0);
  });

  it("refuses a wrong type, an oversize file and one past the fifth, without a request", async () => {
    const four = ["w", "x", "y", "z"].map((id) => row(id));
    const { result } = await renderUploads("request-1", four);

    await act(async () =>
      result.current.pick([
        file("notes.txt", "text/plain"),
        file("scan", ""),
        file("big.pdf", "application/pdf", 11 * MB),
        file("ok.heic", ""),
        file("sixth.pdf"),
      ])
    );

    expect(result.current.jobs.map((job) => job.error ?? null)).toEqual([
      en.attachments.unsupportedType,
      en.attachments.unsupportedType,
      en.attachments.tooLarge,
      null,
      en.attachments.limitReached,
    ]);
    await waitFor(() => expect(registrations()).toHaveLength(1));
    expect(JSON.parse(registrations()[0][1].body)).toMatchObject({
      fileName: "ok.heic",
      contentType: "image/heic",
    });
    expect(result.current.failed).toBe(4);
  });

  it("words the backend's refusals the way the web does", async () => {
    mockFetch
      .mockResolvedValueOnce(answer(402, { errors: [{ message: "Paid plan" }] }))
      .mockResolvedValueOnce(answer(403, { errors: [{ message: "Nope" }] }))
      .mockResolvedValueOnce(
        answer(422, { errors: [{ message: "Limit", context: { reason: "ATTACHMENT_LIMIT" } }] })
      );
    const { result } = await renderUploads("request-1");

    await act(async () => result.current.pick([file("a.pdf")]));
    await act(async () => result.current.pick([file("b.pdf")]));
    await act(async () => result.current.pick([file("c.pdf")]));

    await waitFor(() =>
      expect(result.current.jobs.map((job) => job.error)).toEqual([
        en.attachments.paidPlanOnly,
        en.attachments.attachForbidden,
        en.attachments.limitReached,
      ])
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("marks a row whose bytes never arrived as failed at once", async () => {
    mockUpload.mockResolvedValue({ status: 500, body: "", headers: {} });
    const { result } = await renderUploads("request-1");

    await act(async () => result.current.pick([file("a.pdf")]));

    await waitFor(() => expect(result.current.jobs[0]?.error).toBe(en.attachments.failed));
    expect(result.current.failedIds).toEqual(["attachment-1"]);
  });

  it("returns full once the files and the jobs fill all five slots", async () => {
    const four = ["w", "x", "y", "z"].map((id) => row(id));
    const { result } = await renderUploads(null, four);

    expect(result.current.full).toBe(false);
    await act(async () => result.current.pick([file("a.pdf")]));

    expect(result.current.remaining).toBe(0);
    expect(result.current.full).toBe(true);
  });
});

describe("useAttachmentUploads, the kept copies", () => {
  it("copies only the inbox files that pass the checks", async () => {
    const { result } = await renderUploads(null);

    await act(async () =>
      result.current.pick([
        inboxFile("big.pdf", "application/pdf", 11 * MB),
        inboxFile("notes.txt", "text/plain"),
        inboxFile("ok.pdf"),
      ])
    );

    await waitFor(() => expect(picks()).toHaveLength(1));
    expect(picks()[0]).toMatch(/\/ok\.pdf$/);
  });

  it("uploads the kept copy and deletes it once the upload is done", async () => {
    const { result } = await renderUploads(null);
    await act(async () => result.current.pick([inboxFile("ok.pdf")]));
    await waitFor(() => expect(picks()).toHaveLength(1));
    const [kept] = picks();

    await act(async () => {
      result.current.start("request-7");
    });

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    expect(mockUpload.mock.calls[0][0]).toBe(kept);
    await waitFor(() => expect(picks()).toEqual([]));
  });

  it("deletes the kept copy when its upload fails", async () => {
    mockUpload.mockResolvedValue({ status: 500, body: "", headers: {} });
    const { result } = await renderUploads("request-1");

    await act(async () => result.current.pick([inboxFile("ok.pdf")]));

    await waitFor(() => expect(result.current.jobs[0]?.error).toBe(en.attachments.failed));
    expect(picks()).toEqual([]);
  });

  it("deletes the kept copy of a queued file the person removed", async () => {
    const { result } = await renderUploads(null);
    await act(async () => result.current.pick([inboxFile("ok.pdf")]));
    await waitFor(() => expect(picks()).toHaveLength(1));

    await act(async () => result.current.remove(result.current.jobs[0].key));

    await waitFor(() => expect(picks()).toEqual([]));
  });

  it("deletes every queued copy on reset", async () => {
    const { result } = await renderUploads(null);
    await act(async () => result.current.pick([inboxFile("a.pdf"), inboxFile("b.pdf")]));
    await waitFor(() => expect(picks()).toHaveLength(2));

    await act(async () => result.current.reset());

    await waitFor(() => expect(picks()).toEqual([]));
  });

  it("deletes the copies still queued when the screen closes", async () => {
    const { result, unmount } = await renderUploads(null);
    await act(async () => result.current.pick([inboxFile("a.pdf")]));
    await waitFor(() => expect(picks()).toHaveLength(1));

    await act(async () => unmount());

    await waitFor(() => expect(picks()).toEqual([]));
  });
});

describe("useAttachmentUploads, rows whose bytes never came", () => {
  it("marks a row the backend registered as failed when its registration got no answer", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"));
    const { result, rerender } = await renderUploads("request-1", [row("earlier")]);

    await act(async () => result.current.pick([file("a.pdf")]));
    await waitFor(() => expect(result.current.jobs[0]?.error).toBe(en.attachments.uploadFailed));
    // The request did reach the server: the next read lists a row nobody here is sending.
    await act(async () =>
      rerender({
        requestId: "request-1",
        attachments: [row("earlier"), row("orphan", { status: "UPLOADING" })],
      })
    );

    expect(result.current.failedIds).toEqual(["orphan"]);
  });

  it("leaves a row being checked alone when no registration went unanswered", async () => {
    const { result } = await renderUploads("request-1", [row("checking", { status: "UPLOADING" })]);

    expect(result.current.failedIds).toEqual([]);
  });
});
