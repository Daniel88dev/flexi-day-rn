import type { BalanceBucket } from "@/lib/local-store";

export type BalanceRow = BalanceBucket & {
  /** Unclamped, so an overdraft shows as a negative number, as on the web. */
  left: number;
  /** How much of the bar is filled, from 0 to 1. */
  share: number;
};

/** The web's Balance card: an allowance shows only once something is allocated to it. */
export function balanceRows(buckets: readonly BalanceBucket[]): BalanceRow[] {
  return buckets
    .filter((bucket) => bucket.allocated > 0)
    .map((bucket) => ({
      ...bucket,
      left: bucket.allocated - bucket.used,
      share: Math.min(1, bucket.used / bucket.allocated),
    }));
}
