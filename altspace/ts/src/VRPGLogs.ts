// Translated from VRPG2/Scripts/Core/VRPGLogs.cs (GIB Games, MIT).
//
// Three logs (in character, out of character, game master) and the console helpers. Differences, all listed in
// PORT.md:
//   - A line travels as a network event with its text (LOG:132), and the sender runs it at once (a one-shot does
//     not come back). `Networking.SetOwner` on every send (LOG:104) is a leftover of the synced-string version and
//     is not translated: here the referee owns the behaviour, see below.
//   - Every receiver cleans the line before showing it: control characters other than line breaks removed, only
//     <color>, <b> and <i> kept, at most 700 characters (PORT.md C6, C7). Typed text is cut at 500.
//   - The boxes keep the last `log-lines` lines (default 60) and show the newest `log-view` (default 12), with up
//     and down buttons, instead of growing without end in a scroll view (C7, C12).
//   - Recent lines for late joiners (coordinator decision; upstream shows a late joiner nothing, LOG:143-150): the
//     referee appends every line it receives to the synced lists `recentIC`, `recentOOC`, `recentGM` (the last
//     `log-recent` lines each, default 20), and a client that joins later fills its boxes from that snapshot.
//   - A tab is shown by activating its view object instead of CanvasGroup alpha (LOG:213-224; G8).
//   - GM-log lines reach every client and are only hidden from non-staff, as upstream (LOG:132-150, Q6).

import { NetworkEventTarget, type AudioClipRef, type AudioSourceRef, type DeserializationResult, type GameObject } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { VRPGInputField, VRPGTextElement } from "./VRPGTextElement.ts";
import { Utils, cleanTyped, filterRichText } from "./VRPGUtils.ts";

/** LOG:294-300 */
export const VRPGLogType = { IC: 0, OOC: 1, GM: 2, Debug: 3 } as const;
export type VRPGLogTypeValue = (typeof VRPGLogType)[keyof typeof VRPGLogType];

/** Longest typed message, and longest line a receiver shows (a name and a prefix fit in the difference). */
export const MAX_TYPED = 500;
export const MAX_LINE = 700;

export class VRPGLogs extends VRPGComponent {
  static override synced = ["recentIC", "recentOOC", "recentGM"];
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

  /** Synced, written by the referee only: the newest lines, for players who arrive later. */
  recentIC: string[] = [];
  recentOOC: string[] = [];
  recentGM: string[] = [];

  /** Lines each box holds (oldest first) and how far each is scrolled back from the newest. */
  readonly lines: string[][] = [[], [], []];
  private readonly scroll = [0, 0, 0];
  private boxes: VRPGTextElement[] = [];
  private inputs: VRPGInputField[] = [];
  shownLog: VRPGLogTypeValue = VRPGLogType.OOC;
  /** Times the IC alert was asked to play here (tests read it). */
  alertsPlayed = 0;

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

  /** LOG:100-133 */
  SendLog(message: string, logType: VRPGLogTypeValue, isRaw = false): void {
    message = cleanTyped(message, MAX_TYPED, true);
    if (message === "") return;

    if (logType === VRPGLogType.Debug) {
      this.NetworkDebugLog(message);
      return;
    }

    let newLogText = message;
    const intLogType = logType as number;

    if (isRaw) {
      newLogText = "\n" + newLogText;
    } else if (intLogType === VRPGLogType.IC) {
      const logCharName = (this.VRPG.GetLocalPlayerObject()?.GetCharacterName() ?? "") + "";
      newLogText = `\n${logCharName}: ${newLogText}`;
    } else {
      newLogText = `\n${this.Networking.LocalPlayer.displayName}: ${newLogText}`;
    }

    this.SendCustomNetworkEvent(NetworkEventTarget.All, "ReceiveLogNew", newLogText, intLogType);
  }

  /** LOG:135-158. Runs on every client, the sender's first. */
  ReceiveLogNew(message: unknown, logTypeInt: unknown): void {
    if (typeof message !== "string" || typeof logTypeInt !== "number") return;
    const thisLogType = logTypeInt as VRPGLogTypeValue;
    const line = filterRichText(cleanTyped(message.startsWith("\n") ? message.slice(1) : message, MAX_LINE, true));
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
        break;
      case VRPGLogType.Debug:
        this.Debug.Log(line);
        return;
      default:
        return;
    }
    if (this.Networking.IsMaster) this._Remember(thisLogType, line);
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

  private _Remember(k: VRPGLogTypeValue, line: string): void {
    const keep = this.recentLines;
    if (keep <= 0) return;
    const field = k === VRPGLogType.IC ? "recentIC" : k === VRPGLogType.OOC ? "recentOOC" : "recentGM";
    const next = this[field].concat([line]);
    this[field] = next.slice(Math.max(0, next.length - keep));
    this.RequestSerialization();
  }

  /** A player arriving later gets the referee's recent lines; later changes arrive as events, not through here. */
  override OnDeserialization(result: DeserializationResult): void {
    if (!result.isSnapshot) return;
    const recent = [this.recentIC, this.recentOOC, this.recentGM];
    for (const k of [VRPGLogType.IC, VRPGLogType.OOC, VRPGLogType.GM]) {
      const list = this.lines[k]!;
      if (list.length) continue;
      for (const line of recent[k] ?? []) if (typeof line === "string") list.push(filterRichText(cleanTyped(line, MAX_LINE, true)));
      this.Render(k);
    }
  }
}
