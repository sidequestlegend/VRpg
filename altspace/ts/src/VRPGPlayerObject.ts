// Translated from VRPG2/Scripts/Core/VRPGPlayerObject.cs (GIB Games, MIT).
//
// One per player (a VRChat PlayerObject upstream, PP:679; a per-player behaviour here, PORT.md G2), owned by that
// player for good, synced through that player's user state. What changed and why (PORT.md 3, 7 row 9, 8.4):
//   - Name, title and description are PlayerData as upstream ("vrpg-charName", "vrpg-charTitle", "vrpg-charDesc",
//     PO:286-296): everyone present reads them; the runtime saves them on the device, not the account (G3).
//   - Roles are not written by the player about itself (ActualRoleIndex, VisibleRoleIndex were synced from the
//     owner, PO:58-60). Every client works every player's role out from sources a client cannot forge (the
//     game-master handler, RecomputeRoles) and hands it to this object (_ApplyRole). What this object does sync
//     is the grants its owner made as a staff member (`grants`, uid -> [role, server seconds]): only the owner can
//     write them, and they count only while the owner is present and holds the role (8.4).
//   - The label over the player's head: upstream moves it to the owner's head every physics tick (PO:101-112),
//     which needs other players' head positions the page does not have (G4). Here the kit holds a pool of label
//     objects (`label<n>`); each player claims a free slot (`labelSlot`, settled by player id when two claim one),
//     every client writes the texts and the role icon into that slot, and the slot's holder attaches the slot to their
//     own head with the attachment's `autoSync` (`AttachToHead(..., true)`): the kit marks the label objects attachable
//     (`KitStage.Attachable`), so every client gave each the same attachment id as the kit loaded, and the app re-parents
//     the others' copies under the holder's avatar. (Until portkit c971100 only the attaching page had the id, so the
//     labels were holder-owned synced transforms instead; PORT.md 0.7, 0.8.) In the kit the
//     label's canvas pivots at the attachment point and turns to the viewer with world up (a look-at constraint on the
//     fade sphere, which every page attaches to its own head), its text `label-height` (0.75 m, PO:106) above.
//   - What the referee publishes for everyone (the toolkit keeps nothing in public space state): the recent IC and
//     OOC lines for players who arrive later (`recent`) and the `first-joiner-gm` record (`firstJoiner`), both in the
//     referee's own player object, which only the referee can write (its user state). Readers take them only from the
//     current referee's object.
//   - Not translated: the author's flags `usedToast` / `wasToast` (PO:91-99), the cheater shaming (PO:467-487,
//     513-551), voice zones and channels (PO:176-214, 266-284), the map dot (PO:111, 217-238), the empty SetTags
//     (PO:298-304), the selected-player key nobody reads (PO:362-370), VarsString / VarsDict, which is always an
//     empty object upstream (PO:77-88, 375-378).

import { Quaternion, Vector3, type DeserializationResult, type Player } from "../portkit/src/index.ts";
import { IconController, SiteRole } from "./IconController.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";
import { cleanTyped, filterRichText, plainName } from "./VRPGUtils.ts";

/** Label objects in the kit (PORT.md R10). */
export const LABEL_POOL = 32;
export const MAX_NAME = 64;
export const MAX_TITLE = 128;
export const MAX_DESC = 500;

export const KEY_NAME = "vrpg-charName";
export const KEY_TITLE = "vrpg-charTitle";
export const KEY_DESC = "vrpg-charDesc";

/** A grant as its granter stores it: the role and the synced time it was made. */
export type GrantRecord = [number, number];

/** How far above the attachment point the kit draws a label's text (RpToolkitKitBuilder.LabelHeight). */
export const KIT_LABEL_HEIGHT = 0.75;

export class VRPGPlayerObject extends VRPGComponent {
  // Per player: the kit builder marks it (KitStage.PerPlayer, bindings "perPlayer").
  static override synced = ["labelSlot", "grants", "recent", "firstJoiner"];

