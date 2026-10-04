import { uniqueMembers } from "./remaining";
import type { ReportScopeMember } from "./types";

// Ported from the web's `flexi-day/lib/report/colors.ts`.

/** The web's colour-blind-safe palette, in its fixed order. */
export const CHART_FALLBACK_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
] as const;

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function parseColor(color: string): Hsl | null {
  const match = /^hsl\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/i.exec(
    color.trim()
  );
  if (match) {
    return { h: ((Number(match[1]) % 360) + 360) % 360, s: Number(match[2]), l: Number(match[3]) };
  }
  return hexToHsl(color);
}

/** A similar hue at a similar lightness reads as the same series. */
function tooClose(a: Hsl, b: Hsl): boolean {
  const dh = Math.abs(a.h - b.h);
  const hueGap = Math.min(dh, 360 - dh);
  if (a.s < 12 && b.s < 12) return Math.abs(a.l - b.l) < 14;
  return hueGap < 30 && Math.abs(a.l - b.l) < 14;
}

/**
 * One colour per person: their avatar colour unless it is unreadable or too close to one already
 * taken, then the fallback palette. Assigned by name, so it depends on who is in the scope and not
 * on the order the rows come in. Run it over the whole scope, never a filtered overview, so a
 * person keeps their colour through every filter.
 */
export function assignMemberColors(members: ReportScopeMember[]): Record<string, string> {
  const taken: Hsl[] = [];
  const usedFallbacks = new Set<string>();
  const collides = (candidate: Hsl | null) =>
    candidate !== null && taken.some((existing) => tooClose(existing, candidate));

  const colors: Record<string, string> = {};
  for (const member of uniqueMembers(members)) {
    const avatar = parseColor(member.avatarColor);
    let color: string;
    let hsl: Hsl | null;
    if (avatar && !collides(avatar)) {
      color = member.avatarColor;
      hsl = avatar;
    } else {
      color =
        CHART_FALLBACK_COLORS.find((c) => !usedFallbacks.has(c) && !collides(hexToHsl(c))) ??
        CHART_FALLBACK_COLORS.find((c) => !usedFallbacks.has(c)) ??
        CHART_FALLBACK_COLORS[Object.keys(colors).length % CHART_FALLBACK_COLORS.length];
      usedFallbacks.add(color);
      hsl = hexToHsl(color);
    }
    if (hsl) taken.push(hsl);
    colors[member.id] = color;
  }
  return colors;
}
