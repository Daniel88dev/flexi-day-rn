import { render, screen } from "@testing-library/react-native";

import { ErrorNotice } from "@/components/ui/error-notice";

describe("ErrorNotice", () => {
  it("renders the message it was given", async () => {
    await render(<ErrorNotice message="Invalid email or password" />);

    expect(screen.getByText("Invalid email or password")).toBeTruthy();
  });
});
