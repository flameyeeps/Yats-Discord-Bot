
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { load, getGuild, updateGuild } = require("./storage");

const {
  isAdministrator,
  hasCategory,
  requireCategory
} = require("./permissions");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ----------------------------------
// HELPERS
// ----------------------------------

function truncate(value, max = 900) {
  value = String(value ?? "");

  return value.length > max
    ? `${value.slice(0, max - 3)}...`
    : value;
}

function getGuildId(interaction) {
  return interaction.guildId || interaction.guild?.id || null;
}

// Use the guild and member already available to the bot.
// Avoid fetching a guild from Discord's API unnecessarily.
async function getServerContext(interaction) {
  const guildId = getGuildId(interaction);

  if (!guildId || !interaction.inGuild()) {
    return { guild: null, member: null };
  }

  const guild =
    interaction.guild ||
    client.guilds.cache.get(guildId) ||
    null;

  if (!guild) {
    console.error("[Yats] Guild not found in cache:", guildId);
    return { guild: null, member: null };
  }

  let member = null;

  // Prefer the actual GuildMember object from the interaction.
  if (
    interaction.member &&
    interaction.member.roles?.cache &&
    typeof interaction.member.permissions?.has === "function"
  ) {
    member = interaction.member;
  }

  // Otherwise, try the cached member.
  if (!member) {
    member = guild.members.cache.get(interaction.user.id) || null;
  }

  // Only fetch the member if the guild is already available.
  if (!member) {
    member = await guild.members.fetch(interaction.user.id)
      .catch(error => {
        console.error("[Yats] Member fetch failed:", error);
        return null;
      });
  }

  return { guild, member };
}

async function sendStaffLog(guild, embed) {
  if (!guild) return;

  const config = getGuild(guild.id);

  if (!config.logChannelId) return;

  const channel = await guild.channels
    .fetch(config.logChannelId)
    .catch(() => null);

  if (channel?.isTextBased()) {
    await channel.send({ embeds: [embed] }).catch(console.error);
  }
}

// ----------------------------------
// COMMAND HANDLER
// ----------------------------------

