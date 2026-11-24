// Translated from VRPG2/Scripts/Systems/D&D 5E/DiceRoller5E.cs (GIB Games, MIT), renamed by decision: upstream
// names this roller after another publisher's game; here it is the generic "d20 roller" (PORT.md Q10).
//
// A dice pool (d4 to d20) with a modifier, and single d20 rolls with advantage and disadvantage. Differences:
//   - UpdateDicePoolBoxText reads one element past the end of the pool on every update (`i <= dicePool.Count`,
//     D5E:129). Udon stops a behaviour at such a read, so upstream's roller would halt on the first die added; the
//     port's loop stops at the last element (PORT.md C11, Q9).
//   - Roll20, Roll20Advantage and Roll20Disadvantage (D5E:19-39) have no button upstream; the kit adds three.
//   - The d2 button (wired to BoxAddD20) and the inactive d100 button are left out (checklist 39, Dead).
// Results go through SendResult, which is not raw, so the log line names the roller twice, as upstream (D5E:122,
// LOG:119-129).

import type { GameObject } from "../portkit/src/index.ts";
import { VRPGRollerBase } from "./VRPGRollerBase.ts";
import { VRPGTextElement } from "./VRPGTextElement.ts";

export class DiceRollerD20 extends VRPGRollerBase {
  // From bindings.json.
  dicePoolBoxTextObject: GameObject | null = null;
  modLabelObject: GameObject | null = null;

  private dicePoolBoxText: VRPGTextElement | null = null;
  private modLabel: VRPGTextElement | null = null;
  currentMod = 0;
  /** D5E:17, a DataList of strings. */
  readonly dicePool: string[] = [];

  override Start(): void {
    super.Start();
    if (this.dicePoolBoxTextObject) this.dicePoolBoxText = new VRPGTextElement(this.Host, this.dicePoolBoxTextObject.key);
    if (this.modLabelObject) this.modLabel = new VRPGTextElement(this.Host, this.modLabelObject.key);
    this.UpdateDicePoolBoxText();
  }

  /** D5E:19-23 */
  Roll20(): void {
    if (this.FromRemote()) return;
    const result = this.RollInt(1, 21) + this.currentMod;
    this.SendResult(`${this.Networking.LocalPlayer.displayName} rolled 1d20 ${this.GetModString()}: ${result}`);
  }

  /** D5E:25-31 */
  Roll20Advantage(): void {
    if (this.FromRemote()) return;
    const roll1 = this.RollInt(1, 21);
    const roll2 = this.RollInt(1, 21);
    const result = Math.max(roll1, roll2) + this.currentMod;
    this.SendResult(`${this.Networking.LocalPlayer.displayName} rolled 1d20 with advantage ${this.GetModString()}: ${result} (Rolls: ${roll1}, ${roll2})`);
  }

  /** D5E:33-39 */
  Roll20Disadvantage(): void {
    if (this.FromRemote()) return;
    const roll1 = this.RollInt(1, 21);
    const roll2 = this.RollInt(1, 21);
    const result = Math.min(roll1, roll2) + this.currentMod;
    this.SendResult(`${this.Networking.LocalPlayer.displayName} rolled 1d20 with disadvantage ${this.GetModString()}: ${result} (Rolls: ${roll1}, ${roll2})`);
  }

  /** D5E:41-44 */
  GetModString(): string {
    return (this.currentMod < 0 ? `<color="red"> - ${this.currentMod * -1}` : `<color="green"> + ${this.currentMod}`) + "</color>";
  }

  /** D5E:47-81 */
  BoxAddD20(): void {
    this._Add("d20");
  }
  BoxAddD12(): void {
    this._Add("d12");
  }
  BoxAddD10(): void {
    this._Add("d10");
  }
  BoxAddD8(): void {
    this._Add("d8");
  }
  BoxAddD6(): void {
    this._Add("d6");
  }
  BoxAddD4(): void {
    this._Add("d4");
  }

  private _Add(die: string): void {
    if (this.FromRemote()) return;
    if (this.dicePool.length >= 40) return; // a pool line must fit the log (the port's limit)
    this.dicePool.push(die);
    this.UpdateDicePoolBoxText();
  }

  /** D5E:83-87 */
  ResetBox(): void {
    if (this.FromRemote()) return;
    this.dicePool.length = 0;
    this.UpdateDicePoolBoxText();
  }

  /** D5E:89-123 */
  RollBox(): void {
    if (this.FromRemote()) return;
    let total = 0;
    let diceResults = "";
    for (let i = 0; i <= this.dicePool.length - 1; i++) {
      let roll = 0;
      switch (this.dicePool[i]) {
        case "d20":
          roll = this.RollInt(1, 21);
          break;
        case "d12":
          roll = this.RollInt(1, 13);
          break;
        case "d10":
          roll = this.RollInt(1, 11);
          break;
        case "d8":
          roll = this.RollInt(1, 9);
          break;
        case "d6":
          roll = this.RollInt(1, 7);
          break;
        case "d4":
          roll = this.RollInt(1, 5);
          break;
      }
      total += roll;
      diceResults += `${this.dicePool[i]}: ${roll}, `;
    }
    total += this.currentMod;
    const modString = this.currentMod < 0 ? `- ${this.currentMod * -1}` : `+ ${this.currentMod}`;
    this.SendResult(`${this.Networking.LocalPlayer.displayName} rolled ${diceResults}Total ${modString}: ${total}`);
  }

  /** D5E:126-135, with the loop bound fixed (`<`, not `<=`). */
  UpdateDicePoolBoxText(): void {
    let dicePoolText = "Dice Pool: ";
    for (let i = 0; i < this.dicePool.length; i++) dicePoolText += this.dicePool[i] + " ";
    this.modLabel?.SetText(String(this.currentMod));
    this.dicePoolBoxText?.SetText(trimEnd(dicePoolText) + this.GetModString());
  }

  /** The text the pool box shows now (tests read it). */
  get PoolText(): string {
    return this.dicePoolBoxText?.Text ?? "";
  }

  /** D5E:138-146 */
  IncreaseMod(): void {
    this.SetMod(this.currentMod + 1);
  }
  DecreaseMod(): void {
    this.SetMod(this.currentMod - 1);
  }
  ResetMod(): void {
    this.SetMod(0);
  }

  SetMod(target: number): void {
    if (this.FromRemote()) return;
    if (!Number.isInteger(target)) return;
    this.currentMod = target;
    this.UpdateDicePoolBoxText();
  }
}

/** C#'s string.TrimEnd(): removes trailing white space. */
function trimEnd(text: string): string {
  return text.replace(/\s+$/, "");
}
