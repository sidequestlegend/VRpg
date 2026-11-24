// Writes a PROVISIONAL bindings.json for rp-toolkit from PORT.md's object model (section 5), so that the rules can be
// tested before the Unity kit exists. The kit builder (Assets/Kit/Editor/RpToolkitKitBuilder.cs, not written yet)
// replaces this file with the real one; object keys should be kept (bindings.lock.json) so the tests still hold.
//
//   node tools/provisional-bindings.ts            (npm run bindings)
//
// Paths follow the upstream prefab "VRPG Manager.prefab" (MP) where an object exists there, with the port's
// changes: four panels instead of seven, buttons with a check mark instead of toggles, a Local / All button instead
// of the dropdown, +/- buttons instead of the volume slider, page buttons on the player list and the logs, 32 rows
// instead of 84, a pool of 32 name labels, an open button on the parked board, the d20 roller placed in the Main
// panel beside the DS roller. Input fields report edits through bindings events of kind "field" (the relay graph polls
// each TMP_InputField and sends its refs index and text once editing ends).

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

interface Obj {
  path: string;
  sync: "none";
  grab: boolean;
  click: boolean;
  seat: boolean;
}

const objects: Record<string, Obj> = {};
const noRef = new Set<string>();
function obj(key: string, path: string, options: { click?: boolean; ref?: boolean } = {}): string {
  if (objects[key]) throw new Error(`object key ${key} twice`);
  objects[key] = { path, sync: "none", grab: false, click: options.click === true, seat: false };
  if (options.ref === false) noRef.add(key);
  return key;
}

const M = "VRPG Local Menu/Menu Canvas";
const P = `${M}/Panels`;
obj("menu", "VRPG Local Menu", { ref: false });
obj("openButton", "VRPG Local Menu/Open Button", { click: true, ref: false });
obj("caption", `${M}/Game Logo/Caption`);
obj("closeButton", `${M}/Base GUI/CloseButton/Button`);
for (const [key, name] of [["navMain", "MainMenu"], ["navSocial", "Social"], ["navOptions", "Options"], ["navGM", "GM"]]) obj(key!, `${M}/Navigation/${name}`);
obj("panelMain", `${P}/Panel 0 - Main`);
obj("panelSocial", `${P}/Panel 4 - Social`);
obj("panelOptions", `${P}/Panel 5 - Options`);
obj("panelGM", `${P}/Panel 6 - GM`);
obj("plateCharName", `${P}/Top/CharPlate/CharName`);
obj("plateCharTitle", `${P}/Top/CharPlate/CharTitle`);
obj("platePlayerName", `${P}/Top/PlayerPlate/PlayerName`);
obj("platePlayerTitle", `${P}/Top/PlayerPlate/PlayerTitle`);
obj("callST", `${P}/BottomPanel/Call ST`);

const T = `${P}/Panel 0 - Main/Title`;
obj("nameField", `${T}/NameField`);
obj("titleField", `${T}/TitleField`);
obj("setButton", `${T}/Set`);
obj("oocButton", `${T}/OOC`);
obj("offButton", `${T}/Off`);

const L = `${P}/Panel 0 - Main/Log`;
obj("tabOOC", `${L}/Tabs/OOC`);
obj("tabIC", `${L}/Tabs/IC`);
obj("tabGM", `${L}/Tabs/GM`);
for (const [k, name] of [["ic", "IC"], ["ooc", "OOC"], ["gm", "GM"]]) {
  obj(`${k}Log`, `${L}/Logs/${name} Log`);
  obj(`${k}View`, `${L}/Logs/${name} Log/View`);
  obj(`${k}Output`, `${L}/Logs/${name} Log/View/Output`);
  obj(`${k}Input`, `${L}/Logs/${name} Log/Input`);
  obj(`${k}Send`, `${L}/Logs/${name} Log/Send`);
}
obj("logUp", `${L}/Scroll Up`);
obj("logDown", `${L}/Scroll Down`);

const D = `${P}/Panel 0 - Main/Actions/Dice DS`;
obj("dsRoot", D);
obj("dsAtt", `${D}/AttMod`);
obj("dsDef", `${D}/DefMod`);
obj("dsRoll", `${D}/ROLL`);
obj("dsReset", `${D}/Reset`);
obj("dsGm", `${D}/GM Roll`);
obj("dsGmCheck", `${D}/GM Roll/Checkmark`);
obj("dsAttThreat", `${D}/AttThreat`);
obj("dsAttThreatLabel", `${D}/AttThreat/Label`);
obj("dsDefThreat", `${D}/DefThreat`);
obj("dsDefThreatLabel", `${D}/DefThreat/Label`);

