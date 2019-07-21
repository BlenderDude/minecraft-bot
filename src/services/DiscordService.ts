import Discord from "discord.js";
import { Inject, Service } from "typedi";
import { ArgumentService } from "./ArgumentService";

export interface ICommand {
    args: string[];
    description: string;
    showInHelp?: boolean;
    handler: (message: Discord.Message, args: string[], client: Discord.Client) => Promise<any>;
}

export const PREFIX = "!mc";

@Service()
export class DiscordService {
    private client = new Discord.Client();
    private commands: ICommand[] = [];

    @Inject()
    private argumentService!: ArgumentService;

    constructor() {
        this.client.on("ready", () => this.onReady());
        this.client.on("message", (message) => this.onMessage(message));
    }

    public registerCommand(command: ICommand) {
        this.commands.push(command);
    }

    public login() {
        return this.client.login(process.env.DISCORD_TOKEN);
    }

    public getCommands() {
        return this.commands;
    }

    private async onReady() {
        console.log("Minecraft bot ready and listening for commands!");
        await this.client.user.setActivity("your every move", {
            type: "WATCHING",
            url: "https://asqdigital.com",
        });
    }

    private async onMessage(message: Discord.Message) {
        if (message.author.bot) {
            return;
        }
        if (message.content.indexOf(PREFIX) !== 0) {
            return;
        }
        try {
            const args = this.argumentService.getArgsFromContent(message.content);
            const handler = this.argumentService.findHandlerFromArgs(this.commands, args);
            await handler(message, args, this.client);
        } catch {
            message.channel.send("Command not found use `!mc help` to list commands");
        }
    }
}
