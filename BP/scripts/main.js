// Licensed under mpl 2.0
//follow terms of the license

import {
  world,
  system,
  EquipmentSlot,
  CommandPermissionLevel,
  CustomCommandStatus,
  Player,
  InputButton,
  ButtonState,
  ItemStack,
  BlockTypes,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
var v = "1.1.0",
  lol = {};
function go(p) {
  var t = st(p.id),
    s = get(p),
    o = h(p);
  if (o.one == "") t.u = false;
  if (p.getDynamicProperty("vantage:suppressed") == true) {
    back(p, t, "suppressed", false);
    return;
  }
  var mm = m(p);
  if (s.addonMounts && mm != undefined && mm.indexOf("minecraft:") != 0) {
    back(p, t, "mount", true);
    return;
  }
  if (s.enabled == false) {
    van(p, t, "off");
    return;
  }
  if (check(p, s, o) == true) {
    van(p, t, "vanilla");
    return;
  }
  if (s.view == "third") {
    stop(p, t);
    p.camera.setCamera("minecraft:third_person");
  } else {
    var an = a1[s.distance],
      bk = [0.04, 0.13, 0.25][s.distance];
    if (s.view == "epic") {
      bk = 0.13;
      if (check2(o, t)) an = "animation.vantage.epic.body";
      else an = "animation.vantage.epic.arms";
    }
    if (t.a != null && t.a != an) {
      p.playAnimation(t.a, { players: [p], blendOutTime: 0 });
      t.a = null;
    }
    p.playAnimation(an, { players: [p], blendOutTime: 999999 });
    t.a = an;
    var z = s.offsetZ;
    if (z < -bk) z = -bk;
    p.camera.setCamera("vantage:pov", {
      entityOffset: { x: s.offsetX, y: s.offsetY, z: z },
    });
  }
  t.m = s.view;
  t.c = 0;
  fov(p, t, s);
}
world.afterEvents.itemStartUse.subscribe(function (e) {
  st(e.source.id).u = true;
});
world.afterEvents.itemStopUse.subscribe(function (e) {
  st(e.source.id).u = false;
});
function thing() {
  return {
    enabled: true,
    view: "body",
    distance: 1,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    fovEnabled: false,
    fov: 70,
    quickToggle: true,
    vanillaGliding: true,
    vanillaCrawling: true,
    vanillaSpyglass: true,
    vanillaRiding: false,
    addonMounts: true,
    touchBuild: true,
  };
}
var data = {};
function st(id) {
  if (data[id] == undefined) {
    data[id] = { m: "none", a: null, f: null, c: 0, u: false, l: -100 };
  }
  return data[id];
}
function num(n, a, b, c) {
  n = Number(n);
  if (isNaN(n)) return c;
  if (n < a) n = a;
  if (n > b) n = b;
  return n;
}
world.afterEvents.itemReleaseUse.subscribe(function (e) {
  st(e.source.id).u = false;
});
function tog(p) {
  var s = get(p);
  s.enabled = !s.enabled;
  save(p, s);
  go(p);
  if (s.enabled == true)
    p.onScreenDisplay.setActionBar("§aVantage ON §7(" + nm(s) + ")");
  else p.onScreenDisplay.setActionBar("§7Vantage OFF");
}
system.beforeEvents.startup.subscribe(function (e) {
  var r = e.customCommandRegistry;
  function add(a, b, c) {
    r.registerCommand(
      {
        name: a,
        description: b,
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      function (o) {
        var p = o.sourceEntity;
        if (!(p instanceof Player))
          return {
            status: CustomCommandStatus.Failure,
            message: "Players only.",
          };
        system.run(function () {
          if (p.isValid) c(p);
        });
        return { status: CustomCommandStatus.Success };
      },
    );
  }
  add("vantage:vantage", "Open the Vantage menu.", menu);
  add("vantage:toggle", "Toggle Vantage on or off.", tog);
  add("vantage:config", "Open Vantage settings.", menu2);
  add("vantage:view", "Switch to the next Vantage view.", nxt);
});
var data2 = {};
function get(p) {
  if (data2[p.id] != undefined) return data2[p.id];
  var s = thing(),
    x = p.getDynamicProperty("vantage:cfg");
  if (typeof x == "string") {
    try {
      var y = JSON.parse(x);
      for (var k in s) {
        if (y[k] != undefined) s[k] = y[k];
      }
    } catch (e) {
      s = thing();
    }
  }
  s.distance = num(s.distance, 0, 2, 1) | 0;
  s.offsetX = num(s.offsetX, -0.5, 0.5, 0);
  s.offsetY = num(s.offsetY, -0.5, 0.5, 0);
  s.offsetZ = num(s.offsetZ, -0.5, 0.5, 0);
  s.fov = num(s.fov, 30, 110, 70);
  if (vs.indexOf(s.view) == -1) s.view = "body";
  data2[p.id] = s;
  return s;
}
function save(p, s) {
  data2[p.id] = s;
  p.setDynamicProperty("vantage:cfg", JSON.stringify(s));
}
function stop(p, t) {
  if (t.a != null) {
    p.playAnimation(t.a, { players: [p], blendOutTime: 0 });
    t.a = null;
    p.playAnimation("animation.vantage.release", {
      players: [p],
      blendOutTime: 0,
    });
  }
}
function m(p) {
  var r = p.getComponent("minecraft:riding");
  if (r == undefined || r.entityRidingOn == undefined) return undefined;
  return r.entityRidingOn.typeId;
}
world.afterEvents.playerButtonInput.subscribe(function (e) {
  if (e.button != InputButton.Jump || e.newButtonState != ButtonState.Pressed)
    return;
  var p = e.player;
  if (get(p).quickToggle == false) return;
  var sn = p.inputInfo.getButtonState(InputButton.Sneak) == ButtonState.Pressed;
  if (sn == false) sn = p.isSneaking;
  if (sn == false) return;
  var now = system.currentTick;
  if (lol[p.id] != undefined && now - lol[p.id] < 10) return;
  lol[p.id] = now;
  system.run(function () {
    if (p.isValid) tog(p);
  });
});
function van(p, t, w) {
  if (t.m != w) {
    stop(p, t);
    nofov(p, t);
    if (ours(t.m) || t.m == "none") t.c = 0;
    else t.c = 20;
    t.m = w;
  }
  if (t.c < 20) {
    t.c++;
    p.camera.clear();
  }
}
function back(p, t, w, cl) {
  if (t.m == w) return;
  stop(p, t);
  nofov(p, t);
  if (cl == true && ours(t.m)) p.camera.clear();
  t.m = w;
  t.c = 0;
}
function ours(x) {
  if (x == "body" || x == "epic" || x == "third") return true;
  else return false;
}
var names = ["Full Body", "Epic Fight", "Third Person"],
  vs = ["body", "epic", "third"];
function nm(s) {
  return names[vs.indexOf(s.view)];
}
function h(p) {
  var e = p.getComponent("minecraft:equippable"),
    a = e.getEquipment(EquipmentSlot.Mainhand),
    b = e.getEquipment(EquipmentSlot.Offhand),
    o = { one: "", two: "" };
  if (a) o.one = a.typeId;
  if (b) o.two = b.typeId;
  return o;
}
function check(p, s, o) {
  if (p.isSleeping) return true;
  var mm = m(p);
  if (mm != undefined) {
    if (mm == "minecraft:happy_ghast") return true;
    if (s.vanillaRiding == true) return true;
  }
  if (s.vanillaGliding && p.isGliding) return true;
  if (
    s.vanillaCrawling &&
    p.isSwimming == false &&
    p.isGliding == false &&
    p.getHeadLocation().y < p.location.y + 1
  )
    return true;
  if (o.one == "minecraft:map" || o.one == "minecraft:filled_map") return true;
  if (o.two == "minecraft:map" || o.two == "minecraft:filled_map") return true;
  if (
    s.vanillaSpyglass &&
    (o.one == "minecraft:spyglass" || o.two == "minecraft:spyglass")
  )
    return true;
  if (String(p.getGameMode()).toLowerCase() == "spectator") return true;
  var hp = p.getComponent("minecraft:health");
  if (hp && hp.currentValue <= 0) return true;
  if (
    s.touchBuild &&
    p.inputInfo.lastInputModeUsed == "Touch" &&
    o.one != "" &&
    BlockTypes.get(o.one) != undefined
  )
    return true;
  return false;
}
world.afterEvents.itemCompleteUse.subscribe(function (e) {
  st(e.source.id).u = false;
});
function nxt(p) {
  var s = get(p);
  if (s.enabled == false) {
    s.enabled = true;
    s.view = "body";
  } else if (s.view == "body") s.view = "epic";
  else if (s.view == "epic") s.view = "third";
  else s.enabled = false;
  save(p, s);
  go(p);
  if (s.enabled == true)
    p.onScreenDisplay.setActionBar("§9Vantage: §f" + nm(s));
  else p.onScreenDisplay.setActionBar("§9Vantage: §fVanilla view");
}
var arr = [
  "minecraft:bow",
  "minecraft:crossbow",
  "minecraft:trident",
  "minecraft:spyglass",
  "minecraft:goat_horn",
  "minecraft:brush",
  "minecraft:map",
  "minecraft:filled_map",
];
function check2(o, t) {
  if (t.u == true) return true;
  if (arr.indexOf(o.one) != -1) return true;
  if (arr.indexOf(o.two) != -1) return true;
  if (o.one.endsWith("_spear")) return true;
  return false;
}
function menu(p) {
  var s = get(p),
    f = new ActionFormData();
  f.title("Vantage");
  f.body(
    "Vantage is " +
      (s.enabled ? "§aON§r" : "§cOFF§r") +
      "\nView: §f" +
      nm(s) +
      "§r\nBody distance: §f" +
      dn[s.distance] +
      "§r\n§7Quick toggle: Sneak + Jump\nVantage Lens: use it to switch views§r\n§8v" +
      v +
      "§r",
  );
  f.button(s.enabled ? "Turn Off" : "Turn On");
  f.button("Switch View");
  f.button("Settings");
  f.button("Get a Vantage Lens");
  f.button("Reset to Defaults");
  show(p, f, 0, function (r) {
    if (r.canceled) return;
    if (r.selection == 0) tog(p);
    if (r.selection == 1) nxt(p);
    if (r.selection == 2) menu2(p);
    if (r.selection == 3) give(p);
    if (r.selection == 4) {
      save(p, thing());
      p.sendMessage("§7[Vantage] Settings reset.");
    }
  });
}
world.afterEvents.itemUse.subscribe(function (e) {
  if (e.itemStack.typeId != "vantage:lens") return;
  lens(e.source);
});
world.beforeEvents.playerInteractWithBlock.subscribe(function (e) {
  if (e.itemStack == undefined || e.itemStack.typeId != "vantage:lens") return;
  e.cancel = true;
  if (e.isFirstEvent == false) return;
  var p = e.player;
  system.run(function () {
    lens(p);
  });
});
function lens(p) {
  var t = st(p.id);
  if (system.currentTick - t.l < 5) return;
  t.l = system.currentTick;
  if (p.isSneaking == true) menu(p);
  else nxt(p);
}
function nofov(p, t) {
  if (t.f != null) {
    t.f = null;
    p.camera.setFov();
  }
}
function fov(p, t, s) {
  var w = null;
  if (s.fovEnabled == true) w = s.fov;
  if (t.f == w) return;
  t.f = w;
  if (w == null) p.camera.setFov();
  else p.camera.setFov({ fov: w });
}
var dn = ["Close", "Normal", "Far"];
function menu2(p) {
  var s = get(p),
    f = new ModalFormData();
  f.title("Vantage - Settings");
  f.toggle("Vantage on", { defaultValue: s.enabled });
  f.dropdown("View", names, { defaultValueIndex: vs.indexOf(s.view) });
  f.dropdown("Body distance", dn, { defaultValueIndex: s.distance });
  f.slider("Camera left / right", -50, 50, {
    defaultValue: Math.round(s.offsetX * 100),
    valueStep: 1,
  });
  f.slider("Camera up / down", -50, 50, {
    defaultValue: Math.round(s.offsetY * 100),
    valueStep: 1,
  });
  f.slider("Camera forward / back", -50, 50, {
    defaultValue: Math.round(s.offsetZ * 100),
    valueStep: 1,
  });
  f.toggle("Override field of view", { defaultValue: s.fovEnabled });
  f.slider("Field of view", 30, 110, { defaultValue: s.fov, valueStep: 1 });
  f.toggle("Quick toggle (Sneak + Jump)", { defaultValue: s.quickToggle });
  f.toggle("Vanilla view while gliding", { defaultValue: s.vanillaGliding });
  f.toggle("Vanilla view while crawling", { defaultValue: s.vanillaCrawling });
  f.toggle("Vanilla view with spyglass", { defaultValue: s.vanillaSpyglass });
  f.toggle("Vanilla view while riding", { defaultValue: s.vanillaRiding });
  f.toggle("Let add-on mounts control the camera (dragons, vehicles...)", {
    defaultValue: s.addonMounts,
  });
  f.toggle("Touch: vanilla view while holding blocks (tap to place)", {
    defaultValue: s.touchBuild,
  });
  show(p, f, 0, function (r) {
    if (r.canceled || r.formValues == undefined) return;
    var q = r.formValues,
      n = thing();
    n.enabled = q[0] == true;
    n.view = vs[q[1]];
    n.distance = num(q[2], 0, 2, 1) | 0;
    n.offsetX = num(q[3] / 100, -0.5, 0.5, 0);
    n.offsetY = num(q[4] / 100, -0.5, 0.5, 0);
    n.offsetZ = num(q[5] / 100, -0.5, 0.5, 0);
    n.fovEnabled = q[6] == true;
    n.fov = num(q[7], 30, 110, 70);
    n.quickToggle = q[8] == true;
    n.vanillaGliding = q[9] == true;
    n.vanillaCrawling = q[10] == true;
    n.vanillaSpyglass = q[11] == true;
    n.vanillaRiding = q[12] == true;
    n.addonMounts = q[13] == true;
    n.touchBuild = q[14] == true;
    if (n.view == undefined) n.view = "body";
    save(p, n);
    p.sendMessage("§7[Vantage] Settings saved.");
  });
}
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(function (e) {
  st(e.player.id).u = false;
});
function show(p, f, n, cb) {
  f.show(p).then(function (r) {
    if (r.canceled && r.cancelationReason == "UserBusy" && n < 10) {
      system.runTimeout(function () {
        show(p, f, n + 1, cb);
      }, 10);
      return;
    }
    cb(r);
  });
}
system.afterEvents.scriptEventReceive.subscribe(function (e) {
  if (e.id != "vantage:suppress") return;
  var p = e.sourceEntity;
  if (p == undefined || p.typeId != "minecraft:player") return;
  var on = String(e.message).trim().toLowerCase() == "true";
  system.run(function () {
    p.setDynamicProperty("vantage:suppressed", on);
  });
});
function give(p) {
  var inv = p.getComponent("minecraft:inventory").container;
  for (var i = 0; i < inv.size; i++) {
    var it = inv.getItem(i);
    if (it && it.typeId == "vantage:lens") {
      p.sendMessage("§7[Vantage] You already have a Vantage Lens!");
      return;
    }
  }
  if (inv.addItem(new ItemStack("vantage:lens", 1)))
    p.sendMessage("§c[Vantage] Your inventory is full!");
  else
    p.sendMessage(
      "§7[Vantage] Here's your §9Vantage Lens§7! Use it to switch views, sneak + use it for the menu.",
    );
}
world.afterEvents.playerLeave.subscribe(function (e) {
  delete data[e.playerId];
  delete data2[e.playerId];
  delete lol[e.playerId];
});
world.afterEvents.playerSpawn.subscribe(function (e) {
  if (e.initialSpawn == false) return;
  var p = e.player;
  delete data[p.id];
  delete data2[p.id];
  system.runTimeout(function () {
    if (!p.isValid || p.getDynamicProperty("vantage:seen")) return;
    p.setDynamicProperty("vantage:seen", true);
    p.sendMessage(
      "§7[§9§lVantage§r§7 v" +
        v +
        "]§r First-person body is §aon§r.\n§7Toggle: §fSneak + Jump§7 or §f/vantage§7. Craft a §9Vantage Lens§7 (glass pane + copper ingot) to switch views.",
    );
  }, 60);
});
var a1 = [
  "animation.vantage.body.close",
  "animation.vantage.body.normal",
  "animation.vantage.body.far",
];
system.runInterval(function () {
  var ps = world.getAllPlayers();
  for (var i = 0; i < ps.length; i++) {
    try {
      if (ps[i].isValid) go(ps[i]);
    } catch (e) {}
  }
}, 1);
console.warn("[Vantage v" + v + "] loaded!");
