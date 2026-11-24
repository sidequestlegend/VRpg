// Translated from VRPG2/Scripts/Core/VRPGLogs.cs (GIB Games, MIT).
//
// Three logs (in character, out of character, game master) and the console helpers. Differences, all listed in
// PORT.md:
//   - A line travels as a network event (LOG:132), and the sender runs it at once (a one-shot does not come back).
//     `Networking.SetOwner` on every send (LOG:104) is a leftover of the synced-string version and is not translated.
//   - Upstream the sender writes the whole line, its own name included, so any client can put a line in anyone's
//     name. Here the sender sends only its text, and every receiver puts the name in front from who sent the event
//     (`Networking.CallingPlayer`, which the room stamps): the display name for OOC and GM lines, the sender's own
//     character name for IC lines (its display name when it has none), and on every line of a text with line breaks,
//     so no line of the box can start with someone else's name. A "raw" line (a dice result) names its sender itself:
//     it is kept as it is when it starts with the sender's display name (or is one of the toolkit's own lines that
//     name nobody, UNNAMED_LINES), else the name is put in front (review finding 1).
//   - Every receiver cleans the text before showing it: control characters other than line breaks removed, only
//     <color>, <b> and <i> kept (and closed), at most 500 characters (PORT.md C6, C7).
//   - The boxes keep the last `log-lines` lines (default 60) and show the newest `log-view` (default 12), with up
//     and down buttons, instead of growing without end in a scroll view (C7, C12).
//   - Recent lines for late joiners (coordinator decision; upstream shows a late joiner nothing, LOG:143-150): the
//     referee publishes the last `log-recent` IC and OOC lines it holds (default 20 each, at most RECENT_CHARS
//     characters each) in its own player object (its user state: no other client can write them), and a client that
//     joins later fills its boxes from the current referee's copy in its first seconds. GM-log lines ("Roll to GM
//     only", GM chat, calls for a GM) are never published: they stay in the event stream (review finding 2).
//   - A tab is shown by activating its view object instead of CanvasGroup alpha (LOG:213-224; G8).
//   - GM-log lines reach every client and are only hidden from non-staff, as upstream (LOG:132-150, Q6).

import { NetworkEventTarget, type AudioClipRef, type AudioSourceRef, type GameObject, type Player } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGInputField, VRPGTextElement } from "./VRPGTextElement.ts";
import type { VRPGPlayerObject } from "./VRPGPlayerObject.ts";
import { Utils, cleanTyped, filterRichText, plainName } from "./VRPGUtils.ts";

/** LOG:294-300 */
export const VRPGLogType = { IC: 0, OOC: 1, GM: 2, Debug: 3 } as const;
export type VRPGLogTypeValue = (typeof VRPGLogType)[keyof typeof VRPGLogType];

/** Longest typed message, and longest line a receiver shows (a name and a prefix fit in the difference). */
export const MAX_TYPED = 500;
export const MAX_LINE = 700;
/** At most this many characters of recent lines per log go into the referee's player object (one user-state leaf). */
export const RECENT_CHARS = 5000;
/** Raw lines the toolkit sends that name nobody, shown as they are (DS:131): they cannot pass for anyone's words. */
const UNNAMED_LINES = new Set(["Too many rerolls due to tie. Please try again!"]);
/** A late joiner takes the referee's recent lines during its first this-many seconds only. */
const RECENT_WINDOW = 20;

export class VRPGLogs extends VRPGComponent {
  /** What other clients may ask of this client: a log line, and a console line (both cleaned before use). */
  static override networkCallable = ["ReceiveLogNew", "DoNetworkDebug"];

  // From bindings.json: the view object of each log (shown for its tab), its text box, its input field.
  ICLogGroup!: GameObject;
  ICOutputBox!: GameObject;
  ICInputBox!: GameObject;
  OOCLogGroup!: GameObject;
  OOCOutputBox!: GameObject;
  OOCInputBox!: GameObject;
  GMLogGroup!: GameObject;
  GMOutputBox!: GameObject;
  GMInputBox!: GameObject;
  ImSound: AudioSourceRef | null = null;
  ImClip: AudioClipRef | null = null;

