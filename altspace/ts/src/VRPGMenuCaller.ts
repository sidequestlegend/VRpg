// Translated from VRPG2/Scripts/Core/VRPGMenuCaller.cs (GIB Games, MIT).
//
// Upstream: Q on desktop (CALLER:37-43), or "clicking your head in VR": a 1 cm trigger that follows the head every
// physics tick (CALLER:45-73). A pointer cannot click an object at its own head, so the caller becomes three
// event sources (PORT.md checklist 3, C14):
//   - the desktop key, setting `menu-key` (default Q; empty for none), from the page's key events;
//   - the left controller's secondary button (setting `menu-button`: "left-secondary" (default), "right-secondary",
//     or "none"), from the page's button events;
//   - the open button on the parked board (this behaviour's object, clickable): Interact.
// The radial-menu button PORT.md proposes has no runtime call yet (a runtime gap, listed there).
// IsUserInVR (CALLER:31) only stopped the key in VR; keys do not reach the page in a headset anyway.

import { Button, Hand, type ButtonName, type HandSide } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";

export class VRPGMenuCaller extends VRPGComponent {
  private get MenuKey(): string {
    const key = this.Settings.get("menu-key");
    return key === undefined ? "Q" : key.trim();
  }

  /** CALLER:37-43 */
  override OnKeyPressed(key: string): void {
    const wanted = this.MenuKey;
    if (wanted !== "" && key === wanted) this.Swap();
  }

  override OnButtonPressed(button: ButtonName, side: HandSide): void {
    const setting = (this.Settings.get("menu-button") ?? "left-secondary").trim();
    if (setting === "none" || button !== Button.Secondary) return;
    const wantedSide = setting === "right-secondary" ? Hand.Right : Hand.Left;
    if (side === wantedSide) this.Swap();
  }

  /** CALLER:70-73 */
  override Interact(): void {
    this.Swap();
  }

  private Swap(): void {
    this.VRPG.Menu.SwapMenuState();
  }
}
