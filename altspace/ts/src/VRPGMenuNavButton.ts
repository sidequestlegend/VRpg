// Translated from VRPG2/Scripts/UI/VRPGMenuNavButton.cs (GIB Games, MIT).
//
// `panelIndex` indexes the port's four panels (0 Main, 1 Social, 2 Options, 3 GM), not upstream's seven
// (VRPGMenuNavButton.cs:18; the Character, Powers and Map panels are not ported).

import { VRPGComponent } from "./VRPGComponent.ts";

export class VRPGMenuNavButton extends VRPGComponent {
  /** From bindings.json. */
  panelIndex = 0;

  /** VRPGMenuNavButton.cs:20-23 */
  ShowPanel(): void {
    if (this.FromRemote()) return;
    this.VRPG.Menu.ShowPanel(this.panelIndex);
  }
}
