// Translated from VRPG2/Scripts/Core/VRPGMenu.cs (GIB Games, MIT).
//
// The local menu board: nothing about it is networked (MENU:21-22). Open puts it `menu-distance` (0.9 m, MENU:92)
// in front of the head with the head's rotation; close puts it back where the snippet parked it (MENU:43-47, 79-83).
// Differences: the head pose is the last one the page was given (it is sent only while the player moves; before
// any, the board opens where it is); the panels are the four the port keeps (Main, Social, Options, GM: the
// Character and Powers panels are removed by decision and the Map left out), and the board starts on Main only
// (PORT.md C10). `hide-when-closed` hides the board instead of parking it. The name and title fields are the
// page's copies (VRPGInputField). Name and title are cut to 64 and 128 characters.

import { Quaternion, Vector3, type GameObject, type Player } from "../portkit/src/index.ts";
import { VRPGComponent } from "./VRPGComponent.ts";
import { MAX_NAME, MAX_TITLE } from "./VRPGPlayerObject.ts";
import { VRPGInputField, VRPGTextElement } from "./VRPGTextElement.ts";
import { Utils, cleanTyped } from "./VRPGUtils.ts";

export class VRPGMenu extends VRPGComponent {
  // From bindings.json (MENU:24-39).
  nameFieldObject!: GameObject;
  titleFieldObject!: GameObject;
  panels: GameObject[] = [];
  characterNamePlateObject: GameObject | null = null;
  characterTitlePlateObject: GameObject | null = null;
  playerNamePlateObject: GameObject | null = null;
  playerTitlePlateObject: GameObject | null = null;
  captionObject: GameObject | null = null;

  nameField!: VRPGInputField;
  titleField!: VRPGInputField;
  private characterNamePlate: VRPGTextElement | null = null;
  private characterTitlePlate: VRPGTextElement | null = null;
  private playerNamePlate: VRPGTextElement | null = null;
  private playerTitlePlate: VRPGTextElement | null = null;

  /** MENU:31-33 */
  MenuIsOpen = false;
  private menuStartPosition = Vector3.zero;
  private menuStartRotation = Quaternion.identity;
  /** The panel shown now. */
  shownPanel = 0;

  /** MENU:43-47 */
  override Start(): void {
    this.menuStartPosition = this.transform.position;
    this.menuStartRotation = this.transform.rotation;
    const text = (o: GameObject | null) => (o ? new VRPGTextElement(this.Host, o.key) : null);
    this.characterNamePlate = text(this.characterNamePlateObject);
    this.characterTitlePlate = text(this.characterTitlePlateObject);
    this.playerNamePlate = text(this.playerNamePlateObject);
    this.playerTitlePlate = text(this.playerTitlePlateObject);
    this.nameField = new VRPGInputField(this.Host, this.nameFieldObject.key, MAX_NAME);
    this.titleField = new VRPGInputField(this.Host, this.titleFieldObject.key, MAX_TITLE);
    this.RegisterGraphEvent("field", "_OnField");
    const caption = this.Settings.get("title-text");
    text(this.captionObject)?.SetText(caption !== undefined && caption !== "" ? caption : "VRpg RP System");
    this._ShowPanel(0);
    if (this.HideWhenClosed) this.gameObject.SetActive(false);
  }

  _OnField(key: string, text: string): void {
    if (key === this.nameField.key) this.nameField.Typed(text);
    else if (key === this.titleField.key) this.titleField.Typed(text);
  }

  private get HideWhenClosed(): boolean {
    return this.VRPG.ConfigData.GetBool("hide-when-closed");
  }

  /** Where the board is parked while closed. */
  get ParkedPosition(): Vector3 {
    return this.menuStartPosition.clone();
  }

  /** MENU:49-57 */
  override OnPlayerJoined(player: Player): void {
    if (!player.isLocal) return;
    this.characterNamePlate?.SetText("");
    this.characterTitlePlate?.SetText("");
    this.playerNamePlate?.SetText(player.displayName);
    this.playerTitlePlate?.SetText("");
  }

  /** MENU:59-69 */
  SwapMenuState(): void {
    if (this.FromRemote()) return;
    if (this.MenuIsOpen) this._Close();
    else this._Open();
  }