const E = `${P}/Panel 0 - Main/Actions/Dice d20`;
obj("d20Root", E);
for (const n of [4, 6, 8, 10, 12, 20]) obj(`d20Add${n}`, `${E}/d${n}`);
obj("d20Roll", `${E}/Roll`);
obj("d20Clear", `${E}/Clear`);
obj("d20Inc", `${E}/IncMod`);
obj("d20Dec", `${E}/DecMod`);
obj("d20ModLabel", `${E}/ModLabel`);
obj("d20Pool", `${E}/Pool`);
obj("d20Gm", `${E}/Toggle`);
obj("d20GmCheck", `${E}/Toggle/Checkmark`);
obj("d20One", `${E}/1d20`);
obj("d20Adv", `${E}/1d20 Advantage`);
obj("d20Dis", `${E}/1d20 Disadvantage`);
obj("diceSwitch", `${P}/Panel 0 - Main/Actions/Dice Switch`);

const S = `${P}/Panel 4 - Social`;
obj("playerCount", `${S}/PlayerCount`);
obj("selectedName", `${S}/SelectedPlayerName`);
obj("resultName", `${S}/Result/CharName`);
obj("resultTitle", `${S}/Result/CharTitle`);
obj("resultDesc", `${S}/Result/CharParagraph`);
obj("refresh", `${S}/UpdatePlayerList`);
obj("pagePrev", `${S}/PagePrev`);
obj("pageNext", `${S}/PageNext`);
obj("pageText", `${S}/PageText`);
export const ROWS = 32;
for (let i = 0; i < ROWS; i++) {
  obj(`row${i}`, `${S}/Player Buttons/Button (${i})`);
  obj(`row${i}Label`, `${S}/Player Buttons/Button (${i})/Label`);
}
const G = `${S}/GM Only`;
obj("socialGmOnly", G);
obj("gmTele", `${G}/GMTele`);
obj("bringToMe", `${G}/BringToMe`);
obj("makeController", `${G}/MakeController`);
obj("removeGM", `${G}/RemoveGM`);
obj("giveOperator", `${G}/Janitor - GiveOp`);

const O = `${P}/Panel 5 - Options`;
obj("imAlertToggle", `${O}/toggleImAlert`);
obj("imAlertCheck", `${O}/toggleImAlert/Checkmark`);
obj("volDown", `${O}/ImVolume/Down`);
obj("volUp", `${O}/ImVolume/Up`);
obj("volLabel", `${O}/ImVolume/Value`);
obj("gridToggle", `${O}/toggleGrid`);
obj("gridCheck", `${O}/toggleGrid/Checkmark`);
obj("credits", `${O}/Credits`);

const G6 = `${P}/Panel 6 - GM`;
obj("stTitle", `${G6}/ST Title Box`);
for (let i = 0; i < 6; i++) obj(`tp${i}`, `${G6}/Teleport/TP${i}`);
obj("respawn", `${G6}/Teleport/Respawn`);
obj("teleTarget", `${G6}/Teleport/Dropdown`);
obj("teleTargetLabel", `${G6}/Teleport/Dropdown/Label`);
obj("operUI", `${P}/OperUI`);
obj("noBoxSpawn", `${P}/OperUI/NoBoxSpawn`);

obj("gmAlert", "VRPG GM Handler/GMAlert");
obj("imAlert", "VRPG GM Handler/IM Alert");
obj("fadeSphere", "FadeSphere");
obj("fadeTarget", "VRPG Behaviors/VRPG Teleporter/FadeTarget");
obj("grid", "VRPG Behaviors/VRPG Grid/GridPlane");

export const LABELS = 32;
const ICONS = ["NormalImage", "ControllerImage", "AdminImage", "JanitorImage"];
for (let i = 0; i < LABELS; i++) {
  const root = `Labels/Label ${i}`;
  obj(`label${i}`, root);
  obj(`label${i}Name`, `${root}/Canvas/Labels/Text/Nameplate`);
  obj(`label${i}Title`, `${root}/Canvas/Labels/Text/Title Plate`);
  ICONS.forEach((name, n) => obj(`label${i}Icon${n}`, `${root}/Canvas/Labels/Images/${name}`));
}

