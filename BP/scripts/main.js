import { world, system, EquipmentSlot, CommandPermissionLevel, CustomCommandStatus, Player, InputButton, ButtonState, ItemStack, BlockTypes } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"

// VANTAGE - main script
// made by Draco12191712
// everything is in this one file now because splitting it up kept breaking stuff

var VERSION = "1.1.0"
var PRESET = "vantage:pov"
var HOLD = 999999 // big number so the animation just stays on

// body animations. 0 = close, 1 = normal, 2 = far
var bodyAnims = ["animation.vantage.body.close", "animation.vantage.body.normal", "animation.vantage.body.far"]
var epicArms = "animation.vantage.epic.arms" // epic fight view, arms up in front of you
var epicNoArms = "animation.vantage.epic.body" // same thing but doesnt touch the arms (for bows and stuff)
var releaseAnim = "animation.vantage.release"

var distanceNames = ["Close", "Normal", "Far"]
var views = ["body", "epic", "third"]
var viewNames = ["Full Body", "Epic Fight", "Third Person"]

// how far back (blocks) you can move the camera before it goes inside your chest.
// if it goes in there you see the back of your own body from the inside and it looks super weird
var maxBack = [0.04, 0.13, 0.25]

// items that have their own arm poses, epic fight mode leaves your arms alone while you hold these
var armItems = ["minecraft:bow", "minecraft:crossbow", "minecraft:trident", "minecraft:spyglass", "minecraft:goat_horn", "minecraft:brush", "minecraft:map", "minecraft:filled_map"]

console.warn("[Vantage v" + VERSION + "] loading...")

// ---------------- settings ----------------

function defaultSettings() {
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
        touchBuild: true
    }
}

function fixNumber(n, min, max, dflt) {
    n = Number(n)
    if (isNaN(n)) return dflt
    if (n < min) n = min
    if (n > max) n = max
    return n
}

var settingsCache = {}

function getSettings(player) {
    if (settingsCache[player.id] != undefined) return settingsCache[player.id]

    var s = defaultSettings()
    var saved = player.getDynamicProperty("vantage:cfg")
    if (typeof saved == "string") {
        try {
            var loaded = JSON.parse(saved)
            for (var key in s) {
                if (loaded[key] != undefined) s[key] = loaded[key]
            }
        } catch (e) {
            s = defaultSettings() // save was broken, oh well
        }
    }

    s.distance = fixNumber(s.distance, 0, 2, 1) | 0
    s.offsetX = fixNumber(s.offsetX, -0.5, 0.5, 0)
    s.offsetY = fixNumber(s.offsetY, -0.5, 0.5, 0)
    s.offsetZ = fixNumber(s.offsetZ, -0.5, 0.5, 0)
    s.fov = fixNumber(s.fov, 30, 110, 70)
    if (views.indexOf(s.view) == -1) s.view = "body"

    settingsCache[player.id] = s
    return s
}

function saveSettings(player, s) {
    settingsCache[player.id] = s
    player.setDynamicProperty("vantage:cfg", JSON.stringify(s))
}

// ---------------- player state ----------------

var playerStuff = {}

function getStuff(id) {
    if (playerStuff[id] == undefined) {
        playerStuff[id] = { mode: "none", anim: null, fov: null, clearTicks: 0, usingItem: false, lastLens: -100 }
    }
    return playerStuff[id]
}

// ---------------- checks ----------------

function isCrawling(player) {
    if (player.isSwimming || player.isGliding) return false
    // your head is low but you arent swimming so you must be crawling
    return player.getHeadLocation().y < player.location.y + 1
}

function getMount(player) {
    var riding = player.getComponent("minecraft:riding")
    if (riding == undefined || riding.entityRidingOn == undefined) return undefined
    return riding.entityRidingOn.typeId
}

function getHeld(player) {
    var eq = player.getComponent("minecraft:equippable")
    var main = eq.getEquipment(EquipmentSlot.Mainhand)
    var off = eq.getEquipment(EquipmentSlot.Offhand)
    var held = { main: "", off: "" }
    if (main) held.main = main.typeId
    if (off) held.off = off.typeId
    return held
}

