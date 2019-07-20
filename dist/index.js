// Load up the discord.js library
const Discord = require("discord.js");
const AWS = require("aws-sdk");
const Gamedig = require("gamedig");

// This is your client. Some people call it `bot`, some people call it `self`,
// some might call it `cootchie`. Either way, when you see `client.something`, or `bot.something`,
// this is what we're refering to. Your client.
const client = new Discord.Client();

// config.token contains the bot's token
// config.prefix contains the message prefix.

const config = {
  prefix: "!"
};

const InstanceID = "i-0797e181a1afacb5a";

const EC2 = new AWS.EC2({
  region: "us-east-1"
});

let serverOnline = false;
let ipAddress;

let channel;

const checkServerStatus = async () => {
  try {
    const res = await EC2.describeInstanceStatus({
      InstanceIds: [InstanceID]
    }).promise();

    const status = res.InstanceStatuses[0].InstanceState.Code;

    serverOnline = status === 16;

    if (serverOnline) {
      const ipRes = await EC2.describeInstances({
        InstanceIds: [InstanceID]
      }).promise();

      ipAddress = ipRes.Reservations[0].Instances[0].PublicIpAddress;
    } else {
      ipAddress = undefined;
    }
  } catch (e) {
    serverOnline = false;
    ipAddress = undefined;
  }
};

client.on("ready", async () => {
  await client.user.setActivity("your every move", {
    type: "WATCHING",
    url: "https://asqdigital.com"
  });
  console.log("Initial server check...");
  await checkServerStatus();
  if (serverOnline) {
    console.log("Server online");
  } else {
    console.log("Server offline");
  }

  // This event will run if the bot starts, and logs in, successfully.
  console.log(
    `Bot has started, with ${client.users.size} users, in ${
      client.channels.size
    } channels of ${client.guilds.size} guilds.`
  );
});

client.on("guildCreate", guild => {
  // This event triggers when the bot joins a guild.
  console.log(
    `New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${
      guild.memberCount
    } members!`
  );
  client.user.setActivity(`Serving ${client.guilds.size} servers`);
});

client.on("guildDelete", guild => {
  // this event triggers when the bot is removed from a guild.
  console.log(`I have been removed from: ${guild.name} (id: ${guild.id})`);
  client.user.setActivity(`Serving ${client.guilds.size} servers`);
});

