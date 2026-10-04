import { useQuery } from "@tanstack/react-query";

import { qk } from "./keys";
import { apiRequest } from "./runtime";

export type HolidayCountry = { code: string; name: string };

export function useHolidayCountries({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.bankHolidayCountries(),
    queryFn: ({ signal }) =>
      apiRequest<HolidayCountry[]>("/api/bank-holidays/countries", { signal }),
    // The dataset ships with the backend, so it never changes while the app runs.
    staleTime: Infinity,
    enabled,
  });
}
