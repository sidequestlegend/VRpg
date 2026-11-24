// Rung 1: both dice rollers against the vectors in vectors/dice.json (derived from the upstream C#, with line refs),
// driven the way a player drives them: typing into the kit's fields and pressing its buttons.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { FakeClient } from "../portkit/src/platform/fake.ts";
import { Table, scripted } from "./helpers.ts";

interface DsVector {
  name: string;
  refs: string;
  att: string;
  def: string;
  attThreat: number;
  defThreat: number;
  gm: boolean;
  rolls: number[];
  ranges: Array<[number, number]>;
  log: "OOC" | "GM";
  lines: string[];
  times?: number[];
}

interface D20Vector {
  name: string;
  refs: string;
  pool: string[];
  mod: number;
  action: string;
  gm: boolean;
  rolls: number[];
  ranges: Array<[number, number]>;
  log: "OOC" | "GM";
  poolText?: string;
  lines: string[];
}

const vectors = JSON.parse(readFileSync(fileURLToPath(new URL("../vectors/dice.json", import.meta.url)), "utf8")) as { ds: DsVector[]; d20: D20Vector[] };
const LOG = { OOC: 1, GM: 2 } as const;

async function oneTable(): Promise<{ t: Table; ann: FakeClient }> {
  const t = new Table({ dice: "both" });
  const ann = t.join({ uid: "ann", name: "Ann" });
  await t.settle();
  return { t, ann };
}

test("DS roller: every vector gives upstream's line, in the right log, from the right draws", async () => {
  const { t, ann } = await oneTable();
  assert.equal(t.active(ann, "dsRoot"), true);
  assert.equal(t.active(ann, "d20Root"), true);
  for (const v of vectors.ds) {
    const k = LOG[v.log];
    const before = { ooc: t.lines(ann, 1).length, gm: t.lines(ann, 2).length };
    t.type(ann, "dsAtt", v.att);
    t.type(ann, "dsDef", v.def);
    for (let i = 0; i < v.attThreat; i++) t.press(ann, "dsAttThreat");
    for (let i = 0; i < v.defThreat; i++) t.press(ann, "dsDefThreat");
    if (v.gm !== t.ds(ann).gmToggleOn) t.press(ann, "dsGm");
    const random = scripted(v.rolls);
    t.ds(ann).RollInt = random.next;

    t.press(ann, "dsRoll");
    const times = v.times ?? v.lines.map(() => 0);
    const at = (ms: number) => times.filter((x) => x <= ms).length;
    await t.run(100);
    const fresh = () => t.lines(ann, k).slice(k === 1 ? before.ooc : before.gm);
    assert.equal(fresh().length, at(0), `${v.name}: lines at once`);
    if (times.some((x) => x > 0)) {
      await t.run(800);
      assert.equal(fresh().length, at(900), `${v.name}: a re-roll waits a second`);
      await t.run(1300);
      assert.equal(fresh().length, at(2200), `${v.name}: lines after the re-rolls`);
      await t.run(1500);
    }
    assert.deepEqual(fresh(), v.lines, `${v.name} (${v.refs})`);
    assert.deepEqual(random.ranges, v.ranges, `${v.name}: draws`);
    assert.equal(random.left(), 0, `${v.name}: every scripted roll used`);
    // The other log got nothing.
    const other = k === 1 ? t.lines(ann, 2).length - before.gm : t.lines(ann, 1).length - before.ooc;
    assert.equal(other, 0, `${v.name}: nothing in the other log`);

    // Reset (DS:119-125) empties both fields and puts both threats back to +0.
    t.press(ann, "dsReset");
    await t.run(100);
    assert.equal(t.ds(ann).attBox.text, "");
    assert.equal(t.ds(ann).defBox.text, "");
    assert.equal(t.text(ann, "dsAtt"), "");
    assert.equal(t.ds(ann).attDropValue + t.ds(ann).defDropValue, 0);
  }
  assert.deepEqual(t.world.problems(), []);
});

test("d20 roller (upstream 'D&D 5E'): pool text, single rolls, advantage, pool rolls", async () => {
  const { t, ann } = await oneTable();
  // An empty pool shows the modifier only; upstream's loop read one past the end here (D5E:129).
  assert.equal(t.d20(ann).PoolText, 'Dice Pool:<color="green"> + 0</color>');
  for (const v of vectors.d20) {
    const k = LOG[v.log];
    t.press(ann, "d20Clear");
    while (t.d20(ann).currentMod < v.mod) t.press(ann, "d20Inc");
    while (t.d20(ann).currentMod > v.mod) t.press(ann, "d20Dec");
    for (const die of v.pool) t.press(ann, `d20Add${die.slice(1)}`);
    if (v.gm !== t.d20(ann).gmToggleOn) t.press(ann, "d20Gm");
    await t.run(100);
    if (v.poolText !== undefined) {
      assert.equal(t.d20(ann).PoolText, v.poolText, `${v.name}: pool text`);
      assert.equal(t.text(ann, "d20Pool"), v.poolText);
      assert.equal(t.text(ann, "d20ModLabel"), String(v.mod));
    }
    const before = t.lines(ann, k).length;
    const random = scripted(v.rolls);
    t.d20(ann).RollInt = random.next;
    const button = { Roll20: "d20One", Roll20Advantage: "d20Adv", Roll20Disadvantage: "d20Dis", RollBox: "d20Roll" }[v.action]!;
    t.press(ann, button);
    await t.run(100);
    assert.deepEqual(t.lines(ann, k).slice(before), v.lines, `${v.name} (${v.refs})`);
    assert.deepEqual(random.ranges, v.ranges, `${v.name}: draws`);
    assert.equal(random.left(), 0);
  }
  assert.deepEqual(t.world.problems(), []);
});

test("dice lines reach every player, and a roll a remote player forges as a network event is ignored", async () => {
  const t = new Table();
  const ann = t.join({ uid: "ann", name: "Ann" });
  const bob = t.join({ uid: "bob", name: "Bob" });
  await t.settle();
  // The menu shows the DS roller only by default (setting dice="ds").
  assert.equal(t.active(ann, "d20Root"), false);
  t.ds(ann).RollInt = scripted([12, 7]).next;
  t.type(ann, "dsAtt", "3");
  t.type(ann, "dsDef", "2");
  t.press(ann, "dsRoll");
  await t.run();
  const line = "Ann rolled <color=#FFFFFF>12</color> + 3 = 15 v. <color=#FFFFFF>7</color> + 2 = 9: <color=#00FF00>Success!</color>";
  assert.deepEqual(t.lines(bob, 1), [line]);
  assert.equal(t.text(bob, "oocOutput"), line);

  // Bob sends "NewRoll" to Ann's roller as a network event: upstream would roll on her client in her name.
  t.ds(bob).SendCustomNetworkEvent("All", "NewRoll");
  t.d20(bob).SendCustomNetworkEvent("All", "SetMod", 50);
  await t.run();
  // "All" runs on the sender first, so Bob's own client rolls for Bob (that is his roll, as a button press would be);
  // Ann's client does not roll in her name.
  const after = t.lines(ann, 1);
  assert.equal(after[0], line);
  assert.equal(after.filter((l) => l.startsWith("Ann rolled")).length, 1, "Ann's roller did not roll for Bob");
  assert.ok(after.slice(1).every((l) => l.startsWith("Bob rolled")));
  assert.equal(t.d20(ann).currentMod, 0);
});
