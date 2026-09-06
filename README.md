# Vantage
Vantage is a dynamic first-person add-on for Minecraft: Bedrock Edition! It's made to make first-person feel more natural without changing the way Minecraft feels. You see your own body when you look down — legs, torso, arms, armor, your skin, your cape — and everything else about the game stays exactly where you left it.

Toggle it with **Sneak + Jump**, the `/vantage` menu, or by holding the **Vantage Settings** item.

## Features
* Full body visible in first person (legs, torso, arms, armor, capes, held items).
* Fully compatible with other addons whenever possible.
* Compatible with texture packs without causing visual issues.
* Works correctly with both touch controls and mouse & keyboard/controller.
* Hit detection stays aligned with your crosshair — interactions still come from your real eye position, so there's no offset you'd actually notice.
* Smooth animations without affecting gameplay — vanilla still drives the skeleton, Vantage just moves the camera.
* Multiplayer-friendly and survival-friendly — no operator permissions, no cheats, and other players see you completely normally.
* Lightweight and optimized for performance.
* Compatible with the latest Bedrock version (built for 1.21.100 and up, including 1.26).
* Configurable body visibility, with three body distances (Close / Normal / Far).
* Adjustable camera position on all three axes.
* FOV compatibility, with an optional FOV override.
* Crawling, swimming, sneaking, and riding all handled — sneaking and swimming are compensated automatically, and riding keeps your body visible.
* Automatically steps aside for anything that needs the real first-person view: maps, spyglasses, gliding, crawling, and sleeping.
* Support for custom player animations without conflicts.
* Three ways in: **Sneak + Jump** to toggle, `/vantage` for the menu, or hold the **Vantage Settings** item.

## Vanilla Friendly
Vantage is designed to complement Minecraft rather than replace its visual identity. It avoids unnecessary custom assets and focuses on improving the way first person feels while keeping the rest of Minecraft normal.

It never replaces the player model, ships no replacement textures or UI, and adds no custom geometry — the body you see is your actual player model, animated by the game exactly as it always was.

One thing worth knowing up front: while Vantage is switched **on**, it holds the camera, so the perspective key (F5) is inactive. Switch Vantage off and vanilla camera control comes straight back, third-person included.

## Compatibility
Vantage is designed to work alongside existing add-ons, scripts, and resource packs whenever possible. Its compatibility systems use defensive handling and modular architecture to reduce conflicts and make it easier to use Vantage alongside an existing setup.

The big one: Vantage never ships its own copy of the player entity definition. That file is shared across your whole pack stack, so any add-on that overrides it silently knocks out every other one that does. Vantage drives everything from the script API instead, which is what lets it sit happily alongside skin packs, texture packs, shader packs like Vibrant Visuals, Actions & Stuff, and custom player animation packs.

If another first-person add-on wants to take over, it can stand Vantage down per player with `/scriptevent vantage:suppress true`.

Of course, Minecraft has A LOT of different add-ons and packs out there, so I can't promise it'll never conflict with anything. But Vantage tries its best! :p
if it does, you can open an issue or PR in order to get that bug fixed!

## Performance
Performance is a major part of Vantage's design. The add-on is built to avoid unnecessary processing.

It runs a single loop that makes two lightweight engine calls per player per tick — hold the animation, position the camera. Your settings are cached in memory rather than read from storage every tick. It spawns no entities, creates no scoreboards, and runs no commands during normal play.

## Screenshots
Showcase coming soon! ;D

## Credits
Vantage is an original Minecraft Bedrock Edition add-on created and maintained by **Draco12191712**.
This add-on was suggested by **sick_0_0** on Discord; you can contact him [here](https://discord.com/users/1353824744578879491).
Minecraft is developed by Mojang Studios and Microsoft.
Vantage is not affiliated with or endorsed by Mojang Studios or Microsoft.

## License
This add-on is licensed under the **Mozilla Public License v2.0**. You are free to use, modify, and redistribute Vantage as long as you comply with the terms of the license. Please keep the original credits intact. Thanks :D

**Created and maintained by Draco12191712**
