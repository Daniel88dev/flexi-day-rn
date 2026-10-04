import { cs } from "@/i18n/cs";
import { en } from "@/i18n/en";

describe("settings.deleteAccount.webHint", () => {
  it.each([
    ["en", en],
    ["cs", cs],
  ] as const)("returns a hint that names all three providers in %s", (_, dictionary) => {
    const hint = dictionary.settings.deleteAccount.webHint;

    expect(hint).toContain("Google");
    expect(hint).toContain("Microsoft");
    expect(hint).toContain("Apple");
  });
});
