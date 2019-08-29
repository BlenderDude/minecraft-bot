import Discord from "discord.js";
import "reflect-metadata";
import { Container } from "typedi";
import { DiscordService } from "./services/DiscordService";
import { DNSService } from "./services/DNSService";
import { InstanceService } from "./services/InstanceService";
import { MinecraftService } from "./services/MinecraftService";

export const BASE_HOSTNAME = process.env.BASE_HOSTNAME!;

const main = async () => {
    const discordService = Container.get(DiscordService);
    const instanceService = Container.get(InstanceService);
    const dnsService = Container.get(DNSService);
    const minecraftService = Container.get(MinecraftService);

    minecraftService.registerServer({
        name: "vanilla",
        instanceId: process.env.VANILLA_INSTANCE_ID!,
        recordSet: process.env.VANILLA_RECORD_SET!,
    });

    // Login to the Discord api
    await discordService.login();

    // Register the base command
    discordService.registerCommand({
        args: [],
        description: "",
        showInHelp: false,
        handler: async (message) => {
            await message.channel.send("Welcome to Minecraft Bot 2.0. Use `!mc help` to get started!");
        },
    });

    // Help command
    discordService.registerCommand({
        args: ["help"],
        description: "Lists the command page",
        handler: async (message) => {
            const embed = new Discord.RichEmbed();
            embed.setTitle("Minecraft Bot Help");
            embed.setColor(0x4a6f28);
            embed.setDescription("**Commands**");

            for (const command of discordService.getCommands()) {
                if (command.showInHelp !== undefined && !command.showInHelp) {
                    continue;
                }
                embed.addField("!mc " + command.args.join(" "), command.description);
            }

            message.channel.send({ embed });
        },
    });

    // Server list command
    discordService.registerCommand({
        args: ["servers"],
        description: "Displays a list of all servers available to run",
        handler: async (message) => {
            await message.channel.send(
                "The current minecraft server options are\n" +
                    minecraftService
                        .getServerNames()
                        .map((s) => "- **" + s.toLowerCase() + "**")
                        .join("\n"),
            );
        },
    });

    // Start command helper
    discordService.registerCommand({
        args: ["start"],
        showInHelp: false,
        description: "",
        handler: async (message) => {
            await message.channel.send("A server selection must be made to run this command. Use `!mc servers` to retrieve the list.");
        },
    });

    // Start command
    discordService.registerCommand({
        args: ["start", "*"],
        description: "Start a specific Minecraft server",
        handler: async (message, args) => {
            const name = args[1];
            if (!minecraftService.isValidServerName(name)) {
                await message.channel.send("This is an invalid server, run `!mc servers` to list all of the available servers.");
                return;
            }

            try {
                const server = minecraftService.getServerFromName(name);
                const { instanceId, recordSet } = server;

                if (!(await instanceService.isInstanceStopped(instanceId))) {
                    await message.channel.send(
                        "Server is not in a state to be booted up, please check `!mc status`. If the server appears offline, wait 1 minute and try again",
                    );
                    return;
                }

                const m = (await message.channel.send(
                    `Server booting up. Use the hostname \`${recordSet +
                        BASE_HOSTNAME}\` in Minecraft. It should be updated in 10 seconds.`,
                )) as Discord.Message;

                await instanceService.startInstance(instanceId);
                await instanceService.waitForRunningInstance(instanceId, 20000);
                const ipAddress = await instanceService.waitForPublicIp(instanceId, 10000);
                await m.edit(`Instance booted, awaiting Minecraft server launch. \`${recordSet + BASE_HOSTNAME}\` or \`${ipAddress}\``);
                await dnsService.updateRecordSet(recordSet, ipAddress);
                await minecraftService.waitForActiveServer(ipAddress, 60000);
                await m.edit(`Minecraft server online at \`${recordSet + BASE_HOSTNAME}\` or \`${ipAddress}\``);
            } catch (e) {
                await message.channel.send("Fatal error occurred during bootup, <@179957985253130240>");
                await message.channel.send(JSON.stringify(e, null, 2));
            }
        },
    });

    // Stop command helper
    discordService.registerCommand({
        args: ["stop"],
        showInHelp: false,
        description: "",
        handler: async (message) => {
            await message.channel.send("A server selection must be made to run this command. Use `!mc servers` to retrieve the list.");
        },
    });

    // Stop command (if not stopped automatically)
    discordService.registerCommand({
        args: ["stop", "*"],
        description: "Stop a specific Minecraft server",
        handler: async (message, args) => {
            const name = args[1];
            if (!minecraftService.isValidServerName(name)) {
                await message.channel.send("This is an invalid server, run `!mc servers` to list all of the available servers.");
                return;
            }

            try {
                const m = (await message.channel.send("Attempting server shutdown.")) as Discord.Message;
                const { instanceId } = minecraftService.getServerFromName(name);
                if (!(await instanceService.isInstanceRunning(instanceId))) {
                    await m.edit("Server is not running, so it can not be stopped");
                    return;
                }
                const ipAddress = await instanceService.getPublicIPAddress(instanceId);
                const players = await minecraftService.getOnlinePlayers(ipAddress);
                if (players > 0) {
                    await m.edit(
                        `There ${players === 1 ? "is" : "are"} still ${players} ${
                            players === 1 ? "player" : "players"
                        } on the server, you can not stop it unless they disconnect.`,
                    );
                    return;
                }
                m.edit(`Minecraft server ${args[1]} shutting down`);
                const launchTime = await instanceService.getLaunchTime(instanceId);
                const currentTime = new Date();
                const duration = (currentTime.getTime() - launchTime.getTime()) / 1000;
                const cost = await instanceService.getSessionPrice(instanceId, duration);
                await instanceService.stopInstance(instanceId);
                await m.edit(`Minecraft server ${args[1]} has been shut down. This current session cost $${cost.toFixed(5)}.`);
            } catch (e) {
                console.log(e);
                await message.channel.send("Fatal error occurred during shut down, <@179957985253130240>");
            }
        },
    });

    // Status command
    discordService.registerCommand({
        args: ["status"],
        showInHelp: false,
        description: "",
        handler: async (message) => {
            const embed = new Discord.RichEmbed();
            embed.setTitle("Minecraft Bot");
            embed.setDescription("Server Statuses");
            embed.setColor(0x4a6f28);

            for (const server of minecraftService.getServers()) {
                const status = await minecraftService.getStatus(server);
                const launchTime = await instanceService.getLaunchTime(server.instanceId);
                const currentTime = new Date();
                const duration = (currentTime.getTime() - launchTime.getTime()) / 1000;
                const cost = await instanceService.getSessionPrice(server.instanceId, duration);
                let statusText = "";
                if (status.isOnline) {
                    statusText += "Server is online\n";
                    statusText += "IP Address (only use as backup): " + status.ipAddress + "\n";
                    statusText += "Hostname: " + status.hostname + "\n";
                    statusText += "Players online: " + status.players + "\n";
                    statusText += "Session cost: $" + cost.toFixed(5);
                } else {
                    statusText += "Server is currently offline";
                }
                embed.addField(server.name, statusText);
            }

            await message.channel.send({ embed });
        },
    });
};

// Run
main();
