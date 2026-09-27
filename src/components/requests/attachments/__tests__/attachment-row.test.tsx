import { fireEvent, render, screen } from "@testing-library/react-native";
import { TrashIcon } from "phosphor-react-native";

import { AttachmentRow, RowAction } from "../attachment-row";

describe("AttachmentRow", () => {
  it("renders the name, meta, note and progress of a file being sent", async () => {
    await render(
      <AttachmentRow
        contentType="image/jpeg"
        name="IMG_1.jpg"
        meta="Uploading… 40%"
        note="Checking the file…"
        progress={0.4}
      />
    );

    expect(screen.getByText("IMG_1.jpg")).toBeOnTheScreen();
    expect(screen.getByText("Uploading… 40%")).toBeOnTheScreen();
    expect(screen.getByText("Checking the file…")).toBeOnTheScreen();
    expect(screen.getByRole("progressbar")).toHaveProp("accessibilityValue", {
      min: 0,
      max: 100,
      now: 40,
    });
  });

  it("opens a stored file on tap and runs its trailing action", async () => {
    const onOpen = jest.fn();
    const onDelete = jest.fn();
    await render(
      <AttachmentRow
        contentType="application/pdf"
        name="note.pdf"
        meta="2 kB"
        onPress={onOpen}
        pressLabel="Open note.pdf"
        trailing={<RowAction label="Delete note.pdf" icon={TrashIcon} onPress={onDelete} />}
      />
    );

    await fireEvent.press(screen.getByLabelText("Open note.pdf"));
    await fireEvent.press(screen.getByLabelText("Delete note.pdf"));

    expect(onOpen).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
