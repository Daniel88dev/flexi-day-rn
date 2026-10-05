import { PROVIDER_ADAPTERS, PROVIDER_NAMES, SOCIAL_PROVIDERS } from "@/lib/auth/providers";
import { appleAdapter } from "@/lib/auth/providers/apple";
import { googleAdapter } from "@/lib/auth/providers/google";
import { microsoftAdapter } from "@/lib/auth/providers/microsoft";

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

  it("returns the expo-auth-session adapter for microsoft", () => {
    expect(PROVIDER_ADAPTERS.microsoft).toBe(microsoftAdapter);
  });

  it("returns the expo-apple-authentication adapter for apple", () => {
    expect(PROVIDER_ADAPTERS.apple).toBe(appleAdapter);
  });
});
