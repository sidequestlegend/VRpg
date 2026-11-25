# PORT.md: rp-toolkit (GIBGames/VRpg, `VRPG2/`) to an Altspace snippet

Sections 1 to 10 are the analysis, read from the clone at `C:\workspace\AltspaceGames\rp-toolkit` (C# sources,
and prefab/scene YAML with scripts matched by GUID from their `.meta` files). Section 0 is the state of the port:
the rules are translated to TypeScript in `altspace/ts/` and tested in Node on the fake room (rung 1); the Unity
project in `altspace/` builds the kit and its bundles (rung 2) and runs the Play-mode tests (rungs 3 and 4). 0.6 is
the Unity phase; `TESTS.md` holds the evidence.

## 0. Port status (2026-11-25): rules in Node, kit and bundles, Play mode, review fixes

### 0.1 What exists

| | |
|---|---|
| Sources | `altspace/ts/src/`: one file per upstream file of the translation map (section 7, rows 1 to 16: 22 files), plus `index.ts`. `DiceRoller5E.cs` becomes `DiceRollerD20.ts` (renamed, 0.2). `VRPGTextElement`, `VRPGIconElement` and `IconController` are plain objects over kit objects, not behaviours; `VRPGTextElement.ts` also holds `VRPGInputField`, the page's copy of a uGUI input field |
| Runtime | `altspace/ts/portkit/`: a copy of `portkit/ts` (robocopy /MIR without node_modules and dist), unedited; re-synced in the Unity phase (portkit `1118ef0`), in the fix pass (portkit `812f285`, 0.7) and again to portkit `c971100` (0.8) |
| Bindings | `altspace/ts/bindings.json` is written by the kit builder (`Assets/Kit/Editor/RpToolkitKitBuilder.cs`): 353 objects, 351 refs, 26 behaviours, 76 events (68 `uiButton`, 7 `field`, 1 more `uiButton` on the nav row). The object keys and behaviour ids are the ones the provisional file had (`bindings.lock.json` was seeded with them), except the 24 player-list rows beyond 8 (0.6) |
| Tests | `npm test`: typecheck, lint (page and clock rules: clean), 28 Node tests (21 before the fix pass), all passing. `vectors/dice.json`: 13 DS and 8 d20 vectors with upstream line references, derived by hand from the C# (no dotnet, no VRChat SDK: Q13) |
| Build | `npm run build` writes `Assets/WebRoot/pk-rp-toolkit.js` (about 464 KB, MIT notice of GIB Games at the top from `script-header.txt`) |

Tests (`altspace/ts/test/`):

| File | What it shows |
|---|---|
| `dice.test.ts` | every DS vector (DS:26-137) and every d20 vector (D5E:19-146) through the kit's buttons and fields with a scripted Random.Range: line text, which log, the (min, max) of each draw, the 1 s re-roll and the three-tie stop; a remote client's forged `NewRoll` / `SetMod` does nothing on another client, and a finished dice line it sends in another player's name shows under its own name (what nobody can check is a player's own roll: 0.7.3) |
| `utils.test.ts` | int.TryParse as C# (signs, white space, trailing NULs, overflow, "5.0"), GetColorHex with float32 and round-half-even, GetDots, StripTags, typed-text cleaning, the rich-text filter |
| `scenarios.test.ts` | each player's label attached to that player's own head with autoSync (an attachable kit object) and reproduced by the clients present, again after a rejoin; the volume buttons reaching the IM alert's AudioSource (op `audioVolume`); menu state per player (open by key, controller button and the board's button; panels; plates; forged events ignored); a GM grants and revokes a role, a lead's own grant counts while the lead is present and lapses when they leave, "Gm Title"; a non-GM's privileged requests refused on every client (GoSpawn, GoRespawn, DoForceBring, AskWhere, own-state grant, protected writes, forged "Give GM"); bring one player, go to one player, point A Local, point B All (fade timing, second press ignored, menu closed), respawn All; `disable-gm-bring`; IC, OOC and GM logs with text holding `\|`, `^`, double and single quotes, `%`, a backslash and a line break, identical in every client's buffer and in the kit text the relay sets; alert on and off; empty send; tag filter; 500-character cut; GM-log visibility; tabs; paging; name labels on join, leave and a new join into the freed slot; staff keep colours, others stripped; OOC preset; whitelists by user id (`staff-uids`, `no-staff-uids`, `vip-uids`, `enable-operators` off); `first-joiner-gm` off and on (and handed on when the first player leaves); a late joiner gets roles, names, labels and the recent IC and OOC lines (not the GM lines); name, title and options back on the same device and not on another; leaf budget (no space-state slot, at most 3 user-state leaves per player) |
| `trust.test.ts` | the review findings, one test each, every one failing on the code before its fix (0.7.2): no line in another's name; recent lines and the first joiner only from the referee's own user state, never GM lines; a moderator's record tied to its session; the rich-text filter in labels, titles, logs, list and card; future-dated grants refused; a chain of nine grants |

### 0.2 Decisions (decided by the coordinator, 2026-11-24)

These answer Q1 to Q4, Q10 and Q11 of 10.4 and override section 8 where they differ.

**Removed entirely**, with the reason:

| What | Where upstream | Reason |
|---|---|---|
| The remote configuration, staff list and exile list downloaded from the author's site, and the patron list and world version downloaded the same way | `CFG:58-178`, `MP:51010-51012`; `PAT:44-127`, `MP:62788`; `Scripts/Addons/WorldVersionCheck.cs`, `MP:19029` | Whoever can edit the author's file is staff, or exiled, in every world that uses the toolkit; a snippet must not depend on a third party's site. Replaced by settings on the element |
| The embedded default configuration with four VRChat display names (two staff, two "exile") | `MP:51018` | Other people's accounts; display names are not identities anyway (C1) |
| The author back door keyed on a display name: `TryElevate`, `Welp`, `IsOnGameMasterList`, the saved key 4256, the "butts" phrase, `GameMasterName` as top role and as patron | `GMD:125-219`, `GMD:140-143`, `PAT:139`, `MP:42035`, `MP:61401` | One named account becomes the top role in every world that uses the prefab |
| The persistent "cheater" shaming: `usedToast` / `wasToast`, `IdentifyCheater`, `DoCheaterProtection`, the "I AM A CHEATER" label, the cheater keys | `PO:91-99`, `PO:467-487`, `PO:513-551`, `GMD:77-80`, `CFG:46-49` | A public, persistent shaming mark, switchable from the author's remote config; it also mutes and immobilises |
| The inactive Character and Powers panels (Vampire: The Masquerade terms: clans, Disciplines, Celerity), with `VRPGCharacter`, `SheetDataValue`, `SheetModuleBase` | `MP:16168`, `MP:17892`; checklist 79 | Another publisher's game terms; off by default upstream and dependent on a hosted JSON file |

Other decisions:

- **Both dice rollers are ported.** The one upstream names after D&D 5E is the generic "d20 roller" (`DiceRollerD20.ts`, setting `dice` = `ds` (default), `d20` or `both`); its out-of-range read (`D5E:129`) is fixed (C11).
- **Game masters** are the world's owner and moderators by default (`isSpaceAdmin`, and a self-registration in protected space state, `x.gm-<uid>`). The setting `first-joiner-gm` (default off) makes the first player an Instance Lead. The staff table is protected space state (`x.st-<uid>` = `{r, at, by}`, written by game masters); a non-admin staff member's grants live in their own user state. Every privileged network event checks its sender (8.4, C3).
- **Left out, no platform API:** voice zones, channels, the amplifier, "GM heard everywhere" (L5), GM speed (L7). Per-account saves become per device (G3). **The map is left out**: its camera, render texture and material are not in the repository (checklist 83, R5).
- **Patron features** are the setting `vip-uids` (and `credits` for the credits text).
- **Late joiners see the recent log lines** (upstream shows them nothing): the referee keeps the last `log-recent` (20) IC and OOC lines in its own user state (0.7; GM-log lines are not kept).

### 0.3 Checklist status (section 2, 94 items)

Words: **Tested** (translated and covered by a Node test), **Done** (translated, no test yet), **Kit** (the
behaviour is the kit's or a graph's: needs the Unity side), **No**, **Removed** (0.2), **Left out**, **Dead**.

| Status | Count | Items |
|---|---|---|
| Tested | 66 | 1-12, 14, 16-21, 23-29, 31-65, 70, 72, 75, 77, 78 |
| Done | 4 | 13 (Off preset), 30 (network debug line), 68 (Exile Room; Exile and Un-Exile are Dead), 71 (grid toggle) |
| Kit | 0 | (1, the canvas, and 16, label placement, are built and tested: 0.6) |
| No | 5 | 66, 67, 80, 81, 82 |
| Removed | 6 | 74, 79, 84, 92, 93, 94 |
| Left out | 4 | 83 (map), 85, 86, 87 |
| Dead | 9 | 15, 22, 69, 73, 76, 88, 89, 90, 91 |

