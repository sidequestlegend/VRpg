// Translated from VRPG2/Scripts/Utilities/VRPGConfigData.cs (GIB Games, MIT).
//
// Upstream: the instance master downloads a JSON document from the author's site (or uses an embedded copy with
// four VRChat display names in it), keeps it in a synced string and tells subscribers (CFG:58-178). Removed by
// decision (PORT.md 10.2 L4): the download, the author's URL and the embedded names. The values are the snippet
// element's settings instead, identical on every client, so nothing is synced or downloaded.
//
// Config key (upstream)   setting (here)        default
//   StaffList             staff-uids            ""        user ids, separated by spaces or commas
//   ExileManifest         no-staff-uids         ""        user ids
//   enableOperators       enable-operators      "true"
//   disableGMBring        disable-gm-bring      "false"
//   verboseDebug          verbose               "false"
// The cheater keys, enableKeyGeneration, WorldVersion and the notices go with the removed features (PORT.md L1-L3).
//
// Subscribers are told when the local player starts and again whenever anyone joins (CFG:58-71, :110-126), in
// the same order as upstream: the game-master handler first (MP:51028).

import { Vector3 } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";

const CONFIG_TO_SETTING: Record<string, [string, string]> = {
  StaffList: ["staff-uids", ""],
  ExileManifest: ["no-staff-uids", ""],
  enableOperators: ["enable-operators", "true"],
  disableGMBring: ["disable-gm-bring", "false"],
  verboseDebug: ["verbose", "false"],
};

export interface ConfigSubscriber {
  OnConfigDataDownloaded(): void;
}

export class VRPGConfigData extends VRPGComponent {
  /** CFG:29-44 */
  private overrideVerbose = false;
  private verbose = false;
  get Verbose(): boolean {
    return this.overrideVerbose ? true : this.verbose;
  }
  set Verbose(value: boolean) {
    this.verbose = value;
  }

  override Start(): void {
    this.UpdateSpecialConfigValues();
  }

  override OnPlayerJoined(): void {
    // CFG:117-126: every join re-runs every subscriber (role self-assignment hangs on it, GMD:67).
    this.OnUpdateConfig();
  }

  /** CFG:118-126, without the download. */
  OnUpdateConfig(): void {
    if (this.FromRemote()) return;
    this.UpdateSpecialConfigValues();
    this.InformSubscribers();
  }

  /** CFG:128-135 (the cheater keys are gone). */
  private UpdateSpecialConfigValues(): void {
    this.Verbose = this.GetBool("verboseDebug");
  }

  /** CFG:84-98: a config key, or a setting by its own name. */
  GetValue(key: string): string {
    const mapped = CONFIG_TO_SETTING[key];
    const name = mapped ? mapped[0] : key;
    const fallback = mapped ? mapped[1] : "";
    const value = this.Settings.get(name);
    return value === undefined || value === null ? fallback : value;
  }

  /** CFG:100-103 */
  CompareValue(key: string, target: string): boolean {
    return this.GetValue(key) === target;
  }

  /** CFG:105-108 */
  GetBool(key: string): boolean {
    return this.GetValue(key).trim().toLowerCase() === "true";
  }

  /** A number setting, or `fallback`. */
  GetNumber(key: string, fallback: number): number {
    const text = this.GetValue(key).trim();
    if (text === "") return fallback;
    const n = Number(text);
    return Number.isFinite(n) ? n : fallback;
  }

  /** An "x y z" setting, or null when it is empty or does not parse. */
  GetVector3(key: string): Vector3 | null {
    const text = this.GetValue(key).trim();
    if (!text) return null;
    const parts = text.split(/[\s,]+/).map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return new Vector3(parts[0], parts[1], parts[2]);
  }

  /** The entries of a list setting. */
  GetList(listName: string): string[] {
    return this.GetValue(listName)
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * CFG:180-194. Upstream lower-cases the display name and compares it exactly with the list's entries; here the
   * entries are user ids, compared exactly.
   */
  IsOnConfigList(listName: string, userId: string): boolean {
    const found = this.GetList(listName).indexOf(userId) >= 0;
    if (this.Verbose) this.Debug.Log(`user ${userId} ${found ? "exists" : "does not exist"} on list ${listName}.`);
    return found;
  }

  /** CFG:238-244 */
  private InformSubscribers(): void {
    const subscribers: ConfigSubscriber[] = [this.VRPG.GMData];
    for (const usb of subscribers) usb.OnConfigDataDownloaded();
  }
}
