import { render, screen } from "@testing-library/react-native";

import { Greeting, greetingKey } from "@/components/dashboard/greeting";
import { TranslationProvider } from "@/i18n/use-translation";
import { VIEWER } from "@/test-support/session";

describe("greetingKey", () => {
  it("maps the hour to the part of the day", () => {
    expect(greetingKey(2)).toBe("night");
    expect(greetingKey(9)).toBe("morning");
    expect(greetingKey(15)).toBe("afternoon");
    expect(greetingKey(21)).toBe("evening");
  });
});

describe("Greeting", () => {
  it("greets the viewer by first name", async () => {
    await render(
      <TranslationProvider>
        <Greeting viewer={VIEWER} />
      </TranslationProvider>
    );
    expect(screen.getByText(/Dana$/)).toBeTruthy();
  });

  it("falls back when there is no viewer yet", async () => {
    await render(
      <TranslationProvider>
        <Greeting viewer={null} />
      </TranslationProvider>
    );
    expect(screen.getByText(/there$/)).toBeTruthy();
  });
});
