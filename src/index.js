require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { load, getGuild, updateGuild } = require("./storage");
const { isAdministrator, hasCategory, requireCategory } = require("./permissions");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

function truncate(value, max = 900) {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

async function sendStaffLog(guild, embed) {
  const config = getGuild(guild.id);
  if (!config.logChannelId) return;
  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (channel && channel.isTextBased()) {
    await channel.send({ embeds: [embed] }).catch(() => null);
  }
}

async function handleCommand(interaction) {
  if (!interaction.inGuild()) {
    return interaction.reply({ content: "Yats Bot commands must be used in a server.", ephemeral: true });
  }

  const { commandName, guild, member, user } = interaction;
  const config = getGuild(guild.id);

  if (commandName === "setrole") {
    if (!isAdministrator(member)) {
      return interaction.reply({ content: "Only Discord administrators can configure staff roles.", ephemeral: true });
    }
    const category = interaction.options.getString("category");
    const role = interaction.options.getRole("role");
    if (role.managed) {
      return interaction.reply({ content: "That is an integration-managed role and cannot be assigned.", ephemeral: true });
    }
    await updateGuild(guild.id, data => { data.roles[category] = role.id; });
    return interaction.reply({
      content: `**${category.replace("_", " ")}** commands are now assigned to ${role}. Members with that role can use that category's commands. Discord administrators also retain access.`,
      ephemeral: true
    });
  }

  if (commandName === "roles") {
    const labels = {
      moderator: "Moderator",
      support: "Support",
      developer: "Developer",
      game_staff: "Game Staff"
    };
    const lines = Object.entries(labels).map(([key, label]) =>
      `**${label}:** ${config.roles[key] ? `<@&${config.roles[key]}>` : "*Not configured*"}`
    );
    return interaction.reply({ content: `**Yats Bot role configuration**\n${lines.join("\n")}`, ephemeral: true });
  }

  if (commandName === "setlogchannel") {
    if (!isAdministrator(member)) {
      return interaction.reply({ content: "Only Discord administrators can set the log channel.", ephemeral: true });
    }
    const channel = interaction.options.getChannel("channel");
    await updateGuild(guild.id, data => { data.logChannelId = channel.id; });
    return interaction.reply({ content: `Staff logs and new reports will be sent to ${channel}.`, ephemeral: true });
  }

  if (commandName === "warn") {
    if (!(await requireCategory(interaction, "moderator"))) return;
    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");
    const id = await updateGuild(guild.id, data => {
      const nextId = data.warnings.length ? Math.max(...data.warnings.map(w => w.id)) + 1 : 1;
      data.warnings.push({ id: nextId, userId: target.id, moderatorId: user.id, reason, at: new Date().toISOString() });
      return nextId;
    });
    await sendStaffLog(guild, new EmbedBuilder().setTitle("Member warned").setDescription(`Member: ${target}\nModerator: ${user}\nWarning ID: ${id}\nReason: ${truncate(reason)}`).setTimestamp());
    return interaction.reply({ content: `Warning **#${id}** recorded for ${target}. This records a warning; it does not automatically punish them.`, ephemeral: true });
  }

  if (commandName === "warnings") {
    if (!(await requireCategory(interaction, "moderator"))) return;
    const target = interaction.options.getUser("member");
    const items = config.warnings.filter(w => w.userId === target.id).slice(-10);
    const body = items.length
      ? items.map(w => `**#${w.id}** — ${w.reason} (by <@${w.moderatorId}>)`).join("\n")
      : "No warnings recorded.";
    return interaction.reply({ content: `Warnings for ${target}:\n${body}`, ephemeral: true });
  }

  if (commandName === "clearwarnings") {
    if (!(await requireCategory(interaction, "moderator"))) return;
    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");
    const count = await updateGuild(guild.id, data => {
      const before = data.warnings.length;
      data.warnings = data.warnings.filter(w => w.userId !== target.id);
      return before - data.warnings.length;
    });
    await sendStaffLog(guild, new EmbedBuilder().setTitle("Warnings cleared").setDescription(`Member: ${target}\nModerator: ${user}\nCount: ${count}\nReason: ${truncate(reason)}`).setTimestamp());
    return interaction.reply({ content: `Cleared **${count}** warning(s) for ${target}.`, ephemeral: true });
  }

  if (commandName === "report") {
    const target = interaction.options.getUser("member");
    const reason = interaction.options.getString("reason");
    const report = await updateGuild(guild.id, data => {
      const item = { id: data.nextReportId++, userId: target.id, reporterId: user.id, reason, status: "open", at: new Date().toISOString() };
      data.reports.push(item);
      return item;
    });
    await sendStaffLog(guild, new EmbedBuilder().setTitle(`New member report #${report.id}`).setDescription(`Reported member: ${target}\nReporter: ${user}\nReason: ${truncate(reason)}`).setTimestamp());
    return interaction.reply({ content: `Your report **#${report.id}** has been sent to the staff team.`, ephemeral: true });
  }

  if (commandName === "reports") {
    if (!hasCategory(member, "support") && !hasCategory(member, "moderator")) {
      return interaction.reply({ content: "You need the configured Support or Moderator role to view reports.", ephemeral: true });
    }
    const items = config.reports.filter(r => r.status === "open").slice(-15);
    const body = items.length
      ? items.map(r => `**#${r.id}** | <@${r.userId}> reported by <@${r.reporterId}> — ${truncate(r.reason, 180)}`).join("\n")
      : "There are no open reports.";
    return interaction.reply({ content: `**Open reports**\n${body}`, ephemeral: true });
  }

  if (commandName === "resolve") {
    if (!hasCategory(member, "support") && !hasCategory(member, "moderator")) {
      return interaction.reply({ content: "You need the configured Support or Moderator role to resolve reports.", ephemeral: true });
    }
    const id = interaction.options.getInteger("id");
    const note = interaction.options.getString("note");
    const report = await updateGuild(guild.id, data => {
      const item = data.reports.find(r => r.id === id);
      if (item) { item.status = "resolved"; item.resolvedBy = user.id; item.resolution = note; }
      return item || null;
    });
    if (!report) return interaction.reply({ content: `Report #${id} was not found.`, ephemeral: true });
    await sendStaffLog(guild, new EmbedBuilder().setTitle(`Report #${id} resolved`).setDescription(`Resolved by: ${user}\nNote: ${truncate(note)}`).setTimestamp());
    return interaction.reply({ content: `Report **#${id}** marked as resolved.`, ephemeral: true });
  }

  if (commandName === "announce") {
    if (!(await requireCategory(interaction, "game_staff"))) return;
    const channel = interaction.options.getChannel("channel");
    const message = interaction.options.getString("message");
    const embed = new EmbedBuilder().setTitle("Yats Announcement").setDescription(message).setFooter({ text: `Posted by ${user.username}` }).setTimestamp();
    await channel.send({ embeds: [embed] });
    return interaction.reply({ content: `Announcement posted in ${channel}.`, ephemeral: true });
  }

  if (commandName === "bug") {
    const description = interaction.options.getString("description");
    const bug = await updateGuild(guild.id, data => {
      const item = { id: data.nextBugId++, reporterId: user.id, description, status: "open", at: new Date().toISOString() };
      data.bugs.push(item);
      return item;
    });
    await sendStaffLog(guild, new EmbedBuilder().setTitle(`New Yats bug #${bug.id}`).setDescription(`Reported by: ${user}\n${truncate(description)}`).setTimestamp());
    return interaction.reply({ content: `Bug report **#${bug.id}** submitted. Thank you!`, ephemeral: true });
  }

  if (commandName === "bugs") {
    if (!hasCategory(member, "game_staff") && !hasCategory(member, "developer")) {
      return interaction.reply({ content: "You need the configured Game Staff or Developer role to view bugs.", ephemeral: true });
    }
    const items = config.bugs.filter(b => b.status === "open").slice(-15);
    const body = items.length
      ? items.map(b => `**#${b.id}** | <@${b.reporterId}> — ${truncate(b.description, 180)}`).join("\n")
      : "There are no open bug reports.";
    return interaction.reply({ content: `**Open Yats bugs**\n${body}`, ephemeral: true });
  }

  if (commandName === "fixbug") {
    if (!hasCategory(member, "game_staff") && !hasCategory(member, "developer")) {
      return interaction.reply({ content: "You need the configured Game Staff or Developer role to mark bugs fixed.", ephemeral: true });
    }
    const id = interaction.options.getInteger("id");
    const note = interaction.options.getString("note");
    const bug = await updateGuild(guild.id, data => {
      const item = data.bugs.find(b => b.id === id);
      if (item) { item.status = "fixed"; item.fixedBy = user.id; item.fixNote = note; }
      return item || null;
    });
    if (!bug) return interaction.reply({ content: `Bug #${id} was not found.`, ephemeral: true });
    await sendStaffLog(guild, new EmbedBuilder().setTitle(`Bug #${id} marked fixed`).setDescription(`Fixed by: ${user}\nNote: ${truncate(note)}`).setTimestamp());
    return interaction.reply({ content: `Bug **#${id}** marked as fixed.`, ephemeral: true });
  }

  if (commandName === "purge") {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "You need the Manage Messages permission.", ephemeral: true });
    }
    const amount = interaction.options.getInteger("amount");
    const deleted = await interaction.channel.bulkDelete(amount, true);
    return interaction.reply({ content: `Deleted **${deleted.size}** recent messages. Discord does not bulk-delete messages older than 14 days.`, ephemeral: true });
  }

  if (commandName === "lock" || commandName === "unlock") {
    if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "You need the Manage Channels permission.", ephemeral: true });
    }
    const everyone = guild.roles.everyone;
    const value = commandName === "lock" ? false : null;
    await interaction.channel.permissionOverwrites.edit(everyone, { SendMessages: value });
    return interaction.reply({ content: commandName === "lock" ? "This channel is now locked for @everyone." : "The @everyone send-message override has been removed.", ephemeral: true });
  }
}

client.once("ready", () => {
  console.log(`Yats Bot is online as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error);
    const message = "Something went wrong while running that command. Check the bot console for details.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => null);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => null);
    }
  }
});

(async () => {
  if (!process.env.DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN in .env");
  await load();
  await client.login(process.env.DISCORD_TOKEN);
})();
