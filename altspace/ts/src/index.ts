// rp-toolkit: the roleplay and game-master toolkit VRpg 2 (https://github.com/GIBGames/VRpg, folder VRPG2/, MIT,
// Copyright (c) 2024 GIB Games) on the portkit runtime. The classes bindings.json names by `type`; the build bundles
// this with bindings.json into pk-rp-toolkit.js. What was changed, removed or left out, and why: ../PORT.md.

import type { GameDefinition } from "../portkit/src/index.ts";
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
};

export default game;
