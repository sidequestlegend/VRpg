# rp-toolkit: test evidence

Everything here ran on 2026-11-24 on Windows, Unity 6000.3.21f1, Creator SDK 4.0.29, in the Unity editor. Nothing ran
in the Altspace app, on a Quest, or with controllers (rung 5: not run; worlds stay Private).

How to run each rung again:

```
cd altspace/ts && npm test                                                    rungs 0 and 1
portkit/tools/remote.sh altspace menu "PortKit/Kit/Check"                    rung 2 (Logs/portkit_check.txt)
altspace/playtest/run.sh single                                              rung 3
portkit/tools/remote.sh altspace menu "PortKit/Multiplayer/Activate Player 2"
altspace/playtest/run.sh multi                                               rung 4
```

`playtest/run.sh` is `portkit/tools/playtest.sh` with `?v=<sha1>` put on the page's script addresses first: the
Play-mode browser keeps a script it has fetched by its address (KitPlayTest versions only the bundles').

## Rung 0: static

`npm run typecheck` (tsc, strict) and `npm run lint` (only the platform adapters touch the page or the clock): clean.

```
lint: src, portkit/src clean (page and clock rules)
```

## Rung 1: Node (no Unity)

`npm test` in `altspace/ts`: **21 tests, 21 pass, 0 fail**, on the bindings the kit builder wrote (not the provisional
ones). The dice vectors (`vectors/dice.json`, 13 DS and 8 d20) are derived by hand from the upstream C# with line
references (no golden vectors from compiled C#: PORT.md 0.5). What each test shows is in PORT.md 0.1; added in this
phase:

```
ok - each label sits over its player's published head, on every client; the alert volume reaches the audio source
ok - DS roller: every vector ... (now also: with dice="both" the switch shows one roller at a time)
```

and every forged-event check now runs against the runtime's `networkCallable` lists (a method a class does not list
is refused by name on the receiver; the handlers that act still check who sent them).

## Rung 2: the kit in edit mode (`PortKit/Kit/Check`)

```
PASS graphs: the SDK's check found 0 nodes the app will not run
PASS rp-toolkit bindings: 353 objects resolve by path; hash matches (c41f1ea0a7424a4fb283a87e7c8b97d01192a91c)
PASS rp-toolkit android bundle: PASS Kind=Pass Reasons=[] Reports=[] Stats=files 1 (format 22), scenes 0, objects 1093/2894, behaviours 1076, scripts 16, ... graph blobs 12 (871 KiB)
PASS rp-toolkit windows bundle: PASS Kind=Pass Reasons=[] Reports=[] Stats=files 1 (format 22), scenes 0, objects 1093/2895, behaviours 1076, scripts 16, ... graph blobs 12 (871 KiB)
DONE
```

Kit build (`Logs/portkit_kits.txt`): 640 objects, 353 bound, 351 refs, 26 behaviours, 76 events; 375 stand-in, project
or missing scripts stripped; 157 texts drawn with the kit's Roboto Slab. The relay graph: **1,608 units, 338 control
and 1,464 value connections, 51 distinct members, all on the allow list of 29,061**, relaying 75 events (68 uGUI buttons,
7 text fields). Bundles (final): Android 1,268 KiB, Windows 1,310 KiB, each with the third-party notices inside; of that the
graph blobs are 871 KiB (decompressed). See PORT.md 0.6 for the buttons decision.

Artifacts (`PortKit/Kit/Export Artifacts`, `altspace/dist/`, not committed): `android/rp-toolkit` (1,299,658 bytes, sha1
`67ff69ef...`), `windows/rp-toolkit` (sha1 `0f91af75...`), `pk-rp-toolkit.js` (MIT header of GIB Games),
`rp-toolkit.jpg` (the board; `PortKit/RpToolkit/Take Menu Photo`, since the generic photo frames the 20 m floor grid),
`rp-toolkit.snippet.html` (`single="true"`, the settings with their defaults, `position="0 1.5 0"`, a 20 x 20 m box
gizmo), `manifest.json` (checks android PASS, windows PASS, bindings `c41f1ea0...`). Rungs 3 and 4 below ran on
exactly these bundles.

## Rung 3: Play mode, one player (`playtest/single.json`)

A hand-written `<bs-snippet name="rp-toolkit" ... single="true" dice="both" position="0 1.5 2">` with the built script
and both bundles from the test's local server, and `Assets/WebRoot/playtest/rp-playtest.js`, which drives the board
through the SDK's desktop player with portkit's InputSim (a mouse and a keyboard of the test's own; uGUI buttons are
clicked through the canvas's GraphicRaycaster as a person's mouse is) and reads Unity back with the `probe` command.
**Typing:** InputSim's keyboard cannot type into a `TMP_InputField` (it reads IMGUI events, which Input System state
events do not make), so the game's `type` command (`Assets/Kit/Editor/RpTestCommands.cs`) hands each character to the
field's own key handling (`TMP_InputField.ProcessEvent`); the field is focused first by a real mouse click and left by
the next click (the Set or Log button), which is when the relay graph reports it. **RESULT 17 passed, 0 failed; 0
console error lines** (`playtest/evidence_single.txt`, picture `playtest/evidence_single_board.jpg`).

