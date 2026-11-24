// Translated from VRPG2/Scripts/Addons/IconController.cs (GIB Games, MIT).
//
// The role icon beside a name label: one of four images, chosen by index (ICON:48-60). Upstream syncs the index
// from the label owner's client (ICON:16, :37), but every client works it out from the role anyway (PO:401-405),
// so here it is not synced: each client derives it from the role it computes. The "keys" upstream passes to
// deter modified clients (ICON:27-34) never reject anything (the checks sit inside `if (target == 0)`) and are
// dropped (PORT.md 3.2).

import type { HostActions } from "../portkit/src/index.ts";

/** ICON:63-69. Janitor is upstream's name for the top role; the port calls it Game Master (PORT.md C2). */
export const SiteRole = { Normal: 0, Controller: 1, Admin: 2, Janitor: 3 } as const;
export type SiteRoleValue = (typeof SiteRole)[keyof typeof SiteRole];

export class IconController {
  /** Object keys of the four images, in role order. */
  readonly Icons: readonly string[];
  private readonly host: HostActions;
  iconIndex = 0;
  /** -1 so that the first SyncIcons always writes. */
  private oldIndex = -1;

  constructor(host: HostActions, icons: readonly string[]) {
    this.host = host;
    this.Icons = icons;
  }

  /** ICON:20-23 */
  ClearStates(): void {
    this.SetIcon(0);
  }

  /** ICON:25-39, without the key argument. */
  SetIcon(target: number): void {
    this.iconIndex = target;
    this.SyncIcons();
  }

  /** ICON:48-60 */
  SyncIcons(): void {
    if (this.iconIndex !== this.oldIndex) {
      this.oldIndex = this.iconIndex;
      for (let i = 0; i < this.Icons.length; i++) this.host.setActive(this.Icons[i]!, i === this.iconIndex);
    }
  }

  /** Hides every icon (the label slot was given up). */
  Hide(): void {
    this.oldIndex = -1;
    for (const key of this.Icons) this.host.setActive(key, false);
  }
}
