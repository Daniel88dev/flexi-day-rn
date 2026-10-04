import { fireEvent, render, screen } from "@testing-library/react-native";

import { Notice } from "@/components/ui/notice";

describe("Notice", () => {
  it("renders what the server refused", async () => {
    await render(<Notice tone="error" message="Invalid email or password" />);

    expect(screen.getByText("Invalid email or password")).toBeTruthy();
  });

  it("renders what went right", async () => {
    await render(<Notice tone="success" message="Code sent — check your inbox." />);

    expect(screen.getByText("Code sent — check your inbox.")).toBeTruthy();
  });

  it("renders what the signed-out wipe left", async () => {
    await render(<Notice tone="accent" message="You're signed out." />);

    expect(screen.getByText("You're signed out.")).toBeTruthy();
  });

  it("renders a warning in the warm tone", async () => {
    await render(<Notice tone="warm" message="This invite is for a…@dev.local." />);

    expect(screen.getByText("This invite is for a…@dev.local.")).toBeTruthy();
  });

  it("renders no action unless given one", async () => {
    await render(<Notice tone="error" message="Couldn't reach the server." />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders an action below the message and answers its tap", async () => {
    const onPress = jest.fn();
    await render(
      <Notice
        tone="error"
        message="Couldn't reach the server."
        action={{ label: "Retry", onPress, testID: "notice-retry" }}
      />
    );

    await fireEvent.press(screen.getByTestId("notice-retry"));

    expect(screen.getByRole("button", { name: "Retry" })).toBeOnTheScreen();
    expect(onPress).toHaveBeenCalled();
  });
});
