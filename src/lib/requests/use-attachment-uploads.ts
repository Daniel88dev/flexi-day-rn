import { useEffect, useRef, useState } from "react";

import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { useUploadAttachment } from "@/lib/query/attachments";
import { ApiError } from "@/lib/query/failure";
import type { Attachment } from "@/lib/query/vacation-detail";

import {
  UploadError,
  discardPickedCopy,
  keepPickedCopy,
  type PickedFile,
} from "./attachment-files";
import {
  MAX_ATTACHMENTS_PER_REQUEST,
  attachmentSlotsUsed,
  declaredContentType,
  pickProblems,
  rememberFailedUpload,
  type PickProblem,
} from "./attachments";

export type UploadJob = {
  key: number;
  fileName: string;
  contentType: string;
  size: number;
  progress: number;
  queued: boolean;
  attachmentId?: string;
  done: boolean;
  error?: string;
};

/** A copy that failed resolves to null: its job fails, and there is nothing to delete. */
type Prepared = Promise<PickedFile | null>;

function problemMessage(problem: PickProblem, t: Dictionary): string {
  if (problem === "limit") return t.attachments.limitReached;
  if (problem === "unsupported") return t.attachments.unsupportedType;
  return t.attachments.tooLarge;
}

function uploadErrorMessage(error: unknown, t: Dictionary): string {
  if (error instanceof ApiError) {
    if (error.status === 402) return t.attachments.paidPlanOnly;
    if (error.status === 403) return t.attachments.attachForbidden;
    const reason = error.context?.reason;
    if (reason === "UNSUPPORTED_TYPE") return t.attachments.unsupportedType;
    if (reason === "FILE_TOO_LARGE") return t.attachments.tooLarge;
    if (reason === "ATTACHMENT_LIMIT") return t.attachments.limitReached;
    return error.serverMessage ?? t.attachments.uploadFailed;
  }
  return t.attachments.uploadFailed;
}

const discardWhenReady = (prepared: Prepared) =>
  void prepared.then((file) => file && discardPickedCopy(file));

export type AttachmentUploads = ReturnType<typeof useAttachmentUploads>;

/** A port of the web's hook: with no `requestId` yet, picks wait until `start`. */
export function useAttachmentUploads({
  requestId,
  attachments,
}: {
  requestId: string | null;
  /** Every row of the Request as the detail last read it, deleted ones included. */
  attachments: readonly Attachment[];
}) {
  const { t } = useTranslation();
  const upload = useUploadAttachment();
  const nextKeyRef = useRef(0);
  const waitingRef = useRef(new Map<number, Prepared>());
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  // A registration that got no answer may still have made a row the phone never learned the id of.
  const [unansweredRegistrations, setUnansweredRegistrations] = useState(0);

  useEffect(() => {
    const waiting = waitingRef.current;
    return () => {
      for (const prepared of waiting.values()) discardWhenReady(prepared);
      waiting.clear();
    };
  }, []);

  // A row exists from registration on, so a read mid-transfer would list the same file twice.
  const inFlightIds = jobs.flatMap((job) =>
    job.attachmentId !== undefined && !job.done && !job.error ? [job.attachmentId] : []
  );
  const settled = attachments.filter(
    (attachment) => attachment.deletedAt === null && !inFlightIds.includes(attachment.id)
  );
  const claimed = new Set(jobs.flatMap((job) => (job.attachmentId ? [job.attachmentId] : [])));
  const orphans =
    unansweredRegistrations > 0
      ? settled.filter((row) => row.status === "UPLOADING" && !claimed.has(row.id))
      : [];
  const allFailedIds = [...failedIds, ...orphans.map((row) => row.id)];
  // Against every row, deleted ones too: a job whose row was deleted since has still landed.
  const landed = (job: UploadJob) =>
    job.done &&
    job.attachmentId !== undefined &&
    attachments.some((attachment) => attachment.id === job.attachmentId);
  const visible = jobs.filter((job) => !landed(job));
  const pending = visible.filter((job) => !job.error);
  const queued = pending.filter((job) => job.queued).length;
  const inFlight = pending.length - queued;
  const failed = visible.length - pending.length;
  const remaining = MAX_ATTACHMENTS_PER_REQUEST - attachmentSlotsUsed(settled) - pending.length;

  const orphanKey = orphans.map((row) => row.id).join(",");
  useEffect(() => {
    for (const id of orphanKey ? orphanKey.split(",") : []) rememberFailedUpload(id);
  }, [orphanKey]);

  const patch = (key: number, change: Partial<UploadJob>) =>
    setJobs((current) => current.map((job) => (job.key === key ? { ...job, ...change } : job)));

  const send = async (prepared: Prepared, key: number, id: string) => {
    const file = await prepared;
    if (!file) {
      patch(key, { error: t.attachments.uploadFailed });
      return;
    }
    try {
      const attachment = await upload.mutateAsync({
        requestId: id,
        file,
        onRegistered: (attachmentId) => patch(key, { attachmentId }),
        onProgress: (progress) => patch(key, { progress }),
      });
      patch(key, { attachmentId: attachment.id, done: true, progress: 1 });
    } catch (error) {
      if (error instanceof UploadError && error.attachmentId) {
        const lost = error.attachmentId;
        rememberFailedUpload(lost);
        setFailedIds((current) => [...current, lost]);
        patch(key, { attachmentId: lost, done: true, error: t.attachments.failed });
        return;
      }
      if (!(error instanceof ApiError)) setUnansweredRegistrations((count) => count + 1);
      patch(key, { error: uploadErrorMessage(error, t) });
    } finally {
      discardPickedCopy(file);
    }
  };

  // The jobs enter the state before any transfer starts, so a registration that answers at once
  // still finds its job to stamp the id on.
  const pick = (files: readonly PickedFile[]) => {
    const problems = pickProblems(files, remaining);
    const sending: [Prepared, number][] = [];
    const added = files.map((file, index): UploadJob => {
      const key = nextKeyRef.current++;
      const problem = problems[index];
      if (problem === null) {
        const prepared: Prepared = keepPickedCopy(file).catch(() => null);
        if (requestId === null) waitingRef.current.set(key, prepared);
        else sending.push([prepared, key]);
      }
      return {
        key,
        fileName: file.name,
        contentType: declaredContentType(file),
        size: file.size,
        progress: 0,
        queued: problem === null && requestId === null,
        done: false,
        ...(problem ? { error: problemMessage(problem, t) } : {}),
      };
    });
    setJobs((current) => [...current, ...added]);
    if (requestId !== null)
      for (const [prepared, key] of sending) void send(prepared, key, requestId);
  };

  const start = (id: string): number => {
    const entries = Array.from(waitingRef.current);
    waitingRef.current.clear();
    for (const [key, prepared] of entries) void send(prepared, key, id);
    setJobs((current) => current.map((job) => (job.queued ? { ...job, queued: false } : job)));
    return entries.length;
  };

  const remove = (key: number) => {
    const prepared = waitingRef.current.get(key);
    if (prepared) discardWhenReady(prepared);
    waitingRef.current.delete(key);
    setJobs((current) => current.filter((job) => job.key !== key));
  };

  const reset = () => {
    for (const prepared of waitingRef.current.values()) discardWhenReady(prepared);
    waitingRef.current.clear();
    setJobs([]);
    setFailedIds([]);
    setUnansweredRegistrations(0);
  };

  return {
    jobs: visible,
    settled,
    failedIds: allFailedIds,
    queued,
    inFlight,
    failed,
    remaining,
    full: remaining <= 0,
    pick,
    start,
    remove,
    reset,
  };
}
