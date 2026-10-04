import appJson from "../../../../app.json";

import {
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_REDIRECT_URI,
} from "@/lib/auth/provider-config";

const GOOGLE_PLUGIN = "@react-native-google-signin/google-signin";

function googleUrlScheme(): unknown {
  const entry = appJson.expo.plugins.find(
    (plugin): plugin is [string, { iosUrlScheme: string }] =>
      Array.isArray(plugin) && plugin[0] === GOOGLE_PLUGIN
  );
  return entry?.[1].iosUrlScheme;
}

describe("GOOGLE_IOS_CLIENT_ID", () => {
  it("returns the id whose reversed form is the URL scheme app.json gives the Google plugin", () => {
    const id = GOOGLE_IOS_CLIENT_ID.replace(/\.apps\.googleusercontent\.com$/, "");

    expect(googleUrlScheme()).toBe(`com.googleusercontent.apps.${id}`);
  });
});

describe("GOOGLE_WEB_CLIENT_ID", () => {
  it("returns a Google OAuth client id distinct from the iOS one", () => {
    expect(GOOGLE_WEB_CLIENT_ID).toMatch(/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
    expect(GOOGLE_WEB_CLIENT_ID).not.toBe(GOOGLE_IOS_CLIENT_ID);
  });
});

describe("MICROSOFT_CLIENT_ID", () => {
  it("returns an Entra application id", () => {
    expect(MICROSOFT_CLIENT_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

describe("MICROSOFT_REDIRECT_URI", () => {
  it("returns the auth path on the URL scheme app.json declares", () => {
    expect(MICROSOFT_REDIRECT_URI).toBe(`${appJson.expo.scheme}://auth`);
  });
});
