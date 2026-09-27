import type { UploadOptions } from "expo-file-system";

import { fakeFiles } from "@/test-support/fake-file-system";

import {
  UploadError,
  discardPickedCopy,
  keepPickedCopy,
  sweepPickedCopies,
  uploadToTarget,
} from "../attachment-files";

jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);

const mockUpload = fakeFiles.upload;

const photo = {
  uri: "file:///tmp/IMG_0042.HEIC",
  name: "IMG_0042.HEIC",
  type: "",
  size: 2048,
};

const presignedPost = {
  url: "https://bucket.s3.eu-central-1.amazonaws.com/",
  method: "POST" as const,
  fields: {
    key: "org/user/attachment-1",
    "Content-Type": "image/heic",
    Policy: "policy",
    "X-Amz-Signature": "signature",
  },
  expiresAt: "2026-09-27T12:10:00.000Z",
};

const localPut = {
  url: "http://localhost:8080/api/attachments/local/upload/attachment-1?signature=s",
  method: "PUT" as const,
  headers: { "Content-Type": "image/heic" },
  expiresAt: "2026-09-27T12:10:00.000Z",
};

beforeEach(() => {
  fakeFiles.reset();
  fakeFiles.put(photo.uri, photo.size);
});

describe("uploadToTarget", () => {
  it("sends a presigned POST as multipart with the signed fields first and the file last, named file", async () => {
    await uploadToTarget(presignedPost, photo);

    const [uri, url, options] = mockUpload.mock.calls[0] as [string, string, UploadOptions];
    expect(uri).toBe(photo.uri);
    expect(url).toBe(presignedPost.url);
    expect(options).toMatchObject({
      httpMethod: "POST",
      uploadType: 1,
      fieldName: "file",
      mimeType: "image/heic",
    });
    // The native side writes `parameters` in order, then the file part.
    expect(Object.entries(options.parameters ?? {})).toEqual(Object.entries(presignedPost.fields));
    expect(options.headers).toBeUndefined();
  });

  it("sends the local target's raw bytes as a PUT with its headers", async () => {
    await uploadToTarget(localPut, photo);

    const [, url, options] = mockUpload.mock.calls[0] as [string, string, UploadOptions];
    expect(url).toBe(localPut.url);
    expect(options).toMatchObject({
      httpMethod: "PUT",
      uploadType: 0,
      headers: { "Content-Type": "image/heic" },
    });
    expect(options.parameters).toBeUndefined();
  });

  it("reports progress as a fraction, and 1 once the store took the bytes", async () => {
    mockUpload.mockImplementation(async (_uri, _url, options) => {
      const { onProgress } = options as { onProgress: (data: object) => void };
      onProgress({ bytesSent: 512, totalBytes: 2048 });
      onProgress({ bytesSent: 1024, totalBytes: 0 });
      return { status: 200, body: "", headers: {} };
    });
    const progress: number[] = [];

    await uploadToTarget(localPut, photo, (fraction) => progress.push(fraction));

    expect(progress).toEqual([0.25, 1]);
  });

  it("throws an UploadError with the status when the store refuses the bytes", async () => {
    mockUpload.mockResolvedValue({ status: 403, body: "<Error/>", headers: {} });

    await expect(uploadToTarget(presignedPost, photo)).rejects.toMatchObject({
      name: "UploadError",
      status: 403,
    });
  });

  it("throws an UploadError without starting a transfer when the file is gone", async () => {
    fakeFiles.reset();

    await expect(uploadToTarget(localPut, photo)).rejects.toMatchObject({
      name: "UploadError",
      status: 0,
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("throws an UploadError with no status when the transfer never finished", async () => {
    mockUpload.mockRejectedValue(new Error("The network connection was lost."));

    const failure = await uploadToTarget(localPut, photo).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(UploadError);
    expect(failure).toMatchObject({ status: 0 });
  });
});

describe("keepPickedCopy", () => {
  const inbox = {
    uri: "file:///tmp/Inbox/scan.pdf",
    name: "scan.pdf",
    type: "application/pdf",
    size: 4096,
    inbox: true,
  };

  it("copies a file from the picker's inbox into a folder of its own in the cache", async () => {
    fakeFiles.put(inbox.uri, inbox.size);

    const first = await keepPickedCopy(inbox);
    const second = await keepPickedCopy(inbox);

    expect(first.uri).toMatch(/^file:\/\/\/cache\/attachment-picks\/\d+-\d+\/scan\.pdf$/);
    expect(second.uri).not.toBe(first.uri);
    expect(first).toMatchObject({ name: "scan.pdf", type: "application/pdf", size: 4096 });
    expect(first.inbox).toBeFalsy();
    expect(fakeFiles.has(first.uri)).toBe(true);
  });

  it("returns a file outside the inbox as it is", async () => {
    await expect(keepPickedCopy(photo)).resolves.toBe(photo);
    expect(fakeFiles.under("file:///cache")).toEqual([]);
  });
});

describe("discardPickedCopy", () => {
  it("deletes the kept copy's folder", async () => {
    fakeFiles.put("file:///tmp/Inbox/a.pdf", 10);
    const kept = await keepPickedCopy({
      uri: "file:///tmp/Inbox/a.pdf",
      name: "a.pdf",
      type: "application/pdf",
      size: 10,
      inbox: true,
    });

    discardPickedCopy(kept);

    expect(fakeFiles.under("file:///cache/attachment-picks")).toEqual([]);
  });

  it("leaves a file it did not copy alone", () => {
    discardPickedCopy(photo);

    expect(fakeFiles.has(photo.uri)).toBe(true);
  });
});

describe("sweepPickedCopies", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const NOW = Date.parse("2026-09-28T12:00:00.000Z");

  it("deletes the copies left over from more than a day ago and keeps the recent ones", () => {
    fakeFiles.put(`file:///cache/attachment-picks/${NOW - DAY - 1}-1/old.pdf`, 1);
    fakeFiles.put(`file:///cache/attachment-picks/${NOW - 60_000}-2/new.pdf`, 1);

    sweepPickedCopies(NOW);

    expect(fakeFiles.under("file:///cache/attachment-picks")).toEqual([
      `file:///cache/attachment-picks/${NOW - 60_000}-2/new.pdf`,
    ]);
  });

  it("does nothing when nothing was ever kept", () => {
    expect(() => sweepPickedCopies(NOW)).not.toThrow();
  });
});
