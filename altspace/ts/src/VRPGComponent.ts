// Translated from VRPG2/Scripts/Core/VRPGComponent.cs (GIB Games, MIT).
//
// Upstream finds the manager with GameObject.Find("VRPG Manager") (VRPGComponent.cs:55); here it is the one
// VRPGManager behaviour of this instance. Logging is gated on the verbose flag as upstream (:34, :41, :48).
//
// Added for the port: FromRemote(). A network event may call any public method of a behaviour on every client
// (the runtime allows every method whose name does not start with "_"). Upstream checks no sender (PORT.md 3.2),
// so a forged event could press any button on everyone's menu. Every method that a button calls, and that is
// not meant to arrive over the network, starts with `if (this.FromRemote()) return;` (PORT.md C3).

import { Behaviour } from "../portkit/src/index.ts";
import type { VRPGManager } from "./VRPGManager.ts";

export class VRPGComponent extends Behaviour {
  private vrpgManager: VRPGManager | null = null;

  get VRPG(): VRPGManager {
    if (this.vrpgManager === null) this.CacheManager();
    return this.vrpgManager!;
  }

  /** The bindings id stands in for the GameObject name upstream prints. */
  get name(): string {
    return this.gameObject.name || this.behaviourId;
  }

  ComponentLog(msg: string): void {
    if (!this.VRPG.ConfigData.Verbose) return;
    this.Debug.Log(`<color=white>[${this.name}]</color> ${msg}`);
  }

  ComponentLogWarning(msg: string): void {
    if (!this.VRPG.ConfigData.Verbose) return;
    this.Debug.LogWarning(`<color=cyan>[${this.name}]</color> ${msg}`);
  }

  ComponentLogError(msg: string): void {
    if (!this.VRPG.ConfigData.Verbose) return;
    this.Debug.LogError(`<color=orange>[${this.name}]</color> ${msg}`);
  }

  CacheManager(): void {
    this.vrpgManager = this.FindBehavioursOfType<VRPGManager>("VRPGManager")[0] ?? null;
  }

  /**
   * True while a network event sent by another client runs this method. A button method that must only act for
   * the local player returns at once when it is.
   */
  FromRemote(): boolean {
    const session = this.Networking.CallingSession;
    if (session === null) return false;
    return session.sid !== this.Networking.LocalPlayer.sid;
  }
}
