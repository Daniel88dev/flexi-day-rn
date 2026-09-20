import { render, screen, userEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { RootRouteProvider, useRootRoute, useSetRootRoute } from "@/lib/session/root-route-context";
import type { RootRoute } from "@/lib/session/root-route";

function Probe({ moveTo }: { moveTo?: RootRoute }) {
  const route = useRootRoute();
  const setRoute = useSetRootRoute();
  return (
    <Pressable accessibilityRole="button" onPress={() => moveTo && setRoute(moveTo)}>
      <Text>{route}</Text>
    </Pressable>
  );
}

describe("RootRouteProvider", () => {
  it("renders the route the launch decided", async () => {
    await render(
      <RootRouteProvider route="welcome">
        <Probe />
      </RootRouteProvider>
    );

    expect(screen.getByText("welcome")).toBeTruthy();
  });

  it("renders the route it was moved to, so a later sign-in reaches the guards", async () => {
    await render(
      <RootRouteProvider route="welcome">
        <Probe moveTo="signed-in" />
      </RootRouteProvider>
    );

    await userEvent.press(screen.getByRole("button"));

    expect(screen.getByText("signed-in")).toBeTruthy();
  });
});

describe("useRootRoute", () => {
  it("returns wait with no provider above it, so nothing routes on a guess", async () => {
    await render(<Probe />);

    expect(screen.getByText("wait")).toBeTruthy();
  });
});
