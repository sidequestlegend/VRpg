// The rp-toolkit kit: VRpg 2's "VRPG Manager.prefab" (GIBGames/VRpg, folder VRPG2/, MIT, Copyright (c) 2024 GIB Games)
// made into a kit the snippet script loads: its world-space menu (uGUI, kept), a pool of 32 name labels made from
// VRpgPlayerObject.prefab, the d20 roller from "Dice 5E.prefab", the fade sphere and target, the floor grid and the two
// alert sounds. What changes against upstream, and why, is in altspace/PORT.md (0.2, 0.6 and section 10).
//
// Buttons stay uGUI buttons: the relay graph hears Button.onClick and tells the page (event uiButton); text fields stay
// TMP_InputFields, which the relay graph polls (event field) and the page writes (op text). The canvas keeps its
// GraphicRaycaster (uGUI is clicked through it, and a field needs it to take focus).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using Newtonsoft.Json.Linq;
using PortKit;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.Animations;
using UnityEngine.Rendering;
using UnityEngine.UI;
using Object = UnityEngine.Object;

namespace RpToolkit
{
    public sealed class RpToolkitKitBuilder : KitBuilder
    {
        public const string Up = "Assets/Upstream/VRPG2";
        public const string ManagerPrefab = Up + "/VRPG Manager.prefab";
        public const string PlayerPrefab = Up + "/Prefabs/VRpgPlayerObject.prefab";
        public const string Dice5EPrefab = Up + "/Scripts/Systems/D&D 5E/Dice 5E.prefab";
        public const string FadePrefab = Up + "/Prefabs/FadeSphere.prefab";
        const string Kit = "Assets/Kit";
        const string MaterialFolder = Kit + "/Materials";
        const string TextureFolder = Kit + "/Textures";
        const string FontFolder = Kit + "/Fonts";

        /// <summary>Name labels in the kit (PORT.md R10): one per player present, up to this many.</summary>
        public const int Labels = 32;
        /// <summary>Rows of the player list on one page: the upstream scroll view showed 2 x 4 of its 84 at a time.</summary>
        public const int Rows = 8;
        /// <summary>How far above its head attachment a label's canvas sits (PO:106; VRPGPlayerObject.ts KIT_LABEL_HEIGHT).</summary>
        public const float LabelHeight = 0.75f;

        public override string Slug => "rp-toolkit";
        public override string Title => "Roleplay Toolkit";
        public override bool Single => true;
        public override string Summary => "A roleplay and game-master toolkit: player menu, names and titles, two dice rollers, in- and out-of-character logs, GM roles and teleports, name labels.";
        public override string Description =>
            "A port of VRpg 2 by GIB Games (https://github.com/GIBGames/VRpg, MIT). Press Q (or the board's Open button) for the menu: " +
            "set a character name and title shown over your head, roll the DS (attack against defence) or the d20 pool roller, chat in " +
            "character, out of character or to the game masters. The world's owner and moderators are game masters: they can grant " +
            "roles, bring players, teleport everyone to points A to F and respawn everyone. Saved names follow the device.";
        /// <summary>Where the menu board is parked while closed.</summary>
        public override string SnippetPosition => "0 1.5 0";
        /// <summary>The photo shows the menu board (the floor grid is 20 m, the labels are a pool of 32).</summary>
        public override string PhotoRoot => "VRPG Manager/VRPG Local Menu";
        /// <summary>
        /// The box gizmo: the floor grid's default size (`grid-size` 20 x 20 m, on by default). The footprint the kit would
        /// work out is empty: the board is uGUI (no renderers) and every other part starts switched off.
        /// </summary>
        public override string GizmoSize => "20 0.2 20";
        public override IReadOnlyList<(string name, string value)> SnippetSettings => new[]
        {
            ("title-text", "VRpg RP System"), ("game-name", "Your Game Name!"), ("menu-key", "Q"), ("menu-button", "left-secondary"),
            ("menu-distance", "0.9"), ("hide-when-closed", "false"), ("labels", "true"), ("label-height", "0.75"), ("dice", "ds"),
            ("gm-title", "Game Master"), ("gm-abbr", "GM"), ("staff-title", "Operator"), ("staff-abbr", "O"), ("lead-title", "Instance Lead"),
            ("lead-abbr", "L"), ("staff-uids", ""), ("no-staff-uids", ""), ("vip-uids", ""), ("credits", ""), ("enable-operators", "true"),
            ("disable-gm-bring", "false"), ("first-joiner-gm", "false"), ("teleport-points", "0"),
            ("tp-a", "0 0 0"), ("tp-b", "0 0 0"), ("tp-c", "0 0 0"), ("tp-d", "0 0 0"), ("tp-e", "0 0 0"), ("tp-f", "0 0 0"),
            ("exile-room", "false"), ("tp-exile", ""), ("respawn", ""), ("grid", "true"), ("grid-position", ""), ("grid-size", "20 20"),
            ("alert-volume", "0.2"), ("log-lines", "60"),
        };

        // ---- what Compose made, for Finishing ----
        GameObject manager;
        TMP_FontAsset roboto;

        static readonly Color Gold = new Color(0.745f, 0.623f, 0.063f);

