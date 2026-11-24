// Translated from VRPG2/Scripts/Utilities/VRPGPlayerTeleport.cs (GIB Games, MIT).
//
// The fade teleporter: mark as teleporting, show the fade target at the destination, close the menu, darken,
// teleport after 1 s, clear 0.1 s later; a request while one runs is ignored (TELE:16-42). Differences: the
// rotation is a yaw in degrees (the page's TeleportTo takes one), the animator bool goes through the relay, and
// the animator is wired: in the shipped prefab `teleAnim` is unset, so upstream's first fade teleport stops at
// TELE:26 (PORT.md checklist 64, C9).

import { Vector3, type AnimatorRef, type GameObject } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";

export class VRPGPlayerTeleport extends VRPGComponent {
  // From bindings.json (TELE:10-11).
  teleAnim: AnimatorRef | null = null;
  FadeTarget: GameObject | null = null;

  private targetPos = Vector3.zero;
  private targetYaw = 0;
  /** TELE:14 */
  isTeleporting = false;

  /** TELE:16-28, for a button of the kit. */
  TeleportPlayer(playerPosition: unknown, yaw: unknown): void {
    if (this.FromRemote()) return;
    if (!(playerPosition instanceof Vector3) || typeof yaw !== "number") return;
    this._TeleportPlayer(playerPosition, yaw);
  }

  /** TELE:16-28 */
  _TeleportPlayer(playerPosition: Vector3, yaw: number): void {
    if (this.isTeleporting) return;
    this.isTeleporting = true;
    this.FadeTarget?.SetActive(true);
    if (this.FadeTarget) this.FadeTarget.transform.position = playerPosition;
    this.VRPG.Menu._Close();
    this.targetPos = playerPosition.clone();
    this.targetYaw = yaw;
    this.teleAnim?.SetBool("isDark", true);
    this.SendCustomEventDelayedSeconds("DoTeleport", 1);
  }

  /** TELE:30-35 */
  DoTeleport(): void {
    if (this.FromRemote()) return;
    if (!this.isTeleporting) return;
    this.Input.TeleportTo(this.targetPos, this.targetYaw);
    this.SendCustomEventDelayedSeconds("DoEndAnim", 0.1);
  }

  /** TELE:37-42 */
  DoEndAnim(): void {
    if (this.FromRemote()) return;
    this.FadeTarget?.SetActive(false);
    this.teleAnim?.SetBool("isDark", false);
    this.isTeleporting = false;
  }
}
