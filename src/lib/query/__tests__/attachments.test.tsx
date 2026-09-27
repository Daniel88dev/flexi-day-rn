import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import {
  fetchAttachmentView,
  useDeleteAttachment,
  useUploadAttachment,
} from "@/lib/query/attachments";
import { ApiError } from "@/lib/query/failure";
import { qk } from "@/lib/query/keys";
import { queryClient } from "@/lib/query/runtime";
import type { Attachment } from "@/lib/query/vacation-detail";
import { UploadError } from "@/lib/requests/attachment-files";

const mockFetch = jest.fn();
const mockUpload = jest.fn();

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
jest.mock("expo-file-system", () => ({
  File: jest.fn().mockImplementation(() => ({
    exists: true,
    upload: (...args: unknown[]) => mockUpload(...args),
  })),
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
}));

const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({
  ...defaults,
  mutations: { ...defaults.mutations, gcTime: Infinity },
});

function answer(status: number, body: unknown) {
  return { status, json: async () => body };
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function attachment(patch: Partial<Attachment> = {}): Attachment {
  return {
    id: "attachment-1",
    fileName: "IMG_0042.HEIC",
    contentType: "image/heic",
    size: 2048,
    status: "UPLOADING",
    rejectionReason: null,
    uploadedByUserId: "user-2",
    createdAt: "2026-09-27T12:00:00.000Z",
    deletedAt: null,
    deletedByUserId: null,
    ...patch,
  };
}

const photo = { uri: "file:///tmp/IMG_0042.HEIC", name: "IMG_0042.HEIC", type: "", size: 2048 };
const target = {
  url: "http://localhost:8080/api/attachments/local/upload/attachment-1?signature=s",
  method: "PUT",
  headers: { "Content-Type": "image/heic" },
  expiresAt: "2026-09-27T12:10:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ status: 200, body: "", headers: {} });
  mockFetch.mockResolvedValue(answer(201, { attachment: attachment(), upload: target }));
});

afterEach(() => queryClient.clear());

describe("useUploadAttachment", () => {
  it("registers the file with its declared type, names the row, then sends the bytes to the target", async () => {
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const registered: string[] = [];
    const { result } = await renderHook(() => useUploadAttachment(), { wrapper });

    let row: Attachment | undefined;
    await act(async () => {
      row = await result.current.mutateAsync({
        requestId: "request-1",
        file: photo,
        onRegistered: (id) => registered.push(id),
      });
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/attachments$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      requestId: "request-1",
      fileName: "IMG_0042.HEIC",
      contentType: "image/heic",
      size: 2048,
    });
    expect(registered).toEqual(["attachment-1"]);
    expect(mockUpload).toHaveBeenCalledWith(
      target.url,
      expect.objectContaining({ httpMethod: "PUT" })
    );
    expect(row?.id).toBe("attachment-1");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.vacationDetails() });
  });

  it("throws the backend's refusal without sending any bytes", async () => {
    mockFetch.mockResolvedValue(
      answer(422, { errors: [{ message: "Too large", context: { reason: "FILE_TOO_LARGE" } }] })
    );
    const { result } = await renderHook(() => useUploadAttachment(), { wrapper });

    let failure: unknown;
    await act(async () => {
      failure = await result.current
        .mutateAsync({ requestId: "request-1", file: photo })
        .catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).context).toEqual({ reason: "FILE_TOO_LARGE" });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("throws an UploadError naming the registered row when the bytes never arrived", async () => {
    mockUpload.mockResolvedValue({ status: 500, body: "", headers: {} });
    const { result } = await renderHook(() => useUploadAttachment(), { wrapper });

    let failure: unknown;
    await act(async () => {
      failure = await result.current
        .mutateAsync({ requestId: "request-1", file: photo })
        .catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toMatchObject({ status: 500, attachmentId: "attachment-1" });
  });
});

describe("useUploadAttachment, after registration", () => {
  it("names the registered row on any failure once the backend has it, not only a refused upload", async () => {
    const { result } = await renderHook(() => useUploadAttachment(), { wrapper });

    let failure: unknown;
    await act(async () => {
      failure = await result.current
        .mutateAsync({
          requestId: "request-1",
          file: photo,
          onProgress: (fraction) => {
            if (fraction === 1) throw new Error("The screen went away");
          },
        })
        .catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toMatchObject({ status: 0, attachmentId: "attachment-1" });
  });
});

describe("useDeleteAttachment", () => {
  it("deletes the file and reads the details again", async () => {
    mockFetch.mockResolvedValue(answer(200, { attachment: attachment() }));
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    const { result } = await renderHook(() => useDeleteAttachment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("attachment-1");
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/attachments\/attachment-1$/);
    expect(init.method).toBe("DELETE");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.vacationDetails() });
  });
});

describe("fetchAttachmentView", () => {
  it("asks for a fresh inline URL on every call", async () => {
    mockFetch
      .mockResolvedValueOnce(answer(200, { url: "https://files/one" }))
      .mockResolvedValueOnce(answer(200, { url: "https://files/two" }));
    const file = attachment({ status: "READY", contentType: "image/jpeg" });

    const first = await fetchAttachmentView(file);
    const second = await fetchAttachmentView(file);

    expect(first.url).toBe("https://files/one");
    expect(second.url).toBe("https://files/two");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toMatch(
      /\/api\/attachments\/attachment-1\/download-url\?disposition=inline$/
    );
  });

  it("returns an image for any image type and a document for a PDF", async () => {
    mockFetch.mockResolvedValue(answer(200, { url: "https://files/x" }));

    await expect(
      fetchAttachmentView(attachment({ contentType: "image/jpeg" }))
    ).resolves.toMatchObject({ kind: "image" });
    await expect(
      fetchAttachmentView(attachment({ contentType: "application/pdf", fileName: "note.pdf" }))
    ).resolves.toEqual({ kind: "document", url: "https://files/x", fileName: "note.pdf" });
  });
});
