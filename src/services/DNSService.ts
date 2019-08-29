import * as AWS from "aws-sdk";
import { Service } from "typedi";
import { BASE_HOSTNAME } from "../index";

@Service()
export class DNSService {
    private R53 = new AWS.Route53();

    public async updateRecordSet(recordSet: string, ipAddress: string) {
        await this.R53.changeResourceRecordSets({
            ChangeBatch: {
                Changes: [
                    {
                        Action: "UPSERT",
                        ResourceRecordSet: {
                            Name: recordSet + BASE_HOSTNAME,
                            Type: "A",
                            ResourceRecords: [
                                {
                                    Value: ipAddress,
                                },
                            ],
                            TTL: 10,
                        },
                    },
                ],
            },
            HostedZoneId: process.env.HOSTED_ZONE_ID!,
        }).promise();
    }
}