  /** Synced: the label slot this player uses, -1 for none. */
  labelSlot = -1;
  /** Synced: roles this player granted, by user id. */
  grants: Record<string, GrantRecord> = {};
  /** Synced, meaningful only while this player is the referee: the recent IC and OOC lines (VRPGLogs). */
  recent: string[][] = [];
  /** Synced, meaningful only while this player is the referee: the user id `first-joiner-gm` names (GMD:109). */
  firstJoiner = "";
  private lastGrants = "{}";
  private lastFirstJoiner = "";
  /** The label slot this player's own client has attached to its head, -1 for none. */
  private attachedSlot = -1;

  /** PO:30. */
  get Owner(): Player | null {
    return this.Player;
  }
  /** PO:34 */
  loaded = false;
  /** PO:58-61, worked out by every client (not synced). */
  ActualRoleIndex = 0;
  VisibleRoleIndex = 0;
  private lastActualRoleIndex = -1;
  private lastVisibleRoleIndex = -1;
  /** PO:63 */
  IsNoOped = false;

  /** The slot this client is drawing this player's label into. */
  private slotShown = -1;
  NameLabel: VRPGTextElement | null = null;
  TitleLabel: VRPGTextElement | null = null;
  Icons: IconController | null = null;

  // ---- object init (PO:90-167) -------------------------------------------------------------------------------

  /** PO:114-124 */
  override OnPlayerRestored(player: Player): void {
    if (!player.IsValid()) return;
    if (player.sid !== this.Owner?.sid) return;
    this.loaded = true;
    this.InitializePlayerInfo();
  }

  /** PO:126-129 */
  override OnDeserialization(_result: DeserializationResult): void {
    this._OnValueChanged();
    // The grants this player made, or (from the referee) the first joiner, may have changed: every role is worked out
    // again (only then).
    const grants = JSON.stringify(this.grants ?? {});
    const first = typeof this.firstJoiner === "string" ? this.firstJoiner : "";
    if (grants !== this.lastGrants || first !== this.lastFirstJoiner) {
      this.lastGrants = grants;
      this.lastFirstJoiner = first;
      this.VRPG.GMData.RecomputeRoles();
    }
  }

  /** The local player's label follows its head: the slot it holds is attached there (PO:101-112). */
  private _AttachLabel(): void {
    if (!this.Owner?.isLocal) return;
    const slot = this.slotShown;
    if (slot === this.attachedSlot) return;
    if (this.attachedSlot >= 0) this.VRPG.Labels[this.attachedSlot]?.Detach();
    this.attachedSlot = slot;
    const label = slot >= 0 ? this.VRPG.Labels[slot] : undefined;
    if (!label) return;
    // The kit puts the text KIT_LABEL_HEIGHT above the attachment point, upright; a different `label-height` moves the
    // attachment point itself (along the head's up, so that part tilts with the head).
    const extra = this.VRPG.ConfigData.GetNumber("label-height", KIT_LABEL_HEIGHT) - KIT_LABEL_HEIGHT;
    label.AttachToHead(new Vector3(0, extra, 0), Quaternion.identity, true);
  }

  /** The label slot the local player has attached to its head (tests read it). */
  get AttachedSlot(): number {
    return this.attachedSlot;
  }

  // ---- what the referee publishes (see the file header) ---------------------------------------------------------

  /** The local player, as referee, publishes the recent lines. */
  _PublishRecent(recent: string[][]): void {
    if (!this.Owner?.isLocal) return;
    if (JSON.stringify(recent) === JSON.stringify(this.recent)) return;
    this.recent = recent;
    this.RequestSerialization();
  }

  /** The local player, as referee, publishes the first joiner. */
  _PublishFirstJoiner(uid: string): void {
    if (!this.Owner?.isLocal || this.firstJoiner === uid) return;
    this.firstJoiner = uid;
    this.lastFirstJoiner = uid;
    this.RequestSerialization();
  }

