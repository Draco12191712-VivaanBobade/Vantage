# Vantage

Vantage is a first person addon for Minecraft Bedrock! When you look down you can actually see your body (legs, arms, armor, your skin, all of it) and everything else in the game stays the same :D

**Current version: v2.3.0** · works on Minecraft Bedrock 1.26.0 and up

## How to use it

- **Sneak + Jump** turns it on and off
- **/vantage** opens the menu with all the settings
- **Vantage Lens**: craft it with a glass pane + a copper ingot, or just grab one from the menu. Use it to switch views, and sneak + use it to open the menu
- You can pick which views the Lens switches between in the settings. Like if you only want Full Body and Third Person, just turn the other ones off and the Lens only goes between those two :D

## Views

- **Full Body**: your whole body in first person, and you only ever see the front of it
- **Epic Fight**: just like the Epic Fight mod, you only see your two arms and whatever you're holding, no body or legs in the way. Works with any item, even ones from other add-ons
- **Third Person**: a dynamic third person! The camera sits over your shoulder and the FOV gets wider when you go fast. You can pick the shoulder and the distance, or switch it back to normal vanilla third person in the settings
- **Vanilla**: just regular Minecraft

## Other stuff

- There's a crosshair now! Vantage's camera counts as third person to Minecraft so the normal crosshair goes away, so Vantage puts its own back. You can pick Vanilla, Dot, Small plus or Circle, or turn it off in the settings. It works with Immersive Combat's HUD too
- Going between first person and third person doesn't just snap anymore, the camera smoothly glides out of your head and back in :D You can turn that off or make it faster/slower in the settings
- When you swim, the view goes back to normal Minecraft and comes back when you get out of the water. You can make it only do that while swimming, or turn it off
- When you fly in creative or glide with an elytra, it switches to third person so you can actually see where you're going, and comes back when you land. You can change it to vanilla first person or just keep Vantage in the settings
- Goes back to the normal view for maps, spyglasses, crawling and sleeping too
- Works on touch, controller and keyboard. On mobile, if you're holding a block it switches to the normal camera so you can tap where you want to place it
- You can change the body distance, camera position and FOV in the settings
- Works in multiplayer and survival, no cheats needed, and other players see you normally
- No experimental toggles needed, works on 1.26.0 and up

## Settings

There's A LOT of settings now :p

- **/vantage** has your own settings: view, body distance, camera position, FOV, crosshair, water, flying and gliding, all the vanilla view stuff, which views the Lens goes to, and the Third Person stuff (Dynamic or Vanilla, shoulder, distance, the speed FOV and the smooth camera)
- **World settings**: go to the world's Behavior Packs, click Vantage and hit the gear. The world owner can pick the starting view, crosshair, Lens views and Third Person stuff for new players, lock Vantage so players can't turn it off, turn off the settings menu, give everyone a Lens when they join, make the smooth camera faster or slower, and turn the compatibility stuff on or off
- **Look settings**: go to Resource Packs, click Vantage and hit the gear. These are just for you and only change what you see, like how high and how far your arms are in Epic Fight, the arm angle, showing your legs in Epic Fight, body distance and height in Full Body, and showing your cape

## Compatibility

- **Immersive Combat**: the combat animations show up on your arms in first person. If you turn on "Epic Fight view in combat mode", Vantage switches to your two arms whenever combat mode is on. If you'd rather use Immersive Combat's own combat camera, turn on "let combat mode use its own camera". Immersive Combat's "Dynamic First Person" camera type also works with Vantage
- **Age of Dragons**: when you ride a dragon Vantage gets out of the way so the dragon camera works, and comes back when you get off
- **Immersive Aircraft**: same thing, Vantage steps aside while you fly so the plane camera, the scope and the flight FOV all work, and comes back when you land
- **Other camera add-ons**: Vantage steps aside for any add-on mob or vehicle you ride, and when another add-on locks your camera (like cutscenes). If you don't want that you can turn it off in the settings

## Capailities

- While Vantage is on, F5 doesn't work because the camera is locked (that's a Minecraft thing). Use the Lens or turn Vantage off instead
- It doesn't replace the player model, so skin packs, texture packs and shaders should all be fine. The only UI it adds is the crosshair
- Age of Dragons resets everyone's camera every single tick when they're not on a dragon. Vantage puts its camera back every tick so it should still work, but if your screen flickers with Age of Dragons on, that's why
- Immersive Combat combat mode is detected with the weakness Immersive Combat gives you outside of combat, so if a world turns that weakness off, the Immersive Combat combat settings in Vantage won't kick in

## For add-on makers

If your add-on does its own camera stuff you can tell Vantage to back off for a player:

- `/scriptevent vantage:suppress true` turns Vantage off for that player until you send `false`
- `/scriptevent vantage:pause 100` pauses Vantage for 100 ticks (`/scriptevent vantage:resume` to come back early)
- `/tag @s add vantage:pause` pauses it until you remove the tag. Add the tag first and set your camera a tick later so Vantage doesn't clear it
- Vantage also listens to the `ae_fpm.disable_animation` and `ae_fpm.is_first_person` tags that other first person add-ons use

Minecraft has A LOT of add-ons so I can't promise it'll never break with something, but it tries its best! :p If it does, open an issue or a PR and I'll get it fixed.

## Changelog

### v2.3.0
- **Dynamic Third Person!** The Third Person view isn't plain vanilla anymore. The camera sits over your shoulder and the FOV gets wider when you go fast. Pick the shoulder (Right, Center or Left) and the distance (Close, Normal or Far), or switch it back to vanilla third person
- **Smooth camera:** going between first person and third person doesn't just snap anymore, the camera glides out of your head and back in :D You can turn it off, and world owners can make it faster or slower
- Flying and gliding use the new Dynamic Third Person too

### v2.2.0
- **Pick which views the Lens switches between.** The Switch View button and `/vantage:view` follow it too
- **Third person when flying:** flying in creative or gliding with an elytra switches to third person, and comes back when you land. You can change it to vanilla first person or just keep Vantage
- "Vanilla view while gliding" is now part of the new gliding setting. If you had it off, it stays on Vantage for you

### v2.1.0
- **Epic Fight is now just your two arms**, like the actual Epic Fight mod! No body or legs in the way, and the arms follow where you look. Bows, crossbows, tridents, shields, eating and all that still use the normal arm poses
- **Crosshair!** Pick Vanilla, Dot, Small plus or Circle, or turn it off. Fixes the crosshair disappearing in Full Body and Epic Fight, and it works with Immersive Combat's HUD too
- **Swimming goes back to vanilla view**, and comes back when you get out of the water
- **A LOT of settings now :p** World settings (gear on the behavior pack) and look settings (gear on the resource pack)
- **Compat** with Immersive Combat, Age of Dragons, Immersive Aircraft, cutscenes, add-on mounts and other first person add-ons
- New `/scriptevent vantage:pause <ticks>`, `/scriptevent vantage:resume` and the `vantage:pause` tag for add-on makers
- The welcome message tells you if Vantage is on or off
- Now needs Minecraft Bedrock 1.26.0 or newer (it was 1.21.110)

## Credits

Made by **Draco12191712**. The idea came from **sick_0_0** on Discord, you can contact him [here](https://discord.com/users/1353824744578879491).

Minecraft is made by Mojang Studios and Microsoft. Vantage isn't affiliated with or endorsed by neither of them.

## License

Vantage is under the **Mozilla Public License v2.0**. You can use it, change it and share it, just follow the license and keep the credits Thanks :D
