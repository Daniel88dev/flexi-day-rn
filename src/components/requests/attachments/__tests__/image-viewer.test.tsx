import { fireEvent, render, screen } from "@testing-library/react-native";

import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

import { ImageViewer } from "../image-viewer";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

async function renderViewer(onClose = jest.fn()) {
  await render(
    <TranslationProvider>
      <ImageViewer image={{ url: "https://files/1", fileName: "scan.jpg" }} onClose={onClose} />
    </TranslationProvider>
  );
  return onClose;
}

describe("ImageViewer", () => {
  it("shows the image with its name and closes on the close button", async () => {
    const onClose = await renderViewer();

    expect(screen.getByTestId("image-viewer-image")).toHaveProp("source", {
      uri: "https://files/1",
    });
    expect(screen.getByText("scan.jpg")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText(en.attachments.close));

    expect(onClose).toHaveBeenCalled();
  });

  it("says so when the image cannot be shown", async () => {
    await renderViewer();

    await fireEvent(screen.getByTestId("image-viewer-image"), "error");

    expect(screen.getByText(en.attachments.imageFailed)).toBeOnTheScreen();
  });
});
