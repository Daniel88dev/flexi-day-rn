import type { Attachment } from "@/lib/query/vacation-detail";

import { attachmentDisplayStatus, formatFileSize, shownAttachments } from "../attachments";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");

function attachment(patch: Partial<Attachment> = {}): Attachment {
  return {
    id: "file-1",
    fileName: "doctor.pdf",
    contentType: "application/pdf",
    size: 2048,
    status: "READY",
    rejectionReason: null,
    uploadedByUserId: "user-2",
    createdAt: "2026-09-21T11:55:00.000Z",
    deletedAt: null,
    deletedByUserId: null,
    ...patch,
  };
}

describe("attachmentDisplayStatus", () => {
  it("returns ready and rejected as the server says", () => {
    expect(attachmentDisplayStatus(attachment(), NOW)).toBe("ready");
    expect(attachmentDisplayStatus(attachment({ status: "REJECTED" }), NOW)).toBe("rejected");
  });

  it("returns processing for a fresh upload and failed for one stuck past ten minutes", () => {
    expect(attachmentDisplayStatus(attachment({ status: "UPLOADING" }), NOW)).toBe("processing");
    expect(
      attachmentDisplayStatus(
        attachment({ status: "UPLOADING", createdAt: "2026-09-21T11:40:00.000Z" }),
        NOW
      )
    ).toBe("failed");
  });
});

describe("formatFileSize", () => {
  it("returns bytes, kilobytes and megabytes in the locale's numbers", () => {
    expect(formatFileSize(512, "en-GB")).toBe("512 B");
    expect(formatFileSize(2048, "en-GB")).toBe("2 kB");
    expect(formatFileSize(1.5 * 1024 * 1024, "cs-CZ")).toBe("1,5 MB");
  });
});

describe("shownAttachments", () => {
  it("returns the files still attached, leaving the deleted ones out", () => {
    expect(
      shownAttachments([
        attachment(),
        attachment({ id: "file-2", deletedAt: "2026-09-21T11:58:00.000Z" }),
      ]).map((file) => file.id)
    ).toEqual(["file-1"]);
  });

  it("returns nothing for a viewer the detail sent no files to", () => {
    expect(shownAttachments(undefined)).toEqual([]);
  });
});
