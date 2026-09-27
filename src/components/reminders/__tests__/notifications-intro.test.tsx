import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { NotificationsIntro } from "@/components/reminders/notifications-intro";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

async function renderIntro() {
  const onContinue = jest.fn().mockResolvedValue("granted");
  const onDismiss = jest.fn();
  await render(
    <TranslationProvider>
      <NotificationsIntro onContinue={onContinue} onDismiss={onDismiss} />
    </TranslationProvider>
  );
  return { onContinue, onDismiss };
}

describe("NotificationsIntro", () => {
  it("renders both kinds of notification it asks for", async () => {
    await renderIntro();

    expect(screen.getByText(en.reminders.intro.title)).toBeOnTheScreen();
    expect(screen.getByText(en.reminders.intro.requests)).toBeOnTheScreen();
    expect(screen.getByText(en.reminders.intro.reminders)).toBeOnTheScreen();
  });

  it("asks iOS on Continue, then closes", async () => {
    const { onContinue, onDismiss } = await renderIntro();

    await act(async () => fireEvent.press(screen.getByTestId("notifications-intro-continue")));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("closes without asking on Not now", async () => {
    const { onContinue, onDismiss } = await renderIntro();

    await act(async () => fireEvent.press(screen.getByTestId("notifications-intro-not-now")));

    expect(onContinue).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
