// Translated from VRPG2/Scripts/Utilities/TrackBone.cs (GIB Games, MIT).
//
// Keeps the fade sphere at the local head (TrackBone.cs:29-38, every physics tick upstream). Here the object is
// attached to the local head once (`AttachToHead`, not synced: every client attaches its own copy to its own head),
// and the app keeps it there with no traffic over the bridge. The name labels' look-at constraints aim at it.

import { Quaternion, Vector3 } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";

export class TrackBone extends VRPGComponent {
  /** From bindings.json: TrackBone.cs:21-23 (Head is the only position the prefab uses). */
  offset = Vector3.zero;

  override Start(): void {
    this.gameObject.AttachToHead(this.offset, Quaternion.identity, false);
  }

  override OnDestroy(): void {
    this.gameObject.Detach();
  }
}