  /** Lines each box holds (oldest first) and how far each is scrolled back from the newest. */
  readonly lines: string[][] = [[], [], []];
  private readonly scroll = [0, 0, 0];
  private boxes: VRPGTextElement[] = [];
  private inputs: VRPGInputField[] = [];
  shownLog: VRPGLogTypeValue = VRPGLogType.OOC;
  /** Times the IC alert was asked to play here (tests read it). */
  alertsPlayed = 0;
  /** When this client started, and whether it has taken the referee's recent lines yet. */
  private startedAt = 0;
  private recentTaken = false;

  private get maxLines(): number {
    return Math.max(1, Math.floor(this.VRPG.ConfigData.GetNumber("log-lines", 60)));
  }
  private get viewLines(): number {
    return Math.max(1, Math.floor(this.VRPG.ConfigData.GetNumber("log-view", 12)));
  }
  private get recentLines(): number {
    return Math.max(0, Math.floor(this.VRPG.ConfigData.GetNumber("log-recent", 20)));
  }

  /** LOG:48-51 */
  override Start(): void {
    this.boxes = [this.ICOutputBox, this.OOCOutputBox, this.GMOutputBox].map((o) => new VRPGTextElement(this.Host, o.key));
    this.inputs = [this.ICInputBox, this.OOCInputBox, this.GMInputBox].map((o) => new VRPGInputField(this.Host, o.key, MAX_TYPED));
    this.ShowOOCLog();
    this.startedAt = this.Time.time;
  }

  /** A late joiner takes the referee's recent lines, as soon as they reach it. */
  override Update(): void {
    if (this.recentTaken) return;
    if (this.Time.time - this.startedAt > RECENT_WINDOW) {
      this.recentTaken = true;
      return;
    }
    const master = this.Networking.Master;
    if (!master || master.isLocal) return;
    const from = this.PlayerBehaviour<VRPGPlayerObject>(master, "VRPGPlayerObject");
    if (from) this._TakeRecent(from);
  }

  /** A new referee publishes the recent lines it holds; one that is no longer referee takes its copy down. */
  override OnMasterTransferred(newMaster: Player | null): void {
    if (newMaster?.isLocal) this._PublishRecent();
    else this.VRPG.GetLocalPlayerObject()?._PublishRecent([]);
  }

  /** The kit reports an edit of an input field (bindings: `{"kind": "field"}` on each field's object). */
  ICTyped(text: unknown): void {
    this.inputs[0]?.Typed(String(text ?? ""));
  }
  OOCTyped(text: unknown): void {
    this.inputs[1]?.Typed(String(text ?? ""));
  }
  GMTyped(text: unknown): void {
    this.inputs[2]?.Typed(String(text ?? ""));
  }

  /** The input field of a log, for the page and for tests. */
  InputOf(logType: VRPGLogTypeValue): VRPGInputField {
    return this.inputs[logType]!;
  }

  /** LOG:52-65 (the GameObject context of Debug.Log has no meaning in a page console). */
  DebugLog(message: string): void {
    this.Debug.Log(Utils.MakeColor(`[${this.VRPG.GameName}]`, this.VRPG.LabelColor) + ": " + message);
  }
  DebugLogWarning(message: string): void {
    this.Debug.LogWarning(Utils.MakeColor(`[${this.VRPG.GameName}]`, this.VRPG.LabelColor) + ": " + message);
  }
  DebugLogError(message: string): void {
    this.Debug.LogError(Utils.MakeColor(`[${this.VRPG.GameName}]`, this.VRPG.LabelColor) + ": " + message);
  }

  /** LOG:67-70 */
  NetworkDebugLog(message: string): void {
    this.SendCustomNetworkEvent(NetworkEventTarget.All, "DoNetworkDebug", cleanTyped(message, MAX_LINE, true));
  }

  /** LOG:72-78. Anyone may send it; it only prints to the console. */
  DoNetworkDebug(message: unknown): void {
    if (typeof message !== "string") return;
    const InDebugText = Utils.MakeColor(`[${this.VRPG.GameName}]//SYNC`, this.VRPG.LabelColor) + ": " + cleanTyped(message, MAX_LINE, true);
    this.Debug.Log(InDebugText);
  }

