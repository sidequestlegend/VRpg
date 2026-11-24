// Translated from VRPG2/Scripts/Core/VRPGManager.cs (GIB Games, MIT).
//
// The registry the other parts reach through `VRPG`. Its components come from bindings.json; GameName and the two
// label colours are settings (`game-name`, `label-color`, `ooc-color`). The player objects are the runtime's
// per-player behaviours (VRChat PlayerObjects, PORT.md G2), so GetLocalPlayerObject and GetPlayerObject ask the
// runtime instead of Networking.GetPlayerObjects (MGR:97-123).
// Not translated: VoiceController, Character and Regions (left out: PORT.md L5, L6, L8); SetVoiceZone and
// AddVoiceChannel (MGR:125-137, voice: No); SavePlayerData and LoadPlayerData (MGR:139-151, no caller); the two
// static JSON helpers duplicate Utils (MGR:60-87).

import { Color, type Player } from "../portkit/src/index.ts";
import type { DiceRollerD20 } from "./DiceRollerD20.ts";
import type { DiceRollerDS } from "./DiceRollerDS.ts";
import type { VRPGConfigData } from "./VRPGConfigData.ts";
import type { VRPGGameMasterData } from "./VRPGGameMasterData.ts";
import type { VRPGLogs } from "./VRPGLogs.ts";
import type { VRPGMenu } from "./VRPGMenu.ts";
import type { VRPGOptions } from "./VRPGOptions.ts";
import type { VRPGPatronData } from "./VRPGPatronData.ts";
import type { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import type { VRPGPlayerTeleport } from "./VRPGPlayerTeleport.ts";
import type { VRPGSocial } from "./VRPGSocial.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { parseColor } from "./VRPGUtils.ts";

export class VRPGManager extends VRPGComponent {
  // From bindings.json (MGR:28-50).
  GMData!: VRPGGameMasterData;
  Menu!: VRPGMenu;
  Logger!: VRPGLogs;
  PatronData!: VRPGPatronData;
  Social!: VRPGSocial;
  ConfigData!: VRPGConfigData;
  Teleporter!: VRPGPlayerTeleport;
  Options!: VRPGOptions;
  DiceDS: DiceRollerDS | null = null;
  DiceD20: DiceRollerD20 | null = null;

  /** MGR:52-53 */
  LocalPlayerObject: VRPGPlayerObject | null = null;

  /** MGR:25-26 and 55-57 (upstream defaults: "Your Game Name!", Color.yellow, Color.cyan). */
  GameName = "Your Game Name!";
  LabelColor = Color.yellow;
  OocLabelColor = new Color(0, 1, 1, 1);

  override CacheManager(): void {
    // The manager is its own VRPG.
  }

  override get VRPG(): VRPGManager {
    return this;
  }

  override Start(): void {
    const name = this.Settings.get("game-name");
    if (name !== undefined && name !== "") this.GameName = name;
    this.LabelColor = parseColor(this.Settings.get("label-color"), this.LabelColor);
    this.OocLabelColor = parseColor(this.Settings.get("ooc-color"), this.OocLabelColor);
    // Which roller the Main panel shows (the prefab has the DS roller only; the d20 roller is a separate prefab).
    const dice = (this.Settings.get("dice") ?? "ds").trim().toLowerCase();
    this.DiceDS?.gameObject.SetActive(dice !== "d20");
    this.DiceD20?.gameObject.SetActive(dice === "d20" || dice === "both");
  }

  /** MGR:92-95 */
  HandlerLog(message: string): void {
    this.Logger.DebugLog(message);
  }

  /** MGR:97-111 */
  GetLocalPlayerObject(): VRPGPlayerObject | null {
    if (this.LocalPlayerObject === null || !this.LocalPlayerObject.Player?.IsValid()) {
      const mine = this.PlayerBehaviour<VRPGPlayerObject>(this.Networking.LocalPlayer, "VRPGPlayerObject");
      if (!mine) {
        this.Logger.DebugLog(`ERROR 410: Error finding VRPGPlayerObject associated with local player ${this.Networking.LocalPlayer.displayName}`);
        return null;
      }
      this.LocalPlayerObject = mine;
    }
    return this.LocalPlayerObject;
  }

  /** MGR:113-123 */
  GetPlayerObject(targetPlayer: Player): VRPGPlayerObject | null {
    const found = this.PlayerBehaviour<VRPGPlayerObject>(targetPlayer, "VRPGPlayerObject");
    if (!found) {
      this.Logger.DebugLog(`ERROR 410: Error finding VRPGPlayerObject associated with player ${targetPlayer}`);
      return null;
    }
    return found;
  }

  /** Every player's object, in player-id order. */
  GetAllPlayerObjects(): VRPGPlayerObject[] {
    return this.PlayerBehaviours<VRPGPlayerObject>("VRPGPlayerObject");
  }

  /** MGR:158-165 */
  SetNameAndTitle(nname: string, ntitle: string): void {
    if (this.FromRemote()) return;
    const mine = this.GetLocalPlayerObject();
    if (mine) {
      mine.SetNameAndTitle(nname, ntitle);
      mine.SyncIcons();
    }
  }

  /** MGR:167-173 */
  SetDescription(nDesc: string): void {
    if (this.FromRemote()) return;
    this.GetLocalPlayerObject()?.SetDescription(nDesc);
  }
}
