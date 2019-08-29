# Minecraft Discord Bot

This bot is designed to allow friend groups to have a powerful Minecraft server on demand for cents per hour. The project is backed by AWS, so an account is required to run. The bot has many commands that allow it to be interacted with. You can run `!mc help` to find out more, or read below.

### Features

-   Automatic DNS updating using Route53. Keeping a static IP with AWS between launches costs money, so by updating a DNS record with a low TTL (10) we can avoid that cost.
-   Server shuts down when there are no players on for 5 minutes.
-   Instance type can be swapped out in case you need a more or less powerful server. Note: Burstable instance (T3/T2 series) will almost always be above their burst limit while running a server so be wearly of extra costs associated. Espcially with T3 unlimited! I found that C5.large works the best.

#### `!mc help`

The generic help command that responds with a list of possible commands

#### `!mc start SERVER_NAME`

Starts a specific server and responds with the current status of it. It will also keep you updated on the DNS name, and give a fallback IP address if that does not work.

#### `!mc status`

Displays the status of all registered servers.

#### `!mc stop SERVER_NAME`

Stops a server immediately in order to save a few extra cents. Note: In order to stop it, there must be no players on the server.

### Environment

In order to run, there must be a few variables set in the `.env` file.

-   `HOSTED_ZONE_ID`: The Zone ID for your domain
-   `BASE_HOSTNAME`: The base hostname for that zone
-   `VANILLA_INSTANCE_ID`: The instance id for the vanilla server
-   `VANILLA_RECORD_SET`: The record set for the server. This will be prepended to the `BASE_HOSTNAME`

AWS credentials must also be found in the environment. You can read about what you need to apply [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)