        protected override void Compose(KitStage stage)
        {
            var upstream = Load<GameObject>(ManagerPrefab);
            manager = stage.Copy(upstream, null, "VRPG Manager");
            Transform F(string path) => manager.transform.Find(path) ?? throw new Exception($"the upstream prefab has no '{path}'");
            foreach (var t in manager.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = 0;    // VRChat's layers mean nothing here

            roboto = Fonts();
            var M = F("VRPG Local Menu");
            var canvas = F("VRPG Local Menu/Menu Canvas");
            string P = "VRPG Local Menu/Menu Canvas/Panels";

            // ---- removed by decision or left out (PORT.md 0.2, 10.2): the objects go, so nothing of them ships ----
            foreach (var path in new[]
            {
                "VRPG GM Handler/Teleport Points", "VRPG Character", "VRPG Regions", "VRPG Voice Controller", "TeleTarget", "VRPG Menu Caller",
                "VRPG Behaviors/VRPG Whitelists", "VRPG Behaviors/World version Check", "VRPG Behaviors/VRPG Randomizers",
                "VRPG Local Menu/Menu Canvas/Navigation/Character", "VRPG Local Menu/Menu Canvas/Navigation/Powers", "VRPG Local Menu/Menu Canvas/Navigation/Map",
                P + "/Panel 1 - Character", P + "/Panel 2 - Powers", P + "/Panel 3 - Map", P + "/JanUi",
                P + "/Panel 0 - Main/Actions/RPS", P + "/Panel 0 - Main/Actions/Spends",
                P + "/Panel 0 - Main/Log/Logs/GM Log /TryButton",                           // the author's back door (TryElevate)
                P + "/OperUI/Exile", P + "/OperUI/Unexile",
                P + "/Panel 6 - GM/STVoice", P + "/Panel 6 - GM/STSpeed", P + "/Panel 6 - GM/Janitor", P + "/Panel 6 - GM/FeepleButton", P + "/Panel 6 - GM/FeepleBox",
                P + "/Panel 5 - Options/IconButtons", P + "/Panel 5 - Options/Sections/togglePostProcessing", P + "/Panel 5 - Options/Sections/toggleReflections",
                P + "/Panel 5 - Options/Sections/toggleChairs", P + "/Panel 5 - Options/Sections/toggleSnow", P + "/Panel 5 - Options/Sections/gridSlider",
            })
                Object.DestroyImmediate(F(path).gameObject);

            // ---- the behaviour holders stood where the upstream world had them (the teleporter 32 m away): at the root now, so
            //      the kit's footprint is the board and the floor grid ----
            foreach (Transform t in F("VRPG Behaviors")) t.localPosition = Vector3.zero;

            // ---- the board: parked at the snippet's position, readable from the snippet's -Z side ----
            M.localPosition = Vector3.zero;
            M.localRotation = Quaternion.identity;
            canvas.localScale = new Vector3(0.003f, 0.003f, 0.003f);
            var menuStandIn = StandIn(M, "VRPGMenu");

            // ---- uGUI clean-up: no built-in sprites, no missing material, texts do not catch the pointer ----
            CleanUi(manager);

            var gmStandIn = StandIn(F("VRPG GM Handler"), "VRPGGameMasterData");
            var logStandIn = StandIn(F("VRPG Behaviors/VRPG Logger"), "VRPGLogs");
            var socialStandIn = StandIn(F("VRPG Behaviors/VRPG Social Panel"), "VRPGSocial");
            var dsStandIn = StandIn(F(P + "/Panel 0 - Main/Actions/Dice DS"), "DiceRollerDS");

            // ======== behaviours (plain: the TypeScript classes' fields, PORT.md 7) and their objects ========
            var root = manager;
            stage.Object(root, key: "manager");
            // (KitStage keeps the JObject a plain behaviour is given: the fields are filled in below, once their objects exist)
            JObject fMgr = new JObject(), fGm = new JObject(), fLogs = new JObject(), fSocial = new JObject(), fTele = new JObject(),
                fOptions = new JObject(), fPatrons = new JObject(), fMenu = new JObject(), fDs = new JObject(), fD20 = new JObject();
            var tMgr = stage.Behaviour(root, "VRPGManager", fMgr);
            var tConfig = stage.Behaviour(root, "VRPGConfigData");
            var tGm = stage.Behaviour(root, "VRPGGameMasterData", fGm);
            var tLogs = stage.Behaviour(root, "VRPGLogs", fLogs);
            var tSocial = stage.Behaviour(root, "VRPGSocial", fSocial);
            var tTele = stage.Behaviour(root, "VRPGPlayerTeleport", fTele);
            var tOptions = stage.Behaviour(root, "VRPGOptions", fOptions);
            var tPatrons = stage.Behaviour(root, "VRPGPatronData", fPatrons);
            stage.PerPlayer(stage.Behaviour(root, "VRPGPlayerObject"));                 // one per player, synced through their user state
            stage.Object(M.gameObject, key: "menu");
            var tMenu = stage.Behaviour(M.gameObject, "VRPGMenu", fMenu);

            GameObject O(string key, Transform t, bool reference = true)
            {
                stage.Object(t.gameObject, key: key);
                if (reference) stage.Ref(t.gameObject);
                return t.gameObject;
            }
            JObject Obj(GameObject go) => stage.ObjectValue(go);
            void Ui(GameObject go, object behaviour, string method) { MakeButton(go); stage.Event(go, "uiButton", behaviour, method); }

            // ---- header, caption, navigation ----
            var caption = O("caption", canvas.Find("Game Logo/Text (TMP)"));
            var plates = new[] { "characterNamePlate", "characterTitlePlate", "playerNamePlate", "playerTitlePlate" }
                .Select((f, i) => O(new[] { "plateCharName", "plateCharTitle", "platePlayerName", "platePlayerTitle" }[i], Ref(menuStandIn, f).transform)).ToArray();
            var close = O("closeButton", canvas.Find("Base GUI/CloseButton/Button"));
            Ui(close, tMenu, "CloseMenu");
            var openButton = NewButton(canvas.Find("Base GUI"), "Open Button", "Open", new Vector2(185f, 175f), new Vector2(60f, 30f), new Color(0.2f, 0.39f, 0.39f));
            O("openButton", openButton.transform);
            var tCaller = stage.Behaviour(openButton, "VRPGMenuCaller");
            stage.Event(openButton, "uiButton", tCaller, "Interact");

            var panelPaths = new[] { "Panel 0 - Main", "Panel 4 - Social", "Panel 5 - Options", "Panel 6 - GM" };
            var panels = panelPaths.Select((p, i) => O(new[] { "panelMain", "panelSocial", "panelOptions", "panelGM" }[i], F(P + "/" + p))).ToArray();
            var navNames = new[] { "MainMenu", "Social", "Options", "GM" };
            var navKeys = new[] { "navMain", "navSocial", "navOptions", "navGM" };
            var navTokens = new object[4];
            GameObject navGm = null;
            for (int i = 0; i < 4; i++)
            {
                var nav = O(navKeys[i], canvas.Find("Navigation/" + navNames[i]));
                if (i == 3) navGm = nav;
                navTokens[i] = stage.Behaviour(nav, "VRPGMenuNavButton", new JObject { ["panelIndex"] = i });
                MakeButton(nav);
                if (i == 1) stage.Event(nav, "uiButton", tSocial, "UpdatePlayerList");
                stage.Event(nav, "uiButton", navTokens[i], "ShowPanel");
            }
            var callSt = O("callST", F(P + "/BottomPanel/Call ST"));
            Ui(callSt, tGm, "CallST");

            // ---- name and title ----
            var title = F(P + "/Panel 0 - Main/Title");
            var nameField = O("nameField", Ref(menuStandIn, "nameField").transform);
            var titleField = O("titleField", Ref(menuStandIn, "titleField").transform);
            stage.Event(nameField, "field", tMenu, "NameTyped");
            stage.Event(titleField, "field", tMenu, "TitleTyped");
            Ui(O("setButton", title.Find("TitleControl/Title_SetTitle")), tMenu, "SetNameAndTitle");
            Ui(O("oocButton", title.Find("TitleControl/Title_SetOOC")), tMenu, "SetOOC");
            Ui(O("offButton", title.Find("TitleControl/Title_SetOff")), tMenu, "SetHidden");

            // ---- the three logs: fixed boxes showing the newest lines, a View child per log for its tab ----
            var log = F(P + "/Panel 0 - Main/Log");
            Ui(O("tabOOC", log.Find("Log Buttons/OOC Log Button")), tLogs, "ShowOOCLog");
            Ui(O("tabIC", log.Find("Log Buttons/IC Log Button")), tLogs, "ShowICLog");
            var tabGm = O("tabGM", log.Find("Log Buttons/GM log Button"));
            Ui(tabGm, tLogs, "ShowGMLog");
            var logFields = fLogs;
            Transform gmLog = null;                                                  // the GM log's group: the staff gate (its View is the tab's)
            foreach (var (k, field, method) in new[] { ("ic", "IC", "ICTyped"), ("ooc", "OOC", "OOCTyped"), ("gm", "GM", "GMTyped") })
            {
                var group = Ref(logStandIn, field + "LogGroup").transform;
                if (field == "GM") gmLog = group;
                var output = Ref(logStandIn, field + "OutputBox");
                var input = Ref(logStandIn, field + "InputBox");
                var send = group.GetComponentsInChildren<Button>(true).First(b => b.GetComponent<TMP_InputField>() == null).gameObject;
                var view = Wrap(group, "View");
                FixedLogBox(output.transform);
                O(k + "Log", group);
                O(k + "View", view);
                O(k + "Output", output.transform);
                var inputGo = O(k + "Input", input.transform);
                stage.Event(inputGo, "field", tLogs, method);
                Ui(O(k + "Send", send.transform), tLogs, "SendLog" + field);
                logFields[field + "LogGroup"] = Obj(view.gameObject);
                logFields[field + "OutputBox"] = Obj(output);
                logFields[field + "InputBox"] = Obj(input);
            }
            var logUp = NewButton(log, "Scroll Up", "▲", new Vector2(38f, 62f), new Vector2(16f, 16f), new Color(0.17f, 0.18f, 0.33f, 0.85f));
            var logDown = NewButton(log, "Scroll Down", "▼", new Vector2(38f, 44f), new Vector2(16f, 16f), new Color(0.17f, 0.18f, 0.33f, 0.85f));
            Ui(O("logUp", logUp.transform), tLogs, "ScrollUp");
            Ui(O("logDown", logDown.transform), tLogs, "ScrollDown");

            // ---- the DS roller (the menu's own) ----
            var ds = Ref(dsStandIn, "attBox").transform.parent.parent;       // Dice DS
            O("dsRoot", ds);
            var tDs = stage.Behaviour(ds.gameObject, "DiceRollerDS", fDs);
            var dsAtt = O("dsAtt", Ref(dsStandIn, "attBox").transform);
            var dsDef = O("dsDef", Ref(dsStandIn, "defBox").transform);
            stage.Event(dsAtt, "field", tDs, "AttTyped");
            stage.Event(dsDef, "field", tDs, "DefTyped");
            Ui(O("dsRoll", ds.Find("D20 Dice Grid/Roll")), tDs, "NewRoll");
            Ui(O("dsReset", ds.Find("D20 Dice Grid/Clear")), tDs, "ClearBox");
            var dsGm = O("dsGm", Ref(dsStandIn, "GmToggle").transform);
            Ui(dsGm, tDs, "ToggleGm");
            var dsGmCheck = O("dsGmCheck", dsGm.transform.Find("Background/Checkmark"));
            var att = O("dsAttThreat", Ref(dsStandIn, "attDrop").transform);
            var def = O("dsDefThreat", Ref(dsStandIn, "defDrop").transform);
            Ui(att, tDs, "CycleAttThreat");
            Ui(def, tDs, "CycleDefThreat");
            var attLabel = O("dsAttThreatLabel", att.transform.Find("Label"));
            var defLabel = O("dsDefThreatLabel", def.transform.Find("Label"));

            // ---- the d20 roller ("Dice 5E.prefab", placed nowhere upstream; same slot as the DS roller) ----
            var d20 = stage.Copy(Load<GameObject>(Dice5EPrefab), ds.parent, "Dice d20").transform;
            foreach (var t in d20.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = 0;
            CleanUi(d20.gameObject);
            var d5Stand = StandIn(d20, "DiceRoller5E");
            O("d20Root", d20);
            var tD20 = stage.Behaviour(d20.gameObject, "DiceRollerD20", fD20);
            var grid = d20.Find("D20 Dice Grid");
            foreach (var n in new[] { 4, 6, 8, 10, 12, 20 }) Ui(O($"d20Add{n}", grid.Find($"d{n}")), tD20, $"BoxAddD{n}");
            Ui(O("d20Roll", grid.Find("Roll")), tD20, "RollBox");
            Ui(O("d20Clear", grid.Find("Clear")), tD20, "ResetBox");
            Ui(O("d20Inc", d20.Find("IncMod")), tD20, "IncreaseMod");
            Ui(O("d20Dec", d20.Find("DecMod")), tD20, "DecreaseMod");
            var d20Mod = O("d20ModLabel", Ref(d5Stand, "modLabel").transform);
            var d20Pool = O("d20Pool", Ref(d5Stand, "dicePoolBoxText").transform);
            var d20Gm = O("d20Gm", Ref(d5Stand, "gmToggle").transform);          // VRPGRollerBase's field (stand-ins keep their base class)
            Ui(d20Gm, tD20, "ToggleGm");
            var d20GmCheck = O("d20GmCheck", d20Gm.transform.Find("Background/Checkmark"));
            // d2 (wired to BoxAddD20 upstream) and d100 (unwired) are Dead (checklist 39); the single d20 rolls get buttons (C11)
            var d2 = grid.Find("d2");
            var oneD20 = NewButton(grid, "1d20", "1d20", ((RectTransform)d2).anchoredPosition, new Vector2(35f, 20f), new Color(0.12f, 0.1f, 0.21f), d2);
            var adv = NewButton(grid, "1d20 Advantage", "Adv", new Vector2(17.5f, -116f), new Vector2(35f, 18f), new Color(0.12f, 0.1f, 0.21f), d2);
            var dis = NewButton(grid, "1d20 Disadvantage", "Dis", new Vector2(52.5f, -116f), new Vector2(35f, 18f), new Color(0.12f, 0.1f, 0.21f), d2);
            Object.DestroyImmediate(d2.gameObject);
            Object.DestroyImmediate(grid.Find("d100").gameObject);
            Ui(O("d20One", oneD20.transform), tD20, "Roll20");
            Ui(O("d20Adv", adv.transform), tD20, "Roll20Advantage");
            Ui(O("d20Dis", dis.transform), tD20, "Roll20Disadvantage");
            var diceSwitch = NewButton(ds.parent, "Dice Switch", "DS / d20", new Vector2(0f, -84f), new Vector2(80f, 16f), new Color(0.25f, 0.1f, 0.35f));
            Ui(O("diceSwitch", diceSwitch.transform), tMgr, "SwitchDice");

            // ---- the Social panel: 8 rows a page, page buttons ----
            var social = F(P + "/Panel 4 - Social");
            var content = Ref(socialStandIn, "playerButtonParent").transform;
            var scroll = content.parent.parent;                                         // Player Buttons Scroll View
            FixedPlayerList(scroll, content);
            O("playerCount", Ref(socialStandIn, "playerCountText").transform);
            O("selectedName", Ref(socialStandIn, "playerLabel").transform);
            O("resultName", Ref(socialStandIn, "nameLabel").transform);
            O("resultTitle", Ref(socialStandIn, "titleLabel").transform);
            O("resultDesc", Ref(socialStandIn, "descLabel").transform);
            var pc = social.Find("Panel Content");
            Ui(O("refresh", pc.Find("UpdatePlayerList")), tSocial, "UpdatePlayerList");
            var prev = NewButton(pc, "PagePrev", "<", new Vector2(57f, 34f), new Vector2(16f, 16f), new Color(0.35f, 0.09f, 0.09f));
            var next = NewButton(pc, "PageNext", ">", new Vector2(97f, 34f), new Vector2(16f, 16f), new Color(0.35f, 0.09f, 0.09f));
            var pageText = NewText(pc, "PageText", "", new Vector2(77f, 34f), new Vector2(24f, 16f), 8f, Gold);
            Ui(O("pagePrev", prev.transform), tSocial, "PreviousPage");
            Ui(O("pageNext", next.transform), tSocial, "NextPage");
            O("pageText", pageText.transform);
            for (int i = 0; i < Rows; i++)
            {
                var row = content.Find($"Button ({i})").gameObject;
                O($"row{i}", row.transform);
                var label = O($"row{i}Label", row.transform.Find("Text (TMP)"));
                var token = stage.Behaviour(row, "VRPGPlayerButton", new JObject { ["buttonLabelObject"] = Obj(label) });
                Ui(row, token, "SelectPlayer");
            }
            var gmOnly = social.Find("GM Only");
            var socialGmOnly = O("socialGmOnly", gmOnly);
            Ui(O("gmTele", gmOnly.Find("GMTele")), tGm, "TeleToSelected");
            Ui(O("bringToMe", gmOnly.Find("BringToMe")), tGm, "BringToMe");
            Ui(O("makeController", gmOnly.Find("MakeController")), tGm, "GiveInstanceMod");
            Ui(O("removeGM", gmOnly.Find("RemoveGM")), tGm, "RemoveMod");
            Ui(O("giveOperator", gmOnly.Find("Janitor - GiveOp")), tGm, "GiveAutoMod");

            // ---- the Options panel: toggles become buttons with a check mark, the volume slider two buttons ----
            var opt = F(P + "/Panel 5 - Options/Sections");
            var imToggle = O("imAlertToggle", opt.Find("toggleImAlert"));
            Ui(imToggle, tOptions, "ToggleImAlert");
            var imCheck = O("imAlertCheck", imToggle.transform.Find("Background/Checkmark"));
            var gridToggle = O("gridToggle", opt.Find("toggleGrid"));
            Ui(gridToggle, tOptions, "ToggleGrid");
            var gridCheck = O("gridCheck", gridToggle.transform.Find("Background/Checkmark"));
            var slider = opt.Find("ImSlider");
            var sliderPos = ((RectTransform)slider).anchoredPosition;
            var volume = stage.Create("ImVolume", opt).AddComponent<RectTransform>();
            Object.DestroyImmediate(slider.gameObject);
            volume.SetSiblingIndex(opt.Find("Spacer").GetSiblingIndex() + 1);
            volume.anchorMin = volume.anchorMax = new Vector2(0f, 1f);
            volume.anchoredPosition = sliderPos;
            volume.sizeDelta = new Vector2(160f, 20f);
            NewText(volume, "Caption", "IM volume", new Vector2(-45f, 0f), new Vector2(70f, 20f), 9f, new Color(0.84f, 0.71f, 0.21f));
            var volDown = NewButton(volume, "Down", "-", new Vector2(10f, 0f), new Vector2(20f, 20f), new Color(0.35f, 0.09f, 0.09f));
            var volLabel = NewText(volume, "Value", "0.2", new Vector2(38f, 0f), new Vector2(30f, 20f), 9f, Gold);
            var volUp = NewButton(volume, "Up", "+", new Vector2(66f, 0f), new Vector2(20f, 20f), new Color(0.35f, 0.09f, 0.09f));
            Ui(O("volDown", volDown.transform), tOptions, "VolumeDown");
            Ui(O("volUp", volUp.transform), tOptions, "VolumeUp");
            O("volLabel", volLabel.transform);
            var layout = opt.GetComponent<VerticalLayoutGroup>();
            if (layout != null) Object.DestroyImmediate(layout);                     // positions are fixed now (they were laid out already)
            var optionsPanel = F(P + "/Panel 5 - Options");
            var credits = NewText(optionsPanel, "Credits", "", new Vector2(50f, -110f), new Vector2(190f, 60f), 6f, new Color(0.84f, 0.71f, 0.21f));
            credits.GetComponent<TextMeshProUGUI>().alignment = TextAlignmentOptions.TopLeft;
            O("credits", credits.transform);
            var about = NewText(optionsPanel, "About", AboutText, new Vector2(50f, 60f), new Vector2(190f, 150f), 5f, new Color(0.8f, 0.78f, 0.7f));
            about.GetComponent<TextMeshProUGUI>().alignment = TextAlignmentOptions.TopLeft;

            // ---- the GM panel and the operators' block ----
            var gmPanel = F(P + "/Panel 6 - GM");
            Ui(O("stTitle", gmPanel.Find("ST Title Box")), tGm, "SetStaffTitle");
            var teleport = gmPanel.Find("Teleport");
            var tpButtons = new JArray();
            for (int i = 0; i < 6; i++)
            {
                var tp = O($"tp{i}", teleport.Find($"TP{i}"));
                Ui(tp, tGm, $"TrySpawn{i}");
                tpButtons.Add(Obj(tp));
            }
            Ui(O("respawn", teleport.Find("Respawn")), tGm, "TryRespawn");
            var teleTarget = O("teleTarget", teleport.Find("Dropdown"));
            Ui(teleTarget, tGm, "CycleTeleTarget");
            var teleTargetLabel = O("teleTargetLabel", teleTarget.transform.Find("Label"));
            var tl = teleport.GetComponent<VerticalLayoutGroup>();
            if (tl != null) Object.DestroyImmediate(tl);
            var operUi = O("operUI", F(P + "/OperUI"));
            Ui(O("noBoxSpawn", F(P + "/OperUI/NoBoxSpawn")), tGm, "GoNoBox");
            // What the page switches off when it starts (only the Main panel shows, the DS roller, no operators' block) is
            // saved off too (bindings "active": false), so the kit's photo shows the board as a player first sees it.
            foreach (var hidden in panels.Skip(1).Append(operUi).Append(d20.gameObject)) hidden.SetActive(false);

            // ---- sounds: CC0 replacements for the three clips missing upstream (the version alert went with its feature) ----
            var gmAlert = O("gmAlert", F("VRPG GM Handler/GMAlert"));
            var imAlert = O("imAlert", F("VRPG GM Handler/IM Alert"));
            var gmClip = Clip(stage, gmAlert, $"{Kit}/Audio/bong_001.ogg", 0.254f);
            var imClip = Clip(stage, imAlert, $"{Kit}/Audio/glass_002.ogg", 0.2f);

            // ---- teleport fade: the sphere around the local head and the target at the destination ----
            Object.DestroyImmediate(F("FadeSphere").gameObject);                    // the manager's nested copy: the prefab's own comes next
            var fade = stage.Copy(Load<GameObject>(FadePrefab), root.transform, "FadeSphere");
            foreach (var t in fade.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = 0;
            var fadeBody = fade.transform.Find("FadeSphere Body").gameObject;
            SetMesh(fadeBody, PrimitiveType.Sphere, 1f);                              // ProBuilder sphere of size 2: radius 1
            fadeBody.GetComponent<MeshRenderer>().sharedMaterial = FadeMaterial();
            fadeBody.SetActive(false);                                               // the clip switches it on in its first frame
            O("fadeSphere", fade.transform);
            var tTrack = stage.Behaviour(fade, "TrackBone", new JObject { ["offset"] = new JObject { ["$v3"] = new JArray(0.0, 0.0, 0.0) } });
            var fadeTarget = F("VRPG Behaviors/VRPG Teleporter/FadeTarget");
            SetMesh(fadeTarget.gameObject, PrimitiveType.Cube, 0.5f);
            fadeTarget.GetComponent<MeshRenderer>().sharedMaterial = Unlit("FadeTarget", Color.black);
            fadeTarget.localPosition = Vector3.zero;
            fadeTarget.gameObject.SetActive(false);
            O("fadeTarget", fadeTarget);

            // ---- floor grid: a generated hex tile, additive, on a plane under the parked board ----
            var gridPlane = F("VRPG Behaviors/VRPG Grid/GridPlane");
            SetMesh(gridPlane.gameObject, PrimitiveType.Plane, 1f);
            gridPlane.GetComponent<MeshRenderer>().sharedMaterial = GridMaterial();
            gridPlane.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;
            gridPlane.localPosition = new Vector3(0f, -1.48f, 0f);
            gridPlane.localScale = new Vector3(2f, 1f, 2f);
            O("grid", gridPlane);

            // ---- the name labels: 32 copies of the player object's label canvas. Each player's page attaches the label it holds
            //      to its own head with autoSync (the labels are attachable); the canvas pivots there, a look-at constraint turns it to the viewer
            //      (the fade sphere, which every page attaches to its own head), and its text sits LabelHeight along the
            //      canvas's up, so the viewer sees it above the head whichever way the head tilts ----
            var labelsRoot = stage.Create("Labels", root.transform);
            var labelTokens = new JArray();
            var discSprite = Disc();
            var playerPrefab = Load<GameObject>(PlayerPrefab);
            for (int i = 0; i < Labels; i++)
            {
                var label = stage.Copy(playerPrefab, labelsRoot.transform, $"Label {i}");
                foreach (var t in label.GetComponentsInChildren<Transform>(true)) t.gameObject.layer = 0;
                Object.DestroyImmediate(label.transform.Find("MapDotCanvas").gameObject);
                var lc = label.transform.Find("Canvas");
                Object.DestroyImmediate(lc.Find("Labels/Icons").gameObject);
                Object.DestroyImmediate(lc.Find("Labels/Text/Level").gameObject);
                Object.DestroyImmediate(lc.Find("Labels/Text/Tags").gameObject);
                var raycaster = lc.GetComponent<GraphicRaycaster>();
                if (raycaster != null) Object.DestroyImmediate(raycaster);
                // Turned to the viewer (+Z at the fade sphere, world up): a billboard. The text sits LabelHeight along the
                // canvas's up, which is square to the viewer's line of sight, so from where the viewer is it shows straight
                // above the head. (An aim about the vertical only keeps the head's pitch on the local player's own label:
                // measured, so not used.)
                var look = lc.gameObject.AddComponent<LookAtConstraint>();
                look.AddSource(new ConstraintSource { sourceTransform = fade.transform, weight = 1f });
                look.useUpObject = false;
                look.roll = 0f;
                look.constraintActive = true;
                look.locked = true;
                // The canvas pivots at the attachment point (the head); the look-at constraint above sets its world rotation
                // whatever the head does; the text sits LabelHeight above the pivot along the canvas's up. (Measured in Play mode: an offset
                // given to a PositionConstraint followed the head's tilt.)
                lc.localPosition = Vector3.zero;
                lc.localRotation = Quaternion.identity;
                var labelText = lc.Find("Labels");
                labelText.position += Vector3.up * LabelHeight;
                CleanUi(label);
                O($"label{i}", label.transform);
                // Attachable (bindings "attach": true): every client gives it the same attachment id as the kit loads, so when
                // its holder attaches it to their head with autoSync the others re-parent their own copy under that avatar.
                // (Until portkit c971100 only the attaching page had the id; the labels were holder-owned synced transforms,
                // PORT.md 0.7, 0.8.)
                stage.Attachable(label);
                O($"label{i}Name", lc.Find("Labels/Text/Nameplate"));
                O($"label{i}Title", lc.Find("Labels/Text/Title Plate"));
                var icons = new[] { "NormalImage", "ControllerImage", "AdminImage", "JanitorImage" };
                for (int n = 0; n < 4; n++)
                {
                    var icon = lc.Find("Labels/Images/" + icons[n]);
                    icon.GetComponent<Image>().sprite = discSprite;
                    O($"label{i}Icon{n}", icon);
                }
                label.SetActive(false);
                labelTokens.Add(Obj(label));
            }

            // ======== fields of the behaviours ========
            Fill(fMgr, new JObject
            {
                ["GMData"] = stage.BehaviourValue(tGm), ["Menu"] = stage.BehaviourValue(tMenu), ["Logger"] = stage.BehaviourValue(tLogs),
                ["PatronData"] = stage.BehaviourValue(tPatrons), ["Social"] = stage.BehaviourValue(tSocial), ["ConfigData"] = stage.BehaviourValue(tConfig),
                ["Teleporter"] = stage.BehaviourValue(tTele), ["Options"] = stage.BehaviourValue(tOptions), ["DiceDS"] = stage.BehaviourValue(tDs),
                ["DiceD20"] = stage.BehaviourValue(tD20), ["diceSwitch"] = Obj(diceSwitch), ["Labels"] = labelTokens,
            });
            Fill(fGm, new JObject
            {
                ["GMObjects"] = new JArray(Obj(navGm), Obj(gmLog.gameObject), Obj(tabGm), Obj(socialGmOnly)),
                ["OperatorObjects"] = new JArray(Obj(operUi)),
                ["teleTargetLabel"] = Obj(teleTargetLabel), ["teleButtons"] = tpButtons,
                ["GMSound"] = stage.ComponentValue(gmAlert, "AudioSource"), ["GMClip"] = gmClip,
            });
            Fill(fMenu, new JObject
            {
                ["nameFieldObject"] = Obj(nameField), ["titleFieldObject"] = Obj(titleField),
                ["panels"] = new JArray(panels.Select(p => (JToken)Obj(p))),
                ["characterNamePlateObject"] = Obj(plates[0]), ["characterTitlePlateObject"] = Obj(plates[1]),
                ["playerNamePlateObject"] = Obj(plates[2]), ["playerTitlePlateObject"] = Obj(plates[3]), ["captionObject"] = Obj(caption),
            });
            logFields["ImSound"] = stage.ComponentValue(imAlert, "AudioSource");
            logFields["ImClip"] = imClip;
            Fill(fDs, new JObject
            {
                ["gmCheck"] = Obj(dsGmCheck), ["attBoxObject"] = Obj(dsAtt), ["defBoxObject"] = Obj(dsDef), ["attDropObject"] = Obj(att),
                ["defDropObject"] = Obj(def), ["attDropLabel"] = Obj(attLabel), ["defDropLabel"] = Obj(defLabel),
            });
            Fill(fD20, new JObject { ["gmCheck"] = Obj(d20GmCheck), ["dicePoolBoxTextObject"] = Obj(d20Pool), ["modLabelObject"] = Obj(d20Mod) });
            Fill(fSocial, new JObject
            {
                ["playerLabelObject"] = Obj(Ref(socialStandIn, "playerLabel")), ["nameLabelObject"] = Obj(Ref(socialStandIn, "nameLabel")),
                ["titleLabelObject"] = Obj(Ref(socialStandIn, "titleLabel")), ["descLabelObject"] = Obj(Ref(socialStandIn, "descLabel")),
                ["playerCountTextObject"] = Obj(Ref(socialStandIn, "playerCountText")), ["pageTextObject"] = Obj(pageText),
            });
            Fill(fTele, new JObject { ["teleAnim"] = stage.ComponentValue(fade, "Animator"), ["FadeTarget"] = Obj(fadeTarget.gameObject) });
            Fill(fOptions, new JObject
            {
                ["imAlertObject"] = Obj(imAlert), ["imAlertSource"] = stage.ComponentValue(imAlert, "AudioSource"), ["imAlertCheck"] = Obj(imCheck),
                ["gridObject"] = Obj(gridPlane.gameObject), ["gridCheck"] = Obj(gridCheck), ["gridToggle"] = Obj(gridToggle), ["volumeLabelObject"] = Obj(volLabel),
            });
            Fill(fPatrons, new JObject { ["PatronCreditsObject"] = Obj(credits), ["PatronItems"] = new JArray() });
            _ = tTrack;

            // the board's look: one canvas for 300 texts rebuilds on every log line, so the three log boxes get canvases of their
            // own (PORT.md 6.4)
            foreach (var text in manager.GetComponentsInChildren<TMP_InputField>(true)) { text.richText = false; text.characterLimit = text.gameObject.name.Contains("Mod") ? 16 : 500; }
            foreach (var t in new[] { Ref(logStandIn, "ICOutputBox"), Ref(logStandIn, "OOCOutputBox"), Ref(logStandIn, "GMOutputBox") })
                SubCanvas(t.gameObject);
            // (not the player list: a nested canvas's buttons need a raycaster of their own, and a row is clicked)

            // Only a control catches the pointer: a background or a label drawn over a button (the log boxes over the log
            // tabs, the panel backgrounds) would take its click, and uGUI hands a click to the topmost graphic only.
            foreach (var graphic in manager.GetComponentsInChildren<Graphic>(true)) graphic.raycastTarget = graphic.GetComponent<Selectable>() != null;
        }

        protected override void Finishing(KitStage stage)
        {
            // Legacy UI Text draws with a built-in font no bundle carries (none is left after the removals: JanUi's "No TP" was
            // the only one). Every Roboto Slab text gets the kit's own Roboto Slab asset (the upstream atlases have no licence
            // file; the font is Apache-2.0, fetched from Google Fonts and baked here).
            KitText.ToTextMeshPro(stage.Root, fontFor: _ => roboto, report: stage.Report);
            var liberation = KitText.DefaultFont();
            int n = 0;
            foreach (var tmp in stage.Root.GetComponentsInChildren<TMP_Text>(true))
            {
                if (tmp.font == null || tmp.font.name.StartsWith("RobotoSlab", StringComparison.Ordinal) || !AssetDatabase.GetAssetPath(tmp.font).StartsWith("Assets/", StringComparison.Ordinal))
                {
                    tmp.font = roboto;
                    tmp.fontSharedMaterial = roboto.material;
                    n++;
                }
                else if (tmp.font != liberation && tmp.font != roboto) { tmp.font = liberation; tmp.fontSharedMaterial = liberation.material; }
            }
            stage.Report.AppendLine($"   {n} texts drawn with the kit's Roboto Slab");
        }

        // ------------------------------------------------------------------ helpers: upstream objects

        static T Load<T>(string path) where T : Object => AssetDatabase.LoadAssetAtPath<T>(path) ?? throw new Exception($"nothing at {path}: run the importer");

        static MonoBehaviour StandIn(Transform t, string type) =>
            t.GetComponents<MonoBehaviour>().FirstOrDefault(m => m != null && m.GetType().Name == type) ?? throw new Exception($"'{t.name}' has no {type}");

        /// <summary>The object a stand-in's field points at (a component's or a GameObject).</summary>
        static GameObject Ref(MonoBehaviour standIn, string field)
        {
            var f = standIn.GetType().GetField(field, BindingFlags.Public | BindingFlags.Instance) ?? throw new Exception($"{standIn.GetType().Name} has no field {field}");
            var value = f.GetValue(standIn) as Object;
            if (value is GameObject go) return go;
            if (value is Component c && c != null) return c.gameObject;
            throw new Exception($"{standIn.GetType().Name}.{field} on '{standIn.name}' is not set");
        }

        /// <summary>Adds fields to a plain behaviour's JObject (KitStage keeps the one it was given).</summary>
        static void Fill(JObject into, JObject fields)
        {
            foreach (var p in fields.Properties().ToList()) into[p.Name] = p.Value;
        }

        /// <summary>Wraps every child of `group` in a new child `name` (the log's view, which its tab switches).</summary>
        static Transform Wrap(Transform group, string name)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.layer = group.gameObject.layer;
            var rt = (RectTransform)go.transform;
            rt.SetParent(group, false);
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero;
            foreach (var child in group.Cast<Transform>().Where(c => c != rt).ToList()) child.SetParent(rt, false);
            var cg = group.GetComponent<CanvasGroup>();
            if (cg != null) Object.DestroyImmediate(cg);                                           // shown by switching objects (G8)
            return rt;
        }

        /// <summary>A log's scroll view becomes a fixed box: the text fills it and the newest lines sit at the bottom.</summary>
        static void FixedLogBox(Transform textBox)
        {
            var contentT = (RectTransform)textBox.parent;
            var viewport = (RectTransform)contentT.parent;
            var scrollView = (RectTransform)viewport.parent;
            var sr = scrollView.GetComponent<ScrollRect>();
            if (sr != null) Object.DestroyImmediate(sr);
            foreach (var bar in scrollView.GetComponentsInChildren<Scrollbar>(true).Select(b => b.gameObject).ToList()) Object.DestroyImmediate(bar);
            var mask = viewport.GetComponent<Mask>();
            if (mask != null) Object.DestroyImmediate(mask);
            var vi = viewport.GetComponent<Image>();
            if (vi != null) Object.DestroyImmediate(vi);
            if (viewport.GetComponent<RectMask2D>() == null) viewport.gameObject.AddComponent<RectMask2D>();
            Stretch(viewport, 4f);
            Stretch(contentT, 0f);
            var rt = (RectTransform)textBox;
            var fitter = textBox.GetComponent<ContentSizeFitter>();
            if (fitter != null) Object.DestroyImmediate(fitter);
            Stretch(rt, 0f);
            var tmp = textBox.GetComponent<TextMeshProUGUI>();
            tmp.alignment = TextAlignmentOptions.BottomLeft;
            tmp.textWrappingMode = TextWrappingModes.Normal;
            tmp.overflowMode = TextOverflowModes.Overflow;
            tmp.fontSize = 7f;
            tmp.text = "";
        }

        /// <summary>The player list without its scroll view: 8 rows in the 2 x 4 grid it showed, the other 76 gone.</summary>
        static void FixedPlayerList(Transform scroll, Transform content)
        {
            var sr = scroll.GetComponent<ScrollRect>();
            if (sr != null) Object.DestroyImmediate(sr);
            foreach (var bar in scroll.GetComponentsInChildren<Scrollbar>(true).Select(b => b.gameObject).ToList()) Object.DestroyImmediate(bar);
            var viewport = (RectTransform)content.parent;
            var mask = viewport.GetComponent<Mask>();
            if (mask != null) Object.DestroyImmediate(mask);
            var vi = viewport.GetComponent<Image>();
            if (vi != null) Object.DestroyImmediate(vi);
            Stretch(viewport, 2f);
            var fitter = content.GetComponent<ContentSizeFitter>();
            if (fitter != null) Object.DestroyImmediate(fitter);
            Stretch((RectTransform)content, 0f);
            for (int i = content.childCount - 1; i >= Rows; i--) Object.DestroyImmediate(content.GetChild(i).gameObject);
            var gridLayout = content.GetComponent<GridLayoutGroup>();
            if (gridLayout != null) { gridLayout.cellSize = new Vector2(138f, 30f); gridLayout.spacing = new Vector2(2f, 0f); }
        }

        static void Stretch(RectTransform rt, float inset)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(inset, inset); rt.offsetMax = new Vector2(-inset, -inset);
            rt.localPosition = new Vector3(rt.localPosition.x, rt.localPosition.y, 0f);
        }

        static void SubCanvas(GameObject go)
        {
            if (go.GetComponent<Canvas>() == null) go.AddComponent<Canvas>();
        }

        /// <summary>Built-in sprites (unity_builtin_extra) and the missing UI material are dropped; texts let the pointer through.</summary>
        static void CleanUi(GameObject under)
        {
            foreach (var image in under.GetComponentsInChildren<Image>(true))
            {
                if (image.sprite != null && !AssetDatabase.GetAssetPath(image.sprite).StartsWith("Assets/", StringComparison.Ordinal))
                {
                    image.sprite = null;
                    image.type = Image.Type.Simple;
                }
                image.material = null;
            }
            foreach (var text in under.GetComponentsInChildren<TMP_Text>(true)) text.raycastTarget = false;
            foreach (var button in under.GetComponentsInChildren<Button>(true))
                for (int i = button.onClick.GetPersistentEventCount() - 1; i >= 0; i--) UnityEditor.Events.UnityEventTools.RemovePersistentListener(button.onClick, i);
            foreach (var toggle in under.GetComponentsInChildren<Toggle>(true))
                for (int i = toggle.onValueChanged.GetPersistentEventCount() - 1; i >= 0; i--) UnityEditor.Events.UnityEventTools.RemovePersistentListener(toggle.onValueChanged, i);
        }

        /// <summary>A toggle or a dropdown becomes a plain button (the page keeps the value, G8); a button keeps its Button.</summary>
        static void MakeButton(GameObject go)
        {
            var toggle = go.GetComponent<Toggle>();
            if (toggle != null)
            {
                var check = toggle.graphic;
                Object.DestroyImmediate(toggle);
                if (check != null) check.gameObject.SetActive(false);
            }
            var dropdown = go.GetComponent<TMP_Dropdown>();
            if (dropdown != null)
            {
                var template = dropdown.template;
                Object.DestroyImmediate(dropdown);
                if (template != null) Object.DestroyImmediate(template.gameObject);
                var arrow = go.transform.Find("Arrow");                               // a built-in sprite: nothing to draw now
                if (arrow != null) Object.DestroyImmediate(arrow.gameObject);
            }
            if (go.GetComponent<Graphic>() == null)
            {
                // a toggle's own object has no graphic: its Background is what the pointer hits, which reaches the Button here
                var image = go.AddComponent<Image>();
                image.color = new Color(0f, 0f, 0f, 0f);
            }
            var button = go.GetComponent<Button>() ?? go.AddComponent<Button>();
            for (int i = button.onClick.GetPersistentEventCount() - 1; i >= 0; i--) UnityEditor.Events.UnityEventTools.RemovePersistentListener(button.onClick, i);
        }

        GameObject NewButton(Transform parent, string name, string label, Vector2 at, Vector2 size, Color colour, Transform styleFrom = null)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            if (styleFrom is RectTransform from) { rt.anchorMin = from.anchorMin; rt.anchorMax = from.anchorMax; rt.pivot = from.pivot; }
            rt.anchoredPosition = at;
            rt.sizeDelta = size;
            go.AddComponent<Image>().color = colour;
            go.AddComponent<Button>();
            var text = NewText(rt, "Text (TMP)", label, Vector2.zero, size, Mathf.Min(10f, size.y * 0.6f), Gold);
            var trt = (RectTransform)text.transform;
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one; trt.offsetMin = trt.offsetMax = Vector2.zero;
            return go;
        }