  /** PO:131-150 */
  InitializePlayerInfo(): void {
    const owner = this.Owner;
    if (!owner) return;
    if (this.VRPG.GMData.IsOnNoOpList(owner)) this.IsNoOped = true;

    if (owner.isLocal) {
      this.VRPG.Logger.DebugLog("Local pooled object was assigned.");
      this.VRPG.LocalPlayerObject = this;
      this._ClaimSlot();
    }

    this.CheckPatronColor();
    this.InitializePooledObjectGUI();
    this.VRPG.GMData.OnConfigDataDownloaded();
  }

  /** PO:152-166 */
  _OnCleanup(): void {
    this.NameLabel?.Clear();
    this.TitleLabel?.Clear();
  }

  // ---- labels --------------------------------------------------------------------------------------------------

  /** The local player takes the lowest slot no other present player holds. */
  _ClaimSlot(): void {
    const owner = this.Owner;
    if (!owner?.isLocal) return;
    if (!this.VRPG.ConfigData.GetBool("labels") && this.VRPG.ConfigData.GetValue("labels") !== "") return;
    const taken = new Set<number>();
    for (const other of this.VRPG.GetAllPlayerObjects()) if (other !== this && other.labelSlot >= 0) taken.add(other.labelSlot);
    let slot = -1;
    for (let i = 0; i < LABEL_POOL; i++) {
      if (!taken.has(i)) {
        slot = i;
        break;
      }
    }
    if (slot === this.labelSlot) return;
    this.labelSlot = slot;
    this.RequestSerialization();
    this._ShowSlot();
  }

  /** When two players hold one slot, the one with the higher player id picks again. */
  _CheckSlot(): void {
    const owner = this.Owner;
    if (!owner?.isLocal || this.labelSlot < 0) return;
    for (const other of this.VRPG.GetAllPlayerObjects()) {
      if (other === this || other.labelSlot !== this.labelSlot) continue;
      if ((other.Owner?.playerId ?? 0) < owner.playerId) {
        this._ClaimSlot();
        return;
      }
    }
  }

  /** Points this client's label elements at the slot the player holds now, and fills it. */
  _ShowSlot(): void {
    const slot = this.labelSlot;
    if (slot === this.slotShown) return;
    if (this.slotShown >= 0) this._ReleaseSlot(this.slotShown);
    this.slotShown = slot;
    if (slot < 0 || slot >= LABEL_POOL) {
      this.NameLabel = this.TitleLabel = null;
      this.Icons = null;
      this._AttachLabel();
      return;
    }
    this.NameLabel = new VRPGTextElement(this.Host, `label${slot}Name`);
    this.TitleLabel = new VRPGTextElement(this.Host, `label${slot}Title`);
    this.Icons = new IconController(this.Host, [0, 1, 2, 3].map((i) => `label${slot}Icon${i}`));
    this.Host.setActive(`label${slot}`, true);
    this.lastVisibleRoleIndex = -1;
    this.UpdateRoleUi();
    this.UpdateObjectGUI();
    this._AttachLabel();
  }

  /** Hides a slot unless another present player now holds it. */
  private _ReleaseSlot(slot: number): void {
    for (const other of this.VRPG.GetAllPlayerObjects()) {
      if (other !== this && other.Player?.IsValid() && other.labelSlot === slot) {
        other._Redraw();
        return;
      }
    }
    this.Host.setActive(`label${slot}`, false);
  }

  /** Writes this player's label again (another player who drew into the same slot has moved on). */
  _Redraw(): void {
    this.slotShown = -1;
    this._ShowSlot();
  }

  /** The player left (or the instance stops): their label goes. */
  override OnDestroy(): void {
    if (this.slotShown >= 0) this._ReleaseSlot(this.slotShown);
    this.slotShown = -1;
    if (this.attachedSlot >= 0) this.VRPG.Labels[this.attachedSlot]?.Detach();
    this.attachedSlot = -1;
    if (this.VRPG.LocalPlayerObject === this) this.VRPG.LocalPlayerObject = null;
  }

  /** The label slot this client draws into (tests read it). */
  get ShownSlot(): number {
    return this.slotShown;
  }

