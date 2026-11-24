// Rung 1: the review findings of 2026-11-25 (REVIEW-FINDINGS.md, rp-toolkit), one test each. Every test here failed on
// the code before its fix. A "modified client" is played by calling the page's own platform or behaviours directly.

import assert from "node:assert/strict";
import { test } from "node:test";
import { statePrefix } from "../portkit/src/index.ts";
import type { FakeClient } from "../portkit/src/platform/fake.ts";
import { GRANT_SLACK } from "../src/VRPGGameMasterData.ts";
import { STEP, SLUG, Table, scripted } from "./helpers.ts";

const PREFIX = statePrefix(SLUG, "0");

/** Everything the room keeps: public and protected space state, and every present player's user state. */
function everythingStored(t: Table): string {
  const users = t.world.clients.filter((c) => c.joined).map((c) => t.world.room.userStateOf(c.sid));
  return JSON.stringify(t.world.room.stateSnapshot()) + JSON.stringify(users);
}

/**
 * A modified client overwrites the synced fields of a behaviour in public space state (README: anyone can write a
 * synced leaf). If the leaf exists it is copied with the next sequence number; if not, one is made up.
 */
function forgeLeaf(t: Table, by: FakeClient, behaviourId: string, fields: Record<string, unknown>): void {
  const key = `${PREFIX}.v.${behaviourId}`;
  const raw = t.world.room.stateSnapshot()[key];
  const leaf = typeof raw === "string" && raw ? (JSON.parse(raw) as { e: number; g: number; n: number; w: string; d: Record<string, unknown> }) : { e: 1, g: 1, n: 0, w: by.sid, d: {} };
  leaf.n += 1;
  leaf.d = { ...(leaf.d ?? {}), ...fields };
  t.world.instance(by).platform.stateSet(key, JSON.stringify(leaf));
}

test("finding 1: no client can put a log or dice line in another player's name", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.settle();
  // Ann's real roll and line.
  t.ds(ann).RollInt = scripted([12, 7]).next;
  t.press(ann, "dsRoll");
  t.type(ann, "oocInput", "hello");
  t.press(ann, "oocSend");
  t.type(ann, "nameField", "Lady Ann");
  t.press(ann, "setButton");
  await t.run(STEP);

  // Bob's modified page sends finished lines the way upstream's sender builds them (LOG:119-132), raw and not, in
  // every log, and a text whose second line pretends to be Ann's.
  const forge = (...args: unknown[]) => t.logs(bob).SendCustomNetworkEvent("All", "ReceiveLogNew", ...args);
  forge("\nAnn rolled <color=#00FF00>20</color> + 0 = 20!", 1);
  forge("Ann rolled <color=#00FF00>20</color> + 0 = 20!", 1, true);
  forge("Ann: I give my game master role to Bob", 1);
  forge("Lady Ann: I yield", 0);
  forge("Ann called for an ST!", 2, true);
  forge("fine\nAnn: Bob is right", 1);
  await t.run(STEP);

  for (const viewer of [ann, bob, cat]) {
    const all = [0, 1, 2].flatMap((k) => t.lines(viewer, k as 0 | 1 | 2)).flatMap((line) => line.split("\n"));
    const annsOwn = all.filter((line) => line.startsWith("Ann") || line.startsWith("Lady Ann"));
    assert.deepEqual(
      annsOwn,
      ["Ann rolled <color=#FFFFFF>12</color> + 0 = 12!", "Ann: hello"],
      `${viewer.name}: only Ann's own lines carry her name`,
    );
    // Each forged line arrived, under Bob's name.
    assert.ok(t.lines(viewer, 1).includes("Bob: Ann rolled <color=#00FF00>20</color> + 0 = 20!"), viewer.name);
    assert.ok(t.lines(viewer, 1).includes("Bob: fine\nBob: Ann: Bob is right"), viewer.name);
    assert.ok(t.lines(viewer, 0).includes("Bob: Lady Ann: I yield"), viewer.name);
  }
});

