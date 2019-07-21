import * as AWS from "aws-sdk";
import { Service } from "typedi";

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
                            Name: recordSet + ".tuttiapp.net",
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
            HostedZoneId: "Z1V2E7XVF7XEM8",
        }).promise();
    }
}
