// Numbered commands to the referee.
//
// Several upstream games use a synced field as a command channel ("task"): a player writes a request and the
// master acts on it when it deserialises. Copied as is, a late joiner would act on the last request again, and a
// request written while the referee changes would be lost. So a request is a record instead:
//
//   - The sender publishes the head of its queue in its announcement leaf: x.q = [n, behaviour, player, name, args].
//   - The referee runs every request whose number is above the one it has acknowledged for that sender, then
//     writes the number into the state leaf `ack` = {e, m: {<sid>: n}}.
//   - The sender publishes its next request once the acknowledgement is mirrored.
//
// Only the referee ever runs a request, each one in order; a new referee carries on from the mirrored numbers.
// (If a referee runs a request and leaves before its acknowledgement reaches the room, the next referee runs it
// again: at-least-once in that one corner.)

import type { Behaviour } from "./behaviour.ts";
import type { Core } from "./core.ts";
import type { Presence } from "./presence.ts";
import type { Referee } from "./referee.ts";
import { asciiJson, isRecord, safeParse, utf8Length } from "./util.ts";
import { decodeValue, encodeValue } from "./values.ts";

export interface CommandRoutes {
  /** The local copy of the behaviour a request addresses: its id and, for a per-player one, its owner's session. */
  resolve(id: string, playerSid: string | null): Behaviour | null;
  address(behaviour: Behaviour): { id: string; playerSid: string | null } | null;
  /** Runs `name` on the behaviour with the sender as the calling player. */
  invoke(behaviour: Behaviour, name: string, args: unknown[], fromSid: string): void;
  acknowledged(behaviour: Behaviour, number: number): void;
  refused(behaviour: Behaviour, code: string, name: string): void;
}

interface Pending {
  n: number;
  behaviour: Behaviour;
  record: [number, string, string, string, unknown[]];
}

/** A request must fit in the announcement leaf with room to spare. */
const MAX_COMMAND_BYTES = 2048;

export class Commands {
  private readonly core: Core;
  private readonly presence: Presence;
  private readonly referee: Referee;
  private readonly routes: CommandRoutes;
  private readonly queue: Pending[] = [];
  private nextNumber = 0;
  private lastWritten = "";
  private lastWrittenAt = -Infinity;
  /** False until behaviours have started: the referee runs nothing before then. */
  started = false;
  run = 0;

  constructor(core: Core, presence: Presence, referee: Referee, routes: CommandRoutes) {
    this.core = core;
    this.presence = presence;
    this.referee = referee;
    this.routes = routes;
  }

  listen(): void {
    this.core.onState((key) => {
      if (key === "ack") this.review();
    });
    this.presence.onExtra(() => this.review());
    this.presence.on(() => this.review());
    this.referee.on(() => this.review());
  }

  send(behaviour: Behaviour, name: string, args: unknown[]): number {
    const address = this.routes.address(behaviour);
    if (!address) return 0;
    if (this.nextNumber === 0) this.nextNumber = (this.table()[this.core.me.sid] ?? 0) + 1;
    const n = this.nextNumber++;
    const record: Pending["record"] = [n, address.id, address.playerSid ?? "", name, args.map(encodeValue)];
    if (utf8Length(asciiJson(record)) > MAX_COMMAND_BYTES) {
      this.routes.refused(behaviour, "value_too_large", name);
      return 0;
    }
    this.queue.push({ n, behaviour, record });
    this.review();
    return n;
  }

  /** Publishes, runs and acknowledges whatever is due. Also called about once a second. */
  review(): void {
    if (this.core.disposed || !this.started) return;
    const me = this.core.me.sid;
    const acked = this.table()[me] ?? 0;
    while (this.queue.length && this.queue[0]!.n <= acked) {
      const done = this.queue.shift()!;
      this.core.guard("OnCommandAcknowledged", () => this.routes.acknowledged(done.behaviour, done.n));
    }
    const head = this.queue[0];
    const published = this.presence.extra(me, "q");
    if (head) {
      if (!Array.isArray(published) || published[0] !== head.n) this.presence.setExtra("q", head.record);
    } else if (published !== undefined) this.presence.setExtra("q", undefined);
    if (this.referee.isMe()) this.officiate();
  }

  private officiate(): void {
    const table = this.workingTable();
    let changed = false;
    for (const sid of Object.keys(table)) {
      if (!this.presence.has(sid)) {
        delete table[sid];
        changed = true;
      }
    }
    for (const who of this.presence.list()) {
      const q = this.presence.extra(who.sid, "q");
      if (!Array.isArray(q) || typeof q[0] !== "number" || typeof q[1] !== "string" || typeof q[3] !== "string") continue;
      if (q[0] <= (table[who.sid] ?? 0)) continue;
      table[who.sid] = q[0];
      changed = true;
      const behaviour = this.routes.resolve(q[1], typeof q[2] === "string" && q[2] ? q[2] : null);
      const args = Array.isArray(q[4]) ? q[4].map(decodeValue) : [];
      this.run++;
      if (behaviour) this.routes.invoke(behaviour, q[3], args, who.sid);
    }
    if (changed) this.writeTable(table);
  }

  private table(): Record<string, number> {
    return this.parseTable(this.core.get("ack"));
  }

  private parseTable(text: string | undefined): Record<string, number> {
    const raw = safeParse(text);
    const out: Record<string, number> = {};
    if (!isRecord(raw) || raw.e !== this.referee.epoch || !isRecord(raw.m)) return out;
    for (const sid of Object.keys(raw.m)) if (typeof raw.m[sid] === "number") out[sid] = raw.m[sid] as number;
    return out;
  }

  /** The table the referee builds on: its own last write while that is still on its way, else the mirror. */
  private workingTable(): Record<string, number> {
    const mirrored = this.core.get("ack");
    const inFlight = this.lastWritten !== "" && mirrored !== this.lastWritten && this.core.platform.clock.now() - this.lastWrittenAt < 3000;
    return this.parseTable(inFlight ? this.lastWritten : mirrored);
  }

  private writeTable(table: Record<string, number>): void {
    const text = asciiJson({ e: this.referee.epoch, m: table });
    if (text === this.core.get("ack")) return;
    this.lastWritten = text;
    this.lastWrittenAt = this.core.platform.clock.now();
    this.core.set("ack", text);
  }
}