Also exercised in editor Play mode (TESTS.md rungs 3 and 4, through the desktop player's mouse and key and typing
into the kit's fields): 1, 2, 4-6, 9, 10, 11, 17, 23, 25, 26, 31, 32, 35, 37, 39, 42, 46, 47, 49, 53, 54, 55, 60 and
the late-join behaviour of 0.2 (roles, names and recent lines after a reload). 16 as built: the label sits
`label-height` over the head the player published (Diff: in steps, at most twice a second; 0.6.2).

Notes on Tested items that differ from what section 2 proposed: 3 has two of its three sources (controller
button, board button; the radial menu has no runtime call, RG3); 10 tests the caption (the logo image is the
kit's); 28 is capped at `log-lines` (60) per box with `log-view` (12) shown and page buttons, and late joiners get
`log-recent` (20) IC and OOC lines; 47 writes the label for every player (upstream skipped players with no saved
name, so a reused row kept a stale label); 54's grants by a game master go to protected state, others' to user
state; 70's volume is page state only (RG4); a revoked operator also loses the Operator UI (upstream left it on).

Section 8.4's "a grant ends 30 s after the granter leaves" is in fact "when the platform reports the leave": in
the fake room that is at once for a closed socket.

Section 8.6 as built (after the fix pass, 0.7): user state per player is `k` (runtime), `d` (PlayerData:
`vrpg-charName`, `vrpg-charTitle`, `vrpg-charDesc`) and one `p` leaf (the per-player behaviour: `labelSlot`, `grants`,
and, read only from the referee's, `recent` and `firstJoiner`); space state holds only the protected `x.gm-<uid>` and
`x.st-<uid>`: nothing the toolkit relies on is in public space state. Options (`vrpg-options-toggleImAlert`, `...ImSlider`, `...toggleGrid`) are
`localStorage` only. Teleport-to and bring travel as network events `AskWhere` / `AnswerWhere` / `DoForceBring`
with positions; "everyone" moves are `GoSpawn0`..`GoSpawn5` and `GoRespawn`.

### 0.4 Runtime gaps found (portkit was not edited; local workarounds in the game's files)

| # | Gap | Workaround here | Asked of the runtime or the kit |
|---|---|---|---|
| RG1 | No text input: the Platform has no UI-kit text field, and the page cannot read a uGUI `TMP_InputField` (G8) | The kit reports each edit with the graph-to-page event `field` (`<object key>\|<text>`), and the page clears a field with the relay `text` op on the field's object | Kit builder: a listener on each of the seven input fields (whether `TMP_InputField.onValueChanged` is on the graph allow-list is unverified). Relay: the `text` op must also set `TMP_InputField.text` |
| RG2 | No avatar attachment and no remote head positions (G4) | Labels are a pool of 32 kit objects; each player claims a slot in their own user state and every client fills it | A way to attach a kit object to each player's avatar (or a per-frame graph that places slot `n` over the head of the player who holds it) |
| RG3 | No radial-menu (WorldOption) call in the runtime | Key, controller button and the board's open button only | `this.Input` or the Platform: add a world option button |
| RG4 | No relay op for `AudioSource.volume` | The alert volume is kept and saved by the page but changes nothing | A `volume` relay op |
| RG5 | No respawn call, and the runtime does not pass on `player-teleported` with `isSpawn` | Respawn goes to the setting `respawn`, else to where the board is parked | Pass the spawn teleport through, or a respawn call |
| RG6 | A network event can call any public method of any behaviour (only `_` names are blocked) | `VRPGComponent.FromRemote()`: every button method returns at once when another client's event runs it; internal steps are `_`-named | A per-class allow-list of network-callable methods (UdonSharp's `[NetworkCallable]`) |
| RG7 | `Input.Position` is the head, not the feet; `TeleportTo` takes a position | Bring and teleport-to use the head position as is, so a teleportee lands at head height (measured in Play mode: a GM bring put the brought player's head at 3.2 m for a GM head at 1.6 m, TESTS.md rung 4) | The local player's feet position, or a note of what `TeleportTo` expects |
| RG8 | The relay's `audio` op is not built yet (portkit README) | The two alert objects are left out of refs, so the page plays their clips itself (`BS.AudioSource.PlayOneShot`, marked UNVERIFIED in the adapter) | The `audio` op, or confirmation of the page path |

After the re-sync (0.6): **RG1 closed** (the kit's field events and the `text` op), **RG4 closed** (`audioVolume`),
**RG6 closed** (`networkCallable`), **RG8 closed** (the `audio` op; the alerts are in refs). **RG2 closed** in the fix
pass (0.7): each player attaches its own label to its head (`AttachToHead`); since 0.8 with `autoSync`, the labels being
attachable kit objects (until then each holder owned the label's synced transform). **RG3**, **RG5** and **RG7** are
still open.

### 0.5 Not done (still)

Golden vectors from compiled C# (9.1) were not produced; the dice vectors are hand-derived with line references.
Nothing ran in the Altspace app or on a Quest (rung 5). See 0.6.4 for what stays unverified.

### 0.6 Unity phase (2026-11-24): kit, bundles, Play mode

#### 0.6.1 Re-sync with the fixed kit

- `ts/portkit` mirrors portkit `1118ef0`. Network events reach only what a class lists in `static networkCallable`:
  `VRPGGameMasterData` lists `SyncCallST`, `AskWhere`, `AnswerWhere`, `DoForceBring`, `GoSpawn0`..`GoSpawn5`,
  `GoRespawn`; `VRPGLogs` lists `ReceiveLogNew`, `DoNetworkDebug`. Every `FromRemote()` guard (78 of them: they only
  stopped a method being run by name from another client) is gone with `FromRemote()` itself; the sender checks of the
  handlers that act (`RoleOf(CallingPlayer)`, `SenderIsStaff`, the target-id checks) stay (RG6 closed).
- Text fields: each of the seven `TMP_InputField`s is bound as a bindings event of kind `field` to a method of its own
  (`NameTyped`, `TitleTyped`, `ICTyped`, `OOCTyped`, `GMTyped`, `AttTyped`, `DefTyped`); the kit's relay graph polls
  `text` / `isFocused` and reports once editing ends; the page sets a field with the `text` op (RG1 closed).
- The alerts are in `refs` and play through the relay's `audio` op (RG8 closed); the volume buttons set the IM alert's
  `AudioSource.volume` (op `audioVolume`, RG4 closed).
- `AttachToHand` is not used: it attaches to the local hand only, and labels go over **other** players' heads.

#### 0.6.2 Decisions taken in the kit

| Subject | Decision | Why |
|---|---|---|
| Buttons | **uGUI buttons**, heard by the relay graph (`uiButton`), not layer-5 colliders | The canvas keeps its GraphicRaycaster anyway (a TMP_InputField takes focus through uGUI), spike S6 showed uGUI clicks reach the page from a kit, and the canvas would sit in front of colliders. Cost measured: the relay graph is 1,608 units (51 distinct members, all allowed) relaying 75 events; 871 KiB of graph data in each bundle (Android 1,268 KiB, Windows 1,310 KiB in all) |
| Name labels | the pool of 32 (`Labels/Label n`, made from `VRpgPlayerObject.prefab`'s label canvas). Each player's page attaches the slot it holds to its own head with `AttachToHead(..., autoSync)`; the slots are attachable kit objects (`stage.Attachable`, bindings `"attach": true`), so each other client re-parents its own copy under that player's avatar (0.8; from 0.7 to 0.8 each holder owned the slot's synced transform instead). The canvas pivots at the attachment point, a look-at constraint makes it a billboard, and the text sits `LabelHeight` (0.75 m) along the billboard's up, so every viewer sees it above the head whichever way the head tilts. Fix pass (0.7); until then each player published its head position and every client placed the label | No graph member reads another player's head (allow list: `BS.BSUser` has no position) and the page gets the local head only. `label-height` other than 0.75 moves the attachment point along the head's own up axis (that part tilts) |
| Labels facing the viewer | a `LookAtConstraint` on each label canvas whose source is the fade sphere, which each page attaches to its own head (`TrackBone`, `AttachToHead` without sync) | No camera is reachable from a graph (`Camera.main` is not on the allow list); a native constraint needs no graph and no bridge traffic per label |
| Player list | **8 rows a page** (the 2 x 4 grid the upstream scroll view showed), page buttons; the other 76 rows are gone | A scroll view cannot be dragged from the page; 8 rows is what fits the panel. Ids `row0`..`row7` keep their keys |
| Logs | fixed boxes (scroll views, scrollbars and masks removed; a RectMask2D), the newest `log-view` lines at the bottom, up/down page buttons over the box; each log's children moved under a `View` object its tab switches; the three log boxes have canvases of their own (the player list cannot: a nested canvas needs its own raycaster for its buttons) | G8, C7, C12; one canvas for 300 texts would rebuild on every line (6.4) |
| Toggles, dropdowns, slider | toggles (GM roll, IM alert, grid, the d20 roller's "to GM") become buttons whose check mark the page switches; the Local/All and threat dropdowns become buttons with a label; the volume slider becomes `-`, value, `+` | G8 |
| Both dice rollers | the d20 roller ("Dice 5E.prefab") is placed in the same Actions slot as the DS roller (upstream made it for that slot); with `dice="both"` a "DS / d20" button switches between them (`VRPGManager.SwitchDice`). Its d2 (wired to d20) and d100 (unwired) buttons are gone; 1d20, Adv and Dis buttons added (C11) | One column, two rollers |
| Open button | a uGUI "Open" button on the board (next to the close button), bound to `VRPGMenuCaller.Interact` | the board's open button of 8.7 |
| Removed objects | Teleport Points (the upstream world's own), Character, Regions, Voice Controller, TeleTarget, Menu Caller sphere, Whitelists, World version Check, Randomizers, Panels 1 to 3, JanUi, RPS, Spends, the GM log's TryButton (the back door), OperUI Exile/Unexile, ST Voice, ST Speed, Janitor, Feeple, IconButtons, PostProc/Reflections/Chairs/Snow toggles, grid slider; the label's map dot, stream icon, Level and Tags | 0.2, 10.2 |
| Sprites, materials | images that used Unity's built-in UI sprites draw plain rectangles (a bundle carries no `unity_builtin_extra`); the missing UI material is the default one; `VRPG.png` (logo) is kept | |
| Fade sphere, target, grid | ProBuilder meshes (not importable without the package) become Unity's sphere, cube and plane meshes; URP Unlit materials, set up by URP's own `SetMaterialKeywords` (fade: black, alpha-clipped by the upstream perlin texture, both faces, `_Cutoff` animated by the upstream clip; target: black; grid: additive, a generated hex tile). The fade animator is wired (C9). Grid: `grid-position` / `grid-size` settings added | 6.3 |
| Legacy uGUI Text | `KitText.ToTextMeshPro` runs in `Finishing`; after the removals none is left (JanUi's "No TP" was the only one) | |

#### 0.6.3 Art replacements (THIRD-PARTY-NOTICES.md)

| Upstream (missing or unlicensed) | Replacement | Source, licence |
|---|---|---|
| GM alert clip `22e0b772` (missing) | `Assets/Kit/Audio/bong_001.ogg` | Kenney "Interface Sounds" 1.0, https://kenney.nl/assets/interface-sounds, CC0 (the pack's `License.txt`, kept beside it); checked: Ogg Vorbis, mono, 44.1 kHz |
| IM alert clip `63ad4880` (missing) | `Assets/Kit/Audio/glass_002.ogg` | the same pack, CC0 |
| version-alert clip `973e940d` (missing) | none | the world version check is removed (0.2) |
| UI material `35630e38` (missing) | Unity's default UI material | nothing shipped |
| role-icon sprite `653f402f` (missing) | `Assets/Kit/Textures/RoleDisc.png`, a white disc the four role images tint | generated by the kit builder (port's MIT) |
| hex grid texture `8e383558` (missing) | `Assets/Kit/Textures/HexGrid.png` | generated by the kit builder (port's MIT) |
| two font assets `be95bf52`, `4b82cb99` (missing) | none needed | used only by the removed Character panel |
| three Roboto Slab TMP font assets (in the repo, no licence file) | `Assets/Kit/Fonts/RobotoSlab SDF.asset`, baked by the kit builder from `RobotoSlab[wght].ttf` | Google Fonts, https://github.com/google/fonts/tree/main/apache/robotoslab (`METADATA.pb`: `license: "APACHE2"`, "Copyright 2018 The Roboto Slab Project Authors"); the Apache-2.0 text ships (`Assets/Kit/Fonts/RobotoSlab-LICENSE-Apache-2.0.txt`, and in the bundle's notices). Checked: TrueType, sha1 `b2c33e888223e7c65aa6c3f2d61d087438a9802f` |
| fade target material `44e7a0ee`, ProBuilder material (missing) | URP Unlit black | made by the kit builder |

Liberation Sans (TextMesh Pro essentials, OFL 1.1) stays for the texts upstream drew with it and is the fallback for
characters outside Roboto Slab's atlas (Latin-1 and a few symbols).

#### 0.6.4 Still unverified

Everything in the app and on a Quest (rung 5): uGUI clicks and text fields with a laser and the app keyboard, the
relay graph's per-frame field polling on Quest, label placement with real latency, the look-at constraint in the app,
frame time with the 32-label pool and 300 texts, the alert sounds (nobody listened in Play mode), protected writes
by a moderator (Play mode has the owner only), and the radial-menu button (RG3: no runtime call).

### 0.7 Fix pass (2026-11-25): re-sync with portkit `812f285`, review findings

#### 0.7.1 Re-sync

- `ts/portkit` and `Packages/com.altspacegames.portkit` mirror portkit `812f285` (`tools/sync.sh rp-toolkit`).
- Workarounds removed: `playtest/run.sh` (the kit's `playtest.sh` now versions `/web/` addresses and empties the local
  relay's room); `type` and `where` in `Assets/Kit/Editor/RpTestCommands.cs` (the kit's InputSim `type`, KitProbe
  `probe - head`); the game's photo menu `PortKit/RpToolkit/Take Menu Photo` (`PhotoRoot` = the menu board; the panels
  the page hides at start are saved off, bindings `"active": false`, so the photo shows the board as first seen); the
  class-level `static perPlayer` (`stage.PerPlayer`); the builder's own clip helper (`stage.ClipValue`); the hand-picked
  d20 toggle (re-imported stand-ins keep their base class: `DiceRoller5E : VRPGRollerBase`, so `gmToggle` is read from
  the stand-in); self-published head positions (`AttachToHead`, below).
- Added for the Play-mode test: `findpos` / `findtext` in `RpTestCommands.cs`. The SDK re-parents an attached object
  under the avatar's bone, so KitProbe's path from the kit root no longer reaches a label (kit gap).
- Labels (RG2 closed): each page takes the label slot it holds (a synced transform, network id
  `pk1/rp-toolkit/<inst>/label<n>`) and attaches it to its own head (`GameObject.AttachToHead`); the app sends its pose to
  everyone. The attachment's own `autoSync` was tried first and measured in Local Multiplayer: the other player's copy
  never moved, because only the attaching page gives the object its network id and the app reproduces a remote
  attachment by that id (kit gap). The canvas pivots at the attachment point and is a billboard (look-at constraint on
  the fade sphere); the text sits 0.75 m along the billboard's up. Two other layouts were measured and dropped: a
  `PositionConstraint` offset and a vertical-only aim constraint both let the local player's own label tilt with the
  head. The fade sphere, which the labels' look-at constraints aim at, is attached to the local head
  (`TrackBone`, no sync) instead of being moved by the page on each pose.
- Licences: `Assets/Kit/Licenses/` holds VRpg 2's MIT text, Roboto Slab's Apache-2.0 text, Kenney's CC0 note and
  portkit's MIT text; the kit adds TextMesh Pro's `LiberationSans - OFL.txt`. The notices name Liberation Sans's two
  copyright lines.
- Rungs after the pass (TESTS.md): `npm test` 28 of 28; `PortKit/Kit/Check` PASS; rung 3 23 of 23 and rung 4 26 of 26,
  each twice in a row on the final bundles. Bundles: Android 1,268 KiB before, 1,273 KiB after; Windows 1,310 KiB before,
  1,313 KiB after. The box gizmo is set to the floor grid (`GizmoSize` 20 x 0.2 x 20 m): the kit's own footprint is empty
  now that the board is the photo's root and every other part starts switched off.

#### 0.7.2 Review findings (REVIEW-FINDINGS.md, rp-toolkit)

Every fix has a Node test that failed on the code before it (`test/trust.test.ts` unless named).

| # | Finding | Fix |
|---|---|---|
| 1 | Log and dice lines forgeable in anyone's name; the referee kept them in public `recentIC/OOC/GM` | The sender sends only its text; every receiver puts the sender's name (`Networking.CallingPlayer`, stamped by the room) in front of every line of it: the display name for OOC and GM lines, the sender's character name for IC lines (its display name when it has none, a change: upstream printed ": text"). A raw dice line is kept as it is when it starts with the sender's display name, else named. Recent lines are in the referee's own player object (user state). `dice.test.ts` no longer claims more than it shows. Tests: "finding 1", "findings 1 and 2", the dice test |
| 2 | "Roll to GM only" and GM chat persisted in public `recentGM` | GM-log lines are never published; late joiners get IC and OOC lines only. They still travel to every client as events, as upstream (0.7.3). Test: "findings 1 and 2" (no GM text anywhere in space or user state) |
| 3 | A moderator's `gm-<uid>` record never expired | The record names the session that wrote it and counts only for that session; a moderator re-registers each time. `no-staff-uids` overrules every record (8.4, GMD header). Test: "finding 3" (a demoted moderator who comes back is no Game Master) |
| 4 | Rich-text filter bypass ("Out of Character", tags with spaces or hyphens, list and card unfiltered); C6 overclaimed | One filter (`filterRichText`: any tag-like `<...>` removed unless `<b>`, `<i>`, `</color>` or an opaque `<color=...>`, repeated until stable, open tags closed); `StripTags` keeps only the menu's exact Out-of-Character name; character names, display names, list rows and the card filtered. Tests: "finding 4", `utils.test.ts` |
| 5 | Liberation Sans OFL text missing | The kit adds TextMesh Pro's OFL file to the bundles; notices name its copyright lines; `Assets/Kit/Licenses/` holds the other texts |
| 6 | The granter chose the grant timestamp | A user-state grant dated more than `GRANT_SLACK` (10 s) after the server time at which this client first saw it is refused. Test: "finding 6" |
| 7 | "Bring to me" trusts the caller's position | Not closable here; stated in 0.7.3. The proposed fix ("use its head") relied on the self-published `head`, which was the caller's own claim too and is gone with `AttachToHead` |
| 8 | The comment on `first-joiner-gm` overclaimed (public `firstJoiner`) | Closed rather than reworded: the record is in the referee's own player object, read only from the current referee; the comment says so. Test: "findings 1 and 2" (a forged public leaf and a non-referee's record change nobody's role) |
| 9 | Role chains cut after 6 steps | As many rounds as players. Test: "finding 9" (nine links) |
| 10 | Kit copy at `1118ef0`; use `AttachToHead` for labels | 0.7.1 (attached locally, carried to others by the label's synced transform). Test: `scenarios.test.ts` "each player's label is attached to that player's own head"; Play mode: TESTS.md rungs 3 and 4 |

#### 0.7.3 Trust: what a modified client can still do, compared with upstream

Upstream trusts every client for everything (any client can run any method on any other, write any role, and post
any line in anyone's name). The port leaves a modified client this much:

- **Its own dice.** A roll is made on the roller's own page, as upstream; a modified page can report any number for its
  own roll. It can no longer report it in anyone else's name. (Fair draws per roll would need a round trip to the
  referee and a witness for every click: not done.)
- **Its own names.** A character name is free text, as upstream: a player can name their character after someone
  else's. The player list shows which account plays which character.
- **Visual line spoofing.** A line wraps in the box; text padded to wrap at the right place can make a visual line
  begin with another name. Every real line break is named.
- **Reading GM-log traffic.** GM-log lines reach every client as events and only the page hides them from non-staff,
  as upstream (Q6). They are no longer stored anywhere.
- **The referee seat.** No server appoints the referee (portkit README). A modified client that takes the seat can
  publish false recent lines and a false first joiner for late joiners (it cannot touch roles from protected state or
  other granters' user state).
- **Bring and teleport-to positions** (finding 7). A player with a role sends the position it wants the brought
  player to land at; the page reads no other player's position (G4), so the target cannot check it. Upstream read the
  caller's position from VRChat. Only players with a role can bring; a host can switch bring off (`disable-gm-bring`).
  Teleport-to likewise trusts the asked player's answer.
- **Grant dates.** A staff member's own grant may be dated up to `GRANT_SLACK` ahead; one dated further ahead is
  refused by clients present when it appears, but a client that arrives later than that date accepts it.
- **Moderators.** A moderator's record lasts for the session that wrote it; a Game Master's grants in protected state
  (`st-<uid>`) last until a Game Master changes them, or `no-staff-uids` overrules them.

#### 0.7.4 Known issues left

- RG3 (no radial-menu call), RG5 (no respawn call), RG7 (teleports land at head height: the page knows heads, not
  feet) are still open.
- `label-height` other than 0.75 moves the attachment point along the head's own up axis, so that part of the offset
  tilts with the head (the kit's constraint carries the 0.75 m).
- Labels: closed in 0.8 (attachable labels with `autoSync`: nothing is sent per frame).
- The bundles still carry the upstream prefab's placeholder plate texts ("Sir William Bagg", "Player: Monzill84",
  "Asst. DM"); the page overwrites them at start, as before.
- The runtime's `digest()` covers space-state behaviours only; this toolkit now keeps none there, so the rung 4 page
  comparison uses the game's own `view()` (roles, names, slots, IC and OOC lines) instead (kit gap). Closed in 0.8: the
  digest covers per-player synced fields, and rung 4 compares it too.

### 0.8 Re-sync with portkit `c971100` (2026-11-25)

- `ts/portkit` and `Packages/com.altspacegames.portkit` mirror portkit `c971100` (`tools/sync.sh rp-toolkit`). Nothing in
  the rules needed changing for the kit's other changes (draw table, `checkDeal`, command write marks, `HeadOf`,
  `InReach`): the toolkit uses none of them.
- **Labels are attachable kit objects, attached with `autoSync`** (the workaround of 0.7.1 dropped). The kit builder marks
  each `label<n>` with `stage.Attachable` instead of `sync: "transform"` (bindings `"attach": true`, `"sync": "none"`;
  hash `da4c55f9...`), so every client gives it the attachment id `pk1:rp-toolkit:<inst>:label<n>` as the kit loads;
  `VRPGPlayerObject._AttachLabel` calls `AttachToHead(offset, identity, true)` and no longer takes ownership of a synced
  transform. Measured in Local Multiplayer (TESTS.md rung 4, twice): Player 2's label follows Player 2's head in the
  GM's Unity, the GM's label (attached before Player 2 came) follows the GM's head in Player 2's Unity, both again after
  Player 2's page reload, each 0.750 m from the wearer's head and square to the viewer's line of sight, as the synced
  transforms were. What it saves: the 32 BS Synced Objects, and the pose messages a synced label sent while its holder's
  head moved (up to 30 Hz). The label's `label-height` offset travels in the attachment record.
- **Removed:** `Assets/Kit/Editor/RpTestCommands.cs` (`findpos`, `findtext`). The Play-mode test reads labels with the
  kit's `probe` by path; `KitProbe.Find` falls back to the name for a label the SDK re-parented under a remote avatar.
- **New in rung 4:** the GM's label in Player 2's Unity (the late case) and its text, both after the reload too; Player
  2's label after the reload; `digest()` compared at equal `version()` (the digest covers per-player synced fields
  now). 33 checks (26 before). Rung 3: 23 of 23.
- `scenarios.test.ts`'s label test now checks the autoSync attachment, the `attach` binding and that a client present
  when a label is attached reproduces it (`FakeClient.remoteAttached`); it fails on the code before.
- Kit rebuilt: Build Prefabs, `npm run build` (508,915 bytes), Build Bundles, `PortKit/Kit/Check` PASS. Bundles: Android
  1,303,518 -> **1,313,075 bytes**, Windows 1,344,932 -> **1,356,056 bytes** (the relay graph's `pkHead` op and the
  per-target launch variables; the dropped BS Synced Objects save a little). `dist/` now has `licenses/rp-toolkit/`.
  The kit's footprint counts the board's uGUI (1.5 x 1.18 m; it was empty); `GizmoSize` (the 20 x 20 m floor grid) is
  kept, the grid being the largest thing the snippet draws and starting off in the kit. The photo is now framed on the
  board's uGUI.
- Kit gaps seen (portkit not edited): the fake room shares an autoSync attachment only with the clients present when it
  is made, so a client that arrives later never reproduces it (`platform/fake.ts` `shareAttachment`), though the SDK's
  LocalAttachmentBridge applies the wearer's user state on arrival and keeps it pending until the object exists (the
  Node test cannot assert the late case); `KitProbe.Find`'s fallback looks up only the last name of the path, so a path
  under a re-parented object (`.../Label 1/Canvas/Labels`) is ambiguous once two labels are re-parented (it took the
  first; with two players only one is).

Conventions used in this file:

- Paths are relative to `VRPG2/`. `file:line` is a line in the upstream file at commit 8e2c2cc.
- Short names for the files cited most:

| Short | File |
|---|---|
| `GMD` | `Scripts/Core/VRPGGameMasterData.cs` |
| `PO` | `Scripts/Core/VRPGPlayerObject.cs` |
| `MGR` | `Scripts/Core/VRPGManager.cs` |
| `MENU` | `Scripts/Core/VRPGMenu.cs` |
| `CALLER` | `Scripts/Core/VRPGMenuCaller.cs` |
| `LOG` | `Scripts/Core/VRPGLogs.cs` |
| `SOC` | `Scripts/Core/VRPGSocial.cs` |
| `OPT` | `Scripts/Core/VRPGOptions.cs` |
| `CHR` | `Scripts/Core/VRPGCharacter.cs` |
| `UTL` | `Scripts/Core/VRPGUtils.cs` |
| `VOICE` | `Scripts/Core/VRPGVoiceController.cs` |
| `GMT` | `Scripts/Core/VRPGGameMasterTools.cs` |
| `CFG` | `Scripts/Utilities/VRPGConfigData.cs` |
| `PAT` | `Scripts/Utilities/VRPGPatronData.cs` |
| `TELE` | `Scripts/Utilities/VRPGPlayerTeleport.cs` |
| `WL` | `Scripts/Utilities/VRPGWhitelists.cs` |
| `DS` | `Scripts/Components/DiceRollerDS.cs` |
| `D5E` | `Scripts/Systems/D&D 5E/DiceRoller5E.cs` |
| `ROLL` | `Scripts/Systems/Common/VRPGRollerBase.cs` |
| `TXT` | `Scripts/UI/VRPGTextElement.cs` |
| `PBTN` | `Scripts/UI/VRPGPlayerButton.cs` |
| `ICON` | `Scripts/Addons/IconController.cs` |
| `MP` | `VRPG Manager.prefab` |
| `PP` | `Prefabs/VRpgPlayerObject.prefab` |
| `D5P` | `Scripts/Systems/D&D 5E/Dice 5E.prefab` |
| `SCN` | `VRPG Demo Scene.unity` |

- Status words in the checklist: **Full** (same behaviour), **Diff** (works, with the stated difference),
  **No** (cannot be done on the platform or within the portkit contract), **Dead** (unreachable or inert in
  upstream as shipped, proposed to leave out).
- "Proposed" marks a design choice of this document, not a fact about upstream.

---

## 1. Upstream at a glance

| | |
|---|---|
| Repository | `https://github.com/GIBGames/VRpg.git` (remote `upstream`), 42 commits |
| Commit | `8e2c2cc30c42cedbb7341e36f7f3a65a01714174`, 2026-09-29, "Update Readme". The commit before it (`ab70202`, same day) is "Major update to VRPG 2. Incompatable with previous release" |
| Working branch | `altspace` (clean at the time of writing) |
| What it is | "A system for creating RPG systems in VRChat" (`../README.md:4-5`): a roleplay and game-master toolkit, not a game |
| Content root | `VRPG2/` only. 105 files, 11.3 MB, without `.meta` files and without `Scripts/Dependencies` |
| Own C# | 41 files, 5,247 lines, about 2,374 statement lines (no blank lines, comments, `using`, lone braces). The plan's table says 5,288 |
| Entry scene | `VRPG Demo Scene.unity` (284,569 bytes): Main Camera, Directional Light, `VRCWorld`, Floor, and four prefab instances (`SCN:128,457,974,5577`) |
| Main prefab | `VRPG Manager.prefab`: 3,369,380 bytes, 3,408 YAML documents, 738 GameObjects |
| Other prefabs | `Prefabs/VRpgPlayerObject.prefab` (one per player), `Prefabs/FadeSphere.prefab`, `Prefabs/TeleTarget.prefab` (an empty transform), `Scripts/Systems/D&D 5E/Dice 5E.prefab` (placed nowhere) |

**Unity and SDK versions: not recorded.** The repo has no `ProjectSettings/` and no `Packages/manifest.json`.
What can be inferred:

- The scene was saved by Unity 2022.2 or newer: it has a `SceneRoots` object (`SCN:6023-6024`) and
  `m_ConstrainProportionsScale` on transforms (`SCN:805`). VRChat's supported editor for that generation
  is 2022.3 LTS (general knowledge, not from the repo).
- The scene descriptor still carries `unityVersion: 2019.4.31f1` (`SCN:5789`). That is a stale field.
- The code needs a VRChat Worlds SDK with persistence and parameterised network events:
  `VRC.SDK3.Persistence` and `VRC.SDK3.UdonNetworkCalling` (`GMD:15-16`), `PlayerData` (`GMD:69`),
  `[NetworkCallable]` methods with arguments (`GMD:221-222`), `OnPlayerRestored` (`PO:114`),
  `VRCPlayerObject` (`PP:679`). From general knowledge of the SDK's release history that means 3.8.1 or
  newer; the repo does not say.
- UdonSharp 1.x (`scriptVersion: 2`, `Scripts/Core/VRPGPersistentData.asset:20`), TextMeshPro, and
  ProBuilder (three meshes exist only as ProBuilder component data inside prefab YAML; see 6).

**Licences**

| Item | Licence | Evidence |
|---|---|---|
| VRPG2 code, prefabs, art | MIT, "Copyright (c) 2024 GIB Games" | `LICENSE:1-3`; `../README.md:1,30-31`; file headers such as `GMD:1-6` |
| Repo root | No licence file at the root; the only one is `VRPG2/LICENSE` | directory listing |
| `Scripts/Dependencies/UdonToolkit/` (170 files, 10.4 MB, excluded from the port) | MIT, "Copyright (c) 2021 orels1" | `Scripts/Dependencies/UdonToolkit/LICENSE:1-3` |
| ...its `Demo/Demo Assets/MUI/` shaders | MIT, "Copyright (c) 2019 Merlin" | `.../MUI/LICENSE:1-3` |
| ...its fonts `FredokaOne-Regular.ttf`, `Nunito-SemiBold.ttf`, `Lato-Regular SDF.asset` | No licence text in the repo | file listing |
| `Graphics/Fonts/RobotoSlab-Regular *.asset` (3 TextMeshPro font assets with baked atlases) | No licence text in the repo. Roboto Slab is published under Apache-2.0 (general knowledge; verify the release at import) | `Graphics/Fonts/RobotoSlab-Regular Clean.asset:68-69` (family and style) |
| Three audio clips, one UI material, one sprite, one hex texture, the map material, two more font assets | **Referenced by GUID but not in the repo.** Origin and licence unknown | 6 |

VRPG uses UdonToolkit only for inspector attributes (`[CustomName]`, `[HelpMessage]`, `[HideIf]`,
`[Button]`: `LOG:14,23`, `PAT:9,20-25,44`). No VRPG prefab references any UdonToolkit asset, so excluding
the folder loses nothing.

Things in the repo that are not licence matters but affect what may be shipped (details in 10):

- The shipped prefab downloads its configuration from the author's own site
  (`https://dorktoast.github.io/Site-97/Text/SiteConfig.txt`, `MP:51010-51012`) and has an author
  back door keyed on the display name `dorktoast` (`MP:42035`, `GMD:77-80,125-138,145-213`).
- The embedded default configuration contains four VRChat display names, two in a staff list and two in
  an "exile" list (`MP:51018`). They look like real accounts and must not be shipped.
- The inactive Character and Powers panels carry Vampire: The Masquerade terms (clan names,
  "Disciplines", "Celerity"; `MP:16168,17892`), and one roller is named "D&D 5E".

---

## 2. Feature checklist

Each line is a testable statement of what upstream does, where, and how it ports. The port is judged
against this list.

### A. Menu shell

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 1 | One world-space menu canvas per client (500 x 400 units at scale 0.003 = 1.5 m x 1.2 m). It is local: nothing about it is networked | `MP:94238-94342`; `MENU:21-22` | Full |
| 2 | Desktop only: pressing Q toggles the menu | `CALLER:29-43` | Diff: page `key-press` event. Key is a setting because Q is the desktop grapple key in worlds that enable the grapple |
| 3 | A 1 cm trigger sphere follows the local head every physics tick; using it (interact text "VRPG Menu", proximity 0.25) toggles the menu. README calls this "clicking your head in VR" | `CALLER:45-73`; `MP:96079-96169`; `../README.md:15` | Diff: a pointer cannot click an object at its own head. Replaced by a radial-menu button, the left controller's secondary button, and a button on the parked board (8) |
| 4 | Open: the menu jumps to head position + 0.9 m along the head's forward axis and takes the head's full rotation | `MENU:73-93` | Full (local head pose is available) |
| 5 | Close: the menu goes back to the pose it had at start. It is never hidden, so it stays usable where the world author put it | `MENU:43-47,79-83` | Full: parked at the snippet's `position` |
| 6 | The canvas has a close button | wiring, `MP:35165` | Full |
| 7 | Seven nav buttons, each shows one panel and hides the other six. Main, Map, Social, Options are active; Character, Powers, GM are inactive in the prefab | `Scripts/UI/VRPGMenuNavButton.cs:18-23`; `MENU:118-133`; `MP:74443,71977` | Full for Main, Map, Social, Options, GM. Character and Powers: see K and 10 |
| 8 | As shipped, Panel 0 (Main) and Panel 4 (Social) are both active until a nav button is pressed | `MP:83806,34580` | Diff: the port starts on Main only |
| 9 | Header plates show character name, character title, account display name and coloured staff title. Set when the local player joins and whenever their own name data changes | `MENU:49-57,157-163`; `PO:506-510` | Full |
| 10 | Logo image and the caption "VRpg RP System" | `MP:2707` | Full (caption becomes a setting) |

### B. Name and title

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 11 | "Set" stores the Name and Title fields as `vrpg-charName` and `vrpg-charTitle` and updates the plates | `MENU:135-142`; `PO:286-290` | Diff: live value in user state, saved copy in `localStorage`; the two fields are UI-kit text fields |
| 12 | "OOC" sets the name to `<color=#00FFFF>Out of Character</color>` (hex of `OocLabelColor`) and the title to the display name | `MENU:144-149`; `MP:84813` | Full |
| 13 | "Off" sets both to empty | `MENU:151-155` | Full |
| 14 | Name and title are kept per account between visits. On join the fields are pre-filled and every label shows the saved values with no action | `PO:114-124,380-392,452-459` | Diff: kept per device, not per account |
| 15 | A description can be stored (`$` becomes a line break). Only the character sheet's "Set name" writes it, and the element that would show it is inactive | `PO:292-296`; `CHR:156-177`; `SOC:70,75` | Dead (the data path is kept, nothing shows it) |

### C. Name labels

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 16 | Each player's label root is at the owner's head position + 0.75 m world-up; its first child turns to face the local viewer's head; both every physics tick | `PO:101-112` | Diff: the platform moves an attached object on each avatar; a per-frame graph keeps it upright. See risk R2 |
| 17 | The label shows character name and, under it, the title, for every player including ones who joined earlier | `PO:452-498` | Full |
| 18 | Rich-text tags are stripped from a name unless the owner is operator level, or the text contains "Out of Character". Titles are not stripped | `PO:461-465`; `TXT:61-72` | Diff: the exception holds only for the menu's own Out-of-Character name (a colour around those words); staff names, titles and every other shown text keep only `<color>`, `<b>`, `<i>` (C6, 0.7) |
| 19 | Names of patrons are tinted `VipLabelColor`; others return to the start colour | `PO:553-559`; `MP:29085` | Diff: the list is user ids in a setting |
| 20 | Players on the `ExileManifest` list have blank name and title | `PO:489-494` | Diff: user ids in a setting |
| 21 | A role icon sits with the label: one of four images chosen by `VisibleRoleIndex` (tints: dark, teal, orange-brown, purple). The sprite is missing from the repo | `PO:423-442`; `ICON:25-60`; `PP` | Full, with a replacement sprite |
| 22 | "Level" and "Tags" lines and a "Streamicon" image exist and are never filled (`SetTags` is empty) | `PO:47-52,298-304` | Dead |

### D. Logs and chat

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 23 | Three logs with tab buttons OOC, IC, GM. OOC is selected at start. A tab is "shown" by CanvasGroup alpha 1, raycasts and interaction on | `LOG:48-51,198-224` | Full (by activating objects) |
| 24 | The GM tab button and the GM log exist only for staff | `GMD:379-385`; `MP:42027-42032` | Full |
| 25 | Send: empty text does nothing. IC line is `\n{characterName}: {text}`; OOC and GM lines are `\n{displayName}: {text}`. The input is cleared | `LOG:100-133,180-196` | Full |
| 26 | Every client, the sender included, appends the line to the matching box. An IC line also plays the alert sound | `LOG:135-158` | Full (replacement sound) |
| 27 | GM-log lines travel to every client. Non-staff simply have the box hidden | `LOG:132-150` | Full, same trust. Sealing to staff is possible (question Q6) |
| 28 | Players who join later see no earlier lines. The boxes grow without limit | `LOG:143-150` | Diff: capped to the last N lines |
| 29 | "Raw" lines carry no name prefix: DS dice results, the Call GM line, the version notice | `LOG:85-98,115-118` | Full |
| 30 | `NetworkDebugLog` prints a line in every client's console | `LOG:67-78` | Full |

### E. "DS" dice roller (the one in the menu)

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 31 | ROLL makes two rolls of `Random.Range(1, 21)`, attack then defence, on the roller's own client | `DS:26-39` | Full |
| 32 | Modifiers come from the Att and Def fields by `int.TryParse`; a field that is not an integer counts as 0. Totals are roll + modifier | `DS:42-50` | Full |
| 33 | Threat +0/+1/+2 from two dropdowns (both inactive in the prefab, so always +0): a roll is exceptional when roll + threat >= 20 | `DS:52-58`; `MP` (AttThreat, DefThreat inactive) | Full; the dropdowns become cycle buttons and stay hidden by default |
| 34 | Attacker wins when the attack roll is not 1 and (attack total > defence total, or the defence roll is 1). Text: "Success!" or "Defense!", prefixed "Exceptional " as in 33; colours `#00FF00`, `#FF5500`, `#FFFFFF` | `DS:60-97` | Full |
| 35 | If the Def field is not an integer the line is `{name} rolled {att} + {m} = {t}!`; otherwise `{name} rolled A + m = T v. D + n = U: {result}` | `DS:99-107` | Full |
| 36 | With a Def modifier, both rolls 1 gives "Both players rolled a 1! You both suck!"; equal totals log "Tie! Rerolling!" and roll again after 1 s; after three ties in a row "Too many rerolls due to tie. Please try again!" | `DS:70-79,127-137` | Full |
| 37 | "Roll to GM only" on: the line goes to the GM log; off: the OOC log. Both raw | `DS:109-116` | Full |
| 38 | Reset empties both fields and sets both dropdowns to +0 | `DS:119-125` | Full |

### F. "5E" dice roller (separate prefab, in no scene or prefab)

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 39 | Buttons d4, d6, d8, d10, d12, d20 add that die to a pool. The button labelled d2 is wired to add a d20. A d100 button is inactive and unwired | `D5E:47-81`; `D5P:133,3580` | Full for d4 to d20. d2 and d100: Dead |
| 40 | The pool is shown as `Dice Pool: d20 d6 ...` followed by the coloured modifier. The loop reads one element past the end of the list on every update | `D5E:126-135` | Diff: the loop bound is fixed. What Udon does at that read could not be determined without running VRChat (Q9) |
| 41 | +/- buttons change the modifier by 1 and a label shows it. `ResetMod` exists with no button | `D5E:138-146`; `D5P:2951,3447` | Full |
| 42 | Roll: each die is `Random.Range(1, sides + 1)`; line `{name} rolled d20: 13, d6: 4, Total + m: T`. It is sent non-raw, so the log line starts with the name twice | `D5E:89-123`; `ROLL:15-18`; `LOG:119-129` | Full (the double name is kept) |
| 43 | Clear empties the pool | `D5E:83-87`; `D5P:520` | Full |
| 44 | A toggle sends the result to the GM log instead of OOC | `ROLL:13-18` | Full |
| 45 | `Roll20`, `Roll20Advantage`, `Roll20Disadvantage` exist and no button calls them | `D5E:19-39` | Diff: translated; three buttons are added so they can be reached |

### G. Social panel

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 46 | Refresh (the round button, or pressing the Social nav button): hide all 84 player buttons, then one button per player in the order the platform lists them, and "Players: N" | `SOC:86-118`; wiring in 5 | Diff: the pool is smaller (32); with more players the list pages |
| 47 | Button label: `[abbr] displayName`, then `\nAs: {charName}`, or `\n{charName}` unchanged if it starts with `<`. The label is only written for players who have ever stored a name | `PBTN:47-69,79-127` | Full |
| 48 | Label colour is `new Color(255, 165, 0)` for staff and yellow for others (the first is out of range and renders as yellow too) | `PBTN:61-67` | Diff: staff get the intended orange |
| 49 | Clicking a player shows their display name, character name and title in the panel | `PBTN:71-77`; `SOC:56-76` | Full |
| 50 | The list does not refresh by itself when someone joins or leaves | `SOC` (no join/leave handler) | Diff: also refreshed on join and leave |

### H. Roles

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 51 | Four roles: Normal 0, Controller 1, Admin 2 (shown as "Operator"), Janitor 3 (the author's "Game Master") | `ICON:63-69`; `MP:42035-42041` | Diff: role 3 is the verified space admin. See 8 |
| 52 | Each client assigns its own role when configuration arrives, which happens at start and again every time anyone joins (`CFG:58-71,110-126`). Order: not on the exile list, then (a) Janitor if the display name equals `GameMasterName` and a saved integer key equals 4256; (b) Admin if `enableOperators` and the name is on `StaffList` or the current role is >= 2; (c) Controller if the client is the instance master, is on `StaffList` (this is what staff get when operators are disabled), or already has a role >= 1; else Normal | `GMD:67-123,125-138,306-358` | Diff: user ids instead of names; no instance master (see 8); (a) is replaced |
| 53 | Role >= 1 shows the GM nav button, the GM log, its tab and the Social panel's GM-only block. Operators also get the Operator UI block | `GMD:379-393`; `MP:42027-42034` | Full |
| 54 | "Give GM" (Controller), "Give Operator" (button inactive in the prefab) and "Remove GM" act on the selected player. Refused when the caller's role is lower than the one given, when the role is above 2, or when a Controller targets the instance owner or master | `GMD:221-258,289-304` | Diff: same rule, with "world owner" for "instance owner or master" |
| 55 | The grant is an event to everyone carrying the target's id; the target sets its own role. Nothing checks who sent it, and the `key` argument is never read | `GMD:245-287` | Diff: receivers check the sender's role (10, C3) |
| 56 | A player on the exile list is forced to Normal whenever a role is set | `PO:311-317` | Full |
| 57 | Role titles, abbreviations and colours appear in the header plate and in the player list (`[J]`, `[O]`, `[L]`) | `GMD:360-377`; `PBTN:110-127` | Full (titles are settings) |
| 58 | "Gm Title" sets the caller's name label to their coloured role title and the title line to their display name | `GMD:446-458` | Full |

### I. Game-master tools

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 59 | "Teleport To": the caller lands 1.5 m in front of the selected player, facing them. No fade | `GMD:464-522` | Diff: the target's position is asked for and answered over one-shots (remote positions cannot be read) |
| 60 | "Bring To Me": the target teleports itself 1.5 m in front of the caller. Does nothing when config `disableGMBring` is true | `GMD:524-554` | Full; the target checks the sender is staff |
| 61 | Buttons A to F: with the dropdown on "Local" the caller teleports to point 0 to 5; on "All" every client does | `GMD:556-647,653-682`; `MP:42052` | Full; the six points are settings |
| 62 | Respawn: "Local" respawns the caller, "All" everyone | `GMD:570-582,648-652` | Diff: teleport to the spawn point (no respawn call in the page API) |
| 63 | The fade teleporter: mark as teleporting, show `FadeTarget` at the destination, close the menu, set animator bool `isDark`, wait 1 s, teleport, wait 0.1 s, clear. A request during a teleport is ignored | `TELE:16-42` | Full |
| 64 | In the shipped prefab and scene `teleAnim` is not assigned, so the first fade teleport stops at `TELE:26` | `MP:62284`; no override in `SCN` | Diff: the port wires the animator, so A to F work |
| 65 | "Call GM": every operator hears the GM alert sound; the GM log gets `{name} called for an ST!` | `GMD:432-444` | Full (replacement sound) |
| 66 | "ST Voice" ON: the caller takes ownership of the GM object and every client sets that player's voice distance to 9999-10000 m (heard everywhere). OFF: 0-25 m | `GMD:730-760,782-785` | **No**: there is no per-player voice control |
| 67 | "ST Speed" ON: the caller's run speed becomes 10; OFF: 4 | `GMD:766-778` | **No** within the contract: walking speed is only reachable through `scene.SetSettings`, which a snippet must not call |
| 68 | Operator UI: "Exile" and "Un-Exile" call empty methods; "Exile Room" teleports the operator (not the selected player) to the `noBox` point | `GMD:396-430,691-724` | Exile and Un-Exile: Dead. Exile Room: Full, as a seventh point |
| 69 | A "no teleport" flag: teleport-to and bring refuse a target whose saved flag `no-TP` is true. The toggle that sets it writes `no-tp` (other spelling) and lives in a component that is in no prefab | `GMD:497,543`; `GMT:52,81` | Dead as shipped. Proposed: leave out (Q7) |

### J. Options panel

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 70 | "IM Alert" toggle switches the alert sound object on or off; the slider (0 to 1, default 0.2) sets its volume | wiring in 5; `MP:85840` | Full |
| 71 | "Show Grid" shows a hex grid plane. The grid slider calls a method whose body is commented out | `MP:6530`; `Scripts/Components/VRPGGrid.cs:12-22` | Full for the toggle (new grid texture); slider Dead |
| 72 | Option toggles and the volume slider are saved as `vrpg-options-<object name>` and restored on join; a toggle with no saved value is on | `OPT:46-80` | Diff: `localStorage` |
| 73 | "PostProc", "Reflections", "Chairs" and (inactive) "Snow effect" toggles have no target object | wiring in 5 | Dead |

### K. Configuration, patrons, character sheet

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 74 | The instance master downloads a JSON document from a URL (or uses the embedded copy), keeps it in a synced string, and informs subscribers; a late joiner asks the owner to announce again | `CFG:58-178,238-244` | Diff: the values are snippet settings, identical for everyone, so nothing needs syncing. An optional `config-url` is proposed |
| 75 | Keys read by code: `StaffList`, `ExileManifest`, `enableOperators`, `disableGMBring`, `verboseDebug`, `enableCheaterDetection`, `localCheaterKey`, `windowScaleLogKey`, `enableKeyGeneration`, `WorldVersion`, `VersionChangeNotice`, `cheatDetectionMessage`. `GameSchedule` and `Socials` are in the default document and nothing shows them | `CFG:128-135`; `GMD:69,96,184,357,527`; `MP:51018` | Diff: the first four become settings; the rest go with the features in 10 |
| 76 | List entries can be added and removed at run time; nothing calls these | `CFG:196-236` | Dead |
| 77 | Patron list: a JSON document `{"PatronList": [[...], [...]]}` from a URL; entry `Shown$accountName` splits display from account; plain entries of tier 0 are left out of the credits; each tier is coloured | `PAT:45-127` | Diff: `vip-uids` and a credits text setting. No download |
| 78 | Patron effects: tinted name label (19), objects in `PatronItems` shown to patrons, a credits text. In the shipped prefab the credits target is unset, so the download never starts and nobody is a patron except the name in `GameMasterName` | `PAT:38-42,129-152`; `MP:62786-62803` | Diff: only the tint and the credits text have something to act on |
| 79 | Character sheet module: off by default (`EnableModule: 0`, empty URL, nav button inactive). When on: download a JSON list of characters, load one by id if its `vrcName` is the caller's name, or "any", or the caller is an operator; fill 49 sheet fields (plain, dots, or `$`-separated lists); "Set name" copies name, title and description to the label | `CHR:38-185`; `Scripts/Systems/Common/SheetDataValue.cs:26-133`; `MP:22793` | Proposed: left out of the first version (10, L6) |

### L. Voice, map, world checks, parts placed nowhere

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 80 | Voice zones: a trigger volume sets the local player's saved `vrpg-voiceZone`; on any saved-data change every client sets each other player's voice far distance to 25 (same zone or zone 0, channel match), 1 (same zone, other channel) or 0 (other zone). No zone volume is placed in the demo scene | `Scripts/Components/VRPGVoiceZone.cs:12-28`; `VOICE:35-72`; `PO:244-252` | **No**: no voice-zone or per-player voice API |
| 81 | Voice amplifier volume: a player inside gets voice gain and distance from the component | `Scripts/Components/VRPGVoiceAmp.cs:9-21` | **No**, same reason |
| 82 | On respawn a player's voice is reset to 0-25 m with low-pass on | `VOICE:24-33` | **No** |
| 83 | Map: the Map panel holds a quad whose material is not in the repo. Each player object carries a dot image kept 75 m above the player on layer 18, and methods to colour it (`ShowIcon`, `HideIcon`) that nothing calls. No map camera or render texture is in the repo | `MP:80519,30880`; `PO:111,219-238`; `PP` | Diff: what the map showed could not be determined. Proposed: a new top-down camera view with dots (8, R5) |
| 84 | World version check: every 90 s download a version string; if it differs from config `WorldVersion`, play the alert and (on the master) post the notice to the OOC log each time | `Scripts/Addons/WorldVersionCheck.cs:28-73`; `MP:19029-19032` | Proposed: left out (10, L3) |
| 85 | `Teleporter`: an object that teleports whoever uses it to a target, with the fade | `Scripts/Components/Teleporter.cs:12-28` | Not placed upstream. Left out; the platform has its own teleporter prefab |
| 86 | `VRPGClock`: writes the local date and time ("M" and "HH:mm") into two texts about every 5 s | `Scripts/Utilities/VRPGClock.cs:27-54` | Not placed upstream. Left out |
| 87 | `SecuCamRepeating`: renders a camera once a second while a target object is active | `Scripts/Addons/SecuCamRepeating.cs:15-30` | Not placed upstream. No page API renders a camera on demand |
| 88 | `VRPGRegions`: switches lists of world objects on and off. Its three slots point at itself and nothing calls it | `Scripts/Core/VRPGRegions.cs:19-48`; `MP:45520` | Dead |
| 89 | `VRPGGameMasterTools`: author-only items, a debug clipboard, the no-teleport toggle. In no prefab; three menu buttons still point at its method names | `GMT:31-127`; wiring in 5 | Dead |
| 90 | `VRPGWhitelists`: an earlier copy of the config mechanism. Its URL is empty and its subscriber has no handler for its event | `WL:28-155`; `MP:8404-8407` | Dead |
| 91 | `VRPGDynamicData` and `TXT:35-40`: show a config value in a text. No element has a key set | `Scripts/Components/VRPGDynamicData.cs:18-29` | Dead |

### M. Author-specific behaviour

| # | Upstream behaviour | Where | Port |
|---|---|---|---|
| 92 | A blank button beside the GM log input calls `TryElevate`: for the author it cycles the visible role icon 0 to 3; otherwise, if config allows, the right toggle + the text "butts" + the display name `dorktoast` writes the persistent key that makes that account Janitor everywhere | `GMD:145-219`; `MP:61401,42065-42066` | Left out (10, L1) |
| 93 | Any client whose display name is `dorktoast` writes saved flags `usedToast` and `wasToast` | `PO:91-99`; `GMD:77-80` | Left out |
| 94 | "Cheater protection" (config `enableCheaterDetection`, default "false"): a player carrying `usedToast` whose name is not the author's is labelled "I AM A CHEATER", muted for others, flagged persistently, and may be immobilised and shown an exile message | `PO:467-487,513-551` | Left out (10, L2) |

---

## 3. State and messages

### 3.1 Synced variables

VRChat sync modes are taken from the prefab YAML (`_syncMethod`: 1 none, 2 continuous, 3 manual), since
some classes have no attribute.

| Variable | Type | Behaviour (sync) | Who writes, when | Read by | Port |
|---|---|---|---|---|---|
| `VarsString` | string (JSON) | `VRPGPlayerObject`, manual, one object per player owned by that player (`PO:24,38`; `PP:627`) | Owner, in `NotifyValueChanged` (`PO:257-263`). The dictionary behind it is never filled: its setter is empty (`PO:77-88,375-378`), so the value is always an empty JSON object. It only serves as a change trigger | `_OnValueChanged` on all clients (`PO:394-408`) | Dropped; user-state change events do the triggering |
| `ActualRoleIndex` | int | same (`PO:58`) | Owner, in `SetGmStatus_NVC` (`PO:306-337`), called from `GMD:89,101,112,120,207,269,277,283` | role checks (`PO:576-579`), grant guard (`GMD:231`), list labels | Per-player role leaf, see 8.4 |
| `VisibleRoleIndex` | int | same (`PO:60`) | Owner, `PO:313-330`, and `TryElevate` (`GMD:153-180`) | `UpdateRoleUi` (`PO:423-442`) | Same leaf |
| `iconIndex` | int | `IconController`, manual, child of the player object (`ICON:12,16`) | Set by whichever client runs `UpdateRoleUi`, which is every client (`PO:401-405`). Only the owner's write is sent; others just apply it locally | `SyncIcons` (`ICON:48-60`) | Derived from the role leaf; not stored |
| `configJson` | string | `VRPGConfigData`, manual (`CFG:14,51-53`) | Instance master at start, from the download (`CFG:150-156`) or the embedded copy (`CFG:158-172`); any client through the uncalled list editors (`CFG:196-236`) | `OnDeserialization` (`CFG:73-82`), `OnUpdateConfig` (`CFG:117-126`) | Settings on the element; no leaf |
| `whitelistJson` | string | `VRPGWhitelists`, manual (`WL:19-21`) | Master, from a download whose URL is empty (`MP:8404`), so never | nobody that handles it | Dropped |
| `ExileBlacklistActive` | bool | `VRPGGameMasterData`, manual in the prefab (`GMD:60`; `MP:42063`) | Never written; serialised `1` | `PO:536` | Dropped with the feature |

Commented-out synced fields (`LOG:43-45`) are not counted. `VRPGLogs` is manual-synced with nothing to sync.

One upstream detail that matters for late joiners: `CFG:73-82` rebuilds the dictionary on
deserialisation but does not re-read the special values (`Verbose`, `EnableCheaterProtection`,
`LocalCheaterKey`); only the event path does (`CFG:117-135`).

### 3.2 Network events

"All" includes the sender in VRChat. A one-shot on Altspace never returns to its sender, so the runtime
must also run the handler locally. Arguments are listed because the portkit README's
`SendCustomNetworkEvent(target, name)` has none (see 4, gap G1).

| Event (handler) | Target | Arguments | Sent from | Effect on receivers |
|---|---|---|---|---|
| `ReceiveLogNew` (`LOG:135-158`) | All | `string message, int logType` | `LOG:132` | Append to IC, OOC or GM box; IC plays the alert |
| `DoNetworkDebug` (`LOG:72-78`) | All | `string message` | `LOG:69` | Console line |
| `SyncAnnouncedGMState` (`GMD:260-287`) | All | `int id, int targetState, string key` | `GMD:248,251,254` | The client whose id matches sets its own role and staff UI. `key` is not read |
| `SyncCallST` (`GMD:438-444`) | All | none | `GMD:434` | Operators play the GM alert |
| `DoForceBring` (`GMD:524-530`) | All | `int callerId, int targetId` | `GMD:551` | The target teleports itself to the caller |
| `GoSpawn0` to `GoSpawn5` (`GMD:653-682`) | All | none | `GMD:565,592,605,618,631,644` | Every client teleports to that point |
| `GoRespawn` (`GMD:648-652`) | All | none | `GMD:579` | Every client respawns |
| `SyncSTVoiceOn`, `SyncSTVoiceOff` (`GMD:742-760`) | All | none | `GMD:733,739` | Set the GM-object owner's voice distance |
| `NotifyValueChanged` (`PO:257-263`) | Owner | none | `PO:190` (from the player list refresh, `SOC:105`) | Owner re-serialises its player object |
| `IdentifyCheater` (`PO:513-519`) | All | none | `PO:481` (master only) | The flagged player writes the persistent flag |
| `DoUpdateConfig` (`CFG:110-115`) | Owner | none | `CFG:68` (each non-master at start), `CFG:214,235` | Owner broadcasts the next event |
| `OnUpdateConfig` (`CFG:117-126`) | All | none | `CFG:114` | Re-parse config, re-run every subscriber, which re-runs role self-assignment (`GMD:67`) |
| `DoUpdateWhitelists`, `OnUpdateWhitelists` (`WL:54-65`) | Owner, All | none | `WL:38,57` | Dead path |
| `SpawnClipboard`, `DismissClipboard` (`GMT:111-119`) | All | none | `GMT:100,107` | Component is in no prefab |

Local (not networked) events: `SendCustomEvent("OnConfigDataDownloaded")` to each subscriber (`CFG:238-244`;
subscribers are the GM handler and the version check, `MP:51028`), `SendCustomEvent("OnWhitelistDownloaded")`
(`WL:148-154`).

Declared network-callable but never sent over the network: `TrySetGMState` (`GMD:221`),
`SetGMStateToSelected` (`GMD:289`), `TrySpawn0` (`GMD:556`), `TryRespawn` (`GMD:570`),
`ExileTargetPlayer` and `DoUnExile` (`GMD:396-410`, empty), `SetGmStatus_NVC` (`PO:306`).

**Trust, as upstream has it.** No handler checks who sent an event. Any client that can send
`GoSpawn0`, `DoForceBring(a, b)` or `SyncAnnouncedGMState(id, 2, "")` moves everyone, moves one player,
or makes someone an operator. The strings passed as keys (`GMD:251,254`; `PO:428,431`) are compared
nowhere that can fail: the only checks sit inside `if (target == 0)` and test `target == 1`, `2`, `3`
(`ICON:29-34`). The author's comment says the keys are there "to deter people with modded clients"
(`ICON:27`).

### 3.3 Ownership transfers

| Call | Where | Purpose upstream | Port |
|---|---|---|---|
| `Networking.SetOwner(local, Logger)` | `LOG:104`, on every send | Left over from the synced-string version of the log | Not needed |
| `SetOwner(local, GM handler)` | `GMD:732,738` | "Who is the speaking GM": receivers read the owner at `GMD:784`. The event and the ownership change race | Goes with ST Voice (No) |
| `SetOwner(local, Config)` | `CFG:198,219` | Before editing the synced config (uncalled) | Dropped |
| `SetOwner(local, Whitelists)` | `WL:108,129` | Same, dead copy | Dropped |
| `SetOwner(local, each pickup)` | `GMD:801` | `RespawnPickups`, no caller, `pickupsParent` unset (`MP` shows `pickupsParent: null`) | Dropped |
| `SetOwner(janitor, clipboard)` | `GMT:88` | Unplaced component | Dropped |

Per-player objects are owned by their player for the whole session (`PO:114-124` checks
`player.IsOwner(gameObject)`). There is no ownership transfer of player objects.

### 3.4 Timers and per-frame work

| What | Period | Where | Port |
|---|---|---|---|
| Tie re-roll | 1 s, up to 3 times | `DS:135` | `SendCustomEventDelayedSeconds` |
| Fade teleport | 1 s, then 0.1 s | `TELE:27,34` | same |
| Version check | first physics tick after config, then every 90 s (`delayClock` starts at 0) | `Scripts/Addons/WorldVersionCheck.cs:40-50`; `MP:19032` | left out |
| Clock text | every 255 physics ticks | `Scripts/Utilities/VRPGClock.cs:27-33` | left out |
| Camera render | every 1 s while target active | `Scripts/Addons/SecuCamRepeating.cs:15-24` | left out |
| Debug clipboard | every 251 frames, empty body | `GMT:62-77` | left out |
| Menu caller follows head | every physics tick | `CALLER:45-68` | not needed (no head collider) |
| Fade sphere follows head | every physics tick | `Scripts/Utilities/TrackBone.cs:29-38`; `Prefabs/FadeSphere.prefab:81` | head attachment |
| Label and map dot follow owner, label faces viewer | every physics tick, for every player object | `PO:101-112` | attachment + per-frame graph |
| Desktop key poll | every frame | `CALLER:37-43` | event |

### 3.5 Random numbers

| Use | Call | Who rolls | Port |
|---|---|---|---|
| DS attack and defence | `Random.Range(1, 21)` twice, attack first | The player who pressed ROLL, on their own client (`DS:38-39`). Receivers get only the finished text | Same: the roller rolls and sends the text |
| 5E d20 | `Random.Range(1, 21)`; two calls for advantage and disadvantage | the roller (`D5E:21,27-28,35-36`) | same |
| 5E pool | `Random.Range(1, n + 1)` per die in pool order | the roller (`D5E:95-116`) | same |
| `GetRandom` on a list | `Random.Range(0, Count)` | no caller (`UTL:176`) | not translated |

Nobody can verify a roll upstream: the result is a string typed into the log by the roller's client. The
port keeps that. A fairer roll (roller and referee each commit to a nonce) is possible with the runtime's
commit and reveal, but it would be a change, so it is only listed as question Q8.

### 3.6 Persistence keys (VRChat `PlayerData`, per account, readable by every player in the instance)

Upstream uses `PlayerData` for two jobs at once: saving across visits, and showing one player's values to
the others (any client may read another player's keys, and `OnPlayerDataUpdated` fires for everyone:
`PO:244-252`). The port splits them: **user state** for the live, everyone-can-read value and
**`localStorage`** under `pk1.rp-toolkit.<inst>.<uid>.` for the saved copy.

| Key | Type | Written | Read | Port |
|---|---|---|---|---|
| `vrpg-charName` | string | `PO:288` | `PO:384,458,566`; `SOC:68`; `PBTN:59` | user state `p.n` + saved |
| `vrpg-charTitle` | string | `PO:289` | `PO:384,497`; `SOC:69` | user state `p.t` + saved |
| `vrpg-charDesc` | string | `PO:295` | `SOC:70` | user state `p.d` + saved |
| `vrpg-options-<name>` for `togglePostProcessing`, `toggleReflections`, `toggleChairs`, `toggleImAlert` | bool | `OPT:73` | `OPT:56-58` | saved only (local options); only `toggleImAlert` and the grid survive |
| `vrpg-options-ImSlider` | float | `OPT:78` | `OPT:63-65` | saved only |
| `vrpg-voiceZone` | byte | `PO:273`; `MGR:127,134` | `VOICE:43,50` | none (No) |
| `vrpg-speakChannel`, `vrpg-listenChannel` | byte | `PO:278,283` (no caller) | `VOICE:44,51` | none |
| `vrpg-powerLevel` | byte | `PO:268` (no caller) | nowhere (`PO:500-502` commented) | none |
| `vrpg-selectedPlayer` | int | `PO:366` | nowhere | none |
| `VarsDict` | string | `MGR:142` (no caller) | `MGR:147` (no caller) | none |
| `AgreeLevel` | string | `GMD:789` (no caller) | `GMD:69` (then dereferences an unset object, `MP:42050`) | none |
| `no-TP` / `no-tp` | bool | `GMT:81` writes `no-tp` | `GMD:497,543` read `no-TP`; `GMT:52` reads `no-tp` | none (69) |
| `clippingDistanceXZTruncated` | int | `GMD:203` | `GMD:128`; `GMT:35` | none (author key) |
| `usedToast`, `wasToast` | bool | `PO:97`; `GMD:79` | `PO:470,528` | none |
| value of config `localCheaterKey` | bool | `PO:518` | `PO:527` | none |

What the difference costs the user: a saved name, title and options follow the **device**, not the
account. A player who changes headset or PC starts blank. The key includes the user id, so two accounts
on one device keep separate values.

---

## 4. Platform-call census

Counts are occurrences in the 41 own C# files with `//` comment lines removed. "README" means the item
is named in `portkit/README.md` under "Runtime shape". Gaps are numbered G1 to G9 and summed up after the
table.

### 4.1 VRChat and Udon

| API | Count | Files | Runtime equivalent, or gap |
|---|---|---|---|
| `Networking.LocalPlayer` | 76 | 17 files (`GMD` 29, `PO` 9, `MENU` 5, `CALLER` 5, `D5E` 4, ...) | README `Networking.LocalPlayer` |
| `.displayName` | 53 | 13 files (`GMD` 16, `PO` 14, ...) | `player.name` for display. Every identity test (`GMD:75-77,127,142,308-363`; `PO:133,311,462,472,489,555`; `CHR:126,139`; `PAT:125,139`; `CFG:180-194`) moves to user id |
| `.playerId` | 7 | `GMD` 6, `PO` 1 | session id (`user.id`) inside envelopes; user id for anything stored |
| `.isMaster` | 7 | `CFG:62`, `WL:32`, `PO:479`, `Scripts/Addons/WorldVersionCheck.cs:67`, `GMD:109,233,352` | First four ("one client does this job"): README `Networking.IsReferee`. Last three give a *privilege* to the instance master: **G5** |
| `.isInstanceOwner` | 1 | `GMD:233` | world owner (`isSpaceAdmin` as seen on other users) |
| `.isLocal` | 10 | 6 files | `player.isLocal` |
| `IsUserInVR()` | 1 | `CALLER:31` | `scene.IsVR()` through `Platform` |
| `Networking.SetOwner` | 9 | `LOG:104`, `GMD:732,738,801`, `CFG:198,219`, `WL:108,129`, `GMT:88` | README `SetOwner`; none is needed after the port (3.3) |
| `Networking.GetOwner`, `player.IsOwner(obj)` | 2, 1 | `GMD:784`, `PO:575`; `PO:117` | fixed owner of a per-player behaviour (**G2**) |
| `GetPlayerObjects` | 4 | `MGR:101,115`, `PO:346`, `SOC:98` | **G2** |
| `VRCPlayerApi.GetPlayerById`, `GetPlayers`, `GetPlayerCount` | 2, 1, 1 | `GMD:224,495`; `SOC:114-115` | `scene.users` through `Platform` |
| `Utilities.IsValid` | 21 | 7 files | "is this player still here" / null test |
| `[UdonSynced]` fields | 6 live | 3.1 | README `synced` (per behaviour) or **G2** (per player) |
| `RequestSerialization`, `OnDeserialization` | 5, 4 | `PO`, `ICON`, `CFG`, `WL` | README |
| `SendCustomNetworkEvent` | 24 (21 to All, 3 to Owner) | 3.2 | README, but 6 call sites pass arguments (`GMD:248,251,254,551`; `LOG:69,132`): **G1** |
| `[NetworkCallable]` | 24 | `GMD` 17, `PO` 3, `LOG` 2, `CFG` 2 | envelope type table |
| `SendCustomEventDelayedSeconds` | 3 | `DS:135`, `TELE:27,34` | README |
| `SendCustomEvent` (local) | 2 | `CFG:242`, `WL:152` | direct call |
| `PlayerData.Set*` / `Get*`, `TryGet*`, `HasKey` | 19 / 27 | `PO` 17, `GMD` 7, `OPT` 5, `MGR` 4, `VOICE` 4, `SOC` 3, `GMT` 3, `PBTN` 1 | **G3** |
| `OnPlayerRestored` | 3 | `PO:114`, `OPT:46`, `GMT:31` | local: after `localStorage` is read; remote: first user-state snapshot of that player |
| `OnPlayerDataUpdated` | 1 | `PO:244` | `user-state` change event |
| `OnPlayerJoined` | 1 | `MENU:49` | `user-joined` |
| `OnPlayerRespawn` | 2 | `PO:176`, `VOICE:24` | local only: `player-teleported` with `isSpawn`. Both uses are voice (No) |
| `OnPlayerTriggerEnter` / `Exit` | 2 / 2 | voice zone and amp components | trigger events exist for the local player; the features are No |
| `Interact` | 2 | `CALLER:70`, `Scripts/Components/Teleporter.cs:14` | `click` on a layer-5 collider |
| `GetTrackingData` | 8 | local head or hand: `MENU:87-88`, `CALLER:54,57,60`, `Scripts/Utilities/TrackBone.cs:33`, `PO:108`. Another player's head: `PO:105` | local: `Platform` pose. Remote: **G4** |
| `player.GetPosition()`, `GetRotation()` | 4 | another player: `GMD:505,512`; local: `GMT:90` | remote: **G4** |
| `TeleportTo` | 2 | `GMD:516`, `TELE:33` | `scene.TeleportTo(position, yawDegrees, true)`; only the Y rotation is used |
| `Respawn()` | 1 | `GMD:651` | `TeleportTo(spawn, yaw, true, true)`; see 8.2 `respawn` |
| `SetVoiceDistanceNear/Far`, `SetVoiceGain`, `SetVoiceLowpass`, `SetAvatarAudioGain` | 18 | `VOICE` 6, `GMD` 4, `PO` 4, voice amp 4 | **G6** |
| `SetRunSpeed` | 2 | `GMD:770,777` | **G7** |
| `Immobilize` | 1 | `PO:538` | `scene.SetCanMove(false)` exists; the feature is left out |
| `VRCStringDownloader.LoadUrl`, `OnStringLoadSuccess/Error`, `VRCUrl` | 5, 9, 5 | `CFG`, `PAT`, `CHR`, `WL`, version check | the page can `fetch` (cross-origin rules apply). Not in the `Platform` interface; add `fetchText(url)` only if `config-url` is accepted |
| `VRCJson`, `DataDictionary`, `DataList`, `DataToken` | 8, 197 tokens | 13 files (`UTL` 58, `CHR` 26, `CFG` 12, `PAT` 12, `WL` 12) | plain JSON, objects, arrays. Note `DataList.Contains` compares tokens exactly (case-sensitive): `CFG:186`, `PAT:143` |
| `VRC_Pickup`, `VRCPickup` | 5 | `GMD:24,794,799`, `GMT:15` | all in dead code |
| `UdonBehaviourSyncMode` attribute | 23 | 23 files | information for 3.1 only |

### 4.2 Unity calls the page cannot make directly

| API | Count | Files | Runtime equivalent, or gap |
|---|---|---|---|
| `Input.GetKeyDown(KeyCode.Q)` | 1 | `CALLER:41` | `key-press` event |
| `Random.Range` | 14 | `D5E` 11, `DS` 2, `UTL` 1 | runtime random source, replaceable in tests |
| `DateTime.Now` | 1 | clock | `Date` (feature left out) |
| `Animator.SetBool("isDark")` | 2 | `TELE:26,40` | relay `animBool` |
| `AudioSource.Play`, `PlayOneShot` | 4 | `LOG:144,166`, `GMD:442`, version check `:65` | `BS.AudioSource` on the kit object (`$clip`) |
| `Camera.Render()` | 1 | `Scripts/Addons/SecuCamRepeating.cs:29` | none (component unplaced) |
| `GameObject.Find`, `GetComponent*` | 2, 20 | `Scripts/Core/VRPGComponent.cs:55`, `Scripts/Systems/Common/SheetDataValue.cs:94`, ... | `bindings.json` references |
| `transform` writes | 5 per tick, 2 on demand | per tick: `PO:106,109,111`, `CALLER:67`, `TrackBone.cs:37`; on open and close: `MENU:82,90-92` | menu: `SetTransform` on open and close. Labels and fade sphere: attachment + graph |
| `Debug.Log*` | 30 | 9 files | console |
| `Regex` | 1 | `TXT:65` | `RegExp` |
| Reading or writing uGUI component state: `Toggle.isOn` (`ROLL:17`, `DS:109`, `GMD:187`, `OPT:58,73`, `GMT:54,81`), `TMP_InputField.text` (`LOG:182-195`, `DS:44-45,121-122`, `MENU:97-98,139-140`, `CHR:127`, `GMD:192`), `TMP_Dropdown.value` (`DS:53-54,123-124`, `GMD:559-638`), `Slider.value` (`OPT:65,78`), `CanvasGroup` (`LOG:215-223`), `Button.interactable` (`PBTN:44,55`, `CHR:52,109`), `Image.color` and `sprite` (`Scripts/UI/VRPGIconElement.cs:27-39`), text colour (`TXT:88-102`) | about 60 | as listed | **G8** |

### 4.3 The gaps and what each costs

| Gap | What is missing | Proposed answer | Cost to the user |
|---|---|---|---|
| **G1** | README's `SendCustomNetworkEvent(target, name)` carries no arguments; upstream sends `(string, int)`, `(int, int, string)`, `(int, int)` and `(string)` | Add `...args` (JSON in the envelope) to the runtime | None. A log line must fit one 4,096-byte one-shot, so a message is cut at about 3,500 bytes (upstream fields are unlimited) |
| **G2** | The runtime has one space-state leaf per behaviour. `VRPGPlayerObject` is one behaviour **per player**, owned by that player | A per-player behaviour kind whose `synced` fields live in that player's user state (own-write, all-read), created on `user-joined`, removed on `user-left` | A player's name, title and role disappear 30 s after they leave (upstream: when they leave) |
| **G3** | No per-account saved data | `localStorage` for the save, user state for the live value | Saved values follow the device, not the account (3.6) |
| **G4** | The page gets the local player's head and hands only. Upstream reads other players' head position every tick (`PO:105`) and their position on demand (`GMD:505`) | Labels: an object attached to each player's own avatar with `autoSync`, which the platform moves on everyone's copy. Teleport-to: ask the target and wait for its answer | Label placement depends on a platform feature not yet tried from a kit (R2). Teleport-to takes one network round trip |
| **G5** | No instance master, no host | Roles start from the space admin and a user-id list; "first player is a GM" becomes an opt-in setting | With the default settings and no admin or listed user present, nobody has GM tools. Upstream always has one Controller |
| **G6** | No voice-zone or per-player voice API. `VoiceDistanceMultiplier` is one number for the whole space and is set through `SetSettings` | None | No voice zones, no channels, no voice amplifier, no "GM heard everywhere" |
| **G7** | Walking speed is `PhysicsMoveSpeed` in `SetSettings`, which sends every setting and which a snippet must never call (README) | None within the contract | No GM speed button. Running (1.4 x) is the platform's own |
| **G8** | The page cannot read a uGUI toggle, input field, dropdown or slider, and the relay has no op for canvas-group alpha, UI image colour, text colour or `interactable` | The page owns that state. Inputs are UI-kit text fields; toggles and dropdowns become buttons with page-held state; alpha, colour and interactable are expressed with `active` and rich text (8.5) | Typing happens in fields drawn by the platform's UI kit, so those six fields look like Altspace controls, not like the rest of the menu |
| **G9** | Not an upstream call, but needed to stand in for the instance master's authority: a place only admins can write | Protected space state for the staff table (8.4). The README runtime has no protected option | Without it any client could write itself into the staff table |

---

## 5. Object model

Read from the YAML. Scripts were matched by GUID from the `.cs.meta` files. `UdonBehaviour` (the compiled
program host) sits beside every UdonSharp behaviour and is not listed again. Three component types come
from VRChat's SDK assembly and were identified by their fields: UI shape (`AllowFocusView`, `MP:94342`),
spatial audio source (`Gain`, `Far`, `Near`), and player object (`PP:679`).

### 5.1 Scene `VRPG Demo Scene.unity`

| Root object | Components | Notes |
|---|---|---|
| `Main Camera` (`SCN:729`) | Camera, AudioListener | reference camera of the descriptor |
| `Directional Light` (`SCN:5494`) | Light | |
| `VRCWorld` (`SCN:5708`) | scene descriptor, pipeline manager, 3 UdonBehaviours, a quality-settings component | The three Udon programs are referenced by GUID and are not in the repo; what they do could not be determined. Spawn is the object itself, respawn height -100 |
| `Floor` (`SCN:5952`) | MeshFilter, MeshRenderer, MeshCollider | material not in the repo |
| instance of `VRpgPlayerObject.prefab` (`SCN:128`) | | the template VRChat copies for every player |
| instance of `FadeSphere.prefab` (`SCN:457`) | | at (0, 0, -2.558) |
| instance of `VRPG Manager.prefab` (`SCN:974`) | | overrides only: `PlayerTeleTarget` (`SCN:2336`), ProBuilder mesh references, name, position |
| instance of `TeleTarget.prefab` (`SCN:5577`) | | at (-1.19, -17.9, 33.3) |

The Manager prefab also nests its own `FadeSphere` and `TeleTarget` instances, so the scene has two of
each. Nothing in the scene assigns the teleporter's animator (64 in the checklist).

### 5.2 `VRPG Manager.prefab` hierarchy (738 GameObjects, all on layer 0)

```
VRPG Manager                         VRPGManager                              MP:84747
  VRPG GM Handler                    VRPGGameMasterData                       MP:41981
    Teleport Points                  0 hosp, 1 contain, 2 containcorner, 3 Exec, 4 Dorm, 5 DClass,
                                     6 NOBOX, J Observ Special, G GMSpawn (9 empty transforms)  MP:53656
    GMAlert                          AudioSource + spatial audio              MP:35962
    IM Alert                         AudioSource + spatial audio              MP:43823
  VRPG Local Menu                    VRPGMenu, at (5.35, 3.64, 4.16), yaw -90 MP:74397
    Menu Canvas                      Canvas (world space), CanvasScaler, GraphicRaycaster, UI shape
                                     RectTransform 500 x 400, scale 0.003     MP:94238
      Game Logo                      Image (VRPG.png), text "VRpg RP System"  MP:2707
      Navigation                     7 x (Image, Button, VRPGMenuNavButton)   MP:71977
      Base GUI / CloseButton / Button
      Panels
        Top                          CharPlate (CharName, CharTitle), PlayerPlate (PlayerName, PlayerTitle)
        BottomPanel / Call ST        Button, text "Call GM"                   MP:54044
        Panel 0 - Main               Title (NameField, TitleField, Set / OOC / Off)
                                     Log (3 tab buttons; IC Log, OOC Log, GM Log: each a CanvasGroup with
                                          ScrollRect, text box, send button, input field)
                                     Actions (RPS, Spends: inactive; Dice DS)  MP:83806
        Panel 1 - Character [off]    Get Character (id field, Fetch, Load, Set name), Labels, Values
                                     (49 texts with SheetDataValue)           MP:16168
        Panel 2 - Powers [off]       14 toggles                               MP:17892
        Panel 3 - Map [off]          Sections / ew: quad MeshFilter, MeshRenderer, MeshCollider  MP:80519
        Panel 4 - Social             PlayerCount, SelectedPlayerName, Player Buttons Scroll View
                                     (GridLayoutGroup, cells 130 x 30, 84 x Button + VRPGPlayerButton
                                     + label VRPGTextElement), Result (CharName, CharTitle, CharParagraph
                                     [off]), UpdatePlayerList, GM Only (4 buttons + Give Operator [off])
                                                                              MP:34580
        Panel 5 - Options [off]      IconButtons [off], 5 toggles, ImSlider, toggleGrid, gridSlider
                                                                              MP:34619
        Panel 6 - GM [off]           ST Title Box, STVoice (On, Off, status), STSpeed (On, Off, status),
                                     Teleport (Respawn, TP0-TP5, Dropdown), Janitor [off], Feeple [off]
                                                                              MP:40363
        OperUI [off]                 Exile, Unexile, NoBoxSpawn               MP:50622
        JanUi [off]                  window, SpecialSpawn, NoTp               MP:9695
  VRPG Behaviors                                                              MP:49071
    VRPG Social Panel                VRPGSocial                               MP:95750
    VRPG Teleporter                  VRPGPlayerTeleport                       MP:62240
      FadeTarget                     ProBuilder mesh, MeshRenderer (material not in repo), scale 2
    VRPG Randomizers                 (empty)
    VRPG Logger                      VRPGLogs                                 MP:63985
    VRPG Options                     VRPGOptions                              MP:29041
    VRPG Whitelists                  VRPGWhitelists                           MP:8361
    VRPG Patrons                     VRPGPatronData                           MP:62743
    VRPG Grid                        VRPGGrid                                 MP:8824
      GridPlane [off]                ProBuilder mesh, FloorGridHex.mat        MP:14853
    VRPG Config Data                 VRPGConfigData                           MP:50967
    World version Check              WorldVersionCheck                        MP:18985
  VRPG Character                     VRPGCharacter                            MP:22749
    Module Base                      SheetModuleBase                          MP:64702
  VRPG Regions                       VRPGRegions                              MP:45477
  VRPG Menu Caller                   VRPGMenuCaller, SphereCollider (trigger, r 0.01)  MP:96079
  VRPG Voice Controller              VRPGVoiceController                      MP:18008
  FadeSphere (nested prefab), TeleTarget (nested prefab)
```

Control counts in the prefab: 141 Buttons (84 player buttons, 48 other wired, 9 unwired), 25 Toggles,
9 `TMP_InputField` (all: no character limit, single line, rich text on), 3 `TMP_Dropdown`, 2 Sliders,
7 ScrollRects, 3 CanvasGroups, 304 `TextMeshProUGUI`, 1 legacy `Text`, 273 Images, 250 UdonBehaviours,
92 `VRPGTextElement`, 49 `SheetDataValue`.

Scripts with no instance in any prefab or scene: `VRPGGameMasterTools`, `SecuCamRepeating`, `VRPGClock`,
`Teleporter`, `VRPGDynamicData`, `VRPGVoiceZone`, `VRPGVoiceAmp`, and the four empty stubs
`CharacterNameButtons`, `ColorTools`, `VRPGPersistentData`, `VRPGSocialButton`.

### 5.3 Behaviours and their serialized fields

| Behaviour (object) | Field = value or reference |
|---|---|
| `VRPGManager` (`MP:84747-84813`) | `GameName` = "Your Game Name!"; `GMData`, `Menu`, `Logger`, `VoiceController`, `PatronData`, `Character`, `Social`, `ConfigData`, `Teleporter`, `Regions`, `Options` = the eleven components above; `LocalPlayerObject` = none; `LabelColor` = (1, 0.92, 0.016); `OocLabelColor` = (0, 1, 1) |
| `VRPGGameMasterData` (`MP:41981-42066`) | `GMObjects` = [Navigation/GM, GM Log, GM log Button, Panel 4/GM Only]; `GMPickups` = []; `OperatorObjects` = [OperUI]; `GameMasterName` = "dorktoast"; titles "Janitor"/"J", "Operator"/"O", "Instance Lead"/"L"; `operatorNames`, `controllerNames` = empty lists; `gmVoiceStatus`, `gmSpeedStatus` = the two status texts in Panel 6; `teleTarget` = Panel 6 Dropdown (options "Local", "All"); `GMSound` = GMAlert; `SpawnAgreeBox`, `EnableBlacklistBox`, `ExileMessage`, `pickupsParent` = none; `TeleportPoints` = [0 hosp, 1 contain, 2 containcorner, 3 Exec, 4 Dorm, 5 DClass, J Observ Special]; `PlayerTeleTarget` = the nested TeleTarget; `noBox` = 6 NOBOX; `ExileBlacklistActive` = 1; `tehToggle` = the dice "GM Roll" toggle; `tehField` = the GM log input field |
| `VRPGMenu` (`MP:74397-74455`) | `nameField`, `titleField` = Panel 0 fields; `panels` = [Panel 0 ... Panel 6]; `MenuIsOpen` = 0; four plate texts under Panels/Top |
| `VRPGMenuNavButton` x 7 | `panelIndex` = 0 Main, 1 Character, 2 Powers, 3 Map, 4 Social, 5 Options, 6 GM |
| `VRPGMenuCaller` (`MP:96079-96169`) | `callerPosition` = 0 (Head); `offset` = (0, 0, 0); Udon interact text "VRPG Menu", proximity 0.25 |
| `VRPGLogs` (`MP:63985-64037`) | `ICLogGroup`, `ICOutputBox`, `ICInputBox`, and the same three for OOC and GM = the objects under Panel 0/Log/Logs; `ImSound` = IM Alert |
| `DiceRollerDS` (`MP:11999-12055`) | `gmToggle` (base) and `GmToggle` = the same "GM Roll" toggle; `attBox`, `defBox` = AttMod, DefMod; `attDrop`, `defDrop` = AttThreat, DefThreat (both inactive); `modLabel` = a text |
| `VRPGSocial` (`MP:95750-95805`) | `tagsLabel` = none; `playerLabel` and `selectedPlayerName` = SelectedPlayerName; `nameLabel`, `titleLabel`, `descLabel` = Result/CharName, CharTitle, CharParagraph; `playerButtonParent` = the scroll view's Content; `playerCountText` = PlayerCount |
| `VRPGPlayerButton` x 84 | `targetPlayer` = none |
| `VRPGPlayerTeleport` (`MP:62240-62285`) | `teleAnim` = **none**; `FadeTarget` = its child |
| `VRPGOptions` (`MP:29041-29100`) | `GiveFirstJoinerGM` = 1 (read nowhere in code); `VipLabelColor` (0.59, 0.59, 0.15), `OocColor`, `IcColor`, `GmColor` (0.59, 0.15, 0.59), `StaffColor` (0.72, 0.42, 0), `TempStaffColor` (0.18, 0.58, 0.59); `GameImage` = `Graphics/Textures/VRPG.png`; `InVoiceZone` 25, `OutVoiceZone` 0 (read nowhere); `optionToggles` = [togglePostProcessing, toggleReflections, toggleChairs, toggleImAlert]; `optionSliders` = [ImSlider] |
| `VRPGConfigData` (`MP:50967-51030`) | `UseRemoteData` = 1; `configDataUrl` = `https://dorktoast.github.io/Site-97/Text/SiteConfig.txt`; `EnableCheaterProtection` = 0; `LocalCheaterKey` = "milk"; `windowScaleLogKey` = "eggs"; `configJson` = the embedded default (`MP:51018`: `StaffList` 2 names, `ExileManifest` 2 names, `WorldVersion` "2.0", `enableOperators` "true", `disableGMBring` "false", `enableKeyGeneration` "false", `enableCheaterDetection` "false", `verboseDebug` "false", notice and message texts, `GameSchedule`, `Socials`); `subscribers` = [GM handler, World version Check] |
| `VRPGPatronData` (`MP:62743-62803`) | `remotePatronData` = 1; `targetUrl` = `https://dorktoast.github.io/GibGames/PatronListJson.txt`; `PatronHash` = ""; `TierColors` = 7 colours; `PatronItems` = [none]; `PatronCredits` = none |
| `VRPGWhitelists` (`MP:8361-8410`) | `whitelistUrl` = ""; `subscribers` = [GM handler] |
| `WorldVersionCheck` (`MP:18985-19036`) | `targetUrl` = `https://dorktoast.github.io/Site-97/Text/CurrentWorldVersion.txt`; `delaySeconds` = 90; `alertSource` = IM Alert; `alertClip` = a clip not in the repo |
| `VRPGCharacter` (`MP:22749-22802`) | `EnableModule` = 0; `targetUrl` = ""; `charSheet` = Module Base; `idBox`, `FetchButton`, `pleaseWaitText`, `resultText` = objects under Panel 1/Get Character |
| `SheetModuleBase` (`MP:64702-64746`) | `ValueParent` = Panel 1/Sections/Values |
| `SheetDataValue` x 49 | `TargetKey` such as `Char_Name`, `Clan`, `Physical`, `Brawl`, `Disciplines`, `CelerityRounds`; `replaceWithDots` on for 29 (the skills and the three attributes) with dot U+25CF; `isSubhash` on for Merits, Flaws, Disciplines |
| `VRPGVoiceController` (`MP:18008-18054`) | `InZone` 25, `OutZone` 0, `OutChannel` 1, `ListenAllChannels` 0 |
| `VRPGRegions` (`MP:45477-45523`) | `Regions` = three references to its own object |
| `VRPGGrid` (`MP:8824-8870`) | `GridObject` = GridPlane; `GridOffset` -1; `gridSlider` = the Options slider (-1.9 to -0.1) |
| `VRPGTextElement` x 92 | `targetKey` = "" on all |

### 5.4 UI event wiring (156 persistent calls)

Every call to a UdonSharp behaviour is `UdonBehaviour.SendCustomEvent(string)` with the method name as the
string argument. "(none)" means the call's target is unset.

| Control | Calls |
|---|---|
| Navigation: MainMenu, Character, Powers, Map, Options, GM | own `ShowPanel` |
| Navigation: Social | `VRPGSocial.UpdatePlayerList`, then own `ShowPanel` |
| Base GUI/CloseButton/Button | `VRPGMenu.CloseMenu` |
| BottomPanel/Call ST | `VRPGGameMasterData.CallST` |
| Title: Set, OOC, Off | `VRPGMenu.SetNameAndTitle`, `SetOOC`, `SetHidden` |
| Log tabs: OOC, IC, GM | `VRPGLogs.ShowOOCLog`, `ShowICLog`, `ShowGMLog` |
| Log send buttons: IC, OOC, GM | `VRPGLogs.SendLogIC`, `SendLogOOC`, `SendLogGM` |
| GM Log/TryButton (blank label, `MP:61401`) | `VRPGGameMasterData.TryElevate` |
| Dice DS: ROLL, Reset | `DiceRollerDS.NewRoll`, `ClearBox` |
| Panel 1: Load, Set name | `VRPGCharacter.TryLoadCharacter`, `TrySetName` |
| Panel 2: 10 of the 14 toggles | `GameObject.SetActive(bool)` on (none) |
| Panel 4: UpdatePlayerList | `VRPGSocial.UpdatePlayerList` |
| Panel 4: Button (0) to (83) | own `VRPGPlayerButton.SelectPlayer` |
| Panel 4 GM Only: GMTele, BringToMe, MakeController, RemoveGM, Janitor - GiveOp | `VRPGGameMasterData.TeleToSelected`, `BringToMe`, `GiveInstanceMod`, `RemoveMod`, `GiveAutoMod` |
| Panel 5: toggleGrid | `GridPlane.SetActive(bool)` |
| Panel 5: gridSlider | `VRPGGrid.UpdateGridOffset` (empty) |
| Panel 5: toggleImAlert | `IM Alert.SetActive(bool)`, `VRPGOptions.SaveOptions` |
| Panel 5: ImSlider | `IM Alert` `AudioSource.volume` (dynamic float) |
| Panel 5: togglePostProcessing | `SetActive` on (none) |
| Panel 5: toggleReflections, toggleChairs, toggleSnow | `SetActive` on (none), `VRPGOptions.SaveOptions` |
| Panel 6: ST Title Box | `VRPGGameMasterData.SetStaffTitle` |
| Panel 6: STVoice On, Off; STSpeed On, Off | `STVoiceOn`, `STVoiceOff`, `STSpeedOn`, `STSpeedOff` |
| Panel 6: Respawn, TP0 to TP5 (labels A to F) | `TryRespawn`, `TrySpawn0` to `TrySpawn5` |
| Panel 6 Janitor: CallClipbioard, Dismiss Clipboard | `ClipboardEveryone`, `DisengageClipboard` sent to the GM handler, which has no such methods |
| OperUI: Exile, Unexile, NoBoxSpawn | `ExileTarget`, `UnExileTarget` (both empty), `GoNoBox` |
| JanUi: window, NoTp | `DoChunkWindow`, `TPToggle` on (none) |
| JanUi: SpecialSpawn | `VRPGGameMasterData.GoSpawnJ` |

Unwired buttons: RPS, SpendWP, SpendBP, Panel 1 Fetch, the four Options IconButtons, FeepleButton.
No input field has an end-edit or submit call: text is only sent by its button. No dropdown has a
value-changed call: the value is read when needed.

### 5.5 `Prefabs/VRpgPlayerObject.prefab` (19 GameObjects, root inactive, `PP:576-581`)

```
VRpgPlayerObject [off]   VRPGPlayerObject, VRChat player-object component      layer 0
  Canvas                 Canvas (world space) 500 x 150 at scale 0.01           layer 10
    Labels               (rotated 180 degrees about Y)
      Icons / Streamicon [off]   Image, VRPGIconElement
      Images             IconController
        NormalImage, ControllerImage [off], AdminImage [off], JanitorImage [off]   Image (sprite not in repo)
      Text / Nameplate, Title Plate, Level, Tags   TextMeshProUGUI + VRPGTextElement
  MapDotCanvas           Canvas (world space), rotated 90 degrees about X       layer 18
    MapDot               Image (built-in knob sprite), VRPGIconElement
```

Serialized: `NameLabel`, `TitleLabel`, `LevelLabel`, `TagsLabel` = the four texts; `topImage` = Streamicon;
`MapDot` = MapDot; `Icons` = the IconController, whose `Icons` array is the four images in role order;
`otherLabels`, `otherIcons` = empty; role indices 0. Fonts: Nameplate uses the "Nameplate" font asset
(underlay on), the others the "SDF" one. No persistence component is on the prefab: saved data goes
through `PlayerData`, not through the object.

### 5.6 The other prefabs

- `Prefabs/FadeSphere.prefab` (layer 5): root with Animator (`Graphics/Sphere 1.controller`,
  `FadeSphere.prefab:48`) and `TrackBone` (`callerPosition` = Head, offset 0); child "FadeSphere Body" with
  a ProBuilder sphere (size 2, one subdivision) and `Graphics/Materials/TeleportBall.mat`.
- `Prefabs/TeleTarget.prefab`: one empty GameObject.
- `Scripts/Systems/D&D 5E/Dice 5E.prefab` (34 GameObjects): `DiceRoller5E` on the root with `gmToggle` =
  Toggle, `dicePoolBoxText` = a text, `modLabel` = ModLabel (`D5P:3018-3020`). Wiring: d20 and d2 call
  `BoxAddD20`; d12, d10, d8, d6, d4 their own; Roll `RollBox`; Clear `ResetBox`; IncMod `IncreaseMod`;
  DecMod `DecreaseMod`. d100 is inactive.

### 5.7 Animator

`Graphics/Sphere 1.controller`: one layer, one bool parameter `isDark` (default false). States: an empty
default state; "TeleportFade" (clip `Graphics/TeleportFade.anim`, speed 1), entered when `isDark` is true;
"TeleportFade 0" (same clip, speed -1), entered when `isDark` is false; back to "TeleportFade" when true
again. No exit times, transition duration 0. The clip (0.75 s, 60 samples a second, not looping) animates
`material._Cutoff` of "FadeSphere Body" from 1 to 0 and switches that object active in its first frame.

### 5.8 Audio

Two AudioSources, both 2D-style alerts with VRChat spatial audio set to gain 10, far 80, spatialisation
off: `GMAlert` (volume 0.254, no play on awake) and `IM Alert` (volume 0.2, no play on awake). Their
clips, and the version check's `alertClip`, are three GUIDs that are not in the repo. There is no music
and no other sound.

---

## 6. Assets

### 6.1 What is in the repo (outside `Scripts/Dependencies`)

| Kind | Count | Bytes | Items |
|---|---|---|---|
| Models | 0 files | | Three meshes exist only as ProBuilder data inside prefabs (fade sphere, fade target box, grid plane). The map quad uses Unity's built-in quad |
| Textures | 6 | 330,490 | `Graphics/Textures/VRPGPerlin.tif` 282,116 (256 x 256, RGBA, largest), `VRPG.png` 25,717 (1024 x 1024 logo), `Arrow1.png` to `Arrow4.png` 4,413 to 6,947 each (128 x 128 button icons) |
| Audio | 0 | | none |
| Shaders | 2 | 1,769 | `Graphics/Shaders/GridAdditive.shader` (54 lines), `Graphics/Shaders/SimpleTransparent.shader` (13 lines) |
| Materials | 3 | 6,107 | `FloorGridHex.mat` (GridAdditive), `TeleportBall.mat` (built-in Standard, cutout, black, perlin texture), `VRPGTransparent.mat` (SimpleTransparent, used by nothing) |
| Fonts | 3 TextMeshPro font assets | 6,463,999 | `Graphics/Fonts/RobotoSlab-Regular Clean.asset`, `... Nameplate.asset`, `... SDF.asset`: each about 2.15 MB of YAML holding a 1024 x 1024 single-channel atlas with 98 glyphs (ASCII 32 to 126, no-break space, zero-width space, ellipsis). They differ only in material settings |
| Animation | 1 controller, 1 clip | 10,491 | 5.7 |
| Prefabs, scene | 5 + 1 | 3,928,107 | 5 |
| Udon program assets | 40 `.asset` | | generated by UdonSharp; not used by the port |

### 6.2 Referenced but not in the repo

| Missing asset (GUID prefix) | Used by | Replacement |
|---|---|---|
| UI material `35630e38` | 292 Images across the menu, the player object and the 5E prefab | the default UI material |
| Sprite `653f402f` | the four role icons and the "Give Operator" button image | a plain disc made for the kit |
| Font assets `be95bf52` (30 texts) and `4b82cb99` (3 texts) | Character panel only | Roboto Slab, if the panel is ever shipped |
| TextMeshPro default font (LiberationSans SDF, `8f586378`) | 99 texts, including the three log boxes and the log input fields | present in any project with TMP essentials |
| Audio clips `22e0b772` (GM alert), `63ad4880` (IM alert), `973e940d` (version alert) | 5.8 | two short CC0 sounds, chosen and credited at kit build; or silence |
| Texture `8e383558` | `FloorGridHex.mat` | a generated hex tile |
| Material `e351fa82` | the Map panel's quad | a render-texture material made by the kit builder |
| Material `44e7a0ee` | `FadeTarget` | unlit black |
| ProBuilder default material `c22777d6`, ProBuilder scripts | the three ProBuilder meshes | meshes are rebuilt by the kit builder as ordinary mesh assets; the importer cannot read ProBuilder data without the package |
| Source font file `f23c08f7` | the three font assets (editor reference only) | not needed: the atlases are baked |
| Skybox, lighting data, floor material, three Udon programs | demo scene | not ported |

### 6.3 Shaders to remake for URP and Quest

| Upstream | What it does | Remake |
|---|---|---|
| `GIB/GridAdditive` (`Graphics/Shaders/GridAdditive.shader:1-54`) | Built-in pipeline CG. Samples the texture by world X and Z times `_ScaleX`, `_ScaleY`, tinted, additive (`Blend SrcAlpha One`), no depth write, no culling | A small URP unlit shader with the same properties (or a Shader Graph). Additive transparent quads are cheap on Quest at this size |
| Built-in Standard, cutout (`Graphics/Materials/TeleportBall.mat:11-23`) | Black sphere around the head whose `_Cutoff` is animated | URP Unlit or Lit with alpha clipping, rendered on both faces. The clip animates `material._Cutoff`, which URP's shaders also name `_Cutoff` |
| `GIB/SimpleTransparent` (`Graphics/Shaders/SimpleTransparent.shader:1-13`) | Draws nothing (`ColorMask 0`) | Not needed: no prefab uses its material |
| TextMeshPro distance field (`68e6db2e`, referenced by the font assets) | text | TMP's own shader, mobile variant for Quest |

### 6.4 Asset notes for the kit

- **Glyphs.** The Roboto Slab atlases are ASCII only. Altspace display names and typed chat can hold any
  character; without a fallback font those show as boxes. Upstream relies on the project's TMP fallback
  (not in the repo). The kit needs a fallback font asset with a licence that allows shipping it, and the
  dots used by the sheet (U+25CF and others, `TXT:120-131`) are not in the atlas either.
- **One canvas, 304 texts.** A log line changing would rebuild the whole canvas. The kit builder should
  put the three log boxes and the player list on their own sub-canvases.
- **Size.** Nothing here is heavy for Quest: 330 KB of textures, three 1 MB atlases (keep one, make the
  other two material presets of it), no models.

---

## 7. Translation map

Columns: total lines / statement lines. Order is porting order: each file only needs the ones above it.
Runtime work that must exist first: G1 (event arguments), G2 (per-player behaviours on user state),
G9 (a protected leaf), and `Platform` calls for local pose, key events, controller buttons, the user
list, `TeleportTo`, `IsVR`, a world option, and attaching an object to the local avatar.

| # | Upstream file | Lines | `ts/src/` | Hard parts |
|---|---|---|---|---|
| 1 | `Scripts/Core/VRPGUtils.cs` | 387 / 175 | `VRPGUtils.ts` | Only `MakeColor`, `GetColorHex`, `GetDots` and the two JSON helpers have callers; the 40 container extension methods (`UTL:98-382`) mostly have none and collapse to plain objects. `GetColorHex` multiplies 32-bit floats and rounds half to even (`UTL:29-31`): use `Math.fround` and an explicit round-half-even, not `Math.round` |
| 2 | `Scripts/Core/VRPGComponent.cs` | 57 / 20 | `VRPGComponent.ts` | The manager is found by object name (`:55`); in the port it is injected from bindings. Logging is gated on the config's verbose flag |
| 3 | `Scripts/UI/VRPGTextElement.cs` | 160 / 84 | `VRPGTextElement.ts` | The relay can set text but not read it, and `StripTags` and the `Text` getter read it back (`TXT:61-72,142-148`): keep a page-side copy. Colour (`TXT:88-102`) becomes an outer `<color>` tag |
| 4 | `Scripts/UI/VRPGIconElement.cs` | 40 / 16 | `VRPGIconElement.ts` | Image colour cannot be set through the relay: the kit carries one child per colour used (white, yellow, red) and the page activates one |
| 5 | `Scripts/Addons/IconController.cs` | 70 / 31 | `IconController.ts` | Also defines `SiteRole`. The key arguments go |
| 6 | `Scripts/Utilities/VRPGConfigData.cs` | 245 / 123 | `VRPGConfigData.ts` | The source becomes element attributes. Keep `GetValue`, `GetBool`, `IsOnConfigList` so callers translate line for line. Subscribers must still be told in the same order (GM handler first) and again when anyone joins, because role assignment hangs on it (`GMD:67`) |
| 7 | `Scripts/Core/VRPGLogs.cs` | 300 / 123 | `VRPGLogs.ts` | A bounded line buffer per log; local echo (a one-shot does not come back); the 4,096-byte one-shot limit; free text inside a relay payload whose separator is the vertical bar (R6); activating objects instead of CanvasGroup alpha |
| 8 | `Scripts/Systems/Common/VRPGRollerBase.cs`, `Scripts/Components/DiceRollerDS.cs`, `Scripts/Systems/D&D 5E/DiceRoller5E.cs` | 20 / 5, 139 / 70, 148 / 83 | `VRPGRollerBase.ts`, `DiceRollerDS.ts`, `DiceRoller5E.ts` | `int.TryParse` must be reproduced exactly (surrounding spaces and a leading sign pass; "5.0", "" and overflow fail), not `parseInt`. The tie counter is a byte. The delayed self-call is by method name. Values come from page-held fields, not from uGUI |
| 9 | `Scripts/Core/VRPGPlayerObject.cs` | 582 / 272 | `VRPGPlayerObject.ts` | The hardest file. One instance per player backed by that player's user state. `OnPlayerRestored` splits in two: the local player's restore from `localStorage`, and the first snapshot of a remote player. `FixedUpdate` (`PO:101-112`) is replaced by an avatar attachment and a label-slot pool. About 70 statement lines (cheater code `PO:467-487,513-551`, commented voice code) are not translated |
| 10 | `Scripts/Core/VRPGManager.cs` | 189 / 89 | `VRPGManager.ts` | Becomes the registry of per-player objects (`MGR:97-123`) |
| 11 | `Scripts/Core/VRPGMenu.cs`, `Scripts/Core/VRPGMenuCaller.cs`, `Scripts/UI/VRPGMenuNavButton.cs` | 168 / 77, 83 / 38, 24 / 6 | `VRPGMenu.ts`, `VRPGMenuCaller.ts`, `VRPGMenuNavButton.ts` | Open pose from the last head pose the page received (the pose stream stops while the player is still). The text-field panels must move with the menu. The caller turns into three event sources |
| 12 | `Scripts/Utilities/VRPGPlayerTeleport.cs`, `Scripts/Utilities/TrackBone.cs` | 44 / 26, 41 / 13 | `VRPGPlayerTeleport.ts`, `TrackBone.ts` | A full rotation becomes a yaw in degrees. The fade sphere rides the local head as an attachment. The animator bool goes through the relay, so its timing is not frame-exact |
| 13 | `Scripts/Core/VRPGSocial.cs`, `Scripts/UI/VRPGPlayerButton.cs` | 125 / 57, 129 / 55 | `VRPGSocial.ts`, `VRPGPlayerButton.ts` | A stable player order (sort by user id) so every client and every test agrees. Paging. A selected player who has left |
| 14 | `Scripts/Core/VRPGGameMasterData.cs` | 805 / 385 | `VRPGGameMasterData.ts` | The role decision table and the trust model of 8.4. Teleport-to as question and answer. Every handler checks its sender. About 200 statement lines are not translated: `TryElevate`, `Welp`, `IsOnGameMasterList`, ST voice, ST speed, the empty exile methods, pickups |
| 15 | `Scripts/Core/VRPGOptions.cs` | 89 / 40 | `VRPGOptions.ts` | Options are page state saved in `localStorage` |
| 16 | `Scripts/Utilities/VRPGPatronData.cs` | 190 / 80 | `VRPGPatronData.ts` | `IsPatron` on a user-id list. The list parser (`PAT:63-127`) is kept only if `config-url` is accepted. The file is not valid UTF-8 (`PAT:173` holds a Windows-1252 character): read it as such |
| 17 | `Scripts/Core/VRPGCharacter.cs`, `Scripts/Systems/Common/SheetDataValue.cs`, `Scripts/Systems/Common/SheetModuleBase.cs` | 244 / 116, 139 / 60, 45 / 16 | `VRPGCharacter.ts`, `SheetDataValue.ts`, `SheetModuleBase.ts` | Only if the character sheet is wanted (10, L6) |

Not translated (16 files, 784 lines, 314 statement lines): `VRPGVoiceController`, `VRPGVoiceZone`,
`VRPGVoiceAmp` (No); `VRPGWhitelists`, `VRPGRegions`, `VRPGGameMasterTools`, `VRPGDynamicData`, and the
four empty stubs (Dead); `WorldVersionCheck`, `VRPGClock`, `Teleporter`, `SecuCamRepeating` (left out);
`VRPGGrid` (its only live behaviour is a toggle wired straight to an object).

Size: rows 1 to 16 are 22 files, 4,035 lines, 1,868 statement lines, of which about 400 are dropped
inside the files, leaving about 1,450 statement lines to translate. Row 17 adds 192.

---

## 8. Snippet design (proposed)

### 8.1 The element

```html
<bs-snippet name="rp-toolkit" title="Roleplay Toolkit" single="true"
  description="Player menu, dice, game-master tools, in- and out-of-character logs, name labels."
  script="https://<handle>.worldspace.host/pk-rp-toolkit.js"
  position="0 1.5 0" rotation="0 0 0" scale="1" ...settings...>
  ...gizmos...
</bs-snippet>
```

**`single="true"`, because the toolkit takes over a world.** It owns things there can only be one of per
player or per space: the menu and its key, the radial-menu button, a label over every head, the staff
table, and commands that move every player. A second copy would put two labels over each player, bind
the key twice and keep two staff tables that disagree. The plan already lists this game as one of the
two single snippets.

The kit holds: the menu (trimmed as in 8.5), a pool of 32 label objects, the fade sphere and fade target,
the grid plane, two alert sound objects, the optional map rig, and a credits text (MIT notice for GIB
Games, font and sound credits) on the Options panel.

### 8.2 Settings

Flat strings, read with a fallback. Colours are `r g b` so the Inspector shows a vector field.

| Attribute | Default | Meaning | Upstream value |
|---|---|---|---|
| `position`, `rotation`, `scale` | `0 1.5 0`, `0 0 0`, `1` | Where the menu board is parked while closed | start pose, `MENU:43-47` |
| `room` | empty | instance key (README) | |
| `title-text` | `VRpg RP System` | caption under the logo | `MP:2707` |
| `game-name` | `Your Game Name!` | prefix of console lines | `MP:84799` |
| `menu-key` | `Q` | desktop key (a `BS.KeyCode` name); empty for none | `CALLER:41` |
| `radial-slot` | `1` | which of the two radial-menu slots the "RP Menu" button takes; `0` for none. A host world's own option on the same slot would hide one of the two | new |
| `menu-distance` | `0.9` | metres in front of the head | `MENU:92` |
| `hide-when-closed` | `false` | `true` hides the board instead of parking it | new |
| `labels` | `true` | name labels over players | |
| `label-height` | `0.75` | metres above the head | `PO:106` |
| `dice` | `ds` | `ds`, `5e`, or `both` (adds a switch button) | the menu ships DS only |
| `gm-title`, `gm-abbr` | `Game Master`, `GM` | role 3 | "Janitor", "J" (`MP:42036`) |
| `staff-title`, `staff-abbr` | `Operator`, `O` | role 2 | `MP:42038` |
| `lead-title`, `lead-abbr` | `Instance Lead`, `L` | role 1 | `MP:42040` |
| `gm-color`, `staff-color`, `lead-color` | `0.59 0.15 0.59`, `0.72 0.42 0`, `0.18 0.58 0.59` | role title colours | `MP:29085` block |
| `vip-color`, `ooc-color` | `0.59 0.59 0.15`, `0 1 1` | patron tint, "Out of Character" | `MP:29085,84813` |
| `staff-uids` | empty | user ids that are Operators | `StaffList` (names) |
| `no-staff-uids` | empty | user ids that can never hold a role and whose label is blank | `ExileManifest` (names) |
| `vip-uids` | empty | user ids with the patron tint | patron list |
| `credits` | empty | extra credits text | `PatronCredits` |
| `enable-operators` | `true` | | config `enableOperators` |
| `disable-gm-bring` | `false` | | config `disableGMBring` |
| `first-joiner-gm` | `false` | the first player in the instance becomes Instance Lead | `GMD:109` (always on upstream) |
| `teleport-points` | `0` | how many of A to F are shown (0 to 6) | 6 |
| `tp-a` ... `tp-f`, `tp-a-yaw` ... `tp-f-yaw` | `0 0 0`, `0` | the six points | `MP:42052` |
| `tp-exile`, `tp-exile-yaw` | `0 0 0`, `0`; used when `exile-room` is `true` | the operators' "Exile Room" | `noBox`, `MP:42061` |
| `exile-room` | `false` | show that button | |
| `respawn`, `respawn-yaw` | empty | Empty: where the platform last spawned this player (taken from the `player-teleported` event with `isSpawn`), else the parked position | VRChat respawn |
| `grid`, `grid-position`, `grid-size` | `true`, `0 0.02 0`, `20 20` | the hex floor grid of the Options panel | `MP:14853` |
| `map`, `map-center`, `map-size` | `false`, `0 0 0`, `60 60` | the map view (R5) | not in repo |
| `alert-volume` | `0.2` | start volume of the alert | `MP:43823` block |
| `log-lines` | `60` | lines kept per log | unlimited |
| `windows`, `android` | empty | bundle addresses for tests (README) | |

Not settings: the author's URLs, the cheater keys, `enableKeyGeneration`, the world version.

### 8.3 Gizmos

```html
<bs-gizmo type="position" attribute="position"/>
<bs-gizmo type="plane"    attribute="position" size="1.5 1.2"/>
<bs-gizmo type="position" attribute="tp-a"/>   <bs-gizmo type="sphere" attribute="tp-a" radius="0.3"/>
  ... the same pair for tp-b to tp-f and tp-exile ...
<bs-gizmo type="position" attribute="grid-position"/>
<bs-gizmo type="plane"    attribute="grid-position" size="20 20" rotation="90 0 0"/>
<bs-gizmo type="position" attribute="map-center"/>
<bs-gizmo type="box"      attribute="map-center" size="60 40 60"/>
```

A gizmo's size is written in the markup and cannot follow a setting, so the grid and map outlines show
the default sizes only.

### 8.4 Who counts as game master

Upstream trusts every client and names staff by display name. The port names them by user id and uses the
two things on the platform that a client cannot fake: protected space state (only the world's owner,
community owners and moderators, and SideQuest admins can write it) and a player's own user state (only
that player can write it).

| Role | Upstream rule | Port rule |
|---|---|---|
| 3 Game Master | display name equals `GameMasterName` and a saved key (`GMD:125-138`) | A player whose client can write protected space state. On join, a client whose `isSpaceAdmin` is true writes its own id into the protected `staff` leaf; the write only succeeds for real admins, and everyone can read the result. The world's owner is also recognised directly, since other clients see `isSpaceAdmin` on the owner and `fromAdmin` on the owner's one-shots |
| 2 Operator | on `StaffList`, or granted by a Game Master (`GMD:96-106,300`) | on `staff-uids` (the attribute is the same for every client), or written into the protected `staff` leaf by a Game Master |
| 1 Instance Lead | the instance master, or granted by any staff member (`GMD:109,302`) | granted by a staff member: the grant is stored in the **granter's** own user state and counts while the granter is present and holds at least that role. With `first-joiner-gm`, also the first player as the referee records it (as built: in the referee's own user state, 0.7) |
| 0 | everyone else, and anyone on the exile list | everyone else, and anyone on `no-staff-uids` |

- A client works out every player's role from those sources alone. A role a player writes about itself is
  used for display only when the sources agree.
- Every command (grant, bring, teleport everyone, respawn everyone) is obeyed only if the sender's role,
  worked out this way, allows it. This is stricter than upstream (10, C3).
- The guard of `GMD:233` is kept: no granting above your own role, nothing above Operator by grant, and an
  Instance Lead cannot change the world's owner.
- Known weaknesses, stated rather than hidden: `first-joiner-gm` rests on the referee, which no server appoints (as
  built the record is in the referee's own user state, so only the referee can write it; upstream's equivalent is
  decided by VRChat's servers). A grant made
  by a non-admin ends 30 s after that granter leaves. Role 3 for a moderator shows up only after their
  protected write has arrived.

### 8.5 Driving the uGUI menu

The upstream menu is kept as a uGUI canvas in the kit, because its look, its layout and its rich text
(coloured names and dice results in TextMeshPro) come over unchanged. The UI kit could not show those:
its controls print tags as written.

**Page to menu** uses the relay ops that exist: `text` for the roughly 40 changing texts plus two per
list row and per label, `active` for panels, tabs, check marks, staff-only blocks and icon variants,
`animBool` for the fade. The menu's pose is set with `SetTransform` on the menu root, found by path.

**Menu to page:**

| Upstream control | In the kit | How the page learns of it |
|---|---|---|
| Buttons (48 wired + player rows) | kept | The kit builder reads each button's persistent call (5.4) and writes one `events` entry `{object, kind: "uiButton", behaviour, method}`: the wiring comes over mechanically. The relay graph gets one click listener per entry and calls back into the page the way the `clock` op does. If a canvas loaded from a bundle does not get pointer clicks in the app (R1, spike S6 has no result yet), the builder instead adds a box collider the size of the button on layer 5 and uses kind `click` |
| Player list, 84 rows in a scroll view | 32 rows, no scroll view | rows are buttons; two page buttons move through longer lists |
| Toggles (GM roll, IM alert, grid) | a button with a check-mark child | the page keeps the boolean and switches the check mark with `active` |
| Dropdown Local / All | one button that shows the current choice | the page keeps the value and sets the button's text |
| Volume slider | minus and plus buttons, steps of 0.1 | the page sets `volume` on the alert's `BS.AudioSource` |
| The seven live input fields (name, title, IC, OOC, GM, attack and defence modifier) | the uGUI field is removed, its background stays as a frame | A `BS.UIPanel` child of the menu carries a `BS.UIKitTextField` over each frame. The page keeps the latest `OnChange` value; clearing a field after sending is a plain `value = ""`. In a headset the app opens its keyboard when a field is selected |
| Log scroll views | fixed boxes showing the newest lines that fit | up and down buttons move through the kept lines |
| Threat dropdowns (inactive upstream) | cycle buttons, inactive | |

Things the relay cannot do and how each is avoided: CanvasGroup alpha (activate the object instead),
`Button.interactable` (hide the row), image and text colour (rich text, or a pre-coloured child), reading
any value back (the page is the source of truth). One relay change is needed: the `text` op must take
everything after the third separator as the text, or encode it, because chat text can contain `|`.

All text that players type is clamped before use (name 64 characters, title 128, a log line 500) and
control characters are removed. Rich text: names of non-staff are stripped as upstream does (`TXT:61-72`, but only
the menu's own Out-of-Character name keeps its colour); everything else a player wrote (staff names, titles,
descriptions, log lines, the player list and the selected player's card) keeps only `<color>` (opaque), `<b>` and
`<i>`, closed at the end of the text, and loses every other tag (10, C6). As first built, the filter missed tags
with spaces or hyphens and tags formed by removing others, the list and card were not filtered, and any name holding
"Out of Character" kept all its tags (review finding 4, fixed in 0.7).

### 8.6 Where state lives

| Kind | Key or type | Content | Writer |
|---|---|---|---|
| User state, 4 leaves (the README limit) | `p` | `{n, t, d}`: name, title, description, as one JSON string | the player |
| | `r` | actual and visible role, for display | the player |
| | `g` | roles this player has granted: `{uid: role}` | the player |
| | `s` | label slot index | the player; two claims on one slot are settled by user id |
| Space state, protected | `staff` | `{uid: {r, by}}` | admins only |
| Space state, public | `ref` | the runtime's referee | runtime |
| | `fj` | first joiner, only with `first-joiner-gm` | first client, honest-client rule |
| One-shots | `log` | `{k: 0 IC, 1 OOC, 2 GM, m: text}` | anyone |
| | `dbg` | console line | anyone |
| | `role` | `{to, s}`: tells a player their role changed, so their own menu updates at once | staff |
| | `call` | Call GM | anyone |
| | `where`, `here` | teleport-to question and answer `{to, q, p, y}` | staff asks, target answers |
| | `bring` | `{to, p, y}`: the caller's position and yaw | staff |
| | `tp`, `rs` | everyone to point n; everyone respawns | staff |
| `localStorage` | `pk1.rp-toolkit.<inst>.<uid>.` + `name`, `title`, `desc`, `opt.imAlert`, `opt.volume`, `opt.grid` | saved copies | the page |

No behaviour needs a referee-written leaf. The referee is only used for `fj`.

### 8.7 Each user action, in VR and on desktop

| Action | VR | Desktop |
|---|---|---|
| Open or close the menu | The "RP Menu" button on the radial menu (`BS.WorldOption`); or the left controller's secondary button (`button-pressed`; the SDK docs list no app function for that button); or point at the parked board and click its Open button | `Q` (setting); or the radial-menu button; or click the parked board |
| Press any menu button, choose a player, switch tabs | point and pull the trigger | mouse click |
| Type a name, title, chat line or modifier | select the field; the app's keyboard opens; press the field's Set, Log or ROLL button to act | click the field and type; then click the button. Keys typed into a field do not reach the page, so typing `q` does not close the menu |
| Roll dice | ROLL button | same |
| Read the logs | newest lines are shown; up and down buttons | same |
| Send to the GM log only | the "Roll to GM only" check button | same |
| Call a GM | "Call GM" at the bottom of the menu | same |
| GM: teleport to, bring, give or remove GM | select the player in Social, then the button | same |
| GM: teleport A to F, respawn, Local / All | GM panel buttons | same |
| Change alert volume, alert on or off, grid | Options panel buttons | same |
| Be teleported by a GM | automatic: fade, move, clear | same |
| See other players' labels | always, above each head, facing you | same |

The menu stays where it opened and does not follow the player, as upstream (`MENU:73-93`).

---

## 9. Test plan

### 9.1 Golden vectors (upstream C# compiled with `dotnet` against stubs; nothing was compiled for this analysis)

The upstream files are linked into a console project unchanged, with a `stubs/` folder beside it.
`UnityEngine.Random.Range` is a scripted queue so each vector lists the numbers it consumed.

| Area | Functions | Vector inputs | What is compared |
|---|---|---|---|
| Text helpers | `Utils.MakeColor`, `GetColorHex`, `GetDots` (`UTL:22-62`) | colours including channel values that land on .5 after x 255; counts 0, 1, 5, 6, 10, "x" | exact strings |
| Tag stripping | `VRPGTextElement.StripTags`, `SetText` with styles (`TXT:61-72,111-140`) | plain, nested tags, unclosed `<`, text containing "Out of Character" | resulting text |
| DS dice | `DiceRollerDS.NewRoll`, `Roll`, `DoTieReroll`, `ClearBox` (`DS:26-137`) | every pair of (attack, defence) rolls in {1, 2, 10, 19, 20} with modifiers "", "0", "3", "-2", " 4 ", "+1", "5.0", "abc"; threat 0 to 2; GM toggle on and off; a three-tie sequence | the log line, which log it went to, whether a re-roll was scheduled |
| 5E dice | `Roll20`, `Roll20Advantage`, `Roll20Disadvantage`, `GetModString`, `RollBox`, `SetMod` (`D5E:19-146`) | pools of 0, 1 and 6 dice; modifiers -3, 0, 4 | the message before and after `SendLog`'s prefix |
| Log formatting | `VRPGLogs.SendLog` (`LOG:100-133`) | each type, raw and not, empty text, text with line breaks | the string handed to the event |
| Player list | `GenerateButtonContent`, `GiveModAbbreviation` (`PBTN:79-127`) | names "", " ", "Ann", "<color=red>x</color>"; roles 0 to 3 | label text |
| Roles | `OnConfigDataDownloaded`, `TrySetGMState`, `IsOnAutomodList`, `ShouldBeController`, `IsOnNoOpList`, `GiveModeratorLabelColor` (`GMD:67-123,221-258,306-377`); `SetGmStatus_NVC`, `UpdateRoleUi`, `IsMod`, `IsOperator`, `IsController` (`PO:306-337,423-442,576-579`) | the full table of (on staff list, on exile list, master, current role, `enableOperators`) and of (caller role, target role, target is owner, requested role) | resulting roles, which UI groups are on, refused or sent |
| Config | `GetValue`, `GetBool`, `IsOnConfigList` (`CFG:84-108,180-194`) | the embedded default document; names in mixed case | values; list membership (shows that entries must be lower case to match) |
| Patrons | `CreatePatronList`, `IsPatron` (`PAT:63-152`) | three tiers, entries with and without `$` | credits text, membership |
| Character sheet (only with L6 reversed) | `GenerateNewCharacterDictionary`, `TryLoadCharacter`, `CreateSubHash`, `DecodeSubHash`, `SheetDataValue.*` | a small character list | field texts, permission result |

Stubs needed: `UdonSharpBehaviour` and its attributes; `VRCPlayerApi`, `Networking`, `Utilities`;
`PlayerData`; `VRCUrl`, the string downloader; `Debug`, `Mathf`, `Color`, `Vector3`, `Quaternion`,
`GameObject`, `Transform`, `AudioSource`, `Animator`; `TextMeshProUGUI`, `TMP_InputField`, `TMP_Dropdown`,
`Toggle`, `Slider`, `Button`, `Image`, `CanvasGroup` as plain holders. The data containers
(`DataDictionary`, `DataList`, `DataToken`, `VRCJson`) are the delicate stub: role and patron vectors
depend on their equality and type rules. If the VRChat SDK assembly is on this machine it can be
referenced for generating vectors without being committed (Q13); otherwise the stub is written from the
documented behaviour and those vectors are marked as stub-dependent.

The port's deliberate changes (sender checks, user ids, the fixed 5E loop) are not in the vectors. Each
gets its own Node test instead.

### 9.2 Node scenarios (several clients on the fake room, virtual time)

| # | Scenario | Passes when |
|---|---|---|
| N1 | A (admin) and B join; B sets name and title; C joins later | all three compute the same roles and see B's name and title; C's logs are empty |
| N2 | B sets a name with tags; A (operator) does the same; B presses OOC | B's label is stripped, A's keeps its colour, the OOC label keeps its colour |
| N3 | IC, OOC and GM lines from different players, one empty, one of 5,000 characters, one containing a vertical bar and a line break | every client's three buffers match; empty sends nothing; the long one is cut; the IC alert flag fires once per IC line |
| N4 | DS rolls with a scripted random source, including three ties | lines equal the golden vectors; the re-roll comes exactly 1 s later; the fourth line is the "Too many rerolls" text |
| N5 | 5E pool roll, GM-only on and off | lines equal the vectors; GM-only lines reach the GM buffer |
| N6 | A makes B an Instance Lead; B makes C one; B tries to make C an Operator; C tries to remove A; a non-staff D sends a forged `role` one-shot and writes itself into a public leaf | first two succeed everywhere; the rest change nothing on any client |
| N7 | B (lead, granted C) leaves; 30 s pass | C keeps the role during the grace and loses it after |
| N8 | Teleport-to, bring, A to F on Local and on All, respawn; `disable-gm-bring`; a second request during a fade | each client's recorded `TeleportTo` calls and their virtual times (1.0 s, then clear at 1.1 s); the refused cases record none |
| N9 | Call GM with one operator, one lead and two players present | only the operator's alert flag fires; all GM buffers get the line |
| N10 | A client drops and resumes inside 30 s, and another after 40 s | the first keeps name and role with no flicker; the second is rebuilt from `localStorage` |
| N11 | 24 players join in random order and set names in the same tick; players leave in random order; the referee leaves | label slots are unique; the list shows everyone; no write is refused by the rate limit |
| N12 | Two instances of another game plus this one in one room | no key, one-shot or object id of one is touched by another |

### 9.3 Play mode, one player

A hand-written `<bs-snippet>`, the script and the bundle served locally; a scenario bot; PASS and FAIL
lines read from the console log (port 42068 must be free).

1. Kit loads, every binding resolves, every `events` entry has its object.
2. `Q` opens the menu 0.9 m in front of the camera; the close button parks it.
3. Each nav button leaves exactly one panel active.
4. Text typed into the Name and Title fields, then Set: header plates and the local label show them.
5. OOC and Off presets.
6. A DS roll with a fixed random seed puts the expected line in the OOC box; with GM-only it goes to the GM box.
7. An OOC, an IC and a GM line appear in their boxes; the IC line plays the alert.
8. Teleport A: the fade bool goes on, `player-teleported` reports the point within 2 cm, the fade bool goes off, the menu is closed.
9. Options: alert off silences step 7's sound; the grid appears; values survive a page reload.
10. The bundle check and the visual-scripting check of rung 2 report nothing.

### 9.4 Local Multiplayer, two players

1. Both pages reach the same digest of roles, names and titles.
2. Player 2's label object, read on player 1's page, sits within 10 cm of player 2's head + 0.75 m and
   faces player 1 (this is the test of R2).
3. A line sent by one appears on the other, once.
4. Player 1 (staff, by a test-only override, see R9) brings player 2: player 2's position changes to
   1.5 m in front of player 1.
5. Teleport-to in the other direction.
6. Player 1 grants and removes a role: player 2's GM nav button appears and disappears.
7. Player 2 reloads: names and roles return, the logs are empty, the label slot is the same or a free one.

Not testable before a world is public or Shane tries it in a headset (rung 5): the app keyboard on a
UI-kit field, the radial-menu button, the controller button, uGUI clicks in the app, Quest frame time
with 20 labels.

---

## 10. Changed or left out, then risks and questions

### 10.1 Changed

| # | Change | Reason |
|---|---|---|
| C1 | Staff, exile and patron lists hold user ids, not display names | Display names are not identities; the plan says so |
| C2 | Role 3 is the space admin; the title "Janitor" becomes a setting with default "Game Master" | The upstream top role is the author's own account (`MP:42035`) |
| C3 | Every command checks the sender's role before acting | Upstream checks nothing (3.2). A snippet runs in other people's public worlds |
| C4 | The first player is not a GM unless `first-joiner-gm` is set | There is no instance master, and the nearest substitute rests on honest clients (Q2) |
| C5 | Saved data is per device | G3 |
| C6 | Everything a player writes that others see keeps only `<color>` (no alpha), `<b>`, `<i>`, and they are closed at its end; a non-staff name keeps none, except the menu's own Out-of-Character name | One `<size=9999>` (or an unclosed `<color=#00000000>`) in chat would wreck everyone's log. Upstream leaves titles and lines raw |
| C7 | Logs keep the last 60 lines; a line is cut at 500 characters | Relay and one-shot limits; a text mesh has a vertex limit |
| C8 | Teleport-to takes a round trip | G4 |
| C9 | The fade animator is wired | Upstream's is unset, so its A to F teleports cannot finish (`MP:62284`) |
| C10 | The menu starts on Main only; the player list also refreshes on join and leave; staff rows are orange | Upstream prefab and code slips (checklist 8, 48, 50) |
| C11 | 5E: the pool-text loop stops at the last element; d20, advantage and disadvantage get buttons | `D5E:129`; `D5E:19-39` are unreachable upstream |
| C12 | Scroll views become paged boxes; toggles, the dropdown and the slider become buttons | G8 |
| C13 | Input fields are UI-kit fields | Text entry on the platform goes through its UI kit |
| C14 | Head-click to open becomes a radial-menu button and a controller button | Checklist 3 |
| C15 | Missing sounds, sprite, grid texture and UI material are replaced by new ones | 6.2 |
| C16 | Config comes from the element's settings, not from a download | L4 |

### 10.2 Left out

| # | What | Reason |
|---|---|---|
| L1 | `TryElevate`, `Welp`, the `GameMasterName` check, the saved key 4256, the blank button, the "butts" phrase (`GMD:125-219`) | An author back door: one named account becomes the top role in every world that uses the prefab |
| L2 | "Cheater protection" and the `usedToast` / `wasToast` flags (`PO:91-99,467-487,513-551`; `GMD:77-80`) | A persistent, public shaming mark tied to the author's account, off by default upstream and switchable from the author's remote config. Also needs per-account storage and voice control that do not exist here |
| L3 | World version check (`Scripts/Addons/WorldVersionCheck.cs`) | It polls the author's site for the author's own world |
| L4 | The author's URLs (`MP:19029,51012,62788`) and the embedded default document with its four names (`MP:51018`) | The shipped prefab takes its staff and exile lists from the author's site: whoever edits that file is staff in your world. The names are other people's accounts |
| L5 | Voice zones, channels, voice amplifier, ST Voice (checklist 66, 80 to 82) | No API (G6). The plan already says so |
| L6 | Character sheet and the Powers panel (checklist 79; `MP:16168,17892`) | Off by default upstream, needs a JSON file hosted somewhere, and its layout and labels are another publisher's game terms (Q3) |
| L7 | ST Speed (checklist 67) | Needs `SetSettings` (G7, Q11) |
| L8 | Exile and Un-Exile buttons, the no-teleport toggle, Regions, the clipboard buttons, Whitelists, Level and Tags lines, the stream icon, the grid slider, PostProc / Reflections / Chairs / Snow toggles, RPS and Spend buttons, the Icon Colour buttons, Feeple | Empty methods, unset targets or no caller upstream (checklist: Dead) |
| L9 | `Teleporter`, `VRPGClock`, `SecuCamRepeating`, `VRPGDynamicData` | In no prefab or scene. The platform has its own teleporter |
| L10 | The demo scene (floor, light, skybox, three unknown Udon programs) | Replaced by the showcase scene |
| L11 | `Scripts/Dependencies/UdonToolkit` | Inspector attributes only |

### 10.3 Open risks, ranked

| # | Risk | If it goes wrong |
|---|---|---|
| R1 | **uGUI from a kit bundle.** Nothing yet shows that a world-space canvas loaded from a bundle gets pointer clicks in the app, or that a graph can hear a uGUI button there. Spike S6 has no result (`portkit/spikes/RESULTS.md` does not exist yet) | Fall back to a layer-5 collider per button and `click` events. It costs about 90 colliders and loses nothing visible |
| R2 | **Labels over other players** (as built since 0.8: an autoSync head attachment of an attachable kit object, a billboard canvas; after 0.7 the label's synced transform carried it; checked in Local Multiplayer; the rest of this row is the analysis). The design relies on `BS.AttachedObject` with `autoSync` on pool objects whose network ids the script sets: untested from a kit, including whether a late joiner sees existing attachments. An object on the head bone also tilts with the head, so a per-frame graph must hold the label upright at head + 0.75 m and turn it to the viewer, using only allow-listed members | Fallback: each player publishes a rounded head position in user state about twice a second and labels glide between samples. Coarser, and it uses the user-state rate budget |
| R3 | **Runtime contract.** This port needs three things the README does not have: event arguments (G1), per-player behaviours on user state (G2), a protected leaf (G9) | Without G2 and G9 the toolkit can only copy upstream's trust-everyone model, which is not acceptable in a public world |
| R4 | **Two UI systems on one board.** UI-kit text fields laid over a uGUI canvas: alignment at any menu pose, draw order, which system takes the pointer; the app keyboard; typing in Play mode | Fallback: one separate UI-kit "typing bar" under the board holding all seven fields |
| R5 | **The map.** Upstream's map is not reproducible from the repo. A new one needs a second camera into a render texture inside a kit bundle (untested), dots on a layer the host world does not use, and a second render on Quest while the panel is open | Ship with `map="false"` as the only tested state until a spike passes (Q4) |
| R6 | **Relay text.** Separator characters in free text, the unknown size limit of a `SendToVisualScripting` payload, and the cost of rebuilding a canvas on every log line | Encode text; split logs onto their own canvases; cap lines (C7) |
| R7 | **Admins other clients cannot see.** `isSpaceAdmin` on other players only covers the world's owner, and a modified client can claim it locally. The protected-write registration in 8.4 answers both, but it depends on protected writes working from a snippet in someone else's world, signed in | Only the world's owner and `staff-uids` would be verifiable |
| R8 | **One-shots are not stored.** A player still loading misses log lines and a "teleport everyone" | Same as upstream for late joiners; accepted |
| R9 | **Testing roles in the editor.** What `isSpaceAdmin` and protected writes do in Play mode and Local Multiplayer is unknown | A test-only override is needed, honoured only when the page is served from the local address, and checked not to ship |
| R10 | **Capacity.** Label and list pools are 32; the platform's default is 20 per instance but a world can raise it | Players past 32 get no label and need list paging; make the pool size a kit-build constant |
| R11 | **Characters outside ASCII** in names and chat need a fallback font that may be shipped | Boxes instead of letters until one is added |
| R12 | **`Q`** is also the desktop grapple key | `menu-key` setting |

### 10.4 Questions, ranked

| # | Question | Proposed answer |
|---|---|---|
| Q1 | Confirm L1, L2, L3 and L4 are removed, not ported | Remove all four |
| Q2 | Should the first player in an instance get GM tools (upstream always does)? | Off by default, opt-in setting |
| Q3 | Character sheet and Powers panel: leave out, or ship a neutral sheet with new labels? | Leave out of the first version |
| Q4 | The map: build the new camera map now, or ship without one? | Without, until the R5 spike passes |
| Q5 | Is a `config-url` setting wanted, so a world owner can host their own lists as JSON? | No for the first version: settings only |
| Q6 | Should GM-log lines be sealed to staff, instead of hidden as upstream does? | Hidden, as upstream; revisit |
| Q7 | The no-teleport flag is broken upstream (two spellings, unplaced toggle). Port a working opt-out? | Leave out |
| Q8 | Dice are rolled and reported by the roller, unverifiable. Add commit and reveal with the referee? | No: keep upstream behaviour |
| Q9 | `D5E:129` reads past the end of the pool. What VRChat does there was not determined. Is fixing the bound acceptable without knowing? | Yes |
| Q10 | The roller's name "D&D 5E" and the labels of the left-out panels are other companies' marks. Rename the roller in the UI to "d20"? | Yes; file names keep the upstream names |
| Q11 | May a `single` snippet call `SetSettings` for GM speed? The README says never | No |
| Q12 | Default role titles "Game Master", "Operator", "Instance Lead", and the slug `rp-toolkit` | As written |
| Q13 | Is the VRChat SDK available on this machine as a compile-time reference for vector generation? | If not, stubs, with the affected vectors marked |

### 10.5 Things that could not be determined

- The Unity and SDK versions (1).
- What the three Udon programs on `VRCWorld` do, and what the nine missing assets look or sound like.
- What the map showed.
- The contents of the three remote files the prefab points at. They were not fetched.
- Whether VRChat halts a behaviour or returns an error value at `D5E:129`, and so whether the 5E roller
  works upstream at all.
- Whether uGUI events, avatar attachments from a kit, and protected writes from a snippet work in the app
  (R1, R2, R7): no spike result exists yet.


