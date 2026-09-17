import { render, screen } from "@testing-library/react-native";

import Index from "@/app/index";

describe("index route", () => {
  it("renders the app name", async () => {
    await render(<Index />);
    expect(screen.getByText("Flexi Day")).toBeTruthy();
  });
});
