// rp-toolkit: the roleplay and game-master toolkit VRpg 2 (https://github.com/GIBGames/VRpg, folder VRPG2/, MIT,
// Copyright (c) 2024 GIB Games) on the portkit runtime. The classes bindings.json names by `type`; the build bundles
// this with bindings.json into pk-rp-toolkit.js. What was changed, removed or left out, and why: ../PORT.md.

import type { GameDefinition, GameInstance } from "../portkit/src/index.ts";
import { DiceRollerD20 } from "./DiceRollerD20.ts";
import { DiceRollerDS } from "./DiceRollerDS.ts";
import { TrackBone } from "./TrackBone.ts";
import { VRPGConfigData } from "./VRPGConfigData.ts";
import { VRPGGameMasterData } from "./VRPGGameMasterData.ts";
import { VRPGLogs } from "./VRPGLogs.ts";
import { VRPGManager } from "./VRPGManager.ts";
import { VRPGMenu } from "./VRPGMenu.ts";
import { VRPGMenuCaller } from "./VRPGMenuCaller.ts";
import { VRPGMenuNavButton } from "./VRPGMenuNavButton.ts";
import { VRPGOptions } from "./VRPGOptions.ts";
import { VRPGPatronData } from "./VRPGPatronData.ts";
import { VRPGPlayerButton } from "./VRPGPlayerButton.ts";
import { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import { VRPGPlayerTeleport } from "./VRPGPlayerTeleport.ts";
import { VRPGSocial } from "./VRPGSocial.ts";

const game: GameDefinition = {
  slug: "rp-toolkit",
  behaviours: {
    VRPGManager,
    VRPGConfigData,
    VRPGGameMasterData,
    VRPGMenu,
    VRPGMenuCaller,
    VRPGMenuNavButton,
    VRPGLogs,
    DiceRollerDS,
    DiceRollerD20,
    VRPGSocial,
    VRPGPlayerButton,
    VRPGPlayerTeleport,
    TrackBone,
    VRPGOptions,
    VRPGPatronData,
    VRPGPlayerObject,
  },
  debug: (instance: GameInstance) => debugHooks(instance),
};

/** Readers for Play-mode tests (window.__pk1.debug["rp-toolkit:<inst>"]): what the page holds, for altspace/playtest. */
function debugHooks(instance: GameInstance): Record<string, unknown> {
  const mgr = () => instance.behaviour<VRPGManager>("mgr");
  const players = () => instance.networking.GetPlayers();
  const objectOf = (sid: string) => instance.playerBehaviour<VRPGPlayerObject>(sid, "player");
  return {
    pathOf: (key: string) => instance.bindings.objects[key]?.path ?? "",
    me: () => ({ sid: instance.networking.LocalPlayer.sid, uid: instance.networking.LocalPlayer.uid, name: instance.networking.LocalPlayer.displayName }),
    menuOpen: () => mgr().Menu.MenuIsOpen,
    /** Where the page thinks the board is, and the local head as the page knows it. */
    menuAt: () => {
      const p = mgr().Menu.transform.position;
      return [p.x, p.y, p.z];
    },
    head: () => {
      const poses = mgr().Input.Poses;
      const p = poses ? poses.head.position : mgr().Input.Position;
      return p ? [p.x, p.y, p.z, poses ? 1 : 0] : null;
    },
    shownPanel: () => mgr().Menu.shownPanel,
    diceShown: () => mgr().diceShown,
    fields: () => ({ name: mgr().Menu.nameField.text, title: mgr().Menu.titleField.text }),
    /** Each player's name, title, role and label slot, as this page has them, in player order. */
    roster: () =>
      players().map((p) => {
        const o = objectOf(p.sid);
        return {
          sid: p.sid,
          uid: p.uid,
          name: p.displayName,
          admin: p.isSpaceAdmin,
          role: mgr().GMData.RoleOf(p),
          charName: o?.GetCharacterName() ?? "",
          title: o?.GetTitle() ?? "",
          slot: o?.ShownSlot ?? -1,
          /** The slot this page attached to its own head (only for the local player), -1 for none. */
          attached: o?.AttachedSlot ?? -1,
        };
      }),
    /**
     * What every page should agree on, for comparing two pages: every player's role, names and label slot, and the IC
     * and OOC lines. (The runtime's digest() covers space-state behaviours only, and this toolkit keeps none there.)
     */
    view: () =>
      JSON.stringify({
        roster: players().map((p) => {
          const o = objectOf(p.sid);
          return [p.uid, mgr().GMData.RoleOf(p), o?.GetCharacterName() ?? "", o?.GetTitle() ?? "", o?.ShownSlot ?? -1];
        }),
        ic: (mgr().Logger.lines[0] ?? []).slice(),
        ooc: (mgr().Logger.lines[1] ?? []).slice(),
      }),
    /** The lines of a log as this page keeps them: 0 IC, 1 OOC, 2 GM. */
    lines: (k: number) => (mgr().Logger.lines[k] ?? []).slice(),
    shownLog: () => mgr().Logger.shownLog,
    refused: () => mgr().GMData.refused.slice(),
    selected: () => mgr().Social.SelectedPlayer?.Owner?.sid ?? null,
    teleporting: () => mgr().Teleporter.isTeleporting,
    /** A request the GM tools would send, made from this page whatever its role: for the test that a non-GM's is refused. */
    act: (what: string) => {
      const gm = mgr().GMData;
      if (what === "spawnAll") {
        gm.teleTarget = 1;
        gm.TrySpawn0();
      }
      return what;
    },
  };
}

export default game;