function onTouch(player) {
    return player.inputInfo.lastInputModeUsed == "Touch"
}

function isBlock(id) {
    if (id == "") return false
    if (BlockTypes.get(id) != undefined) return true
    return false
}

function needsVanilla(player, s, held) {
    if (player.isSleeping) return true

    var mount = getMount(player)
    if (mount != undefined) {
        if (mount == "minecraft:happy_ghast") return true
        if (s.vanillaRiding == true) return true
    }

    if (s.vanillaGliding && player.isGliding) return true
    if (s.vanillaCrawling && isCrawling(player)) return true

    if (held.main == "minecraft:map" || held.main == "minecraft:filled_map") return true
    if (held.off == "minecraft:map" || held.off == "minecraft:filled_map") return true
    if (s.vanillaSpyglass && (held.main == "minecraft:spyglass" || held.off == "minecraft:spyglass")) return true

    if (String(player.getGameMode()).toLowerCase() == "spectator") return true

    var health = player.getComponent("minecraft:health")
    if (health && health.currentValue <= 0) return true

    // on touch you tap where you want the block to go, but that only works with the normal camera.
    // so when you're holding a block we just give the normal camera back until you switch items
    if (s.touchBuild && onTouch(player) && isBlock(held.main)) return true

    return false
}

function armsBusy(held, stuff) {
    if (stuff.usingItem) return true
    if (armItems.indexOf(held.main) != -1) return true
    if (armItems.indexOf(held.off) != -1) return true
    if (held.main.endsWith("_spear")) return true
    return false
}

// ---------------- camera + animation stuff ----------------

function stopAnim(player, stuff) {
    if (stuff.anim != null) {
        // playing it again with 0 blend out makes it stop
        player.playAnimation(stuff.anim, { players: [player], blendOutTime: 0 })
        stuff.anim = null
        player.playAnimation(releaseAnim, { players: [player], blendOutTime: 0 })
    }
}

function resetFov(player, stuff) {
    if (stuff.fov != null) {
        stuff.fov = null
        player.camera.setFov()
    }
}

function doFov(player, stuff, s) {
    var want = null
    if (s.fovEnabled) want = s.fov
    if (stuff.fov == want) return
    stuff.fov = want
    if (want == null) player.camera.setFov()
    else player.camera.setFov({ fov: want })
}

function weHaveTheCamera(mode) {
    return mode == "body" || mode == "epic" || mode == "third"
}

// give the camera back to normal minecraft
function goVanilla(player, stuff, why) {
    if (stuff.mode != why) {
        stopAnim(player, stuff)
        resetFov(player, stuff)
        // only clear if the camera is actually ours (or we dont know yet like after /reload).
        // if something else has it (dragon addon etc) we leave it alone
        if (weHaveTheCamera(stuff.mode) || stuff.mode == "none") stuff.clearTicks = 0
        else stuff.clearTicks = 20
        stuff.mode = why
    }
    // clear it for a second, once doesnt always stick
    if (stuff.clearTicks < 20) {
        stuff.clearTicks++
        player.camera.clear()
    }
}

// step aside for another addon. clear once if the camera was ours, then dont touch it at all
function backOff(player, stuff, why, clearIt) {
    if (stuff.mode == why) return
    stopAnim(player, stuff)
    resetFov(player, stuff)
    if (clearIt && weHaveTheCamera(stuff.mode)) player.camera.clear()
    stuff.mode = why
    stuff.clearTicks = 0
}

