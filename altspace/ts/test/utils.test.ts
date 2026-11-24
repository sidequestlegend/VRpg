// Rung 1: the text helpers the rollers and labels depend on, checked against what the C# does.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Color } from "../portkit/src/index.ts";
import { Utils, cleanTyped, filterRichText, roundToInt, tryParseInt } from "../src/VRPGUtils.ts";
import { VRPGTextElement } from "../src/VRPGTextElement.ts";
import type { HostActions } from "../portkit/src/index.ts";

test("int.TryParse as C# (NumberStyles.Integer), which the DS roller reads its modifiers with (DS:44-45)", () => {
  const ok: Array<[string, number]> = [
    ["0", 0], ["3", 3], ["-2", -2], ["+1", 1], [" 4 ", 4], ["\t7\n", 7], ["007", 7], ["-0", 0],
    ["2147483647", 2147483647], ["-2147483648", -2147483648], ["12\u0000\u0000", 12],
  ];
  for (const [text, value] of ok) assert.deepEqual(tryParseInt(text), { ok: true, value }, JSON.stringify(text));
  const bad = ["", " ", "abc", "5.0", "1e3", "- 4", "+", "-", "2147483648", "-2147483649", "4 4", " 4", "٣", "0x10", "1,000"];
  for (const text of bad) assert.deepEqual(tryParseInt(text), { ok: false, value: 0 }, JSON.stringify(text));
});

test("GetColorHex: float32 channel x 255, rounded half to even (UTL:27-33)", () => {
  assert.equal(roundToInt(0.5), 0);
  assert.equal(roundToInt(1.5), 2);
  assert.equal(roundToInt(2.5), 2);
  assert.equal(roundToInt(-0.5), 0);
  assert.equal(roundToInt(-1.5), -2);
  assert.equal(Utils.GetColorHex(new Color(0, 1, 1)), "00FFFF"); // OocLabelColor
  assert.equal(Utils.GetColorHex(new Color(1, 0.92156863, 0.015686275)), "FFEB04"); // Color.yellow
  // 0.59 * 255 = 150.45 -> 150 (96); 0.15 * 255 = 38.25 -> 38 (26)
  assert.equal(Utils.GetColorHex(new Color(0.59, 0.15, 0.59)), "962696");
  // 2.5 / 255 lands on .5 after x 255 in float32 -> rounds to even 2
  assert.equal(Utils.GetColorHex(new Color(Math.fround(2.5 / 255), 0, 0)), "020000");
  // An out-of-range colour prints more digits, as {0:X2} does (PBTN:65's new Color(255, 165, 0)).
  assert.equal(Utils.GetColorHex(new Color(255, 165, 0)), "FE01A45B00");
  assert.equal(Utils.MakeColor("GM", new Color(0.59, 0.15, 0.59)), "<color=#962696>GM</color>");
});

test("GetDots (UTL:35-62)", () => {
  assert.equal(Utils.GetDots("0", "o"), "");
  assert.equal(Utils.GetDots("1", "o"), "o");
  assert.equal(Utils.GetDots("5", "o"), "ooooo");
  assert.equal(Utils.GetDots("6", "o"), "ooooo o");
  assert.equal(Utils.GetDots("10", "o"), "ooooo ooooo");
  assert.equal(Utils.GetDots("x", "o"), "");
});

test("StripTags removes every tag unless the text says Out of Character (TXT:61-72)", () => {
  const sent: string[] = [];
  const host = { setText: (_k: string, t: string) => void sent.push(t), uiColor() {} } as unknown as HostActions;
  const el = new VRPGTextElement(host, "x");
  el.SetText("<color=red>Bob</color> <b>the</b> <3 Bold");
  el.StripTags();
  // `<3 Bold` has no closing '>' so only real tags go; upstream's regex <[^>]*> would also eat '<3 Bold' if a '>' followed.
  assert.equal(el.Text, "Bob the <3 Bold");
  el.SetText("<color=#00FFFF>Out of Character</color>");
  el.StripTags();
  assert.equal(el.Text, "<color=#00FFFF>Out of Character</color>");
});

test("typed text: control characters out, line breaks kept or folded, cut to length; only color, b and i tags kept", () => {
  assert.equal(cleanTyped("a\r\nb\rc\u0007d", 100, true), "a\nb\ncd");
  assert.equal(cleanTyped("a\nb", 100, false), "a b");
  assert.equal(cleanTyped("x".repeat(600), 500, true).length, 500);
  assert.equal(cleanTyped("ab😀", 3, true), "ab");
  assert.equal(filterRichText('<size=999>big</size> <b>bold</b> <color="red">r</color> <i>i</i> <sprite=1> <3'), 'big <b>bold</b> <color="red">r</color> <i>i</i>  <3');
});
