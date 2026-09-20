import { fireEvent, render, screen } from "@testing-library/react-native";

import { CodeBoxes } from "@/components/ui/code-boxes";

const onChange = jest.fn();
const onComplete = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("CodeBoxes", () => {
  it("shows one box per digit with the digits typed so far", async () => {
    await render(<CodeBoxes label="Code" value="12" onChange={onChange} />);

    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("takes the digits through one hidden one-time-code input", async () => {
    await render(<CodeBoxes label="Code" value="" onChange={onChange} />);

    const input = screen.getByLabelText("Code");
    expect(input.props.textContentType).toBe("oneTimeCode");
    expect(input.props.autoComplete).toBe("one-time-code");

    await fireEvent.changeText(input, "12a3");

    expect(onChange).toHaveBeenCalledWith("123");
  });

  it("reports the code complete on the sixth digit", async () => {
    await render(
      <CodeBoxes label="Code" value="12345" onChange={onChange} onComplete={onComplete} />
    );

    await fireEvent.changeText(screen.getByLabelText("Code"), "123456");

    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("takes nothing while it is disabled", async () => {
    await render(<CodeBoxes label="Code" value="" onChange={onChange} disabled />);

    expect(screen.getByLabelText("Code").props.editable).toBe(false);
  });
});
