// Translated from VRPG2/Scripts/Core/VRPGGameMasterData.cs (GIB Games, MIT).
//
// Roles, the staff-only parts of the menu, and the game-master tools. The trust model is the port's own
// (PORT.md 8.4, C1-C4; coordinator decisions recorded in PORT.md):
//
//   Role 3 "Game Master" (upstream: "Janitor", the author's own account, GMD:125-138)
//       a player the platform reports as the world's owner or a moderator (`isSpaceAdmin`), or one who has
//       registered in protected space state (`gm-<uid>`, which only such players can write). Other clients do not
//       see a moderator's `isSpaceAdmin`, hence the record; it names the session that wrote it and counts only for
//       that session, so a moderator who loses the role is no Game Master the next time they come (review finding 3).
//   Role 2 "Operator": on the `staff-uids` setting (upstream: StaffList of display names from the author's site), or
//       granted.
//   Role 1 "Instance Lead": granted; or, only with the setting `first-joiner-gm` (off by default), the player the
//       referee recorded as the first in the instance (upstream: always the instance master, GMD:109). The record is
//       in the referee's own player object (its user state), read only from the current referee.
//   Role 0 everyone else, and always anyone on `no-staff-uids` (upstream: ExileManifest): the setting overrules
//       every record, so it is also how a world's owner takes back a lasting grant from someone they cannot reach.
//
//   Grants: a Game Master's grant is written to protected space state (`st-<uid>` = {r, at, by}) and lasts; any
//   other staff member's grant is written to their own user state (VRPGPlayerObject.grants) and counts while they
//   are present and hold at least that role. The latest valid record for a player wins; a record cannot overrule a
//   grant above its granter's own role. A user-state grant dated later than the server clock when this client first
//   saw it (plus GRANT_SLACK) is refused: the granter writes its own date, and a date in the future would outlast every
//   later change (review finding 6). Upstream's guard is kept (GMD:233): nothing above your own role, nothing
//   above Operator by grant, and an Instance Lead cannot change the world's owner.
//
// Every client works out every player's role from those sources alone (RecomputeRoles): protected state, the
// granters' own user state, the referee's user state and the element's settings. None of them is public space state,
// so a forged event or a player writing about itself changes nothing. Every network event that acts (bring, teleport everyone, respawn
// everyone, asking where a player is) checks its sender's role on the receiving side; upstream checks none
// (PORT.md 3.2, C3).
//
// Removed by decision: the author back door (TryElevate, Welp, IsOnGameMasterList, the saved key 4256, the
// "butts" phrase, GMD:125-219), the author's `wasToast` flag (GMD:77-80), the agree box and version (GMD:69-72),
// the exile message (GMD:412-430). Left out: ST Voice (GMD:728-762, no voice API), ST Speed (GMD:764-780, needs
// SetSettings), the empty Exile / Un-Exile (GMD:396-410, 698-726), the janitor spawn (GMD:687-690, its panel is
// inactive), RespawnPickups (GMD:792-804, no caller), the no-teleport flag (GMD:497, 543; two spellings, never set).

import {
  NetworkEventTarget,
  Quaternion,
  Vector3,
  fnv1a,
  type AudioClipRef,
  type AudioSourceRef,
  type GameObject,
  type Player,
} from "../portkit/src/index.ts";
import { SiteRole } from "./IconController.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import type { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";
import { Utils } from "./VRPGUtils.ts";

/** Protected-state key for a user id (keys allow A-Z a-z 0-9 _ - @, at most 64). */
export function uidKey(uid: string): string {
  return /^[A-Za-z0-9_@-]{1,56}$/.test(uid) ? uid : "h" + fnv1a(uid);
}

interface Point {
  position: Vector3;
  yaw: number;
}

interface RoleRecord {
  r: number;
  at: number;
  /** The granter's session, for a record from user state; null for a protected one. */
  fromSid: string | null;
  order: string;
}

const POINT_NAMES = ["a", "b", "c", "d", "e", "f"];
/** Seconds a user-state grant may be dated ahead of this client's server clock (clocks differ a little). */
export const GRANT_SLACK = 10;

