// Translated from VRPG2/Scripts/Components/DiceRollerDS.cs (GIB Games, MIT).
//
// The roller in the menu: an attack and a defence d20 (DS:38-39), modifiers from two input fields read with
// int.TryParse (DS:44-45), optional threat from two dropdowns that are inactive in the prefab (DS:53-54), the
// result as one raw line in the OOC or GM log (DS:109-116), and up to three re-rolls on a tie (DS:127-137).
// Differences: the fields are the page's copies (VRPGInputField), the dropdowns are cycle buttons with a label
// (hidden unless the setting `ds-threat` is "true"), and the toggle is the base class's button (PORT.md G8).
// The roller's own client rolls and sends finished text, as upstream: nobody can check a roll (PORT.md 3.5, Q8).

import type { GameObject } from "../portkit/src/index.ts";
import { VRPGRollerBase } from "./VRPGRollerBase.ts";
import { VRPGInputField, VRPGTextElement } from "./VRPGTextElement.ts";
import { tryParseInt } from "./VRPGUtils.ts";

export class DiceRollerDS extends VRPGRollerBase {
  // From bindings.json.
  attBoxObject!: GameObject;
  defBoxObject!: GameObject;
  attDropObject: GameObject | null = null;
  defDropObject: GameObject | null = null;
  attDropLabel: GameObject | null = null;
  defDropLabel: GameObject | null = null;

  attBox!: VRPGInputField;
  defBox!: VRPGInputField;
  /** TMP_Dropdown.value of the two threat dropdowns: 0, 1 or 2 (shown as +0, +1, +2). */
  attDropValue = 0;
  defDropValue = 0;
  /** DS:23, a byte upstream. */
  private diceIterations = 0;

  override Start(): void {
    super.Start();
    this.attBox = new VRPGInputField(this.Host, this.attBoxObject.key, 16);
    this.defBox = new VRPGInputField(this.Host, this.defBoxObject.key, 16);
    this.RegisterGraphEvent("field", "_OnField");
    const threat = this.VRPG.ConfigData.GetBool("ds-threat");
    this.attDropObject?.SetActive(threat);
    this.defDropObject?.SetActive(threat);
    this._ShowDrops();
  }

  _OnField(key: string, text: string): void {
    if (key === this.attBox.key) this.attBox.Typed(text);
    else if (key === this.defBox.key) this.defBox.Typed(text);
  }

  /** DS:26-30 */
  NewRoll(): void {
    if (this.FromRemote()) return;
    this.diceIterations = 0;
    this.Roll();
  }

  /** DS:32-117 */
  Roll(): void {
    if (this.FromRemote()) return;
    // get character name
    const myName = `${this.Networking.LocalPlayer.displayName}`;

    // roll the dice (upstream's comment says d10s; Random.Range(1, 21) is a d20)
    const attRoll = this.RollInt(1, 21);
    const defRoll = this.RollInt(1, 21);

    // get entered modifiers and check if they have valid modifier values
    const att = tryParseInt(this.attBox.text);
    const def = tryParseInt(this.defBox.text);
    const hasAttMod = att.ok;
    const hasDefMod = def.ok;
    void hasAttMod; // read nowhere upstream either (DS:44)
    const attValue = att.value;
    const defValue = def.value;

    // calculate total
    const attTotal = attValue + attRoll;
    const defTotal = defValue + defRoll;
    const isTie = attTotal === defTotal;

    // get +0, +1, or +2 threat
    const attThreat = this.attDropValue;
    const defThreat = this.defDropValue;

    // either side is exceptional if they rolled inside the threat range
    const attExSuccess = attRoll + attThreat >= 20;
    const defExSuccess = defRoll + defThreat >= 20;

    // determine winner
    const shouldWin = attRoll !== 1 && (attTotal > defTotal || defRoll === 1);
    const fullBotch = attRoll === 1 && defRoll === 1;

    // create color string for die roll
    const attColorDie = (attExSuccess ? "<color=#00FF00>" : attRoll === 1 ? "<color=#FF5500>" : "<color=#FFFFFF>") + `${attRoll}</color>`;
    const defColorDie = (defExSuccess ? "<color=#00FF00>" : defRoll === 1 ? "<color=#FF5500>" : "<color=#FFFFFF>") + `${defRoll}</color>`;

    let successString = "";

    if (hasDefMod && fullBotch) {
      successString = "Both players rolled a 1! <color=#FF5500>You both suck!</color>";
    } else if (hasDefMod && isTie) {
      this.diceIterations = (this.diceIterations + 1) & 0xff;
      successString = "Tie! Rerolling!";
      this.DoTieReroll();
    } else if (shouldWin) {
      successString += "<color=#00FF00>";
      if (attExSuccess) successString += "Exceptional ";
      successString += "Success!</color>";
    } else {
      successString += "<color=#FF5500>";
      if (defExSuccess) successString += "Exceptional ";
      successString += "Defense!</color>";
    }

    let resultString: string;
    if (hasDefMod) {
      // player v player
      resultString = `${myName} rolled ${attColorDie} + ${attValue} = ${attTotal} v. ${defColorDie} + ${defValue} = ${defTotal}: ${successString}`;
    } else {
      // single roll
      resultString = `${myName} rolled ${attColorDie} + ${attValue} = ${attTotal}!`;
    }

    if (this.gmToggleOn) this.VRPG.Logger.LogGMRaw(resultString);
    else this.VRPG.Logger.LogRaw(resultString);
  }

  /** DS:119-125 */
  ClearBox(): void {
    if (this.FromRemote()) return;
    this.attBox.text = "";
    this.defBox.text = "";
    this.attDropValue = 0;
    this.defDropValue = 0;
    this._ShowDrops();
  }

  /** DS:127-137 */
  DoTieReroll(): void {
    if (this.FromRemote()) return;
    if (this.diceIterations > 2) {
      this.VRPG.Logger.LogRaw("Too many rerolls due to tie. Please try again!");
    } else {
      this.SendCustomEventDelayedSeconds("Roll", 1);
    }
  }

  /** The attack threat button: +0, +1, +2, then +0 again (a dropdown upstream). */
  CycleAttThreat(): void {
    if (this.FromRemote()) return;
    this.attDropValue = (this.attDropValue + 1) % 3;
    this._ShowDrops();
  }

  CycleDefThreat(): void {
    if (this.FromRemote()) return;
    this.defDropValue = (this.defDropValue + 1) % 3;
    this._ShowDrops();
  }

  private _ShowDrops(): void {
    if (this.attDropLabel) new VRPGTextElement(this.Host, this.attDropLabel.key).SetText(`+${this.attDropValue}`);
    if (this.defDropLabel) new VRPGTextElement(this.Host, this.defDropLabel.key).SetText(`+${this.defDropValue}`);
  }
}
