// Translated from VRPG2/Scripts/Utilities/TrackBone.cs (GIB Games, MIT).
//
// Keeps the fade sphere at the local head (TrackBone.cs:29-38, every physics tick upstream). The page knows the
// head only from pose reports, which arrive while the player moves; the object follows those, and only when the
// head has moved more than 2 cm, so that a still player sends nothing over the bridge. An attachment to the local
// head would do this without the page (a runtime gap, listed in PORT.md).

import { Vector3 } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";

export class TrackBone extends VRPGComponent {
  /** From bindings.json: TrackBone.cs:21-23 (Head is the only position the prefab uses). */
  offset = Vector3.zero;
  private last: Vector3 | null = null;

  override Update(): void {
    const head = this.Input.Poses?.head.position ?? null;
    if (!head) return;
    const finalPosition = head.add(this.offset);
    if (this.last && Vector3.Distance(this.last, finalPosition) < 0.02) return;
    this.last = finalPosition;
    this.transform.position = finalPosition;
  }
}
