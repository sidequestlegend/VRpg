// Translated from VRPG2/Scripts/Systems/Common/VRPGRollerBase.cs (GIB Games, MIT).
//
// The "Roll to GM only" toggle is a uGUI Toggle upstream (ROLL:13), which the page cannot read (PORT.md G8). Here
// it is a button: the page keeps the value and shows it by activating the toggle's check mark (`gmCheck`).
// The random source is `RollInt`, Random.Range(int, int) of the runtime unless a test puts a scripted one there.

import type { GameObject } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGLogType } from "./VRPGLogs.ts";

export class VRPGRollerBase extends VRPGComponent {
  /** The check mark of the "Roll to GM only" button, from bindings.json. */
  gmCheck: GameObject | null = null;
  /** The toggle's value (upstream Toggle.isOn). */
  gmToggleOn = false;
  /** Random.Range(min, max) for ints: min inclusive, max exclusive. */
  RollInt: (min: number, max: number) => number = (min, max) => this.Random.RangeInt(min, max);

  override Start(): void {
    this.gmCheck?.SetActive(this.gmToggleOn);
  }

  /** The "Roll to GM only" button. */
  ToggleGm(): void {
    this.gmToggleOn = !this.gmToggleOn;
    this.gmCheck?.SetActive(this.gmToggleOn);
  }

  /** ROLL:15-18 */
  SendResult(message: string): void {
    this.VRPG.Logger.SendLog(message, this.gmToggleOn ? VRPGLogType.GM : VRPGLogType.OOC);
  }
}
