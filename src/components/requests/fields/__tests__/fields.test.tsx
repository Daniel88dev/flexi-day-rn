import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createRef, type ReactNode } from "react";
import { DeviceEventEmitter, ScrollView, StyleSheet, TextInput } from "react-native";

import { DatesField } from "@/components/requests/fields/dates-field";
import { HalfDayField } from "@/components/requests/fields/half-day-field";
import { NoteField } from "@/components/requests/fields/note-field";
import { TimesField } from "@/components/requests/fields/times-field";
import { TypeField } from "@/components/requests/fields/type-field";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

jest.mock(
  "@react-native-community/datetimepicker",
  () => jest.requireActual("@/test-support/date-time-picker").FakeDateTimePicker
);

function renderField(field: ReactNode) {
  return render(<TranslationProvider>{field}</TranslationProvider>);
}

describe("TypeField", () => {
  it("renders the everyday types, then the others, with the value checked", async () => {
    await renderField(<TypeField value="HOME_OFFICE" onChange={jest.fn()} offerSickDay={false} />);

    expect(screen.getByText(en.recordTypes.VACATION)).toBeOnTheScreen();
    expect(screen.getByText(en.requestForm.others)).toBeOnTheScreen();
    expect(screen.getByText(en.recordTypes.STUDY_LEAVE)).toBeOnTheScreen();
    expect(screen.queryByText(en.recordTypes.SICK_DAY)).toBeNull();
    expect(screen.getByTestId("type-field-HOME_OFFICE")).toHaveProp("accessibilityState", {
      selected: true,
    });
  });

  it("offers Sick day while the benefit is active", async () => {
    await renderField(<TypeField value="VACATION" onChange={jest.fn()} offerSickDay />);

    expect(screen.getByText(en.recordTypes.SICK_DAY)).toBeOnTheScreen();
  });

  it("answers the type tapped", async () => {
    const onChange = jest.fn();
    await renderField(<TypeField value="VACATION" onChange={onChange} offerSickDay={false} />);

    await fireEvent.press(screen.getByTestId("type-field-OTHER"));

    expect(onChange).toHaveBeenCalledWith("OTHER");
  });
});

describe("TimesField", () => {
  it("hides the pickers until Specific times is switched on, then starts at nine to five", async () => {
    const onChange = jest.fn();
    await renderField(<TimesField startTime="" endTime="" onChange={onChange} />);

    expect(screen.queryByTestId("times-field-start")).toBeNull();
    await fireEvent(screen.getByTestId("times-field-switch"), "valueChange", true);

    expect(onChange).toHaveBeenCalledWith({ startTime: "09:00", endTime: "17:00" });
  });

  it("answers a moved time as HH:MM and clears both when switched off", async () => {
    const onChange = jest.fn();
    await renderField(<TimesField startTime="08:00" endTime="12:00" onChange={onChange} />);

    await fireEvent.press(screen.getByTestId("times-field-end"));
    expect(onChange).toHaveBeenLastCalledWith({ startTime: "08:00", endTime: "12:30" });

    await fireEvent(screen.getByTestId("times-field-switch"), "valueChange", false);
    expect(onChange).toHaveBeenLastCalledWith({ startTime: "", endTime: "" });
  });

  it("centres the Specific times switch on its row", async () => {
    await renderField(<TimesField startTime="" endTime="" onChange={jest.fn()} />);

    const style = StyleSheet.flatten(screen.getByTestId("times-field-switch").props.style);
    expect(style.alignSelf).toBe("center");
  });
});

