// Rung 1: several players in the fake room, virtual time. Each test is one of the scenarios PORT.md section 9.2 and
// the coordinator's list ask for.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Quaternion, Vector3, leafBudget, statePrefix } from "../portkit/src/index.ts";
import type { FakeClient } from "../portkit/src/platform/fake.ts";
import { MAX_TYPED } from "../src/VRPGLogs.ts";
import { STAFF_ROW_COLOR } from "../src/VRPGPlayerButton.ts";
import { LABEL_POOL } from "../src/VRPGPlayerObject.ts";
import { SLUG, STEP, Table, bindings } from "./helpers.ts";

const near = (a: Vector3, b: Vector3, what: string) => assert.ok(Vector3.Distance(a, b) < 1e-6, `${what}: ${a} is not ${b}`);
const yawNear = (a: number, b: number, what: string) => assert.ok(Math.abs((((a - b) % 360) + 540) % 360 - 180) < 1e-6, `${what}: ${a} is not ${b}`);

/** Puts a player's head somewhere, facing `yaw` degrees. */
function stand(c: FakeClient, at: Vector3, yaw = 0): void {
  const rotation = Quaternion.Euler(0, yaw, 0);
  c.pose({ head: { position: at, rotation }, leftHand: { position: at, rotation }, rightHand: { position: at, rotation } });
}

/** Errors the room was expected to log (a refused protected write) are left out. */
function problems(t: Table, expected: RegExp[] = []): string[] {
  return t.world.problems().filter((p) => !expected.some((r) => r.test(p)));
}

test("player menu state is each player's own: open, panels, plates, and nothing a forged event can change", async () => {
  const t = new Table();
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();

  // Both start closed, on Main only (C10), parked where the snippet put them.
  for (const c of [ann, bob]) {
    assert.equal(t.menu(c).MenuIsOpen, false);
    assert.deepEqual(["panelMain", "panelSocial", "panelOptions", "panelGM"].map((k) => t.active(c, k)), [true, false, false, false]);
    assert.equal(t.menu(c).Plate("playerName"), c.name);
    assert.equal(t.text(c, "caption"), "VRpg RP System");
  }
  const parked = t.menu(ann).transform.position;

  // Ann presses Q: her board comes 0.9 m in front of her head (MENU:85-93); Bob's stays.
  stand(ann, new Vector3(1, 1.6, 2), 90);
  ann.input({ type: "key", key: "Q", pressed: true });
  await t.run(100);
  assert.equal(t.menu(ann).MenuIsOpen, true);
  assert.equal(t.menu(bob).MenuIsOpen, false);
  near(t.menu(ann).transform.position, new Vector3(1.9, 1.6, 2), "board in front of the head");
  near(t.menu(bob).transform.position, parked, "Bob's board");

  // Ann goes to Social; Bob is still on Main.
  t.press(ann, "navSocial");
  await t.run(100);
  assert.deepEqual(["panelMain", "panelSocial"].map((k) => t.active(ann, k)), [false, true]);
  assert.deepEqual(["panelMain", "panelSocial"].map((k) => t.active(bob, k)), [true, false]);
  assert.equal(t.text(ann, "playerCount"), "Players: 2");

  // The left controller's secondary button and the parked board's open button swap the state too.
  ann.input({ type: "button", button: 3, side: 0, pressed: true });
  await t.run(100);
  assert.equal(t.menu(ann).MenuIsOpen, false);
  near(t.menu(ann).transform.position, parked, "closed board is parked again");
  assert.ok(bob.click(SLUG, "0", "openButton"));
  await t.run(100);
  assert.equal(t.menu(bob).MenuIsOpen, true);
  t.press(bob, "closeButton");
  await t.run(100);
  assert.equal(t.menu(bob).MenuIsOpen, false);

  // Name and title: Ann's plates change, Bob's do not.
  t.type(ann, "nameField", "Lady Ann");
  t.type(ann, "titleField", "of the North");
  t.press(ann, "setButton");
  await t.run(STEP);
  assert.equal(t.menu(ann).Plate("characterName"), "Lady Ann");
  assert.equal(t.text(ann, "plateCharTitle"), "of the North");
  assert.equal(t.menu(bob).Plate("characterName"), "");

  // Bob forges network events that would press Ann's buttons (upstream: any public method can be called).
  t.menu(bob).SendCustomNetworkEvent("All", "SwapMenuState");
  t.menu(bob).SendCustomNetworkEvent("All", "SetOOC");
  t.menu(bob).SendCustomNetworkEvent("All", "ShowPanel", 3);
  t.logs(bob).SendCustomNetworkEvent("All", "ShowGMLog");
  await t.run(STEP);
  assert.equal(t.menu(ann).MenuIsOpen, false, "Ann's board did not open");
  assert.equal(t.menu(ann).Plate("characterName"), "Lady Ann", "Ann's name did not change");
  assert.equal(t.menu(ann).shownPanel, 1);
  assert.equal(t.logs(ann).shownLog, 1);
  assert.deepEqual(problems(t), []);
});