        GameObject NewText(Transform parent, string name, string value, Vector2 at, Vector2 size, float fontSize, Color colour)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            rt.anchoredPosition = at;
            rt.sizeDelta = size;
            var tmp = go.AddComponent<TextMeshProUGUI>();
            tmp.font = roboto;
            tmp.fontSharedMaterial = roboto.material;
            tmp.text = value;
            tmp.fontSize = fontSize;
            tmp.color = colour;
            tmp.alignment = TextAlignmentOptions.Center;
            tmp.raycastTarget = false;
            tmp.textWrappingMode = TextWrappingModes.Normal;
            return go;
        }

        /// <summary>
        /// A clip on the holder's clip list (KitStage.ClipValue: AudioSource, BS Audio Source, PkClips, refs), played at
        /// `volume` without 3D falloff. Returns the bindings value {"$clip": n, "on": key}.
        /// </summary>
        static JObject Clip(KitStage stage, GameObject holder, string path, float volume)
        {
            var value = stage.ClipValue(holder, Load<AudioClip>(path));
            var source = holder.GetComponent<AudioSource>();
            source.playOnAwake = false;
            source.spatialBlend = 0f;
            source.volume = volume;
            var so = new SerializedObject(holder.GetComponent(GraphTypes.Find("BS.BSAudioSource")));
            so.FindProperty("playOnAwake").boolValue = false;
            so.FindProperty("volume").floatValue = volume;
            so.FindProperty("spatialBlend").floatValue = 0f;
            so.ApplyModifiedPropertiesWithoutUndo();
            return value;
        }