  // ---- public methods (PO:169-215) ---------------------------------------------------------------------------

  /** PO:171-174 */
  AskForUpdate(): void {
    if (this.Owner?.isLocal) this.RequestSerialization();
  }

  // ---- NotifyValueChanged (PO:242-339) ----------------------------------------------------------------------------

  /** PO:244-252: only this object's own player's data matters to it. */
  override OnPlayerDataUpdated(player: Player, _keys: string[]): void {
    if (player.sid !== this.Owner?.sid) return;
    this.UpdateValues();
  }

  /** PO:257-263, without VarsString. */
  NotifyValueChanged(): void {
    this._OnValueChanged();
    if (this.Owner?.isLocal) this.RequestSerialization();
  }

  /** PO:286-290. Only the owner's client writes its own PlayerData. */
  SetNameAndTitle(newName: string, newTitle: string): void {
    if (!this.Owner?.isLocal) return;
    this.PlayerData.SetString(KEY_NAME, cleanTyped(newName, MAX_NAME, false));
    this.PlayerData.SetString(KEY_TITLE, cleanTyped(newTitle, MAX_TITLE, false));
    this.UpdateValues();
  }

  /** PO:292-296 */
  SetDescription(newDesc: string): void {
    if (!this.Owner?.isLocal) return;
    const finalDesc = cleanTyped(newDesc, MAX_DESC, false).split("$").join("\n");
    this.PlayerData.SetString(KEY_DESC, finalDesc);
  }

  /**
   * PO:306-337: the role of this object's player, as this client worked it out. Upstream the owner sets its own
   * role on a network event and syncs it; here every client applies what RecomputeRoles found.
   */
  _ApplyRole(siteRole: number): void {
    const owner = this.Owner;
    if (!owner?.IsValid()) return;

    if (this.VRPG.GMData.IsOnNoOpList(owner)) siteRole = SiteRole.Normal;

    let visible = 0;
    switch (siteRole) {
      case SiteRole.Controller:
        visible = 1;
        break;
      case SiteRole.Admin:
        visible = 2;
        break;
      case SiteRole.Janitor:
        visible = 2; // PO:327-330: the top role shows the operator's icon
        break;
    }
    this.VisibleRoleIndex = visible;
    this.ActualRoleIndex = siteRole;
    this._OnValueChanged();
  }

  // ---- grants (the port's; see the file header) ------------------------------------------------------------------

  /** The local player records a role it gives (or takes away: 0) as a staff member. */
  _Grant(uid: string, role: number, at: number): void {
    if (!this.Owner?.isLocal) return;
    this.grants = { ...this.grants, [uid]: [role, at] };
    this.RequestSerialization();
    this.VRPG.GMData.RecomputeRoles();
  }

  /** The grant this player made for `uid`, if any. */
  GrantFor(uid: string): GrantRecord | null {
    const record = this.grants[uid];
    if (!Array.isArray(record) || typeof record[0] !== "number" || typeof record[1] !== "number") return null;
    return record;
  }

  // ---- GM checks (PO:341-372) -------------------------------------------------------------------------------------

  /** PO:343-355 */
  GetGMStatus(target: Player): number {
    return this.VRPG.GetPlayerObject(target)?.ActualRoleIndex ?? 0;
  }

  /** PO:357-360 */
  GetActualRoleIndex(): number {
    return this.ActualRoleIndex;
  }

  // ---- private methods (PO:374-560) -------------------------------------------------------------------------------

  /** PO:380-392 */
  private InitializePooledObjectGUI(): void {
    const owner = this.Owner!;
    if (owner.isLocal) {
      if (this.PlayerData.Has(owner, KEY_NAME) && this.PlayerData.Has(owner, KEY_TITLE)) {
        this.VRPG.Menu.SetNameAndTitleInputValues(this.PlayerData.GetString(owner, KEY_NAME), this.PlayerData.GetString(owner, KEY_TITLE));
      }
    }
    this.NameLabel?.SetText("");
    this.TitleLabel?.SetText("");
    // Not upstream: the saved values show at once (upstream waits for OnPlayerDataUpdated).
    this.UpdateObjectGUI();
  }

