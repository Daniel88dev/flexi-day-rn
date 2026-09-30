import { noteScrollOffset } from "../note-scroll";

// A 700 pt viewport under a 300 pt keyboard leaves 400 pt of sheet visible.
const SHEET = { viewportHeight: 700, keyboardHeight: 300 };

describe("noteScrollOffset", () => {
  it("returns the offset that puts the bottom edge 12 pt above the keyboard", () => {
    expect(noteScrollOffset({ ...SHEET, noteTop: 600, noteHeight: 96, scrollOffset: 150 })).toBe(
      308
    );
  });

  it("returns the offset that puts the top edge 12 pt below the sheet's top when the note is taller than the space", () => {
    expect(noteScrollOffset({ ...SHEET, noteTop: 600, noteHeight: 380, scrollOffset: 150 })).toBe(
      588
    );
  });

  it("returns null when the whole note already shows above the keyboard", () => {
    expect(
      noteScrollOffset({ ...SHEET, noteTop: 600, noteHeight: 96, scrollOffset: 320 })
    ).toBeNull();
  });

  it("returns the bottom-edge offset when the note sits above the visible part", () => {
    expect(noteScrollOffset({ ...SHEET, noteTop: 600, noteHeight: 96, scrollOffset: 650 })).toBe(
      308
    );
  });

  it("returns 0 rather than an offset above the content", () => {
    expect(noteScrollOffset({ ...SHEET, noteTop: 20, noteHeight: 96, scrollOffset: 100 })).toBe(0);
  });

  it("returns null when the tall note's top edge is already lined up", () => {
    expect(
      noteScrollOffset({ ...SHEET, noteTop: 600, noteHeight: 380, scrollOffset: 588 })
    ).toBeNull();
  });

  it("returns null when the keyboard leaves no room", () => {
    expect(
      noteScrollOffset({
        noteTop: 600,
        noteHeight: 96,
        scrollOffset: 150,
        viewportHeight: 300,
        keyboardHeight: 300,
      })
    ).toBeNull();
  });
});