function doPlayer(player) {
    var stuff = getStuff(player.id)
    var s = getSettings(player)
    var held = getHeld(player)
    if (held.main == "") stuff.usingItem = false

    // another addon asked us to stop (/scriptevent vantage:suppress true), its their camera now
    if (player.getDynamicProperty("vantage:suppressed") == true) {
        backOff(player, stuff, "suppressed", false)
        return
    }

    // riding something from another addon (dragons, cars, chairs...), let that addon do its camera
    var mount = getMount(player)
    if (s.addonMounts && mount != undefined && mount.indexOf("minecraft:") != 0) {
        backOff(player, stuff, "mount", true)
        return
    }

    if (s.enabled == false) {
        goVanilla(player, stuff, "off")
        return
    }
    if (needsVanilla(player, s, held)) {
        goVanilla(player, stuff, "vanilla")
        return
    }

    if (s.view == "third") {
        stopAnim(player, stuff)
        player.camera.setCamera("minecraft:third_person")
    } else {
        var anim = bodyAnims[s.distance]
        var back = maxBack[s.distance]
        if (s.view == "epic") {
            back = maxBack[1]
            if (armsBusy(held, stuff)) anim = epicNoArms
            else anim = epicArms
        }

        if (stuff.anim != null && stuff.anim != anim) {
            player.playAnimation(stuff.anim, { players: [player], blendOutTime: 0 })
            stuff.anim = null
        }
        player.playAnimation(anim, { players: [player], blendOutTime: HOLD })
        stuff.anim = anim

        var z = s.offsetZ
        if (z < -back) z = -back // dont let the camera go inside your body
        player.camera.setCamera(PRESET, { entityOffset: { x: s.offsetX, y: s.offsetY, z: z } })
    }

    stuff.mode = s.view
    stuff.clearTicks = 0
    doFov(player, stuff, s)
}

// ---------------- toggling / switching views ----------------

function viewName(s) {
    return viewNames[views.indexOf(s.view)]
}

function toggle(player) {
    var s = getSettings(player)
    s.enabled = !s.enabled
    saveSettings(player, s)
    doPlayer(player)
    if (s.enabled) player.onScreenDisplay.setActionBar("§aVantage ON §7(" + viewName(s) + ")")
    else player.onScreenDisplay.setActionBar("§7Vantage OFF")
}

// body -> epic fight -> third person -> normal minecraft -> body ...
function nextView(player) {
    var s = getSettings(player)
    if (s.enabled == false) {
        s.enabled = true
        s.view = "body"
    } else if (s.view == "body") {
        s.view = "epic"
    } else if (s.view == "epic") {
        s.view = "third"
    } else {
        s.enabled = false
    }
    saveSettings(player, s)
    doPlayer(player)
    if (s.enabled) player.onScreenDisplay.setActionBar("§9Vantage: §f" + viewName(s))
    else player.onScreenDisplay.setActionBar("§9Vantage: §fVanilla view")
}

function giveLens(player) {
    var inv = player.getComponent("minecraft:inventory").container
    for (var i = 0; i < inv.size; i++) {
        var item = inv.getItem(i)
        if (item && item.typeId == "vantage:lens") {
            player.sendMessage("§7[Vantage] You already have a Vantage Lens!")
            return
        }
    }
    var left = inv.addItem(new ItemStack("vantage:lens", 1))
    if (left) player.sendMessage("§c[Vantage] Your inventory is full!")
    else player.sendMessage("§7[Vantage] Here's your §9Vantage Lens§7! Use it to switch views, sneak + use it for the menu.")
}

function lensUsed(player) {
    var stuff = getStuff(player.id)
    if (system.currentTick - stuff.lastLens < 5) return // stops it going twice
    stuff.lastLens = system.currentTick
    if (player.isSneaking) openMenu(player)
    else nextView(player)
}

// ---------------- menus ----------------

// forms dont open if the chat is still open so just keep trying for a bit
function showForm(player, form, tries, callback) {
    form.show(player).then(function (res) {
        if (res.canceled && res.cancelationReason == "UserBusy" && tries < 10) {
            system.runTimeout(function () {
                showForm(player, form, tries + 1, callback)
            }, 10)
            return
        }
        callback(res)
    })
}

