import { render, screen } from "@testing-library/react-native";

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
});