  /** LOG:80-98 */
  Log(message: string): void {
    this.SendLog(message, VRPGLogType.OOC);
  }
  LogRaw(message: string): void {
    this.SendLog(message, VRPGLogType.OOC, true);
  }
  LogGM(message: string): void {
    this.SendLog(message, VRPGLogType.GM);
  }
  LogGMRaw(message: string): void {
    this.SendLog(message, VRPGLogType.GM, true);
  }

  /** LOG:100-133: the text goes out; each receiver puts the sender's name in front (see the file header). */
  SendLog(message: string, logType: VRPGLogTypeValue, isRaw = false): void {
    message = cleanTyped(message, MAX_TYPED, true);
    if (message === "") return;

    if (logType === VRPGLogType.Debug) {
      this.NetworkDebugLog(message);
      return;
    }
    this.SendCustomNetworkEvent(NetworkEventTarget.All, "ReceiveLogNew", message, logType as number, isRaw);
  }

  /** LOG:135-158. Runs on every client, the sender's first. */
  ReceiveLogNew(message: unknown, logTypeInt: unknown, raw: unknown): void {
    if (typeof message !== "string" || typeof logTypeInt !== "number") return;
    const sender = this.Networking.CallingPlayer;
    if (!sender) return; // not a player of this instance
    const thisLogType = logTypeInt as VRPGLogTypeValue;
    if (thisLogType !== VRPGLogType.IC && thisLogType !== VRPGLogType.OOC && thisLogType !== VRPGLogType.GM) return;
    const line = this._Stamp(sender, thisLogType, raw === true, message);
    if (line === "") return;

    switch (thisLogType) {
      case VRPGLogType.IC:
        this.Append(VRPGLogType.IC, line);
        this.PlayAlert();
        break;
      case VRPGLogType.OOC:
        this.Append(VRPGLogType.OOC, line);
        break;
      case VRPGLogType.GM:
        this.Append(VRPGLogType.GM, line);
        return; // never published (review finding 2)
    }
    if (this.Networking.IsMaster) this._PublishRecent();
  }

  /** The line a receiver shows for `sender`'s text (LOG:119-129, with the name taken from the event's sender). */
  _Stamp(sender: Player, logType: VRPGLogTypeValue, raw: boolean, message: string): string {
    const text = filterRichText(cleanTyped(message.startsWith("\n") ? message.slice(1) : message, MAX_TYPED, true));
    if (text === "") return "";
    const who = plainName(sender.displayName);
    const parts = text.split("\n");
    if (raw) return parts.map((part, i) => (i === 0 && (part.startsWith(who + " ") || UNNAMED_LINES.has(text)) ? part : `${who}: ${part}`)).join("\n");
    let name = who;
    if (logType === VRPGLogType.IC) {
      const character = this.VRPG.GetPlayerObject(sender)?.GetCharacterName() ?? "";
      if (character.trim() !== "") name = character;
    }
    return parts.map((part) => `${name}: ${part}`).join("\n");
  }

  /** LOG:160-178: a line for this client only. */
  SendLogLocal(message: string, logType: VRPGLogTypeValue): void {
    const line = message.startsWith("\n") ? message.slice(1) : message;
    switch (logType) {
      case VRPGLogType.IC:
        this.Append(VRPGLogType.IC, line);
        this.PlayAlert();
        break;
      case VRPGLogType.OOC:
        this.Append(VRPGLogType.OOC, line);
        break;
      case VRPGLogType.GM:
        this.Append(VRPGLogType.GM, line);
        break;
      case VRPGLogType.Debug:
        this.Debug.Log(Utils.MakeColor(`[${this.VRPG.GameName}]`, this.VRPG.LabelColor) + ": " + message);
        break;
    }
  }

  /** LOG:180-196 */
  SendLogIC(): void {
    this.SendLog(this.inputs[0]!.text, VRPGLogType.IC);
    this.inputs[0]!.text = "";
  }
  SendLogOOC(): void {
    this.SendLog(this.inputs[1]!.text, VRPGLogType.OOC);
    this.inputs[1]!.text = "";
  }
  SendLogGM(): void {
    this.SendLog(this.inputs[2]!.text, VRPGLogType.GM);
    this.inputs[2]!.text = "";
  }