        static void SetMesh(GameObject go, PrimitiveType type, float scale)
        {
            var temp = GameObject.CreatePrimitive(type);
            var mesh = temp.GetComponent<MeshFilter>().sharedMesh;
            Object.DestroyImmediate(temp);
            var filter = go.GetComponent<MeshFilter>() ?? go.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            if (go.GetComponent<MeshRenderer>() == null) go.AddComponent<MeshRenderer>();
            foreach (var c in go.GetComponents<Collider>()) Object.DestroyImmediate(c);
            if (Mathf.Abs(scale - 1f) > 1e-4f)
            {
                // scale the child mesh by a holder-free route: the object's own scale
                go.transform.localScale = go.transform.localScale * scale;
            }
        }

        // ------------------------------------------------------------------ assets made here

        static TMP_FontAsset Fonts()
        {
            var source = Load<Font>($"{FontFolder}/RobotoSlab-wght.ttf");
            var chars = new System.Text.StringBuilder();
            for (int c = 32; c < 127; c++) chars.Append((char)c);
            for (int c = 160; c < 256; c++) chars.Append((char)c);
            chars.Append("•●○□■…–—‘’“”▲▼​");
            var asset = KitText.StaticFontAsset(source, chars.ToString(), $"{FontFolder}/RobotoSlab SDF.asset", 56, 1024);
            var liberation = KitText.DefaultFont();
            if (liberation != null)
            {
                asset.fallbackFontAssetTable = new List<TMP_FontAsset> { liberation };
                EditorUtility.SetDirty(asset);
                AssetDatabase.SaveAssets();
            }
            return asset;
        }

