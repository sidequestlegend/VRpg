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
7 text fields). Bundles: Android 1,265 KiB, Windows 1,314 KiB, each with the third-party notices inside; of that the
graph blobs are 871 KiB (decompressed). See PORT.md 0.6 for the buttons decision.
