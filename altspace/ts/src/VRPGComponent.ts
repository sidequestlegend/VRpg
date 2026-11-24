// Translated from VRPG2/Scripts/Core/VRPGComponent.cs (GIB Games, MIT).
//
// Upstream finds the manager with GameObject.Find("VRPG Manager") (VRPGComponent.cs:55); here it is the one
// VRPGManager behaviour of this instance. Logging is gated on the verbose flag as upstream (:34, :41, :48).
//
// Which methods another client may run here: only those a class lists in `static networkCallable` (the runtime
// refuses every other name). Upstream checks no sender (PORT.md 3.2); the listed handlers that act check WHO sent
// them (Networking.CallingPlayer), so a forged event can press no button on anyone's menu (PORT.md C3).

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
}