        static Material SaveMaterial(Material m)
        {
            Directory.CreateDirectory(MaterialFolder);
            string path = $"{MaterialFolder}/{m.name}.mat";
            var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (existing != null) { existing.shader = m.shader; existing.CopyPropertiesFromMaterial(m); m = existing; }
            else AssetDatabase.CreateAsset(m, path);
            // URP's own validation (keywords, which passes stay on): without it extra passes ship (the chess re-sync's trap)
            BaseShaderGUI.SetMaterialKeywords(m);
            EditorUtility.SetDirty(m);
            AssetDatabase.SaveAssets();
            return m;
        }

        static Shader UnlitShader => Shader.Find("Universal Render Pipeline/Unlit") ?? throw new Exception("URP Unlit shader not found");

        static Material Unlit(string name, Color colour)
        {
            var m = new Material(UnlitShader) { name = name };
            m.SetColor("_BaseColor", colour);
            return SaveMaterial(m);
        }

        /// <summary>The fade: black, both faces, alpha-clipped by the perlin noise whose _Cutoff the upstream clip animates.</summary>
        static Material FadeMaterial()
        {
            var noise = PerlinTexture();
            var m = new Material(UnlitShader) { name = "TeleportBall" };
            m.SetColor("_BaseColor", Color.black);
            m.SetTexture("_BaseMap", noise);
            m.SetFloat("_AlphaClip", 1f);
            m.SetFloat("_Cutoff", 1f);
            m.SetFloat("_Cull", (float)CullMode.Off);
            m.EnableKeyword("_ALPHATEST_ON");
            return SaveMaterial(m);
        }

