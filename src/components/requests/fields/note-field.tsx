import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Keyboard, ScrollView, TextInput, View } from "react-native";

import { FieldLabel } from "@/components/requests/fields/field-label";
import { useTone } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { noteScrollOffset } from "@/lib/requests/note-scroll";

/**
 * UIKit scrolls only the caret into view, leaving most of the box under the keyboard. The sheets
 * reach the bottom of the screen, so the keyboard covers its own height of the ScrollView. Only
 * differences of window coordinates are used, so the sheet's inset drops out.
 */
function useScrollAboveKeyboard(
  scrollRef: RefObject<ScrollView | null>,
  inputRef: RefObject<TextInput | null>
) {
  const focusedRef = useRef(false);

  const scrollAboveKeyboard = useCallback(
    (keyboardHeight: number) => {
      const scroll = scrollRef.current;
      const viewport = scroll?.getNativeScrollRef();
      const input = inputRef.current;
      if (!scroll || !viewport || !input) return;

      // measureLayout answers in content coordinates, measureInWindow after the scroll offset.
      input.measureLayout(viewport, (_x, noteTop, _w, noteHeight) =>
        viewport.measureInWindow((_vx, viewportY, _vw, viewportHeight) =>
          input.measureInWindow((_nx, noteY) => {
            const y = noteScrollOffset({
              noteTop,
              noteHeight,
              scrollOffset: noteTop - (noteY - viewportY),
              viewportHeight,
              keyboardHeight,
            });
            if (y !== null) scroll.scrollTo({ y, animated: true });
          })
        )
      );
    },
    [scrollRef, inputRef]
  );

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", (event) => {
      if (focusedRef.current) scrollAboveKeyboard(event.endCoordinates.height);
    });
    return () => subscription.remove();
  }, [scrollAboveKeyboard]);

  const scrollIfKeyboardUp = () => {
    const metrics = Keyboard.metrics();
    if (Keyboard.isVisible() && metrics) scrollAboveKeyboard(metrics.height);
  };

  return {
    onFocus: () => {
      focusedRef.current = true;
      scrollIfKeyboardUp();
    },
    onBlur: () => {
      focusedRef.current = false;
    },
    // The box stops resizing at its max height; past that the caret scrolls inside it natively.
    onLayout: () => {
      if (focusedRef.current) scrollIfKeyboardUp();
    },
  };
}

export function NoteField({
  value,
  onChange,
  required,
  scrollRef,
}: {
  value: string;
  onChange: (note: string) => void;
  required: boolean;
  scrollRef: RefObject<ScrollView | null>;
}) {
  const { t } = useTranslation();
  const faint = useTone("faint");
  const primary = useTone("primary");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const aboveKeyboard = useScrollAboveKeyboard(scrollRef, inputRef);

  return (
    <View>
      <FieldLabel>{required ? t.requestForm.noteRequired : t.requestForm.note}</FieldLabel>
      <TextInput
        ref={inputRef}
        testID="note-field"
        accessibilityLabel={required ? t.requestForm.noteRequired : t.requestForm.note}
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={1000}
        placeholder={t.requestForm.notePlaceholder}
        placeholderTextColor={faint}
        selectionColor={primary}
        onFocus={() => {
          setFocused(true);
          aboveKeyboard.onFocus();
        }}
        onBlur={() => {
          setFocused(false);
          aboveKeyboard.onBlur();
        }}
        onLayout={aboveKeyboard.onLayout}
        textAlignVertical="top"
        className={cn(
          "max-h-[180px] min-h-[96px] rounded-[12px] border bg-card px-4 pt-3 pb-3 font-sans text-[16px] text-foreground",
          focused ? "border-primary" : "border-input"
        )}
      />
    </View>
  );
}