export class VRPGGameMasterData extends VRPGComponent {
  /**
   * What other clients may ask of this client (README: nothing else can be named by an event). Each handler that
   * acts checks who sent it (AskWhere, AnswerWhere, DoForceBring, GoSpawn*, GoRespawn); SyncCallST only plays the
   * alert for staff, which anyone may ask for, as upstream.
   */
  static override networkCallable = [
    "SyncCallST",
    "AskWhere",
    "AnswerWhere",
    "DoForceBring",
    "GoSpawn0",
    "GoSpawn1",
    "GoSpawn2",
    "GoSpawn3",
    "GoSpawn4",
    "GoSpawn5",
    "GoRespawn",
  ];

  /** The first joiner as last read from a referee's player object (kept across a change of referee). */
  private firstJoinerRead = "";
  /** When this client first saw each user-state grant (server seconds), by granter, target and record. */
  private readonly grantSeen = new Map<string, number>();

  // From bindings.json (GMD:22-26, 43-47).
  GMObjects: GameObject[] = [];
  OperatorObjects: GameObject[] = [];
  teleTargetLabel: GameObject | null = null;
  teleButtons: GameObject[] = [];
  GMSound: AudioSourceRef | null = null;
  GMClip: AudioClipRef | null = null;

  // GMD:28-35, from settings.
  GameMasterTitle = "Game Master";
  GameMasterAbv = "GM";
  GameStaffTitle = "Operator";
  GameStaffAbv = "O";
  GameTempTitle = "Instance Lead";
  GameTempAbv = "L";

  /** TMP_Dropdown teleTarget (GMD:46): 0 "Local", 1 "All". */
  teleTarget = 0;
  /** GMD:54 TeleportPoints[0..5] and GMD:58 noBox, from settings. */
  TeleportPoints: Array<Point | null> = [];
  noBox: Point | null = null;

  /** Role of every present player by session id, as this client worked it out. */
  private readonly roles = new Map<string, number>();
  private localRoleShown = -1;
  /** Teleport-to questions this client asked: target player id -> when. */
  private readonly askedWhere = new Map<number, number>();
  /** Where this client last faced, in degrees (the page is told the head's pose only while it moves). */
  private lastYaw = 0;
  /** Times the GM alert was asked to play here (tests read it). */
  gmAlertsPlayed = 0;
  /** Requests this client refused, as "<event> from <player>" (tests read it). */
  readonly refused: string[] = [];

  override Start(): void {
    const s = (name: string, fallback: string) => {
      const value = this.Settings.get(name);
      return value === undefined || value === "" ? fallback : value;
    };
    this.GameMasterTitle = s("gm-title", this.GameMasterTitle);
    this.GameMasterAbv = s("gm-abbr", this.GameMasterAbv);
    this.GameStaffTitle = s("staff-title", this.GameStaffTitle);
    this.GameStaffAbv = s("staff-abbr", this.GameStaffAbv);
    this.GameTempTitle = s("lead-title", this.GameTempTitle);
    this.GameTempAbv = s("lead-abbr", this.GameTempAbv);

    const config = this.VRPG.ConfigData;
    const count = Math.max(0, Math.min(6, Math.floor(config.GetNumber("teleport-points", 0))));
    this.TeleportPoints = POINT_NAMES.map((n, i) => {
      if (i >= count) return null;
      const position = config.GetVector3(`tp-${n}`) ?? Vector3.zero;
      return { position, yaw: config.GetNumber(`tp-${n}-yaw`, 0) };
    });
    this.teleButtons.forEach((button, i) => button.SetActive(i < count));
    const exile = config.GetVector3("tp-exile");
    this.noBox = exile ? { position: exile, yaw: config.GetNumber("tp-exile-yaw", 0) } : null;
    this.ShowTeleTarget();
    this.ActivateModItems(false);
    this.ActivateOperatorItems(false);
  }

  // ---- roles ---------------------------------------------------------------------------------------------------