        static Texture2D PerlinTexture()
        {
            string from = $"{Up}/Graphics/Textures/VRPGPerlin.tif", to = $"{TextureFolder}/VRPGPerlin.tif";
            Directory.CreateDirectory(TextureFolder);
            if (!File.Exists(to)) { File.Copy(from, to); AssetDatabase.ImportAsset(to); }
            var importer = (TextureImporter)AssetImporter.GetAtPath(to);
            importer.alphaSource = TextureImporterAlphaSource.FromGrayScale;
            importer.maxTextureSize = 256;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(to);
        }

        /// <summary>The floor grid's hex tile (the upstream texture is missing): white hexagon outlines on black, additive.</summary>
        static Material GridMaterial()
        {
            const int w = 128, h = 222;                                       // one tile of a pointy-top hex lattice: width sqrt(3) r, height 3 r
            float r = w / Mathf.Sqrt(3f);
            var texture = new Texture2D(w, h, TextureFormat.RGBA32, true) { name = "HexGrid" };
            var centres = new List<Vector2>();
            for (int i = -1; i <= 2; i++)
                for (int j = -1; j <= 1; j++)
                {
                    centres.Add(new Vector2(i * w, j * h));
                    centres.Add(new Vector2(i * w + w / 2f, j * h + h / 2f));
                }
            for (int y = 0; y < h; y++)
                for (int x = 0; x < w; x++)
                {
                    var p = new Vector2(x + 0.5f, y + 0.5f);
                    // the distance to the nearest and the second nearest centre: on an edge they are equal
                    float d1 = float.MaxValue, d2 = float.MaxValue;
                    foreach (var c in centres)
                    {
                        float d = Vector2.Distance(p, c);
                        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
                    }
                    float edge = Mathf.Clamp01(1f - (d2 - d1) / 3f);
                    texture.SetPixel(x, y, new Color(edge, edge, edge, edge));
                }
            texture.Apply();
            Directory.CreateDirectory(TextureFolder);
            string path = $"{TextureFolder}/HexGrid.png";
            File.WriteAllBytes(path, texture.EncodeToPNG());
            AssetDatabase.ImportAsset(path);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.wrapMode = TextureWrapMode.Repeat;
            importer.mipmapEnabled = true;
            importer.alphaIsTransparency = true;
            importer.SaveAndReimport();
            var tile = AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            _ = r;

            var m = new Material(UnlitShader) { name = "FloorGridHex" };
            m.SetColor("_BaseColor", new Color(0.45f, 0.6f, 0.75f, 0.6f));
            m.SetTexture("_BaseMap", tile);
            m.SetTextureScale("_BaseMap", new Vector2(10f, 10f * w / h));             // a 10 m plane: cells about 1 m across
            m.SetFloat("_Surface", 1f);
            m.SetFloat("_Blend", 2f);                                                // additive, as GIB/GridAdditive
            m.SetFloat("_Cull", (float)CullMode.Off);
            m.SetFloat("_ZWrite", 0f);
            m.renderQueue = (int)RenderQueue.Transparent;
            return SaveMaterial(m);
        }