const $obj = (key: string) => ({ $obj: key });
const $beh = (id: string) => ({ $beh: id });
const behaviours: Array<Record<string, unknown>> = [
  {
    id: "mgr",
    type: "VRPGManager",
    object: null,
    fields: {
      GMData: $beh("gm"),
      Menu: $beh("menu"),
      Logger: $beh("logs"),
      PatronData: $beh("patrons"),
      Social: $beh("social"),
      ConfigData: $beh("config"),
      Teleporter: $beh("tele"),
      Options: $beh("options"),
      DiceDS: $beh("ds"),
      DiceD20: $beh("d20"),
      diceSwitch: $obj("diceSwitch"),
      Labels: Array.from({ length: LABELS }, (_, i) => $obj(`label${i}`)),
    },
  },
  { id: "config", type: "VRPGConfigData", object: null },
  {
    id: "gm",
    type: "VRPGGameMasterData",
    object: null,
    fields: {
      GMObjects: [$obj("navGM"), $obj("gmLog"), $obj("tabGM"), $obj("socialGmOnly")],
      OperatorObjects: [$obj("operUI")],
      teleTargetLabel: $obj("teleTargetLabel"),
      teleButtons: [0, 1, 2, 3, 4, 5].map((i) => $obj(`tp${i}`)),
      GMSound: { $comp: "gmAlert", kind: "AudioSource" },
      GMClip: { $clip: 0, on: "gmAlert" },
    },
  },
  {
    id: "menu",
    type: "VRPGMenu",
    object: "menu",
    fields: {
      nameFieldObject: $obj("nameField"),
      titleFieldObject: $obj("titleField"),
      panels: [$obj("panelMain"), $obj("panelSocial"), $obj("panelOptions"), $obj("panelGM")],
      characterNamePlateObject: $obj("plateCharName"),
      characterTitlePlateObject: $obj("plateCharTitle"),
      playerNamePlateObject: $obj("platePlayerName"),
      playerTitlePlateObject: $obj("platePlayerTitle"),
      captionObject: $obj("caption"),
    },
  },
  { id: "caller", type: "VRPGMenuCaller", object: "openButton" },
  ...["navMain", "navSocial", "navOptions", "navGM"].map((key, i) => ({ id: `nav${i}`, type: "VRPGMenuNavButton", object: key, fields: { panelIndex: i } })),
  {
    id: "logs",
    type: "VRPGLogs",
    object: null,
    fields: {
      ICLogGroup: $obj("icView"),
      ICOutputBox: $obj("icOutput"),
      ICInputBox: $obj("icInput"),
      OOCLogGroup: $obj("oocView"),
      OOCOutputBox: $obj("oocOutput"),
      OOCInputBox: $obj("oocInput"),
      GMLogGroup: $obj("gmView"),
      GMOutputBox: $obj("gmOutput"),
      GMInputBox: $obj("gmInput"),
      ImSound: { $comp: "imAlert", kind: "AudioSource" },
      ImClip: { $clip: 0, on: "imAlert" },
    },
  },
  {
    id: "ds",
    type: "DiceRollerDS",
    object: "dsRoot",
    fields: {
      gmCheck: $obj("dsGmCheck"),
      attBoxObject: $obj("dsAtt"),
      defBoxObject: $obj("dsDef"),
      attDropObject: $obj("dsAttThreat"),
      defDropObject: $obj("dsDefThreat"),
      attDropLabel: $obj("dsAttThreatLabel"),
      defDropLabel: $obj("dsDefThreatLabel"),
    },
  },
  { id: "d20", type: "DiceRollerD20", object: "d20Root", fields: { gmCheck: $obj("d20GmCheck"), dicePoolBoxTextObject: $obj("d20Pool"), modLabelObject: $obj("d20ModLabel") } },
  {
    id: "social",
    type: "VRPGSocial",
    object: null,
    fields: {
      playerLabelObject: $obj("selectedName"),
      nameLabelObject: $obj("resultName"),
      titleLabelObject: $obj("resultTitle"),
      descLabelObject: $obj("resultDesc"),
      playerCountTextObject: $obj("playerCount"),
      pageTextObject: $obj("pageText"),
    },
  },
  ...Array.from({ length: ROWS }, (_, i) => ({ id: `row${i}`, type: "VRPGPlayerButton", object: `row${i}`, fields: { buttonLabelObject: $obj(`row${i}Label`) } })),
  { id: "tele", type: "VRPGPlayerTeleport", object: null, fields: { teleAnim: { $comp: "fadeSphere", kind: "Animator" }, FadeTarget: $obj("fadeTarget") } },
  { id: "track", type: "TrackBone", object: "fadeSphere", fields: { offset: { $v3: [0, 0, 0] } } },
  {
    id: "options",
    type: "VRPGOptions",
    object: null,
    fields: {
      imAlertObject: $obj("imAlert"),
      imAlertSource: { $comp: "imAlert", kind: "AudioSource" },
      imAlertCheck: $obj("imAlertCheck"),
      gridObject: $obj("grid"),
      gridCheck: $obj("gridCheck"),
      gridToggle: $obj("gridToggle"),
      volumeLabelObject: $obj("volLabel"),
    },
  },
  { id: "patrons", type: "VRPGPatronData", object: null, fields: { PatronCreditsObject: $obj("credits"), PatronItems: [] } },
  { id: "player", type: "VRPGPlayerObject", object: null, perPlayer: true },
];

