import { Service } from "typedi";
import { ICommand, PREFIX } from "./DiscordService";

@Service()
export class ArgumentService {
    public getArgsFromContent(message: string) {
        return message
            .slice(PREFIX.length)
            .trim()
            .split(/ +/g);
    }

    public findHandlerFromArgs(commands: ICommand[], args: string[]) {
        for (const command of commands) {
            if (!Array.isArray(command.args) && args.length === 1) {
                if (args[0] === command.args) {
                    return command.handler;
                }
            } else if (Array.isArray(command.args)) {
                if (this.argumentEquality(args, command.args)) {
                    return command.handler;
                }
            }
        }

        throw new Error("Command not found");
    }

    private argumentEquality(args: string[], commandArgs: string[]) {
        if (commandArgs.length !== args.length) {
            return false;
        }
        for (const [index, arg] of args.entries()) {
            if (commandArgs[index] !== "*" && arg !== commandArgs[index]) {
                return false;
            }
        }
        return true;
    }
}
