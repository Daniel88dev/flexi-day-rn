import { render, screen } from "@testing-library/react-native";

import Index from "@/app/index";
import { RootRouteProvider } from "@/lib/session/root-route-context";
import type { RootRoute } from "@/lib/session/root-route";

jest.mock("expo-router", () => ({
  Redirect: jest.requireActual("@/test-support/expo-router").RedirectShim,
}));

function renderIndex(route: RootRoute) {
  return render(
    <RootRouteProvider route={route}>
      <Index />
    </RootRouteProvider>
  );
}

describe("Index", () => {
  it("sends a phone with a cached session to the dashboard", async () => {
    await renderIndex("signed-in");

    expect(screen.getByText("/dashboard")).toBeTruthy();
  });

  it("sends a phone without a session to welcome", async () => {
    await renderIndex("welcome");

    expect(screen.getByText("/welcome")).toBeTruthy();
  });
});