  /** LOG:198-211 */
  ShowICLog(): void {
    this.ShowLogType(VRPGLogType.IC);
  }
  ShowOOCLog(): void {
    this.ShowLogType(VRPGLogType.OOC);
  }
  ShowGMLog(): void {
    this.ShowLogType(VRPGLogType.GM);
  }

  /** LOG:213-224, by activating the view objects. */
  private ShowLogType(thisLogType: VRPGLogTypeValue): void {
    this.shownLog = thisLogType;
    this.ICLogGroup.SetActive(thisLogType === VRPGLogType.IC);
    this.OOCLogGroup.SetActive(thisLogType === VRPGLogType.OOC);
    this.GMLogGroup.SetActive(thisLogType === VRPGLogType.GM);
  }

  /** The up button of the shown log: one page of older lines. */
  ScrollUp(): void {
    const k = this.shownLog;
    const most = Math.max(0, this.lines[k]!.length - this.viewLines);
    this.scroll[k] = Math.min(most, this.scroll[k]! + this.viewLines);
    this.Render(k);
  }

  /** The down button: back towards the newest line. */
  ScrollDown(): void {
    const k = this.shownLog;
    this.scroll[k] = Math.max(0, this.scroll[k]! - this.viewLines);
    this.Render(k);
  }

  /** The text a box shows now. */
  Shown(logType: VRPGLogTypeValue): string {
    return this.boxes[logType]?.Text ?? "";
  }

  // ---- the port's line buffers ---------------------------------------------------------------------------------

  private PlayAlert(): void {
    if (!this.VRPG.Options.ImAlertOn) return;
    this.alertsPlayed++;
    if (this.ImSound && this.ImClip) this.ImSound.PlayOneShot(this.ImClip);
  }

  private Append(k: VRPGLogTypeValue, line: string): void {
    const list = this.lines[k]!;
    list.push(line);
    while (list.length > this.maxLines) list.shift();
    this.Render(k);
  }

  private Render(k: VRPGLogTypeValue): void {
    const list = this.lines[k]!;
    const end = Math.max(0, list.length - this.scroll[k]!);
    const start = Math.max(0, end - this.viewLines);
    this.boxes[k]?.SetText(list.slice(start, end).join("\n"));
  }

  /** The referee publishes the newest IC and OOC lines it holds, for players who arrive later. */
  _PublishRecent(): void {
    if (!this.Networking.IsMaster) return;
    this.VRPG.GetLocalPlayerObject()?._PublishRecent([this._Newest(VRPGLogType.IC), this._Newest(VRPGLogType.OOC)]);
  }

  /** The last `log-recent` lines of a log, at most RECENT_CHARS characters in all. */
  private _Newest(k: VRPGLogTypeValue): string[] {
    const list = this.lines[k]!;
    const out: string[] = [];
    let chars = 0;
    for (let i = list.length - 1; i >= 0 && out.length < this.recentLines; i--) {
      chars += list[i]!.length;
      if (chars > RECENT_CHARS) break;
      out.unshift(list[i]!);
    }
    return out;
  }

  /**
   * Fills the boxes from the referee's recent lines, before the lines this client has received itself: where the
   * referee's list ends with lines this client already holds, they are not repeated.
   */
  _TakeRecent(from: VRPGPlayerObject): void {
    const recent = Array.isArray(from.recent) ? from.recent : [];
    if (!recent.some((list) => Array.isArray(list) && list.length)) return;
    this.recentTaken = true;
    for (const k of [VRPGLogType.IC, VRPGLogType.OOC]) {
      const theirs = (Array.isArray(recent[k]) ? recent[k]! : [])
        .filter((line): line is string => typeof line === "string")
        .slice(-Math.max(0, this.recentLines))
        .map((line) => filterRichText(cleanTyped(line, MAX_LINE, true)))
        .filter((line) => line !== "");
      if (!theirs.length) continue;
      const mine = this.lines[k]!;
      let overlap = Math.min(theirs.length, mine.length);
      while (overlap > 0 && !theirs.slice(theirs.length - overlap).every((line, i) => line === mine[i])) overlap--;
      const merged = theirs.concat(mine.slice(overlap));
      while (merged.length > this.maxLines) merged.shift();
      mine.splice(0, mine.length, ...merged);
      this.Render(k);
    }
  }
}
