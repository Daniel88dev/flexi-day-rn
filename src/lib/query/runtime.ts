import { API_URL, createApiFetch } from "@/lib/api";
import { sessionCookie } from "@/lib/session/auth-client";
import { currentClientHeaders } from "@/lib/session/client-headers";

import { createQueryClient } from "./query-client";
import { createApiRequest } from "./request";

/** The one query client; the Signed-out wipe clears it. */
export const queryClient = createQueryClient();

let unauthorized: () => void = () => queryClient.clear();

/** The shell hands the Signed-out wipe in here while it is mounted; the default only clears. */
export function setUnauthorizedHandler(handler: () => void): () => void {
  unauthorized = handler;
  return () => {
    if (unauthorized === handler) unauthorized = () => queryClient.clear();
  };
}

/** Every read and write outside the Local store goes through this. */
export const apiRequest = createApiRequest(
  createApiFetch({
    baseUrl: API_URL,
    clientHeaders: currentClientHeaders,
    cookie: sessionCookie,
    onUnauthorized: () => unauthorized(),
  })
);
