// Rungs 3 and 4: the roleplay toolkit in editor Play mode, driven through the SDK's desktop player with the port kit's
// input (InputSim: a mouse and keyboard of the test's own; uGUI buttons are clicked through the canvas's raycaster, as a
// person's mouse does) and checked in Unity with the kit's probe command. Typing goes into the kit's TMP_InputFields
// through the kit's "type" command (InputSim); objects the SDK has attached to a head (labels, fade sphere) are found by
// name with the game's "findpos" (RpTestCommands.cs). Not part of the snippet: the test page loads it before the snippet.
//
// window.__rpPlan: "single" (one page: menu, name and title, both rollers, an IC and an OOC line) or "multi" (two Local
// Multiplayer players: the main editor is the world's owner, a game master; Player 2 is refused, then granted a role;
// chat both ways; a GM bring; Player 2 reloads its page).
(function () {
  "use strict";
  const KEY = "rp-toolkit:0";
  const HOLDER = "pk1:rp-toolkit:0";
  const say = (kind, what, detail) => console.log("PKTEST " + kind + " " + what + (detail !== undefined ? ": " + detail : ""));
  let passed = 0;
  let failed = 0;
  const check = (ok, what, detail) => {
    if (ok) passed++;
    else failed++;
    say(ok ? "PASS" : "FAIL", what, detail);
    return ok;
  };
  const replies = new Map();
  let count = 0;
  window.__pktest = Object.assign(window.__pktest || {}, {
    reply(id, text) {
      const resolve = replies.get(id);
      if (resolve) {
        replies.delete(id);
        resolve(text);
      }
    },
  });
  const cmd = (line, ms) =>
    new Promise((resolve) => {
      const id = "r" + ++count;
      replies.set(id, resolve);
      console.log("PKTEST CMD " + id + " " + line);
      setTimeout(() => {
        if (replies.delete(id)) resolve("error: no reply");
      }, ms || 30000);
    });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(test, ms, step) {
    const end = Date.now() + ms;
    for (;;) {
      let value = false;
      try {
        value = test();
      } catch (e) {
        value = false;
      }
      if (value) return value;
      if (Date.now() > end) return false;
      await sleep(step || 100);
    }
  }
  const debug = () => window.__pk1 && window.__pk1.debug && window.__pk1.debug[KEY];
  const enc = (path) => path.replace(/%/g, "%25").replace(/ /g, "%20");
  const probe = (what, key, extra) => cmd("probe " + HOLDER + " " + what + " " + enc(debug().pathOf(key)) + (extra ? " " + extra : ""));
  const vec = (text) => text.split(" ").map(Number);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const me = () => debug().me();
  const mine = () => debug().roster().find((p) => p.sid === me().sid);
  /** Where the local view is in Unity (the main camera). */
  const headAt = () => cmd("probe - head");
  /** A kit object found by name anywhere in the scene: "x y z on|off parent". */
  const findpos = async (name) => {
    const r = await cmd("findpos " + enc(name));
    return r.startsWith("error") ? null : { at: vec(r.split(" ").slice(0, 3).join(" ")), on: r.split(" ")[3] === "on", parent: r.split(" ")[4] };
  };
  /** Polls until `get` gives a value `ok` accepts (probes run ahead of the relay), else the last value. */
  async function settle(get, ok, ms) {
    const end = Date.now() + (ms || 5000);
    let value = await get();
    while (!ok(value) && Date.now() < end) {
      await sleep(250);
      value = await get();
    }
    return value;
  }

  /** A uGUI button (or a field) of the kit, clicked with the test's mouse: turn to it, click its centre. */
  async function click(key) {
    const pos = await probe("pos", key);
    if (pos.startsWith("error")) {
      say("INFO", "click " + key, pos);
      return false;
    }
    await cmd("look " + pos);
    const r = await cmd("click " + pos);
    await sleep(500);
    if (!r.startsWith("ok")) say("INFO", "click " + key, r);
    return r.startsWith("ok");
  }

  /** Clicks a field (it takes the focus) and types into it; the next click elsewhere leaves it, and the kit reports it. */
  async function type(key, text) {
    await click(key);
    const r = await cmd("type " + HOLDER + " " + enc(debug().pathOf(key)) + " " + encodeURIComponent(text));
    say("INFO", "type into " + key, r);
    return r.startsWith("ok");
  }

  async function walk() {
    await cmd("key W down");
    await sleep(400);
    await cmd("key W up");
    await sleep(600);
  }

  async function openMenu() {
    await walk();
    const parked = await probe("pos", "menu");
    // the page hears the local head only when it changes (pose-update): turning the desktop player's head makes one
    await cmd("look " + parked);
    await until(() => debug().head() !== null, 4000);
    await cmd("key Q tap");
    const open = await until(() => debug().menuOpen(), 4000);
    await sleep(800);
    return { open: !!open, parked };
  }

  async function waitStarted(label) {
    const t = Date.now();
    const ok = await until(() => debug() && debug().roster && debug().roster().length > 0 && mine(), 60000, 250);
    if (!ok) {
      let why = "";
      try {
        why = "debug keys " + JSON.stringify(Object.keys((window.__pk1 && window.__pk1.debug) || {})) + "; hooks " + JSON.stringify(Object.keys(debug() || {}));
        why += "; roster " + JSON.stringify(debug().roster()) + "; me " + JSON.stringify(me());
      } catch (e) {
        why += "; error " + (e && e.stack ? e.stack.split(String.fromCharCode(10)).slice(0, 3).join(" | ") : e);
      }
      say("INFO", "why the hooks did not answer", why);
    }
    check(!!ok, "the kit loads from a hand-written bs-snippet and the instance starts" + (label || ""), ok ? `after ${((Date.now() - t) / 1000).toFixed(1)} s` : "no debug hooks after 300 s");
    return !!ok;
  }

  // ------------------------------------------------------------------------------------------------ rung 3: one page

  async function single() {
    if (!(await waitStarted())) return;
    await sleep(2000);
    const main = await probe("active", "panelMain");
    const socialPanel = await probe("active", "panelSocial");
    const caption = await probe("text", "caption");
    check(main === "True" && socialPanel === "False" && caption === "VRpg RP System", "the board is parked with the Main panel only, caption from the setting", `main ${main}, social ${socialPanel}, caption '${caption}'`);

    // ---- open the menu with Q (the desktop key): 0.9 m in front of the head ----
    const { open, parked } = await openMenu();
    const at = await probe("pos", "menu");
    const head = await headAt();
    const d = dist(vec(at), vec(head));
    say("INFO", "after Q", `page's board ${JSON.stringify(debug().menuAt())}, page's head ${JSON.stringify(debug().head())}`);
    check(open && Math.abs(d - 0.9) < 0.15 && dist(vec(at), vec(parked)) > 0.2, "Q opens the menu 0.9 m in front of the head (MENU:73-93)", `open ${open}, board ${at}, head ${head}, ${d.toFixed(3)} m; parked was ${parked}`);

    // ---- name and title typed into the two fields, then Set ----
    await type("nameField", "Sir Test");
    await type("titleField", "Knight of Play");
    await click("setButton");
    const named = await until(() => mine().charName === "Sir Test" && mine().title === "Knight of Play", 5000);
    check(!!named, "name and title typed into the fields reach the page (field events) and Set stores them", JSON.stringify(mine()));
    const plate = await probe("text", "plateCharName");
    const plateTitle = await probe("text", "plateCharTitle");
    check(plate === "Sir Test" && plateTitle === "Knight of Play", "the header plates show them in Unity (relay op text)", `'${plate}' / '${plateTitle}'`);
    const slot = mine().slot;
    const labelName = slot >= 0 ? await cmd("findtext " + enc(`Label ${slot}/Canvas/Labels/Text/Nameplate`)) : "no slot";
    const labelTitle = slot >= 0 ? await cmd("findtext " + enc(`Label ${slot}/Canvas/Labels/Text/Title Plate`)) : "";
    const labelAt = slot >= 0 ? await findpos(`Label ${slot}`) : null;
    check(labelName === "Sir Test" && labelTitle === "Knight of Play" && !!labelAt && labelAt.on, "the player's own name label shows them", `slot ${slot}: '${labelName}' / '${labelTitle}', on ${labelAt && labelAt.on}`);

    // ---- the label follows the head: attached to it (AttachToHead, synced), its canvas 0.75 m straight above ----
    check(mine().attached === slot, "the page attached its own label to its head (AttachToHead with autoSync)", `slot ${slot}, attached ${mine().attached}`);
    const canvasAbove = async () => {
      const h = vec(await headAt());
      const c = await findpos(`Label ${slot}/Canvas`);
      return { h, c, ok: !!c && Math.hypot(c.at[0] - h[0], c.at[2] - h[2]) < 0.2 && Math.abs(c.at[1] - h[1] - 0.75) < 0.25 };
    };
    const level = await settle(canvasAbove, (v) => v.ok, 6000);
    check(level.ok, "the label's canvas sits about 0.75 m over the head in Unity (attachment and position constraint)", `canvas ${level.c && level.c.at.join(" ")} under ${level.c && level.c.parent}, head ${level.h.join(" ")}`);
    // look down at the floor in front: the head tilts, the label stays straight above it (the constraint works in world axes)
    const hv = level.h;
    await cmd(`look ${hv[0]} ${hv[1] - 1.5} ${hv[2] + 0.6}`);
    const tilted = await settle(canvasAbove, (v) => v.ok, 4000);
    check(tilted.ok, "with the head tilted down the label stays straight above it", `canvas ${tilted.c && tilted.c.at.join(" ")}, head ${tilted.h.join(" ")}`);
    const fade = await findpos("FadeSphere");
    const fh = vec(await headAt());
    check(!!fade && dist(fade.at, fh) < 0.3, "the fade sphere (the labels' look-at target) is attached to the local head", `sphere ${fade && fade.at.join(" ")} under ${fade && fade.parent}, head ${fh.join(" ")}`);
    await cmd("look " + (await probe("pos", "menu")));

    // ---- the DS roller: ROLL with no modifiers ----
    const ooc0 = debug().lines(1).length;
    await click("dsRoll");
    const dsLine = await until(() => debug().lines(1).length > ooc0 && debug().lines(1)[debug().lines(1).length - 1], 4000);
    check(!!dsLine && /^Main Editor rolled <color=#[0-9A-F]{6}>\d+<\/color> \+ 0 = \d+!$/.test(dsLine), "the DS roller's ROLL puts its line in the OOC log (DS:99-116)", dsLine);
    const oocBox = await probe("text", "oocOutput");
    check(!!dsLine && oocBox.indexOf(dsLine) >= 0, "the OOC box in Unity shows it", oocBox.slice(-120));

    // ---- the d20 roller: switch to it, a d6 and a d20 in the pool, Roll ----
    await click("diceSwitch");
    await until(() => debug().diceShown() === "d20", 3000);
    const d20On = await probe("active", "d20Root");
    const dsOn = await probe("active", "dsRoot");
    check(debug().diceShown() === "d20" && d20On === "True" && dsOn === "False", "the switch shows the d20 roller instead of the DS roller (dice=\"both\")", `d20 ${d20On}, ds ${dsOn}`);
    await click("d20Add6");
    await click("d20Add20");
    const pool = await probe("text", "d20Pool");
    check(/^Dice Pool: d6 d20/.test(pool), "d6 and d20 go into the pool, and its text reaches Unity", pool);
    const ooc1 = debug().lines(1).length;
    await click("d20Roll");
    const d20Line = await until(() => debug().lines(1).length > ooc1 && debug().lines(1)[debug().lines(1).length - 1], 4000);
    check(!!d20Line && /rolled d6: [1-6], d20: (1?\d|20), Total \+ 0: \d+$/.test(d20Line), "the d20 roller's Roll puts the pool's line in the OOC log (D5E:89-123)", d20Line);

    // ---- an in-character line ----
    await click("tabIC");
    await until(() => debug().shownLog() === 0, 3000);
    const icShown = await probe("active", "icView");
    check(icShown === "True" && (await probe("active", "oocView")) === "False", "the IC tab shows the IC log", `ic view ${icShown}`);
    await type("icInput", "Hail and well met!");
    await click("icSend");
    const icLine = await until(() => debug().lines(0).slice(-1)[0], 4000);
    check(icLine === "Sir Test: Hail and well met!", "an in-character line goes out under the character's name (LOG:100-133)", icLine);
    const icBox = await probe("text", "icOutput");
    check(icBox.indexOf("Sir Test: Hail and well met!") >= 0, "the IC box in Unity shows it", icBox.slice(-80));

    // ---- an out-of-character line ----
    await click("tabOOC");
    await until(() => debug().shownLog() === 1, 3000);
    await type("oocInput", "brb | 100% \"real\" ^_^");
    await click("oocSend");
    const oocLine = await until(() => { const l = debug().lines(1).slice(-1)[0]; return l && l.indexOf("brb") >= 0 ? l : false; }, 4000);
    check(oocLine === "Main Editor: brb | 100% \"real\" ^_^", "an out-of-character line goes out under the display name, separators intact", oocLine);
    const oocBox2 = await probe("text", "oocOutput");
    check(oocBox2.indexOf("Main Editor: brb | 100% \"real\" ^_^") >= 0, "the OOC box in Unity shows it", oocBox2.slice(-80));

    // ---- rich text: a size tag is dropped, bold is kept and closed (review finding 4) ----
    await type("oocInput", "<size=60>big</size> <b>bold");
    await click("oocSend");
    const richLine = await until(() => { const l = debug().lines(1).slice(-1)[0]; return l && l.indexOf("big") >= 0 ? l : false; }, 4000);
    check(richLine === "Main Editor: big <b>bold</b>", "typed rich text is filtered: size dropped, bold kept and closed", richLine);
    const oocBox3 = await settle(() => probe("text", "oocOutput"), (v) => v.indexOf("Main Editor: big <b>bold</b>") >= 0);
    check(oocBox3.indexOf("Main Editor: big <b>bold</b>") >= 0, "the OOC box in Unity shows the filtered line", oocBox3.slice(-80));

    // ---- close: the board goes back where it was parked ----
    await click("closeButton");
    await until(() => !debug().menuOpen(), 3000);
    const back = await probe("pos", "menu");
    check(!debug().menuOpen() && dist(vec(back), vec(parked)) < 0.01, "the close button parks the board again (MENU:79-83)", `${back} / ${parked}`);
    await cmd("shot board 0 1.6 0.4 0 1.5 2 50");
  }

  // ------------------------------------------------------------------------------------------------ rung 4: two players

  const heard = [];
  function channel() {
    const scene = window.BS.Scene.GetInstance();
    scene.On("one-shot", (e) => {
      const data = e && e.detail && e.detail.data;
      if (typeof data !== "string" || data.indexOf("rpTest") < 0) return;
      try {
        heard.push(JSON.parse(data));
      } catch (x) {
        /* not ours */
      }
    });
    return (message) => scene.OneShot(JSON.stringify(Object.assign({ rpTest: 1 }, message)));
  }
  const word = (kind, ms) => until(() => heard.find((m) => m.kind === kind), ms || 90000, 200);
  const reloaded = () => {
    try {
      return sessionStorage.getItem("rpTestReloaded") === "1";
    } catch (e) {
      return false;
    }
  };

  async function selectRow(sid) {
    const index = debug().roster().findIndex((p) => p.sid === sid);
    await click("row" + index);
    return until(() => debug().selected() === sid, 3000);
  }

  async function multi() {
    const back = reloaded();
    if (!(await waitStarted(back ? " (after the reload)" : ""))) return;
    const send = channel();
    const two = await until(() => debug().roster().length >= 2, 90000, 500);
    check(!!two, "two players in the room", JSON.stringify(debug().roster().map((p) => p.name)));
    if (!two) return;
    await sleep(3000);
    const gm = mine().admin;
    const other = () => debug().roster().find((p) => p.sid !== me().sid);
    say("INFO", me().name + (gm ? " is the world's owner" : " is a guest") + (back ? " (back after a reload)" : ""));

    if (back) return lateJoin(send);

    if (gm) {
      // ---- roles as the owner's page works them out ----
      check(mine().role === 3 && other().role === 0, "the world's owner is a Game Master (role 3), the other player has no role", `${mine().role} / ${other().role}`);
      // ---- Player 2's privileged request (move everyone to point A) is refused here before any grant ----
      const p2 = other();
      send({ kind: "ready" });
      const refused = await until(() => debug().refused().some((r) => r === "GoSpawn0 from " + p2.name), 60000, 200);
      check(!!refused, "a non-GM's 'move everyone' request is refused by the GM's page (the sender's role is checked)", JSON.stringify(debug().refused()));
      send({ kind: "refusedSeen" });
      // ---- the grant: Social panel, Player 2's row, Give GM (Instance Lead) ----
      const { open } = await openMenu();
      check(open, "the GM's menu opens (Q)", "");
      await click("navSocial");
      await until(() => debug().shownPanel() === 1, 3000);
      const selected = await selectRow(p2.sid);
      await click("makeController");
      const granted = await until(() => other().role === 1, 6000);
      check(!!selected && !!granted, "the GM selects Player 2 in the list and grants a role: Instance Lead (role 1)", `selected ${!!selected}, role ${other().role}`);
      send({ kind: "granted" });
      // ---- chat: an OOC line from here, an IC line from there; both reach both ----
      await word("named", 120000);
      await click("navMain");
      await click("tabOOC");
      await type("oocInput", "Hello from the GM");
      await click("oocSend");
      const both = await until(() => debug().lines(1).some((l) => l === "Main Editor: Hello from the GM") && debug().lines(0).some((l) => l === "Squire Two: Greetings, game master"), 60000, 250);
      check(!!both, "chat: the GM's OOC line and Player 2's IC line are both on the GM's page", JSON.stringify([debug().lines(1).slice(-2), debug().lines(0).slice(-2)]));
      // ---- bring: Player 2 comes to 1.5 m in front of the GM ----
      await word("chatSeen", 60000);
      await walk();
      const gmHead = await headAt();
      await click("navSocial");
      await selectRow(p2.sid);
      send({ kind: "bringing", head: gmHead });
      await click("bringToMe");
      const arrived = await word("brought", 60000);
      check(!!arrived && arrived.ok, "GM 'bring': Player 2 is moved in front of the GM", arrived ? arrived.detail : "no word from Player 2");
      // ---- Player 2's label, in the GM's Unity: Player 2's page attached it to Player 2's head, the app synced it ----
      const p = other();
      if (p.slot >= 0 && arrived && arrived.head) {
        const want = vec(arrived.head);
        const near = async () => {
          const c = await findpos(`Label ${p.slot}/Canvas`);
          return { c, ok: !!c && c.on && Math.hypot(c.at[0] - want[0], c.at[2] - want[2]) < 0.35 && Math.abs(c.at[1] - want[1] - 0.75) < 0.35 };
        };
        const seen = await settle(near, (v) => v.ok, 10000);
        check(seen.ok, "Player 2's label sits about 0.75 m over Player 2's head in the GM's Unity (Player 2's synced head attachment)", `canvas ${seen.c && seen.c.at.join(" ")} under ${seen.c && seen.c.parent}, Player 2's view ${want.join(" ")}`);
        const name = await cmd("findtext " + enc(`Label ${p.slot}/Canvas/Labels/Text/Nameplate`));
        check(name === "Squire Two", "Player 2's label shows the name Player 2 set", name);
      } else check(false, "Player 2's label sits over Player 2's head", `slot ${p.slot}, head ${arrived && arrived.head}`);
      // ---- a GM-log line: it reaches Player 2 (a lead) live, and is never stored for a late joiner (review finding 2) ----
      await click("navMain");
      await click("tabGM");
      await type("gmInput", "GM eyes only");
      await click("gmSend");
      const gmSeen = await word("gmSeen", 60000);
      check(!!gmSeen, "a GM-log line reaches Player 2 (a lead) live", gmSeen ? JSON.stringify(gmSeen.lines) : "no word");
      // ---- Player 2 reloads: late join ----
      send({ kind: "reload" });
      const again = await word("back", 150000);
      const same = again ? await until(() => debug().view() === again.view, 15000, 250) : false;
      check(!!same, "after reloading, Player 2's page holds the same roles, names, slots and IC and OOC lines as the GM's", again ? `${again.view} / ${debug().view()}` : "no word");
    } else {
      // ---- Player 2: no role, so a privileged request is refused by the others ----
      check(mine().role === 0 && other().role === 3, "Player 2 sees itself with no role and the owner as Game Master", `${mine().role} / ${other().role}`);
      await word("ready");
      const before = await headAt();
      debug().act("spawnAll");
      await word("refusedSeen", 60000);
      const after = await headAt();
      check(dist(vec(before), vec(after)) < 0.05 && debug().refused().some((r) => r.indexOf("GoSpawn0") === 0), "Player 2's own 'move everyone' is refused on its own page too: nobody moved", `${before} -> ${after}; ${JSON.stringify(debug().refused())}`);
      // ---- granted ----
      await word("granted", 120000);
      const lead = await until(() => mine().role === 1, 10000);
      await sleep(800);
      const navGm = await probe("active", "navGM");
      check(!!lead && navGm === "True", "Player 2 is an Instance Lead now: its GM button appears", `role ${mine().role}, GM nav ${navGm}`);
      // ---- name, then an IC line ----
      const { open } = await openMenu();
      check(open, "Player 2's menu opens (Q)", "");
      await type("nameField", "Squire Two");
      await click("setButton");
      await until(() => mine().charName === "Squire Two", 4000);
      send({ kind: "named" });
      await click("tabIC");
      await type("icInput", "Greetings, game master");
      await click("icSend");
      const both = await until(() => debug().lines(1).some((l) => l === "Main Editor: Hello from the GM") && debug().lines(0).some((l) => l === "Squire Two: Greetings, game master"), 60000, 250);
      check(!!both, "chat: both lines are on Player 2's page too", JSON.stringify([debug().lines(1).slice(-2), debug().lines(0).slice(-2)]));
      const from = await headAt();
      send({ kind: "chatSeen" });
      // ---- brought ----
      const bring = await word("bringing", 120000);
      await sleep(3000);
      const to = await headAt();
      const gmHead = bring ? vec(bring.head) : [0, 0, 0];
      const flat = Math.hypot(vec(to)[0] - gmHead[0], vec(to)[2] - gmHead[2]);
      const ok = dist(vec(from), vec(to)) > 0.5 && Math.abs(flat - 1.5) < 0.4;
      check(ok, "GM 'bring' moves Player 2 to about 1.5 m in front of the GM (GMD:524-554)", `from ${from} to ${to}; GM head ${bring && bring.head}; ${flat.toFixed(2)} m across`);
      send({ kind: "brought", ok, head: to, detail: `from ${from} to ${to}, ${flat.toFixed(2)} m from the GM's head` });
      // ---- the GM's GM-log line arrives here live ----
      const gmLine = await until(() => debug().lines(2).some((l) => l === "Main Editor: GM eyes only"), 60000, 250);
      if (gmLine) send({ kind: "gmSeen", lines: debug().lines(2) });
      // ---- reload ----
      await word("reload", 120000);
      try {
        sessionStorage.setItem("rpTestReloaded", "1");
      } catch (e) {
        /* no storage */
      }
      say("INFO", "Player 2 reloads its page");
      await sleep(500);
      location.reload();
      await sleep(60000);
    }
  }

  async function lateJoin(send) {
    const roles = await until(() => {
      const r = debug().roster();
      const gm = r.find((p) => p.admin);
      return gm && gm.role === 3 && mine().role === 1;
    }, 30000, 250);
    check(!!roles, "after the reload: the GM is still Game Master and Player 2 still Instance Lead (the grant is protected state)", JSON.stringify(debug().roster().map((p) => [p.name, p.role])));
    const logs = await until(() => debug().lines(1).some((l) => l === "Main Editor: Hello from the GM") && debug().lines(0).some((l) => l === "Squire Two: Greetings, game master"), 30000, 250);
    check(!!logs, "after the reload: the recent OOC and IC lines are back (the referee's recent lines)", JSON.stringify([debug().lines(1).slice(-3), debug().lines(0).slice(-3)]));
    const name = await until(() => mine().charName === "Squire Two" && debug().fields().name === "Squire Two", 15000, 250);
    check(!!name, "after the reload: Player 2's name comes back from this device, and the Name field is filled", JSON.stringify([mine().charName, debug().fields()]));
    check(debug().lines(2).length === 0, "after the reload: no GM-log line came back (they are never published)", JSON.stringify(debug().lines(2)));
    await sleep(2500);
    send({ kind: "back", view: debug().view() });
    try {
      sessionStorage.removeItem("rpTestReloaded");
    } catch (e) {
      /* nothing */
    }
  }

  window.__rpRun = async function (plan) {
    try {
      if (plan === "single") await single();
      else if (plan === "multi") await multi();
    } catch (e) {
      check(false, "the test ran to its end", e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : String(e));
    }
    say("INFO", "page result " + passed + " passed, " + failed + " failed");
    console.log("PKTEST DONE");
  };
  if (window.__rpPlan) window.__rpRun(window.__rpPlan);
})();