  /**
   * GMD:67-123. Upstream each client decides its own role here when configuration arrives. Here every client
   * recomputes every player's role, then the local player's staff items follow its own.
   */
  OnConfigDataDownloaded(): void {
    const config = this.VRPG.ConfigData;
    const me = this.Networking.LocalPlayer;
    // A Game Master registers in protected state, which only such players can write; the room refuses others. The
    // record names this session: it counts for nobody else, and not after this session ends.
    if (this.Protected.CanWrite && !this.ProtectedSelf(me)) {
      this.Protected.Set(`gm-${uidKey(me.uid)}`, { r: SiteRole.Janitor, by: me.uid, sid: me.sid, at: this.Networking.GetServerTimeInSeconds() });
    }
    // first-joiner-gm: the referee keeps the record pointing at a present player, as VRChat passes on the master.
    if (config.GetBool("first-joiner-gm") && this.Networking.IsMaster) {
      const present = this.Networking.GetPlayers();
      const current = this.firstJoiner;
      const first = present.length && !present.some((p) => p.uid === current) ? present[0]!.uid : current;
      if (first !== "") {
        this.firstJoinerRead = first;
        this.VRPG.GetLocalPlayerObject()?._PublishFirstJoiner(first);
      }
    }
    this.RecomputeRoles();
  }

  /** The user id `first-joiner-gm` names: from the current referee's player object, else the last one read. */
  get firstJoiner(): string {
    const master = this.Networking.Master;
    const from = master ? this.PlayerBehaviour<VRPGPlayerObject>(master, "VRPGPlayerObject") : null;
    if (from && typeof from.firstJoiner === "string" && from.firstJoiner !== "") this.firstJoinerRead = from.firstJoiner;
    return this.firstJoinerRead;
  }

