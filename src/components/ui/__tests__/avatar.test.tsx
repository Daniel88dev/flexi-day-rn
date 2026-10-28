import { render, screen } from "@testing-library/react-native";

import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("returns the name's initials", async () => {
    await render(<Avatar name="Eva Novak" color="#2a78d6" size={40} />);

    expect(screen.getByText("EN")).toBeOnTheScreen();
  });

  it("returns a question mark for a person without a name", async () => {
    await render(<Avatar name={null} color="#2a78d6" size={40} />);

    expect(screen.getByText("?")).toBeOnTheScreen();
  });

  it("returns the server's initials over the ones the name would give", async () => {
    await render(<Avatar name="Eva Marie Novak" initials="EN" color="#2a78d6" size={40} />);

    expect(screen.getByText("EN")).toBeOnTheScreen();
    expect(screen.queryByText("EM")).toBeNull();
  });

  it("returns the initials sized to the avatar by the given scale", async () => {
    await render(<Avatar name="Eva Novak" color="#2a78d6" size={50} textScale={0.36} />);

    expect(screen.getByText("EN")).toHaveStyle({ fontSize: 18 });
  });

  it("returns the picture instead of the initials when there is one", async () => {
    await render(
      <Avatar name="Eva Novak" color="#2a78d6" size={40} uri="https://example.test/eva.jpg" />
    );

    expect(screen.queryByText("EN")).toBeNull();
    expect(screen.toJSON()).toMatchObject({
      type: "Image",
      props: { source: { uri: "https://example.test/eva.jpg" } },
    });
  });
});
