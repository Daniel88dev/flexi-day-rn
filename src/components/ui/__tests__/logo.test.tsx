import { render, screen } from "@testing-library/react-native";

import { LogoMark, Wordmark } from "@/components/ui/logo";

describe("Wordmark", () => {
  it("renders the product's name", async () => {
    await render(<Wordmark size={46} />);
    expect(screen.getByText("flexiday")).toBeTruthy();
  });
});

describe("LogoMark", () => {
  it("renders at the size it was given", async () => {
    await render(<LogoMark size={92} />);
    expect(screen.root).toHaveStyle({ width: 92, height: 92 });
  });
});
