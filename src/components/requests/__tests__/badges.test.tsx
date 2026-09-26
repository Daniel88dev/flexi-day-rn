import { render, screen } from "@testing-library/react-native";

import { SendingBadge, StatusBadge, TypeBadge } from "@/components/requests/badges";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

describe("StatusBadge", () => {
  it("renders the status in words", async () => {
    await render(
      <TranslationProvider>
        <StatusBadge status="rejected" />
      </TranslationProvider>
    );

    expect(screen.getByText(en.status.rejected)).toBeTruthy();
  });
});

describe("TypeBadge", () => {
  it("renders the leave type in words", async () => {
    await render(
      <TranslationProvider>
        <TypeBadge type="HOME_OFFICE" />
      </TranslationProvider>
    );

    expect(screen.getByText(en.recordTypes.HOME_OFFICE)).toBeTruthy();
  });
});

describe("SendingBadge", () => {
  it("renders Sending…", async () => {
    await render(
      <TranslationProvider>
        <SendingBadge />
      </TranslationProvider>
    );

    expect(screen.getByText(en.requests.sending)).toBeTruthy();
  });
});
