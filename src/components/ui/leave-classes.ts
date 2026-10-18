import type { WireRecordType } from "@/lib/local-store";

type LeaveClasses = { fill: string; text: string; border: string };

/** Literal class names per record type: NativeWind only compiles what it finds verbatim. */
export const LEAVE_CLASSES: Record<WireRecordType, LeaveClasses> = {
  VACATION: {
    fill: "bg-leave-vacation",
    text: "text-leave-vacation",
    border: "border-leave-vacation",
  },
  HOME_OFFICE: { fill: "bg-leave-home", text: "text-leave-home", border: "border-leave-home" },
  SICK: { fill: "bg-leave-sick", text: "text-leave-sick", border: "border-leave-sick" },
  SICK_DAY: {
    fill: "bg-leave-sickday",
    text: "text-leave-sickday",
    border: "border-leave-sickday",
  },
  PAID_TIME_OFF: { fill: "bg-leave-pto", text: "text-leave-pto", border: "border-leave-pto" },
  NON_PAID_LEAVE: {
    fill: "bg-leave-nonpaid",
    text: "text-leave-nonpaid",
    border: "border-leave-nonpaid",
  },
  STUDY_LEAVE: { fill: "bg-leave-study", text: "text-leave-study", border: "border-leave-study" },
  BANK_HOLIDAY: { fill: "bg-leave-bank", text: "text-leave-bank", border: "border-leave-bank" },
  OTHER: { fill: "bg-leave-other", text: "text-leave-other", border: "border-leave-other" },
  AWAY: { fill: "bg-leave-away", text: "text-leave-away", border: "border-leave-away" },
};

/**
 * The order the web's filter and legend list the types in. Away has a chip of its own: riding with
 * Sick would tell which Away rows are sick leave.
 */
export const LEAVE_TYPE_ORDER: readonly WireRecordType[] = [
  "VACATION",
  "HOME_OFFICE",
  "SICK",
  "SICK_DAY",
  "BANK_HOLIDAY",
  "PAID_TIME_OFF",
  "NON_PAID_LEAVE",
  "STUDY_LEAVE",
  "OTHER",
  "AWAY",
];