function openMenu(player) {
    var s = getSettings(player)
    var form = new ActionFormData()
    form.title("Vantage")
    form.body(
        "Vantage is " + (s.enabled ? "§aON§r" : "§cOFF§r") + "\n" +
        "View: §f" + viewName(s) + "§r\n" +
        "Body distance: §f" + distanceNames[s.distance] + "§r\n" +
        "§7Quick toggle: Sneak + Jump\n" +
        "Vantage Lens: use it to switch views§r\n" +
        "§8v" + VERSION + "§r"
    )
    form.button(s.enabled ? "Turn Off" : "Turn On")
    form.button("Switch View")
    form.button("Settings")
    form.button("Get a Vantage Lens")
    form.button("Reset to Defaults")

    showForm(player, form, 0, function (res) {
        if (res.canceled) return
        if (res.selection == 0) toggle(player)
        if (res.selection == 1) nextView(player)
        if (res.selection == 2) openSettings(player)
        if (res.selection == 3) giveLens(player)
        if (res.selection == 4) {
            saveSettings(player, defaultSettings())
            player.sendMessage("§7[Vantage] Settings reset.")
        }
    })
}

function openSettings(player) {
    var s = getSettings(player)
    var form = new ModalFormData()
    form.title("Vantage - Settings")
    form.toggle("Vantage on", { defaultValue: s.enabled })
    form.dropdown("View", viewNames, { defaultValueIndex: views.indexOf(s.view) })
    form.dropdown("Body distance", distanceNames, { defaultValueIndex: s.distance })
    form.slider("Camera left / right", -50, 50, { defaultValue: Math.round(s.offsetX * 100), valueStep: 1 })
    form.slider("Camera up / down", -50, 50, { defaultValue: Math.round(s.offsetY * 100), valueStep: 1 })
    form.slider("Camera forward / back", -50, 50, { defaultValue: Math.round(s.offsetZ * 100), valueStep: 1 })
    form.toggle("Override field of view", { defaultValue: s.fovEnabled })
    form.slider("Field of view", 30, 110, { defaultValue: s.fov, valueStep: 1 })
    form.toggle("Quick toggle (Sneak + Jump)", { defaultValue: s.quickToggle })
    form.toggle("Vanilla view while gliding", { defaultValue: s.vanillaGliding })
    form.toggle("Vanilla view while crawling", { defaultValue: s.vanillaCrawling })
    form.toggle("Vanilla view with spyglass", { defaultValue: s.vanillaSpyglass })
    form.toggle("Vanilla view while riding", { defaultValue: s.vanillaRiding })
    form.toggle("Let add-on mounts control the camera (dragons, vehicles...)", { defaultValue: s.addonMounts })
    form.toggle("Touch: vanilla view while holding blocks (tap to place)", { defaultValue: s.touchBuild })

    showForm(player, form, 0, function (res) {
        if (res.canceled || res.formValues == undefined) return
        var v = res.formValues
        // these have to be in the same order as the stuff above!!
        var n = defaultSettings()
        n.enabled = v[0] == true
        n.view = views[v[1]]
        n.distance = fixNumber(v[2], 0, 2, 1) | 0
        n.offsetX = fixNumber(v[3] / 100, -0.5, 0.5, 0)
        n.offsetY = fixNumber(v[4] / 100, -0.5, 0.5, 0)
        n.offsetZ = fixNumber(v[5] / 100, -0.5, 0.5, 0)
        n.fovEnabled = v[6] == true
        n.fov = fixNumber(v[7], 30, 110, 70)
        n.quickToggle = v[8] == true
        n.vanillaGliding = v[9] == true
        n.vanillaCrawling = v[10] == true
        n.vanillaSpyglass = v[11] == true
        n.vanillaRiding = v[12] == true
        n.addonMounts = v[13] == true
        n.touchBuild = v[14] == true
        if (n.view == undefined) n.view = "body"
        saveSettings(player, n)
        player.sendMessage("§7[Vantage] Settings saved.")
    })
}

// ---------------- commands ----------------

system.beforeEvents.startup.subscribe(function (ev) {
    var reg = ev.customCommandRegistry

    function addCommand(name, desc, action) {
        reg.registerCommand({
            name: name,
            description: desc,
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false
        }, function (origin) {
            var player = origin.sourceEntity
            if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure, message: "Players only." }
            system.run(function () {
                if (player.isValid) action(player)
            })
            return { status: CustomCommandStatus.Success }
        })
    }

    addCommand("vantage:vantage", "Open the Vantage menu.", openMenu)
    addCommand("vantage:toggle", "Toggle Vantage on or off.", toggle)
    addCommand("vantage:config", "Open Vantage settings.", openSettings)
    addCommand("vantage:view", "Switch to the next Vantage view.", nextView)
})

