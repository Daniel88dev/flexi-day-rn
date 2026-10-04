import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  periodSlots,
  periodYear,
  priorYearRead,
  withYear,
  type DatedUsage,
  type MonthlyUsage,
  type MonthSlot,
  type ReportOverview,
  type ReportPeriod,
  type ReportScope,
} from "@/lib/report";
import { useToday } from "@/lib/use-today";

import { ApiError } from "./failure";
import { useReportOverview, useReportScope } from "./report";

export type WindowState = "pending" | "incomplete" | "ready";

export type ReportWindow<T> = {
  slots: MonthSlot[];
  year: number;
  priorYear: number;
  data: T | undefined;
  usage: DatedUsage[];
  state: WindowState;
  staleSince: Date | null;
  coldOffline: boolean;
  forbidden: boolean;
  retry: () => void;
};

export type ReportSource = { kind: "overview"; groupIds?: string[]; userIds?: string[] };

type YearAnswer = { year: number; monthly: MonthlyUsage[] };

const isForbidden = (error: unknown) =>
  error instanceof ApiError && (error.status === 403 || error.status === 404);

function windowOf<T extends YearAnswer>(
  scope: UseQueryResult<ReportScope>,
  current: UseQueryResult<T>,
  prior: UseQueryResult<T>,
  slots: MonthSlot[],
  year: number,
  read: ReturnType<typeof priorYearRead>
): ReportWindow<T> {
  const { priorYear, spansYears, needsPrior } = read;
  // A disabled query still hands back whatever its key cached, so only a wanted prior year counts.
  const priorData = needsPrior && !prior.isPlaceholderData ? prior.data : undefined;
  const usage = [
    ...(priorData ? withYear(priorData.year, priorData.monthly) : []),
    ...(current.data ? withYear(current.data.year, current.data.monthly) : []),
  ];

  const scopeFailed = scope.isError && scope.data === undefined;
  let state: WindowState = "ready";
  if (current.data === undefined || current.isPlaceholderData) state = "pending";
  else if (spansYears && scope.isPending) state = "pending";
  else if (needsPrior && (prior.isPending || prior.isPlaceholderData)) state = "pending";
  else if ((needsPrior && prior.isError && !priorData) || (spansYears && scopeFailed)) {
    state = "incomplete";
  }

  const forbidden = isForbidden(current.error);
  return {
    slots,
    year,
    priorYear,
    data: current.data,
    usage,
    state,
    staleSince:
      current.isError && current.data !== undefined ? new Date(current.dataUpdatedAt) : null,
    coldOffline: current.isError && current.data === undefined && !forbidden,
    forbidden,
    retry: () => {
      void scope.refetch();
      void current.refetch();
      if (needsPrior) void prior.refetch();
    },
  };
}

export function useReportWindow(
  period: ReportPeriod,
  source: ReportSource
): ReportWindow<ReportOverview> {
  const today = useToday();
  const slots = useMemo(() => periodSlots(period, today), [period, today]);
  const year = periodYear(period, today);
  const scope = useReportScope();
  const read = priorYearRead(slots, year, scope.data?.years);
  const people = { groupIds: source.groupIds, userIds: source.userIds };
  const current = useReportOverview({ ...people, year });
  const prior = useReportOverview({ ...people, year: read.priorYear }, read.needsPrior);
  return windowOf(scope, current, prior, slots, year, read);
}
