import type { TwoFactorAuth } from "@/lib/session/use-two-factor";

/** The four second-factor calls as mocks, so a test hands the hook or the screen a fake client. */
export type TwoFactorMocks = { [Call in keyof TwoFactorAuth]: jest.Mock };

export function fakeTwoFactorAuth(overrides: Partial<TwoFactorMocks> = {}): TwoFactorMocks {
  return {
    verifyTotp: jest.fn().mockResolvedValue({}),
    verifyOtp: jest.fn().mockResolvedValue({}),
    verifyBackupCode: jest.fn().mockResolvedValue({}),
    sendOtp: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

/** The same four calls on an auth client the test file's own `jest.mock` replaced. */
export function twoFactorMocks(client: { twoFactor: unknown }): TwoFactorMocks {
  return client.twoFactor as TwoFactorMocks;
}

/** What a fresh render starts from: every call answers without an error. */
export function acceptEveryCode(mocks: TwoFactorMocks): void {
  for (const call of Object.values(mocks)) call.mockResolvedValue({});
}