  /** Works out every present player's role from the trusted sources, and applies it. */
  RecomputeRoles(): void {
    const players = this.Networking.GetPlayers();
    const objects = new Map<string, VRPGPlayerObject>();
    for (const o of this.VRPG.GetAllPlayerObjects()) if (o.Player) objects.set(o.Player.sid, o);

    const base = new Map<string, number>();
    for (const p of players) base.set(p.sid, this.BaseRole(p));
    let roles = new Map(base);
    const now = this.Networking.GetServerTimeInSeconds();
    // A chain of grants (a lead made by a lead made by ...) settles one link per round: as many rounds as players.
    for (let round = 0; round <= players.length; round++) {
      const next = new Map<string, number>();
      for (const target of players) {
        if (this.IsOnNoOpList(target)) {
          next.set(target.sid, SiteRole.Normal);
          continue;
        }
        const records: RoleRecord[] = [];
        const stored = this.Protected.Get<unknown>(`st-${uidKey(target.uid)}`, null);
        if (stored && typeof stored === "object") {
          const rec = stored as { r?: unknown; at?: unknown; by?: unknown };
          if (typeof rec.r === "number" && typeof rec.at === "number" && rec.r >= 0 && rec.r <= 2) records.push({ r: rec.r, at: rec.at, fromSid: null, order: "0" });
        }
        for (const granter of players) {
          if (granter.sid === target.sid) continue;
          const record = objects.get(granter.sid)?.GrantFor(target.uid);
          if (!record) continue;
          const [r, at] = record;
          if (!Number.isInteger(r) || r < 0 || r > 2 || !Number.isFinite(at)) continue;
          const seenKey = `${granter.sid}|${target.uid}|${r}|${at}`;
          let seen = this.grantSeen.get(seenKey);
          if (seen === undefined) this.grantSeen.set(seenKey, (seen = now));
          if (at > seen + GRANT_SLACK) continue; // dated in the future when it arrived: refused
          const granterRole = roles.get(granter.sid) ?? 0;
          if (granterRole < Math.max(r, 1)) continue;
          if (granterRole === SiteRole.Controller && target.isSpaceAdmin) continue;
          records.push({ r, at, fromSid: granter.sid, order: "1" + granter.uid });
        }
        records.sort((a, b) => a.at - b.at || (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
        let level = 0;
        for (const rec of records) {
          if (rec.fromSid !== null && (roles.get(rec.fromSid) ?? 0) < level) continue; // cannot overrule a higher grant
          level = rec.r;
        }
        next.set(target.sid, Math.max(base.get(target.sid) ?? 0, level));
      }
      const same = players.every((p) => next.get(p.sid) === roles.get(p.sid));
      roles = next;
      if (same) break;
    }

    this.roles.clear();
    for (const [sid, role] of roles) this.roles.set(sid, role);
    for (const [sid, object] of objects) object._ApplyRole(this.roles.get(sid) ?? 0);

    const mine = this.roles.get(this.Networking.LocalPlayer.sid) ?? 0;
    if (mine !== this.localRoleShown) {
      this.localRoleShown = mine;
      this.ApplyLocalRole(mine);
    }
    // Labels and the player list follow (a name keeps its colour only for staff).
    for (const object of objects.values()) object.UpdateObjectGUI();
    this.VRPG.Social.RefreshList();
  }

  /** GMD:84-122: what the local player's role switches on, with upstream's branches. */
  private ApplyLocalRole(role: number): void {
    const operators = this.VRPG.ConfigData.GetBool("enableOperators");
    if (role >= SiteRole.Janitor || (role >= SiteRole.Admin && operators)) {
      this.ActivateModItems(true);
      this.ActivateOperatorItems(true);
    } else if (role >= SiteRole.Controller) {
      this.ActivateModItems(true);
      this.ActivateOperatorItems(false);
    } else {
      this.ActivateModItems(false);
      this.ActivateOperatorItems(false); // upstream leaves them as they were; a revoked operator kept them
    }
    const local = this.VRPG.LocalPlayerObject;
    if (local) local.UpdateObjectGUI();
    else this.VRPG.Menu.RefreshPlates();
  }

  /** The role a player has from sources that need no grant. */
  private BaseRole(player: Player): number {
    if (this.IsOnNoOpList(player)) return SiteRole.Normal;
    let role: number = SiteRole.Normal;
    if (player.isSpaceAdmin || this.ProtectedSelf(player)) role = SiteRole.Janitor;
    else if (this.VRPG.ConfigData.IsOnConfigList("StaffList", player.uid)) {
      role = this.VRPG.ConfigData.GetBool("enableOperators") ? SiteRole.Admin : SiteRole.Controller;
    }
    if (role < SiteRole.Controller && this.VRPG.ConfigData.GetBool("first-joiner-gm") && this.firstJoiner !== "" && this.firstJoiner === player.uid) {
      role = SiteRole.Controller;
    }
    return role;
  }

  /** Has the player registered as a Game Master in protected state, in the session it is in now? */
  private ProtectedSelf(player: Player): boolean {
    const stored = this.Protected.Get<unknown>(`gm-${uidKey(player.uid)}`, null);
    if (!stored || typeof stored !== "object") return false;
    const rec = stored as { r?: unknown; by?: unknown; sid?: unknown };
    return rec.r === SiteRole.Janitor && rec.by === player.uid && rec.sid === player.sid;
  }

  /** The role this client worked out for a player. */
  RoleOf(player: Player | null): number {
    if (!player || !player.IsValid()) return 0;
    if (!this.roles.has(player.sid)) return this.BaseRole(player);
    return this.roles.get(player.sid) ?? 0;
  }

  override OnProtectedChanged(_key: string): void {
    this.RecomputeRoles();
  }

  /** A new referee carries the first-joiner record on (from the copy it last read). */
  override OnMasterTransferred(_newMaster: Player | null): void {
    this.OnConfigDataDownloaded();
  }

  override OnPlayerLeft(_player: Player): void {
    this.OnConfigDataDownloaded();
  }

  /** GMD:140-143: the top role. */
  IsGameMaster(player: Player): boolean {
    return this.RoleOf(player) >= SiteRole.Janitor;
  }

  /** GMD:221-258: the local player gives `targetState` to player `id`. */
  TrySetGMState(id: number, targetState: number): void {
    const me = this.Networking.LocalPlayer;
    const targetPlayer = this.Networking.GetPlayerById(id);
    const myGmState = this.RoleOf(me);

    if (targetPlayer === null || !targetPlayer.IsValid()) {
      this.VRPG.Logger.NetworkDebugLog(`${me.displayName} attempted to set Gm state but user was invalid`);
      return;
    }
    // GMD:233, plus (the port's) no change at all without a role, and none to a player above your own role.
    if (
      !Number.isInteger(targetState) ||
      targetState < 0 ||
      myGmState < targetState ||
      targetState > 2 ||
      (myGmState === SiteRole.Controller && targetPlayer.isSpaceAdmin) ||
      myGmState < SiteRole.Controller ||
      myGmState < this.RoleOf(targetPlayer)
    ) {
      this.VRPG.Logger.NetworkDebugLog(`${me.displayName} attempted to set Gm state without privilege`);
      return;
    }

    const at = this.Networking.GetServerTimeInSeconds();
    if (this.Protected.CanWrite) {
      this.Protected.Set(`st-${uidKey(targetPlayer.uid)}`, { r: targetState, at, by: me.uid });
    } else {
      this.VRPG.GetLocalPlayerObject()?._Grant(targetPlayer.uid, targetState, at);
    }
  }

  /** GMD:289-298 */
  SetGMStateToSelected(targetState: number): void {
    const selected = this.VRPG.Social.SelectedPlayer;
    if (selected === null) return;
    if (!selected.Owner?.IsValid()) return;
    this.TrySetGMState(selected.Owner.playerId, targetState);
  }

  /** GMD:300-304 */
  GiveAutoMod(): void {
    this.SetGMStateToSelected(2);
  }
  GiveInstanceMod(): void {
    this.SetGMStateToSelected(1);
  }
  RemoveMod(): void {
    this.SetGMStateToSelected(0);
  }

  /** GMD:306-337: staff (Operator or above). */
  IsOnAutomodList(player: Player): boolean {
    if (this.IsOnNoOpList(player)) return false;
    return this.RoleOf(player) >= SiteRole.Admin;
  }

  /** GMD:339-353: any role. */
  ShouldBeController(player: Player): boolean {
    if (this.IsOnNoOpList(player)) return false;
    return this.RoleOf(player) >= SiteRole.Controller;
  }

  /** GMD:355-358 */
  IsOnNoOpList(player: Player): boolean {
    return this.VRPG.ConfigData.IsOnConfigList("ExileManifest", player.uid);
  }

  /** GMD:360-377 */
  GiveModeratorLabelColor(player: Player): string {
    const options = this.VRPG.Options;
    const role = this.RoleOf(player);
    if (this.IsOnNoOpList(player)) return "";
    if (role >= SiteRole.Janitor) return `${Utils.MakeColor(this.GameMasterTitle, options.GmColor)}`;
    if (role >= SiteRole.Admin) return `${Utils.MakeColor(this.GameStaffTitle, options.StaffColor)}`;
    if (role >= SiteRole.Controller) return `${Utils.MakeColor(this.GameTempTitle, options.TempStaffColor)}`;
    return "";
  }

  /** GMD:379-385 */
  private ActivateModItems(isStaff: boolean): void {
    for (const gmObject of this.GMObjects) gmObject.SetActive(isStaff);
  }

  /** GMD:387-393. The operators' "Exile Room" button only exists with the setting `exile-room`. */
  private ActivateOperatorItems(isStaff: boolean): void {
    const shown = isStaff && this.VRPG.ConfigData.GetBool("exile-room") && this.noBox !== null;
    for (const opObject of this.OperatorObjects) opObject.SetActive(shown);
  }

  // ---- mod tools (GMD:395-460) ------------------------------------------------------------------------------------

  /** GMD:432-436 */
  CallST(): void {
    this.SendCustomNetworkEvent(NetworkEventTarget.All, "SyncCallST");
    this.VRPG.Logger.LogGMRaw(`${this.Networking.LocalPlayer.displayName} called for an ST!`);
  }

  /** GMD:438-444. Anyone may call for a game master; staff hear it. */
  SyncCallST(): void {
    if (this.IsOnAutomodList(this.Networking.LocalPlayer)) {
      this.gmAlertsPlayed++;
      if (this.GMSound && this.GMClip) this.GMSound.PlayOneShot(this.GMClip);
    }
  }

  /** GMD:446-458 */
  SetStaffTitle(): void {
    const me = this.Networking.LocalPlayer;
    if (this.IsOnNoOpList(me)) return;
    const namePlate = this.GiveModeratorLabelColor(me);
    const titlePlate = me.displayName;
    this.VRPG.SetNameAndTitle(namePlate, titlePlate);
  }

  // ---- ST teleport (GMD:462-684) ----------------------------------------------------------------------------------

  /** The local player's position and the way it faces, as far as the page knows them. */
  private Here(): Point | null {
    const position = this.Input.Position;
    if (!position) return null;
    const poses = this.Input.Poses;
    const yaw = poses ? poses.head.rotation.eulerAngles.y : this.lastYaw;
    return { position, yaw };
  }

  /** GMD:464-483 */
  TeleToSelected(): void {
    const selected = this.VRPG.Social.SelectedPlayer;
    if (selected?.Owner?.IsValid()) this.TeleToId(selected.Owner.playerId);
    else this.ComponentLogWarning("Error Tele-342: Selected Player was null!");
  }

  /**
   * GMD:486-522. Upstream reads the target's position directly (GMD:505); the page cannot (G4), so the caller asks
   * the target and teleports when the answer comes (AnswerWhere).
   */
  TeleToId(targetId: number): void {
    const targetPlayer = this.Networking.GetPlayerById(targetId);
    if (!targetPlayer?.IsValid()) {
      this.ComponentLogWarning("Error Tele-352: Attempted to teleport to invalid VRCPlayerApi");
      return;
    }
    this.askedWhere.set(targetId, this.Time.time);
    this.SendCustomNetworkEvent(NetworkEventTarget.All, "AskWhere", this.Networking.LocalPlayer.playerId, targetId);
  }

  /** A staff member asks where player `targetId` is. Only that player answers, and only to staff. */
  AskWhere(callerId: unknown, targetId: unknown): void {
    const sender = this.Networking.CallingPlayer;
    if (typeof callerId !== "number" || typeof targetId !== "number") return;
    if (targetId !== this.Networking.LocalPlayer.playerId) return;
    if (!sender || sender.playerId !== callerId || sender.isLocal) return;
    if (this.RoleOf(sender) < SiteRole.Controller) {
      this.refused.push(`AskWhere from ${sender.displayName}`);
      return;
    }
    const here = this.Here();
    if (!here) return;
    this.SendCustomNetworkEvent(NetworkEventTarget.All, "AnswerWhere", callerId, targetId, [here.position.x, here.position.y, here.position.z], here.yaw);
  }

  /** The asked player's answer. Only the asker acts on it, and only if it came from the player asked. */
  AnswerWhere(callerId: unknown, targetId: unknown, position: unknown, yaw: unknown): void {
    const sender = this.Networking.CallingPlayer;
    if (typeof callerId !== "number" || typeof targetId !== "number") return;
    if (callerId !== this.Networking.LocalPlayer.playerId) return;
    if (!sender || sender.playerId !== targetId || !this.askedWhere.has(targetId)) return;
    const asked = this.askedWhere.get(targetId)!;
    this.askedWhere.delete(targetId);
    if (this.Time.time - asked > 10) return;
    const at = readPoint(position, yaw);
    if (at) this._TeleNextTo(at);
  }

  /** GMD:505-516: 1.5 m in front of the other player, facing them. */
  private _TeleNextTo(target: Point): void {
    const forward = Quaternion.Euler(0, target.yaw, 0).rotate(Vector3.forward);
    const desiredPosition = target.position.add(forward.scale(1.5));
    const directionToTarget = target.position.sub(desiredPosition);
    const yaw = (Math.atan2(directionToTarget.x, directionToTarget.z) * 180) / Math.PI;
    this.lastYaw = yaw;
    this.Input.TeleportTo(desiredPosition, yaw);
  }

  /** GMD:524-530: the target teleports itself in front of the caller, if the caller is staff. */
  DoForceBring(callerId: unknown, targetId: unknown, position: unknown, yaw: unknown): void {
    if (typeof callerId !== "number" || typeof targetId !== "number") return;
    if (this.Networking.LocalPlayer.playerId !== targetId || this.VRPG.ConfigData.GetBool("disableGMBring")) return;
    const sender = this.Networking.CallingPlayer;
    if (!sender || sender.playerId !== callerId || this.RoleOf(sender) < SiteRole.Controller) {
      this.refused.push(`DoForceBring from ${sender?.displayName ?? "?"}`);
      return;
    }
    const at = readPoint(position, yaw);
    if (at) this._TeleNextTo(at);
  }

  /** GMD:532-554 */
  BringToMe(): void {
    if (this.VRPG.ConfigData.GetBool("disableGMBring")) this.ComponentLogWarning("Unable to Bring player: BringToMe disabled by config.");
    const selected = this.VRPG.Social.SelectedPlayer;
    if (selected?.Owner?.IsValid()) {
      const here = this.Here();
      if (!here) {
        this.ComponentLogWarning("Unable to Bring player: this client does not know where it is yet.");
        return;
      }
      this.SendCustomNetworkEvent(
        NetworkEventTarget.All,
        "DoForceBring",
        this.Networking.LocalPlayer.playerId,
        selected.Owner.playerId,
        [here.position.x, here.position.y, here.position.z],
        here.yaw,
      );
    }
  }

  /** The Local / All button (a dropdown upstream, GMD:46). */
  CycleTeleTarget(): void {
    this.teleTarget = this.teleTarget === 0 ? 1 : 0;
    this.ShowTeleTarget();
  }

  private ShowTeleTarget(): void {
    if (this.teleTargetLabel) new VRPGTextElement(this.Host, this.teleTargetLabel.key).SetText(this.teleTarget === 0 ? "Local" : "All");
  }

  /** GMD:556-647: "Local" moves the caller; "All" moves everyone (the caller included, at once). */
  private _TrySpawn(index: number): void {
    if (this.teleTarget === 0) this._GoSpawn(index);
    else this.SendCustomNetworkEvent(NetworkEventTarget.All, `GoSpawn${index}`);
  }
  TrySpawn0(): void {
    this._TrySpawn(0);
  }
  TrySpawn1(): void {
    this._TrySpawn(1);
  }
  TrySpawn2(): void {
    this._TrySpawn(2);
  }
  TrySpawn3(): void {
    this._TrySpawn(3);
  }
  TrySpawn4(): void {
    this._TrySpawn(4);
  }
  TrySpawn5(): void {
    this._TrySpawn(5);
  }

  /** GMD:570-582 */
  TryRespawn(): void {
    if (this.teleTarget === 0) this._GoRespawn();
    else this.SendCustomNetworkEvent(NetworkEventTarget.All, "GoRespawn");
  }

  /** True when the event running now comes from a player whose role allows moving everyone. */
  private SenderIsStaff(event: string): boolean {
    const sender = this.Networking.CallingPlayer;
    if (sender && this.RoleOf(sender) >= SiteRole.Controller) return true;
    this.refused.push(`${event} from ${sender?.displayName ?? this.Networking.CallingSession?.uid ?? "?"}`);
    return false;
  }

  /** GMD:648-652. The page has no respawn call: the player goes to `respawn`, else to where the menu is parked. */
  GoRespawn(): void {
    if (!this.SenderIsStaff("GoRespawn")) return;
    this._GoRespawn();
  }

  private _GoRespawn(): void {
    const config = this.VRPG.ConfigData;
    const spot = config.GetVector3("respawn") ?? this.VRPG.Menu.ParkedPosition;
    this.lastYaw = config.GetNumber("respawn-yaw", 0);
    this.Input.TeleportTo(spot, this.lastYaw);
  }

  /** GMD:653-682 */
  GoSpawn0(): void {
    if (this.SenderIsStaff("GoSpawn0")) this._GoSpawn(0);
  }
  GoSpawn1(): void {
    if (this.SenderIsStaff("GoSpawn1")) this._GoSpawn(1);
  }
  GoSpawn2(): void {
    if (this.SenderIsStaff("GoSpawn2")) this._GoSpawn(2);
  }
  GoSpawn3(): void {
    if (this.SenderIsStaff("GoSpawn3")) this._GoSpawn(3);
  }
  GoSpawn4(): void {
    if (this.SenderIsStaff("GoSpawn4")) this._GoSpawn(4);
  }
  GoSpawn5(): void {
    if (this.SenderIsStaff("GoSpawn5")) this._GoSpawn(5);
  }

  private _GoSpawn(index: number): void {
    const point = this.TeleportPoints[index];
    if (!point) return;
    this.lastYaw = point.yaw;
    this.VRPG.Teleporter._TeleportPlayer(point.position, point.yaw);
  }

  /** GMD:691-694: the operators' "Exile Room" moves the operator, as upstream. */
  GoNoBox(): void {
    if (!this.IsOnAutomodList(this.Networking.LocalPlayer) || !this.noBox) return;
    this.lastYaw = this.noBox.yaw;
    this.VRPG.Teleporter._TeleportPlayer(this.noBox.position, this.noBox.yaw);
  }
}

function readPoint(position: unknown, yaw: unknown): Point | null {
  if (!Array.isArray(position) || position.length !== 3 || !position.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  if (typeof yaw !== "number" || !Number.isFinite(yaw)) return null;
  return { position: new Vector3(position[0] as number, position[1] as number, position[2] as number), yaw };
}