```
PASS the kit loads from a hand-written bs-snippet and the instance starts: after 5.x s
PASS the board is parked with the Main panel only, caption from the setting: main True, social False, caption 'VRpg RP System'
PASS Q opens the menu 0.9 m in front of the head (MENU:73-93): open true, board 0.000 1.555 0.899, head 0.000 1.600 0.000, 0.900 m; parked was 0.000 1.500 2.000
PASS name and title typed into the fields reach the page (field events) and Set stores them: ... "charName":"Sir Test","title":"Knight of Play","slot":0 ...
PASS the header plates show them in Unity (relay op text): 'Sir Test' / 'Knight of Play'
PASS the player's own name label shows them: slot 0: 'Sir Test' / 'Knight of Play', active True
PASS the DS roller's ROLL puts its line in the OOC log (DS:99-116): Main Editor rolled <color=#FFFFFF>..</color> + 0 = ..!
PASS the OOC box in Unity shows it
PASS the switch shows the d20 roller instead of the DS roller (dice="both"): d20 True, ds False
PASS d6 and d20 go into the pool, and its text reaches Unity: Dice Pool: d6 d20<color="green"> + 0</color>
PASS the d20 roller's Roll puts the pool's line in the OOC log (D5E:89-123): Main Editor: Main Editor rolled d6: .., d20: .., Total + 0: ..
PASS the IC tab shows the IC log: ic view True
PASS an in-character line goes out under the character's name (LOG:100-133): Sir Test: Hail and well met!
PASS the IC box in Unity shows it: Sir Test: Hail and well met!
PASS an out-of-character line goes out under the display name, separators intact: Main Editor: brb | 100% "real" ^_^
PASS the OOC box in Unity shows it
PASS the close button parks the board again (MENU:79-83): 0.000 1.500 2.000 / 0.000 1.500 2.000
```

Found on the way (fixed in the kit builder): the log boxes' and panels' background images sat over the log tabs and
took their clicks (uGUI gives a click to the topmost graphic): now only a control's own graphic catches the pointer.
A nested canvas (first given to the player list for performance) needs a raycaster of its own, so its rows took no
clicks: the list has none now. The page hears the local head only when it changes: in Play mode the test turns the
desktop player's head (`look`) before Q (the W key of the test keyboard does not walk the desktop player).

## Rung 4: two Local Multiplayer players (`playtest/multi.json`)

