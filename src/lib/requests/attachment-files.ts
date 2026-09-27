import { Directory, File, Paths, UploadType, type UploadOptions } from "expo-file-system";

import { declaredContentType } from "./attachments";

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  size: number;
  /** In the document picker's inbox, which iOS clears: `keepPickedCopy` before it waits. */
  inbox?: boolean;
};

export type UploadTarget =
  | { url: string; method: "POST"; fields: Record<string, string>; expiresAt: string }
  | { url: string; method: "PUT"; headers: Record<string, string>; expiresAt: string };

export class UploadError extends Error {
  readonly status: number;
  readonly attachmentId?: string;

  constructor(status: number, message: string, attachmentId?: string) {
    super(message);
    this.name = "UploadError";
    this.status = status;
    this.attachmentId = attachmentId;
  }
}

const PICKS_FOLDER = "attachment-picks";
const PICK_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let copies = 0;

const picksRoot = () => new Directory(Paths.cache, PICKS_FOLDER);

// The document picker hands over a copy in the app's inbox, which iOS clears before long, so a file
// that waits for Submit moves into a folder of its own in the cache. The folder name starts with
// the time it was made, so a sweep can clear what a closed app left behind.
export async function keepPickedCopy(file: PickedFile): Promise<PickedFile> {
  if (!file.inbox) return file;
  copies += 1;
  const folder = new Directory(picksRoot(), `${Date.now()}-${copies}`);
  folder.create({ intermediates: true, idempotent: true });
  await new File(file.uri).copy(folder);
  return {
    uri: new File(folder, file.name).uri,
    name: file.name,
    type: file.type,
    size: file.size,
  };
}

export function discardPickedCopy(file: PickedFile): void {
  // A directory's uri ends in a slash on iOS.
  const root = picksRoot().uri.replace(/\/+$/, "");
  if (!file.uri.startsWith(`${root}/`)) return;
  const folder = file.uri.slice(0, file.uri.lastIndexOf("/"));
  new Directory(folder).delete();
}

export function sweepPickedCopies(now: number): void {
  const root = picksRoot();
  if (!root.exists) return;
  for (const entry of root.list()) {
    const madeAt = Number(entry.name.split("-")[0]);
    if (Number.isFinite(madeAt) && now - madeAt > PICK_MAX_AGE_MS) entry.delete();
  }
}

export async function uploadToTarget(
  target: UploadTarget,
  file: PickedFile,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const progress: UploadOptions["onProgress"] = ({ bytesSent, totalBytes }) => {
    if (totalBytes > 0) onProgress?.(Math.min(bytesSent / totalBytes, 1));
  };
  // An S3 POST wants every signed field ahead of the file, named `file`. The native side writes
  // `parameters` first, but its default field name is the file's own name, not `file`.
  const options: UploadOptions =
    target.method === "POST"
      ? {
          httpMethod: "POST",
          uploadType: UploadType.MULTIPART,
          fieldName: "file",
          mimeType: declaredContentType(file),
          parameters: target.fields,
          onProgress: progress,
        }
      : {
          httpMethod: "PUT",
          uploadType: UploadType.BINARY_CONTENT,
          headers: target.headers,
          onProgress: progress,
        };

  const source = new File(file.uri);
  // A background upload of a missing file throws a native exception that takes the app down.
  if (!source.exists) throw new UploadError(0, "The picked file is gone");
  let status: number;
  try {
    ({ status } = await source.upload(target.url, options));
  } catch {
    throw new UploadError(0, "Upload failed");
  }
  if (status < 200 || status >= 300) throw new UploadError(status, `Upload failed (${status})`);
  onProgress?.(1);
}
