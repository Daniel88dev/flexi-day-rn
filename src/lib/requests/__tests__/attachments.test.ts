import type { Attachment } from "@/lib/query/vacation-detail";
import { vacationDetail } from "@/test-support/vacation-detail";

import {
  attachmentAccess,
  attachmentDisplayStatus,
  declaredContentType,
  formatFileSize,
  formUploadsVerdict,
  attachmentSlotsUsed,
  pickProblems,
  processingPollInterval,
  rememberFailedUpload,
  shownAttachments,
} from "../attachments";

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

describe("declaredContentType", () => {
  it("returns the picker's type when it is one the backend takes", () => {
    expect(declaredContentType({ name: "scan.pdf", type: "application/pdf" })).toBe(
      "application/pdf"
    );
  });

  it("returns a type from the extension when the picker reported none", () => {
    expect(declaredContentType({ name: "IMG_0042.HEIC", type: "" })).toBe("image/heic");
    expect(declaredContentType({ name: "photo.heif", type: "" })).toBe("image/heic");
    expect(declaredContentType({ name: "photo.jpg", type: "application/octet-stream" })).toBe(
      "image/jpeg"
    );
  });

  it("returns the reported type for a file with no extension and no usable type", () => {
    expect(declaredContentType({ name: "scan", type: "" })).toBe("");
    expect(declaredContentType({ name: "notes", type: "text/plain" })).toBe("text/plain");
  });
});

describe("pickProblems", () => {
  const MB = 1024 * 1024;
  const file = (name: string, type: string, size = MB) => ({ name, type, size });

  it("returns no problem for files the backend takes, in any accepted type", () => {
    expect(
      pickProblems(
        [
          file("a.png", "image/png"),
          file("b.jpeg", "image/jpeg"),
          file("c.webp", "image/webp"),
          file("d.heic", ""),
          file("e.pdf", "application/pdf"),
        ],
        5
      )
    ).toEqual([null, null, null, null, null]);
  });

  it("returns unsupported for a type the backend refuses, and for a file with no extension or type", () => {
    expect(pickProblems([file("notes.txt", "text/plain"), file("scan", "")], 5)).toEqual([
      "unsupported",
      "unsupported",
    ]);
  });

  it("returns too-large for a file over 10 MB, and none for one of exactly 10 MB", () => {
    expect(
      pickProblems(
        [
          file("big.pdf", "application/pdf", 10 * MB + 1),
          file("ok.pdf", "application/pdf", 10 * MB),
        ],
        5
      )
    ).toEqual(["too-large", null]);
  });

  it("returns limit once the open slots are used, counting only the files that pass", () => {
    expect(
      pickProblems(
        [
          file("a.pdf", "application/pdf"),
          file("big.pdf", "application/pdf", 11 * MB),
          file("b.pdf", "application/pdf"),
          file("c.pdf", "application/pdf"),
        ],
        2
      )
    ).toEqual([null, "too-large", null, "limit"]);
  });

  it("returns limit for every file when no slot is open", () => {
    expect(pickProblems([file("a.pdf", "application/pdf")], 0)).toEqual(["limit"]);
  });
});

describe("attachmentSlotsUsed", () => {
  it("returns the live files still being checked or ready, leaving rejected and deleted ones out", () => {
    expect(
      attachmentSlotsUsed([
        attachment({ id: "a" }),
        attachment({ id: "b", status: "UPLOADING" }),
        attachment({ id: "c", status: "REJECTED" }),
        attachment({ id: "d", deletedAt: "2026-09-21T11:58:00.000Z" }),
      ])
    ).toBe(2);
  });
});

describe("processingPollInterval", () => {
  it("returns three seconds while a file on the screen is still being checked", () => {
    expect(
      processingPollInterval([attachment(), attachment({ id: "b", status: "UPLOADING" })], [], NOW)
    ).toBe(3000);
  });

  it("returns false once every file has settled, and when there are no files", () => {
    expect(
      processingPollInterval([attachment(), attachment({ id: "b", status: "REJECTED" })], [], NOW)
    ).toBe(false);
    expect(processingPollInterval(undefined, [], NOW)).toBe(false);
  });

  it("returns false for a file stuck long enough to count as failed, or deleted", () => {
    expect(
      processingPollInterval(
        [
          attachment({ id: "b", status: "UPLOADING", createdAt: "2026-09-21T11:40:00.000Z" }),
          attachment({ id: "c", status: "UPLOADING", deletedAt: "2026-09-21T11:58:00.000Z" }),
        ],
        [],
        NOW
      )
    ).toBe(false);
  });

  it("returns false for a file whose bytes this session saw fail to arrive", () => {
    const lost = attachment({ id: "lost-1", status: "UPLOADING" });
    expect(processingPollInterval([lost], ["lost-1"], NOW)).toBe(false);
    rememberFailedUpload("lost-2");
    expect(processingPollInterval([{ ...lost, id: "lost-2" }], [], NOW)).toBe(false);
  });
});

