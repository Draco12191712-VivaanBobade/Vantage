# Vantage

Vantage is a first person addon for Minecraft Bedrock! When you look down you can actually see your body (legs, arms, armor, your skin, all of it) and everything else in the game stays the same :D

## How to use it

- **Sneak + Jump** turns it on and off
- **/vantage** opens the menu with all the settings
- **Vantage Lens**: craft it with a glass pane + a copper ingot, or just grab one from the menu. Use it to switch views, and sneak + use it to open the menu
- You can pick which views the Lens switches between in the settings. Like if you only want Full Body and Third Person, just turn the other ones off and the Lens only goes between those two :D

## Views

- **Full Body**: your whole body in first person, and you only ever see the front of it
- **Epic Fight**: just like the Epic Fight mod, you only see your two arms and whatever you're holding, no body or legs in the way. Works with any item, even ones from other add-ons
- **Third Person**: normal third person
- **Vanilla**: just regular Minecraft

## Other stuff

- There's a crosshair now! Vantage's camera counts as third person to Minecraft so the normal crosshair goes away, so Vantage puts its own back. You can pick Vanilla, Dot, Small plus or Circle, or turn it off in the settings. It works with Immersive Combat's HUD too
- When you swim, the view goes back to normal Minecraft and comes back when you get out of the water. You can make it only do that while swimming, or turn it off
- When you fly in creative or glide with an elytra, it switches to normal third person so you can actually see where you're going, and comes back when you land. You can change it to vanilla first person or just keep Vantage in the settings
- Works on touch, controller and keyboard. On mobile, if you're holding a block it switches to the normal camera so you can tap where you want to place it
- Goes back to the normal view for maps, spyglasses, crawling, swimming and sleeping
- You can change the body distance, camera position and FOV in the settings
- Works in multiplayer and survival, no cheats needed, and other players see you normally
- No experimental toggles needed, works on 1.26.0 and up

## Settings

There's A LOT of settings now :p

- **/vantage** has your own settings (view, crosshair, camera position, FOV, water, and all the vanilla view stuff)
- **World settings**: go to the world's Behavior Packs, click Vantage and hit the gear. The world owner can pick the starting view and crosshair for new players, lock Vantage so players can't turn it off, turn off the settings menu, give everyone a Lens when they join, and turn the compatibility stuff on or off
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

## Credits

Made by **Draco12191712**. The idea came from **sick_0_0** on Discord, you can contact him [here](https://discord.com/users/1353824744578879491).

Minecraft is made by Mojang Studios and Microsoft. Vantage isn't affiliated with or endorsed by neither of them.

## License

Vantage is under the **Mozilla Public License v2.0**. You can use it, change it and share it, just follow the license and keep the credits Thanks :D
