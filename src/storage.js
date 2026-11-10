const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "guilds.json");

let database = {};

async function load() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    database = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    database = {};
    await save();
  }
}

async function save() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(database, null, 2), "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function getGuild(guildId) {
  if (!database[guildId]) {
    database[guildId] = {
      roles: {},
      logChannelId: null,
      warnings: [],
      reports: [],
      bugs: [],
      nextReportId: 1,
      nextBugId: 1
    };
  }
  return database[guildId];
}

async function updateGuild(guildId, callback) {
  const guild = getGuild(guildId);
  const result = await callback(guild);
  await save();
  return result;
}

module.exports = { load, getGuild, updateGuild };
