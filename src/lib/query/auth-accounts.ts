import { useQuery } from "@tanstack/react-query";

import { authClient } from "@/lib/session/auth-client";

import { ApiError } from "./failure";
import { qk } from "./keys";

export const PASSWORD_PROVIDER_ID = "credential";

export type AuthAccount = { providerId: string };

type AccountsAnswer = {
  data?: AuthAccount[] | null;
  error?: { status: number; message?: string | null } | null;
};

export async function fetchAuthAccounts(
  list: () => Promise<AccountsAnswer> = () => authClient.listAccounts()
): Promise<AuthAccount[]> {
  const { data, error } = await list();
  if (error) throw new ApiError(error.status, error.message ?? null);
  return data ?? [];
}

/**
 * The web's gate on Change password: shown for a credential account, and shown too when the
 * lookup failed, because better-auth refuses a change for an account without a password, while a
 * hidden row leaves a password user with no way to change it.
 */
export function offersPasswordChange({
  data,
  isError,
}: {
  data: AuthAccount[] | undefined;
  isError: boolean;
}): boolean {
  if (isError) return true;
  return data?.some((account) => account.providerId === PASSWORD_PROVIDER_ID) ?? false;
}

export function useOffersPasswordChange(): boolean {
  const accounts = useQuery({ queryKey: qk.authAccounts(), queryFn: () => fetchAuthAccounts() });
  return offersPasswordChange(accounts);
}