test("a game master grants and revokes a role; an Instance Lead's own grant lasts while the lead is present", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.settle();
  const everyone = [ann, bob, cat];

  // The world's owner is Game Master everywhere; she registered in protected state.
  for (const c of everyone) assert.deepEqual(everyone.map((w) => t.role(c, w)), [3, 0, 0], c.name);
  assert.ok(t.world.room.stateKeys().some((k) => k === `${statePrefix(SLUG, "0")}.x.gm-ann`));
  assert.equal(t.active(ann, "navGM"), true);
  assert.equal(t.active(bob, "navGM"), false);
  assert.equal(t.menu(ann).Plate("playerTitle"), "<color=#962696>Game Master</color>");
  // "Gm Title" (GMD:446-458): her label shows her coloured role title over her display name, for everyone.
  t.press(ann, "stTitle");
  await t.run(STEP);
  for (const c of everyone) {
    const slot = t.object(c, ann).ShownSlot;
    assert.equal(t.text(c, `label${slot}Name`), "<color=#962696>Game Master</color>", c.name);
    assert.equal(t.text(c, `label${slot}Title`), "Ann");
  }

  // Ann selects Bob and presses "Give GM" (GMD:302): Bob is an Instance Lead on every client.
  t.select(ann, bob);
  await t.run(100);
  assert.equal(t.social(ann).SelectedCard.player, "Bob");
  t.press(ann, "makeController");
  await t.run(STEP);
  for (const c of everyone) assert.equal(t.role(c, bob), 1, `${c.name} sees Bob's role`);
  assert.ok(t.world.room.stateKeys().some((k) => k === `${statePrefix(SLUG, "0")}.x.st-bob`), "a game master's grant is protected state");
  assert.equal(t.active(bob, "navGM"), true, "Bob's GM button appears");
  assert.equal(t.active(bob, "gmLog"), true);
  assert.equal(t.menu(bob).Plate("playerTitle"), "<color=#2E9496>Instance Lead</color>");
  // His row in everyone's list carries [L] and the staff colour; his label shows the lead icon.
  const bobRow = t.world.instance(cat).networking.GetPlayers().findIndex((p) => p.sid === bob.sid);
  assert.equal(t.text(cat, `row${bobRow}Label`), "[<color=#2E9496>L</color>] Bob");
  assert.deepEqual(cat.graph(SLUG).uiColor.get(`row${bobRow}Label`), [STAFF_ROW_COLOR.r, STAFF_ROW_COLOR.g, STAFF_ROW_COLOR.b, 1].map((n) => String(Number(n.toFixed(6)))));
  const slot = t.object(cat, bob).ShownSlot;
  assert.equal(t.active(cat, `label${slot}Icon1`), true);
  assert.equal(t.active(cat, `label${slot}Icon0`), false);

  // Bob, a lead, gives Cat the lead role: stored in Bob's own user state, valid for everyone.
  t.select(bob, cat);
  t.press(bob, "makeController");
  await t.run(STEP);
  for (const c of everyone) assert.equal(t.role(c, cat), 1, `${c.name} sees Cat's role`);
  assert.ok(!t.world.room.stateKeys().some((k) => k.endsWith(".x.st-cat")), "not in protected state");
  // A lead cannot make an operator (above his own role), nor touch the world's owner (GMD:233).
  t.press(bob, "giveOperator");
  t.select(bob, ann);
  t.press(bob, "removeGM");
  await t.run(STEP);
  assert.equal(t.role(ann, cat), 1);
  assert.equal(t.role(cat, ann), 3);

  // Ann removes Bob's role (GMD:304): Bob is a player again, and Cat's grant from him no longer counts.
  t.select(ann, bob);
  t.press(ann, "removeGM");
  await t.run(STEP);
  for (const c of everyone) assert.deepEqual([t.role(c, bob), t.role(c, cat)], [0, 0], c.name);
  assert.equal(t.active(bob, "navGM"), false, "Bob's GM button goes");
  assert.equal(t.active(bob, "operUI"), false);

  // Ann makes Bob a lead again; his grant to Cat counts again; then Bob leaves and, once he is gone, it lapses.
  t.press(ann, "makeController");
  await t.run(STEP);
  assert.equal(t.role(ann, cat), 1);
  t.world.leave(bob);
  await t.run(STEP * 4);
  for (const c of [ann, cat]) assert.equal(t.role(c, cat), 0, `${c.name}: Cat's grant lapsed with Bob`);
  assert.deepEqual(problems(t), []);
});

