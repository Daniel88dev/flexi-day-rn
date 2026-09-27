import { discFace } from "@/lib/attendance/disc";
import { en } from "@/i18n/en";
import { attendance, pause, session } from "@/test-support/attendance";

const NOW = new Date("2026-09-27T07:47:30.000Z").getTime();
const READ_AT = NOW - 60_000;

describe("discFace", () => {
  it("returns an empty slot when there is no Employment to clock", () => {
    expect(discFace({ kind: "no-employment" }, NOW, en)).toBeNull();
  });

  it("returns primary with the Clock label while clocked out", () => {
    const read = { kind: "ready", state: attendance(), offline: false, readAt: READ_AT } as const;

    expect(discFace(read, NOW, en)).toEqual({
      tone: "primary",
      glyph: "timer",
      label: "Clock",
      offline: false,
      loading: false,
    });
  });

  it("returns ok with the session's running h:mm while clocked in", () => {
    const open = session({ startedAt: "2026-09-27T06:00:00.000Z" });
    const state = attendance({ openSession: open, sessions: [open] });

    expect(discFace({ kind: "ready", state, offline: false, readAt: READ_AT }, NOW, en)).toEqual({
      tone: "ok",
      glyph: "sign-out",
      label: "1:47",
      offline: false,
      loading: false,
    });
  });

  it("returns warm with On break while a break runs", () => {
    const openBreak = pause();
    const open = session({ breaks: [openBreak] });
    const state = attendance({ openSession: open, openBreak, sessions: [open] });

    expect(
      discFace({ kind: "ready", state, offline: false, readAt: READ_AT }, NOW, en)
    ).toMatchObject({ tone: "warm", glyph: "coffee", label: "On break" });
  });

  it("returns muted when attendance is inactive", () => {
    const state = attendance({ active: false });

    expect(
      discFace({ kind: "ready", state, offline: false, readAt: READ_AT }, NOW, en)
    ).toMatchObject({ tone: "muted", label: "Clock" });
  });

  it("returns the last read's face with the offline badge when offline", () => {
    const open = session({ startedAt: "2026-09-27T06:00:00.000Z" });
    const state = attendance({ openSession: open, sessions: [open] });

    expect(
      discFace({ kind: "ready", state, offline: true, readAt: READ_AT }, NOW, en)
    ).toMatchObject({ tone: "ok", label: "1:47", offline: true });
  });

  it("returns a loading primary disc before the first read lands", () => {
    expect(discFace({ kind: "loading" }, NOW, en)).toEqual({
      tone: "primary",
      glyph: "timer",
      label: "Clock",
      offline: false,
      loading: true,
    });
  });

  it("returns a primary disc with the offline badge when nothing could be read", () => {
    expect(discFace({ kind: "unreachable" }, NOW, en)).toMatchObject({
      tone: "primary",
      offline: true,
      loading: false,
    });
  });

  it("returns a primary disc without the offline badge when the first read met a server fault", () => {
    expect(discFace({ kind: "read-failed" }, NOW, en)).toMatchObject({
      tone: "primary",
      offline: false,
      loading: false,
    });
  });
});
