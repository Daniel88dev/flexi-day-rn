import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

import type { PickedFile } from "./attachment-files";
import { ACCEPTED_CONTENT_TYPES } from "./attachments";

export type SourcePick =
  | { kind: "picked"; files: PickedFile[] }
  | { kind: "cancelled" }
  | { kind: "denied" }
  | { kind: "unavailable" };

// JPEG keeps the photo viewable in any approver's browser, and the quality keeps it under 10 MB.
const PHOTO_QUALITY = 0.8;

function baseName(uri: string): string {
  return decodeURIComponent(uri.split("/").pop() ?? "photo.jpg");
}

// The asset's `fileSize` can be the original's, not the re-encoded JPEG the picker wrote, and the
// presign's size range is built from the size declared here.
function fromAsset(asset: ImagePicker.ImagePickerAsset): PickedFile {
  return {
    uri: asset.uri,
    name: asset.fileName || baseName(asset.uri),
    type: asset.mimeType ?? "",
    size: new File(asset.uri).size || (asset.fileSize ?? 0),
  };
}

function fromResult(result: ImagePicker.ImagePickerResult): SourcePick {
  return result.canceled
    ? { kind: "cancelled" }
    : { kind: "picked", files: result.assets.map(fromAsset) };
}

export async function takePhoto(): Promise<SourcePick> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { kind: "denied" };
  try {
    return fromResult(
      await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: PHOTO_QUALITY })
    );
  } catch {
    return { kind: "unavailable" };
  }
}

export async function choosePhotos(openSlots: number): Promise<SourcePick> {
  return fromResult(
    await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: Math.max(openSlots, 1),
      quality: PHOTO_QUALITY,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    })
  );
}

export async function chooseFiles(): Promise<SourcePick> {
  const picked = await File.pickFileAsync({
    multipleFiles: true,
    mimeTypes: [...ACCEPTED_CONTENT_TYPES],
  });
  if (picked.canceled) return { kind: "cancelled" };
  return {
    kind: "picked",
    files: picked.result.map((file) => ({
      uri: file.uri,
      name: file.name,
      type: file.type,
      size: file.size,
      inbox: true,
    })),
  };
}
