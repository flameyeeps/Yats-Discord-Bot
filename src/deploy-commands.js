require("dotenv").config();

const { REST, Routes } = require("discord.js");
const commands = require("./commands");

async function main() {
  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error("Set DISCORD_TOKEN and CLIENT_ID in your .env file.");
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log(`Successfully registered ${commands.length} Yats Bot slash commands${GUILD_ID ? " to the test server" : " globally"}.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
