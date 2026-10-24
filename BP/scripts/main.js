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
  ItemTypes,
  InputPermissionCategory,
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
var v = "2.2.0",
  lol = {};
var OFF = "§v§u§t§0"
function go(p) {
  var t = st(p.id),
    s = get(p),
    w = ww(),
    o = h(p),
    now = system.currentTick;
  if (o.one == "") t.u = false;
  var en = s.enabled,
    vw = s.view;
  if (w.players_can_toggle == false) {
    en = w.on_by_default;
    vw = dv(w);
  }
  if (p.getDynamicProperty("vantage:suppressed") == true) {
    back(p, t, "suppressed", false);
    return;
  }
  if (w.handshake == true && (p.hasTag("vantage:pause") == true || t.p > now)) {
    back(p, t, "paused", true)
    return
  }
  if (w.other_fp == true && p.hasTag("ae_fpm.is_first_person") == true) {
    back(p, t, "otherfp", false);
    return;
  }
  if (s.cutscenes == true && p.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Camera) == false) {
    back(p, t, "cutscene", false)
    return
  }
  var mm = m(p);
  if (s.addonMounts && mm != undefined && mm.indexOf("minecraft:") != 0) {
    back(p, t, "mount", true);
    return;
  }
  var fight = icc(p, t, w);
  if (fight == true && s.icCamera == true && en == true && p.hasTag("ae_fpm.disable_animation") == false) {
    back(p, t, "ic", "third");
    return;
  }
  if (en == false) {
    van(p, t, "off");
    return;
  }
  if (check(p, s, o, t, w) == true) {
    van(p, t, "vanilla");
    return;
  }
  if (fight == true && s.icEpic == true && vw == "body") vw = "epic"
  if (air(p, s) == 2) vw = "third";
  if (vw == "third") {
    stop(p, t);
    p.camera.setCamera("minecraft:third_person");
  } else {
    var an = a1[s.distance],
      bk = [0.04, 0.13, 0.25][s.distance];
    if (vw == "epic") {
      bk = 0.13;
      if (w.ic == true && p.hasTag("ae_fpm.disable_animation")) an = "animation.vantage.epic.free"
      else if (fight == true) an = "animation.vantage.epic.free"
      else if (check2(o, t)) an = "animation.vantage.epic.free";
      else an = "animation.vantage.epic.arms";
    } else {
      if (w.ic == true && p.hasTag("ae_fpm.disable_animation") == true) an = "animation.vantage.head"
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
  t.m = vw;
  t.c = 0;
  fov(p, t, s);
  var k = OFF;
  if (s.crosshair == true && (vw != "third" || s.crosshairThird == true)) k = "§v§u§t§" + (s.crosshairStyle + 1)
  xh(p, t, k);
}
world.afterEvents.itemStartUse.subscribe(function (e) {
  st(e.source.id).u = true;
});
var wd = {
  on_by_default: true,
  default_view: "body",
  default_distance: "normal",
  players_can_toggle: true,
  players_can_configure: true,
  quick_toggle: true,
  welcome_message: true,
  lens_on_join: false,
  crosshair: true,
  crosshair_style: "vanilla",
  crosshair_third: false,
  water_mode: "deep",
  water_delay: 10,
  glide_mode: "third",
  fly_mode: "third",
  vanilla_crawling: true,
  vanilla_spyglass: true,
  vanilla_riding: false,
  touch_build: true,
  addon_mounts: true,
  cutscenes: true,
  handshake: true,
  other_fp: true,
  ic: true,
  ic_epic: false,
  ic_camera: false,
  lens_body: true,
  lens_epic: true,
  lens_third: true,
  lens_vanilla: true,
};
world.afterEvents.itemStopUse.subscribe(function (e) {
  st(e.source.id).u = false;
});
function thing() {
  var w = ww(),
    d = dd.indexOf(w.default_distance),
    x = xs.indexOf(w.crosshair_style),
    y = wm.indexOf(w.water_mode),
    g = fm.indexOf(w.glide_mode),
    fl = fm.indexOf(w.fly_mode);
  if (g == -1) g = 2;
  if (fl == -1) fl = 2;
  if (d == -1) d = 1;
  if (x == -1) x = 0;
  if (y == -1) y = 2;
  return {
    enabled: w.on_by_default,
    view: dv(w),
    distance: d,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    fovEnabled: false,
    fov: 70,
    quickToggle: true,
    crosshair: w.crosshair,
    crosshairStyle: x,
    crosshairThird: w.crosshair_third,
    water: y,
    glide: g,
    fly: fl,
    vanillaCrawling: w.vanilla_crawling,
    vanillaSpyglass: w.vanilla_spyglass,
    vanillaRiding: w.vanilla_riding,
    addonMounts: w.addon_mounts,
    cutscenes: w.cutscenes,
    touchBuild: w.touch_build,
    icEpic: w.ic_epic,
    icCamera: w.ic_camera,
    lensBody: w.lens_body,
    lensEpic: w.lens_epic,
    lensThird: w.lens_third,
    lensVanilla: w.lens_vanilla,
  };
}
var data = {};
function st(id) {
  if (data[id] == undefined) {
    data[id] = { m: "none", a: null, f: null, c: 0, u: false, l: -100, w: -100, x: OFF, xb: 0, p: 0, iw: false };
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
var ws = null,
  wt = -1000;
function ww() {
  if (ws != null && system.currentTick - wt < 40) return ws;
  var x = world.getPackSettings(),
    n = {};
  for (var k in wd) {
    n[k] = wd[k];
    if (x != undefined && typeof x["vantage:" + k] == typeof wd[k]) n[k] = x["vantage:" + k];
  }
  ws = n;
  wt = system.currentTick;
  return ws;
}
world.afterEvents.itemReleaseUse.subscribe(function (e) {
  st(e.source.id).u = false;
});
function tog(p) {
  if (ww().players_can_toggle == false) {
    p.onScreenDisplay.setActionBar("§cThe world owner locked Vantage");
    return;
  }
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
      if (y.glide == undefined && y.vanillaGliding == false) s.glide = 0;
    } catch (e) {
      s = thing();
    }
  }
  s.distance = num(s.distance, 0, 2, 1) | 0;
  s.offsetX = num(s.offsetX, -0.5, 0.5, 0);
  s.offsetY = num(s.offsetY, -0.5, 0.5, 0);
  s.offsetZ = num(s.offsetZ, -0.5, 0.5, 0);
  s.fov = num(s.fov, 30, 110, 70);
  s.crosshairStyle = num(s.crosshairStyle, 0, 3, 0) | 0;
  s.water = num(s.water, 0, 2, 2) | 0;
  s.glide = num(s.glide, 0, 2, 2) | 0;
  s.fly = num(s.fly, 0, 2, 2) | 0;
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
  if (get(p).quickToggle == false || ww().quick_toggle == false) return;
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
    else t.c = 6;
    t.m = w;
  }
  if (t.c < 6) {
    t.c++;
    p.camera.clear();
  }
  xh(p, t, OFF);
}
function back(p, t, w, cl) {
  xh(p, t, OFF);
  if (t.m == w) return;
  stop(p, t);
  nofov(p, t);
  if (cl == "third") p.camera.setCamera("minecraft:third_person");
  else if (cl == true && ours(t.m)) p.camera.clear();
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
function dv(w) {
  var x = w.default_view;
  if (vs.indexOf(x) == -1) x = "body";
  return x;
}
function check(p, s, o, t, w) {
  if (p.isSleeping) return true;
  if (s.water > 0) {
    if (wet(p, s.water) == true) t.w = system.currentTick + w.water_delay;
    if (t.w >= system.currentTick) return true;
  }
  var mm = m(p);
  if (mm != undefined) {
    if (mm == "minecraft:happy_ghast") return true;
    if (s.vanillaRiding == true) return true;
  }
  if (air(p, s) == 1) return true;
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
  if (ww().players_can_toggle == false) {
    p.onScreenDisplay.setActionBar("§cThe world owner locked Vantage");
    return;
  }
  var s = get(p),
    lz = lzz(s),
    cur = "off",
    nx = "off";
  if (s.enabled == true) cur = s.view;
  nx = cur;
  for (var j = 1; j <= 4; j++) {
    var c = cy[(cy.indexOf(cur) + j) % 4];
    if (lz.indexOf(c) != -1) {
      nx = c;
      break;
    }
  }
  if (nx == cur) {
    p.onScreenDisplay.setActionBar("§7Pick more views for the Lens in §f/vantage§7 settings");
    return;
  }
  if (nx == "off") s.enabled = false;
  else {
    s.enabled = true;
    s.view = nx;
  }
  save(p, s);
  go(p);
  if (s.enabled == true)
    p.onScreenDisplay.setActionBar("§9Vantage: §f" + nm(s));
  else p.onScreenDisplay.setActionBar("§9Vantage: §fVanilla view");
}
var cy = ["body", "epic", "third", "off"];
function lzz(s) {
  var a = [];
  if (s.lensBody == true) a.push("body");
  if (s.lensEpic == true) a.push("epic");
  if (s.lensThird == true) a.push("third");
  if (s.lensVanilla == true) a.push("off");
  if (a.length == 0) a = cy.slice();
  return a;
}
function lzn(s) {
  var a = lzz(s),
    b = "";
  for (var i = 0; i < a.length; i++) {
    if (i > 0) b = b + ", ";
    if (a[i] == "off") b = b + "Vanilla";
    else b = b + names[vs.indexOf(a[i])];
  }
  return b;
}
function air(p, s) {
  if (p.isGliding == true) return s.glide;
  if (p.isFlying == true) return s.fly;
  return 0;
}
function wet(p, md) {
  if (p.isSwimming == true) return true;
  if (md != 2) return false;
  if (p.isInWater == false) return false;
  var b = p.dimension.getBlock(p.getHeadLocation());
  if (b != undefined && b.isLiquid == true) return true;
  if (p.isOnGround == true) return false;
  var l = p.location;
  b = p.dimension.getBlock({ x: l.x, y: l.y + 0.8, z: l.z });
  if (b != undefined && b.isLiquid == true) return true;
  return false;
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
var ic1 = null;
function icc(p, t, w) {
  if (w.ic == false) return false;
  if (ic1 == null) ic1 = ItemTypes.get("imc:combat_mode") != undefined;
  if (ic1 == false) return false;
  var e = p.getEffect("weakness");
  if (e != undefined && e.duration <= 25) {
    t.iw = true;
    return false;
  }
  if (t.iw == true) return true;
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
    "§r\nCrosshair: §f" +
    (s.crosshair ? xn[s.crosshairStyle] : "Off") +
    "§r\nLens switches to: §f" +
    lzn(s) +
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
function xh(p, t, k) {
  if (t.x != k) {
    t.x = k;
    t.xb = 4;
  }
  if (t.xb > 0) {
    t.xb--;
    p.onScreenDisplay.setTitle(t.x, { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
  }
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
var dn = ["Close", "Normal", "Far"],
  dd = ["close", "normal", "far"];
var xn = ["Vanilla", "Dot", "Small plus", "Circle"],
  xs = ["vanilla", "dot", "plus", "circle"];
var wn = ["Keep Vantage", "Vanilla only while swimming", "Vanilla while swimming or in deep water"],
  wm = ["off", "swim", "deep"];
var fn = ["Keep Vantage", "Vanilla first person", "Vanilla third person"],
  fm = ["off", "first", "third"];
function menu2(p) {
  if (ww().players_can_configure == false) {
    p.sendMessage("§c[Vantage] The world owner turned off the settings menu.");
    return;
  }
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
  f.toggle("Show a crosshair", { defaultValue: s.crosshair });
  f.dropdown("Crosshair style", xn, { defaultValueIndex: s.crosshairStyle });
  f.toggle("Crosshair in Third Person too", { defaultValue: s.crosshairThird });
  f.dropdown("In water", wn, { defaultValueIndex: s.water });
  f.dropdown("While gliding (elytra)", fn, { defaultValueIndex: s.glide });
  f.dropdown("While flying (creative)", fn, { defaultValueIndex: s.fly });
  f.toggle("Vanilla view while crawling", { defaultValue: s.vanillaCrawling });
  f.toggle("Vanilla view with spyglass", { defaultValue: s.vanillaSpyglass });
  f.toggle("Vanilla view while riding", { defaultValue: s.vanillaRiding });
  f.toggle("Let add-on mounts control the camera (dragons, planes...)", {
    defaultValue: s.addonMounts,
  });
  f.toggle("Step aside when another add-on locks the camera (cutscenes)", {
    defaultValue: s.cutscenes,
  });
  f.toggle("Touch: vanilla view while holding blocks (tap to place)", {
    defaultValue: s.touchBuild,
  });
  f.toggle("Immersive Combat: Epic Fight view in combat mode", { defaultValue: s.icEpic });
  f.toggle("Immersive Combat: let combat mode use its own camera", { defaultValue: s.icCamera });
  f.toggle("Lens / Switch View goes to Full Body", { defaultValue: s.lensBody });
  f.toggle("Lens / Switch View goes to Epic Fight", { defaultValue: s.lensEpic });
  f.toggle("Lens / Switch View goes to Third Person", { defaultValue: s.lensThird });
  f.toggle("Lens / Switch View goes to Vanilla", { defaultValue: s.lensVanilla });
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
    n.crosshair = q[9] == true;
    n.crosshairStyle = num(q[10], 0, 3, 0) | 0;
    n.crosshairThird = q[11] == true;
    n.water = num(q[12], 0, 2, 2) | 0;
    n.glide = num(q[13], 0, 2, 2) | 0;
    n.fly = num(q[14], 0, 2, 2) | 0;
    n.vanillaCrawling = q[15] == true;
    n.vanillaSpyglass = q[16] == true;
    n.vanillaRiding = q[17] == true;
    n.addonMounts = q[18] == true;
    n.cutscenes = q[19] == true;
    n.touchBuild = q[20] == true;
    n.icEpic = q[21] == true;
    n.icCamera = q[22] == true;
    n.lensBody = q[23] == true;
    n.lensEpic = q[24] == true;
    n.lensThird = q[25] == true;
    n.lensVanilla = q[26] == true;
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
  if (e.id.indexOf("vantage:") != 0) return;
  var p = e.sourceEntity;
  if (p == undefined || p.typeId != "minecraft:player") return;
  var g = String(e.message).trim().toLowerCase();
  if (e.id == "vantage:suppress") {
    var on = g == "true";
    system.run(function () {
      p.setDynamicProperty("vantage:suppressed", on);
    });
  }
  if (ww().handshake == false) return;
  if (e.id == "vantage:pause") {
    var n = parseInt(g);
    if (isNaN(n)) n = 100;
    st(p.id).p = system.currentTick + n;
  }
  if (e.id == "vantage:resume") st(p.id).p = 0;
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
world.afterEvents.playerDimensionChange.subscribe(function (e) {
  st(e.player.id).xb = 4;
});
world.afterEvents.playerSpawn.subscribe(function (e) {
  var p = e.player;
  if (e.initialSpawn == false) {
    st(p.id).xb = 4;
    return;
  }
  delete data[p.id];
  delete data2[p.id];
  system.runTimeout(function () {
    if (p.isValid) st(p.id).xb = 4;
  }, 40);
  system.runTimeout(function () {
    if (!p.isValid || p.getDynamicProperty("vantage:seen")) return;
    p.setDynamicProperty("vantage:seen", true);
    var w = ww();
    if (w.lens_on_join == true) give(p);
    if (w.welcome_message == false) return;
    p.sendMessage(
      "§7[§9§lVantage§r§7 v" +
      v +
      "]§r Vantage is " +
      (get(p).enabled ? "§aon" : "§coff") +
      "§r.\n§7Toggle: §fSneak + Jump§7 or §f/vantage§7. Craft a §9Vantage Lens§7 (glass pane + copper ingot) to switch views. Try the §fEpic Fight§7 view for just your two arms!",
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
    } catch (e) { }
  }
}, 1);
console.warn("[Vantage v" + v + "] loaded!");
