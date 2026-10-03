// PROTOTYPE (T-143, prototype/report): reads and the shared report window.
// Real: scope, overview and member report from the endpoints through the query layer.
// `?data=demo` swaps the fetchers for demo.ts. `?state=` forces the static variants.
import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";

import { apiRequest } from "@/lib/query";
import type { CalendarRecordType } from "@/lib/local-store";

import { demoMemberReport, demoOverview, demoScope } from "./demo";
import {
  calendarMonths,
  trailingMonths,
  withYear,
  yearsInWindow,
  type DatedUsage,
  type MonthSlot,
} from "./series";
import type {
  MemberReport,
  ReportFilters,
  ReportOverview,
  ReportPeriod,
  ReportScope,
} from "./types";

export type ProtoState = "loading" | "offline" | "offline-cold" | "incomplete" | "empty" | null;

export type Proto = {
  demo: boolean;
  self: boolean;
  state: ProtoState;
  variant: "A" | "B";
  sheet: string | null;
  tip: number | null;
  bar: boolean;
  layout: "split" | "merged";
};

export function useProto(): Proto {
  const p = useLocalSearchParams<{
    data?: string;
    as?: string;
    state?: string;
    variant?: string;
    sheet?: string;
    tip?: string;
    bar?: string;
    layout?: string;
  }>();
  return {
    demo: p.data === "demo",
    self: p.as === "self",
    state: (p.state as ProtoState) ?? null,
    variant: p.variant === "B" ? "B" : "A",
    sheet: p.sheet ?? null,
    tip: p.tip === undefined ? null : Number(p.tip),
    bar: p.bar !== "off",
    layout: p.layout === "split" ? "split" : "merged",
  };
}

const query = (f: ReportFilters, year: number) => {
  const q = new URLSearchParams();
  q.set("year", String(year));
  if (f.groupIds.length) q.set("groupIds", f.groupIds.join(","));
  if (f.userIds.length) q.set("userIds", f.userIds.join(","));
  if (f.types.length) q.set("types", f.types.join(","));
  return q.toString();
};

export function useReportScope(proto: Proto) {
  return useQuery({
    queryKey: ["report-scope", proto.demo ? (proto.self ? "demo-self" : "demo") : "live"],
    queryFn: ({ signal }) =>
      proto.demo
        ? Promise.resolve(demoScope(proto.self))
        : apiRequest<ReportScope>("/api/reports/scope", { signal }),
  });
}

function useOverview(proto: Proto, filters: ReportFilters, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["report-overview", query(filters, year), proto.demo ? "demo" : "live"],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) =>
      proto.demo
        ? Promise.resolve(demoOverview(year, filters, proto.self))
        : apiRequest<ReportOverview>(`/api/reports/overview?${query(filters, year)}`, { signal }),
  });
}

function useMember(proto: Proto, userId: string, year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["member-report", userId, year, proto.demo ? "demo" : "live"],
    enabled: enabled && userId !== "",
    queryFn: ({ signal }) =>
      proto.demo
        ? Promise.resolve(demoMemberReport(userId, year, proto.self))
        : apiRequest<MemberReport>(`/api/reports/members/${userId}?year=${year}`, { signal }),
  });
}

export type WindowState = "pending" | "incomplete" | "ready";

export type ReportWindow<T> = {
  slots: MonthSlot[];
  year: number;
  priorYear: number;
  data: T | undefined;
  usage: DatedUsage[];
  state: WindowState;
  /** Kept data after a failed read: the time it last arrived. */
  staleSince: Date | null;
  /** A failed first read with nothing kept. */
  coldOffline: boolean;
  forbidden: boolean;
  retry: () => void;
};

function windowOf<T extends { year: number; monthly: ReportOverview["monthly"] }>(
  proto: Proto,
  scope: UseQueryResult<ReportScope>,
  current: UseQueryResult<T>,
  prior: UseQueryResult<T>,
  slots: MonthSlot[],
  year: number,
  priorYear: number,
  needsPrior: boolean
): ReportWindow<T> {
  const spansYears = yearsInWindow(slots).length > 1;
  const priorData = needsPrior && proto.state !== "incomplete" ? prior.data : undefined;
  const usage = [
    ...(priorData ? withYear(priorData.year, priorData.monthly) : []),
    ...(current.data ? withYear(current.data.year, current.data.monthly) : []),
  ];

  let state: WindowState = "ready";
  if (proto.state === "loading" || current.isPending || current.isPlaceholderData)
    state = "pending";
  else if (
    spansYears &&
    (scope.isPending || (needsPrior && (prior.isPending || prior.isPlaceholderData)))
  )
    state = "pending";
  else if (
    proto.state === "incomplete" ||
    (needsPrior && prior.isError) ||
    (spansYears && scope.isError)
  )
    state = "incomplete";

  const failedWithData = current.isError && current.data !== undefined;
  const staleSince =
    proto.state === "offline"
      ? new Date(Date.now() - 1000 * 60 * 23)
      : failedWithData
        ? new Date(current.dataUpdatedAt)
        : null;
  const status = (current.error as { status?: number } | null)?.status;

  return {
    slots,
    year,
    priorYear,
    data: current.data,
    usage,
    state,
    staleSince,
    coldOffline:
      proto.state === "offline-cold" ||
      (current.isError && current.data === undefined && status !== 403),
    forbidden: status === 403,
    retry: () => {
      void scope.refetch();
      void current.refetch();
      if (needsPrior) void prior.refetch();
    },
  };
}

function useSlots(period: ReportPeriod) {
  return useMemo(
    () => (period === "rolling" ? trailingMonths(new Date()) : calendarMonths(period)),
    [period]
  );
}

export function useOverviewWindow(
  proto: Proto,
  period: ReportPeriod,
  filters: ReportFilters
): ReportWindow<ReportOverview> & { scope: UseQueryResult<ReportScope> } {
  const slots = useSlots(period);
  const year = period === "rolling" ? new Date().getFullYear() : period;
  const scope = useReportScope(proto);
  const current = useOverview(proto, filters, year, true);
  const priorYear = yearsInWindow(slots)[0] ?? year;
  const needsPrior = priorYear !== year && (scope.data?.years ?? []).includes(priorYear);
  const prior = useOverview(proto, filters, priorYear, needsPrior);
  return {
    ...windowOf(proto, scope, current, prior, slots, year, priorYear, needsPrior),
    scope,
  };
}

export function useMemberWindow(
  proto: Proto,
  period: ReportPeriod,
  userId: string
): ReportWindow<MemberReport> {
  const slots = useSlots(period);
  const year = period === "rolling" ? new Date().getFullYear() : period;
  const scope = useReportScope(proto);
  const current = useMember(proto, userId, year, true);
  const priorYear = yearsInWindow(slots)[0] ?? year;
  const needsPrior = priorYear !== year && (scope.data?.years ?? []).includes(priorYear);
  const prior = useMember(proto, userId, priorYear, needsPrior);
  return windowOf(proto, scope, current, prior, slots, year, priorYear, needsPrior);
}

export const FILTERABLE_TYPES: CalendarRecordType[] = [
  "VACATION",
  "HOME_OFFICE",
  "SICK",
  "SICK_DAY",
  "PAID_TIME_OFF",
  "NON_PAID_LEAVE",
  "STUDY_LEAVE",
  "OTHER",
];

export const parsePeriod = (value: string | undefined): ReportPeriod =>
  value && /^\d{4}$/.test(value) ? Number(value) : "rolling";
