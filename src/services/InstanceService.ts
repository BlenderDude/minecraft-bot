import * as AWS from "aws-sdk";
import { Inject, Service } from "typedi";
import { DiscordService } from "./DiscordService";

export enum InstanceType {
    TIER1 = "t3a.small",
    TIER2 = "c5.large",
}

@Service()
export class InstanceService {
    private EC2 = new AWS.EC2({
        region: "us-east-1",
    });

    private Pricing = new AWS.Pricing({
        region: "us-east-1",
    });

    public async startInstance(id: string) {
        await this.EC2.startInstances({
            InstanceIds: [id],
        }).promise();
    }

    public async waitForRunningInstance(id: string, timeout: number) {
        const INTERVAL = 500;
        const intervals = Math.ceil(timeout / INTERVAL);
        for (let i = 0; i < intervals; i++) {
            const start = Date.now();
            if (await this.isInstanceRunning(id)) {
                return;
            }
            const end = Date.now();
            await new Promise((res) => setTimeout(res, Math.max(0, INTERVAL - (end - start) / 1000)));
        }
        throw new Error("Server timed out before responding");
    }

    public async waitForPublicIp(id: string, timeout: number) {
        const INTERVAL = 500;
        const intervals = Math.ceil(timeout / INTERVAL);
        for (let i = 0; i < intervals; i++) {
            const start = Date.now();
            try {
                return await this.getPublicIPAddress(id);
            } catch {
                //
            }

            const end = Date.now();
            await new Promise((res) => setTimeout(res, Math.max(0, INTERVAL - (end - start) / 1000)));
        }
        throw new Error("Server timed out before responding");
    }

    public async isInstanceRunning(id: string) {
        const status = await this.getInstanceStatusCode(id);
        return status === 16;
    }

    public async isInstanceShuttingDown(id: string) {
        const status = await this.getInstanceStatusCode(id);
        return status === 32 || status === 64;
    }

    public async isInstanceStopped(id: string) {
        const status = await this.getInstanceStatusCode(id);
        return status === 80;
    }

    public async getPublicIPAddress(id: string) {
        const res = await this.EC2.describeInstances({
            InstanceIds: [id],
        }).promise();

        if (!res) {
            throw new Error("AWS SDK Error");
        }

        const reservations = res.Reservations!;
        if (!reservations) {
            throw new Error("AWS SDK Error");
        }
        const instances = reservations[0].Instances;
        if (!instances) {
            throw new Error("AWS SDK Error");
        }

        const ipAddress = instances[0].PublicIpAddress;
        if (!ipAddress) {
            throw new Error("AWS SDK Error");
        }

        return ipAddress;
    }

    public async changeInstanceType(id: string, type: InstanceType) {
        await this.EC2.modifyInstanceAttribute({
            Attribute: "instanceType",
            Value: type,
            InstanceId: id,
        });
    }

    public async stopInstance(id: string) {
        await this.EC2.stopInstances({
            InstanceIds: [id],
        }).promise();
    }

    public async getSessionPrice(id: string, duration: number) {
        const instanceType = await this.getInstanceType(id);
        const res = await this.Pricing.getProducts({
            ServiceCode: "AmazonEC2",
            Filters: [
                {
                    Type: "TERM_MATCH",
                    Field: "operatingSystem",
                    Value: "Linux",
                },
                {
                    Type: "TERM_MATCH",
                    Field: "operation",
                    Value: "RunInstances",
                },
                {
                    Type: "TERM_MATCH",
                    Field: "capacitystatus",
                    Value: "Used",
                },
                {
                    Type: "TERM_MATCH",
                    Field: "tenancy",
                    Value: "Shared",
                },
                {
                    Type: "TERM_MATCH",
                    Field: "instanceType",
                    Value: instanceType,
                },
                {
                    Type: "TERM_MATCH",
                    Field: "location",
                    Value: "US East (N. Virginia)",
                },
            ],
        }).promise();

        if (!res.PriceList) {
            throw new Error("AWS SDK Error");
        }

        const priceObject = res.PriceList[0] as any;
        const onDemand = priceObject.terms.OnDemand;
        const priceDimensions = onDemand[Object.keys(onDemand)[0]].priceDimensions;
        const pricePerHour = priceDimensions[Object.keys(priceDimensions)[0]].pricePerUnit.USD;
        const pricePerSecond = pricePerHour / 60 / 60;
        return pricePerSecond * duration;
    }

    public async getLaunchTime(id: string) {
        const res = await this.EC2.describeInstances({
            InstanceIds: [id],
        }).promise();

        if (!res.Reservations || res.Reservations.length === 0 || !res.Reservations[0].Instances) {
            throw new Error("AWS SDK Error");
        }

        if (!res.Reservations[0].Instances[0] || !res.Reservations[0].Instances[0].LaunchTime) {
            throw new Error("AWS SDK Error");
        }

        return new Date(res.Reservations[0].Instances[0].LaunchTime);
    }

    private async getInstanceStatusCode(id: string) {
        const res = await this.EC2.describeInstances({
            InstanceIds: [id],
        }).promise();

        if (!res.Reservations || res.Reservations.length === 0 || !res.Reservations[0].Instances) {
            throw new Error("AWS SDK Error");
        }

        if (!res.Reservations[0].Instances[0] || !res.Reservations[0].Instances[0].State) {
            throw new Error("AWS SDK Error");
        }

        return res.Reservations[0].Instances[0].State.Code!;
    }

    private async getInstanceType(id: string) {
        const res = await this.EC2.describeInstances({
            InstanceIds: [id],
        }).promise();

        if (!res.Reservations || res.Reservations.length === 0 || !res.Reservations[0].Instances) {
            throw new Error("AWS SDK Error");
        }

        if (!res.Reservations[0].Instances[0] || !res.Reservations[0].Instances[0].InstanceType) {
            throw new Error("AWS SDK Error");
        }

        return res.Reservations[0].Instances[0].InstanceType;
    }
}
