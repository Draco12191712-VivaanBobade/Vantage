import { system, CommandPermissionLevel, CustomCommandStatus, Player } from "@minecraft/server";
import { showMainMenu, showSettingsMenu } from "./vantage_forms.js";
import { setEnabledFor, isEnabledFor } from "./vantage_config.js";
export function registerCommands() {
  system.beforeEvents.startup.subscribe((init) => {
    const registry = init.customCommandRegistry;
    registry.registerCommand(
      {
        name: "vantage:vantage",
        description: "Opens the Vantage first-person body configuration menu.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = originAsPlayer(origin);
        if (!player) return failure("This command can only be used by a player.");
        system.run(() => showMainMenu(player));
        return { status: CustomCommandStatus.Success };
      }
    );
    registry.registerCommand(
      {
        name: "vantage:toggle",
        description: "Toggles the Vantage dynamic first-person body on or off.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = originAsPlayer(origin);
        if (!player) return failure("This command can only be used by a player.");
        system.run(() => {
          const next = !isEnabledFor(player);
          setEnabledFor(player, next);
          player.sendMessage(`§7[Vantage] §rDynamic first-person body ${next ? "§aenabled" : "§cdisabled"}§r.`);
        });
        return { status: CustomCommandStatus.Success };
      }
    );
    registry.registerCommand(
      {
        name: "vantage:config",
        description: "Opens the Vantage camera & body settings form.",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const player = originAsPlayer(origin);
        if (!player) return failure("This command can only be used by a player.");
        system.run(() => showSettingsMenu(player));
        return { status: CustomCommandStatus.Success };
      }
    );
  });
}
/**
 * @param {import("@minecraft/server").CustomCommandOrigin} origin
 * @returns {import("@minecraft/server").Player|undefined}
 */
function originAsPlayer(origin) {
  return origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
}
function failure(message) {
  return { status: CustomCommandStatus.Failure, message };
}