describe("attachmentAccess", () => {
  // Eva's own pending request, as the fixture has it.
  const OWNER = "user-2";
  const ADMIN = "user-9";
  const open = { attachments: [], canAttach: true, canDeleteAnyAttachment: false };

  it("returns an open picker for the owner of a live request the backend lets them attach to", () => {
    const access = attachmentAccess(vacationDetail(open), OWNER, true);
    expect(access).toMatchObject({ shown: true, picker: "open", lapsed: false });
  });

  it("returns no picker for someone who is neither the owner nor an editing admin", () => {
    const access = attachmentAccess(vacationDetail(open), ADMIN, true);
    expect(access).toMatchObject({ shown: false, picker: null, lapsed: false });
  });

  it("returns a picker for an admin who may edit the request", () => {
    const access = attachmentAccess(vacationDetail({ ...open, canEdit: true }), ADMIN, true);
    expect(access.picker).toBe("open");
  });

  it("returns no picker for the owner once the request is declined or cancelled", () => {
    for (const patch of [
      { rejectedAt: "2026-09-12T08:00:00.000Z" },
      { deletedAt: "2026-09-12T08:00:00.000Z" },
    ]) {
      expect(
        attachmentAccess(vacationDetail({ ...open, ...patch }), OWNER, true).picker
      ).toBeNull();
    }
  });

  it("returns the lapsed note instead of a picker when the plan takes no uploads", () => {
    const access = attachmentAccess(vacationDetail({ ...open, canAttach: false }), OWNER, false);
    expect(access).toMatchObject({ shown: true, picker: null, lapsed: true });
  });

  it("returns a full picker when all five slots hold files, and none when the backend refuses for another reason", () => {
    const five = Array.from({ length: 5 }, (_, index) => attachment({ id: `f${index}` }));
    expect(
      attachmentAccess(vacationDetail({ attachments: five, canAttach: false }), OWNER, true).picker
    ).toBe("full");
    expect(
      attachmentAccess(vacationDetail({ attachments: [], canAttach: false }), OWNER, true)
    ).toMatchObject({ shown: false, picker: null });
  });

  it("returns nothing to show for a viewer the detail sent no files field to", () => {
    const access = attachmentAccess(vacationDetail({ canAttach: undefined }), OWNER, true);
    expect(access).toMatchObject({ shown: false, picker: null, lapsed: false });
  });

  it("shows the files to someone who may not add any", () => {
    const access = attachmentAccess(
      vacationDetail({ attachments: [attachment()], canAttach: false }),
      ADMIN,
      true
    );
    expect(access).toMatchObject({ shown: true, picker: null });
  });

  it("lets the uploader delete their own file, and an admin delete anyone's", () => {
    const mine = attachment({ uploadedByUserId: OWNER });
    const theirs = attachment({ id: "file-2", uploadedByUserId: ADMIN });
    const asOwner = attachmentAccess(vacationDetail({ attachments: [mine, theirs] }), OWNER, true);
    expect(asOwner.canDelete(mine)).toBe(true);
    expect(asOwner.canDelete(theirs)).toBe(false);

    const asAdmin = attachmentAccess(
      vacationDetail({ attachments: [mine], canDeleteAnyAttachment: true }),
      ADMIN,
      true
    );
    expect(asAdmin.canDelete(mine)).toBe(true);
  });

  it("falls back to canEdit for deleting others' files against a backend without the flag", () => {
    const theirs = attachment({ uploadedByUserId: OWNER });
    const access = attachmentAccess(
      vacationDetail({ attachments: [theirs], canEdit: true }),
      ADMIN,
      true
    );
    expect(access.canDelete(theirs)).toBe(true);
  });

  it("lets no one delete while the viewer is unknown and holds no admin rights", () => {
    const access = attachmentAccess(vacationDetail({ attachments: [attachment()] }), null, true);
    expect(access.canDelete(attachment())).toBe(false);
  });
});

describe("formUploadsVerdict", () => {
  const idle = { queued: 0, inFlight: 0, failed: 0 };

  it("returns settling while a file waits, is sent or is still being checked", () => {
    expect(formUploadsVerdict({ ...idle, queued: 1 }, [], [], NOW)).toBe("settling");
    expect(formUploadsVerdict({ ...idle, inFlight: 1 }, [], [], NOW)).toBe("settling");
    expect(formUploadsVerdict(idle, [attachment({ status: "UPLOADING" })], [], NOW)).toBe(
      "settling"
    );
  });

  it("returns clean once every file is ready, which closes the form", () => {
    expect(formUploadsVerdict(idle, [attachment(), attachment({ id: "file-2" })], [], NOW)).toBe(
      "clean"
    );
  });

  it("returns problems for a rejected file, a lost one, or a pick that failed", () => {
    expect(formUploadsVerdict(idle, [attachment({ status: "REJECTED" })], [], NOW)).toBe(
      "problems"
    );
    expect(
      formUploadsVerdict(idle, [attachment({ id: "lost", status: "UPLOADING" })], ["lost"], NOW)
    ).toBe("problems");
    expect(formUploadsVerdict({ ...idle, failed: 1 }, [attachment()], [], NOW)).toBe("problems");
  });

  it("leaves deleted rows out of the verdict", () => {
    expect(
      formUploadsVerdict(
        idle,
        [
          attachment(),
          attachment({ id: "gone", status: "REJECTED", deletedAt: "2026-09-21T11:59:00.000Z" }),
        ],
        [],
        NOW
      )
    ).toBe("clean");
  });
});
