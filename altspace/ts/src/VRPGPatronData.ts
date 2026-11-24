// Translated from VRPG2/Scripts/Utilities/VRPGPatronData.cs (GIB Games, MIT; the upstream file is Windows-1252).
//
// By decision, patron features become the setting `vip-uids` (user ids, separated by spaces or commas) and the
// credits text the setting `credits`. Removed: the download from the author's site (PAT:44-60, MP:62788), the list
// parser that only served it (PAT:62-127), the tier colours, and the check that made the author's display name a
// patron everywhere (PAT:139). PatronItems is empty in the shipped prefab (PORT.md checklist 78), so there is
// nothing for ForceShowPatronItems to show.

import type { GameObject, Player } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";

export class VRPGPatronData extends VRPGComponent {
  /** From bindings.json: the credits text on the Options panel (PAT:35-36). */
  PatronCreditsObject: GameObject | null = null;
  PatronItems: GameObject[] = [];

  override Start(): void {
    const credits = this.Settings.get("credits") ?? "";
    if (this.PatronCreditsObject) new VRPGTextElement(this.Host, this.PatronCreditsObject.key).SetText(credits.split("$").join("\n"));
  }

  override OnPlayerJoined(player: Player): void {
    // PAT:123-126: patron items follow the local player's standing.
    if (player.isLocal) for (const g of this.PatronItems) g.SetActive(this.IsPatron(player));
  }

  /** PAT:129-135 */
  ForceShowPatronItems(): void {
    for (const g of this.PatronItems) g.SetActive(true);
  }

  /** PAT:137-152, by user id. */
  IsPatron(target: Player): boolean {
    return this.VRPG.ConfigData.IsOnConfigList("vip-uids", target.uid);
  }
}
