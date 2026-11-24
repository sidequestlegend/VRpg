// Translated from VRPG2/Scripts/Core/VRPGUtils.cs (GIB Games, MIT).
//
// Only the members with callers port: MakeColor, GetColorHex, GetDots (UTL:22-62) and the two JSON helpers
// (UTL:67-94). The forty DataDictionary / DataList extension methods (UTL:98-382) are plain object and array
// access in TypeScript and have no callers left in the port.
//
// Added for the port (not upstream): C#'s int.TryParse, which the dice rollers depend on exactly, and the
// clamping and rich-text filtering of typed text (PORT.md C6, C7).

import { Color } from "../portkit/src/index.ts";

/** Mathf.RoundToInt: C#'s Math.Round, which rounds a half to the even neighbour. */
export function roundToInt(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** `{0:X2}` of an int: at least two upper-case hex digits; a negative value prints its 32-bit pattern. */
function hex2(n: number): string {
  if (n < 0) return (n >>> 0).toString(16).toUpperCase();
  return n.toString(16).toUpperCase().padStart(2, "0");
}

export const Utils = {
  /** UTL:22-25 */
  MakeColor(targetText: string, color: Color): string {
    return "<color=#" + Utils.GetColorHex(color) + ">" + targetText + "</color>";
  },

  /** UTL:27-33. The channel is a 32-bit float multiplied by 255.0f, then rounded half to even. */
  GetColorHex(color: Color): string {
    const r = roundToInt(Math.fround(Math.fround(color.r) * 255));
    const g = roundToInt(Math.fround(Math.fround(color.g) * 255));
    const b = roundToInt(Math.fround(Math.fround(color.b) * 255));
    return hex2(r) + hex2(g) + hex2(b);
  },

  /** UTL:35-62 */
  GetDots(targetString: string, dot: string): string {
    const parsed = tryParseInt(targetString);
    if (!parsed.ok) return "";
    const value = parsed.value;
    if (value < 1) return "";
    let result = "";
    for (let i = 1; i <= value; i++) {
      result += dot;
      if (i % 5 === 0 && i !== value) result += " ";
    }
    return result;
  },

  /** UTL:67-79: an empty dictionary when the text is not a JSON object. */
  JsonToDictionary(input: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(input);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* falls through */
    }
    return {};
  },

  /** UTL:81-94 (JsonExportType.Beautify). */
  DictionaryToJson(dictionary: Record<string, unknown>): string {
    try {
      return JSON.stringify(dictionary, null, 2);
    } catch {
      return "";
    }
  },
};

/**
 * C#'s `int.TryParse(string, out int)` with the default NumberStyles.Integer: optional white space (U+0009 to U+000D
 * and U+0020) before and after, an optional leading `+` or `-`, then ASCII digits; trailing U+0000 characters are
 * ignored, as .NET does. Anything else, an empty string, or a value outside Int32 fails with 0.
 */
export function tryParseInt(text: string | null | undefined): { ok: boolean; value: number } {
  const fail = { ok: false, value: 0 };
  if (text === null || text === undefined) return fail;
  const isWhite = (c: number) => c === 0x20 || (c >= 0x09 && c <= 0x0d);
  let s = 0;
  let e = text.length;
  while (e > s && text.charCodeAt(e - 1) === 0) e--;
  while (s < e && isWhite(text.charCodeAt(s))) s++;
  while (e > s && isWhite(text.charCodeAt(e - 1))) e--;
  if (s >= e) return fail;
  let negative = false;
  const first = text.charCodeAt(s);
  if (first === 0x2b || first === 0x2d) {
    negative = first === 0x2d;
    s++;
  }
  if (s >= e) return fail;
  let value = 0;
  for (let i = s; i < e; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x30 || c > 0x39) return fail;
    value = value * 10 + (c - 0x30);
    if (value > 2147483648) return fail;
  }
  if (negative) value = -value;
  if (value > 2147483647 || value < -2147483648) return fail;
  return { ok: true, value: value === 0 ? 0 : value };
}

/** Line breaks become "\n"; every other control character is removed; the text is cut to `max` characters. */
export function cleanTyped(text: string, max: number, keepLineBreaks: boolean): string {
  let out = "";
  const normal = String(text ?? "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < normal.length; i++) {
    const c = normal.charCodeAt(i);
    if (c === 0x0a) {
      if (keepLineBreaks) out += "\n";
      else out += " ";
      continue;
    }
    if (c < 0x20 || c === 0x7f) continue;
    out += normal[i];
  }
  if (out.length > max) {
    out = out.slice(0, max);
    // Do not leave half of a surrogate pair at the cut.
    const last = out.charCodeAt(out.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  }
  return out;
}

const ALLOWED_TAGS = new Set(["color", "b", "i"]);

/**
 * Keeps the rich-text tags `<color>`, `<b>` and `<i>` (opening and closing) and removes every other tag, so one
 * `<size=9999>` cannot wreck everyone's log (PORT.md C6). Text that is not a tag (`<3`) is left alone.
 */
export function filterRichText(text: string): string {
  return text.replace(/<\/?([A-Za-z]+)(?:=[^<>]*)?>/g, (tag, name: string) => (ALLOWED_TAGS.has(name.toLowerCase()) ? tag : ""));
}

/** Parses "r g b" or "r g b a" (0 to 1) into a Color; `fallback` when it does not parse. */
export function parseColor(text: string | undefined, fallback: Color): Color {
  if (!text) return fallback.clone();
  const parts = text.trim().split(/[\s,]+/).map(Number);
  if (parts.length < 3 || parts.length > 4 || parts.some((n) => !Number.isFinite(n))) return fallback.clone();
  return new Color(parts[0], parts[1], parts[2], parts.length === 4 ? parts[3] : 1);
}
