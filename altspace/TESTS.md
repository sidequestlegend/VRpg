# rp-toolkit: test evidence

Everything here ran on 2026-11-25 (the re-sync to portkit `c971100`; before it the fix pass, first on 2026-11-24) on Windows, Unity 6000.3.21f1, Creator SDK 4.0.29, in the Unity editor. Nothing ran
in the Altspace app, on a Quest, or with controllers (rung 5: not run; worlds stay Private).

How to run each rung again:

```
cd altspace/ts && npm test                                                    rungs 0 and 1
portkit/tools/remote.sh altspace menu "PortKit/Kit/Check"                    rung 2 (Logs/portkit_check.txt)
portkit/tools/playtest.sh altspace altspace/playtest/single.json rp-toolkit  rung 3
portkit/tools/playtest.sh altspace altspace/playtest/multi.json rp-toolkit   rung 4 (starts Player 2 and waits for it)
```

`playtest.sh` versions the page's script and bundle addresses (`?v=<sha1>`) and empties the local relay's saved room
before each run (the game's own `run.sh` did both until the fix pass).

## Rung 0: static

`npm run typecheck` (tsc, strict) and `npm run lint` (only the platform adapters touch the page or the clock): clean.

```
lint: src, portkit/src clean (page and clock rules)
```

## Rung 1: Node (no Unity)

`npm test` in `altspace/ts` on portkit `c971100`: **28 tests, 28 pass, 0 fail** (21 before the fix pass), on the
bindings the kit builder wrote (hash `da4c55f9...`; `d53e682c...` on portkit `812f285`). The dice vectors (`vectors/dice.json`, 13 DS and 8 d20) are derived
by hand from the upstream C# with line references (no golden vectors from compiled C#: PORT.md 0.5). Added in the fix
pass (each failed on the code before its fix; PORT.md 0.7.2):

```
ok - finding 1: no client can put a log or dice line in another player's name
ok - findings 1 and 2: late joiners get recent lines only from the referee's own user state, and never GM-log lines
ok - finding 3: a moderator's Game Master record counts only for the session that wrote it
ok - finding 4: no tag slips past the filters, in labels, titles, logs, the player list and the card
ok - finding 6: a grant dated in the future is refused, so it cannot outlast a game master's later change
ok - finding 9: a chain of grants longer than six links settles on every client
ok - the rich-text filter: tags with spaces, hyphens and #, tags made by removing others, colours with alpha, open tags
ok - dice lines reach every player; a remote player can neither roll on another's roller nor send a dice line in their name
ok - each player's label is attached to that player's own head with autoSync, and the others see it there; ...
```

The label test was rewritten in the re-sync to `c971100` (PORT.md 0.8): each player's label is attached with
`autoSync`, the label objects are `"attach": true` and not synced, and a client present when a label is attached
reproduces it on its own copy of that slot (`FakeClient.remoteAttached`), also after a rejoin. It fails on the code
before (synced transforms, no autoSync). The fake room does not reproduce an attachment for a client that arrives
after it was made (the SDK does: rung 4), so that case is not asserted in Node (kit gap).

and every forged-event check runs against the runtime's `networkCallable` lists.

## Rung 2: the kit in edit mode (`PortKit/Kit/Check`)

```
PASS graphs: the SDK's check found 0 nodes the app will not run
PASS rp-toolkit bindings: 353 objects resolve by path; hash matches (d53e682c55306ec883738d848df4cb60c619e5fa)
PASS rp-toolkit android bundle: PASS Kind=Pass Reasons=[] Reports=[] Stats=files 1 (format 22), scenes 0, objects 1093/2899, behaviours 1076, scripts 16, ...
PASS rp-toolkit windows bundle: PASS Kind=Pass Reasons=[] Reports=[] Stats=files 1 (format 22), scenes 0, objects 1093/2899, behaviours 1076, scripts 16, ...
DONE
```

Kit build (`Logs/portkit_kits.txt`): 640 objects, 353 bound (0 synced; the 32 label slots are attachable, bindings
`"attach": true`), 351 refs, 26 behaviours, 76 events; 375 stand-in, project or missing scripts stripped; 157 texts
drawn with the kit's Roboto Slab. The relay graph (portkit `c971100`): 1,709 units, 376 control and 1,559 value
connections, 54 distinct members, all on the allow list (with the kit's new `pkHead` op; on `812f285`: 1,654 units).
Each bundle carries the notices and the licence texts `VRpg2-LICENSE-MIT.txt`, `RobotoSlab-LICENSE-Apache-2.0.txt`,
`Kenney-Interface-Sounds-License.txt`, `portkit-LICENSE-MIT.txt` and `LiberationSans - OFL.txt` (`Logs/portkit_bundles.txt`).

Bundle sizes: before the fix pass Android 1,268 KiB, Windows 1,310 KiB; after it Android 1,303,518 bytes, Windows
1,344,932 bytes; after the re-sync to `c971100` **Android 1,313,075 bytes (+9,557), Windows 1,356,056 bytes (+11,124)**.
The relay graph is larger (graph blobs 927 KiB in the check, were 895: the `pkHead` op and the per-target launch
variables); the 32 BS Synced Objects the labels no longer carry save a little.

Artifacts (`PortKit/Kit/Export Artifacts`, `altspace/dist/`, not committed): `android/rp-toolkit` (sha1 `3910cd2e...`),
`windows/rp-toolkit` (sha1 `cddba832...`), `pk-rp-toolkit.js` (508,915 bytes: GIB Games' MIT notice, then portkit's),
`rp-toolkit.jpg` (the menu board by the kit's `PhotoRoot`, framed on its uGUI now: 1.50 x 1.18 m, camera 3.8 m away),
`rp-toolkit.snippet.html` (`single="true"`, the settings with their defaults, `position="0 1.5 0"`, a 20 x 20 m box
gizmo from `GizmoSize`: the floor grid), `licenses/rp-toolkit/` (the five licence texts the bundles carry, new in
`c971100`), `manifest.json` (10 files, checks android PASS, windows PASS, bindings `da4c55f9...`). The kit's footprint
now counts world-space uGUI: 1.5 x 1.18 x 0 m (the board; it was empty). `GizmoSize` is kept: the grid (20 x 20 m, on
by default, `grid="true"`) is the largest thing the snippet draws, and it starts off in the kit, so the footprint leaves
it out. Rungs 3 and 4 below ran on exactly these bundles.

## Rung 3: Play mode, one player (`playtest/single.json`)

A hand-written `<bs-snippet name="rp-toolkit" ... single="true" dice="both" position="0 1.5 2">` with the built script
and both bundles from the test's local server, and `Assets/WebRoot/playtest/rp-playtest.js`, which drives the board
through the SDK's desktop player with portkit's InputSim (uGUI buttons clicked through the canvas's GraphicRaycaster;
text typed with the kit's `type` command into each field's own key handling, after a real click gives it focus) and
reads Unity back with the kit's `probe` (the game's `findpos` / `findtext` are gone: `KitProbe.Find` falls back to
the name for an object the SDK re-parented). **RESULT 23 passed, 0 failed; 0 console error lines**, twice in a row on
the `c971100` bundles (`playtest.sh --keep-play`; `playtest/evidence_single.txt`, picture
`playtest/evidence_single_board.jpg` from the fix pass).

```
PASS the kit loads from a hand-written bs-snippet and the instance starts: after 5.7 s
PASS the board is parked with the Main panel only, caption from the setting: main True, social False, caption 'VRpg RP System'
PASS Q opens the menu 0.9 m in front of the head (MENU:73-93): open true, board 0.000 1.600 0.900, head 0.000 1.600 0.000, 0.900 m; parked was 0.000 1.500 2.000
PASS name and title typed into the fields reach the page (field events) and Set stores them: ... "charName":"Sir Test","title":"Knight of Play","slot":0,"attached":0
PASS the header plates show them in Unity (relay op text): 'Sir Test' / 'Knight of Play'
PASS the player's own name label shows them: slot 0: 'Sir Test' / 'Knight of Play', on true
PASS the page attached its label to its head (autoSync): slot 0, attached 0
PASS the label's canvas sits about 0.75 m over the head in Unity (head attachment; a billboard): canvas 0 2.35 0, head 0 1.6 0
PASS with the head tilted down the label stays straight above it: canvas 0 2.35 0, head 0 1.6 0
PASS the fade sphere (the labels' look-at target) is attached to the local head: sphere 0 1.6 0, head 0 1.6 0
PASS the DS roller's ROLL puts its line in the OOC log (DS:99-116): Main Editor rolled <color=#FFFFFF>6</color> + 0 = 6!
PASS the OOC box in Unity shows it
PASS the switch shows the d20 roller instead of the DS roller (dice="both"): d20 True, ds False
PASS d6 and d20 go into the pool, and its text reaches Unity: Dice Pool: d6 d20<color="green"> + 0</color>
PASS the d20 roller's Roll puts the pool's line in the OOC log (D5E:89-123): Main Editor: Main Editor rolled d6: 5, d20: 17, Total + 0: 22
PASS the IC tab shows the IC log: ic view True
PASS an in-character line goes out under the character's name (LOG:100-133): Sir Test: Hail and well met!
PASS the IC box in Unity shows it: Sir Test: Hail and well met!
PASS an out-of-character line goes out under the display name, separators intact: Main Editor: brb | 100% "real" ^_^
PASS the OOC box in Unity shows it
PASS typed rich text is filtered: size dropped, bold kept and closed: Main Editor: big <b>bold</b>
PASS the OOC box in Unity shows the filtered line
PASS the close button parks the board again (MENU:79-83): 0.000 1.500 2.000 / 0.000 1.500 2.000
```

Found on the way (fix pass): with a `PositionConstraint` offset, and with an aim constraint about the vertical only,
the local player's own label tilted with the head (looking down put it 0.7 m in front of the face); the kit now uses a
billboard canvas with the text 0.75 m along its up. The SDK re-parents nothing for the local player (the label stays
under `Labels`, moved by a parent constraint) but does for a remote one, so KitProbe's path probe no longer reached a
label (kit gap then; the game's `findpos`; `KitProbe.Find` falls back to the name since `c971100`).

## Rung 4: two Local Multiplayer players (`playtest/multi.json`)

The main editor is the world's owner in Local Multiplayer, a Game Master; Player 2 is a Multiplayer Play Mode clone,
started by `playtest.sh`. **RESULT 33 passed, 0 failed; 0 console error lines**, twice in a row on the `c971100`
bundles (`playtest.sh --keep-play`; `playtest/evidence_multi.txt`). 26 checks before; added in the re-sync: the GM's
label seen in Player 2's Unity (the GM attached it before Player 2 came: the late case), its text, the same two after
Player 2's reload, Player 2's label back over its head in the GM's Unity after the reload, and the two pages' `digest()`
compared at the same `version()` (portkit's digest now covers per-player synced fields).

```
[main] PASS the kit loads from a hand-written bs-snippet and the instance starts: after 6.0 s
[main] PASS two players in the room: ["Main Editor","Player 2"]
[main] PASS the world's owner is a Game Master (role 3), the other player has no role: 3 / 0
[main] PASS a non-GM's 'move everyone' request is refused by the GM's page (the sender's role is checked): ["GoSpawn0 from Player 2"]
[main] PASS the GM's menu opens (Q):
[main] PASS the GM selects Player 2 in the list and grants a role: Instance Lead (role 1): selected true, role 1
[main] PASS chat: the GM's OOC line and Player 2's IC line are both on the GM's page: [["Main Editor: Hello from the GM"],["Squire Two: Greetings, game master"]]
[main] PASS GM 'bring': Player 2 is moved in front of the GM: from 0.000 1.600 0.000 to 0.261 3.200 1.477, 1.50 m from the GM's head
[main] PASS Player 2's label follows Player 2's head in the GM's Unity and shows above it from the GM's view (Player 2 attached it to its head with autoSync; the app re-parents the GM's copy): slot 1: text 0.166 3.713 0.938, the wearer's head 0.261 3.2 1.477, view 0 1.6 0, 0.750 m, |cos| to the line of sight 0.000
[main] PASS Player 2's label shows the name Player 2 set: Squire Two
[main] PASS a GM-log line reaches Player 2 (a lead) live: ["Main Editor: GM eyes only"]
[main] PASS after reloading, Player 2's page holds the same roles, names, slots and IC and OOC lines as the GM's: {"roster":[["ea71beabbcdd9d67f76671884c9073a7",3,"Sir Test","Knight of Play",0],["0f2b21f87e29f9a5936877c44d19f63a",1,"Squire Two","Knight of Play",1]],"ic":["Squire Two: Greetings, game master"],"ooc":["Main Edit...
[main] PASS after reloading, the two pages' digests (per-player synced fields included) match at the same version(): {"version":"4:a6c1b554","digest":"8838ee71"} / {"version":"4:a6c1b554","digest":"8838ee71"}
[main] PASS after the reload: Player 2's label is back over Player 2's head in the GM's Unity: slot 1: text 0.166 3.713 0.938, the wearer's head 0.261 3.2 1.477, view 0 1.6 0, 0.750 m, |cos| to the line of sight 0.000
[main] PASS Player 2 finished its late-join label check:
[vp-..] PASS the kit loads from a hand-written bs-snippet and the instance starts: after 5.2 s
[vp-..] PASS two players in the room: ["Main Editor","Player 2"]
[vp-..] PASS Player 2 sees itself with no role and the owner as Game Master: 0 / 3
[vp-..] PASS Player 2's own 'move everyone' is refused on its own page too: nobody moved: 0.000 1.600 0.000 -> 0.000 1.600 0.000; ["GoSpawn0 from Player 2"]
[vp-..] PASS Player 2 is an Instance Lead now: its GM button appears: role 1, GM nav True
[vp-..] PASS Player 2's menu opens (Q):
[vp-..] PASS chat: both lines are on Player 2's page too: [["Main Editor: Hello from the GM"],["Squire Two: Greetings, game master"]]
[vp-..] PASS GM 'bring' moves Player 2 to about 1.5 m in front of the GM (GMD:524-554): from 0.000 1.600 0.000 to 0.261 3.200 1.477; GM head 0.000 1.600 0.000; 1.50 m across
[vp-..] PASS the GM's label (attached before Player 2 came) follows the GM's head in Player 2's Unity and shows above it from Player 2's view: slot 0: text -0.095 2.113 -0.539, the wearer's head 0 1.6 0, view 0.261 3.2 1.477, 0.750 m, |cos| to the line of sight 0.000
[vp-..] PASS the GM's label in Player 2's Unity reads what it reads in the GM's own: ["Sir Test","Knight of Play"] / ["Sir Test","Knight of Play"]
[vp-..] PASS the kit loads from a hand-written bs-snippet and the instance starts (after the reload): after 5.5 s
[vp-..] PASS two players in the room: ["Main Editor","Player 2"]
[vp-..] PASS after the reload: the GM is still Game Master and Player 2 still Instance Lead (the grant is protected state): [["Main Editor",3],["Player 2",1]]
[vp-..] PASS after the reload: the recent OOC and IC lines are back (the referee's recent lines): [["Main Editor: Hello from the GM"],["Squire Two: Greetings, game master"]]
[vp-..] PASS after the reload: Player 2's name comes back from this device, and the Name field is filled: ["Squire Two",{"name":"Squire Two","title":"Knight of Play"}]
[vp-..] PASS after the reload: no GM-log line came back (they are never published): []
[vp-..] PASS after the reload: the GM's label follows the GM's head in Player 2's Unity (reproduced on the new kit copy): slot 0: text -0.095 2.113 -0.539, the wearer's head 0 1.6 0, view 0.261 3.2 1.477, 0.750 m, |cos| to the line of sight 0.000
[vp-..] PASS after the reload: the GM's label reads what it reads in the GM's own Unity: ["Sir Test","Knight of Play"] / ["Sir Test","Knight of Play"]
```

The labels are attachable kit objects now (PORT.md 0.8): each holder attaches its slot to its head with `autoSync`,
the app writes `attachment_pk1:rp-toolkit:0:label<n>` into the holder's user state, and each other client re-parents
its own copy of that slot under the holder's avatar (the SDK's LocalAttachmentBridge; a label attached before a player
came waits in its pending list until that player's kit copy exists). Both directions follow the wearer's head and show
0.75 m above it from the viewer's side (|cos| 0.000), as the synced transforms did; no SDK warning that an attached
object "doesn't exist here". The late-join comparison uses the game's `view()` and now also `digest()` at equal
`version()`: `{"version":"4:a6c1b554","digest":"8838ee71"}` on both pages (the per-player digest kit gap is closed).
Player 2's title reads "Knight of Play" though Player 2 never typed one: the Play-mode clone shares the main editor's
page storage, where rung 3 saved it (saved names are per device).

**The bring lands 1.6 m high** (y 3.2 for a head at 1.6): the GM sends its head position and the brought player's
`TeleportTo` puts the feet there (PORT.md RG7, open: the page knows heads, not feet).

## What remains unverified

- **Everything in the app and in a headset (rung 5):** uGUI clicks and the text fields with a laser and the app's
  keyboard, the relay graph's per-frame polling of seven fields on Quest, label placement by autoSync attachments in the
  app (Local Multiplayer is the SDK's model of it) with real latency and 32 slots, frame time with the label pool and about 300 texts, the alert sounds, the radial-menu button
  (RG3) and the controller's secondary button (no controller events in Play mode).
- **Moderators:** only the world's owner ran as Game Master; a moderator's protected write, and its record tied to the
  session (finding 3), are covered in Node only.
- **Teleport to a player, A to F with the fade, respawn, Call GM, Gm Title, paging past 8 players, more than two
  players, forged lines and grants:** covered in Node (rung 1) only.
- **Leaving and coming back after the leave is processed:** only a page reload (a quick return) ran in Play mode.
  When a wearer leaves, the SDK drops the label it reproduced in place, and the page hides that slot (Node only).
