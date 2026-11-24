// Translated from VRPG2/Scripts/UI/VRPGPlayerButton.cs (GIB Games, MIT).
//
// One row of the player list. Differences (PORT.md checklist 47-48):
//   - staff rows are the intended orange: upstream writes new Color(255, 165, 0), out of range, which renders as
//     yellow like everyone else's (PBTN:65);
//   - the label is written for every player, also one who never stored a name (upstream skips them, PBTN:59, so a
//     reused row kept the previous player's label);
//   - a row is hidden instead of made non-interactable (G8);
//   - the selected-player key upstream writes to PlayerData (PBTN:75, PO:362-370) is read nowhere: not written.

import { Color, type GameObject } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import type { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";
import { Utils } from "./VRPGUtils.ts";

export const STAFF_ROW_COLOR = new Color(1, 165 / 255, 0, 1);

export class VRPGPlayerButton extends VRPGComponent {
  /** From bindings.json: the row's label text. */
  buttonLabelObject: GameObject | null = null;

  /** PBTN:21 */
  targetPlayer: VRPGPlayerObject | null = null;
  private buttonLabel: VRPGTextElement | null = null;

  /** PBTN:26-37 */
  override Start(): void {
    this.ValidateButton();
  }

  private ValidateButton(): void {
    if (this.buttonLabel === null && this.buttonLabelObject) this.buttonLabel = new VRPGTextElement(this.Host, this.buttonLabelObject.key);
  }

  /** PBTN:39-45 */
  NoCharacter(): void {
    this.ValidateButton();
    this.buttonLabel?.SetText("");
    this.targetPlayer = null;
    this.gameObject.SetActive(false);
  }

  /** PBTN:47-69 */
  AssignCharacter(target: VRPGPlayerObject): void {
    if (!target.Owner?.IsValid()) return;
    this.ValidateButton();
    this.targetPlayer = target;
    const charName = target.GetCharacterName();
    const isGM = target.IsMod();
    this.buttonLabel?.SetText(this.GenerateButtonContent(target, charName));
    this.buttonLabel?.SetColor(isGM ? STAFF_ROW_COLOR : Color.yellow);
  }

  /** PBTN:71-77 */
  SelectPlayer(): void {
    if (this.targetPlayer === null || !this.targetPlayer.Owner?.IsValid()) return;
    this.Debug.Log("Setting Selected player to: " + this.targetPlayer.Owner.displayName);
    this.VRPG.Social.SetSelectedPlayer(this.targetPlayer);
  }

  /** PBTN:79-108 */
  GenerateButtonContent(player: VRPGPlayerObject, characterName: string): string {
    const owner = player.Owner;
    if (!owner?.IsValid()) return "";
    const playerLabel = `${this.GiveModAbbreviation(player)}${owner.displayName}`;
    // If player has no name set, ignore subtitle and just return player name
    if (characterName === "" || characterName === " ") return playerLabel;
    let playerSubtitle = "\n";
    // if subtitle starts with a < it represents a state of some kind, ignore "Playing:"
    if (characterName.length > 0 && characterName[0] === "<") playerSubtitle += characterName;
    else playerSubtitle += `As: ${characterName}`;
    return playerLabel + playerSubtitle;
  }

  /** PBTN:110-127 */
  GiveModAbbreviation(target: VRPGPlayerObject): string {
    const gm = this.VRPG.GMData;
    const options = this.VRPG.Options;
    if (target.IsJanitor()) return `[${Utils.MakeColor(gm.GameMasterAbv, options.GmColor)}] `;
    if (target.IsOperator()) return `[${Utils.MakeColor(gm.GameStaffAbv, options.StaffColor)}] `;
    if (target.IsController()) return `[${Utils.MakeColor(gm.GameTempAbv, options.TempStaffColor)}] `;
    return "";
  }

  /** What the row shows (tests read it). */
  get Label(): string {
    return this.buttonLabel?.Text ?? "";
  }
}
