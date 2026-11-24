// Translated from VRPG2/Scripts/Core/VRPGOptions.cs (GIB Games, MIT).
//
// Colours are settings (`vip-color`, `ooc-color`, `ic-color`, `gm-color`, `staff-color`, `lead-color`; "r g b" from
// 0 to 1), with the prefab's values as defaults (MP:29041-29100). The option toggles and the slider become buttons
// the page keeps (G8): the IM alert on or off, its volume in steps of 0.1, and the floor grid. They are saved on
// this device (OPT:46-80 kept them in per-account PlayerData; PORT.md G3) under the upstream key names
// `vrpg-options-<name>`. A toggle with no saved value is on (OPT:57); the grid starts off (GridPlane is inactive in
// the prefab). Left out: the PostProc, Reflections, Chairs and Snow toggles (no target object upstream), the grid
// slider (its method body is commented out), GiveFirstJoinerGM (read nowhere: the port's `first-joiner-gm` setting
// does that job), the voice-zone distances (no voice API), and SetUp (an editor button).
//
// The alert volume is page state only: the relay has no op for AudioSource.volume yet (a runtime gap).

import { Color, type GameObject, type Player } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";
import { parseColor } from "./VRPGUtils.ts";

export class VRPGOptions extends VRPGComponent {
  // OPT:27-34
  VipLabelColor = new Color(0.59, 0.59, 0.15, 1);
  OocColor = new Color(0, 1, 1, 1);
  IcColor = new Color(1, 1, 1, 1);
  GmColor = new Color(0.59, 0.15, 0.59, 1);
  StaffColor = new Color(0.72, 0.42, 0, 1);
  TempStaffColor = new Color(0.18, 0.58, 0.59, 1);

  // From bindings.json.
  imAlertObject: GameObject | null = null;
  imAlertCheck: GameObject | null = null;
  gridObject: GameObject | null = null;
  gridCheck: GameObject | null = null;
  gridToggle: GameObject | null = null;
  volumeLabelObject: GameObject | null = null;

  ImAlertOn = true;
  GridOn = false;
  Volume = 0.2;

  override Start(): void {
    const c = (name: string, fallback: Color) => parseColor(this.Settings.get(name), fallback);
    this.VipLabelColor = c("vip-color", this.VipLabelColor);
    this.OocColor = c("ooc-color", this.OocColor);
    this.IcColor = c("ic-color", this.IcColor);
    this.GmColor = c("gm-color", this.GmColor);
    this.StaffColor = c("staff-color", this.StaffColor);
    this.TempStaffColor = c("lead-color", this.TempStaffColor);
    this.Volume = this.VRPG.ConfigData.GetNumber("alert-volume", this.Volume);
    const gridAllowed = this.Settings.get("grid") !== "false";
    this.gridToggle?.SetActive(gridAllowed);
    this.Show();
  }

  /** OPT:46-50 */
  override OnPlayerRestored(player: Player): void {
    if (player.isLocal) this.RestoreOptions();
  }

  /** OPT:52-67 */
  private RestoreOptions(): void {
    this.ImAlertOn = this.Storage.get<boolean>("vrpg-options-toggleImAlert", true) !== false;
    this.GridOn = this.Storage.get<boolean>("vrpg-options-toggleGrid", false) === true && this.Settings.get("grid") !== "false";
    const volume = this.Storage.get<number>("vrpg-options-ImSlider", this.Volume);
    if (typeof volume === "number" && Number.isFinite(volume)) this.Volume = Math.min(1, Math.max(0, volume));
    this.Show();
  }

  /** OPT:69-80 */
  SaveOptions(): void {
    if (this.FromRemote()) return;
    this.Storage.set("vrpg-options-toggleImAlert", this.ImAlertOn);
    this.Storage.set("vrpg-options-toggleGrid", this.GridOn);
    this.Storage.set("vrpg-options-ImSlider", this.Volume);
  }

  /** The "IM Alert" toggle (wired upstream to IM Alert.SetActive and SaveOptions). */
  ToggleImAlert(): void {
    if (this.FromRemote()) return;
    this.ImAlertOn = !this.ImAlertOn;
    this.Show();
    this.SaveOptions();
  }

  /** The "Show Grid" toggle (wired upstream to GridPlane.SetActive). */
  ToggleGrid(): void {
    if (this.FromRemote()) return;
    if (this.Settings.get("grid") === "false") return;
    this.GridOn = !this.GridOn;
    this.Show();
    this.SaveOptions();
  }

  /** The slider (0 to 1) as two buttons. */
  VolumeUp(): void {
    if (this.FromRemote()) return;
    this.Volume = Math.min(1, Math.round((this.Volume + 0.1) * 10) / 10);
    this.Show();
    this.SaveOptions();
  }
  VolumeDown(): void {
    if (this.FromRemote()) return;
    this.Volume = Math.max(0, Math.round((this.Volume - 0.1) * 10) / 10);
    this.Show();
    this.SaveOptions();
  }

  private Show(): void {
    this.imAlertObject?.SetActive(this.ImAlertOn);
    this.imAlertCheck?.SetActive(this.ImAlertOn);
    this.gridObject?.SetActive(this.GridOn);
    this.gridCheck?.SetActive(this.GridOn);
    if (this.volumeLabelObject) new VRPGTextElement(this.Host, this.volumeLabelObject.key).SetText(this.Volume.toFixed(1));
  }
}
