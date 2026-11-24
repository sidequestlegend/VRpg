// Translated from VRPG2/Scripts/UI/VRPGIconElement.cs (GIB Games, MIT).
//
// A plain object over one uGUI Image of the kit, addressed through the relay by its bindings key. Colour goes
// through the relay op uiColor. Upstream's two instances are the stream icon and the map dot (PORT.md 5.5), both
// left out (checklist 22, 83), so nothing in the port makes one yet; the file is kept for the label kit.
// ChangeImage (:35-39) needs a sprite reference, which the relay cannot pass: not translated.

import { Color, type HostActions } from "../portkit/src/index.ts";

export class VRPGIconElement {
  readonly key: string;
  private readonly host: HostActions;
  private readonly defaultColor: Color;
  private current: Color | null = null;

  constructor(host: HostActions, key: string, defaultColor: Color = Color.white) {
    this.host = host;
    this.key = key;
    this.defaultColor = defaultColor.clone();
  }

  get color(): Color | null {
    return this.current;
  }

  /** :27-31 (the sprite is the kit's and stays). */
  Clear(): void {
    this.SetColor(Color.clear);
  }
  /** :32 */
  SetTransparent(): void {
    this.SetColor(Color.clear);
  }
  /** :33 */
  SetColor(color: Color): void {
    this.current = color.clone();
    this.host.uiColor(this.key, color);
  }
  /** :34 */
  ResetColor(): void {
    this.SetColor(this.defaultColor);
  }
}
