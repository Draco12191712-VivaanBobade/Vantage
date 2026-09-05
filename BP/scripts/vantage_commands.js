/**
* Vantage - Custom Commands
* ------------------------------------------------------------------
* The stable Custom Commands API requires namespaced names and has no
* alias-registration call; it instead exposes a non-namespaced
* convenience form automatically. Registering the menu as
* `vantage:vantage` is what makes that convenience form come out to
* exactly `/vantage`.
*
* `CommandPermissionLevel.Any` + `cheatsRequired: false` is deliberate:
* this is a personal view preference, so survival players without
* operator rights must be able to use it.
*
* Registration is wrapped by the caller in try/catch - on a runtime
* that predates custom commands, the sneak+jump toggle still works.
*/

import { system, CommandPermissionLevel, CustomCommandStatus, Player } from "@minecraft/server";
import { showMainMenu, showSettingsMenu } from "./vantage_forms.js";
import { toggleVantage } from "./vantage_input.js";

export function registerCommands() {
  const startup = system.beforeEvents?.startup;
  if (!startup?.subscribe) return false;

  startup.subscribe((init) => {
    const registry = init.customCommandRegistry;
    if (!registry?.registerCommand) return;

    const meta = (name, description) => ({
      name,
      description,
      permissionLevel: CommandPermissionLevel.Any,
      cheatsRequired: false,
    });

    registry.registerCommand(
      meta("vantage:vantage", "Opens the Vantage first-person body menu."),
      (origin) => run(origin, (player) => showMainMenu(player))
    );

    registry.registerCommand(
      meta("vantage:toggle", "Toggles the Vantage first-person body on or off."),
      (origin) => run(origin, (player) => toggleVantage(player))
    );

    registry.registerCommand(
      meta("vantage:config", "Opens the Vantage camera & body settings."),
      (origin) => run(origin, (player) => showSettingsMenu(player))
    );
  });

  return true;
}

/**
 * Command callbacks execute in a read-only context, so the actual work
 * is deferred to `system.run`.
 */
function run(origin, action) {
  const player = origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined;
  if (!player) {
    return { status: CustomCommandStatus.Failure, message: "This command can only be used by a player." };
  }
  system.run(() => {
    try {
      if (player.isValid) action(player);
    } catch (_err) {
      /* non-fatal */
    }
  });
  return { status: CustomCommandStatus.Success };
}
