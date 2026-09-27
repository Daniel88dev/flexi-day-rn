import { render, screen } from "@testing-library/react-native";

import { PersonAvatar } from "@/components/calendar/person-avatar";

describe("PersonAvatar", () => {
  it("renders the person's initials", async () => {
    await render(<PersonAvatar userId="user-1" name="Eva Novak" />);

    expect(screen.getByText("EN")).toBeOnTheScreen();
  });

  it("renders a question mark for a person without a name", async () => {
    await render(<PersonAvatar userId="user-1" name={null} />);

    expect(screen.getByText("?")).toBeOnTheScreen();
  });
});