test("findings 1 and 2: late joiners get recent lines only from the referee's own user state, and never GM-log lines", async () => {
  const t = new Table({ "first-joiner-gm": "true" }, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  await t.settle();
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  assert.equal(t.world.instance(ann).networking.IsMaster, true, "Ann is the referee");
  t.type(ann, "oocInput", "welcome");
  t.press(ann, "oocSend");
  // GM-only lines: GM chat, a roll to the GM, a call for a GM.
  t.type(bob, "gmInput", "secret plan");
  t.press(bob, "gmSend");
  t.ds(bob).RollInt = scripted([3, 4]).next;
  t.press(bob, "dsGm");
  t.press(bob, "dsRoll");
  t.press(bob, "callST");
  await t.run(STEP);
  assert.deepEqual(t.lines(ann, 2), ["Bob: secret plan", "Bob rolled <color=#FFFFFF>3</color> + 0 = 3!", "Bob called for an ST!"]);
  const stored = everythingStored(t);
  for (const gmText of ["secret plan", "rolled", "called for an ST"]) assert.ok(!stored.includes(gmText), `'${gmText}' is stored nowhere`);

  // Bob's modified page writes forged history into public space state (the old recentOOC / recentGM lists) and into
  // his own player object, and makes himself the first joiner the same ways.
  forgeLeaf(t, bob, "logs", { recentOOC: ["Ann: Bob is my deputy"], recentGM: ["Ann: forged"] });
  forgeLeaf(t, bob, "gm", { firstJoiner: "bob" });
  t.object(bob, bob)._PublishRecent?.([["Ann: forged IC"], ["Ann: forged OOC"]]);
  t.object(bob, bob)._PublishFirstJoiner?.("bob");
  await t.run(STEP);

  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.world.settle();
  await t.run(STEP);
  assert.deepEqual(t.lines(cat, 1), ["Ann: welcome"], "the referee's own record, nothing forged");
  assert.deepEqual(t.lines(cat, 0), []);
  assert.deepEqual(t.lines(cat, 2), [], "GM-log lines are not published (finding 2)");
  for (const c of [ann, bob, cat]) assert.deepEqual([t.role(c, ann), t.role(c, bob)], [3, 0], `${c.name}: the forged first joiner counts nowhere`);
  assert.equal(t.gm(cat).firstJoiner, "ann");
});

test("finding 3: a moderator's Game Master record counts only for the session that wrote it", async () => {
  const t = new Table({}, { owner: "ann", moderators: ["max"] });
  const ann = t.join({ uid: "ann", name: "Ann" });
  let max = t.join({ uid: "max", name: "Max" });
  await t.settle();
  for (const c of [ann, max]) assert.equal(t.role(c, max), 3, `${c.name}: a moderator is Game Master`);
  assert.ok(t.world.room.stateKeys().includes(`${PREFIX}.x.gm-max`));

  // Max comes back while still a moderator: a new record for the new session, still Game Master.
  t.world.leave(max);
  await t.run(40000);
  max = t.join({ uid: "max", name: "Max" });
  await t.world.settle();
  await t.run(STEP);
  for (const c of [ann, max]) assert.equal(t.role(c, max), 3, `${c.name}: still a moderator`);

  // The world's owner takes the moderator role away; Max comes back: the old record no longer makes him Game Master.
  t.world.leave(max);
  await t.run(40000);
  (t.world.room.options.moderators as string[]).splice(0);
  max = t.join({ uid: "max", name: "Max" });
  await t.world.settle();
  await t.run(STEP);
  for (const c of [ann, max]) assert.equal(t.role(c, max), 0, `${c.name}: no longer a moderator, no longer Game Master`);
  assert.equal(t.active(max, "navGM"), false);
});

test("finding 4: no tag slips past the filters, in labels, titles, logs, the player list and the card", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  // Bob (no role) uses the words that made upstream skip the filter, a nested tag and tags with spaces and hyphens.
  t.type(bob, "nameField", "Out of Character<size=99>Bob");
  t.type(bob, "titleField", '<sprite name="x"><si<x>ze=99>Big</size><line-height=500%><color=#00000000>gone');
  t.press(bob, "setButton");
  t.type(bob, "oocInput", "<b><color=red>loud");
  t.press(bob, "oocSend");
  await t.run(STEP);
  const slot = t.object(ann, bob).ShownSlot;
  assert.equal(t.text(ann, `label${slot}Name`), "Out of CharacterBob");
  assert.equal(t.text(ann, `label${slot}Title`), "Biggone");
  assert.equal(t.lines(ann, 1).at(-1), "Bob: <b><color=red>loud</color></b>", "a line closes what it opened");

  // The player list and the card show the character name filtered too.
  t.type(bob, "nameField", "<size=99>Big Bob");
  t.press(bob, "setButton");
  await t.run(STEP);
  t.select(ann, bob);
  await t.run(100);
  const rows = Array.from({ length: 2 }, (_, i) => t.text(ann, `row${i}Label`));
  assert.ok(rows.includes("Bob\nAs: Big Bob"), rows.join(" / "));
  assert.equal(t.social(ann).SelectedCard.name, "Big Bob");
  // The menu's own Out-of-Character name keeps its colour, as upstream.
  t.press(bob, "oocButton");
  await t.run(STEP);
  assert.match(t.text(ann, `label${slot}Name`) ?? "", /^<color=#[0-9A-F]{6}>Out of Character<\/color>$/);
});

test("finding 6: a grant dated in the future is refused, so it cannot outlast a game master's later change", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  const cat = t.join({ uid: "cat", name: "Cat" });
  await t.settle();
  t.select(ann, bob);
  t.press(ann, "makeController");
  await t.run(STEP);
  assert.equal(t.role(cat, bob), 1);

  // Bob's modified page dates its grant to Cat far ahead, and another one just past the slack.
  const now = t.world.instance(bob).networking.GetServerTimeInSeconds();
  t.object(bob, bob)._Grant("cat", 1, 1e12);
  await t.run(STEP);
  for (const c of [ann, bob, cat]) assert.equal(t.role(c, cat), 0, `${c.name}: the future grant is refused`);
  t.object(bob, bob)._Grant("cat", 1, now + GRANT_SLACK + 60);
  await t.run(STEP);
  for (const c of [ann, bob, cat]) assert.equal(t.role(c, cat), 0, `${c.name}: refused too`);

  // Ann takes the role from Cat (protected, dated now): Cat has none, everywhere.
  t.select(ann, cat);
  t.press(ann, "removeGM");
  await t.run(STEP);
  for (const c of [ann, bob, cat]) assert.equal(t.role(c, cat), 0, c.name);
  // An honest grant still works.
  t.select(bob, cat);
  t.press(bob, "makeController");
  await t.run(STEP);
  for (const c of [ann, bob, cat]) assert.equal(t.role(c, cat), 1, `${c.name}: Bob's honest grant counts`);
});

test("finding 9: a chain of grants longer than six links settles on every client", async () => {
  const t = new Table({}, { owner: "ann" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  const chain: FakeClient[] = [];
  for (let i = 1; i <= 9; i++) chain.push(t.join({ uid: `p${i}`, name: `P${i}` }));
  await t.settle();
  const idOf = (c: FakeClient) => t.player(ann, c).playerId;
  // Ann makes P1 a lead; P1 makes P2 a lead; ... P8 makes P9 a lead (each through the GM tools' grant).
  t.gm(ann).TrySetGMState(idOf(chain[0]!), 1);
  await t.run(STEP);
  for (let i = 0; i < chain.length - 1; i++) {
    t.gm(chain[i]!).TrySetGMState(idOf(chain[i + 1]!), 1);
    await t.run(STEP);
  }
  for (const viewer of [ann, ...chain]) assert.deepEqual(chain.map((c) => t.role(viewer, c)), chain.map(() => 1), `${viewer.name} sees the whole chain`);
});