test("a non-GM's privileged requests are refused on every client", async () => {
  const t = new Table({ "teleport-points": "1", "tp-a": "10 0 5" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.settle();
  for (const c of [ann, bob, cat]) stand(c, new Vector3(0, 1.6, 0));
  const idOf = (c: FakeClient) => t.player(ann, c).playerId;

  // Bob is no one: everyone to point A, everyone respawn, bring Ann to him, ask where Ann is.
  t.gm(bob).SendCustomNetworkEvent("All", "GoSpawn0");
  t.gm(bob).SendCustomNetworkEvent("All", "GoRespawn");
  t.gm(bob).SendCustomNetworkEvent("All", "DoForceBring", idOf(bob), idOf(ann), [50, 0, 50], 0);
  t.gm(bob).SendCustomNetworkEvent("All", "AskWhere", idOf(bob), idOf(ann));
  await t.run(STEP + 1500);
  for (const c of [ann, bob, cat]) assert.deepEqual(c.teleports, [], `${c.name} was not moved`);
  assert.ok(t.gm(ann).refused.includes("GoSpawn0 from Bob"));
  assert.ok(t.gm(cat).refused.includes("GoRespawn from Bob"));
  assert.ok(t.gm(ann).refused.includes("DoForceBring from Bob"));
  assert.ok(t.gm(ann).refused.includes("AskWhere from Bob"));

  // Bob's own client refuses his "Give GM" (he has no role, GMD:233) ...
  t.select(bob, cat);
  t.press(bob, "makeController");
  // ... and a modified client that writes the grant into Bob's user state anyway changes nothing ...
  t.object(bob, bob)._Grant("cat", 1, 1e12);
  t.object(bob, bob)._Grant("bob", 2, 1e12);
  // ... nor does a protected write, which the room refuses ...
  t.gm(bob).Protected.Set("st-cat", { r: 2, at: 1e12, by: "bob" });
  t.gm(bob).Protected.Set("gm-bob", { r: 3, at: 1e12, by: "bob" });
  // ... nor a forged "Give GM" event that would press Ann's button with her selection (Cat).
  t.select(ann, cat);
  t.gm(bob).SendCustomNetworkEvent("All", "GiveInstanceMod");
  t.gm(bob).SendCustomNetworkEvent("All", "TrySetGMState", idOf(cat), 2);
  await t.run(STEP * 2);
  for (const c of [ann, bob, cat]) assert.deepEqual([t.role(c, bob), t.role(c, cat)], [0, 0], c.name);
  assert.ok(!t.world.room.stateKeys().some((k) => k.endsWith(".x.st-cat") || k.endsWith(".x.gm-bob")));
  assert.equal(t.active(cat, "navGM"), false);
  assert.deepEqual(problems(t, [/refused a write to x\.(st-cat|gm-bob)/]), []);
});

test("game-master teleports: bring one player, go to one player, move everyone to a point and respawn everyone", async () => {
  const t = new Table({ "teleport-points": "2", "tp-a": "10 0 5", "tp-a-yaw": "90", "tp-b": "-3 0 0", respawn: "0 0 -20", "respawn-yaw": "180" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.settle();
  stand(ann, new Vector3(0, 0, 0), 0);
  stand(bob, new Vector3(5, 0, 5), 90);
  stand(cat, new Vector3(-5, 0, 0), 0);
  // Only the configured points have buttons.
  assert.deepEqual([0, 1, 2, 5].map((i) => t.active(ann, `tp${i}`)), [true, true, false, false]);

  // Bring Bob (GMD:524-554): he lands 1.5 m in front of Ann, facing her.
  t.select(ann, bob);
  t.press(ann, "bringToMe");
  await t.run(STEP);
  assert.equal(bob.teleports.length, 1);
  near(bob.teleports[0]!.position, new Vector3(0, 0, 1.5), "Bob brought");
  yawNear(bob.teleports[0]!.yDegrees, 180, "Bob faces Ann");
  assert.deepEqual([ann.teleports.length, cat.teleports.length], [0, 0]);

  // Teleport to Cat (GMD:486-522): Ann asks Cat where she is and lands 1.5 m in front of her.
  t.select(ann, cat);
  t.press(ann, "gmTele");
  await t.run(STEP);
  assert.equal(ann.teleports.length, 1);
  near(ann.teleports[0]!.position, new Vector3(-5, 0, 1.5), "Ann at Cat");
  yawNear(ann.teleports[0]!.yDegrees, 180, "Ann faces Cat");
  assert.equal(cat.teleports.length, 0);

  // "Local": point A moves only Ann, with the fade (TELE:16-42).
  t.press(ann, "tp0");
  await t.run(500);
  assert.equal(ann.teleports.length, 1, "nothing before the fade has run a second");
  assert.equal(ann.graph(SLUG).anim.get("fadeSphere")?.isDark, "1");
  assert.equal(t.active(ann, "fadeTarget"), true);
  await t.run(700);
  assert.equal(ann.teleports.length, 2);
  near(ann.teleports[1]!.position, new Vector3(10, 0, 5), "Ann at A");
  assert.equal(ann.teleports[1]!.yDegrees, 90);
  assert.equal(ann.graph(SLUG).anim.get("fadeSphere")?.isDark, "0");
  assert.equal(t.active(ann, "fadeTarget"), false);
  assert.deepEqual([bob.teleports.length, cat.teleports.length], [1, 0]);

  // "All": point B moves everyone; a second press during the fade is ignored.
  t.press(ann, "teleTarget");
  await t.run(100);
  assert.equal(t.text(ann, "teleTargetLabel"), "All");
  t.menu(bob)._Open();
  t.press(ann, "tp1");
  t.press(ann, "tp1");
  await t.run(STEP + 1000);
  for (const c of [ann, bob, cat]) {
    const last = c.teleports.at(-1)!;
    near(last.position, new Vector3(-3, 0, 0), `${c.name} at B`);
  }
  assert.deepEqual([ann.teleports.length, bob.teleports.length, cat.teleports.length], [3, 2, 1]);
  assert.equal(t.menu(bob).MenuIsOpen, false, "a teleport closes the menu (TELE:23)");

  // Respawn everyone: the `respawn` setting stands in for the platform's respawn.
  t.press(ann, "respawn");
  await t.run(STEP);
  for (const c of [ann, bob, cat]) {
    near(c.teleports.at(-1)!.position, new Vector3(0, 0, -20), `${c.name} respawned`);
    assert.equal(c.teleports.at(-1)!.yDegrees, 180);
  }
  assert.deepEqual(problems(t), []);
});

test("with disable-gm-bring the target refuses to be brought", async () => {
  const t = new Table({ "disable-gm-bring": "true" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  stand(ann, new Vector3(0, 0, 0));
  t.select(ann, bob);
  t.press(ann, "bringToMe");
  await t.run(STEP);
  assert.deepEqual(bob.teleports, []);
});

test("in-character, out-of-character and GM logs: text with | ^ quotes and line breaks survives to every client", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  const tricky = `a|b ^c "double" 'single' 100% back\\slash\nsecond line`;

  // OOC: "{displayName}: {text}" (LOG:128).
  t.type(ann, "oocInput", tricky);
  t.press(ann, "oocSend");
  await t.run(STEP);
  for (const c of [ann, bob]) {
    assert.deepEqual(t.lines(c, 1), [`Ann: ${tricky}`], c.name);
    assert.equal(t.text(c, "oocOutput"), `Ann: ${tricky}`, `${c.name}: what the kit's text shows, through the relay's encoding`);
  }
  assert.equal(t.logs(ann).InputOf(1).text, "", "the field is cleared after sending (LOG:190)");
  assert.equal(t.text(ann, "oocInput"), "");

  // IC: "{characterName}: {text}" (LOG:123-124), and the alert plays on every client with it on.
  t.type(bob, "nameField", "Sir Bob");
  t.type(bob, "titleField", "");
  t.press(bob, "setButton");
  await t.run(STEP);
  t.press(ann, "imAlertToggle"); // Ann turns her alert off
  t.type(bob, "icInput", "I draw my sword | carefully");
  t.press(bob, "icSend");
  await t.run(STEP);
  for (const c of [ann, bob]) assert.deepEqual(t.lines(c, 0), ["Sir Bob: I draw my sword | carefully"]);
  assert.equal(t.logs(bob).alertsPlayed, 1);
  assert.equal(t.logs(ann).alertsPlayed, 0, "Ann's alert is off");

  // Empty text sends nothing (LOG:102); rich text is cut back to color, b and i; a long line is cut.
  t.press(ann, "oocSend");
  t.type(ann, "oocInput", "<size=200>HUGE</size> <b>bold</b> <color=red>red</color>");
  t.press(ann, "oocSend");
  t.type(ann, "oocInput", "x".repeat(5000));
  t.press(ann, "oocSend");
  await t.run(STEP);
  const ooc = t.lines(bob, 1);
  assert.equal(ooc.length, 3);
  assert.equal(ooc[1], "Ann: HUGE <b>bold</b> <color=red>red</color>");
  assert.equal(ooc[2], "Ann: " + "x".repeat(MAX_TYPED));

  // The GM log reaches everyone, but only staff see its tab and box (GMD:379-385, LOG:132-150, Q6).
  t.type(bob, "gmInput", "psst");
  t.press(bob, "gmSend");
  t.press(bob, "callST");
  await t.run(STEP);
  assert.deepEqual(t.lines(ann, 2), ["Bob: psst", "Bob called for an ST!"]);
  assert.equal(t.active(ann, "gmLog"), true);
  assert.equal(t.active(bob, "gmLog"), false);
  assert.equal(t.gm(ann).gmAlertsPlayed, 1, "staff hear the call");
  assert.equal(t.gm(bob).gmAlertsPlayed, 0);

  // Tabs are each player's own (LOG:198-224), shown by activating the view.
  t.press(ann, "tabIC");
  await t.run(100);
  assert.deepEqual(["icView", "oocView", "gmView"].map((k) => t.active(ann, k)), [true, false, false]);
  assert.deepEqual(["icView", "oocView", "gmView"].map((k) => t.active(bob, k)), [false, true, false]);

  // The box shows the newest 12 lines; the up button pages back.
  for (let i = 0; i < 20; i++) {
    t.type(bob, "oocInput", `line ${i}`);
    t.press(bob, "oocSend");
  }
  await t.run(STEP);
  assert.equal(t.text(ann, "oocOutput")!.split("\n").at(-1), "Bob: line 19");
  t.press(ann, "tabOOC");
  t.press(ann, "logUp");
  await t.run(100);
  // 23 lines: one page back stops at the oldest twelve; down comes back to the newest.
  const all = t.lines(ann, 1);
  assert.equal(all.length, 23);
  assert.equal(t.text(ann, "oocOutput"), all.slice(0, 12).join("\n"));
  t.press(ann, "logDown");
  await t.run(100);
  assert.equal(t.text(ann, "oocOutput"), all.slice(11).join("\n"));
  assert.deepEqual(problems(t), []);
});

test("name labels follow players joining and leaving; names are stripped for non-staff", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  t.type(ann, "nameField", "<color=#FF0000>Queen</color> Ann");
  t.type(ann, "titleField", "<b>Ruler</b> <size=50>of all</size>");
  t.press(ann, "setButton");
  t.type(bob, "nameField", "<color=red>Bob</color> the Bold");
  t.type(bob, "titleField", "Smith");
  t.press(bob, "setButton");
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.world.settle();
  await t.run(STEP);

  const check = (who: FakeClient, name: string, title: string) => {
    for (const viewer of t.world.clients) {
      const slot = t.object(viewer, who).ShownSlot;
      assert.ok(slot >= 0 && slot < LABEL_POOL, `${viewer.name} draws ${who.name}'s label`);
      assert.equal(t.active(viewer, `label${slot}`), true);
      assert.equal(t.text(viewer, `label${slot}Name`), name, `${viewer.name} sees ${who.name}'s name`);
      assert.equal(t.text(viewer, `label${slot}Title`), title);
    }
  };
  // Staff keep their colours (PO:461-465); others are stripped; titles keep only color, b and i (C6).
  check(ann, "<color=#FF0000>Queen</color> Ann", "<b>Ruler</b> of all");
  check(bob, "Bob the Bold", "Smith");
  check(cat, "", "");
  const slots = (viewer: FakeClient) => t.world.clients.map((c) => t.object(viewer, c).ShownSlot);
  for (const viewer of t.world.clients) {
    assert.equal(new Set(slots(viewer)).size, 3, "every player has a slot of their own");
    assert.deepEqual(slots(viewer), slots(ann), "every client agrees which slot is whose");
  }

  // Cat goes out of character (MENU:144-149): the colour stays even though she is not staff.
  t.press(cat, "oocButton");
  await t.run(STEP);
  check(cat, "<color=#00FFFF>Out of Character</color>", "Cat");

  // Bob leaves: once the room drops him his label goes, everywhere.
  const bobSlot = t.object(ann, bob).ShownSlot;
  t.world.leave(bob);
  await t.run(40000);
  for (const viewer of [ann, cat]) assert.equal(t.active(viewer, `label${bobSlot}`), false, `${viewer.name}: Bob's label is gone`);
  // Dan arrives and gets a free slot (Bob's, the lowest free one), with his own name.
  const dan = t.join({ uid: "dan", name: "Dan" });
  await t.world.settle();
  await t.run(STEP);
  t.type(dan, "nameField", "Dan");
  t.press(dan, "setButton");
  await t.run(STEP);
  check(dan, "Dan", "");
  assert.equal(t.object(ann, dan).ShownSlot, bobSlot);
  check(ann, "<color=#FF0000>Queen</color> Ann", "<b>Ruler</b> of all");
  assert.deepEqual(problems(t), []);
});

test("each label sits over its player's published head, on every client; the alert volume reaches the audio source", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  stand(ann, new Vector3(1, 1.6, 2));
  stand(bob, new Vector3(-3, 1.7, 4));
  await t.run(STEP);
  const at = (viewer: FakeClient, who: FakeClient) => {
    const p = viewer.object(SLUG, "0", `label${t.object(viewer, who).ShownSlot}`).transform.position;
    return new Vector3(p.x, p.y, p.z);
  };
  for (const viewer of [ann, bob]) {
    near(at(viewer, ann), new Vector3(1, 2.35, 2), `${viewer.name} puts Ann's label 0.75 m over her head`);
    near(at(viewer, bob), new Vector3(-3, 2.45, 4), `${viewer.name} puts Bob's label 0.75 m over his head`);
  }
  // A small move is not published; a move of more than 15 cm is, at most twice a second.
  stand(bob, new Vector3(-3.05, 1.7, 4));
  await t.run(STEP);
  near(at(ann, bob), new Vector3(-3, 2.45, 4), "a 5 cm move is not sent");
  stand(bob, new Vector3(0, 1.7, 0));
  await t.run(STEP);
  near(at(ann, bob), new Vector3(0, 2.45, 0), "a 3 m move is");
  // A late joiner places the labels from the published heads.
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.world.settle();
  await t.run(STEP);
  near(at(cat, ann), new Vector3(1, 2.35, 2), "the late joiner puts Ann's label over her head");

  // The volume buttons set the IM alert's AudioSource.volume through the relay (op audioVolume).
  t.press(ann, "volUp");
  await t.run(STEP);
  assert.deepEqual(ann.graph(SLUG).values.get("imAlert/audioVolume"), ["0.3"]);
  assert.deepEqual(problems(t), []);
});

test("whitelists key on user ids, not display names: staff-uids, no-staff-uids, vip-uids", async () => {
  const t = new Table({ "staff-uids": "bob, eve", "no-staff-uids": "cat", "vip-uids": "dan" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Bob" }); // the same display name as a staff member: it means nothing
  const dan = t.join({ uid: "dan", name: "Dan" });
  await t.settle();
  for (const c of [ann, bob, cat, dan]) assert.deepEqual([ann, bob, cat, dan].map((w) => t.role(c, w)), [3, 2, 0, 0], c.name);
  assert.equal(t.active(bob, "navGM"), true);
  assert.equal(t.active(cat, "navGM"), false);

  // Cat is on the no-staff list: she cannot be given a role, and her label stays blank (PO:489-494).
  t.select(ann, cat);
  t.press(ann, "giveOperator");
  t.type(cat, "nameField", "Not Bob");
  t.press(cat, "setButton");
  await t.run(STEP);
  for (const c of [ann, bob, dan]) assert.equal(t.role(c, cat), 0);
  assert.equal(t.text(ann, `label${t.object(ann, cat).ShownSlot}Name`), "");

  // Dan is a patron: his name is tinted VipLabelColor (PO:553-559) on every client.
  t.type(dan, "nameField", "Dan");
  t.press(dan, "setButton");
  await t.run(STEP);
  const vip = ["0.59", "0.59", "0.15", "1"];
  for (const c of [ann, bob]) assert.deepEqual(c.graph(SLUG).uiColor.get(`label${t.object(c, dan).ShownSlot}Name`), vip);
  assert.notDeepEqual(ann.graph(SLUG).uiColor.get(`label${t.object(ann, bob).ShownSlot}Name`), vip);

  // With enable-operators off, the staff list gives the lead role instead (GMD:96-117).
  const u = new Table({ "staff-uids": "bob", "enable-operators": "false" });
  const a2 = u.join({ uid: "ann", name: "Ann" });
  const b2 = u.join({ uid: "bob", name: "Bob" });
  await u.settle();
  assert.deepEqual([u.role(a2, b2), u.role(b2, b2)], [1, 1]);
  assert.deepEqual(problems(t), []);
});

test("first-joiner-gm: off by default; on, the first player is an Instance Lead and the role passes on when they leave", async () => {
  const off = new Table();
  const a = off.join({ uid: "ann", name: "Ann" });
  const b = off.join({ uid: "bob", name: "Bob" });
  await off.settle();
  assert.deepEqual([off.role(a, a), off.role(b, a), off.role(a, b)], [0, 0, 0]);
  assert.equal(off.active(a, "navGM"), false);
  assert.equal(off.gm(a).firstJoiner, "");

  const on = new Table({ "first-joiner-gm": "true" });
  const ann = on.join({ uid: "ann", name: "Ann" });
  await on.settle();
  const bob = on.join({ uid: "bob", name: "Bob" });
  const cat = on.join({ uid: "cat", name: "Cat" });
  await on.settle();
  for (const c of [ann, bob, cat]) assert.deepEqual([ann, bob, cat].map((w) => on.role(c, w)), [1, 0, 0], c.name);
  assert.equal(on.active(ann, "navGM"), true);
  // The lead can use the GM tools: give Cat the role.
  on.select(ann, cat);
  on.press(ann, "makeController");
  await on.run(STEP);
  assert.equal(on.role(bob, cat), 1);
  // Ann leaves: the referee records the next player, as VRChat hands on the master.
  on.world.leave(ann);
  await on.run(40000);
  const next = on.gm(bob).firstJoiner;
  assert.ok(next === "bob" || next === "cat");
  for (const c of [bob, cat]) assert.equal(on.role(c, next === "bob" ? bob : cat), 1);
  assert.equal(on.role(bob, next === "bob" ? cat : bob), 0, "Cat's grant from Ann lapsed with her");
  assert.deepEqual(problems(on), []);
});

test("a late joiner sees everyone's roles, names and the recent log lines", async () => {
  const t = new Table({ "staff-uids": "eve" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const eve = t.join({ uid: "eve", name: "Eve" });
  await t.settle();
  t.select(ann, bob);
  t.press(ann, "makeController");
  t.type(bob, "nameField", "Sir Bob");
  t.type(bob, "titleField", "Knight");
  t.press(bob, "setButton");
  await t.run(STEP);
  t.type(ann, "oocInput", "welcome | all");
  t.press(ann, "oocSend");
  t.type(bob, "icInput", "I bow.");
  t.press(bob, "icSend");
  t.type(eve, "gmInput", "staff note");
  t.press(eve, "gmSend");
  await t.run(STEP);

  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.world.settle();
  await t.run(STEP);
  assert.deepEqual([ann, bob, eve, cat].map((w) => t.role(cat, w)), [3, 1, 2, 0]);
  assert.deepEqual(t.lines(cat, 1), ["Ann: welcome | all"]);
  assert.deepEqual(t.lines(cat, 0), ["Sir Bob: I bow."]);
  assert.deepEqual(t.lines(cat, 2), ["Eve: staff note"]);
  assert.equal(t.text(cat, "oocOutput"), "Ann: welcome | all");
  assert.equal(t.text(cat, `label${t.object(cat, bob).ShownSlot}Name`), "Sir Bob");
  assert.equal(t.text(cat, `label${t.object(cat, bob).ShownSlot}Title`), "Knight");
  assert.equal(t.logs(cat).alertsPlayed, 0, "old lines do not ring the alert");
  // The list on Cat's page has all four, staff marked.
  t.press(cat, "navSocial");
  await t.run(100);
  assert.equal(t.text(cat, "playerCount"), "Players: 4");
  const rows = Array.from({ length: 4 }, (_, i) => t.text(cat, `row${i}Label`));
  assert.ok(rows.includes("[<color=#962696>GM</color>] Ann"), rows.join(" / "));
  assert.ok(rows.includes("[<color=#2E9496>L</color>] Bob\nAs: Sir Bob"), rows.join(" / "));
  assert.ok(rows.includes("[<color=#B86B00>O</color>] Eve"), rows.join(" / "));
  assert.ok(t.world.agree(), "every client holds the same synced state");
  assert.deepEqual(problems(t), []);
});

test("name, title and options come back on the same device (not on another), and the input fields are filled", async () => {
  const t = new Table();
  const ann = t.join({ uid: "ann", name: "Ann" });
  let bob = t.join({ uid: "bob", name: "Bob", device: "bobs-quest" });
  await t.settle();
  t.type(bob, "nameField", "Sir Bob");
  t.type(bob, "titleField", "Knight");
  t.press(bob, "setButton");
  t.press(bob, "imAlertToggle");
  t.press(bob, "volUp");
  await t.run(STEP);
  t.world.leave(bob);
  await t.run(40000);
  bob = t.join({ uid: "bob", name: "Bob", device: "bobs-quest" });
  await t.world.settle();
  await t.run(STEP);
  assert.equal(t.menu(bob).nameField.text, "Sir Bob");
  assert.equal(t.text(bob, "titleField"), "Knight");
  assert.equal(t.text(ann, `label${t.object(ann, bob).ShownSlot}Name`), "Sir Bob");
  assert.deepEqual([t.options(bob).ImAlertOn, t.options(bob).Volume], [false, 0.3]);
  assert.equal(t.active(bob, "imAlert"), false);

  t.world.leave(bob);
  await t.run(40000);
  const elsewhere = t.join({ uid: "bob", name: "Bob", device: "a-friends-pc" });
  await t.world.settle();
  await t.run(STEP);
  assert.equal(t.menu(elsewhere).nameField.text, "");
  assert.equal(t.object(ann, elsewhere).GetCharacterName(), "");
});

test("the toolkit's state fits the room: space leaves per copy, user leaves per player", () => {
  const t = new Table();
  const budget = leafBudget(t.world.bindings, (type) => {
    const cls = t.world.game.behaviours[type];
    return cls ? { synced: (cls.synced ?? []).length, perPlayer: cls.perPlayer === true } : null;
  });
  assert.equal(budget.slots, 2, "game master handler and logs");
  assert.ok(budget.spaceLeaves <= 10, `${budget.spaceLeaves} space leaves`);
  assert.ok(budget.userLeavesPerPlayer <= 6);
  assert.equal(bindings.slug, SLUG);
});