describe("HalfDayField", () => {
  it("renders the switch with its hint and answers the change", async () => {
    const onChange = jest.fn();
    await renderField(<HalfDayField value={false} onChange={onChange} />);

    expect(screen.getByText(en.requestForm.halfDayHint)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId("half-day-field"), "valueChange", true);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("centres the switch on its row", async () => {
    await renderField(<HalfDayField value={false} onChange={jest.fn()} />);

    const style = StyleSheet.flatten(screen.getByTestId("half-day-field").props.style);
    expect(style.alignSelf).toBe("center");
  });
});

describe("NoteField", () => {
  it("labels the note optional, or required for Other", async () => {
    const { rerender } = await renderField(
      <NoteField value="" onChange={jest.fn()} required={false} scrollRef={createRef()} />
    );
    expect(screen.getByText(en.requestForm.note)).toBeOnTheScreen();

    await rerender(
      <TranslationProvider>
        <NoteField value="" onChange={jest.fn()} required scrollRef={createRef()} />
      </TranslationProvider>
    );
    expect(screen.getByText(en.requestForm.noteRequired)).toBeOnTheScreen();
  });

  it("answers what was typed", async () => {
    const onChange = jest.fn();
    await renderField(
      <NoteField value="" onChange={onChange} required={false} scrollRef={createRef()} />
    );

    await fireEvent.changeText(screen.getByTestId("note-field"), "Conference");

    expect(onChange).toHaveBeenCalledWith("Conference");
  });

  it("grows from 96 pt and stops at 180 pt, so a long note scrolls inside the box", async () => {
    await renderField(
      <NoteField value="" onChange={jest.fn()} required={false} scrollRef={createRef()} />
    );

    const classes = String(screen.getByTestId("note-field").props.className).split(" ");
    expect(classes).toEqual(expect.arrayContaining(["min-h-[96px]", "max-h-[180px]"]));
  });

  describe("when the keyboard shows", () => {
    // The sheet's ScrollView sits 116 pt down the window, 700 pt tall, scrolled 150 pt; the box
    // starts 600 pt into the content and is 96 pt tall. A 300 pt keyboard leaves 400 pt.
    const input = TextInput.prototype as unknown as {
      measureLayout: jest.Mock;
      measureInWindow: jest.Mock;
    };
    const scrollTo = jest.fn();
    const scrollRef = {
      current: {
        scrollTo,
        getNativeScrollRef: () => ({
          measureInWindow: (answer: (...frame: number[]) => void) => answer(0, 116, 402, 700),
        }),
      } as unknown as ScrollView,
    };
    const showKeyboard = () =>
      act(() => {
        DeviceEventEmitter.emit("keyboardDidShow", {
          endCoordinates: { screenX: 0, screenY: 574, width: 402, height: 300 },
        });
      });

    const growBox = () =>
      fireEvent(screen.getByTestId("note-field"), "layout", {
        nativeEvent: { layout: { x: 16, y: 600, width: 370, height: 180 } },
      });

    beforeEach(() => {
      scrollTo.mockReset();
      input.measureLayout.mockImplementation((_relativeTo, answer) => answer(16, 600, 370, 96));
      input.measureInWindow.mockImplementation((answer) => answer(16, 116 + 600 - 150, 370, 96));
    });

    afterEach(() => {
      DeviceEventEmitter.emit("keyboardDidHide", {
        endCoordinates: { screenX: 0, screenY: 874, width: 402, height: 0 },
      });
      input.measureLayout.mockReset();
      input.measureInWindow.mockReset();
    });

    it("scrolls the sheet so the box's bottom edge sits above the keyboard", async () => {
      await renderField(
        <NoteField value="" onChange={jest.fn()} required={false} scrollRef={scrollRef} />
      );

      await fireEvent(screen.getByTestId("note-field"), "focus");
      await showKeyboard();

      expect(scrollTo).toHaveBeenCalledWith({ y: 308, animated: true });
    });

    it("scrolls again as the box grows toward its cap, so its bottom edge stays above the keyboard", async () => {
      await renderField(
        <NoteField value="" onChange={jest.fn()} required={false} scrollRef={scrollRef} />
      );
      await fireEvent(screen.getByTestId("note-field"), "focus");
      await showKeyboard();
      scrollTo.mockReset();

      // Scrolled to 308, the box has grown to 180 pt.
      input.measureLayout.mockImplementation((_relativeTo, answer) => answer(16, 600, 370, 180));
      input.measureInWindow.mockImplementation((answer) => answer(16, 116 + 600 - 308, 370, 180));
      await growBox();

      expect(scrollTo).toHaveBeenCalledWith({ y: 392, animated: true });
    });

    it("leaves the sheet alone when the box grows while the note is not focused", async () => {
      await renderField(
        <NoteField value="" onChange={jest.fn()} required={false} scrollRef={scrollRef} />
      );
      await fireEvent(screen.getByTestId("note-field"), "focus");
      await showKeyboard();
      await fireEvent(screen.getByTestId("note-field"), "blur");
      scrollTo.mockReset();

      await growBox();

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("leaves the sheet alone while the note is not focused", async () => {
      await renderField(
        <NoteField value="" onChange={jest.fn()} required={false} scrollRef={scrollRef} />
      );

      await fireEvent(screen.getByTestId("note-field"), "focus");
      await fireEvent(screen.getByTestId("note-field"), "blur");
      await showKeyboard();

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});

describe("DatesField", () => {
  const WINDOW = { min: "2026-01-01", max: "2027-12-31" };

  it("renders From within the bookable window and To from From onwards", async () => {
    await renderField(
      <DatesField
        from="2026-10-05"
        to="2026-10-07"
        window={WINDOW}
        onFrom={jest.fn()}
        onTo={jest.fn()}
      />
    );

    const from = screen.getByTestId("dates-field-from");
    const to = screen.getByTestId("dates-field-to");
    expect(from.props.accessibilityValue.text).toBe("2026-10-05");
    expect(from.props.accessibilityHint).toBe("2026-01-01..2027-12-31");
    expect(to.props.accessibilityValue.text).toBe("2026-10-07");
    expect(to.props.accessibilityHint).toBe("2026-10-05..2027-12-31");
  });

  it("answers a picked day as YYYY-MM-DD", async () => {
    const onFrom = jest.fn();
    const onTo = jest.fn();
    await renderField(
      <DatesField from="2026-10-05" to="2026-10-07" window={WINDOW} onFrom={onFrom} onTo={onTo} />
    );

    await fireEvent.press(screen.getByTestId("dates-field-from"));
    await fireEvent.press(screen.getByTestId("dates-field-to"));

    expect(onFrom).toHaveBeenCalledWith("2026-10-07");
    expect(onTo).toHaveBeenCalledWith("2026-10-09");
  });
});