client.on("message", async message => {
  // This event will run on every single message received, from any channel or DM.

  // It's good practice to ignore other bots. This also makes your bot ignore itself
  // and not get into a spam loop (we call that "botception").
  if (message.author.bot) return;

  // Also good practice to ignore any message that does not start with our prefix,
  // which is set in the configuration file.
  if (message.content.indexOf(config.prefix) !== 0) return;

  // Here we separate our "command" name, and our "arguments" for the command.
  // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
  // command = say
  // args = ["Is", "this", "the", "real", "life?"]
  const args = message.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  channel = message.channel;

  // Let's go with a few common example commands! Feel free to delete or change those.

  if (command === "mc-start") {
    await checkServerStatus();

    console.log("Server start initiated by " + message.author.username);

    if (serverOnline) {
      await message.channel.send(
        "Server is already online, use !mc-status to check the current IP"
      );
    }

    const m = await message.channel.send("Starting AWS server...");
    console.log("Starting AWS Server");

    try {
      await EC2.startInstances({
        InstanceIds: [InstanceID]
      }).promise();
    } catch (e) {
      await m.edit(
        "AWS Server failed to start, please wait a minute and try again."
      );
      console.log("AWS Server failed to start.");
      return;
    }

    let started = false;

    for (let i = 0; i < 300; i++) {
      const res = await EC2.describeInstanceStatus({
        InstanceIds: [InstanceID]
      }).promise();

      if (res.InstanceStatuses.length !== 0) {
        const status = res.InstanceStatuses[0].InstanceState.Code;

        if (status === 16) {
          started = true;
          break;
        }
      }

      await new Promise(res => setTimeout(res, 1000));
    }

    if (!started) {
      await m.edit(
        "Failed to start AWS server in 5 minutes. Idk whats gonna happen I didn't program this in."
      );
      console.log(
        "Failed to start AWS server in 5 minutes. Idk whats gonna happen I didn't program this in."
      );
      return;
    }

    const res = await EC2.describeInstances({
      InstanceIds: [InstanceID]
    }).promise();

    ipAddress = res.Reservations[0].Instances[0].PublicIpAddress;

    await checkServerStatus();

    await m.edit(
      `Server starting at IP address: ${ipAddress} (Copy this while the MC server starts...)`
    );

    console.log(`Server starting at IP address: ${ipAddress}`);

    let mcStarted = false;

    for (let i = 0; i < 300; i++) {
      try {
        await Gamedig.query({
          type: "minecraft",
          host: ipAddress
        });
        mcStarted = true;
        break;
      } catch (e) {
        mcStarted = false;
      }

      await new Promise(res => setTimeout(res, 1000));
    }

    if (!mcStarted) {
      await m.edit(
        `Server started, but the Minecraft server didn't. Shutting down the server.`
      );
      console.log(
        `Server started, but the Minecraft server didn't. Shutting down the server.`
      );
      try {
        await EC2.stopInstances({
          InstanceIds: [InstanceID]
        }).promise();
      } catch (e) {}
      return;
    }
    await m.edit(`Server online at IP address: ${ipAddress}`);
    console.log(`Server online at IP address: ${ipAddress}`);
  }
  if (command === "mc-status") {
    await checkServerStatus();

    console.log("Server status checked by " + message.author.username);

    if (message.author.id === "181485665832271872") {
      await message.channel.send(
        "FUCK YOU LUKE, YOU COULD BE CRAFTIN' IF YOU WEREN'T PLAYING ON THE OTHER HALF OF THE GLOBE"
      );
    }

    if (message.author.id === "179957985253130240") {
      await message.channel.send(
        "FUCK YOU DANIEL, LOOK AT THE DAMN AWS CONSOLE"
      );
      return;
    }

    if (!serverOnline) {
      await message.channel.send(
        "Server is currently offline, use !mc-start to boot it"
      );
      return;
    }

    const ipRes = await EC2.describeInstances({
      InstanceIds: [InstanceID]
    }).promise();

    ipAddress = ipRes.Reservations[0].Instances[0].PublicIpAddress;

    const pingResponse = await Gamedig.query({
      type: "minecraft",
      host: ipAddress
    });

    const playerCount = pingResponse.players.length;

    await message.channel.send(
      `Server up at IP address: ${ipAddress} with ${playerCount} player${
        playerCount === 1 ? "" : "s"
      } online.`
    );
  }
});

let noPlayersFor = 0;

const SHUTDOWN_THRESHOLD = 60 * 5;
const REFRESH_RATE = 5;

setInterval(async () => {
  try {
    if (!ipAddress) {
      return;
    }
    const pingResponse = await Gamedig.query({
      type: "minecraft",
      host: ipAddress
    });

    const playerCount = pingResponse.players.length;

    if (playerCount === 0) {
      noPlayersFor += REFRESH_RATE;
      console.log(
        `Pinged player count 0, no players for ${noPlayersFor} seconds, shutting down in ${SHUTDOWN_THRESHOLD -
          noPlayersFor} seconds`
      );
    } else {
      noPlayersFor = 0;
    }

    if (noPlayersFor >= SHUTDOWN_THRESHOLD && serverOnline) {
      await checkServerStatus();
      if (serverOnline) {
        let m;
        if (channel) {
          m = await channel.send(
            `Shutting down server after ${SHUTDOWN_THRESHOLD} seconds of no players`
          );
        }
        console.log("Shutting down server...");
        await EC2.stopInstances({
          InstanceIds: [InstanceID]
        }).promise();
        for (let i = 0; i < 300; i++) {
          await checkServerStatus();
          if (!serverOnline) break;
          await new Promise(res => setTimeout(res, 1000));
        }
        if (channel && m) {
          await m.edit(
            `Server shut down after ${SHUTDOWN_THRESHOLD} seconds of no players`
          );
        }
        console.log("Server shut down.");
      }
    }
  } catch (e) {
    noPlayersFor = 0;
  }
}, REFRESH_RATE * 1000);

client.login(process.env.DISCORD_TOKEN);
