import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

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
});

describe("HalfDayField", () => {
  it("renders the switch with its hint and answers the change", async () => {
    const onChange = jest.fn();
    await renderField(<HalfDayField value={false} onChange={onChange} />);

    expect(screen.getByText(en.requestForm.halfDayHint)).toBeOnTheScreen();
    await fireEvent(screen.getByTestId("half-day-field"), "valueChange", true);

    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("NoteField", () => {
  it("labels the note optional, or required for Other", async () => {
    const { rerender } = await renderField(
      <NoteField value="" onChange={jest.fn()} required={false} />
    );
    expect(screen.getByText(en.requestForm.note)).toBeOnTheScreen();

    await rerender(
      <TranslationProvider>
        <NoteField value="" onChange={jest.fn()} required />
      </TranslationProvider>
    );
    expect(screen.getByText(en.requestForm.noteRequired)).toBeOnTheScreen();
  });

  it("answers what was typed", async () => {
    const onChange = jest.fn();
    await renderField(<NoteField value="" onChange={onChange} required={false} />);

    await fireEvent.changeText(screen.getByTestId("note-field"), "Conference");

    expect(onChange).toHaveBeenCalledWith("Conference");
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
