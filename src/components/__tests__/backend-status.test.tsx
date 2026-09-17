import { render, screen } from "@testing-library/react-native";

import { BackendStatus } from "@/components/backend-status";

describe("BackendStatus", () => {
  it("reports the backend as reachable when /health answers 200", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
    await render(<BackendStatus />);
    expect(await screen.findByText(/Backend reachable/)).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/health$/));
  });

  it("reports the backend as unreachable when the request fails", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    await render(<BackendStatus />);
    expect(await screen.findByText(/Backend unreachable/)).toBeTruthy();
  });
});
