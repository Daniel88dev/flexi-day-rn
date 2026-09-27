import type { Attachment } from "@/lib/query/vacation-detail";
import { vacationDetail } from "@/test-support/vacation-detail";

import { mergeTimeline } from "../timeline";

const ADMIN = { id: "user-9", name: "Petr Admin", initials: "PA", avatarColor: "hsl(0 0% 50%)" };

function attachment(patch: Partial<Attachment> = {}): Attachment {
  return {
    id: "file-1",
    fileName: "doctor.pdf",
    contentType: "application/pdf",
    size: 2048,
    status: "READY",
    rejectionReason: null,
    uploadedByUserId: "user-2",
    createdAt: "2026-09-10T09:00:00.000Z",
    deletedAt: null,
    deletedByUserId: null,
    ...patch,
  };
}

describe("mergeTimeline", () => {
  it("returns the history as it came, oldest first, with its actors named", () => {
    const entries = mergeTimeline(
      vacationDetail({
        history: [
          {
            id: "event-2",
            eventType: "REJECTED",
            actor: ADMIN,
            reason: "Too many away",
            createdAt: "2026-09-11T08:00:00.000Z",
          },
          {
            id: "event-1",
            eventType: "CREATED",
            actor: null,
            reason: null,
            createdAt: "2026-09-10T08:00:00.000Z",
          },
        ],
      })
    );

    expect(entries).toEqual([
      expect.objectContaining({ id: "event-1", kind: "CREATED", actor: { kind: "gone" } }),
      expect.objectContaining({
        id: "event-2",
        kind: "REJECTED",
        actor: { kind: "named", user: ADMIN },
        reason: "Too many away",
      }),
    ]);
  });

  it("returns an entry for a file once it was accepted and another once it was removed", () => {
    const entries = mergeTimeline(
      vacationDetail({
        attachments: [
          attachment({ deletedAt: "2026-09-12T08:00:00.000Z", deletedByUserId: "user-9" }),
        ],
      })
    );

    expect(entries.map((entry) => [entry.kind, entry.fileName])).toEqual([
      ["CREATED", null],
      ["ATTACHMENT_ADDED", "doctor.pdf"],
      ["ATTACHMENT_REMOVED", "doctor.pdf"],
    ]);
    expect(entries[1].actor).toEqual({
      kind: "named",
      user: expect.objectContaining({ id: "user-2" }),
    });
    expect(entries[2].actor).toEqual({ kind: "unnamed" });
  });

  it("returns no entry for a file that never passed the checks", () => {
    const entries = mergeTimeline(
      vacationDetail({
        attachments: [
          attachment({ status: "UPLOADING" }),
          attachment({ id: "file-2", status: "REJECTED" }),
        ],
      })
    );

    expect(entries.map((entry) => entry.kind)).toEqual(["CREATED"]);
  });
});