  /** PO:394-408 */
  private _OnValueChanged(): void {
    this._ShowSlot();
    this.VRPG.LocalPlayerObject?._CheckSlot();
    if (this.VisibleRoleIndex !== this.lastVisibleRoleIndex || this.ActualRoleIndex !== this.lastActualRoleIndex) {
      this.UpdateRole();
      this.UpdateRoleUi();
    }
  }

  /** PO:410-416 */
  private UpdateValues(): void {
    this.UpdateObjectGUI();
  }

  /** PO:418-421 */
  UpdateRole(): void {
    this.lastActualRoleIndex = this.ActualRoleIndex;
  }

  /** PO:423-442 */
  UpdateRoleUi(): void {
    this.Icons?.SetIcon(this.VisibleRoleIndex);
    this.lastVisibleRoleIndex = this.VisibleRoleIndex;
  }

  /** IconController.SyncIcons on this player's label (MGR:163). */
  SyncIcons(): void {
    this.Icons?.SyncIcons();
  }

  /** PO:452-511, without the cheater block (PO:467-487). Text from other players is cleaned before it is shown. */
  UpdateObjectGUI(): void {
    if (!this.loaded) return;
    const owner = this.Owner;
    if (!owner?.IsValid()) return;
    this.CheckPatronColor();

    const tempName = filterRichText(cleanTyped(this.PlayerData.GetString(owner, KEY_NAME), MAX_NAME, false));
    this.NameLabel?.SetText(tempName);

    // prevent custom colors for non-staff
    if (!this.VRPG.GMData.IsOnAutomodList(owner)) this.NameLabel?.StripTags();

    if (this.VRPG.GMData.IsOnNoOpList(owner)) {
      this.NameLabel?.SetText("");
      this.TitleLabel?.SetText("");
      return;
    }

    const tempTitle = filterRichText(cleanTyped(this.PlayerData.GetString(owner, KEY_TITLE), MAX_TITLE, false));
    this.TitleLabel?.SetText(tempTitle);

    // Set local values for plates
    if (owner.isLocal) this.VRPG.Menu.SetPlates(tempName, tempTitle);
  }

  /** PO:553-559 */
  private CheckPatronColor(): void {
    const owner = this.Owner;
    if (owner && this.VRPG.PatronData.IsPatron(owner)) this.NameLabel?.SetColor(this.VRPG.Options.VipLabelColor);
    else this.NameLabel?.ResetColor();
  }

  // ---- aliases (PO:562-581) ----------------------------------------------------------------------------------------

  /** PO:564-574 */
  GetCharacterName(): string {
    const owner = this.Owner;
    if (owner?.IsValid() && this.PlayerData.Has(owner, KEY_NAME)) return filterRichText(cleanTyped(this.PlayerData.GetString(owner, KEY_NAME), MAX_NAME, false));
    return "";
  }
  GetTitle(): string {
    const owner = this.Owner;
    return owner?.IsValid() ? filterRichText(cleanTyped(this.PlayerData.GetString(owner, KEY_TITLE), MAX_TITLE, false)) : "";
  }
  GetDescription(): string {
    const owner = this.Owner;
    return owner?.IsValid() ? filterRichText(cleanTyped(this.PlayerData.GetString(owner, KEY_DESC), MAX_DESC, true)) : "";
  }
  /** PO:575 */
  GetOwnerName(): string {
    return plainName(this.Owner?.displayName ?? "");
  }
  /** PO:576 */
  IsMod(): boolean {
    return this.ActualRoleIndex > 0 || (this.Owner !== null && this.VRPG.GMData.ShouldBeController(this.Owner));
  }
  /** PO:577-579 */
  IsJanitor(): boolean {
    return this.ActualRoleIndex >= 3;
  }
  IsOperator(): boolean {
    return this.ActualRoleIndex >= 2;
  }
  IsController(): boolean {
    return this.ActualRoleIndex >= 1;
  }
}
