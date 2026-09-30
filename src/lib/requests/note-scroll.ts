const NOTE_KEYBOARD_GAP = 12;

type NoteScrollMetrics = {
  /** The note box's top edge in the ScrollView's content coordinates. */
  noteTop: number;
  noteHeight: number;
  scrollOffset: number;
  viewportHeight: number;
  keyboardHeight: number;
};

/**
 * Where the sheet should scroll so the whole note box shows above the keyboard: its bottom edge
 * just above it, or its top edge at the top when the box is taller than the room left. Null when
 * no scroll is needed.
 */
export function noteScrollOffset({
  noteTop,
  noteHeight,
  scrollOffset,
  viewportHeight,
  keyboardHeight,
}: NoteScrollMetrics): number | null {
  const room = viewportHeight - keyboardHeight;
  if (room <= 0) return null;

  const noteBottom = noteTop + noteHeight;
  let target: number;
  if (noteHeight + 2 * NOTE_KEYBOARD_GAP > room) {
    target = noteTop - NOTE_KEYBOARD_GAP;
  } else if (noteTop >= scrollOffset && noteBottom + NOTE_KEYBOARD_GAP <= scrollOffset + room) {
    return null;
  } else {
    target = noteBottom + NOTE_KEYBOARD_GAP - room;
  }

  target = Math.max(0, target);
  return Math.abs(target - scrollOffset) < 1 ? null : target;
}
