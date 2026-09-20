import { render, screen } from "@testing-library/react-native";

import { SuccessNotice } from "@/components/ui/success-notice";

describe("SuccessNotice", () => {
  it("renders the message it was given", async () => {
    await render(<SuccessNotice message="Code sent — check your inbox." />);

    expect(screen.getByText("Code sent — check your inbox.")).toBeTruthy();
  });
});
