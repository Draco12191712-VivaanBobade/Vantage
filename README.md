# Vantage

A modern camera, player-visuals, and movement framework for Minecraft Bedrock Edition.

Vantage is a Minecraft Bedrock Edition addon focused on improving the way Minecraft looks and feels from the player's perspective.

It provides a modular system for advanced camera behavior, smooth camra transitions, player state detection, player poses, visibility control, interpolation, performance management, and compatibility handling.

## Camera System

### First-Person Camera

Vantage provides an enhanced first-person camera system designed to make movement and camera behavior feel smoother and more natural. It includes smooth camera movement, configurable camera behavior, player-staet awareness, interpolation support, and transition support!

### Third-Person Camera

A configurable third-person camera system designed for exploration, building, combat, and general gameplay. It has smooth third person movement, camera transitions (again), and basically everything i just listed!

## Player Systems

### Player State

Vantage continuously tracks important player states and movement conditions.

Supported states include:

- Idle
- Walking
- Sprinting
- Sneaking
- Swimming
- Crawling
- Falling
- Jumping
- Climbing
- Gliding
- Riding
- Flying
- Dead

This allows other Vantage systems to react intelligently to what the player is currently doing.

### Player Poses

The pose system provides a foundation for player specific visual behavior and movement presentation.

### Player Visibility

Vantage provides fine-grained control over player body-part visibility.

Supported parts include:

- Head
- Body
- Left arm
- Right arm
- Left leg
- Right leg
- Cape
- Armor
- Held item

Visibility can be controlled globally, by individual body art, by groups, or depending on the current camera perspectiv

## Config

Vantage uses a modular configuration system.

Configuration functionality is separated into:

- Default settings
- Runtime configuration
- Persistent storage
- Player-specific settings

This keeps configuration logic separate from gameplay and camera systems.

## Compatibility

Vantage includes dedicated compatibility systems for working alongside other Bedrock content.

Compatibility handling includes:

- Resource-pack compatibility
- Animation compatibility
- Multiplayer considerations
- Defensive API handling

The goal is to make Vantage work alongside other addons instead of requiring users to completely rebuild their existing setup.

## Performance

Performance is a major part of Vantage's architecture.

The addon includes reusable performance utilities for:

- Tick throttling
- Cooldowns
- Time-based caching
- Tick-based caching
- Change detection
- Vector change detection
- Task queues
- Delta-time normalization

Vantage is designed to avoid performing unnecessary work every tick.

## Math & Interpolation

Vantage includes a reusable mathematical foundation for camera and player systems.

Utilities include:

- Linear interpolation
- Angle interpolation
- Smoothstep
- Smootherstep
- Vector operations
- Distance calculations
- Vector normalization
- Dot products
- Cross products
- Angle normalization
- Clamping
- Remapping
- Exponential smoothing
- Speed-based interpolation

## Features

This add-on contains an advanced camera framework featuring a first- and third-person camera system, smooth transitions, player state and pose detection, and visibility control. It includes modular JavaScript architecture with tick and runtime caching, interpolation utilities, persistent config support, and multiplayer compatibility.


## Vanilla Friendly

Vantage is designed to complement Minecraft rather than completely replace its visual identity.

The goal is to make camera and player behavior feel more polished while retaining the familiar Minecraft gameplay experience.

## Credits

Vantage is an original Minecraft Bedrock Edition addon.

This add-on was suggested by sick_0_0 on Discord, you can contact him [here](https://discord.com/users/1353824744578879491)

The project uses Minecraft Bedrock's official scripting and addon systems to implement its functionality.

Minecraft is developed by Mojang Studios and Microsoft.

Vantage is not affiliated with or endorsed by Mojang Studios or Microsoft.

## License

Mozilla Public License v3 (MPL-v2)
