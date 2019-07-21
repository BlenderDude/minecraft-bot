import Gamedig from "gamedig";
import { Inject, Service } from "typedi";
import { InstanceService } from "./InstanceService";

export interface IMinecraftServer {
    name: string;
    instanceId: string;
    recordSet: string;
}

interface IMinecraftStatus {
    isOnline: boolean;
    ipAddress?: string;
    hostname?: string;
    players?: number;
}

interface IServer extends IMinecraftServer {
    noPlayersFor: number;
}

const PING_INTERVAL = 10;
const QUIT_THRESHOLD = 300;

@Service()
export class MinecraftService {
    @Inject()
    private instanceService!: InstanceService;

    private servers: IServer[] = [];

    public registerServer(server: IMinecraftServer) {
        const completeServer = { ...server, noPlayersFor: 0 };
        this.servers.push(completeServer);
        setInterval(() => {
            this.serverPing(completeServer);
        }, PING_INTERVAL * 1000);
    }

    public async waitForActiveServer(ipAddress: string, timeout: number) {
        const INTERVAL = 500;
        const intervals = Math.ceil(timeout / INTERVAL);
        for (let i = 0; i < intervals; i++) {
            const start = Date.now();
            if (await this.isServerActive(ipAddress)) {
                return;
            }
            const end = Date.now();
            await new Promise((res) => setTimeout(res, Math.max(0, INTERVAL - (end - start) / 1000)));
        }
        throw new Error("Server timed out before responding");
    }

    public async isServerActive(ipAddress: string) {
        try {
            await Gamedig.query({
                type: "minecraft",
                host: ipAddress,
            });
            return true;
        } catch (e) {
            return false;
        }
    }

    public async getOnlinePlayers(ipAddress: string) {
        const pingResponse = await Gamedig.query({
            type: "minecraft",
            host: ipAddress,
        });

        const playerCount = pingResponse.players.length;

        return playerCount;
    }

    public async getStatus(server: IMinecraftServer): Promise<IMinecraftStatus> {
        const instanceId = server.instanceId;
        if (!(await this.instanceService.isInstanceRunning(instanceId))) {
            return {
                isOnline: false,
            };
        }
        const ipAddress = await this.instanceService.getPublicIPAddress(instanceId);
        if (!(await this.isServerActive(ipAddress))) {
            return {
                isOnline: false,
            };
        }

        const hostname = server.recordSet + ".tuttiapp.net";
        const players = await this.getOnlinePlayers(ipAddress);

        return {
            isOnline: true,
            ipAddress,
            hostname,
            players,
        };
    }

    public isValidServerName(name: string) {
        return this.getServerNames().includes(name);
    }

    public getServers() {
        return this.servers;
    }

    public getServerNames() {
        return this.servers.map((server) => server.name);
    }

    public getServerFromName(name: string) {
        return this.servers.find((s) => {
            return s.name === name;
        })!;
    }

    private async serverPing(server: IServer) {
        try {
            if (!(await this.instanceService.isInstanceRunning(server.instanceId))) {
                return;
            }

            const ipAddress = await this.instanceService.getPublicIPAddress(server.instanceId);
            const players = await this.getOnlinePlayers(ipAddress);
            console.log("Server pinged with " + players + " players.");
            if (players === 0) {
                server.noPlayersFor += PING_INTERVAL;
                console.log("No players on " + server.name + " for " + server.noPlayersFor + " seconds.");
            } else {
                server.noPlayersFor = 0;
            }
            if (server.noPlayersFor >= QUIT_THRESHOLD) {
                console.log("Server close threshold of " + QUIT_THRESHOLD + " hit, server closing.");
                await this.instanceService.stopInstance(server.instanceId);
            }
        } catch (e) {
            //
        }
    }
}
