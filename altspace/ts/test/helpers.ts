// Test helpers: players in the fake room with the toolkit on their pages, pressing the kit's buttons and typing into
// its fields the way the kit reports them (graph events "uiButton" and "field"), and reading the kit back.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { encodeRelayArg, type Player } from "../portkit/src/index.ts";
import type { FakeClient, FakeRoomOptions } from "../portkit/src/platform/fake.ts";
import { TestWorld } from "../portkit/src/testing.ts";
import type { DiceRollerD20 } from "../src/DiceRollerD20.ts";
import type { DiceRollerDS } from "../src/DiceRollerDS.ts";
import game from "../src/index.ts";
import type { VRPGGameMasterData } from "../src/VRPGGameMasterData.ts";
import type { VRPGLogs } from "../src/VRPGLogs.ts";
import type { VRPGManager } from "../src/VRPGManager.ts";
import type { VRPGMenu } from "../src/VRPGMenu.ts";
import type { VRPGOptions } from "../src/VRPGOptions.ts";
import type { VRPGPlayerObject } from "../src/VRPGPlayerObject.ts";
import type { VRPGSocial } from "../src/VRPGSocial.ts";

export const bindings = JSON.parse(readFileSync(fileURLToPath(new URL("../bindings.json", import.meta.url)), "utf8"));
export const SLUG = game.slug;
/** Time for an action to reach everyone: a round trip through the fake room and the 0.2 s write batching, and some. */
export const STEP = 1500;

export interface Who {
  uid: string;
  name: string;
  device?: string;
}

export class Table {
  readonly world: TestWorld;
  readonly attributes: Record<string, string>;

  constructor(attributes: Record<string, string> = {}, options: FakeRoomOptions = {}) {
    this.world = new TestWorld(game, bindings, { seed: 7, ...options });
    this.attributes = { single: "true", ...attributes };
  }

  join(who: Who): FakeClient {
    return this.world.join({ uid: who.uid, name: who.name, device: who.device, elements: [this.attributes] });
  }

  async settle(): Promise<void> {
    await this.world.settle();
    await this.world.run(STEP);
  }

  run(ms = STEP): Promise<void> {
    return this.world.run(ms);
  }

  /** Clicks a uGUI button of the kit, as the relay graph reports it (README "Graph to page"). */
  press(c: FakeClient, key: string): void {
    const index = (bindings.refs as string[]).indexOf(key);
    if (index < 0) throw new Error(`${key} is not in refs`);
    c.graphEvent(SLUG, "0", "uiButton", String(index));
  }

  /** Types into an input field: the relay graph reports the field's text with the event "field" (its refs index, the text). */
  type(c: FakeClient, field: string, text: string): void {
    const index = (bindings.refs as string[]).indexOf(field);
    if (index < 0) throw new Error(`${field} is not in refs`);
    c.graphEvent(SLUG, "0", "field", String(index) + "|" + encodeRelayArg(text));
  }

  /** What the relay graph last set as a kit text on that client. */
  text(c: FakeClient, key: string): string | undefined {
    return c.graph(SLUG).text.get(key);
  }

  /** Whether the relay graph (or the page) last set the object active. */
  active(c: FakeClient, key: string): boolean | undefined {
    const graph = c.graph(SLUG).active.get(key);
    if (graph !== undefined) return graph;
    // An object outside refs is switched by the page itself.
    if ((bindings.refs as string[]).indexOf(key) < 0) return c.object(SLUG, "0", key).active;
    return undefined;
  }

  mgr = (c: FakeClient) => this.world.behaviour<VRPGManager>(c, "mgr");
  gm = (c: FakeClient) => this.world.behaviour<VRPGGameMasterData>(c, "gm");
  menu = (c: FakeClient) => this.world.behaviour<VRPGMenu>(c, "menu");
  logs = (c: FakeClient) => this.world.behaviour<VRPGLogs>(c, "logs");
  social = (c: FakeClient) => this.world.behaviour<VRPGSocial>(c, "social");
  options = (c: FakeClient) => this.world.behaviour<VRPGOptions>(c, "options");
  ds = (c: FakeClient) => this.world.behaviour<DiceRollerDS>(c, "ds");
  d20 = (c: FakeClient) => this.world.behaviour<DiceRollerD20>(c, "d20");

  /** `who` as `viewer`'s page knows them. */
  player(viewer: FakeClient, who: FakeClient): Player {
    const found = this.world.instance(viewer).networking.GetPlayers().find((p) => p.sid === who.sid);
    if (!found) throw new Error(`${viewer.name} does not see ${who.name}`);
    return found;
  }

  /** `who`'s player object on `viewer`'s page. */
  object(viewer: FakeClient, who: FakeClient): VRPGPlayerObject {
    const found = this.world.instance(viewer).playerBehaviour<VRPGPlayerObject>(who.sid, "player");
    if (!found) throw new Error(`${viewer.name} has no player object for ${who.name}`);
    return found;
  }

  /** The role `viewer` worked out for `who`. */
  role(viewer: FakeClient, who: FakeClient): number {
    return this.gm(viewer).RoleOf(this.player(viewer, who));
  }

  /** Selects `who` in `c`'s player list, as clicking their row does. */
  select(c: FakeClient, who: FakeClient): void {
    this.social(c).RefreshList();
    const row = this.world
      .instance(c)
      .networking.GetPlayers()
      .findIndex((p) => p.sid === who.sid);
    if (row < 0) throw new Error(`${who.name} is not in ${c.name}'s list`);
    this.press(c, `row${row}`);
  }

  /** The log lines `c` holds, by type: 0 IC, 1 OOC, 2 GM. */
  lines(c: FakeClient, type: 0 | 1 | 2): string[] {
    return this.logs(c).lines[type]!.slice();
  }
}

/** A scripted random source for Random.Range(int, int): it checks the range of each draw against what is expected. */
export function scripted(values: number[]): { next: (min: number, max: number) => number; ranges: Array<[number, number]>; left: () => number } {
  const queue = values.slice();
  const ranges: Array<[number, number]> = [];
  return {
    next(min: number, max: number) {
      ranges.push([min, max]);
      if (!queue.length) throw new Error("the scripted random source ran out");
      const v = queue.shift()!;
      if (v < min || v >= max) throw new Error(`scripted value ${v} is outside Random.Range(${min}, ${max})`);
      return v;
    },
    ranges,
    left: () => queue.length,
  };
}
