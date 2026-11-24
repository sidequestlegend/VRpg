// Translated from VRPG2/Scripts/UI/VRPGTextElement.cs (GIB Games, MIT).
//
// Upstream this is a behaviour on each of 92 texts. None of them has a config key set (PORT.md 5.3, checklist 91),
// so OnConfigDataDownloaded (TXT:35-40) never does anything and is not translated; what is left is a wrapper
// around one text. Here it is a plain object over a kit text, addressed through the relay by its bindings key.
// The relay can set a text but not read it back (PORT.md 7, row 3), so the element keeps the page's copy, which
// StripTags (TXT:61-72) and the Text getter (TXT:142-148) read.
//
// Also here, for the port: VRPGInputField, the page's copy of a TMP_InputField's text. The page cannot read a
// uGUI field (PORT.md G8); the kit reports every edit through the graph-to-page event "field" with the field's
// object key and its text, and the page writes the field when code sets it (clearing after a send).

import { Color, type HostActions } from "../portkit/src/index.ts";
import { Utils } from "./VRPGUtils.ts";

export const TextElementStyle = { Text: 0, Dots_empty: 1, Dots_filled: 2, Squares_empty: 3, Squares_filled: 4 } as const;
export type TextElementStyleValue = (typeof TextElementStyle)[keyof typeof TextElementStyle];

export class VRPGTextElement {
  readonly key: string;
  private readonly host: HostActions;
  private value = "";
  /** TXT:48-51: the colour the text had in the kit (white unless the binding says otherwise). */
  private readonly startColor: Color;
  private colorValue: Color | null = null;

  constructor(host: HostActions, key: string, startColor: Color = Color.white) {
    this.host = host;
    this.key = key;
    this.startColor = startColor.clone();
  }

  get Text(): string {
    return this.value;
  }
  set Text(value: string) {
    this.SetText(value);
  }

  /** The colour last set, or null for the kit's own. */
  get color(): Color | null {
    return this.colorValue;
  }

  /** TXT:53-59 */
  Clear(): void {
    this.SetText("");
  }

  /** TXT:61-72: removes every rich-text tag, unless the text says "Out of Character". */
  StripTags(): void {
    if (this.value === null || this.value.includes("Out of Character")) return;
    const rich = /<[^>]*>/g;
    if (/<[^>]*>/.test(this.value)) this.SetText(this.value.replace(rich, ""));
  }

  /** TXT:88-94 */
  ResetColor(): void {
    this.SetColor(this.startColor);
  }

  /** TXT:96-102: the colour of the uGUI text (relay op uiColor). */
  SetColor(color: Color): void {
    if (this.colorValue && this.colorValue.equals(color)) return;
    this.colorValue = color.clone();
    this.host.uiColor(this.key, color);
  }

  /** TXT:103-109, and TXT:111-140 with a style. */
  SetText(targetText: string, elementStyle: TextElementStyleValue = TextElementStyle.Text): void {
    let newText = "";
    switch (elementStyle) {
      case TextElementStyle.Text:
        newText = targetText ?? "";
        break;
      case TextElementStyle.Dots_empty:
        newText = Utils.GetDots(targetText, "○");
        break;
      case TextElementStyle.Dots_filled:
        newText = Utils.GetDots(targetText, "●");
        break;
      case TextElementStyle.Squares_empty:
        newText = Utils.GetDots(targetText, "□");
        break;
      case TextElementStyle.Squares_filled:
        newText = Utils.GetDots(targetText, "■");
        break;
      default:
        break;
    }
    this.value = newText;
    this.host.setText(this.key, newText);
  }
}

/** The page's copy of one input field (see the file header). */
export class VRPGInputField {
  readonly key: string;
  private readonly host: HostActions;
  private value = "";
  /** Longest text kept; the kit's field has no limit upstream (PORT.md 5.2). */
  readonly maxLength: number;

  constructor(host: HostActions, key: string, maxLength = 500) {
    this.host = host;
    this.key = key;
    this.maxLength = maxLength;
  }

  get text(): string {
    return this.value;
  }
  /** Code setting the field: the kit's field shows it too. */
  set text(value: string) {
    this.value = String(value ?? "").slice(0, this.maxLength);
    this.host.setText(this.key, this.value);
  }

  /** The kit reported what the player typed. Not echoed back to the field. */
  Typed(value: string): void {
    this.value = String(value ?? "").slice(0, this.maxLength);
  }
}
