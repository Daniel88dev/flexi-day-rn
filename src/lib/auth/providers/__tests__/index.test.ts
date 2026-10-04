import { PROVIDER_ADAPTERS, PROVIDER_NAMES, SOCIAL_PROVIDERS } from "@/lib/auth/providers";
import { googleAdapter } from "@/lib/auth/providers/google";

describe("SOCIAL_PROVIDERS", () => {
  it("returns Apple first, then Google, then Microsoft", () => {
    expect(SOCIAL_PROVIDERS).toEqual(["apple", "google", "microsoft"]);
  });
});

describe("PROVIDER_NAMES", () => {
  it("returns each provider's own brand name", () => {
    expect(PROVIDER_NAMES).toEqual({ apple: "Apple", google: "Google", microsoft: "Microsoft" });
  });
});

describe("PROVIDER_ADAPTERS", () => {
  it.each(["apple", "google", "microsoft"] as const)(
    "returns a %s adapter that names its own provider",
    (provider) => {
      expect(PROVIDER_ADAPTERS[provider].provider).toBe(provider);
    }
  );

  it("returns the Google Sign-In SDK adapter for google", () => {
    expect(PROVIDER_ADAPTERS.google).toBe(googleAdapter);
  });

  it.each(["apple", "microsoft"] as const)(
    "returns a %s placeholder that resolves failed until its SDK lands",
    async (provider) => {
      const outcome = await PROVIDER_ADAPTERS[provider].signIn();

      expect(outcome.kind).toBe("failed");
    }
  );
});