async function handleCommand(interaction) {
  const { commandName, user } = interaction;

  console.log("[Yats] Command received:", {
    command: commandName,
    guildId: interaction.guildId,
    inGuild: interaction.inGuild(),
    guildCached: Boolean(interaction.guild),
    channelId: interaction.channelId
  });

  // PING
  if (commandName === "ping") {
    return interaction.reply({
      content: `Pong! 🏓 Latency: ${client.ws.ping}ms`,
      ephemeral: true
    });
  }

  // HELP
  if (commandName === "help") {
    return interaction.reply({
      content: [
        "**Yats Bot Commands**",
        "",
        "**General**",
        "`/ping` — Check bot response.",
        "`/help` — Show this help menu.",
        "`/report` — Report a member.",
        "`/bug` — Report a game bug.",
        "",
        "**Staff configuration**",
        "`/setrole` — Configure staff roles.",
        "`/roles` — View staff roles.",
        "`/setlogchannel` — Set the log channel.",
        "",
        "**Moderation**",
        "`/warn` — Record a warning.",
        "`/warnings` — View warnings.",
        "`/clearwarnings` — Clear warnings.",
        "`/purge` — Delete messages.",
        "`/lock` — Lock a channel.",
        "`/unlock` — Unlock a channel.",
        "",
        "**Support**",
        "`/reports` — View reports.",
        "`/resolve` — Resolve a report.",
        "",
        "**Game staff and developers**",
        "`/announce` — Send an announcement.",
        "`/bugs` — View bug reports.",
        "`/fixbug` — Mark a bug as fixed."
      ].join("\n"),
      ephemeral: true
    });
  }

  // LOAD SERVER AND MEMBER
  const { guild, member } = await getServerContext(interaction);

  if (!guild || !member) {
    console.error("[Yats] Missing server/member context:", {
      command: commandName,
      guildId: interaction.guildId,
      guildLoaded: Boolean(guild),
      memberLoaded: Boolean(member)
    });

    return interaction.reply({
      content: "Yats couldn't load your server or membership. Please try again and check the Railway logs if it continues.",
      ephemeral: true
    });
  }

  const guildId = guild.id;
  const config = getGuild(guildId);

  // ----------------------------------
  // SET ROLE
  // ----------------------------------

  if (commandName === "setrole") {
    if (!isAdministrator(member)) {
      return interaction.reply({
        content: "Only Discord administrators can configure staff roles.",
        ephemeral: true
      });
    }

    const category = interaction.options.getString("category");
    const role = interaction.options.getRole("role");

    if (!role) {
      return interaction.reply({
        content: "Please select a valid role.",
        ephemeral: true
      });
    }

    if (role.managed) {
      return interaction.reply({
        content: "That role is integration-managed and cannot be assigned.",
        ephemeral: true
      });
    }

    await updateGuild(guildId, data => {
      data.roles[category] = role.id;
    });

    return interaction.reply({
      content: `**${category.replace("_", " ")}** commands are now assigned to ${role}.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // ROLES
  // ----------------------------------

  if (commandName === "roles") {
    const labels = {
      moderator: "Moderator",
      support: "Support",
      developer: "Developer",
      game_staff: "Game Staff"
    };

    const lines = Object.entries(labels).map(([key, label]) =>
      `**${label}:** ${
        config.roles[key]
          ? `<@&${config.roles[key]}>`
          : "*Not configured*"
      }`
    );

    return interaction.reply({
      content: `**Yats Bot role configuration**\n${lines.join("\n")}`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // SET LOG CHANNEL
  // ----------------------------------

  if (commandName === "setlogchannel") {
    if (!isAdministrator(member)) {
      return interaction.reply({
        content: "Only Discord administrators can set the log channel.",
        ephemeral: true
      });
    }

    const channel = interaction.options.getChannel("channel");

    if (!channel?.isTextBased()) {
      return interaction.reply({
        content: "Please select a valid text channel.",
        ephemeral: true
      });
    }

    await updateGuild(guildId, data => {
      data.logChannelId = channel.id;
    });

    return interaction.reply({
      content: `Staff logs and reports will be sent to ${channel}.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // WARN
  // ----------------------------------

  if (commandName === "warn") {
    if (!(await requireCategory(interaction, "moderator"))) return;

    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");

    const id = await updateGuild(guildId, data => {
      const nextId = data.warnings.length
        ? Math.max(...data.warnings.map(w => w.id)) + 1
        : 1;

      data.warnings.push({
        id: nextId,
        userId: target.id,
        moderatorId: user.id,
        reason,
        at: new Date().toISOString()
      });

      return nextId;
    });

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle("Member warned")
        .setDescription(
          `Member: ${target}\nModerator: ${user}\nWarning ID: ${id}\nReason: ${truncate(reason)}`
        )
        .setTimestamp()
    );

    return interaction.reply({
      content: `Warning **#${id}** recorded for ${target}. No automatic punishment is applied.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // WARNINGS
  // ----------------------------------

  if (commandName === "warnings") {
    if (!(await requireCategory(interaction, "moderator"))) return;

    const target = interaction.options.getUser("member");

    const items = config.warnings
      .filter(w => w.userId === target.id)
      .slice(-10);

    const body = items.length
      ? items.map(w =>
          `**#${w.id}** — ${truncate(w.reason, 180)} (by <@${w.moderatorId}>)`
        ).join("\n")
      : "No warnings recorded.";

    return interaction.reply({
      content: `Warnings for ${target}:\n${body}`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // CLEAR WARNINGS
  // ----------------------------------

  if (commandName === "clearwarnings") {
    if (!(await requireCategory(interaction, "moderator"))) return;

    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");

    const count = await updateGuild(guildId, data => {
      const before = data.warnings.length;

      data.warnings = data.warnings.filter(
        w => w.userId !== target.id
      );

      return before - data.warnings.length;
    });

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle("Warnings cleared")
        .setDescription(
          `Member: ${target}\nModerator: ${user}\nCount: ${count}\nReason: ${truncate(reason)}`
        )
        .setTimestamp()
    );

    return interaction.reply({
      content: `Cleared **${count}** warning(s) for ${target}.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // REPORT
  // ----------------------------------

  if (commandName === "report") {
    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");

    const report = await updateGuild(guildId, data => {
      const item = {
        id: data.nextReportId++,
        userId: target.id,
        reporterId: user.id,
        reason,
        status: "open",
        at: new Date().toISOString()
      };

      data.reports.push(item);
      return item;
    });

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle(`New member report #${report.id}`)
        .setDescription(
          `Reported member: ${target}\nReporter: ${user}\nReason: ${truncate(reason)}`
        )
        .setTimestamp()
    );

    return interaction.reply({
      content: `Your report **#${report.id}** has been sent to staff.`
    });
  }

  // ----------------------------------
  // REPORTS
  // ----------------------------------

  if (commandName === "reports") {
    if (
      !hasCategory(member, "support") &&
      !hasCategory(member, "moderator")
    ) {
      return interaction.reply({
        content: "You need the Support or Moderator role to view reports.",
        ephemeral: true
      });
    }

    const items = config.reports
      .filter(r => r.status === "open")
      .slice(-15);

    const body = items.length
      ? items.map(r =>
          `**#${r.id}** | <@${r.userId}> reported by <@${r.reporterId}> — ${truncate(r.reason, 180)}`
        ).join("\n")
      : "There are no open reports.";

    return interaction.reply({
      content: `**Open reports**\n${body}`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // RESOLVE
  // ----------------------------------

  if (commandName === "resolve") {
    if (
      !hasCategory(member, "support") &&
      !hasCategory(member, "moderator")
    ) {
      return interaction.reply({
        content: "You need the Support or Moderator role to resolve reports.",
        ephemeral: true
      });
    }

    const id = interaction.options.getInteger("id");
    const note = interaction.options.getString("note");

    const report = await updateGuild(guildId, data => {
      const item = data.reports.find(r => r.id === id);

      if (item) {
        item.status = "resolved";
        item.resolvedBy = user.id;
        item.resolution = note;
      }

      return item || null;
    });

    if (!report) {
      return interaction.reply({
        content: `Report #${id} was not found.`,
        ephemeral: true
      });
    }

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle(`Report #${id} resolved`)
        .setDescription(`Resolved by: ${user}\nNote: ${truncate(note)}`)
        .setTimestamp()
    );

    return interaction.reply({
      content: `Report **#${id}** marked as resolved.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // ANNOUNCE
  // ----------------------------------

  if (commandName === "announce") {
    if (!(await requireCategory(interaction, "game_staff"))) return;

    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");

    if (!channel?.isTextBased()) {
      return interaction.reply({
        content: "Please select a valid text channel.",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("Yats Announcement")
      .setDescription(message)
      .setFooter({
        text: `Posted by ${user.username}`
      })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    return interaction.reply({
      content: `Announcement posted in ${channel}.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // BUG
  // ----------------------------------

  if (commandName === "bug") {
    const description = interaction.options.getString("description");

    const bug = await updateGuild(guildId, data => {
      const item = {
        id: data.nextBugId++,
        reporterId: user.id,
        description,
        status: "open",
        at: new Date().toISOString()
      };

      data.bugs.push(item);
      return item;
    });

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle(`New Yats bug #${bug.id}`)
        .setDescription(
          `Reported by: ${user}\n${truncate(description)}`
        )
        .setTimestamp()
    );

    return interaction.reply({
      content: `Bug report **#${bug.id}** submitted. Thank you!`
    });
  }

  // ----------------------------------
  // BUGS
  // ----------------------------------

  if (commandName === "bugs") {
    if (
      !hasCategory(member, "game_staff") &&
      !hasCategory(member, "developer")
    ) {
      return interaction.reply({
        content: "You need the Game Staff or Developer role to view bugs.",
        ephemeral: true
      });
    }

    const items = config.bugs
      .filter(b => b.status === "open")
      .slice(-15);

    const body = items.length
      ? items.map(b =>
          `**#${b.id}** | <@${b.reporterId}> — ${truncate(b.description, 180)}`
        ).join("\n")
      : "There are no open bugs.";

    return interaction.reply({
      content: `**Open Yats bugs**\n${body}`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // FIX BUG
  // ----------------------------------

  if (commandName === "fixbug") {
    if (
      !hasCategory(member, "game_staff") &&
      !hasCategory(member, "developer")
    ) {
      return interaction.reply({
        content: "You need the Game Staff or Developer role to mark bugs fixed.",
        ephemeral: true
      });
    }

    const id = interaction.options.getInteger("id");
    const note = interaction.options.getString("note");

    const bug = await updateGuild(guildId, data => {
      const item = data.bugs.find(b => b.id === id);

      if (item) {
        item.status = "fixed";
        item.fixedBy = user.id;
        item.fixNote = note;
      }

      return item || null;
    });

    if (!bug) {
      return interaction.reply({
        content: `Bug #${id} was not found.`,
        ephemeral: true
      });
    }

    await sendStaffLog(
      guild,
      new EmbedBuilder()
        .setTitle(`Bug #${id} marked fixed`)
        .setDescription(`Fixed by: ${user}\nNote: ${truncate(note)}`)
        .setTimestamp()
    );

    return interaction.reply({
      content: `Bug **#${id}** marked as fixed.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // PURGE
  // ----------------------------------

  if (commandName === "purge") {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: "You need the Manage Messages permission.",
        ephemeral: true
      });
    }

    const amount = interaction.options.getInteger("amount");

    if (!interaction.channel?.bulkDelete) {
      return interaction.reply({
        content: "This command cannot be used in this channel.",
        ephemeral: true
      });
    }

    const deleted = await interaction.channel.bulkDelete(amount, true);

    return interaction.reply({
      content: `Deleted **${deleted.size}** recent messages.`,
      ephemeral: true
    });
  }

  // ----------------------------------
  // LOCK / UNLOCK
  // ----------------------------------

  if (commandName === "lock" || commandName === "unlock") {
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: "You need the Manage Channels permission.",
        ephemeral: true
      });
    }

    const everyone = guild.roles.everyone;
    const value = commandName === "lock" ? false : null;

    await interaction.channel.permissionOverwrites.edit(
      everyone,
      { SendMessages: value }
    );

    return interaction.reply({
      content: commandName === "lock"
        ? "This channel is now locked for @everyone."
        : "The @everyone send-message override has been removed.",
      ephemeral: true
    });
  }

  // UNKNOWN COMMAND
  return interaction.reply({
    content: "Unknown command.",
    ephemeral: true
  });
}

// ----------------------------------
// BOT EVENTS
// ----------------------------------

client.once("ready", () => {
  console.log("--------------------------------");
  console.log(`Yats Bot is online as ${client.user.tag}`);
  console.log(`Connected to ${client.guilds.cache.size} server(s).`);
  console.log("--------------------------------");
});

client.on("guildCreate", guild => {
  console.log(`[Yats] Joined server: ${guild.name} (${guild.id})`);
});

client.on("guildDelete", guild => {
  console.log(`[Yats] Removed from server: ${guild.name} (${guild.id})`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(
      `[Yats] Command /${interaction.commandName} failed:`,
      error
    );

    const message =
      "Something went wrong while running that command. Check Railway logs.";

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: message,
        ephemeral: true
      }).catch(() => null);
    } else {
      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(() => null);
    }
  }
});

// ----------------------------------
// START BOT
// ----------------------------------

(async () => {
  if (!process.env.DISCORD_TOKEN) {
    throw new Error("Missing DISCORD_TOKEN in Railway Variables.");
  }

  await load();
  await client.login(process.env.DISCORD_TOKEN);
})();