The main editor is the world's owner in Local Multiplayer (the SDK's `worldOwnerSlot` default), so its page sees
`isSpaceAdmin` and may write protected state: a Game Master. Player 2 is a Multiplayer Play Mode clone
(`PortKit/Multiplayer/Activate Player 2`). The pages tell each other how far they are with one-shots the runtime
ignores; `run.sh` empties the local relay's saved room first (it keeps space state between Play sessions: a run that
skipped this started with Player 2 already Instance Lead from the run before, and its "move everyone" then worked, as
it should for a lead). **RESULT 24 passed, 0 failed; 0 console error lines** (`playtest/evidence_multi.txt`).

```
[main] PASS two players in the room: ["Main Editor","Player 2"]
[main] PASS the world's owner is a Game Master (role 3), the other player has no role: 3 / 0
[vp-..] PASS Player 2 sees itself with no role and the owner as Game Master: 0 / 3
[main] PASS a non-GM's 'move everyone' request is refused by the GM's page (the sender's role is checked): ["GoSpawn0 from Player 2"]
[vp-..] PASS Player 2's own 'move everyone' is refused on its own page too: nobody moved: 0.000 1.600 0.000 -> 0.000 1.600 0.000; ["GoSpawn0 from Player 2"]
[main] PASS the GM's menu opens (Q)
[main] PASS the GM selects Player 2 in the list and grants a role: Instance Lead (role 1): selected true, role 1
[vp-..] PASS Player 2 is an Instance Lead now: its GM button appears: role 1, GM nav True
[vp-..] PASS Player 2's menu opens (Q)
[main] PASS chat: the GM's OOC line and Player 2's IC line are both on the GM's page: [["Main Editor: Hello from the GM"],["Squire Two: Greetings, game master"]]
[vp-..] PASS chat: both lines are on Player 2's page too
[vp-..] PASS GM 'bring' moves Player 2 to about 1.5 m in front of the GM (GMD:524-554): from 0.000 1.600 0.000 to 0.261 3.200 1.477; GM head 0.000 1.600 0.000; 1.50 m across
[main] PASS GM 'bring': Player 2 is moved in front of the GM
[main] PASS Player 2's label sits 0.75 m over the head Player 2 published (read in the GM's Unity): label 0.26 3.95 1.48, head 0.26 3.2 1.48
[main] PASS Player 2's label shows the name Player 2 set: Squire Two
[vp-..] (Player 2 reloads its page)
[vp-..] PASS the kit loads from a hand-written bs-snippet and the instance starts (after the reload)
[vp-..] PASS after the reload: the GM is still Game Master and Player 2 still Instance Lead (the grant is protected state): [["Main Editor",3],["Player 2",1]]
[vp-..] PASS after the reload: the recent OOC and IC lines are back (the referee's recent lines)
[vp-..] PASS after the reload: Player 2's name comes back from this device, and the Name field is filled
[main] PASS after reloading, Player 2's page holds the same state as the GM's (digest): a8f0b5c3 / a8f0b5c3
```

**The bring lands 1.6 m high** (y 3.2 for a head at 1.6): the GM sends its head position and the brought player's
`TeleportTo` puts the feet there (PORT.md RG7, open: the page knows heads, not feet). Upstream used `GetPosition()`,
the feet. Stated, not fixed: it needs the local player's feet (or eye height) from the runtime.

## What remains unverified

- **Everything in the app and in a headset (rung 5):** uGUI clicks and the text fields with a laser and the app's
  keyboard (Play mode types through the field's own key handling, see rung 3), the relay graph's per-frame polling of
  seven fields on Quest, label placement with real latency and the look-at constraint there, frame time with 32 labels
  and about 300 texts, the alert sounds (the `audio` op ran; nobody listened), the radial-menu button (RG3) and the
  controller's secondary button (no controller events in Play mode).
- **Moderators:** only the world's owner ran as Game Master; a moderator's protected write is untested.
- **Teleport to a player, A to F with the fade, respawn, Call GM, Gm Title, the GM log, paging past 8 players, more
  than two players:** covered in Node (rung 1) only.
- **Leaving and coming back after the leave is processed:** only a page reload (a quick return) ran in Play mode.
