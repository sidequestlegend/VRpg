// Translated from VRPG2/Scripts/Core/VRPGSocial.cs (GIB Games, MIT).
//
// The player list and the selected player's card. Differences (PORT.md checklist 46-50, C10):
//   - 32 rows instead of 84, with previous / next page buttons when more players are present;
//   - players in player-id order, the same on every client;
//   - the list also refreshes when someone joins or leaves, when a name changes and when a role changes;
//   - a selected player who leaves is cleared;
//   - SyncPoolObject (SOC:105) only re-sent upstream's always-empty VarsString: not needed.

import type { GameObject, Player } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import type { VRPGPlayerButton } from "./VRPGPlayerButton.ts";
import type { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";

export class VRPGSocial extends VRPGComponent {
  // From bindings.json (SOC:26-36).
  playerLabelObject: GameObject | null = null;
  nameLabelObject: GameObject | null = null;
  titleLabelObject: GameObject | null = null;
  descLabelObject: GameObject | null = null;
  playerCountTextObject: GameObject | null = null;
  pageTextObject: GameObject | null = null;

  /** SOC:24 */
  allPlayers: Player[] = [];
  private playerLabel: VRPGTextElement | null = null;
  private nameLabel: VRPGTextElement | null = null;
  private titleLabel: VRPGTextElement | null = null;
  private descLabel: VRPGTextElement | null = null;
  private playerCountText: VRPGTextElement | null = null;
  private pageText: VRPGTextElement | null = null;
  private playerButtons: VRPGPlayerButton[] = [];
  page = 0;

  /** SOC:40 */
  SelectedPlayer: VRPGPlayerObject | null = null;

  /** SOC:48-51 */
  override Start(): void {
    const text = (o: GameObject | null) => (o ? new VRPGTextElement(this.Host, o.key) : null);
    this.playerLabel = text(this.playerLabelObject);
    this.nameLabel = text(this.nameLabelObject);
    this.titleLabel = text(this.titleLabelObject);
    this.descLabel = text(this.descLabelObject);
    this.playerCountText = text(this.playerCountTextObject);
    this.pageText = text(this.pageTextObject);
    this.playerButtons = this.FindBehavioursOfType<VRPGPlayerButton>("VRPGPlayerButton");
  }

  /** SOC:56-62 */
  SetSelectedPlayer(targetPlayer: VRPGPlayerObject): void {
    if (this.FromRemote()) return;
    this.SelectedPlayer = targetPlayer;
    if (targetPlayer.Owner) this.SetSelectedPlayerApi(targetPlayer.Owner);
  }

  /** SOC:64-76 */
  SetSelectedPlayerApi(targetApi: Player): void {
    if (this.FromRemote()) return;
    if (!targetApi.IsValid()) return;
    const object = this.VRPG.GetPlayerObject(targetApi);
    this.playerLabel?.SetText(targetApi.displayName);
    this.nameLabel?.SetText(object?.GetCharacterName() ?? "");
    this.titleLabel?.SetText(object?.GetTitle() ?? "");
    this.descLabel?.SetText(object?.GetDescription() ?? "");
  }

  /** SOC:78-84 */
  ClearSelectedPlayer(): void {
    if (this.FromRemote()) return;
    this.SelectedPlayer = null;
    this.playerLabel?.Clear();
    this.nameLabel?.Clear();
    this.titleLabel?.Clear();
    this.descLabel?.Clear();
  }

  /** SOC:86-110 */
  UpdatePlayerList(): void {
    if (this.FromRemote()) return;
    this.RefreshList();
  }

  /** The list again, as UpdatePlayerList draws it (also after joins, leaves, names and roles). */
  RefreshList(): void {
    for (const playerButton of this.playerButtons) playerButton.gameObject.SetActive(false);

    this.GetAllPlayers();
    const rows = Math.max(1, this.playerButtons.length);
    const pages = Math.max(1, Math.ceil(this.allPlayers.length / rows));
    if (this.page >= pages) this.page = pages - 1;
    const first = this.page * rows;

    for (let i = 0; i < this.playerButtons.length && first + i < this.allPlayers.length; i++) {
      const player = this.allPlayers[first + i]!;
      const playerItem = this.VRPG.GetPlayerObject(player);
      if (!playerItem) continue;
      const buttonItem = this.playerButtons[i]!;
      buttonItem.gameObject.SetActive(true);
      buttonItem.AssignCharacter(playerItem);
    }
    this.playerCountText?.SetText("Players: " + String(this.allPlayers.length));
    this.pageText?.SetText(pages > 1 ? `${this.page + 1} / ${pages}` : "");

    if (this.SelectedPlayer !== null && !this.SelectedPlayer.Owner?.IsValid()) this.ClearSelectedPlayer();
    else if (this.SelectedPlayer?.Owner) this.SetSelectedPlayerApi(this.SelectedPlayer.Owner);
  }

  /** The page buttons (not upstream: 84 rows in a scroll view there). */
  NextPage(): void {
    if (this.FromRemote()) return;
    this.page++;
    this.RefreshList();
  }
  PreviousPage(): void {
    if (this.FromRemote()) return;
    this.page = Math.max(0, this.page - 1);
    this.RefreshList();
  }

  /** SOC:112-118 */
  GetAllPlayers(): Player[] {
    this.allPlayers = this.Networking.GetPlayers();
    return this.allPlayers;
  }

  override OnPlayerJoined(): void {
    this.RefreshList();
  }

  override OnPlayerLeft(): void {
    this.RefreshList();
  }

  override OnPlayerDataUpdated(): void {
    this.RefreshList();
  }

  /** What the selected player's card shows (tests read it). */
  get SelectedCard(): { player: string; name: string; title: string } {
    return { player: this.playerLabel?.Text ?? "", name: this.nameLabel?.Text ?? "", title: this.titleLabel?.Text ?? "" };
  }
}
