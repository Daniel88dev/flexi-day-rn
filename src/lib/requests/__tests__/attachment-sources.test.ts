import * as ImagePicker from "expo-image-picker";

import { fakeFiles } from "@/test-support/fake-file-system";

import { chooseFiles, choosePhotos, takePhoto } from "../attachment-sources";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  UIImagePickerPreferredAssetRepresentationMode: { Compatible: "compatible" },
}));
jest.mock(
  "expo-file-system",
  () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem
);

const requestCamera = ImagePicker.requestCameraPermissionsAsync as jest.Mock;
const launchCamera = ImagePicker.launchCameraAsync as jest.Mock;
const launchLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  fakeFiles.reset();
});

describe("takePhoto", () => {
  it("returns denied without opening the camera when the permission is refused", async () => {
    requestCamera.mockResolvedValue({ granted: false, canAskAgain: false });

    await expect(takePhoto()).resolves.toEqual({ kind: "denied" });
    expect(launchCamera).not.toHaveBeenCalled();
  });

  it("returns the photo named after its file when the camera gives no name, sized on disk", async () => {
    requestCamera.mockResolvedValue({ granted: true });
    fakeFiles.put("file:///cache/ImagePicker/8C1F.jpg", 1234);
    launchCamera.mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///cache/ImagePicker/8C1F.jpg", fileName: null, mimeType: "image/jpeg" },
      ],
    });

    await expect(takePhoto()).resolves.toEqual({
      kind: "picked",
      files: [
        {
          uri: "file:///cache/ImagePicker/8C1F.jpg",
          name: "8C1F.jpg",
          type: "image/jpeg",
          size: 1234,
        },
      ],
    });
    expect(launchCamera).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images"], quality: expect.any(Number) })
    );
  });

  it("returns cancelled when the person closes the camera", async () => {
    requestCamera.mockResolvedValue({ granted: true });
    launchCamera.mockResolvedValue({ canceled: true, assets: null });

    await expect(takePhoto()).resolves.toEqual({ kind: "cancelled" });
  });

  it("returns unavailable when the device has no camera", async () => {
    requestCamera.mockResolvedValue({ granted: true });
    launchCamera.mockRejectedValue(new Error("Camera not available on simulator"));

    await expect(takePhoto()).resolves.toEqual({ kind: "unavailable" });
  });
});

describe("choosePhotos", () => {
  it("opens the library for up to the open slots, asking iOS for a compatible JPEG", async () => {
    fakeFiles.put("file:///a.jpg", 10);
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///a.jpg", fileName: "IMG_1.jpg", mimeType: "image/jpeg" }],
    });

    await choosePhotos(3);

    expect(launchLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 3,
        preferredAssetRepresentationMode: "compatible",
      })
    );
  });

  it("returns the size of the re-encoded file on disk, not the original asset's", async () => {
    // The original HEIC was 14 MB; the 0.8 JPEG the picker wrote is what gets uploaded.
    fakeFiles.put("file:///cache/ImagePicker/IMG_1.jpg", 3_200_000);
    launchLibrary.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file:///cache/ImagePicker/IMG_1.jpg",
          fileName: "IMG_1.jpg",
          mimeType: "image/jpeg",
          fileSize: 14_000_000,
        },
      ],
    });

    const pick = await choosePhotos(5);

    expect(pick).toEqual({
      kind: "picked",
      files: [
        {
          uri: "file:///cache/ImagePicker/IMG_1.jpg",
          name: "IMG_1.jpg",
          type: "image/jpeg",
          size: 3_200_000,
        },
      ],
    });
  });

  it("returns cancelled when nothing was chosen", async () => {
    launchLibrary.mockResolvedValue({ canceled: true, assets: null });

    await expect(choosePhotos(5)).resolves.toEqual({ kind: "cancelled" });
  });
});

describe("chooseFiles", () => {
  it("opens the document picker for several files of the accepted types", async () => {
    fakeFiles.pickFileAsync.mockResolvedValue({ canceled: true, result: null });

    await chooseFiles();

    expect(fakeFiles.pickFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        multipleFiles: true,
        mimeTypes: expect.arrayContaining(["application/pdf", "image/heic"]),
      })
    );
  });

  it("returns the files as still in the inbox, copying nothing before the checks", async () => {
    fakeFiles.pickFileAsync.mockResolvedValue({
      canceled: false,
      result: [
        {
          uri: "file:///tmp/Inbox/scan.pdf",
          name: "scan.pdf",
          type: "application/pdf",
          size: 4096,
        },
      ],
    });

    await expect(chooseFiles()).resolves.toEqual({
      kind: "picked",
      files: [
        {
          uri: "file:///tmp/Inbox/scan.pdf",
          name: "scan.pdf",
          type: "application/pdf",
          size: 4096,
          inbox: true,
        },
      ],
    });
    expect(fakeFiles.under("file:///cache")).toEqual([]);
  });

  it("returns cancelled when the picker was dismissed", async () => {
    fakeFiles.pickFileAsync.mockResolvedValue({ canceled: true, result: null });

    await expect(chooseFiles()).resolves.toEqual({ kind: "cancelled" });
  });
});