// ---------------- events ----------------

// sneak + jump toggles it
var lastQuickToggle = {}
world.afterEvents.playerButtonInput.subscribe(function (ev) {
    if (ev.button != InputButton.Jump || ev.newButtonState != ButtonState.Pressed) return
    var player = ev.player
    if (getSettings(player).quickToggle == false) return

    var sneaking = player.inputInfo.getButtonState(InputButton.Sneak) == ButtonState.Pressed
    if (!sneaking) sneaking = player.isSneaking
    if (!sneaking) return

    var now = system.currentTick
    if (lastQuickToggle[player.id] != undefined && now - lastQuickToggle[player.id] < 10) return
    lastQuickToggle[player.id] = now
    system.run(function () {
        if (player.isValid) toggle(player)
    })
})

// the lens. works when you use it in the air...
world.afterEvents.itemUse.subscribe(function (ev) {
    if (ev.itemStack.typeId != "vantage:lens") return
    lensUsed(ev.source)
})

// ...and when you use it on a block
world.beforeEvents.playerInteractWithBlock.subscribe(function (ev) {
    if (ev.itemStack == undefined || ev.itemStack.typeId != "vantage:lens") return
    ev.cancel = true
    if (!ev.isFirstEvent) return
    var player = ev.player
    system.run(function () {
        lensUsed(player)
    })
})

// epic fight mode puts your arms down while you use stuff like bows, food, shields
world.afterEvents.itemStartUse.subscribe(function (ev) {
    getStuff(ev.source.id).usingItem = true
})
world.afterEvents.itemStopUse.subscribe(function (ev) {
    getStuff(ev.source.id).usingItem = false
})
world.afterEvents.itemReleaseUse.subscribe(function (ev) {
    getStuff(ev.source.id).usingItem = false
})
world.afterEvents.itemCompleteUse.subscribe(function (ev) {
    getStuff(ev.source.id).usingItem = false
})
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(function (ev) {
    getStuff(ev.player.id).usingItem = false
})

// other first person addons can turn us off per player: /scriptevent vantage:suppress true
system.afterEvents.scriptEventReceive.subscribe(function (ev) {
    if (ev.id != "vantage:suppress") return
    var player = ev.sourceEntity
    if (player == undefined || player.typeId != "minecraft:player") return
    var on = String(ev.message).trim().toLowerCase() == "true"
    system.run(function () {
        player.setDynamicProperty("vantage:suppressed", on)
    })
})

world.afterEvents.playerLeave.subscribe(function (ev) {
    delete playerStuff[ev.playerId]
    delete settingsCache[ev.playerId]
    delete lastQuickToggle[ev.playerId]
})

world.afterEvents.playerSpawn.subscribe(function (ev) {
    if (!ev.initialSpawn) return
    var player = ev.player
    delete playerStuff[player.id]
    delete settingsCache[player.id]
    system.runTimeout(function () {
        if (!player.isValid || player.getDynamicProperty("vantage:seen")) return
        player.setDynamicProperty("vantage:seen", true)
        player.sendMessage(
            "§7[§9§lVantage§r§7 v" + VERSION + "]§r First-person body is §aon§r.\n" +
            "§7Toggle: §fSneak + Jump§7 or §f/vantage§7. Craft a §9Vantage Lens§7 (glass pane + copper ingot) to switch views."
        )
    }, 60)
})

// ---------------- main loop ----------------

system.runInterval(function () {
    var players = world.getAllPlayers()
    for (var i = 0; i < players.length; i++) {
        try {
            if (players[i].isValid) doPlayer(players[i])
        } catch (e) {
            // camera stuff can fail for a tick when you teleport or change dimension, it fixes itself next tick
        }
    }
}, 1)

console.warn("[Vantage v" + VERSION + "] loaded!")
