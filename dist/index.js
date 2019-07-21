"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
require("reflect-metadata");
const typedi_1 = require("typedi");
const DiscordService_1 = require("./services/DiscordService");
const DNSService_1 = require("./services/DNSService");
const InstanceService_1 = require("./services/InstanceService");
const MinecraftService_1 = require("./services/MinecraftService");
const main = () => __awaiter(this, void 0, void 0, function* () {
    const discordService = typedi_1.Container.get(DiscordService_1.DiscordService);
    const instanceService = typedi_1.Container.get(InstanceService_1.InstanceService);
    const dnsService = typedi_1.Container.get(DNSService_1.DNSService);
    const minecraftService = typedi_1.Container.get(MinecraftService_1.MinecraftService);
    minecraftService.registerServer({
        name: "vanilla",
        instanceId: "i-0797e181a1afacb5a",
        recordSet: "vanilla.mc",
    });
    // Login to the discord api
    yield discordService.login();
    discordService.registerCommand({
        args: [],
        description: "",
        showInHelp: false,
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            yield message.channel.send("Welcome to Minecraft Bot 2.0. Use `!mc help` to get started!");
        }),
    });
    // Help
    discordService.registerCommand({
        args: ["help"],
        description: "Lists the command page",
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            const embed = new discord_js_1.default.RichEmbed();
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
        }),
    });
    discordService.registerCommand({
        args: ["servers"],
        description: "Displays a list of all servers available to run",
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            yield message.channel.send("The current minecraft server options are\n" +
                minecraftService
                    .getServerNames()
                    .map((s) => "- **" + s.toLowerCase() + "**")
                    .join("\n"));
        }),
    });
    discordService.registerCommand({
        args: ["start"],
        showInHelp: false,
        description: "",
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            yield message.channel.send("A server selection must be made to run this command. Use `!mc servers` to retrieve the list.");
        }),
    });
    discordService.registerCommand({
        args: ["start", "*"],
        description: "Start a specific Minecraft server",
        handler: (message, args) => __awaiter(this, void 0, void 0, function* () {
            const name = args[1];
            if (!minecraftService.isValidServerName(name)) {
                yield message.channel.send("This is an invalid server, run `!mc servers` to list all of the available servers.");
                return;
            }
            try {
                const server = minecraftService.getServerFromName(name);
                const { instanceId, recordSet } = server;
                if (!(yield instanceService.isInstanceStopped(instanceId))) {
                    yield message.channel.send("Server is not in a state to be booted up, please check `!mc status`. If the server appears offline, wait 1 minute and try again");
                    return;
                }
                const m = (yield message.channel.send(`Server booting up. Use the hostname \`${recordSet +
                    ".tuttiapp.net"}\` in Minecraft. It should be updated in 10 seconds.`));
                yield instanceService.startInstance(instanceId);
                yield instanceService.waitForRunningInstance(instanceId, 20000);
                const ipAddress = yield instanceService.waitForPublicIp(instanceId, 10000);
                yield m.edit(`Instance booted, awaiting Minecraft server launch. \`${recordSet + ".tuttiapp.net"}\` or \`${ipAddress}\``);
                yield dnsService.updateRecordSet(recordSet, ipAddress);
                yield minecraftService.waitForActiveServer(ipAddress, 60000);
                yield m.edit(`Minecraft server online at \`${recordSet + ".tuttiapp.net"}\` or \`${ipAddress}\``);
            }
            catch (e) {
                yield message.channel.send("Fatal error occurred during bootup, <@179957985253130240>");
                yield message.channel.send(JSON.stringify(e, null, 2));
            }
        }),
    });
    discordService.registerCommand({
        args: ["stop"],
        showInHelp: false,
        description: "",
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            yield message.channel.send("A server selection must be made to run this command. Use `!mc servers` to retrieve the list.");
        }),
    });
    discordService.registerCommand({
        args: ["stop", "*"],
        description: "Stop a specific Minecraft server",
        handler: (message, args) => __awaiter(this, void 0, void 0, function* () {
            const name = args[1];
            if (!minecraftService.isValidServerName(name)) {
                yield message.channel.send("This is an invalid server, run `!mc servers` to list all of the available servers.");
                return;
            }
            try {
                const m = (yield message.channel.send("Attempting server shutdown."));
                const { instanceId } = minecraftService.getServerFromName(name);
                if (!(yield instanceService.isInstanceRunning(instanceId))) {
                    yield m.edit("Server is not running, so it can not be stopped");
                    return;
                }
                const ipAddress = yield instanceService.getPublicIPAddress(instanceId);
                const players = yield minecraftService.getOnlinePlayers(ipAddress);
                if (players > 0) {
                    yield m.edit(`There ${players === 1 ? "is" : "are"} still ${players} ${players === 1 ? "player" : "players"} on the server, you can not stop it unless they disconnect.`);
                    return;
                }
                m.edit(`Minecraft server ${args[1]} shutting down`);
                const launchTime = yield instanceService.getLaunchTime(instanceId);
                const currentTime = new Date();
                const duration = (currentTime.getTime() - launchTime.getTime()) / 1000;
                const cost = yield instanceService.getSessionPrice(instanceId, duration);
                yield instanceService.stopInstance(instanceId);
                yield m.edit(`Minecraft server ${args[1]} has been shut down. This current session cost $${cost.toFixed(2)}.`);
            }
            catch (e) {
                console.log(e);
                yield message.channel.send("Fatal error occurred during shut down, <@179957985253130240>");
            }
        }),
    });
    discordService.registerCommand({
        args: ["status"],
        showInHelp: false,
        description: "",
        handler: (message) => __awaiter(this, void 0, void 0, function* () {
            const embed = new discord_js_1.default.RichEmbed();
            embed.setTitle("Minecraft Bot");
            embed.setDescription("Server Statuses");
            embed.setColor(0x4a6f28);
            for (const server of minecraftService.getServers()) {
                const status = yield minecraftService.getStatus(server);
                const launchTime = yield instanceService.getLaunchTime(server.instanceId);
                const currentTime = new Date();
                const duration = (currentTime.getTime() - launchTime.getTime()) / 1000;
                const cost = yield instanceService.getSessionPrice(server.instanceId, duration);
                let statusText = "";
                if (status.isOnline) {
                    statusText += "Server is online\n";
                    statusText += "IP Address (only use as backup): " + status.ipAddress + "\n";
                    statusText += "Hostname: " + status.hostname + "\n";
                    statusText += "Players online: " + status.players + "\n";
                    statusText += "Session cost: $" + cost.toFixed(2);
                }
                else {
                    statusText += "Server is currently offline";
                }
                embed.addField(server.name, statusText);
            }
            yield message.channel.send({ embed });
        }),
    });
});
main();
//# sourceMappingURL=index.js.map