        /// <summary>The role icon (the upstream sprite is missing): a white disc the four images tint.</summary>
        static Sprite Disc()
        {
            const int size = 64;
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(size / 2f, size / 2f));
                    float a = Mathf.Clamp01(size / 2f - 1f - d);
                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, a));
                }
            texture.Apply();
            Directory.CreateDirectory(TextureFolder);
            string path = $"{TextureFolder}/RoleDisc.png";
            File.WriteAllBytes(path, texture.EncodeToPNG());
            AssetDatabase.ImportAsset(path);
            var importer = (TextureImporter)AssetImporter.GetAtPath(path);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Sprite>(path);
        }

        const string AboutText =
            "<b>Roleplay Toolkit</b>: a port of <b>VRpg 2</b> by GIB Games (github.com/GIBGames/VRpg, MIT licence, Copyright (c) 2024 GIB Games). " +
            "Port source: github.com/sidequestlegend/VRpg (branch altspace). The script also holds the portkit runtime (MIT).\n" +
            "Font: Roboto Slab by The Roboto Slab Project Authors (Apache License 2.0; the licence text ships with the kit). Liberation Sans (SIL OFL 1.1).\n" +
            "Sounds: Kenney Interface Sounds, bong_001 and glass_002 (CC0, kenney.nl).\n" +
            "Grid, role icon and fade: made for this port. Saved names stay on this device. Not affiliated with VRChat.";
    }
}