  /** MENU:73-77 */
  OpenMenu(): void {
    if (this.FromRemote()) return;
    this._Open();
  }

  /** MENU:79-83 */
  CloseMenu(): void {
    if (this.FromRemote()) return;
    this._Close();
  }

  _Open(): void {
    this.MenuIsOpen = true;
    if (this.HideWhenClosed) this.gameObject.SetActive(true);
    this.PositionMenu();
  }

  _Close(): void {
    this.MenuIsOpen = false;
    this.transform.SetPositionAndRotation(this.menuStartPosition, this.menuStartRotation);
    if (this.HideWhenClosed) this.gameObject.SetActive(false);
  }

  /** MENU:85-93 */
  PositionMenu(): void {
    const head = this.Input.Poses?.head ?? null;
    const playerHeadPos = head ? head.position : this.Input.Position;
    if (!playerHeadPos) return;
    const playerHeadRot = head ? head.rotation : Quaternion.identity;
    const distance = this.VRPG.ConfigData.GetNumber("menu-distance", 0.9);
    this.transform.SetPositionAndRotation(playerHeadPos.add(playerHeadRot.rotate(Vector3.forward).scale(distance)), playerHeadRot);
  }

  /** MENU:95-99 */
  SetNameAndTitleInputValues(name: string, title: string): void {
    if (this.FromRemote()) return;
    this.nameField.text = name;
    this.titleField.text = title;
  }

  /** MENU:101-114 */
  SetCharacterName(charName: string): void {
    if (this.FromRemote()) return;
    this.characterNamePlate?.SetText(charName);
  }
  SetCharacterTitle(charTitle: string): void {
    if (this.FromRemote()) return;
    this.characterTitlePlate?.SetText(charTitle);
  }
  SetPlayerTitle(playerTitle: string): void {
    if (this.FromRemote()) return;
    this.playerTitlePlate?.SetText(playerTitle);
  }

  /** MENU:118-133 */
  ShowPanel(index: number): void {
    if (this.FromRemote()) return;
    this._ShowPanel(index);
  }

  _ShowPanel(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.panels.length) return;
    for (let i = 0; i < this.panels.length; i++) this.panels[i]!.SetActive(i === index);
    this.shownPanel = index;
  }

  /** MENU:135-142 */
  SetNameAndTitle(): void {
    if (this.FromRemote()) return;
    const mine = this.VRPG.GetLocalPlayerObject();
    if (mine) {
      const name = cleanTyped(this.nameField.text, MAX_NAME, false);
      const title = cleanTyped(this.titleField.text, MAX_TITLE, false);
      mine.SetNameAndTitle(name, title);
      this.SetPlates(name, title);
    }
  }

  /** MENU:144-149 */
  SetOOC(): void {
    if (this.FromRemote()) return;
    const oocColorHex = Utils.GetColorHex(this.VRPG.OocLabelColor);
    this.VRPG.GetLocalPlayerObject()?.SetNameAndTitle(`<color=#${oocColorHex}>Out of Character</color>`, this.Networking.LocalPlayer.displayName);
  }

  /** MENU:151-155 */
  SetHidden(): void {
    if (this.FromRemote()) return;
    this.VRPG.GetLocalPlayerObject()?.SetNameAndTitle("", "");
  }

  /** MENU:157-163 */
  SetPlates(newPlateName: string, newPlateTitle: string): void {
    if (this.FromRemote()) return;
    this.characterNamePlate?.SetText(newPlateName);
    this.characterTitlePlate?.SetText(newPlateTitle);
    this.RefreshPlates();
  }

  /** The player plates (MENU:161-162), again after the local player's role changed. */
  RefreshPlates(): void {
    const me = this.Networking.LocalPlayer;
    this.playerNamePlate?.SetText(me.displayName);
    this.playerTitlePlate?.SetText(this.VRPG.GMData.GiveModeratorLabelColor(me));
  }

  /** What a plate shows now (tests read it). */
  Plate(which: "characterName" | "characterTitle" | "playerName" | "playerTitle"): string {
    const plate = { characterName: this.characterNamePlate, characterTitle: this.characterTitlePlate, playerName: this.playerNamePlate, playerTitle: this.playerTitlePlate }[which];
    return plate?.Text ?? "";
  }
}