const events: Array<Record<string, unknown>> = [];
const ui = (object: string, behaviour: string, method: string) => events.push({ object, kind: "uiButton", behaviour, method });
ui("closeButton", "menu", "CloseMenu");
ui("navMain", "nav0", "ShowPanel");
ui("navSocial", "social", "UpdatePlayerList");
ui("navSocial", "nav1", "ShowPanel");
ui("navOptions", "nav2", "ShowPanel");
ui("navGM", "nav3", "ShowPanel");
ui("callST", "gm", "CallST");
ui("setButton", "menu", "SetNameAndTitle");
ui("oocButton", "menu", "SetOOC");
ui("offButton", "menu", "SetHidden");
ui("tabOOC", "logs", "ShowOOCLog");
ui("tabIC", "logs", "ShowICLog");
ui("tabGM", "logs", "ShowGMLog");
ui("icSend", "logs", "SendLogIC");
ui("oocSend", "logs", "SendLogOOC");
ui("gmSend", "logs", "SendLogGM");
ui("logUp", "logs", "ScrollUp");
ui("logDown", "logs", "ScrollDown");
ui("dsRoll", "ds", "NewRoll");
ui("dsReset", "ds", "ClearBox");
ui("dsGm", "ds", "ToggleGm");
ui("dsAttThreat", "ds", "CycleAttThreat");
ui("dsDefThreat", "ds", "CycleDefThreat");
for (const n of [4, 6, 8, 10, 12, 20]) ui(`d20Add${n}`, "d20", `BoxAddD${n}`);
ui("d20Roll", "d20", "RollBox");
ui("d20Clear", "d20", "ResetBox");
ui("d20Inc", "d20", "IncreaseMod");
ui("d20Dec", "d20", "DecreaseMod");
ui("d20Gm", "d20", "ToggleGm");
ui("d20One", "d20", "Roll20");
ui("d20Adv", "d20", "Roll20Advantage");
ui("d20Dis", "d20", "Roll20Disadvantage");
ui("diceSwitch", "mgr", "SwitchDice");
ui("refresh", "social", "UpdatePlayerList");
ui("pagePrev", "social", "PreviousPage");
ui("pageNext", "social", "NextPage");
for (let i = 0; i < ROWS; i++) ui(`row${i}`, `row${i}`, "SelectPlayer");
ui("gmTele", "gm", "TeleToSelected");
ui("bringToMe", "gm", "BringToMe");
ui("makeController", "gm", "GiveInstanceMod");
ui("removeGM", "gm", "RemoveMod");
ui("giveOperator", "gm", "GiveAutoMod");
ui("imAlertToggle", "options", "ToggleImAlert");
ui("volDown", "options", "VolumeDown");
ui("volUp", "options", "VolumeUp");
ui("gridToggle", "options", "ToggleGrid");
ui("stTitle", "gm", "SetStaffTitle");
for (let i = 0; i < 6; i++) ui(`tp${i}`, "gm", `TrySpawn${i}`);
ui("respawn", "gm", "TryRespawn");
ui("teleTarget", "gm", "CycleTeleTarget");
ui("noBoxSpawn", "gm", "GoNoBox");
const field = (object: string, behaviour: string, method: string) => events.push({ object, kind: "field", behaviour, method });
field("nameField", "menu", "NameTyped");
field("titleField", "menu", "TitleTyped");
field("icInput", "logs", "ICTyped");
field("oocInput", "logs", "OOCTyped");
field("gmInput", "logs", "GMTyped");
field("dsAtt", "ds", "AttTyped");
field("dsDef", "ds", "DefTyped");

const doc: Record<string, unknown> = {
  schema: 1,
  slug: "rp-toolkit",
  note: "PROVISIONAL: written by tools/provisional-bindings.ts from PORT.md's object model, not by the kit builder. Input fields report edits as bindings events of kind 'field'.",
  bundles: { windows: "", android: "" },
  objects,
  refs: Object.keys(objects).filter((k) => !noRef.has(k)),
  behaviours,
  events,
};

const canon = (v: unknown): string =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? "[" + v.map(canon).join(",") + "]"
      : "{" + Object.keys(v as Record<string, unknown>).sort().map((k) => JSON.stringify(k) + ":" + canon((v as Record<string, unknown>)[k])).join(",") + "}";
const hash = createHash("sha1").update(Buffer.from(canon(doc), "utf8")).digest("hex");
const out: Record<string, unknown> = { schema: 1, slug: doc.slug, hash, ...doc };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = fileURLToPath(new URL("../bindings.json", import.meta.url));
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${file}: ${Object.keys(objects).length} objects, ${(out.refs as string[]).length} refs, ${behaviours.length} behaviours, ${events.length} events, hash ${hash}`);
}
