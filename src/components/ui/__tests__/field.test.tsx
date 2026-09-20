import { render, screen, userEvent } from "@testing-library/react-native";
import { EnvelopeIcon } from "phosphor-react-native";

import { Field } from "@/components/ui/field";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: jest.fn(() => [{ languageCode: "en" }]) }));

function renderField(element: React.ReactElement) {
  return render(<TranslationProvider>{element}</TranslationProvider>);
}

describe("Field", () => {
  it("renders its label and its input", async () => {
    await renderField(
      <Field label={en.auth.workEmail} icon={EnvelopeIcon} placeholder="dana@northwind.co" />
    );

    expect(screen.getByText(en.auth.workEmail)).toBeTruthy();
    expect(screen.getByPlaceholderText("dana@northwind.co")).toBeTruthy();
  });

  it("hides a secure value until the eye is tapped", async () => {
    await renderField(<Field secure placeholder="Your password" />);

    const input = screen.getByPlaceholderText("Your password");
    expect(input.props.secureTextEntry).toBe(true);

    await userEvent.press(screen.getByLabelText(en.auth.signIn.showPassword));

    expect(input.props.secureTextEntry).toBe(false);
    expect(screen.getByLabelText(en.auth.signIn.hidePassword)).toBeTruthy();
  });

  it("takes nothing while it is not editable", async () => {
    await renderField(<Field placeholder={en.auth.twoFactor.backupPlaceholder} editable={false} />);

    expect(screen.getByPlaceholderText(en.auth.twoFactor.backupPlaceholder).props.editable).toBe(
      false
    );
  });
});
