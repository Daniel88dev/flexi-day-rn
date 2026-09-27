import { twoFactorErrorKey, type TwoFactorErrorKey } from "./two-factor";

/** The four Settings flows, each its own page sheet. */
export type TwoFactorFlow = "enable" | "authenticator" | "backupCodes" | "disable";

const FLOWS: readonly TwoFactorFlow[] = ["enable", "authenticator", "backupCodes", "disable"];

export function isTwoFactorFlow(value: unknown): value is TwoFactorFlow {
  return typeof value === "string" && (FLOWS as readonly string[]).includes(value);
}

/** The Two-factor row's status, read from the session's user. */
export function twoFactorEnabled(user: { twoFactorEnabled?: boolean | null } | undefined): boolean {
  return user?.twoFactorEnabled === true;
}

/** Hermes' `URLSearchParams` cannot read a query, so the secret is read by hand. */
export function totpSecret(uri: string): string | null {
  const match = /[?&]secret=([^&#]+)/.exec(uri);
  return match ? decodeURIComponent(match[1]) : null;
}

export function groupSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? "";
}

export type FlowStep =
  "password" | "backupCodes" | "method" | "authenticator" | "emailCode" | "done";

export type FlowState = {
  flow: TwoFactorFlow;
  step: FlowStep;
  backupCodes: string[];
  totpURI: string | null;
};

export type FlowEvent =
  | { type: "passwordAccepted"; backupCodes?: string[]; totpURI?: string }
  | { type: "codesSaved" }
  | { type: "authenticatorChosen" }
  | { type: "emailCodeSent" }
  | { type: "verified" };

export function initialFlowState(flow: TwoFactorFlow): FlowState {
  return { flow, step: "password", backupCodes: [], totpURI: null };
}

const AFTER_PASSWORD: Record<TwoFactorFlow, FlowStep> = {
  enable: "backupCodes",
  authenticator: "authenticator",
  backupCodes: "backupCodes",
  disable: "done",
};

/**
 * Enable is password, backup codes, the method choice, then a code; the other three are the
 * password and at most one step after it. New backup codes ends on its codes: saving them closes
 * the sheet. The flag only flips when a code is verified, so leaving the sheet at any step is safe.
 */
export function nextFlowState(state: FlowState, event: FlowEvent): FlowState {
  const { flow, step } = state;
  switch (event.type) {
    case "passwordAccepted":
      if (step !== "password") return state;
      return {
        ...state,
        step: AFTER_PASSWORD[flow],
        backupCodes: event.backupCodes ?? [],
        totpURI: event.totpURI ?? null,
      };
    case "codesSaved":
      return flow === "enable" && step === "backupCodes" ? { ...state, step: "method" } : state;
    case "authenticatorChosen":
      return step === "method" ? { ...state, step: "authenticator" } : state;
    case "emailCodeSent":
      return step === "method" || step === "emailCode" ? { ...state, step: "emailCode" } : state;
    case "verified":
      return step === "authenticator" || step === "emailCode" ? { ...state, step: "done" } : state;
  }
}

/**
 * Whether the call this step makes answers with a new session: the code that turns two-factor on
 * and the password that turns it off. The phone reads its session back after either.
 */
export function swapsSession({ flow, step }: FlowState): boolean {
  if (flow === "disable") return step === "password";
  return flow === "enable" && (step === "authenticator" || step === "emailCode");
}

export type TwoFactorSettingsStage = "password" | "code" | "send";

export type TwoFactorSettingsRefusal =
  | { field: "session" }
  | { field: "password"; key: "wrongPassword" }
  | { field: "code"; key: TwoFactorErrorKey }
  | { field: "form"; key: "rateLimited" | "actionFailed" | "sendFailed" }
  | { field: "form"; key: "server"; message: string };

const UNAUTHORIZED = 401;
const TOO_MANY_REQUESTS = 429;

/**
 * `session` means the phone may no longer hold one. A code check answers a refused code with a
 * 401 as well, so there only the plugin's missing-challenge code says so: without a session,
 * better-auth takes the check for a sign-in and finds no challenge cookie.
 */
export function twoFactorSettingsRefusal(
  stage: TwoFactorSettingsStage,
  error: { status?: number; code?: string | null; message?: string | null }
): TwoFactorSettingsRefusal {
  if (stage === "code") {
    if (error.code === "INVALID_TWO_FACTOR_COOKIE") return { field: "session" };
    return { field: "code", key: twoFactorErrorKey(error.status, error.code) };
  }
  if (error.status === UNAUTHORIZED) return { field: "session" };
  if (error.status === TOO_MANY_REQUESTS) return { field: "form", key: "rateLimited" };
  if (stage === "send") return { field: "form", key: "sendFailed" };
  if (error.code === "INVALID_PASSWORD") return { field: "password", key: "wrongPassword" };
  return error.message
    ? { field: "form", key: "server", message: error.message }
    : { field: "form", key: "actionFailed" };
}
